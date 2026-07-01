import json, re, time, random
from pathlib import Path
from openai import OpenAI

CEREBRAS_KEY   = "csk-xxxxxxxxxxxxxxxx"
CEREBRAS_MODEL = "qwen-3-235b-a22b-instruct-2507"
TARGET      = 2700
OUTPUT_FILE = r"crypto_output.jsonl"
CHECKPOINT  = r"crypto_checkpoint.jsonl"

client = OpenAI(api_key=CEREBRAS_KEY, base_url="https://api.cerebras.ai/v1")

def call_api(system_prompt, user_msg):
    for attempt in range(3):
        try:
            resp = client.chat.completions.create(
                model=CEREBRAS_MODEL, max_tokens=600, temperature=0.75,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user",   "content": user_msg},
                ]
            )
            return resp.choices[0].message.content
        except Exception as e:
            msg = str(e)
            if "429" in msg or "quota" in msg.lower():
                print(f"  [LIMIT] Daily quota reached — wait 24h")
                time.sleep(60)
            else:
                if attempt == 2:
                    print(f"  [ERR] {msg[:80]}")
                time.sleep(2)
    return None

# ══════════════════════════════════════════════════════════════════════════
SYSTEM_PROMPT = """You are a security code generation engine creating training data for CodeBERT.

Output EXACTLY:

VULN:
<vulnerable function here>

SAFE:
<fixed function here>

═══ STRICT RULES ═══

[SIZE — CRITICAL]
- VULN: 8–18 lines. SAFE: 10–22 lines.
- COMBINED VULN + SAFE must be under 2000 CHARACTERS TOTAL.
- Write short code. No verbose comments or extra helpers.

[FORMAT]
- No explanation, no markdown, no backticks, no inline comments.
- ONE complete function per section: imports + function def + body + return.

[VULNERABILITY]
- VULN has EXACTLY ONE cryptographic weakness.
- SAFE has the SAME function name and parameters. Fix ONLY the weakness.

[QUALITY]
- No shell commands. Complete functions only.
- Use: AES-256-GCM, bcrypt(cost≥12), Argon2id, PBKDF2(≥100000 iter), RSA-4096.
- Always generate a random IV/nonce per call and include it in the return value."""

def strip_comments(code):
    code = re.sub(r'#.*', '', code)
    code = re.sub(r'//.*', '', code)
    code = re.sub(r'/\*.*?\*/', '', code, flags=re.DOTALL)
    code = re.sub(r'""".*?"""', '', code, flags=re.DOTALL)
    code = re.sub(r"'''.*?'''", '', code, flags=re.DOTALL)
    return code

def smart_truncate(code, max_chars):
    if len(code) <= max_chars:
        return code
    lines, result, total = code.split('\n'), [], 0
    for line in lines:
        cost = len(line) + 1
        if total + cost > max_chars:
            break
        result.append(line)
        total += cost
    return '\n'.join(result)

SUBTYPES = [
    ("MD5 used for password hashing — no salt, no KDF", None,
     ["hashlib.md5(", ".md5(", "MessageDigest.getInstance(\"MD5\")",
      "MD5.new(", "Digest::MD5", "md5(", "MD5.hexdigest"]),
    ("SHA1 used for password hashing — no salt, no KDF", None,
     ["hashlib.sha1(", ".sha1(", "MessageDigest.getInstance(\"SHA-1\")",
      "SHA1.new(", "Digest::SHA1", "sha1("]),
    ("Password stored as plain SHA-256 hash without salt or work factor", None,
     ["hashlib.sha256(password.encode", "hashlib.sha256(pwd.encode",
      "hashlib.sha256(passwd.encode",
      "sha256.Sum256([]byte(password",
      "crypto.createHash('sha256').update(password"]),
    ("Bcrypt used with dangerously low cost factor of 4", None,
     ["cost=4,", "cost=4)", "cost: 4", "\"cost\": 4",
      "rounds=4", "log_rounds=4", "work_factor=4",
      "cost=6,", "cost=6)", "rounds=6", "cost=8,", "rounds=8"]),
    ("DES symmetric encryption instead of AES-256-GCM", None,
     ["DES.new(", "DES.MODE_ECB", "DES.MODE_CBC", "des.NewCipher(",
      "Cipher.getInstance(\"DES", "DESKeySpec", "TripleDES", "DESede"]),
    ("RC4 stream cipher used for data encryption", None,
     ["RC4(", "ARC4(", "arcfour", "Cipher.getInstance(\"RC4\")",
      "rc4.NewCipher(", "RC4.new("]),
    ("AES-128 used — must use AES-256 with 32-byte key", None,
     ["aes-128", "AES-128", "AES128", "keySize = 16", "key_size=16",
      "keySize=16", "\"AES-128\"", "'AES-128'"]),
    ("AES-ECB mode used — must switch to AES-GCM", None,
     ["MODE_ECB", "AES.MODE_ECB", "/ECB/", "Cipher.getInstance(\"AES\")",
      "Cipher.getInstance(\"AES/ECB"]),
    ("Hardcoded all-zero IV for AES-CBC — must generate random IV per message", None,
     ["b'\\x00\\x00\\x00", "iv = bytes(16)", "Buffer.alloc(16, 0)",
      "new byte[16] {0", "new byte[]{0,0,0", "iv = b'\\x00",
      "iv = bytearray(16)"]),
    ("AES-CBC without message authentication — add HMAC or switch to GCM", None,
     ["MODE_ECB", "AES.MODE_ECB", "/ECB/"]),
    ("MD5 used for HMAC message authentication — must use SHA-256 HMAC",
     ["SHA256", "SHA-256", "SHA512", "sha256", "HmacSHA256", "hmac.new",
      "HMACSHA256", "hmac.digest", "HmacSha256", "crypto.createHmac",
      "HMAC.new", "OpenSSL::HMAC", "HMAC-SHA256"],
     ["HmacMD5", "hmac_md5", "HMACMD5", "HmacSHA1"]),
    ("Encryption key derived with single SHA-256 hash — must use PBKDF2 or scrypt",
     ["PBKDF2", "pbkdf2", "scryptSync", "scrypt", "Argon2",
      "Rfc2898DeriveBytes", "pbkdf2Sync", "pbkdf2_hmac",
      "crypto.pbkdf2", "pbkdf2Hmac", "SecretKeyFactory",
      "PBKDF2WithHmacSHA256", "derive_key"],
     ["createHash('sha256')", "createHash(\"sha256\")",
      "hashlib.sha256", "SHA256.Create().ComputeHash"]),
    ("Hardcoded AES encryption key as a string literal in source code", None,
     ["= \"0123", "= '0123", "SECRET_KEY = \"", "SECRET_KEY = '",
      "= b\"hardcoded", "= b'hardcoded",
      "= \"mysecretkey\"", "= 'mysecretkey'"]),
    ("JWT signed with hardcoded weak secret string", None,
     ["= 'secret'", "= \"secret\"", "= \"mysecret\"", "= 'mysecret'",
      "jwt_secret = \"", "jwt_secret = '",
      "= 'changeme'", "= \"changeme\"",
      "= \"password\"", "= \"supersecret\"", "= 'supersecret'"]),
    ("RSA key size 1024 bits — must be upgraded to 4096",
     None,   # any key size > 1024 = valid fix
     ["generateKeyPair(1024", "RSA.generate(1024", "KeySize = 1024",
      "rsa_keygen_bits:1024", "rsa.GenerateKey.*512"]),
    ("Math.random() used for cryptographic session token generation", None,
     ["Math.random()", "Math.floor(Math.random", "Math.ceil(Math.random"]),
    ("Timestamp-seeded PRNG used for session token or OTP generation", None,
     ["random.seed(int(time", "srand(time(",
      "rand.New(rand.NewSource(time.Now",
      "Random(System.currentTimeMillis",
      "rand.seed(Time.now", "rand.seed(Date.now"]),
    ("TLS configured to allow TLS 1.0 or SSLv3 — must enforce TLS 1.2 minimum",
     None,   # any removal of SSLv3/TLS1.0 = valid fix
     ["ssl.PROTOCOL_SSLv3", "SSLv23_METHOD", "SslProtocols.Ssl3",
      "tls.VersionTLS10", "SSLContext.getInstance(\"SSLv3",
      "ssl.PROTOCOL_TLSv1 ", "TLSv1_METHOD", "TLS1_METHOD"]),
]

LANG_FRAMEWORKS = [
    ("Python","Flask"),("Python","Django"),("Python","FastAPI"),("Python","plain Python"),
    ("Java","Spring Boot"),("Java","plain Java"),("Java","Jakarta EE"),
    ("CSharp","ASP.NET Core"),("CSharp","plain C#"),
    ("PHP","Laravel"),("PHP","Symfony"),("PHP","plain PHP"),
    ("Ruby","Rails"),("Ruby","Sinatra"),("Ruby","plain Ruby"),
    ("NodeJS","Express"),("NodeJS","NestJS"),("NodeJS","plain Node.js"),
    ("Go","Gin"),("Go","plain Go"),
    ("Kotlin","Ktor"),("Kotlin","Spring Boot Kotlin"),
]

CONTEXTS = [
    "user password storage and login authentication",
    "API token generation and validation",
    "session cookie encryption",
    "database field encryption at rest",
    "file encryption for sensitive uploads",
    "JWT secret signing and verification",
    "payment card data encryption",
    "inter-service communication encryption",
    "password reset token generation",
    "OAuth client secret storage",
    "audit log integrity verification",
    "configuration secrets encryption",
    "email verification token generation",
    "two-factor authentication OTP generation",
    "backup archive encryption",
    "webhook payload signature",
    "license key generation",
    "healthcare record encryption",
]

def parse_blocks(text):
    text = text.strip()
    text = re.sub(r'\*\*(VULN|SAFE):\*\*', r'\1:', text, flags=re.IGNORECASE)
    text = re.sub(r'```[a-zA-Z]*\n?', '', text)
    text = re.sub(r'```', '', text)
    vuln_m = re.search(r'VULN:\s*\n(.*?)(?=\nSAFE:)', text, re.DOTALL|re.IGNORECASE)
    safe_m = re.search(r'SAFE:\s*\n(.*?)$',           text, re.DOTALL|re.IGNORECASE)
    if not vuln_m or not safe_m:
        return None, None
    return vuln_m.group(1).strip(), safe_m.group(1).strip()

FUNCTION_KEYWORDS = [
    "def ","func ","function ","public ","private ","protected ",
    "static ","async function","void ","class ","module.exports",
    "fn ","fun ","sub ","object ","interface ",
]

def has_function(code):
    return any(kw in code for kw in FUNCTION_KEYWORDS)

def tokenize(code):
    return re.findall(r'[a-zA-Z_]\w*|[0-9]+', code)

def jaccard(a, b):
    sa, sb = set(a), set(b)
    if not sa and not sb: return 1.0
    return len(sa & sb) / (len(sa) + len(sb) - len(sa & sb))

def validate(vuln, safe, subtype_tuple):
    _, expected_signals, subtype_forbidden = subtype_tuple
    if not vuln or not safe:
        return False, "empty"
    if not has_function(vuln):
        return False, "vuln: no function definition"
    if not has_function(safe):
        return False, "safe: no function definition"
    vc, sc = len(vuln), len(safe)
    if vc < 80:    return False, f"vuln too short ({vc})"
    if vc > 1500:  return False, f"vuln too long ({vc})"
    if sc < 100:   return False, f"safe too short ({sc})"
    if sc > 1400:  return False, f"safe too long ({sc})"
    if vc+sc > 2100: return False, f"combined too long ({vc+sc})"
    vt, st = tokenize(vuln), tokenize(safe)
    if len(vt) < 10: return False, f"vuln too few identifiers ({len(vt)})"
    if len(st) < 10: return False, f"safe too few identifiers ({len(st)})"
    sim = jaccard(vt, st)
    if sim < 0.10:  return False, f"pair too different ({sim:.2f})"
    if sim >= 0.98: return False, f"pair too similar ({sim:.2f})"
    safe_nc = strip_comments(safe)
    for pat in subtype_forbidden:
        if pat in safe_nc:
            return False, f"forbidden: '{pat}'"
    if expected_signals is not None:
        if not any(sig in safe for sig in expected_signals):
            return False, f"missing signal — expected one of: {expected_signals[:4]}"
    return True, ""

def ngrams(code, n=3):
    t = tokenize(code)
    if len(t) < n: return set(t)
    return set('|'.join(t[i:i+n]) for i in range(len(t)-n+1))

def is_near_dup(fp, fingerprints, threshold=0.85):
    for efp in fingerprints:
        inter = len(fp & efp)
        union = len(fp) + len(efp) - inter
        if union and inter/union >= threshold:
            return True
    return False

def load_checkpoint():
    p = Path(CHECKPOINT)
    if not p.exists(): return []
    out = []
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            try: out.append(json.loads(line))
            except: pass
    return out

def save_checkpoint(samples):
    Path(CHECKPOINT).parent.mkdir(parents=True, exist_ok=True)
    with open(CHECKPOINT, "w", encoding="utf-8") as f:
        for s in samples:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")

def main():
    samples = load_checkpoint()
    kept = len(samples)
    skipped = errors = 0
    fingerprints = [ngrams(s['vuln_code']) for s in samples]

    combos = [
        (sub, lang, fw, ctx)
        for sub in SUBTYPES
        for (lang, fw) in LANG_FRAMEWORKS
        for ctx in CONTEXTS
    ]
    random.shuffle(combos)
    idx = kept % len(combos)

    print(f"Loaded {kept} from checkpoint. Target: {TARGET}")
    print("API: Cerebras (Qwen3-235B)")
    print(f"Total combos: {len(combos):,}")

    while kept < TARGET:
        subtype_tuple, lang, framework, context = combos[idx % len(combos)]
        idx += 1

        user_msg = (
            f"Language: {lang}\nFramework: {framework}\n"
            f"Vulnerability: {subtype_tuple[0]}\n"
            f"Business context: {context}\n\n"
            f"Write SHORT code. VULN max 18 lines, SAFE max 22 lines. "
            f"Combined under 2000 characters. "
            f"Same function name and parameters. Include all imports."
        )

        raw = call_api(SYSTEM_PROMPT, user_msg)
        if not raw:
            skipped += 1
            errors += 1
            continue

        vuln, safe = parse_blocks(raw)
        if not vuln or not safe:
            skipped += 1
            continue

        if len(vuln) + len(safe) > 2100:
            safe = smart_truncate(safe, 2100 - len(vuln) - 2)

        ok, reason = validate(vuln, safe, subtype_tuple)
        if not ok:
            print(f"  [SKIP] {reason}")
            skipped += 1
            continue

        fp = ngrams(vuln)
        if is_near_dup(fp, fingerprints):
            print(f"  [DUP]")
            skipped += 1
            continue

        fingerprints.append(fp)
        samples.append({
            "vuln_code": vuln, "safe_code": safe,
            "state": "Insecure Cryptography", "safe_code_label": "Safe",
        })
        kept += 1

        if kept % 10 == 0:
            save_checkpoint(samples)
            total = kept + skipped
            skip_pct = skipped * 100 // total if total else 0
            api = "Cerebras"
            print(f"  [{kept}/{TARGET}] {kept*100//TARGET}%  "
                  f"skip={skipped} ({skip_pct}%)  err={errors}  [{api}]")

        time.sleep(0.2)

    save_checkpoint(samples)
    Path(OUTPUT_FILE).parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for s in samples:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")
    print(f"\nDone! {kept} samples → {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
