"""
VulnSneak API — scanner.py
===========================
Loads Binary and Family models once at startup.
Exposes a single scan() function used by the API.
"""

import re
import numpy as np
import torch
from collections        import defaultdict
from transformers       import AutoTokenizer, AutoModelForSequenceClassification

import config as app_config

from config import (
    BINARY_MODEL_PATH,
    FAMILY_MODEL_PATH,
    MAX_LENGTH,
    WINDOW_LINES,
    STRIDE_LINES,
    BINARY_THRESHOLD,
    FAMILY_CONFIDENCE_FLOOR,
    MERGE_LINE_TOLERANCE,
)

# Backward-compatible defaults. This keeps the updated scanner working even
# when the existing config.py has not yet been updated with rescue settings.
SINK_RESCUE_ENABLED = getattr(app_config, "SINK_RESCUE_ENABLED", True)
SINK_RESCUE_RADIUS_LINES = int(getattr(app_config, "SINK_RESCUE_RADIUS_LINES", 7))
SINK_RESCUE_MAX_WINDOWS = int(getattr(app_config, "SINK_RESCUE_MAX_WINDOWS", 64))
SINK_RESCUE_CONFIDENCE_FLOOR = float(
    getattr(app_config, "SINK_RESCUE_CONFIDENCE_FLOOR", 0.08)
)


# ── Device ─────────────────────────────────────────────────────────────────────
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"[Scanner] Using device: {DEVICE}")


# ── Load Models Once ───────────────────────────────────────────────────────────
print("[Scanner] Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(str(BINARY_MODEL_PATH))

print("[Scanner] Loading Binary Model...")
binary_model = AutoModelForSequenceClassification.from_pretrained(
    str(BINARY_MODEL_PATH)
).to(DEVICE)
binary_model.eval()

print("[Scanner] Loading Family Model...")
family_model = AutoModelForSequenceClassification.from_pretrained(
    str(FAMILY_MODEL_PATH)
).to(DEVICE)
family_model.eval()

family_id2label = family_model.config.id2label
print(f"[Scanner] Models ready. Families: {list(family_id2label.values())}")


# ══════════════════════════════════════════════════════════════════════════════
# SOLUTION 2 — HTML Preprocessing: extract JS only
# ══════════════════════════════════════════════════════════════════════════════

def extract_js_from_html(code: str) -> tuple[str, list[int]]:
    """
    Extract inline JavaScript from HTML files and build a line number map.

    Returns
    -------
    js_text   : dense JS-only string (same format as old behavior) — used by
                the ML models so they see contiguous code, not blank lines.
    line_map  : list where line_map[i] is the 1-based original HTML file line
                number that corresponds to the (i+1)-th line of js_text.
                Empty list when no inline scripts were found (identity mapping).

    Why line_map?
        The old approach stripped HTML and reset line numbers to 1.
        line_map lets us translate any JS-space line number back to the
        original HTML file line number after detection.
    """
    lines     = code.splitlines()
    js_lines  = []   # JS line content
    line_map  = []   # parallel: original 1-based line number for each JS line

    in_script = False
    found     = 0
    open_pat  = re.compile(r'<script(?![^>]*\bsrc\b)[^>]*>', re.IGNORECASE)
    close_pat = re.compile(r'</script>', re.IGNORECASE)

    for idx, line in enumerate(lines):
        original_line_num = idx + 1   # 1-based

        if open_pat.search(line) and not in_script:
            in_script = True
            found    += 1
            # If the open tag and content are on the same line (rare), skip tag
            # The JS part would be lost — acceptable edge case
            continue

        if close_pat.search(line) and in_script:
            in_script = False
            continue

        if in_script:
            js_lines.append(line)
            line_map.append(original_line_num)

    if not js_lines:
        # No inline scripts found — return full content, identity mapping
        print("[Scanner] HTML — no inline <script> blocks found, scanning full content.")
        return code, []

    js_text = "\n".join(js_lines)
    print(f"[Scanner] HTML — extracted {found} <script> block(s) "
          f"({len(js_lines)} JS lines mapped to original HTML line numbers).")
    return js_text, line_map


# ══════════════════════════════════════════════════════════════════════════════
# SOLUTION 4 — Confirmation Layer
# After ML detects a family, confirm with rule-based keywords for that family.
# If the snippet doesn't contain any matching pattern → it's a false positive.
# ══════════════════════════════════════════════════════════════════════════════

FAMILY_CONFIRMATION_RULES: dict[str, list[str]] = {
    "XSS": [
        "innerHTML", "outerHTML", "document.write",
        "insertAdjacentHTML", ".html(", "dangerouslySetInnerHTML",
    ],
    "Insecure Deserialization": [
        "eval(", "new Function(", "pickle.loads",
        "ObjectInputStream", "yaml.load", "unserialize(", "readObject(",
    ],
    "SQL Injection": [
        "SELECT ", "INSERT ", "UPDATE ", "DELETE ", "DROP ", "UNION ",
        "executeQuery", "execute(", "cursor.execute", "query(",
        "prepareStatement", "createQuery", "nativeQuery",
    ],
    "OS Command Injection": [
        "exec(", "system(", "popen(", "subprocess",
        "Runtime.exec", "ProcessBuilder", "child_process",
        "spawn(", "shell=True", "os.system",
    ],
    "Path Traversal": [
        "../", "..\\", "os.path", "open(",
        "readFile(", "getResourceAsStream", "new File(",
        "path.join", "include(",
    ],
    "CSRF": [
        "fetch(", "XMLHttpRequest", "$.ajax", "axios",
        "<form", 'method="post"', ".post(", ".submit(",
    ],
    "XML Injection": [
        "xml", "xpath", "XMLParser", "DocumentBuilder",
        "SAXParser", "etree", "minidom", "lxml",
        "parseXML", "loadXML", "xmlDoc",
    ],
    # NOTE: "math.random(" is included here on purpose. It used to be left out
    # because it's generic and noisy on its own, but that meant a chunk
    # containing ONLY `Math.random()` (no md5/sha1/etc. keyword) failed the
    # basic "any rule matches" check below and was discarded *before* ever
    # reaching the security-context check in confirm_with_rules(). That
    # ordering bug let real `Math.random()`-as-API-key vulnerabilities slip
    # through undetected. Keeping it here, combined with the dedicated
    # security-context check below (key/token/secret/password/nonce/salt/seed
    # proximity), still filters out display-only randomness (e.g. chart
    # colors, animation timing) while catching real cryptographic misuse.
    "Insecure Cryptography": [
        "md5(", "sha1(", "des-cbc", "des-ecb", "des-ede", "RC4", "ECB",
        "base64", "rot13", "createHash", "createCipher", "crypto.",
        "math.random(",
    ],
}


# ══════════════════════════════════════════════════════════════════════════════
# Localization Rules — separate from confirmation
# ══════════════════════════════════════════════════════════════════════════════
# FAMILY_CONFIRMATION_RULES (above) answers: "Is this detection likely real?"
# FAMILY_LOCALIZATION_RULES (below)  answers: "Which sink/route/statement
#   should be used as the repair anchor (the vuln_lines hint)?"
#
# These used to be the same dict. That was wrong for CSRF in particular:
# client-side calls like fetch()/axios/$.ajax are useful signals that a
# state-changing request exists, but they are a terrible repair anchor —
# anchoring there points the repair agent at the wrong side of the wire
# (e.g. the browser fetch call, or even an unrelated upstream gateway call)
# instead of the actual server-side route handler that needs the CSRF check.
# For CSRF, localization is restricted to server-side route handlers so the
# repair agent's editable-region search starts from the right place and can
# expand outward to the complete route.

FAMILY_LOCALIZATION_RULES: dict[str, list[str]] = {
    "XSS"                      : FAMILY_CONFIRMATION_RULES["XSS"],
    "Insecure Deserialization" : FAMILY_CONFIRMATION_RULES["Insecure Deserialization"],
    "SQL Injection"            : FAMILY_CONFIRMATION_RULES["SQL Injection"],
    "OS Command Injection"     : FAMILY_CONFIRMATION_RULES["OS Command Injection"],
    "Path Traversal"           : FAMILY_CONFIRMATION_RULES["Path Traversal"],
    "XML Injection"            : FAMILY_CONFIRMATION_RULES["XML Injection"],
    "Insecure Cryptography"    : FAMILY_CONFIRMATION_RULES["Insecure Cryptography"],
    # CSRF: anchor on the server-side route handler, never on client-side
    # fetch()/ajax/axios calls or unrelated upstream calls.
    "CSRF": [
        "router.post(", "router.put(", "router.patch(", "router.delete(",
        "app.post(",    "app.put(",    "app.patch(",    "app.delete(",
    ],
}


def confirm_with_rules(detection: dict) -> bool:
    """
    Confirm an ML detection using rule-based keywords + smart context checks.

    Returns True  → likely a real vulnerability (keep it).
    Returns False → false positive (discard).

    Special logic per family:
      - XSS: innerHTML must be assigned a variable, not a hardcoded string
      - Insecure Cryptography: Math.random only flagged in security contexts
    """
    label      = detection["family_label"]
    text       = detection["text"]
    text_lower = text.lower()

    rules = FAMILY_CONFIRMATION_RULES.get(label)
    if not rules:
        return True  # no rules defined → trust the ML model

    # ── Basic keyword check ────────────────────────────────────────────────
    if not any(rule.lower() in text_lower for rule in rules):
        print(f"  [Scanner] Discarded: {label} — no matching keyword "
              f"@ lines {detection['start_line']}-{detection['end_line']}")
        return False

    # ── XSS: innerHTML must receive a variable, not a hardcoded string ─────
    # innerHTML = someVariable  → dangerous (variable could be user input)
    # innerHTML = '<a>...</a>'  → safe     (hardcoded string)
    if label == "XSS":
        has_dynamic_xss = bool(
            re.search(r'innerHTML\s*=\s*(?![\'"`\s<])', text)   or
            re.search(r'outerHTML\s*=\s*(?![\'"`\s<])', text)   or
            re.search(r'document\.write\s*\(\s*(?![\'"`])', text)
        )
        if not has_dynamic_xss:
            print(f"  [Scanner] Discarded: XSS — innerHTML with hardcoded string only "
                  f"@ lines {detection['start_line']}-{detection['end_line']}")
            return False

    # ── Insecure Cryptography: Math.random only flagged in security context ─
    if label == "Insecure Cryptography":
        has_broken_crypto = bool(
            re.search(
                r'\bmd5\s*\(|\bsha1\s*\(|\brc4\b|\becb\b|'
                r'\bdes(?:-cbc|-ecb|-ede(?:3)?)?\b|\bcreatehash\s*\(|'
                r'\bcreatecipher(?:iv)?\s*\(|\bcrypto\.',
                text_lower,
            )
        )
        uses_random_for_security = bool(
            re.search(
                r'(token|key|secret|password|nonce|salt|seed).{0,40}random'
                r'|random.{0,40}(token|key|secret|password|nonce|salt|seed)',
                text_lower,
            )
        )
        uses_weak_encoding_for_security = bool(
            re.search(
                r'(token|key|secret|password|nonce|salt|seed).{0,50}(base64|rot13|atob|btoa)'
                r'|(base64|rot13|atob|btoa).{0,50}(token|key|secret|password|nonce|salt|seed)',
                text_lower,
            )
        )
        if not (has_broken_crypto or uses_random_for_security or uses_weak_encoding_for_security):
            print(f"  [Scanner] Discarded: Insecure Cryptography — no security-sensitive "
                  f"broken-crypto context @ lines {detection['start_line']}-{detection['end_line']}")
            return False

    return True


# ══════════════════════════════════════════════════════════════════════════════
# Sink-centered rescue pass
# ══════════════════════════════════════════════════════════════════════════════
#
# The family model is a single-label softmax classifier. A broad window that
# contains two different vulnerability families can therefore return only one
# argmax label, even when both issues are real. The rescue pass below creates a
# small independent window around high-precision dangerous sinks. The family
# model then receives a focused context in which the second family is no longer
# hidden by the first one.

_HIGH_PRECISION_SINK_PATTERNS: dict[str, list[re.Pattern]] = {
    "XSS": [
        re.compile(r'\b(?:innerHTML|outerHTML)\s*=\s*(?![\'"`])', re.IGNORECASE),
        re.compile(r'\bdocument\.write\s*\(\s*(?![\'"`])', re.IGNORECASE),
        re.compile(r'\binsertAdjacentHTML\s*\(', re.IGNORECASE),
    ],
    "Insecure Deserialization": [
        re.compile(r'\beval\s*\(', re.IGNORECASE),
        re.compile(r'\bnew\s+Function\s*\(', re.IGNORECASE),
        re.compile(r'\bpickle\.loads\s*\(', re.IGNORECASE),
        re.compile(r'\byaml\.load\s*\(', re.IGNORECASE),
        re.compile(r'\bunserialize\s*\(', re.IGNORECASE),
        re.compile(r'\bObjectInputStream\b', re.IGNORECASE),
        re.compile(r'\breadObject\s*\(', re.IGNORECASE),
    ],
}


def _code_part_for_sink_scan(line: str) -> str:
    """Drop an obvious // comment tail before matching high-precision sinks."""
    return re.sub(r'//.*$', '', line)


def build_sink_rescue_chunks(
    source_lines: list[str],
    radius: int = SINK_RESCUE_RADIUS_LINES,
    max_windows: int = SINK_RESCUE_MAX_WINDOWS,
) -> list[dict]:
    """
    Build compact, non-duplicated windows around high-precision dangerous sinks.

    Each returned chunk carries `hint_family` and `sink_line`. The hint is not
    blindly trusted. The family model still scores the focused chunk, and the
    candidate is kept only when the hinted family's own probability passes the
    rescue floor and the normal deterministic confirmation layer accepts it.
    """
    if not source_lines or max_windows <= 0:
        return []

    radius = max(2, int(radius))
    windows: list[dict] = []
    seen: set[tuple[str, int]] = set()

    for line_no, raw_line in enumerate(source_lines, start=1):
        code_line = _code_part_for_sink_scan(raw_line)
        if not code_line.strip():
            continue

        for family, patterns in _HIGH_PRECISION_SINK_PATTERNS.items():
            if not any(pattern.search(code_line) for pattern in patterns):
                continue

            # De-duplicate nearby sinks of the same family into a single focused
            # context window. This keeps inference cost bounded in large files.
            bucket = max(1, line_no // max(1, radius))
            dedupe_key = (family, bucket)
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)

            start_line = max(1, line_no - radius)
            end_line = min(len(source_lines), line_no + radius)
            windows.append({
                "text"        : _rebuild_text(start_line, end_line, source_lines),
                "start_line"  : start_line,
                "end_line"    : end_line,
                "hint_family" : family,
                "sink_line"   : line_no,
                "is_rescue"   : True,
            })

            if len(windows) >= max_windows:
                return windows

    return windows


def build_rescue_candidates(rescue_results: list[dict]) -> list[dict]:
    """
    Convert focused family-model outputs into normal detection records.

    `run_family` exposes all class probabilities in `family_scores`, allowing
    the hinted family to be evaluated even when it is not the argmax class.
    This is the key difference from the old top-1-only pipeline.
    """
    candidates: list[dict] = []

    for result in rescue_results:
        hint = result.get("hint_family")
        scores = result.get("family_scores") or {}
        hint_conf = float(scores.get(hint, 0.0))

        if not hint or hint_conf < SINK_RESCUE_CONFIDENCE_FLOOR:
            continue

        candidate = {
            **result,
            "family_label"      : hint,
            "family_confidence" : hint_conf,
            "detection_source"  : "sink_rescue",
        }

        if confirm_with_rules(candidate):
            candidates.append(candidate)

    return candidates


# ══════════════════════════════════════════════════════════════════════════════
# Exact Vulnerable Line Localization
# ══════════════════════════════════════════════════════════════════════════════

def _scan_lines_for_rules(
    text: str, rules: list[str], start_line: int, end_line: int
) -> list[int]:
    """Return absolute 1-based line numbers within [start_line, end_line] whose
    text contains any of the given keywords (case-insensitive)."""
    matches = []
    for i, line in enumerate(text.splitlines()):
        abs_line = start_line + i
        if abs_line > end_line:          # never exceed chunk boundary
            break
        line_lower = line.lower()
        if any(rule.lower() in line_lower for rule in rules):
            matches.append(abs_line)
    return [l for l in matches if start_line <= l <= end_line]


def find_vuln_lines(detection: dict) -> list[int]:
    """
    Find exact 1-based line numbers within the chunk that contain a vulnerability
    keyword for the detected family.

    The text is always aligned with start_line (after _rebuild_text in merge),
    so position i in text corresponds to absolute line (start_line + i).

    Three-stage localization, each stage strictly narrower than "highlight the
    whole block":
      1. Try the narrow, repair-anchor-quality FAMILY_LOCALIZATION_RULES.
      2. If nothing matched, retry with the broader FAMILY_CONFIRMATION_RULES —
         every confirmed detection is GUARANTEED to contain at least one of
         these keywords somewhere in its text (that's how confirm_with_rules
         decided to keep it), so this stage is reliable and still pinpoints a
         specific line rather than a range.
      3. If even that produces nothing (should not normally happen given the
         guarantee above, but guarded defensively), fall back to a SINGLE
         line — start_line — never the full [start_line, end_line] block.
        This avoids ever highlighting an unrelated trailing line such as a
        closing brace.
    """
    label      = detection["family_label"]
    text       = detection["text"]
    start_line = detection["start_line"]
    end_line   = detection["end_line"]

    # Stage 1: narrow localization rules (best repair-anchor quality).
    localization_rules = FAMILY_LOCALIZATION_RULES.get(label, [])
    if localization_rules:
        vuln_lines = _scan_lines_for_rules(text, localization_rules, start_line, end_line)
        if vuln_lines:
            return vuln_lines

    # Stage 2: broader confirmation rules — guaranteed to match somewhere,
    # since this detection already passed confirm_with_rules().
    confirmation_rules = FAMILY_CONFIRMATION_RULES.get(label, [])
    if confirmation_rules:
        vuln_lines = _scan_lines_for_rules(text, confirmation_rules, start_line, end_line)
        if vuln_lines:
            return vuln_lines

    # Stage 3: defensive single-line fallback — never the whole block.
    print(f"  [Scanner] Localization fallback to single line: {label} @ line {start_line} "
          f"(no keyword matched in either rule set within lines {start_line}-{end_line}).")
    return [start_line]


# ══════════════════════════════════════════════════════════════════════════════
# Chunking
# ══════════════════════════════════════════════════════════════════════════════

def chunk_code(source_lines: list[str], window: int, stride: int) -> list[dict]:
    chunks = []
    n      = len(source_lines)

    for start in range(0, n, stride):
        end        = min(start + window, n)
        chunk_text = "\n".join(source_lines[start:end])
        chunks.append({
            "text"       : chunk_text,
            "start_line" : start + 1,
            "end_line"   : end,
        })
        if end == n:
            break

    return chunks


# ══════════════════════════════════════════════════════════════════════════════
# Binary Inference
# ══════════════════════════════════════════════════════════════════════════════

def run_binary(chunks: list[dict], batch_size: int = 32) -> list[dict]:
    texts  = [c["text"] for c in chunks]
    scores = []

    for i in range(0, len(texts), batch_size):
        batch   = texts[i : i + batch_size]
        encoded = tokenizer(
            batch,
            max_length=MAX_LENGTH,
            truncation=True,
            padding=True,
            return_tensors="pt",
        ).to(DEVICE)

        with torch.no_grad():
            logits = binary_model(**encoded).logits

        probs = torch.softmax(logits, dim=-1)[:, 1].cpu().numpy()
        scores.extend(probs)

    results = []
    for chunk, score in zip(chunks, scores):
        results.append({
            **chunk,
            "vuln_score"    : float(score),
            "is_vulnerable" : float(score) >= BINARY_THRESHOLD,
        })

    return results


# ══════════════════════════════════════════════════════════════════════════════
# Family Inference
# ══════════════════════════════════════════════════════════════════════════════

def run_family(chunks: list[dict], batch_size: int = 32) -> list[dict]:
    texts     = [c["text"] for c in chunks]
    all_probs = []

    for i in range(0, len(texts), batch_size):
        batch   = texts[i : i + batch_size]
        encoded = tokenizer(
            batch,
            max_length=MAX_LENGTH,
            truncation=True,
            padding=True,
            return_tensors="pt",
        ).to(DEVICE)

        with torch.no_grad():
            logits = family_model(**encoded).logits

        probs = torch.softmax(logits, dim=-1).cpu().numpy()
        all_probs.extend(probs)

    results = []
    for chunk, probs in zip(chunks, all_probs):
        best_idx  = int(np.argmax(probs))
        best_conf = float(probs[best_idx])
        results.append({
            **chunk,
            "family_label"      : family_id2label[best_idx],
            "family_confidence" : best_conf,
            "family_scores"     : {
                family_id2label[idx]: float(prob)
                for idx, prob in enumerate(probs)
            },
            "detection_source"  : chunk.get("detection_source", "sliding_window"),
        })

    return results


# ══════════════════════════════════════════════════════════════════════════════
# SOLUTION 3 — Merge same-family overlaps
# ══════════════════════════════════════════════════════════════════════════════

def _rebuild_text(start_line: int, end_line: int, source_lines: list[str]) -> str:
    """Rebuild chunk text from actual source lines for the given 1-based range."""
    s = max(0, start_line - 1)
    e = min(end_line, len(source_lines))
    return "\n".join(source_lines[s:e])


def merge_detections(
    detections  : list[dict],
    tolerance   : int,
    source_lines: list[str] | None = None,
) -> list[dict]:
    """
    Merge same-family overlapping detections into one.

    When source_lines is provided, the merged detection text is rebuilt from
    the actual source so it always covers the full [start_line, end_line] range.
    This ensures find_vuln_lines computes correct absolute line numbers even
    after several chunks have been merged together.
    """
    if not detections:
        return []

    by_label = defaultdict(list)
    for d in detections:
        by_label[d["family_label"]].append(d)

    merged = []

    for label, group in by_label.items():
        group   = sorted(group, key=lambda x: x["start_line"])
        current = group[0].copy()

        for nxt in group[1:]:
            if nxt["start_line"] <= current["end_line"] + tolerance:
                current["end_line"] = max(current["end_line"], nxt["end_line"])
                if nxt["family_confidence"] > current["family_confidence"]:
                    current["family_confidence"] = nxt["family_confidence"]
                # Never replace text here — we rebuild from source below
            else:
                if source_lines:
                    current["text"] = _rebuild_text(
                        current["start_line"], current["end_line"], source_lines
                    )
                merged.append(current)
                current = nxt.copy()

        if source_lines:
            current["text"] = _rebuild_text(
                current["start_line"], current["end_line"], source_lines
            )
        merged.append(current)

    return sorted(merged, key=lambda x: x["start_line"])


# ══════════════════════════════════════════════════════════════════════════════
# SOLUTION 3b — Remove cross-family overlaps
# ══════════════════════════════════════════════════════════════════════════════

def remove_overlap_across_families(detections: list[dict]) -> list[dict]:
    """
    Cross-family overlap handling.

    A single function can legitimately contain more than one type of real
    vulnerability (e.g. a route with both a SQL Injection issue AND a CSRF
    issue). The old version discarded a detection merely because its chunk
    range overlapped with a higher-confidence detection from a *different*
    family — that could silently erase a real, unrelated vulnerability.

    New rule: detections from different families are NEVER discarded against
    each other here, regardless of range overlap. We only deduplicate within
    the SAME family, when two detections' line ranges overlap (this is a
    safety net for leftover overlaps that merge_detections' tolerance window
    didn't already combine — it does not replace merge_detections).
    """
    if not detections:
        return []

    detections = sorted(detections, key=lambda x: x["family_confidence"], reverse=True)
    kept: list[dict] = []

    for det in detections:
        is_duplicate = False
        for k in kept:
            if det["family_label"] != k["family_label"]:
                continue   # different family → keep both, never discard here
            overlap_start = max(det["start_line"], k["start_line"])
            overlap_end   = min(det["end_line"],   k["end_line"])
            if overlap_end > overlap_start:
                is_duplicate = True
                break
        if not is_duplicate:
            kept.append(det)

    return sorted(kept, key=lambda x: x["start_line"])


# ══════════════════════════════════════════════════════════════════════════════
# Main Scan Function
# ══════════════════════════════════════════════════════════════════════════════

def scan(code: str, filename: str = "uploaded_file") -> dict:
    """
    Full VulnSneak pipeline:
      1. HTML preprocessing  — extract JS only (HTML files)
      2. Chunk               — sliding window
      3. Binary model        — is this chunk vulnerable?
      4. Family model        — which vulnerability type?
      4b. Sink rescue         — focused reclassification around strong sinks
      5. Confidence filter   — drop low-confidence results
      6. Merge               — merge same-family overlapping detections
      7. Cross-family dedup  — keep highest-confidence when families overlap
      8. Confirmation layer  — rule-based check to eliminate false positives
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    # Step 0: HTML preprocessing
    html_line_map  = []           # empty = no translation needed (non-HTML files)
    original_lines = code.splitlines()   # keep original for evidence_snippet

    if ext in ("html", "htm"):
        code, html_line_map = extract_js_from_html(code)

    source_lines = [line.rstrip("\n") for line in code.splitlines()]

    if not source_lines:
        return {
            "filename"          : filename,
            "status"            : "Safe",
            "total_chunks"      : 0,
            "vulnerable_chunks" : 0,
            "vulnerabilities"   : [],
        }

    # Step 1: Chunk
    chunks = chunk_code(source_lines, WINDOW_LINES, STRIDE_LINES)

    # Step 2: Binary model
    binary_results    = run_binary(chunks)
    vulnerable_chunks = [c for c in binary_results if c["is_vulnerable"]]

    if not vulnerable_chunks:
        return {
            "filename"          : filename,
            "status"            : "Safe",
            "total_chunks"      : len(chunks),
            "vulnerable_chunks" : 0,
            "vulnerabilities"   : [],
        }

    # Step 3: Family model on the normal sliding windows
    family_results = run_family(vulnerable_chunks)

    # Step 3b: Sink-centered rescue pass. This specifically solves the case
    # where one broad window contains two different vulnerability families and
    # the single-label family head returns only the dominant one.
    rescue_candidates: list[dict] = []
    if SINK_RESCUE_ENABLED:
        rescue_chunks = build_sink_rescue_chunks(source_lines)
        if rescue_chunks:
            rescue_results = run_family(rescue_chunks)
            rescue_candidates = build_rescue_candidates(rescue_results)
            if rescue_candidates:
                print(
                    f"[Scanner] Sink rescue recovered {len(rescue_candidates)} "
                    f"additional family candidate(s)."
                )

    family_results.extend(rescue_candidates)

    # Step 4: Confidence floor filter. Focused rescue candidates use their own
    # lower floor because they are already anchored on a high-precision sink
    # and have passed deterministic family confirmation.
    confident = [
        r for r in family_results
        if (
            r.get("detection_source") == "sink_rescue"
            or r["family_confidence"] >= FAMILY_CONFIDENCE_FLOOR
        )
    ]

    # Step 5: Merge same-family overlapping detections
    merged = merge_detections(confident, MERGE_LINE_TOLERANCE, source_lines)

    # Step 6: Remove cross-family overlaps
    merged = remove_overlap_across_families(merged)

    # Step 7: Confirmation layer — eliminate false positives
    before    = len(merged)
    confirmed = [d for d in merged if confirm_with_rules(d)]
    after     = len(confirmed)

    if before != after:
        print(f"[Scanner] Confirmation layer: {before} → {after} detections "
              f"({before - after} false positive(s) removed).")

    if not confirmed:
        return {
            "filename"          : filename,
            "status"            : "Safe",
            "total_chunks"      : len(chunks),
            "vulnerable_chunks" : len(vulnerable_chunks),
            "vulnerabilities"   : [],
        }

    # Step 8: Build final vulnerability list
    # For HTML files, translate JS-space line numbers → original HTML line numbers
    # using html_line_map built in Step 0.
    def js_to_html(js_line: int) -> int:
        """Translate a 1-based JS-space line number to original HTML file line."""
        if html_line_map and 1 <= js_line <= len(html_line_map):
            return html_line_map[js_line - 1]
        return js_line   # identity for non-HTML or out-of-range

    vulnerabilities = []
    for det in confirmed:
        vuln_lines_js = find_vuln_lines(det)

        if html_line_map:
            # Translate all line numbers to HTML file space
            start_orig = js_to_html(det["start_line"])
            end_orig   = js_to_html(det["end_line"])
            vuln_lines = [js_to_html(l) for l in vuln_lines_js]

            # Evidence snippet: original HTML lines for the detected range
            s        = max(0, start_orig - 1)
            e        = min(end_orig, len(original_lines))
            evidence = "\n".join(original_lines[s:e])
        else:
            start_orig = det["start_line"]
            end_orig   = det["end_line"]
            vuln_lines = vuln_lines_js
            evidence   = det["text"]

        vulnerabilities.append({
            "label"           : det["family_label"],
            "confidence"      : round(det["family_confidence"], 4),
            "start_line"      : start_orig,
            "end_line"        : end_orig,
            "vuln_lines"      : vuln_lines,
            "evidence_snippet": evidence,
        })

    return {
        "filename"          : filename,
        "status"            : "Vulnerable",
        "total_chunks"      : len(chunks),
        "vulnerable_chunks" : len(vulnerable_chunks),
        "vulnerabilities"   : vulnerabilities,
    }