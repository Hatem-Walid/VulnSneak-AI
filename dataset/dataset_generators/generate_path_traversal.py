"""
╔══════════════════════════════════════════════════════════════════════════════╗
║          Path Traversal — Dataset Generator v3                             ║
║          Target: CodeBERT 512 / Transformer fine-tuning                    ║
║          Model : Qwen3-235B via Cerebras API                               ║
║  v3 fixes:                                                                 ║
║    - Global MITIGATION_SIGNALS replaces per-subtype expected lists         ║
║      → covers ALL languages/frameworks generically (~60 patterns)          ║
║    - has_function() expanded: PHP/Ruby/Node.js/Go/C# edge cases            ║
║    - SUBTYPES simplified: expected=[] (global check handles it)            ║
║    - Checkpoint file renamed to v3                                         ║
╚══════════════════════════════════════════════════════════════════════════════╝

Anti-problem checklist built-in:
  ✅ Near-Duplicate  → 4-gram fingerprint + Jaccard 0.12–0.93 gate
  ✅ Diversity       → 3-axis combo (subtype × lang/fw × context) + per-axis counters
  ✅ Pair Quality    → forbidden-pattern + expected-signal + zero-change detection
  ✅ Consistency     → state="Path_Traversal", safe_code_label="safe" always
  ✅ Token Length    → WP-token estimator enforces combined ≤ 509 WP-tokens
  ✅ Context Diversity → 20 business contexts rotated evenly
"""

import json, re, time, random
from pathlib import Path
from collections import defaultdict
from openai import OpenAI

# ─────────────────────────── CONFIG ──────────────────────────────────────────
CEREBRAS_KEY   = "csk-xxxxxxxxxxxxxxxx"
CEREBRAS_MODEL = "qwen-3-235b-a22b-instruct-2507"
TARGET         = 2700
OUTPUT_FILE    = r"path_traversal_v3_output.jsonl"
CHECKPOINT     = r"path_traversal_v3_checkpoint.jsonl"

# CodeBERT 512 budget:  [CLS] + vuln_tokens + [SEP] + safe_tokens + [SEP]  = 512
# 3 special tokens → usable = 509 WP-tokens
WP_BUDGET   = 509
MAX_CHARS   = 1900   # hard char ceiling before WP estimation  (v2: relaxed 1800→1900)


# ══════════════════════════════════════════════════════════════════════════════
#  SYSTEM PROMPT  — English, security-precise, size-strict
# ══════════════════════════════════════════════════════════════════════════════
SYSTEM_PROMPT = """\
You are a security training-data engine that generates EXACTLY TWO code blocks \
for fine-tuning CodeBERT on Path Traversal vulnerability detection.

OUTPUT FORMAT — strictly this, nothing else:

VULN:
<vulnerable code>

SAFE:
<fixed code>

════════════════════════════════════════════
SIZE RULES  (CRITICAL — model has 512 tokens)
════════════════════════════════════════════
• VULN: 7–16 lines (including imports). Aim for ~180–380 characters.
• SAFE: 9–20 lines. Aim for ~220–450 characters.
• COMBINED (VULN + SAFE) must be UNDER 1800 CHARACTERS TOTAL.
• If you exceed the limit, shorten the business logic — NOT the security fix.
• No docstrings. No multi-line comments. No blank lines between statements.

════════════════════════════════════════════
FORMAT RULES
════════════════════════════════════════════
• No markdown fences, no backticks, no asterisks.
• No explanation text before or after the code blocks.
• ONE complete function per section: all needed imports + function def + body.
• Same function name and same parameters in VULN and SAFE.

════════════════════════════════════════════
VULNERABILITY RULES
════════════════════════════════════════════
• VULN must contain EXACTLY ONE Path Traversal weakness — the specified subtype.
• VULN **must include a real file operation** (open(), readFile(), fopen(), File.open(),
  os.Open(), Files.readAllBytes(), fs.readFileSync(), file_get_contents(), etc.).
  Do NOT generate abstract or placeholder code — user input must actually flow into a file path.
• SAFE must fix ONLY that weakness. All other logic stays identical.
• The fix must be a REAL mitigation (canonicalization, whitelist, realpath, etc.).
• SAFE must NOT still be vulnerable — do not use blacklists that can be bypassed.

════════════════════════════════════════════
QUALITY RULES
════════════════════════════════════════════
• Use realistic business identifiers (invoice IDs, usernames, template names, etc.).
• No shell commands. No os.system / subprocess for the traversal itself.
• Function body must do something meaningful (read, serve, save, render).
• SAFE must use one of these proven mitigations:
    - os.path.realpath() / Path.resolve() + base-directory prefix check
    - os.path.basename() to strip all directory components
    - allowlist of permitted filenames or extensions
    - ZipFile member path validation against extract root
    - framework-provided safe file APIs (send_from_directory, safe_join, etc.)
"""


# ══════════════════════════════════════════════════════════════════════════════
#  SUBTYPES  — 16 distinct Path Traversal attack patterns
#  Each entry: (description, expected_signals_in_safe, forbidden_in_safe)
# ══════════════════════════════════════════════════════════════════════════════
SUBTYPES = [

    # ── 1. Direct string concatenation ────────────────────────────────────────
    (
        "Direct path concatenation: user-supplied filename joined to a base "
        "directory with string concatenation (+) — no canonicalization",
        [],   # mitigation checked by global MITIGATION_SIGNALS
        ["base_dir + filename", "base_path + ", "+ file_name",
         "path + request", "folder + name"],
    ),

    # ── 2. os.path.join with absolute user input ───────────────────────────────
    (
        "os.path.join() called with user-controlled segment that can be absolute "
        "('/etc/passwd') — silently discards the base directory",
        [],
        [],
    ),

    # ── 3. Dot-dot traversal in file download ─────────────────────────────────
    (
        "File download endpoint that accepts a filename parameter containing "
        "'../' sequences without sanitization",
        [],
        [],
    ),

    # ── 4. URL-encoded traversal (%2e%2e%2f) ──────────────────────────────────
    (
        "File serving endpoint that URL-decodes the path parameter but does NOT "
        "canonicalize it — allows %2e%2e%2f encoded traversal",
        [],
        [],
    ),

    # ── 5. ZipSlip — archive extraction without path check ────────────────────
    (
        "ZipSlip: extracting a ZIP/TAR archive without validating that each "
        "member's resolved path stays inside the target extraction directory",
        [],
        [],
    ),

    # ── 6. Template file inclusion ─────────────────────────────────────────────
    (
        "Template engine called with a user-supplied template filename that is "
        "joined to a templates directory without validation — allows reading "
        "arbitrary files outside the templates folder",
        [],
        [],
    ),

    # ── 7. Image / static file serving ────────────────────────────────────────
    (
        "Static file serving endpoint (images, CSS, JS) that constructs the "
        "file path from a URL query parameter without stripping traversal sequences",
        [],
        [],
    ),

    # ── 8. File upload — user-controlled save path ────────────────────────────
    (
        "File upload handler that uses the original filename from the "
        "multipart request to construct the save path without sanitization",
        [],
        [],
    ),

    # ── 9. Log file viewer ─────────────────────────────────────────────────────
    (
        "Log viewer endpoint that opens a log file whose name comes directly "
        "from a query parameter — allows reading /etc/passwd or other system files",
        [],
        [],
    ),

    # ── 10. Config / settings file loader ─────────────────────────────────────
    (
        "Configuration loader that reads a YAML/JSON/INI file using a "
        "user-supplied profile name appended to a config directory",
        [],
        [],
    ),

    # ── 11. Path traversal through HTTP Range / Content-Disposition ───────────
    (
        "File export endpoint that sets Content-Disposition filename from "
        "user input without sanitization — path leaks through filename parameter",
        [],
        [],
    ),

    # ── 12. Null-byte injection (%00) ──────────────────────────────────────────
    (
        "Null-byte injection (PHP): file path built from user input where a null "
        "byte (\\x00 / %00) truncates the string at the OS level — e.g., "
        "'config.php\\x00.jpg' bypasses an extension whitelist in PHP < 7.1",
        [],
        [],
    ),

    # ── 13. Directory listing / traversal via API parameter ───────────────────
    (
        "REST API endpoint that lists or reads files in a directory specified "
        "by the caller — no restriction to a permitted base directory",
        [],
        [],
    ),

    # ── 14. Symlink following ──────────────────────────────────────────────────
    (
        "File read operation that resolves symlinks inside a user-accessible "
        "directory without checking that the final real path remains inside "
        "the permitted directory",
        [],
        [],
    ),

    # ── 15. Backup / export file with traversal in filename ───────────────────
    (
        "Backup or data-export endpoint that names the output file using a "
        "user-supplied identifier without stripping path separators",
        [],
        [],
    ),

    # ── 16. Include / require with user path (PHP / Node.js) ─────────────────
    (
        "Dynamic file include/require using a user-supplied module or view name "
        "without restricting to an allowed directory — enables LFI (Local File "
        "Inclusion) leading to arbitrary code execution or data disclosure",
        [],
        [],
    ),
]


# ══════════════════════════════════════════════════════════════════════════════
#  GLOBAL MITIGATION SIGNALS
#  Any ONE of these in safe_code → mitigation confirmed.
#  Replaces per-subtype expected lists (too language-specific).
#  Covers: Python, Java, Go, Node.js, PHP, C#, Ruby, Kotlin + frameworks.
# ══════════════════════════════════════════════════════════════════════════════
MITIGATION_SIGNALS = [
    # ── Python ────────────────────────────────────────────────────────────────
    "realpath", "abspath", "safe_join", "send_from_directory",
    "secure_filename", "normpath", "commonpath",
    # ── Python / JS / generic method calls ───────────────────────────────────
    "resolve(", "basename(", "basename ",
    # ── Generic keywords (any language) ──────────────────────────────────────
    "allowlist", "whitelist", "ALLOWED_", "allowed_",
    "sanitize", "sanitise", "sanitized",
    # ── startswith / startsWith (Python / Java / Kotlin / JS) ────────────────
    "startswith(base", "startswith(upload", "startswith(log",
    "startswith(config", "startswith(template", "startswith(dest",
    "startswith(target", "startswith(extract", "startswith(root",
    "startsWith(base", "startsWith(upload", "startsWith(log",
    "startsWith(config", "startsWith(template", "startsWith(dest",
    "startsWith(target", "startsWith(extract", "startsWith(root",
    # ── Java ──────────────────────────────────────────────────────────────────
    "getCanonicalPath", "toRealPath", "normalize()", ".normalize()",
    "isSymbolicLink", "NOFOLLOW_LINKS", "LinkOption",
    "startsWith(allowed", "startsWith(base",
    # ── Go ────────────────────────────────────────────────────────────────────
    "filepath.Abs(", "filepath.Clean(", "filepath.EvalSymlinks(",
    "strings.HasPrefix(", "path.Clean(",
    # ── C# / .NET ─────────────────────────────────────────────────────────────
    "Path.GetFullPath(", "Path.GetFileName(", "GetFullPath(",
    "StartsWith(basePath", "StartsWith(base",
    "Regex.IsMatch(", "Path.GetExtension(",
    # ── Node.js / JS ──────────────────────────────────────────────────────────
    "path.resolve(", "path.basename(", "path.normalize(",
    ".startsWith(uploadDir", ".startsWith(baseDir", ".startsWith(rootDir",
    ".startsWith(logDir", ".startsWith(configDir", ".startsWith(templatesDir",
    # ── PHP ───────────────────────────────────────────────────────────────────
    "realpath(", "basename(", "pathinfo(",
    "strpos($", "str_starts_with(", "preg_match(",
    "in_array(", "array_key_exists(",
    # ── Ruby ──────────────────────────────────────────────────────────────────
    "File.realpath(", "File.basename(", "Pathname.new(",
    ".start_with?(", ".include?(allowed", "expand_path(",
    # ── Kotlin ────────────────────────────────────────────────────────────────
    "canonicalPath", "absolutePath", ".startsWith(base",
    # ── Archive-specific ──────────────────────────────────────────────────────
    "safe_extract", "canonical", "zipEntry", "targetDir",
    # ── URL-decoding + re-canonicalize ────────────────────────────────────────
    "unquote", "URLDecoder", "Uri.UnescapeDataString", "url.QueryUnescape",
    "decodeURIComponent",
    # ── Regex filename validation ─────────────────────────────────────────────
    "re.fullmatch", "re.match(r", "re.search(r", "fullmatch(",
    "Pattern.compile", "Regex(",
]


# ══════════════════════════════════════════════════════════════════════════════
#  LANGUAGES & FRAMEWORKS  — 24 combinations
# ══════════════════════════════════════════════════════════════════════════════
LANG_FRAMEWORKS = [
    # Python ecosystem
    ("Python", "Flask"),
    ("Python", "Django"),
    ("Python", "FastAPI"),
    ("Python", "aiohttp"),
    ("Python", "plain Python"),
    # Java ecosystem
    ("Java", "Spring Boot"),
    ("Java", "Jakarta EE / Servlet"),
    ("Java", "Quarkus"),
    ("Java", "plain Java"),
    # Node.js ecosystem
    ("NodeJS", "Express"),
    ("NodeJS", "Fastify"),
    ("NodeJS", "NestJS"),
    ("NodeJS", "plain Node.js"),
    # PHP ecosystem
    ("PHP", "Laravel"),
    ("PHP", "Symfony"),
    ("PHP", "plain PHP"),
    # Go ecosystem
    ("Go", "Gin"),
    ("Go", "Echo"),
    ("Go", "plain Go net/http"),
    # C# / .NET
    ("CSharp", "ASP.NET Core"),
    ("CSharp", "plain C#"),
    # Ruby
    ("Ruby", "Rails"),
    ("Ruby", "Sinatra"),
    # Kotlin
    ("Kotlin", "Ktor"),
    ("Kotlin", "Spring Boot (Kotlin)"),
]


# ══════════════════════════════════════════════════════════════════════════════
#  BUSINESS CONTEXTS  — 20 realistic scenarios
# ══════════════════════════════════════════════════════════════════════════════
CONTEXTS = [
    "invoice PDF download for billing portal",
    "user avatar / profile picture serving",
    "log file viewer in admin dashboard",
    "customer report export (CSV / Excel)",
    "firmware / software update file serving",
    "e-learning course material download",
    "medical imaging file retrieval (DICOM)",
    "source-code snippet file viewer in CI/CD",
    "configuration profile loader for SaaS tenant",
    "ZIP archive extraction for data import",
    "email template rendering for marketing system",
    "static asset serving (CSS, JS, images) in CDN edge",
    "legal document download in contract management system",
    "backup archive download in cloud storage panel",
    "debug log export in developer tools portal",
    "product image serving in e-commerce storefront",
    "audio / video file serving in media streaming app",
    "plugin / extension file loader in CMS",
    "data science notebook file loader in Jupyter-like platform",
    "compliance audit log download in fintech dashboard",
]


# ══════════════════════════════════════════════════════════════════════════════
#  HELPERS
# ══════════════════════════════════════════════════════════════════════════════
client = OpenAI(api_key=CEREBRAS_KEY, base_url="https://api.cerebras.ai/v1")


def call_api(user_msg: str) -> str | None:
    for attempt in range(4):
        try:
            resp = client.chat.completions.create(
                model=CEREBRAS_MODEL,
                max_tokens=650,
                temperature=0.82,       # slightly higher → more lexical variety
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user",   "content": user_msg},
                ],
            )
            return resp.choices[0].message.content
        except Exception as exc:
            msg = str(exc)
            if "429" in msg or "quota" in msg.lower():
                print("  [LIMIT] Daily quota — sleeping 60s …")
                time.sleep(60)
            else:
                if attempt == 3:
                    print(f"  [ERR] {msg[:90]}")
                time.sleep(2 * (attempt + 1))
    return None


def parse_blocks(text: str) -> tuple[str | None, str | None]:
    """Extract VULN / SAFE blocks; strip markdown fences."""
    text = re.sub(r'\*\*(VULN|SAFE):\*\*', r'\1:', text, flags=re.IGNORECASE)
    text = re.sub(r'```[a-zA-Z]*\n?', '', text)
    text = re.sub(r'```', '', text)
    vm = re.search(r'VULN:\s*\n(.*?)(?=\nSAFE:)', text, re.DOTALL | re.IGNORECASE)
    sm = re.search(r'SAFE:\s*\n(.+)$',             text, re.DOTALL | re.IGNORECASE)
    if not vm or not sm:
        return None, None
    return vm.group(1).strip(), sm.group(1).strip()


def strip_comments(code: str) -> str:
    code = re.sub(r'#.*',          '',  code)
    code = re.sub(r'//.*',         '',  code)
    code = re.sub(r'/\*.*?\*/',    '',  code, flags=re.DOTALL)
    code = re.sub(r'""".*?"""',    '',  code, flags=re.DOTALL)
    code = re.sub(r"'''.*?'''",    '',  code, flags=re.DOTALL)
    return code


def wp_tokens(text: str) -> int:
    """
    Word-piece token estimator calibrated to RobertaTokenizer (CodeBERT).

    Empirical derivation from our own datasets (Deser + Crypto):
      Deser  median: 1496 chars -> 370 real WP-tokens  (4.04 chars/token)
      Crypto median:  922 chars -> 238 real WP-tokens  (3.87 chars/token)
      Average ratio : 3.9 chars per WP-token

    We use div 3.5 (slightly under 3.9) to stay conservative / err safe.
    Replaces the broken div6 estimator that underestimated by 5-8x.
    """
    return max(1, int(len(text) / 3.5))


def smart_truncate(code: str, budget: int) -> str:
    """Trim code line-by-line to fit within budget WP-tokens."""
    lines, kept, total = code.split('\n'), [], 0
    for line in lines:
        cost = wp_tokens(line)
        if total + cost > budget:
            break
        kept.append(line)
        total += cost
    # Close braces for C-family languages
    result = '\n'.join(kept)
    if len(kept) < len(lines):
        opens = result.count('{') - result.count('}')
        if opens > 0:
            result += '\n' + '}\n' * opens
    return result


def tokenize(code: str) -> list[str]:
    return re.findall(r'[a-zA-Z_]\w*|[0-9]+', code)


def jaccard(a: list, b: list) -> float:
    sa, sb = set(a), set(b)
    if not sa and not sb:
        return 1.0
    return len(sa & sb) / (len(sa) + len(sb) - len(sa & sb))


FUNCTION_KEYWORDS = [
    # Python / Ruby / Go / Kotlin / Rust
    "def ", "func ", "fn ",
    # Java / C# / Kotlin / Go explicit keywords
    "public ", "private ", "protected ", "internal ", "override ",
    "static ", "void ", "async ",
    # JS / TS
    "function ", "async function", "const ", "let ", "var ",
    "module.exports", "exports.",
    # PHP
    "function ", "<?php",
    # Ruby
    "def ", "do |",
    # Kotlin / Scala
    "fun ", "object ",
    # Generic OOP
    "class ", "interface ", "sub ",
    # Framework route handlers (Go, Node, Ruby, Java)
    "Route(", "router.", "app.get(", "app.post(", "app.put(",
    "http.HandleFunc(", "http.Handle(",
    "Route::", "@app.route", "@router.",
]

def has_function(code: str) -> bool:
    return any(kw in code for kw in FUNCTION_KEYWORDS)


# ── Validation gate ────────────────────────────────────────────────────────────
def validate(vuln: str, safe: str, subtype_tuple: tuple) -> tuple[bool, str]:
    desc, expected, forbidden = subtype_tuple

    if not vuln or not safe:
        return False, "empty block"
    if not has_function(vuln):
        return False, "vuln: no function"
    if not has_function(safe):
        return False, "safe: no function"

    # ── Length / char guards ──────────────────────────────────────────────────
    vc, sc = len(vuln), len(safe)
    if vc < 70:              return False, f"vuln too short ({vc} chars)"
    if vc > 1200:            return False, f"vuln too long ({vc} chars)"
    if sc < 90:              return False, f"safe too short ({sc} chars)"
    if sc > 1300:            return False, f"safe too long ({sc} chars)"
    if vc + sc > MAX_CHARS:  return False, f"combined too long ({vc+sc} chars)"

    # ── CodeBERT WP-token guard ───────────────────────────────────────────────
    vwp = wp_tokens(vuln)
    swp = wp_tokens(safe)
    total_wp = vwp + swp + 3           # +3 for [CLS],[SEP],[SEP]
    if total_wp > WP_BUDGET + 3:
        return False, f"WP-token overflow ({total_wp} > 512)"

    # ── Identifier count ──────────────────────────────────────────────────────
    vt, st = tokenize(vuln), tokenize(safe)
    if len(vt) < 8:   return False, f"vuln too few identifiers ({len(vt)})"
    if len(st) < 8:   return False, f"safe too few identifiers ({len(st)})"

    # ── Jaccard pair-quality gate ─────────────────────────────────────────────
    sim = jaccard(vt, st)
    if sim < 0.12:    return False, f"pair too dissimilar ({sim:.2f})"
    if sim >= 0.97:   return False, f"pair too similar / zero-change ({sim:.2f})"

    # ── Zero-change detection (line-level) ───────────────────────────────────
    vlines = {l.strip() for l in vuln.split('\n') if l.strip()}
    slines = {l.strip() for l in safe.split('\n') if l.strip()}
    if vlines == slines:
        return False, "zero-change: vuln and safe are line-identical"

    # ── Security-signal checks ────────────────────────────────────────────────
    safe_nc = strip_comments(safe)

    # Forbidden patterns must NOT appear in safe_code
    for pat in (forbidden or []):
        if pat in safe_nc:
            return False, f"forbidden pattern still in safe: '{pat}'"

    # Per-subtype expected list (non-empty = subtype-specific override)
    if expected:
        if not any(sig in safe for sig in expected):
            return False, f"no mitigation signal found (expected one of {expected[:4]})"
    else:
        # Global mitigation check — any ONE signal from the master list is enough
        if not any(sig in safe for sig in MITIGATION_SIGNALS):
            return False, "safe code lacks any recognised path-traversal mitigation"

    # ── Path traversal vulnerability must appear in vuln ─────────────────────
    vuln_indicators = [
        # ── Attack patterns (always strong signal) ────────────────────────────
        "../", "..\\", "%2e%2e", "%252e", "\\x00", "%00",
        # ── Python ────────────────────────────────────────────────────────────
        "os.path.join", "open(", "send_file", "render_template",
        "send_from_directory", "safe_join",
        # ── Node.js / JavaScript ──────────────────────────────────────────────
        "readFile", "createReadStream", "fs.readFileSync", "fs.readFile(",
        "fs.createWriteStream", "fs.writeFile(", "path.join(",
        "res.sendFile", "path.resolve(", "fs.open(",
        # ── PHP ───────────────────────────────────────────────────────────────
        "file_get_contents", "fopen(", "include(", "include_once(",
        "require_once(", "readfile(", "file(",
        # ── Java ──────────────────────────────────────────────────────────────
        "new File(", "FileInputStream", "new FileReader(",
        "Files.readAllBytes", "Files.newInputStream", "Paths.get(",
        "Path.of(", "getResourceAsStream", "new FileOutputStream(",
        "Files.readString(", "Files.copy(",
        # ── C# / .NET ─────────────────────────────────────────────────────────
        "File.ReadAllBytes", "File.OpenRead", "File.ReadAllText(",
        "Path.Combine(", "new FileStream(", "File.Open(",
        "System.IO.File", "File.ReadAllLines(",
        # ── Go ────────────────────────────────────────────────────────────────
        "os.Open(", "os.ReadFile(", "ioutil.ReadFile(", "filepath.Join(",
        "http.ServeFile(", "os.Stat(", "io.ReadAll(", "os.Create(",
        # ── Ruby ──────────────────────────────────────────────────────────────
        "File.read(", "File.open(", "File.binread(", "send_file",
        "render file:", "IO.read(",
        # ── Kotlin ────────────────────────────────────────────────────────────
        "File(", "readBytes(", "inputStream(", "readText(",
        # ── Archive ops ───────────────────────────────────────────────────────
        "extractall", "zipfile.ZipFile", "tarfile.open", "ZipInputStream(",
        "ZipFile.ExtractToDirectory", "archive/zip",
        # ── Generic identifiers ───────────────────────────────────────────────
        "serve_file", "download_file", "getFile", "loadFile",
        "readConfig", "loadTemplate", "serveContent",
    ]
    if not any(ind in vuln for ind in vuln_indicators):
        return False, "vuln code does not appear to involve file path operations"

    return True, ""


# ── Near-duplicate detection (4-gram fingerprint) ─────────────────────────────
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


# ── Checkpoint I/O ────────────────────────────────────────────────────────────
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
#  PROMPT BUILDER
#  Constructs a concise, varied user message per request.
# ══════════════════════════════════════════════════════════════════════════════
# Subtypes that are only meaningful for specific languages
# (null-byte only affects PHP / C-based runtimes)
SUBTYPE_LANG_WHITELIST: dict[str, list[str]] = {
    "Null-byte injection (PHP)": ["PHP"],
}


def build_user_msg(subtype_desc: str, lang: str, fw: str, ctx: str) -> str:
    return (
        f"Language: {lang}\n"
        f"Framework: {fw}\n"
        f"Vulnerability subtype: {subtype_desc}\n"
        f"Business context: {ctx}\n\n"
        "Requirements:\n"
        "- VULN: 7–16 lines, ~180–380 chars. ONE path traversal weakness.\n"
        "- VULN must include a REAL file operation: open(), readFile(), fopen(),\n"
        "  File.open(), os.Open(), Files.readAllBytes(), fs.readFileSync(),\n"
        "  file_get_contents(), Path.Combine(), filepath.Join(), or equivalent.\n"
        "  User input MUST flow into the file path without sanitization.\n"
        "- SAFE: 9–20 lines, ~220–450 chars. Fix ONLY the traversal flaw.\n"
        "- Combined VULN + SAFE must be UNDER 1900 CHARACTERS.\n"
        "- Use realistic identifiers matching the business context.\n"
        "- Same function name and parameters in both blocks.\n"
        "- Include minimal necessary imports only.\n"
        "- Safe mitigation must be genuinely effective (not just a blacklist)."
    )


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════════════
def main() -> None:
    samples = load_checkpoint()
    kept    = len(samples)

    # Restore fingerprints from checkpoint
    fingerprints: list[frozenset] = [ngrams(s["vuln_code"]) for s in samples]

    # Per-axis counters for even distribution
    subtype_counts  = defaultdict(int)
    lang_counts     = defaultdict(int)
    context_counts  = defaultdict(int)
    for s in samples:
        subtype_counts[s.get("_subtype", "")]  += 1
        lang_counts[s.get("_lang", "")]        += 1
        context_counts[s.get("_context", "")]  += 1

    skipped = errors = 0

    # Build all combos and shuffle
    combos = [
        (sub, lang, fw, ctx)
        for sub in SUBTYPES
        for (lang, fw) in LANG_FRAMEWORKS
        for ctx in CONTEXTS
    ]
    random.shuffle(combos)
    total_combos = len(combos)
    combo_idx    = kept % total_combos

    print(f"╔══════════════════════════════════════╗")
    print(f"║  Path Traversal Dataset Generator    ║")
    print(f"╚══════════════════════════════════════╝")
    print(f"  Loaded from checkpoint : {kept}")
    print(f"  Target                 : {TARGET}")
    print(f"  Total combos           : {total_combos:,}")
    print(f"  Subtypes               : {len(SUBTYPES)}")
    print(f"  Lang/Framework combos  : {len(LANG_FRAMEWORKS)}")
    print(f"  Business contexts      : {len(CONTEXTS)}")
    print()

    while kept < TARGET:
        # ── Pick next combo ────────────────────────────────────────────────────
        subtype_tuple, lang, fw, ctx = combos[combo_idx % total_combos]
        combo_idx += 1
        subtype_desc = subtype_tuple[0]

        # ── Lang whitelist: skip incompatible lang/subtype combos ─────────────
        for wl_key, allowed_langs in SUBTYPE_LANG_WHITELIST.items():
            if wl_key in subtype_desc and lang not in allowed_langs:
                # silently skip — not a real generation attempt
                continue

        # ── Prefer under-represented axes (soft balancing) ────────────────────
        # Skip if this subtype is already 40% ahead of the average
        avg_sub = kept / max(len(SUBTYPES), 1)
        if subtype_counts[subtype_desc] > avg_sub * 1.4 and kept > 50:
            skipped += 1
            continue

        # ── Call API ──────────────────────────────────────────────────────────
        user_msg = build_user_msg(subtype_desc, lang, fw, ctx)
        raw = call_api(user_msg)
        if not raw:
            errors  += 1
            skipped += 1
            continue

        # ── Parse blocks ──────────────────────────────────────────────────────
        vuln, safe = parse_blocks(raw)
        if not vuln or not safe:
            skipped += 1
            continue

        # ── Smart truncate if oversized ───────────────────────────────────────
        total_wp = wp_tokens(vuln) + wp_tokens(safe) + 3
        if total_wp > WP_BUDGET + 3:
            vwp = wp_tokens(vuln)
            swp = wp_tokens(safe)
            v_budget  = max(60, int(WP_BUDGET * vwp / max(vwp + swp, 1)))
            sf_budget = WP_BUDGET - v_budget
            if vwp > v_budget:
                vuln = smart_truncate(vuln, v_budget)
            if swp > sf_budget:
                safe = smart_truncate(safe, sf_budget)

        # ── Validate ──────────────────────────────────────────────────────────
        ok, reason = validate(vuln, safe, subtype_tuple)
        if not ok:
            print(f"  [SKIP] {reason}")
            skipped += 1
            continue

        # ── Near-duplicate guard ──────────────────────────────────────────────
        fp = ngrams(vuln)
        if is_near_dup(fp, fingerprints):
            print(f"  [DUP]  near-duplicate rejected")
            skipped += 1
            continue

        # ── Accept sample ─────────────────────────────────────────────────────
        fingerprints.append(fp)
        subtype_counts[subtype_desc] += 1
        lang_counts[lang]            += 1
        context_counts[ctx]          += 1

        samples.append({
            "vuln_code":       vuln,
            "safe_code":       safe,
            "state":           "Path_Traversal",
            "safe_code_label": "safe",
            # internal tracking fields (stripped before final save)
            "_subtype":        subtype_desc[:60],
            "_lang":           lang,
            "_framework":      fw,
            "_context":        ctx,
        })
        kept += 1

        # ── Checkpoint every 10 ──────────────────────────────────────────────
        if kept % 10 == 0:
            save_checkpoint(samples)
            total_done   = kept + skipped
            skip_pct     = skipped * 100 // total_done if total_done else 0
            avg_wp       = sum(
                wp_tokens(s["vuln_code"]) + wp_tokens(s["safe_code"]) + 3
                for s in samples[-10:]
            ) // 10
            print(
                f"  [{kept:>4}/{TARGET}]  {kept*100//TARGET:>3}%  "
                f"skip={skipped} ({skip_pct}%)  err={errors}  "
                f"avg_wp={avg_wp}"
            )

        time.sleep(0.15)

    # ── Final save (strip internal fields) ───────────────────────────────────
    save_checkpoint(samples)

    final = [
        {k: v for k, v in s.items() if not k.startswith("_")}
        for s in samples
    ]
    Path(OUTPUT_FILE).parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for s in final:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")

    # ── Final stats ───────────────────────────────────────────────────────────
    print()
    print(f"╔══════════════════════════════════════╗")
    print(f"║  DONE — {kept} samples saved          ║")
    print(f"╚══════════════════════════════════════╝")
    print(f"  Output file : {OUTPUT_FILE}")
    print(f"  Skip total  : {skipped}")
    print(f"  Errors      : {errors}")
    print()
    print("  Subtype distribution:")
    for k, v in sorted(subtype_counts.items(), key=lambda x: -x[1])[:8]:
        print(f"    {v:>4}  {k[:65]}")
    print()
    print("  Language distribution:")
    for k, v in sorted(lang_counts.items(), key=lambda x: -x[1]):
        print(f"    {v:>4}  {k}")


if __name__ == "__main__":
    main()
