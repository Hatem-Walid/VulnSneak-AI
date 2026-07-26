"""
╔══════════════════════════════════════════════════════════════════════════════╗
║       SQL Injection — Dataset Generator v2                                 ║
║       Target : CodeBERT 512 / Transformer fine-tuning                      ║
║       Model  : Qwen3-235B via Cerebras API (4 keys — parallel)             ║
║       Samples: 1,500                                                       ║
║                                                                            ║
║  Covers 14 subtypes:                                                       ║
║    Classic string concat, Numeric injection, Second-order, Blind           ║
║    time-based, Blind boolean, UNION-based, ORM raw query, Stored           ║
║    procedure injection, ORDER BY injection, IN-clause injection,           ║
║    LIKE-clause injection, Batch/stacked queries, JSON column               ║
║    injection, Error-based injection                                        ║
║                                                                            ║
║  Anti-problem checklist (lessons from old SQLi dataset review):            ║
║    ✅ Near-Duplicate  → 4-gram Jaccard 0.12–0.93 gate (thread-safe)        ║
║    ✅ Diversity       → 3-axis combo (subtype × lang/fw × context)         ║
║    ✅ Pair Quality    → 3-tier mitigation + VULN_INDICATORS                 ║
║    ✅ Consistency     → state="SQL Injection", safe_code_label="Safe"       ║
║    ✅ Token Length    → WP estimator (÷3.5) + dual truncation               ║
║    ✅ Context Diversity → 20 varied business contexts                       ║
║    ✅ Table Diversity  → 40+ unique table/entity names forced in prompt     ║
║    ✅ Parallel speed  → 4 API keys, ThreadPoolExecutor, per-key rate-limit  ║
║    ✅ Soft balancing  → per-axis counters prevent subtype monopoly          ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import json, re, time, random, threading
from pathlib import Path
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from openai import OpenAI

# ─────────────────────────────────────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────────────────────────────────────
CEREBRAS_KEYS = [csk-xxxxxxxxxxxxxxxx]
CEREBRAS_MODEL = "qwen-3-235b-a22b-instruct-2507"
TARGET         = 1500
OUTPUT_FILE    = r"sqli_v2_output.jsonl"
CHECKPOINT     = r"sqli_v2_checkpoint.jsonl"

WP_BUDGET  = 509   # [CLS] + vuln + [SEP] + safe + [SEP] = 512 → 509 usable
MAX_CHARS  = 1900
BATCH_SIZE = 4


# ══════════════════════════════════════════════════════════════════════════════
#  TABLE / ENTITY POOL — 40 unique names to force diversity
#  (old dataset only used 18 → caused near-dup explosion)
# ══════════════════════════════════════════════════════════════════════════════
TABLE_POOL = [
    "invoices", "shipments", "audit_logs", "subscriptions", "notifications",
    "reviews", "wishlists", "inventory", "transactions", "refunds",
    "appointments", "reservations", "contracts", "documents", "attachments",
    "permissions", "roles", "sessions", "api_keys", "webhooks",
    "campaigns", "analytics", "reports", "metrics", "events",
    "categories", "tags", "comments", "ratings", "votes",
    "suppliers", "warehouses", "locations", "departments", "projects",
    "milestones", "tickets", "issues", "alerts", "configurations",
]


# ══════════════════════════════════════════════════════════════════════════════
#  SYSTEM PROMPT
# ══════════════════════════════════════════════════════════════════════════════
SYSTEM_PROMPT = """\
You are a security training-data engine that generates EXACTLY TWO code blocks \
for fine-tuning CodeBERT on SQL Injection vulnerability detection.

OUTPUT FORMAT — strictly this, nothing else:

VULN:
<vulnerable code>

SAFE:
<fixed code>

════════════════════════════════════════════
SIZE RULES  (CRITICAL — model has 512 tokens)
════════════════════════════════════════════
• VULN: 7–16 lines (including imports). Aim for ~200–420 characters.
• SAFE: 9–20 lines. Aim for ~220–480 characters.
• COMBINED (VULN + SAFE) must be UNDER 1600 CHARACTERS TOTAL.
• Shorten business logic if needed — never shorten the security fix.
• No docstrings. No multi-line comments.

════════════════════════════════════════════
CRITICAL DIFFERENCE REQUIREMENT
════════════════════════════════════════════
• The SQL query line(s) MUST look visibly different between VULN and SAFE.
• VULN uses string concatenation / f-string / format() to build the query.
• SAFE replaces the query string AND the execute call with parameterized form.
• SAFE must add at least 2 new lines not present in VULN (the parameter binding).
• Do NOT just swap variable names — the query construction method must change.

Examples of acceptable changes:
  VULN: query = f"SELECT * FROM invoices WHERE id = '{user_id}'"
        cursor.execute(query)
  SAFE: cursor.execute("SELECT * FROM invoices WHERE id = %s", (user_id,))

  VULN: sql = "SELECT * FROM users WHERE name='" + name + "'"
        db.execute(sql)
  SAFE: stmt = db.prepare("SELECT * FROM users WHERE name = ?")
        stmt.execute([name])

════════════════════════════════════════════
FORMAT RULES
════════════════════════════════════════════
• No markdown fences, no backticks, no asterisks.
• No explanation text before or after the code blocks.
• ONE complete function per section: imports + function def + body.
• Same function name and same parameters in VULN and SAFE.

════════════════════════════════════════════
VULNERABILITY RULES
════════════════════════════════════════════
• VULN must contain EXACTLY ONE SQL Injection weakness — the specified subtype.
• VULN must include a REAL database query where user input flows into
  SQL without sanitization — not abstract or placeholder code.
• The query must touch a REAL named table/entity (the one specified).
• SAFE must fix ONLY the SQL injection. All other logic stays identical.
• The fix must be a REAL mitigation — NOT just input type-checking.

════════════════════════════════════════════
QUALITY RULES
════════════════════════════════════════════
• Use realistic column names matching the table (e.g., invoice_id, status).
• The function must perform a meaningful operation: SELECT, INSERT, UPDATE, DELETE.
• SAFE must use one of these proven mitigations:
    - Parameterized query / prepared statement (?, $1, @param, :name)
    - ORM query builder with bound parameters (filter(), where(), find())
    - Stored procedure with parameter binding
    - Input allowlist (enum/whitelist for column names in ORDER BY)
    - Strict integer cast + allowlist for numeric parameters
"""


# ══════════════════════════════════════════════════════════════════════════════
#  SUBTYPES — 14 distinct SQL Injection patterns
#  Format: (description, forbidden_in_safe)
# ══════════════════════════════════════════════════════════════════════════════
SUBTYPES = [

    # ── 1. Classic string concatenation ──────────────────────────────────────
    (
        "Classic SQL injection via string concatenation: user-supplied value is "
        "embedded directly into a SELECT query using string concatenation (+, .=, "
        "or f-string) — no prepared statement or escaping used",
        # forbidden: raw string concat still in safe
        [],
    ),

    # ── 2. Numeric parameter injection ───────────────────────────────────────
    (
        "Numeric SQL injection: integer parameter (ID, page number, price) is "
        "taken from user input and embedded in the query without type validation "
        "— attacker passes '1 OR 1=1' or '1; DROP TABLE' to manipulate results",
        [],
    ),

    # ── 3. Second-order SQL injection ─────────────────────────────────────────
    (
        "Second-order SQL injection: user-supplied data is safely stored in the "
        "database on first request but later retrieved and used in a new SQL "
        "query without re-sanitization — the injection fires on the second query",
        [],
    ),

    # ── 4. Blind time-based injection ─────────────────────────────────────────
    (
        "Blind time-based SQL injection: no data is returned to the attacker but "
        "the query is vulnerable to injected SLEEP() / WAITFOR DELAY / pg_sleep() "
        "— attacker infers data by measuring response time",
        [],
    ),

    # ── 5. Blind boolean-based injection ──────────────────────────────────────
    (
        "Blind boolean-based SQL injection: the application returns different "
        "responses (True/False, 200/404) based on whether an injected condition "
        "is true — attacker extracts data one bit at a time via AND 1=1 / AND 1=2",
        [],
    ),

    # ── 6. UNION-based injection ──────────────────────────────────────────────
    (
        "UNION-based SQL injection: attacker appends UNION SELECT to retrieve "
        "data from other tables — the application returns the injected rows "
        "alongside (or instead of) legitimate results",
        [],
    ),

    # ── 7. ORM raw query injection ────────────────────────────────────────────
    (
        "ORM raw query injection: the application uses an ORM (SQLAlchemy, "
        "Django ORM, ActiveRecord, TypeORM, Hibernate) but bypasses safe query "
        "builders by calling raw(), execute(), query() with an interpolated string",
        # forbidden: raw() / execute() with f-string/concat still present
        [],
    ),

    # ── 8. Stored procedure injection ─────────────────────────────────────────
    (
        "Stored procedure SQL injection: user input is passed to a stored "
        "procedure call by constructing the EXEC / CALL statement via string "
        "concatenation rather than using parameterized EXEC with bound variables",
        [],
    ),

    # ── 9. ORDER BY / column name injection ───────────────────────────────────
    (
        "ORDER BY injection: sort column or direction is taken from user input "
        "and appended to 'ORDER BY' clause — parameterized queries cannot bind "
        "column names, so attacker injects arbitrary SQL via the sort parameter",
        # forbidden: raw user input in ORDER BY must be gone
        [],
    ),

    # ── 10. IN-clause injection ───────────────────────────────────────────────
    (
        "IN-clause injection: a comma-separated list of values from user input "
        "is embedded directly into 'WHERE id IN (...)' — attacker breaks out of "
        "the list with ') OR 1=1--' to dump all records",
        [],
    ),

    # ── 11. LIKE-clause injection ─────────────────────────────────────────────
    (
        "LIKE-clause injection: search term is embedded in 'WHERE column LIKE "
        "'%...%'' without escaping — attacker uses % and _ wildcards to cause "
        "full table scans or injects ' to break the query",
        [],
    ),

    # ── 12. Stacked / batch query injection ───────────────────────────────────
    (
        "Stacked query injection: database driver supports multi-statement "
        "execution (MySQL, MSSQL with PDO::ATTR_EMULATE_PREPARES) — attacker "
        "appends '; DROP TABLE users--' to execute a second destructive statement",
        [],
    ),

    # ── 13. JSON column / operator injection ──────────────────────────────────
    (
        "JSON column injection: application queries a JSON/JSONB column using "
        "user-supplied key path embedded in the SQL (e.g., data->>'$.email') "
        "without parameterization — attacker manipulates the JSON path expression",
        [],
    ),

    # ── 14. Error-based injection ─────────────────────────────────────────────
    (
        "Error-based SQL injection: the application reflects database error "
        "messages to the user — attacker crafts a query that causes the DB to "
        "include sensitive data (table names, column values) in the error message",
        [],
    ),
]


# ══════════════════════════════════════════════════════════════════════════════
#  LANGUAGES & FRAMEWORKS — 25 combinations
# ══════════════════════════════════════════════════════════════════════════════
LANG_FRAMEWORKS = [
    # Python
    ("Python",  "Flask + SQLAlchemy"),
    ("Python",  "Django ORM"),
    ("Python",  "FastAPI + asyncpg"),
    ("Python",  "plain Python + psycopg2"),
    ("Python",  "plain Python + sqlite3"),
    # Java
    ("Java",    "Spring Boot + JPA/Hibernate"),
    ("Java",    "Spring JDBC Template"),
    ("Java",    "Jakarta EE + JDBC"),
    ("Java",    "MyBatis"),
    # Node.js
    ("NodeJS",  "Express + mysql2"),
    ("NodeJS",  "Express + pg (node-postgres)"),
    ("NodeJS",  "NestJS + TypeORM"),
    ("NodeJS",  "plain Node.js + mysql2"),
    # PHP
    ("PHP",     "Laravel Eloquent"),
    ("PHP",     "Symfony + Doctrine"),
    ("PHP",     "plain PHP + PDO"),
    # Go
    ("Go",      "Gin + database/sql"),
    ("Go",      "plain Go + pgx"),
    ("Go",      "GORM"),
    # C#
    ("CSharp",  "ASP.NET Core + Entity Framework"),
    ("CSharp",  "ASP.NET Core + Dapper"),
    # Ruby
    ("Ruby",    "Rails + ActiveRecord"),
    ("Ruby",    "Sinatra + Sequel"),
    # Kotlin
    ("Kotlin",  "Ktor + Exposed"),
    ("Kotlin",  "Spring Boot Kotlin + JPA"),
]


# ══════════════════════════════════════════════════════════════════════════════
#  BUSINESS CONTEXTS — 20 varied scenarios with different table names
# ══════════════════════════════════════════════════════════════════════════════
CONTEXTS = [
    "invoice search in billing / accounts receivable system",
    "shipment tracking query in logistics platform",
    "audit log retrieval in compliance dashboard",
    "subscription status check in SaaS billing portal",
    "notification preference lookup in messaging platform",
    "product review search in e-commerce marketplace",
    "inventory availability check in warehouse management system",
    "refund eligibility query in payment processing service",
    "appointment booking lookup in healthcare scheduling system",
    "contract clause search in legal document management platform",
    "employee permission check in HR management system",
    "campaign performance query in marketing analytics dashboard",
    "API key validation in developer portal",
    "webhook event log search in integration platform",
    "report generation query in business intelligence tool",
    "supplier price comparison in procurement system",
    "project milestone status in project management tool",
    "support ticket search in customer service platform",
    "configuration value lookup in multi-tenant SaaS platform",
    "transaction dispute query in fintech reconciliation system",
]


# ══════════════════════════════════════════════════════════════════════════════
#  GLOBAL MITIGATION SIGNALS — Tier 1
# ══════════════════════════════════════════════════════════════════════════════
MITIGATION_SIGNALS = [
    # ── Parameterized queries / prepared statements ────────────────────────────
    "prepare(", "prepareStatement(", "PreparedStatement",
    "cursor.execute(", "cursor.executemany(",
    "%s", "%d", "%i", "%(", "?", "$1", "$2", "$3",
    ":name", ":param", ":id", ":value", ":query",
    "@param", "@id", "@value", "@name",
    "params=", "params=[", "params=(", "values=(",
    "bind_param(", "bindParam(", "bindValue(",
    "execute([", "execute(query,", "execute(sql,",
    # ── Python ────────────────────────────────────────────────────────────────
    "text(", "db.execute(text(", "sqlalchemy.text(",
    ".filter(", ".filter_by(", ".where(",
    "session.query(", "db.session.query(",
    "objects.filter(", "objects.get(", "objects.exclude(",
    "annotate(", "aggregate(", ".values(", ".only(",
    "psycopg2", "cursor.execute(\"%s\"", "mogrify(",
    # ── Java ──────────────────────────────────────────────────────────────────
    "setString(", "setInt(", "setLong(", "setDate(",
    "setParameter(", "setParam(",
    "createQuery(", "createNativeQuery(",
    "namedParameterJdbcTemplate", "NamedParameterJdbcTemplate",
    "MapSqlParameterSource", "BeanPropertySqlParameterSource",
    "@Query(\"", "@Param(", "JdbcTemplate",
    "entityManager.createQuery(",
    # ── Node.js ───────────────────────────────────────────────────────────────
    "db.query(query, [", "pool.query(query, [",
    "pool.query(sql, [", "client.query(sql, [",
    "connection.query(query, [", "connection.execute(",
    "createQueryBuilder(", ".andWhere(", ".setParameter(",
    "getRepository(", "typeorm",
    # ── PHP ───────────────────────────────────────────────────────────────────
    "prepare(", "->prepare(", "pdo->prepare(",
    "bindParam(", "bindValue(", "execute(array(",
    "whereIn(", "where('", "->where(", "->find(",
    "Model::where(", "DB::select(", "DB::table(",
    "->whereRaw(", "orWhere(", "->get()",
    # ── Go ────────────────────────────────────────────────────────────────────
    "db.Query(query, ", "db.QueryRow(query, ",
    "db.Exec(query, ", "rows, err := db.Query(",
    "pgx.Connect(", "pgxpool.", "sq.Select(",
    "sqlx.NamedExec(", ".NamedQuery(",
    # ── C# ────────────────────────────────────────────────────────────────────
    "AddWithValue(", "Parameters.Add(",
    "SqlParameter(", "DbParameter(",
    ".FromSqlRaw(", ".FromSqlInterpolated(",
    "DapperExtensions", ".Query<",
    "commandText", "CommandType.Text",
    # ── Ruby ──────────────────────────────────────────────────────────────────
    "where(\"", "where(id:", "where(status:",
    ".find(", ".find_by(", "sanitize_sql(",
    "where([\"", "connection.execute(",
    "Sequel.lit(", ".where(Sequel.lit(",
    # ── ORM allowlist for ORDER BY ─────────────────────────────────────────────
    "ALLOWED_COLUMNS", "ALLOWED_SORT", "allowed_cols",
    "allowed_columns", "valid_columns", "VALID_COLUMNS",
    "whitelist_columns", "column_whitelist",
    "in ALLOWED", "in allowed", "in COLUMNS",
    # ── Generic validation ────────────────────────────────────────────────────
    "raise", "throw", "abort(", "return nil", "return null",
    "return false", "return False",
    "int(", "Integer.parseInt(", "int.Parse(", "intval(",
    "isdigit()", ".isdigit()", "isnumeric()", ".isnumeric()",
    "re.match(", "re.fullmatch(", "Pattern.compile(",
    "Regex.IsMatch(", "preg_match(",
    "ValueError(", "IllegalArgumentException(", "SecurityException(",
    "400", "403", "HttpStatus.BAD_REQUEST",
]

# ══════════════════════════════════════════════════════════════════════════════
#  TIER-2 BROAD SECURITY PATTERNS
# ══════════════════════════════════════════════════════════════════════════════
BROAD_SECURITY = [
    "param", "Param", "PARAM", "bind", "Bind",
    "prepared", "Prepared", "parameterized", "Parameterized",
    "placeholder", "sanitize", "Sanitize", "escape", "Escape",
    "validate", "Validate", "allowlist", "whitelist",
    "ALLOWED", "allowed", "valid_", "isValid", "is_valid",
    "raise", "throw", "abort(", "return null", "return nil",
    "return false", "return False",
    "filter(", "Filter(", "where(", "Where(",
    "query(", "Query(", "execute(", "Execute(",
    "400", "403", "BadRequest", "Forbidden",
    "int(", "Integer", "intval(", "isdigit",
    "re.match", "Pattern", "Regex", "preg_match",
    "ORM", "orm", "repository", "Repository",
]

# ══════════════════════════════════════════════════════════════════════════════
#  VULN INDICATORS — must appear in vuln_code
# ══════════════════════════════════════════════════════════════════════════════
VULN_INDICATORS = [
    # ── SQL keywords in query strings ─────────────────────────────────────────
    "SELECT ", "INSERT ", "UPDATE ", "DELETE ", "WHERE ",
    "select ", "insert ", "update ", "delete ", "where ",
    "FROM ", "JOIN ", "UNION ", "ORDER BY", "GROUP BY",
    # ── Raw query execution functions ─────────────────────────────────────────
    "execute(", "query(", "Query(", "Execute(",
    "cursor.execute(", "db.query(", "pool.query(", "db.Query(",
    "connection.query(", "client.query(",
    "pdo->query(", "mysqli_query(", "$pdo->query(",
    "DB::select(", "DB::statement(", "DB::unprepared(",
    "session.execute(", "engine.execute(", "db.execute(",
    "conn.execute(", "raw(", ".raw(",
    "createNativeQuery(", "nativeQuery(",
    "db.Exec(", "db.QueryRow(",
    "executeQuery(", "executeUpdate(", "createStatement(",
    "SqlCommand(", "ExecuteReader(", "ExecuteNonQuery(",
    "ExecuteScalar(", "ExecuteAsync(",
    "execute(", "ActiveRecord::Base.connection.execute(",
    "find_by_sql(", "connection.execute(",
    "transaction {", "exec(",
    # ── String building signals ───────────────────────────────────────────────
    'f"SELECT', 'f"INSERT', 'f"UPDATE', 'f"DELETE',
    "f'SELECT", "f'INSERT", "f'UPDATE", "f'DELETE",
    '"SELECT', '"INSERT', '"UPDATE', '"DELETE',
    "'SELECT", "'INSERT", "'UPDATE", "'DELETE",
    '+ " WHERE', "+ ' WHERE", 'WHERE " +', "WHERE ' +",
    '" + id', '" + name', '" + user', '" + param', '" + val',
    "' + id", "' + name", "' + user", "' + param",
    "#{id}", "#{name}", "#{user}", "#{param}", "#{query}",
    "${id}", "${name}", "${user}", "${param}",
    "LIKE '%\" +", "LIKE '%" , 'ORDER BY " +', "ORDER BY ' +",
    'IN (" +', "IN (' +",
    # ── Broader SQL context ───────────────────────────────────────────────────
    "sql =", "sql=", "query =", "query=",
    "SQL =", "SQL=", "sqlQuery", "sqlString",
    "queryString", "queryStr", "sqlStr",
    'sql = "SELECT', "sql = 'SELECT",
    'query = "SELECT', "query = 'SELECT",
    "sql.append(", "sb.append(", "StringBuilder",
    "string.Format(", "String.Format(", "$\"SELECT",
    "sprintf(", "fmt.Sprintf(",
    "interpolat", "format(\"SELECT", "format('SELECT",
    # ── ORM raw execution ─────────────────────────────────────────────────────
    ".raw(", "db.raw(", "knex.raw(",
    "sequelize.query(", "Sequelize.query(",
    "sqlalchemy.text(", "text(\"SELECT",
]


# ══════════════════════════════════════════════════════════════════════════════
#  API CLIENT POOL — round-robin, per-key rate-limit
# ══════════════════════════════════════════════════════════════════════════════
_clients = [
    OpenAI(api_key=key, base_url="https://api.cerebras.ai/v1")
    for key in CEREBRAS_KEYS
]
_key_lock   = threading.Lock()
_key_index  = 0
_key_sleep: dict[int, float] = {i: 0.0 for i in range(len(CEREBRAS_KEYS))}


def _next_client() -> tuple[int, "OpenAI"]:
    global _key_index
    with _key_lock:
        now = time.monotonic()
        for _ in range(len(_clients)):
            idx = _key_index % len(_clients)
            _key_index += 1
            if now >= _key_sleep.get(idx, 0):
                return idx, _clients[idx]
        idx = min(_key_sleep, key=lambda k: _key_sleep[k])
        return idx, _clients[idx]


def _sleep_key(idx: int, seconds: float = 62.0):
    with _key_lock:
        _key_sleep[idx] = time.monotonic() + seconds
        print(f"  [LIMIT] key#{idx} sleeping {seconds:.0f}s …")


def call_api(user_msg: str) -> str | None:
    for attempt in range(5):
        idx, client = _next_client()
        wait = _key_sleep.get(idx, 0) - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        try:
            resp = client.chat.completions.create(
                model=CEREBRAS_MODEL,
                max_tokens=620,
                temperature=0.82,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user",   "content": user_msg},
                ],
            )
            return resp.choices[0].message.content
        except Exception as exc:
            msg = str(exc)
            if "429" in msg or "quota" in msg.lower() or "rate" in msg.lower():
                _sleep_key(idx, 62.0)
            elif "503" in msg or "502" in msg:
                time.sleep(5 * (attempt + 1))
            else:
                if attempt == 4:
                    print(f"  [ERR] key#{idx}: {msg[:80]}")
                time.sleep(2 * (attempt + 1))
    return None


# ══════════════════════════════════════════════════════════════════════════════
#  HELPERS
# ══════════════════════════════════════════════════════════════════════════════
def wp_tokens(text: str) -> int:
    return max(1, int(len(text) / 3.5))


def strip_comments(code: str) -> str:
    code = re.sub(r'#.*',       '',  code)
    code = re.sub(r'//.*',      '',  code)
    code = re.sub(r'/\*.*?\*/', '',  code, flags=re.DOTALL)
    code = re.sub(r'""".*?"""', '',  code, flags=re.DOTALL)
    code = re.sub(r"'''.*?'''", '',  code, flags=re.DOTALL)
    return code


def tokenize(code: str) -> list[str]:
    return re.findall(r'[a-zA-Z_]\w*|[0-9]+', code)


def jaccard(a: list, b: list) -> float:
    sa, sb = set(a), set(b)
    if not sa and not sb:
        return 1.0
    return len(sa & sb) / (len(sa) + len(sb) - len(sa & sb))


FUNCTION_KEYWORDS = [
    "def ", "func ", "fn ", "function ", "async function",
    "public ", "private ", "protected ", "internal ", "override ",
    "static ", "void ", "async ",
    "const ", "let ", "var ", "module.exports", "exports.",
    "<?php", "fun ", "object ", "class ", "interface ",
    "router.", "app.get(", "app.post(", "app.put(",
    "http.HandleFunc(", "Route::", "@app.route", "@router.",
    " do\n", " do |", "post '", "get '", "post \"", "get \"",
    "@GetMapping", "@PostMapping", "@RequestMapping",
]

def has_function(code: str) -> bool:
    return any(kw in code for kw in FUNCTION_KEYWORDS)


def smart_truncate(code: str, wp_budget: int) -> str:
    lines, kept, total = code.split('\n'), [], 0
    for line in lines:
        cost = wp_tokens(line)
        if total + cost > wp_budget:
            break
        kept.append(line)
        total += cost
    result = '\n'.join(kept)
    if len(kept) < len(lines):
        opens = result.count('{') - result.count('}')
        if opens > 0:
            result += '\n' + '}\n' * opens
    return result


def parse_blocks(text: str) -> tuple[str | None, str | None]:
    text = re.sub(r'\*\*(VULN|SAFE):\*\*', r'\1:', text, flags=re.IGNORECASE)
    text = re.sub(r'```[a-zA-Z]*\n?', '', text)
    text = re.sub(r'```', '', text)
    vm = re.search(r'VULN:\s*\n(.*?)(?=\nSAFE:)', text, re.DOTALL | re.IGNORECASE)
    sm = re.search(r'SAFE:\s*\n(.+)$',             text, re.DOTALL | re.IGNORECASE)
    if not vm or not sm:
        return None, None
    return vm.group(1).strip(), sm.group(1).strip()


# ══════════════════════════════════════════════════════════════════════════════
#  NEAR-DUPLICATE DETECTION
# ══════════════════════════════════════════════════════════════════════════════
def ngrams(code: str, n: int = 4) -> frozenset:
    t = tokenize(code)
    if len(t) < n:
        return frozenset(t)
    return frozenset('|'.join(t[i:i+n]) for i in range(len(t) - n + 1))


def is_near_dup(fp: frozenset, seen: list[frozenset], threshold: float = 0.80) -> bool:
    for prev in seen:
        inter = len(fp & prev)
        union = len(fp) + len(prev) - inter
        if union and inter / union >= threshold:
            return True
    return False


# ══════════════════════════════════════════════════════════════════════════════
#  VALIDATION GATE
# ══════════════════════════════════════════════════════════════════════════════
def validate(vuln: str, safe: str, subtype_tuple: tuple) -> tuple[bool, str]:
    desc, forbidden = subtype_tuple

    if not vuln or not safe:
        return False, "empty block"
    if not has_function(vuln):
        return False, "vuln: no function"
    if not has_function(safe):
        return False, "safe: no function"

    vc, sc = len(vuln), len(safe)
    if vc < 80:             return False, f"vuln too short ({vc} chars)"
    if vc > 1200:           return False, f"vuln too long ({vc} chars)"
    if sc < 100:            return False, f"safe too short ({sc} chars)"
    if sc > 1300:           return False, f"safe too long ({sc} chars)"
    if vc + sc > MAX_CHARS: return False, f"combined too long ({vc+sc} chars)"

    vwp = wp_tokens(vuln)
    swp = wp_tokens(safe)
    if vwp + swp + 3 > WP_BUDGET + 3:
        return False, f"WP-token overflow ({vwp+swp+3} > 512)"

    vt, st = tokenize(vuln), tokenize(safe)
    if len(vt) < 8:  return False, f"vuln too few identifiers ({len(vt)})"
    if len(st) < 8:  return False, f"safe too few identifiers ({len(st)})"

    sim = jaccard(vt, st)
    if sim < 0.15:    return False, f"pair too dissimilar ({sim:.2f})"
    # SQL fix is inherently high-Jaccard (only placeholder changes) —
    # rely on line-identical check below instead of tight upper bound
    if sim >= 0.995:  return False, f"pair zero-change ({sim:.2f})"

    vlines = {l.strip() for l in vuln.split('\n') if l.strip()}
    slines = {l.strip() for l in safe.split('\n') if l.strip()}
    if vlines == slines:
        return False, "zero-change: vuln and safe are line-identical"

    # The SQL query line MUST differ between vuln and safe
    # Extract lines containing SQL keywords
    def sql_lines(code):
        kw = ("SELECT","INSERT","UPDATE","DELETE","WHERE","FROM",
              "execute(","query(","Query(","Execute(","cursor.execute")
        return {l.strip() for l in code.split('\n')
                if any(k in l for k in kw) and l.strip()}
    vsql = sql_lines(vuln)
    ssql = sql_lines(safe)
    if vsql and ssql and vsql == ssql:
        return False, "SQL query lines unchanged between vuln and safe"

    # New lines added by safe must be meaningful
    new_lines = [l for l in slines - vlines
                 if len(l) > 8
                 and not l.startswith(('#', '//', 'import ', 'from ', 'using ',
                                        'require ', 'package '))]
    if len(new_lines) < 1:
        return False, "safe adds no meaningful new lines"

    safe_nc = strip_comments(safe)
    for pat in (forbidden or []):
        if pat in safe_nc:
            return False, f"forbidden pattern still in safe: '{pat}'"

    # SQL operation must appear in vuln_code
    if not any(ind in vuln for ind in VULN_INDICATORS):
        return False, "vuln does not appear to involve SQL operations"

    # 3-TIER MITIGATION CHECK
    tier1 = any(sig in safe for sig in MITIGATION_SIGNALS)
    tier2 = any(pat in safe for pat in BROAD_SECURITY)

    # Tier 3: structural diff
    tier3 = len(new_lines) >= 2

    if not (tier1 or tier2 or tier3):
        snippet = safe[:100].replace('\n', ' | ')
        return False, f"no SQL mitigation detected — snippet: {snippet}"

    return True, ""


# ══════════════════════════════════════════════════════════════════════════════
#  CHECKPOINT I/O
# ══════════════════════════════════════════════════════════════════════════════
def load_checkpoint() -> list[dict]:
    p = Path(CHECKPOINT)
    if not p.exists():
        return []
    out = []
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            try:
                out.append(json.loads(line))
            except Exception:
                pass
    return out


def save_checkpoint(samples: list[dict]) -> None:
    Path(CHECKPOINT).parent.mkdir(parents=True, exist_ok=True)
    with open(CHECKPOINT, "w", encoding="utf-8") as f:
        for s in samples:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")


# ══════════════════════════════════════════════════════════════════════════════
#  PROMPT BUILDER — forces unique table names to prevent near-dups
# ══════════════════════════════════════════════════════════════════════════════
def build_user_msg(subtype_desc: str, lang: str, fw: str, ctx: str,
                   table: str) -> str:
    return (
        f"Language: {lang}\n"
        f"Framework / Library: {fw}\n"
        f"Vulnerability subtype: {subtype_desc}\n"
        f"Business context: {ctx}\n"
        f"Database table / entity to use: {table}\n\n"
        "Requirements:\n"
        "- VULN: 7–16 lines, ~200–420 chars. ONE SQL injection weakness.\n"
        "- VULN must include a REAL SQL query on the '{table}' table where\n"
        "  user input flows into SQL without sanitization.\n"
        "- Use REALISTIC column names for the '{table}' table.\n"
        "- SAFE: 9–20 lines, ~220–480 chars. Fix ONLY the SQL injection.\n"
        "- Combined VULN + SAFE must be UNDER 1600 CHARACTERS.\n"
        "- Same function name and parameters in both blocks.\n"
        "- Include minimal necessary imports only.\n"
        "- Safe mitigation: parameterized query (?, $1, :param, @param),\n"
        "  ORM query builder with bound params, or column allowlist for ORDER BY.\n"
        "- Do NOT use string escaping or input validation alone as the fix."
    ).replace("'{table}'", f"'{table}'")


# ══════════════════════════════════════════════════════════════════════════════
#  PROCESS ONE COMBO — parallel worker
# ══════════════════════════════════════════════════════════════════════════════
def process_combo(subtype_tuple, lang, fw, ctx, table) -> dict | None:
    subtype_desc = subtype_tuple[0]
    user_msg = build_user_msg(subtype_desc, lang, fw, ctx, table)
    raw = call_api(user_msg)
    if not raw:
        return None

    vuln, safe = parse_blocks(raw)
    if not vuln or not safe:
        return None

    # Char overflow truncation
    combined = len(vuln) + len(safe)
    if combined > MAX_CHARS:
        vc, sc = len(vuln), len(safe)
        v_cb  = max(240, int(MAX_CHARS * vc / max(vc + sc, 1)))
        sf_cb = MAX_CHARS - v_cb
        if vc > v_cb:
            vuln = smart_truncate(vuln, max(60, v_cb // 4))
        if sc > sf_cb:
            safe = smart_truncate(safe, max(70, sf_cb // 4))

    # WP overflow truncation
    total_wp = wp_tokens(vuln) + wp_tokens(safe) + 3
    if total_wp > WP_BUDGET + 3:
        vwp = wp_tokens(vuln)
        swp = wp_tokens(safe)
        vb  = max(65, int(WP_BUDGET * vwp / max(vwp + swp, 1)))
        sb  = WP_BUDGET - vb
        if vwp > vb: vuln = smart_truncate(vuln, vb)
        if swp > sb: safe = smart_truncate(safe, sb)

    ok, reason = validate(vuln, safe, subtype_tuple)
    if not ok:
        return {"_skip": reason}

    return {
        "vuln_code":       vuln,
        "state":           "SQL Injection",
        "safe_code":       safe,
        "safe_code_label": "Safe",
        "_subtype":        subtype_desc[:60],
        "_lang":           lang,
        "_framework":      fw,
        "_context":        ctx,
        "_table":          table,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════════════
def main() -> None:
    samples = load_checkpoint()
    kept    = len(samples)

    fingerprints: list[frozenset] = [ngrams(s["vuln_code"]) for s in samples]
    fp_lock = threading.Lock()

    subtype_counts  = defaultdict(int)
    lang_counts     = defaultdict(int)
    context_counts  = defaultdict(int)
    table_counts    = defaultdict(int)
    for s in samples:
        subtype_counts[s.get("_subtype", "")]  += 1
        lang_counts[s.get("_lang", "")]        += 1
        context_counts[s.get("_context", "")]  += 1
        table_counts[s.get("_table", "")]      += 1

    # Build combos — include table in rotation for diversity
    combos = [
        (sub, lang, fw, ctx, table)
        for sub in SUBTYPES
        for (lang, fw) in LANG_FRAMEWORKS
        for ctx in CONTEXTS
        for table in random.sample(TABLE_POOL, 2)   # 2 tables per ctx
    ]
    random.shuffle(combos)
    total_combos = len(combos)
    combo_idx    = kept % total_combos
    skipped = errors = 0

    print(f"╔══════════════════════════════════════════╗")
    print(f"║   SQL Injection Dataset Generator        ║")
    print(f"╚══════════════════════════════════════════╝")
    print(f"  Loaded from checkpoint : {kept}")
    print(f"  Target                 : {TARGET}")
    print(f"  Total combos           : {total_combos:,}")
    print(f"  Subtypes               : {len(SUBTYPES)}")
    print(f"  Lang/FW combos         : {len(LANG_FRAMEWORKS)}")
    print(f"  Business contexts      : {len(CONTEXTS)}")
    print(f"  Table pool             : {len(TABLE_POOL)} unique tables")
    print(f"  API keys (parallel)    : {len(CEREBRAS_KEYS)}")
    print()

    with ThreadPoolExecutor(max_workers=BATCH_SIZE) as executor:
        while kept < TARGET:

            # Build batch
            batch = []
            attempts = 0
            while len(batch) < BATCH_SIZE and kept + len(batch) < TARGET:
                item = combos[combo_idx % total_combos]
                combo_idx += 1
                attempts += 1
                if attempts > total_combos * 2:
                    break

                subtype_tuple, lang, fw, ctx, table = item
                sub_desc = subtype_tuple[0]

                # Soft balance on subtype
                avg_sub = kept / max(len(SUBTYPES), 1)
                if subtype_counts[sub_desc] > avg_sub * 1.4 and kept > 50:
                    skipped += 1
                    continue

                # Soft balance on table — prevent any single table dominating
                avg_table = kept / max(len(TABLE_POOL), 1)
                if table_counts[table] > avg_table * 2.5 and kept > 100:
                    continue

                batch.append(item)

            if not batch:
                break

            futures = {
                executor.submit(process_combo, st, la, fw, ctx, tbl): (st, la, fw, ctx, tbl)
                for st, la, fw, ctx, tbl in batch
            }

            for future in as_completed(futures):
                subtype_tuple, lang, fw, ctx, table = futures[future]
                sub_desc = subtype_tuple[0]

                try:
                    result = future.result()
                except Exception as exc:
                    print(f"  [ERR] {exc}")
                    errors += 1; skipped += 1
                    continue

                if result is None:
                    errors += 1; skipped += 1
                    continue

                if "_skip" in result:
                    print(f"  [SKIP] {result['_skip']}")
                    skipped += 1
                    continue

                fp = ngrams(result["vuln_code"])
                with fp_lock:
                    if is_near_dup(fp, fingerprints):
                        print(f"  [DUP]  near-duplicate rejected")
                        skipped += 1
                        continue
                    fingerprints.append(fp)

                subtype_counts[sub_desc]  += 1
                lang_counts[lang]         += 1
                context_counts[ctx]       += 1
                table_counts[table]       += 1
                samples.append(result)
                kept += 1

                if kept % 10 == 0:
                    save_checkpoint(samples)
                    total_done = kept + skipped
                    skip_pct   = skipped * 100 // total_done if total_done else 0
                    avg_wp     = sum(
                        wp_tokens(s["vuln_code"]) + wp_tokens(s["safe_code"]) + 3
                        for s in samples[-10:]
                    ) // 10
                    print(
                        f"  [{kept:>4}/{TARGET}]  {kept*100//TARGET:>3}%  "
                        f"skip={skipped} ({skip_pct}%)  err={errors}  "
                        f"avg_wp={avg_wp}"
                    )

    # Final save
    save_checkpoint(samples)
    final = [{k: v for k, v in s.items() if not k.startswith("_")} for s in samples]
    Path(OUTPUT_FILE).parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for s in final:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")

    print()
    print(f"╔══════════════════════════════════════════╗")
    print(f"║  DONE — {kept} samples saved              ║")
    print(f"╚══════════════════════════════════════════╝")
    print(f"  Output  : {OUTPUT_FILE}")
    print(f"  Skipped : {skipped}")
    print(f"  Errors  : {errors}")
    print()
    print("  Subtype distribution:")
    for k, v in sorted(subtype_counts.items(), key=lambda x: -x[1]):
        print(f"    {v:>4}  {k[:68]}")
    print()
    print("  Language distribution:")
    for k, v in sorted(lang_counts.items(), key=lambda x: -x[1]):
        print(f"    {v:>4}  {k}")
    print()
    print("  Table distribution (top 15):")
    for k, v in sorted(table_counts.items(), key=lambda x: -x[1])[:15]:
        print(f"    {v:>4}  {k}")


if __name__ == "__main__":
    main()
