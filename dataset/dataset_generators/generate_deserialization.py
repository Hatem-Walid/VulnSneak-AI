"""
╔══════════════════════════════════════════════════════════════════════════════╗
║       Insecure Deserialization — Top-Up Generator v1                       ║
║       Target : 600 NEW samples (no overlap with existing 1,629)            ║
║       Model  : Qwen3-235B via Cerebras API (4 keys — parallel)             ║
║                                                                            ║
║  KEY CONSTRAINT: Existing dataset had 30% WP overflow (safe_code too long) ║
║  → New samples MUST fit in 512 WP tokens: combined chars < 1400            ║
║  → Vuln: 150–350 chars | Safe: 200–450 chars                               ║
║                                                                            ║
║  Covers 8 subtypes (same as original Deser dataset):                       ║
║    PHP unserialize, Python pickle, Java ObjectStream,                      ║
║    Node.js serialize, Go gob.Decode, C# BinaryFormatter,                   ║
║    Ruby Marshal.load, YAML.load unsafe                                     ║
║                                                                            ║
║  Anti-problem checklist:                                                   ║
║    ✅ Near-Duplicate  → checked against EXISTING 1629 + new samples        ║
║    ✅ Diversity       → 3-axis combo (subtype × lang/fw × context)         ║
║    ✅ Pair Quality    → 3-tier mitigation check                             ║
║    ✅ Consistency     → state="Insecure Deserialization", label="Safe"      ║
║    ✅ Token Length    → STRICT: WP combined ≤ 440 (safe margin below 512)   ║
║    ✅ Context Diversity → 20 business contexts                              ║
║    ✅ Parallel speed  → 4 API keys, ThreadPoolExecutor                      ║
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
TARGET         = 600
EXISTING_FILE  = r"Insecure_Deserialization_final_clean.jsonl"
OUTPUT_FILE    = r"deser_topup_v2_output.jsonl"
CHECKPOINT     = r"deser_topup_v2_checkpoint.jsonl"

# STRICT token budget — existing file had overflow at 512 because samples
# were too large. New samples must stay well below 512.
WP_BUDGET   = 440   # ← 440 not 509: safe margin to guarantee no overflow
MAX_CHARS   = 1400  # combined chars ceiling
BATCH_SIZE  = 4


# ══════════════════════════════════════════════════════════════════════════════
#  SYSTEM PROMPT  — strict size enforcement
# ══════════════════════════════════════════════════════════════════════════════
SYSTEM_PROMPT = """\
You are a security training-data engine that generates EXACTLY TWO code blocks \
for fine-tuning CodeBERT on Insecure Deserialization vulnerability detection.

OUTPUT FORMAT — strictly this, nothing else:

VULN:
<vulnerable code>

SAFE:
<fixed code>

════════════════════════════════════════════
SIZE RULES  (CRITICAL — STRICT LIMITS)
════════════════════════════════════════════
• VULN: 5–11 lines (including imports). Aim for ~150–320 characters.
• SAFE: 7–14 lines. Aim for ~200–420 characters.
• COMBINED (VULN + SAFE) must be UNDER 1300 CHARACTERS TOTAL.
• These limits are HARD. Shorten business logic aggressively if needed.
• No docstrings. No multi-line comments. No blank lines inside function body.
• ONE import block + ONE function definition per section.

════════════════════════════════════════════
FORMAT RULES
════════════════════════════════════════════
• No markdown fences, no backticks, no asterisks.
• No explanation text before or after the code blocks.
• Same function name and same parameters in VULN and SAFE.

════════════════════════════════════════════
VULNERABILITY RULES
════════════════════════════════════════════
• VULN must contain EXACTLY ONE Insecure Deserialization weakness.
• VULN must deserialize untrusted user/network/file input using the
  unsafe API specified — not abstract placeholder code.
• SAFE must fix ONLY the deserialization flaw. Same logic otherwise.
• The fix must be a REAL mitigation — not just a try/except wrapper.

════════════════════════════════════════════
QUALITY RULES
════════════════════════════════════════════
• Use realistic function names and variable names.
• SAFE must use one of these proven mitigations:
    - Replace with safe format: json.loads, json_decode, JSON.parse,
      json.Unmarshal, JsonSerializer, JSON.parse — no code execution
    - Allowlist / signature check before deserializing (HMAC verify)
    - Disable resolve_types / use safe deserializer options
    - Class whitelist filter (ObjectInputFilter, allowClasses)
    - yaml.safe_load instead of yaml.load
"""


# ══════════════════════════════════════════════════════════════════════════════
#  SUBTYPES — 8 patterns (same as original Deser dataset)
# ══════════════════════════════════════════════════════════════════════════════
SUBTYPES = [

    # ── 1. PHP unserialize ────────────────────────────────────────────────────
    (
        "PHP unserialize() called on user-controlled input (GET/POST/cookie/"
        "session) without validation — attacker sends crafted object with "
        "__wakeup/__destruct to execute arbitrary code (PHP Object Injection)",
        [],   # safe code may reference unserialize in comments or validation context
    ),

    # ── 2. Python pickle.loads ────────────────────────────────────────────────
    (
        "Python pickle.loads() or cPickle.loads() called on untrusted data "
        "(network socket, user upload, Redis cache) — attacker sends a crafted "
        "pickle that executes os.system() via __reduce__",
        [],   # safe code may import pickle even if not calling loads
    ),

    # ── 3. Java ObjectInputStream ─────────────────────────────────────────────
    (
        "Java ObjectInputStream.readObject() called on untrusted data (HTTP body, "
        "message queue, file) without class filtering — attacker exploits gadget "
        "chains (CommonsCollections, Spring, etc.) to achieve RCE",
        [],   # ObjectInputFilter safe code still uses readObject() — allowed
    ),

    # ── 4. Node.js node-serialize / serialize ─────────────────────────────────
    (
        "Node.js node-serialize or serialize library unserialize() called on "
        "untrusted JSON-like input — attacker injects IIFE (Immediately Invoked "
        "Function Expression) pattern '_$$ND_FUNC$$_' to execute arbitrary JS",
        [],   # safe code replaces with JSON.parse, no forbidden needed
    ),

    # ── 5. Go gob.Decode ──────────────────────────────────────────────────────
    (
        "Go gob.Decode() called on untrusted network data or file content without "
        "size limits or type validation — attacker sends crafted gob data that "
        "triggers unexpected type population or memory exhaustion",
        [],   # safe code adds size limit, may still use gob in limited way
    ),

    # ── 6. C# BinaryFormatter ─────────────────────────────────────────────────
    (
        "C# BinaryFormatter.Deserialize() or NetDataContractSerializer called on "
        "untrusted stream — Microsoft marked BinaryFormatter obsolete/dangerous; "
        "attacker uses gadget chains to achieve RCE via type confusion",
        [],   # safe replaces with JsonSerializer — no forbidden needed
    ),

    # ── 7. Ruby Marshal.load ──────────────────────────────────────────────────
    (
        "Ruby Marshal.load() called on untrusted data (cookie, network, file) — "
        "attacker sends crafted Marshal payload that instantiates arbitrary Ruby "
        "objects and triggers __send__/instance_eval for code execution",
        [],   # safe replaces with JSON.parse
    ),

    # ── 8. YAML.load unsafe ───────────────────────────────────────────────────
    (
        "YAML.load() or yaml.load() called without Loader=yaml.SafeLoader — "
        "in Python PyYAML and Ruby Psych, the full Loader allows instantiation "
        "of arbitrary objects; attacker uses !!python/object/apply: or "
        "!!ruby/object: to execute system commands",
        # Only forbid the specific unsafe call pattern in safe code
        ["yaml.load(data,", "yaml.load(content,", "yaml.load(payload,",
         "YAML.load(data", "yaml.load(f.read()"],
    ),
]


# ══════════════════════════════════════════════════════════════════════════════
#  LANGUAGES & FRAMEWORKS — matched to each subtype
# ══════════════════════════════════════════════════════════════════════════════
SUBTYPE_LANGS = {
    "PHP unserialize":        [("PHP","Laravel"),("PHP","Symfony"),("PHP","plain PHP")],
    "Python pickle":          [("Python","Flask"),("Python","Django"),("Python","FastAPI"),("Python","plain Python")],
    "Java ObjectInputStream": [("Java","Spring Boot"),("Java","Jakarta EE"),("Java","plain Java")],
    "Node.js node-serialize": [("NodeJS","Express"),("NodeJS","plain Node.js"),("NodeJS","NestJS")],
    "Go gob.Decode":          [("Go","plain Go"),("Go","Gin"),("Go","Echo")],
    "C# BinaryFormatter":     [("CSharp","ASP.NET Core"),("CSharp","plain C#")],
    "Ruby Marshal":           [("Ruby","Rails"),("Ruby","Sinatra")],
    "YAML.load unsafe":       [("Python","Flask"),("Python","Django"),("Python","plain Python"),("Ruby","Rails"),("Ruby","Sinatra")],
}

# Short key → subtype tuple mapping
SUBTYPE_KEYS = {
    "PHP unserialize":        SUBTYPES[0],
    "Python pickle":          SUBTYPES[1],
    "Java ObjectInputStream": SUBTYPES[2],
    "Node.js node-serialize": SUBTYPES[3],
    "Go gob.Decode":          SUBTYPES[4],
    "C# BinaryFormatter":     SUBTYPES[5],
    "Ruby Marshal":           SUBTYPES[6],
    "YAML.load unsafe":       SUBTYPES[7],
}


# ══════════════════════════════════════════════════════════════════════════════
#  BUSINESS CONTEXTS — 20 realistic scenarios
# ══════════════════════════════════════════════════════════════════════════════
CONTEXTS = [
    "user session restoration in web application",
    "inter-service message queue consumer",
    "file import / export in data management system",
    "cached object retrieval from Redis / Memcached",
    "API payload deserialization in microservice",
    "configuration file loader in SaaS platform",
    "shopping cart persistence in e-commerce store",
    "job queue task executor in background worker",
    "webhook payload processor in integration platform",
    "remote procedure call (RPC) handler",
    "distributed cache object store in cluster",
    "plugin / extension data loader in CMS",
    "machine learning model parameter loader",
    "audit log entry reconstructor in analytics tool",
    "game state loader in multiplayer game server",
    "IoT device configuration sync in device manager",
    "user preference object loader in personalization engine",
    "report template deserializer in BI dashboard",
    "authentication token decoder in SSO service",
    "event sourcing snapshot restorer in event-driven system",
]


# ══════════════════════════════════════════════════════════════════════════════
#  MITIGATION SIGNALS
# ══════════════════════════════════════════════════════════════════════════════
MITIGATION_SIGNALS = [
    # Replace with safe format
    "json.loads(", "json_decode(", "JSON.parse(", "json.Unmarshal(",
    "JsonSerializer.Deserialize", "System.Text.Json",
    "json.safe_load(", "JSON.parse(",
    # PHP safe alternatives
    "json_decode(", "base64_decode(", "hash_equals(",
    # Python safe
    "yaml.safe_load(", "json.loads(", "hmac.compare_digest(",
    "hashlib.sha", "secrets.compare_digest(",
    # Java safe
    "ObjectInputFilter", "createFilter(", "allowClasses(",
    "JsonMapper", "ObjectMapper", "XmlMapper",
    "readValue(", "readTree(",
    # C# safe
    "JsonSerializer", "Newtonsoft.Json", "JsonConvert",
    "System.Text.Json", "DataContractJsonSerializer",
    "XmlSerializer", "protobuf",
    # Go safe
    "json.Unmarshal(", "json.NewDecoder(", "encoding/json",
    "proto.Unmarshal(", "xml.Unmarshal(",
    # Ruby safe
    "JSON.parse(", "json.parse(", "Psych.safe_load(",
    "YAML.safe_load(", "yaml.safe_load(",
    # Node.js safe
    "JSON.parse(", "safeDeserialize(", "validateSchema(",
    # HMAC/signature verify
    "hmac", "HMAC", "verify(", "signature", "digest(",
    "compare_digest", "hash_equals",
    # Generic
    "allowlist", "whitelist", "ALLOWED_", "validate(",
    "raise", "throw", "reject(", "abort(",
    "return null", "return nil", "return false", "return False",
    "400", "403", "HttpStatus.BAD_REQUEST",
]

BROAD_SECURITY = [
    "safe", "Safe", "SAFE", "secure", "Secure",
    "validate", "Validate", "verify", "Verify",
    "allowlist", "whitelist", "ALLOWED", "allowed",
    "json", "JSON", "protobuf", "proto",
    "hmac", "HMAC", "signature", "digest",
    "raise", "throw", "reject", "abort",
    "return null", "return nil", "return false",
    "400", "403", "filter", "Filter",
]

VULN_INDICATORS = [
    # PHP
    "unserialize(", "$_GET[", "$_POST[", "$_COOKIE[", "$_REQUEST[",
    # Python
    "pickle.loads(", "pickle.load(", "cPickle.loads(",
    "yaml.load(", "yaml.load(data", "yaml.load(content",
    # Java
    "ObjectInputStream", "readObject()", "new ObjectInputStream(",
    # Node.js
    "unserialize(", "node-serialize", "require('serialize'",
    "require(\"serialize\"",
    # Go
    "gob.Decode(", "gob.NewDecoder(", "gob.Register(",
    # C#
    "BinaryFormatter", "NetDataContractSerializer",
    ".Deserialize(", "LosFormatter", "SoapFormatter",
    # Ruby
    "Marshal.load(", "Marshal.restore(",
    # YAML
    "yaml.load(", "YAML.load(", "Psych.load(",
    # Generic deserialization terms
    "deserialize", "Deserialize", "unserialize", "unmarshal",
    "decode(", "Decode(", "fromBytes(", "from_bytes(",
    "readObject", "loadObject", "fromString(",
]


# ══════════════════════════════════════════════════════════════════════════════
#  API CLIENT POOL
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
                max_tokens=550,
                temperature=0.80,
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


FUNCTION_KEYWORDS = [
    "def ", "func ", "fn ", "function ", "async function",
    "public ", "private ", "protected ", "static ", "void ", "async ",
    "const ", "let ", "var ", "fun ", "<?php",
    "class ", "interface ", "router.", "app.get(",
    " do\n", " do |",
]

def has_function(code: str) -> bool:
    return any(kw in code for kw in FUNCTION_KEYWORDS)


def smart_truncate(code: str, budget: int) -> str:
    lines, kept, total = code.split('\n'), [], 0
    for line in lines:
        cost = wp_tokens(line)
        if total + cost > budget:
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
#  VALIDATION
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
    if vc < 80:             return False, f"vuln too short ({vc})"
    if vc > 800:            return False, f"vuln too long ({vc})"
    if sc < 100:            return False, f"safe too short ({sc})"
    if sc > 900:            return False, f"safe too long ({sc})"
    if vc + sc > MAX_CHARS: return False, f"combined too long ({vc+sc})"

    vwp = wp_tokens(vuln)
    swp = wp_tokens(safe)
    total_wp = vwp + swp + 3
    if total_wp > WP_BUDGET:
        return False, f"WP overflow ({total_wp} > {WP_BUDGET})"

    vt, st = tokenize(vuln), tokenize(safe)
    if len(vt) < 8:   return False, f"vuln too few identifiers ({len(vt)})"
    if len(st) < 8:   return False, f"safe too few identifiers ({len(st)})"

    sim = jaccard(vt, st)
    if sim < 0.12:    return False, f"pair too dissimilar ({sim:.2f})"
    if sim >= 0.995:  return False, f"pair zero-change ({sim:.2f})"

    vlines = {l.strip() for l in vuln.split('\n') if l.strip()}
    slines = {l.strip() for l in safe.split('\n') if l.strip()}
    if vlines == slines:
        return False, "zero-change"

    # Forbidden in safe
    safe_nc = strip_comments(safe)
    for pat in (forbidden or []):
        if pat in safe_nc:
            return False, f"forbidden still in safe: '{pat}'"

    # Deserialization indicator in vuln
    if not any(ind in vuln for ind in VULN_INDICATORS):
        return False, "vuln lacks deserialization indicator"

    # ── Semantic fix check: unsafe call must differ between vuln and safe ─────
    # Extract the core unsafe API calls from vuln
    UNSAFE_APIS = [
        "pickle.loads(","pickle.load(","cPickle.loads(",
        "yaml.load(","YAML.load(",
        "unserialize(","Marshal.load(",
        "BinaryFormatter","NetDataContractSerializer",
        "gob.NewDecoder(",
        "ObjectInputStream","readObject()",
    ]
    # Find which unsafe APIs appear in vuln
    vuln_apis = [api for api in UNSAFE_APIS if api in vuln]

    # For each vuln API, check if safe_code removes OR guards it
    if vuln_apis:
        # Safe must have mitigation signal OR the unsafe API is gone
        api_gone = all(api not in safe for api in vuln_apis)
        has_mit  = any(sig in safe for sig in MITIGATION_SIGNALS)
        if not api_gone and not has_mit:
            # Check tier2/tier3 as fallback
            t2 = any(pat in safe for pat in BROAD_SECURITY)
            new_lines = [l for l in slines - vlines
                         if len(l) > 8 and not l.startswith(
                             ('#', '//', 'import ', 'from ', 'using ', 'require ', 'package '))]
            t3 = len(new_lines) >= 2
            if not (t2 or t3):
                return False, "unsafe API still present in safe without mitigation"

    # 3-tier mitigation
    tier1 = any(sig in safe for sig in MITIGATION_SIGNALS)
    tier2 = any(pat in safe for pat in BROAD_SECURITY)
    new_lines = [l for l in slines - vlines
                 if len(l) > 8 and not l.startswith(
                     ('#', '//', 'import ', 'from ', 'using ', 'require ', 'package '))]
    tier3 = len(new_lines) >= 1

    if not (tier1 or tier2 or tier3):
        return False, "no deserialization mitigation found"

    return True, ""


# ══════════════════════════════════════════════════════════════════════════════
#  CHECKPOINT
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


def load_existing_fingerprints() -> list[frozenset]:
    """Load fingerprints from the existing 1,629 clean Deser samples."""
    existing_path = Path(EXISTING_FILE)
    if not existing_path.exists():
        print(f"  ⚠️  Existing file not found: {EXISTING_FILE}")
        print(f"  ⚠️  Near-dup check against existing samples DISABLED")
        return []
    fps = []
    for line in existing_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            try:
                s = json.loads(line)
                fps.append(ngrams(s["vuln_code"]))
            except Exception:
                pass
    print(f"  Loaded {len(fps)} fingerprints from existing Deser dataset")
    return fps


# ══════════════════════════════════════════════════════════════════════════════
#  PROMPT BUILDER
# ══════════════════════════════════════════════════════════════════════════════
def build_user_msg(subtype_desc: str, lang: str, fw: str, ctx: str) -> str:
    return (
        f"Language: {lang}\n"
        f"Framework: {fw}\n"
        f"Vulnerability subtype: {subtype_desc}\n"
        f"Business context: {ctx}\n\n"
        "Requirements:\n"
        "- VULN: 5–11 lines, ~150–320 chars. ONE deserialization weakness.\n"
        "- VULN must call the unsafe deserialization API on untrusted input.\n"
        "- SAFE: 7–14 lines, ~200–420 chars. Fix ONLY the deserialization flaw.\n"
        "- CRITICAL: Combined VULN + SAFE must be UNDER 1300 CHARACTERS.\n"
        "- Same function name and parameters in both blocks.\n"
        "- Safe mitigation: replace with JSON/protobuf parsing, use safe_load,\n"
        "  implement HMAC signature verification, or use ObjectInputFilter.\n"
        "- Do NOT just wrap in try/except — that is NOT a fix."
    )


# ══════════════════════════════════════════════════════════════════════════════
#  PROCESS ONE COMBO
# ══════════════════════════════════════════════════════════════════════════════
def process_combo(sub_key: str, lang: str, fw: str, ctx: str) -> dict | None:
    subtype_tuple = SUBTYPE_KEYS[sub_key]
    user_msg = build_user_msg(subtype_tuple[0], lang, fw, ctx)
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
        v_cb  = max(160, int(MAX_CHARS * vc / max(vc + sc, 1)))
        sf_cb = MAX_CHARS - v_cb
        if vc > v_cb:
            vuln = smart_truncate(vuln, max(45, v_cb // 4))
        if sc > sf_cb:
            safe = smart_truncate(safe, max(55, sf_cb // 4))

    # WP overflow truncation
    total_wp = wp_tokens(vuln) + wp_tokens(safe) + 3
    if total_wp > WP_BUDGET:
        vwp = wp_tokens(vuln)
        swp = wp_tokens(safe)
        vb  = max(50, int(WP_BUDGET * vwp / max(vwp + swp, 1)))
        sb  = WP_BUDGET - vb
        if vwp > vb: vuln = smart_truncate(vuln, vb)
        if swp > sb: safe = smart_truncate(safe, sb)

    ok, reason = validate(vuln, safe, subtype_tuple)
    if not ok:
        return {"_skip": reason}

    return {
        "vuln_code":       vuln,
        "state":           "Insecure Deserialization",
        "safe_code":       safe,
        "safe_code_label": "Safe",
        "_sub_key":        sub_key,
        "_lang":           lang,
        "_framework":      fw,
        "_context":        ctx,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════════════
def main() -> None:
    # Load existing fingerprints (to avoid near-dups with existing 1,629)
    existing_fps = load_existing_fingerprints()

    # Load checkpoint
    samples = load_checkpoint()
    kept    = len(samples)

    # Fingerprint pool: existing + newly generated
    fingerprints: list[frozenset] = existing_fps + [ngrams(s["vuln_code"]) for s in samples]
    fp_lock = threading.Lock()

    sub_counts = defaultdict(int)
    lang_counts = defaultdict(int)
    ctx_counts  = defaultdict(int)
    for s in samples:
        sub_counts[s.get("_sub_key", "")]  += 1
        lang_counts[s.get("_lang", "")]    += 1
        ctx_counts[s.get("_context", "")]  += 1

    # Build combos
    combos = [
        (sub_key, lang, fw, ctx)
        for sub_key, lang_list in SUBTYPE_LANGS.items()
        for (lang, fw) in lang_list
        for ctx in CONTEXTS
    ]
    random.shuffle(combos)
    total_combos = len(combos)
    combo_idx    = kept % total_combos
    skipped = errors = 0

    print(f"╔══════════════════════════════════════════════╗")
    print(f"║  Insecure Deserialization Top-Up Generator   ║")
    print(f"╚══════════════════════════════════════════════╝")
    print(f"  Existing fingerprints : {len(existing_fps)}")
    print(f"  Loaded from checkpoint: {kept}")
    print(f"  Target                : {TARGET}")
    print(f"  Total combos          : {total_combos:,}")
    print(f"  Subtypes              : {len(SUBTYPES)}")
    print(f"  API keys (parallel)   : {len(CEREBRAS_KEYS)}")
    print(f"  WP budget (strict)    : {WP_BUDGET} (not 509!)")
    print(f"  Max chars             : {MAX_CHARS}")
    print()

    with ThreadPoolExecutor(max_workers=BATCH_SIZE) as executor:
        while kept < TARGET:

            batch = []
            attempts = 0
            while len(batch) < BATCH_SIZE and kept + len(batch) < TARGET:
                item = combos[combo_idx % total_combos]
                combo_idx += 1
                attempts += 1
                if attempts > total_combos * 2:
                    break

                sub_key, lang, fw, ctx = item

                # Soft balance
                avg_sub = kept / max(len(SUBTYPES), 1)
                if sub_counts[sub_key] > avg_sub * 1.5 and kept > 30:
                    skipped += 1
                    continue

                batch.append(item)

            if not batch:
                break

            futures = {
                executor.submit(process_combo, sk, la, fw, ctx): (sk, la, fw, ctx)
                for sk, la, fw, ctx in batch
            }

            for future in as_completed(futures):
                sub_key, lang, fw, ctx = futures[future]
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

                sub_counts[sub_key]  += 1
                lang_counts[lang]    += 1
                ctx_counts[ctx]      += 1
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
                        f"  [{kept:>3}/{TARGET}]  {kept*100//TARGET:>3}%  "
                        f"skip={skipped} ({skip_pct}%)  err={errors}  avg_wp={avg_wp}"
                    )

    save_checkpoint(samples)
    final = [{k: v for k, v in s.items() if not k.startswith("_")} for s in samples]
    Path(OUTPUT_FILE).parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for s in final:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")

    print()
    print(f"╔══════════════════════════════════════════════╗")
    print(f"║  DONE — {kept} samples saved                  ║")
    print(f"╚══════════════════════════════════════════════╝")
    print(f"  Output  : {OUTPUT_FILE}")
    print(f"  Skipped : {skipped}")
    print(f"  Errors  : {errors}")
    print()
    print("  Subtype distribution:")
    for k, v in sorted(sub_counts.items(), key=lambda x: -x[1]):
        print(f"    {v:>4}  {k}")
    print()
    print("  Language distribution:")
    for k, v in sorted(lang_counts.items(), key=lambda x: -x[1]):
        print(f"    {v:>4}  {k}")


if __name__ == "__main__":
    main()
