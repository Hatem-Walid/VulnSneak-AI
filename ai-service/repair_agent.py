"""
VulnSneak API — repair_agent.py
================================
Region-based repair pipeline. This revision fixes nine correctness issues
found in the previous version (see the accompanying delivery notes for the
full rationale for each):

  1. Insecure Cryptography validator now accepts all common secure-random
     forms (qualified, bare/destructured, ES module, Python secrets/os.urandom,
     Java SecureRandom) and only requires an import when the call is BARE.
  2. Syntax validators are cross-platform (sys.executable for Python) and
     JSX/TS/TSX no longer use plain `node --check` (which is not JSX/TS-aware).
     /health reports availability using the exact same resolution logic that
     validation itself uses.
  3. Import insertion is DEFERRED: region patches are committed to
     `working_lines` without their imports during the bottom-to-top pass;
     all accepted imports are deduplicated and inserted exactly once, after
     every region patch has been applied.
  4. CSRF validation now rejects a request-controlled value compared against
     another request-controlled value (header-vs-body, cookie-vs-body,
     self-comparison) and requires an *identifiable* trusted mechanism
     (middleware, pre-existing session/token store, or origin allowlist that
     is itself visible in the original context, not just in the patch).
  5. Every finding is repaired with its OWN individual model request, strictly
     one at a time, in bottom-to-top order — never grouped or combined into a
     single shared-region request. This replaces the previous "Policy A"
     combined-call behavior, which was a source of request timeouts when
     several findings landed in the same region. Each finding's patch is
     applied and committed immediately before the next finding is processed,
     so every subsequent finding (including one in the same enclosing
     function) always sees the most up-to-date `working_lines`.
  6. A final integrity-verification pass confirms every finding marked
     `success=True` is textually present in the returned file; anything that
     isn't (e.g. silently clobbered by import insertion or a sibling patch)
     is flipped back to failed with a clear validation_error before the
     report is built.
  7. The brace-based region locator now strips multi-line block comments and
     multi-line template literals before counting braces, walks back across
     multi-line call/argument lists (not just comments/decorators) to find
     the true statement start, and records which localization STRATEGY was
     used (python_ast / brace_match / padded_fallback) as internal metadata.
  8. Cloud fallback (Gemini) is never called — not even to be told "no" by
     the network — unless ALLOW_CLOUD_REPAIR is true AND GEMINI_API_KEY is
     non-empty. This was already true via `_build_phases()`; the check is now
     also enforced defensively inside `call_gemini_json` itself.
  9. Stale-anchor re-localization: when two findings share an enclosing
     region, the first one's patch can shift line numbers inside it. Before
     EVERY repair_one() call, the finding's original vuln_lines text is
     re-verified (and, if needed, re-located nearby within its original
     region) against the CURRENT working_lines — see
     `_capture_finding_anchors`/`_relocate_vuln_lines`. Only a temporary copy
     of the finding carries the relocated line numbers into repair_one(); the
     original finding object (and the start_line/end_line/vuln_lines reported
     to the frontend) is never mutated. If the statement cannot be confidently
     re-located, the finding is reported needs_context instead of risking a
     patch against unrelated code.

Priority: qwen2.5-coder:7b (primary) → qwen3:4b (secondary) → gemini-2.5-flash
(last resort, only when config.ALLOW_CLOUD_REPAIR is true and a key is set).
"""

from __future__ import annotations

import ast
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from collections import Counter

import requests

from config import (
    OLLAMA_URL,
    REPAIR_MODELS,
    GEMINI_API_KEY,
    GEMINI_API_URL,
    ALLOW_CLOUD_REPAIR,
    DEBUG_REPAIR_RESPONSES,
    MAX_REGION_LINES,
    FALLBACK_PAD_LINES,
    MAX_CONTEXT_CHARS,
)


# ══════════════════════════════════════════════════════════════════════════════
# Repair System Prompt
# ══════════════════════════════════════════════════════════════════════════════

REPAIR_SYSTEM_PROMPT = """You are a strict senior application-security repair engine.

You receive:
- The complete source file as read-only context (when it fits the budget), or
  an import/declaration section plus padded context around the editable region.
- A complete EDITABLE REGION: the full enclosing function, method, route, or
  class that contains the reported vulnerability/vulnerabilities.
- The suspicious source line number(s) — a localization HINT only, not the
  literal range you must replace.

━━━ ABSOLUTE RULES ━━━
1. Repair ONLY the reported vulnerability/vulnerabilities. Do not perform
   unrelated refactoring.
2. Return a COMPLETE replacement for the entire editable region, including
   every unchanged line inside it — never return only the changed line(s).
3. Preserve unrelated behavior, function signatures, and public APIs exactly.
4. Update every later use of a local variable you change inside the editable
   region (e.g. if you introduce `resolvedPath`, every later file operation in
   that region must use `resolvedPath`, not the old unvalidated variable).
5. Never add comments, TODOs, placeholders, logging, or invented functionality.
6. Never introduce an undefined identifier, a duplicated statement, or a
   duplicated block (method, headers object, body object, call, function).
7. Use ONLY packages, middleware, variables, sessions, stores, and
   configuration that are actually visible in the supplied context. Never
   invent a session field, middleware, allowlist, trusted token, secret,
   package, or server-side store that is not visible.
8. If a new import is required, list it in "imports" — never write an import
   statement inside "replacement_code".
9. If a complete, secure fix cannot be produced from the visible context,
   return status "needs_context" and state exactly which trusted dependency,
   middleware, configuration, secret source, or server-side state is missing.
   Returning a fake or partial fix is worse than returning needs_context.
10. Before answering, verify internally that your replacement is syntactically
    coherent and that it actually removes the vulnerability — not merely that
    it looks different from the original.

━━━ VULNERABILITY-SPECIFIC ACCEPTANCE CRITERIA ━━━

SQL Injection — require:
- Parameterized queries / prepared statements.
- Both the SQL text AND the execute/query call's arguments are updated together.
- No concatenation or interpolation of attacker-controlled values into SQL text.
- Strict allowlisting for any dynamic identifier (table/column name) that
  cannot be parameterized.

Path Traversal — require:
- Normalize/resolve the candidate path against the allowed base directory
  (Node.js: path.resolve + path.relative — NOT a naive `resolvedPath.startsWith(BASE_DIR)`
  string-prefix check, since e.g. "/app/invoices-malicious" can pass a prefix
  check against "/app/invoices"; Python: os.path.realpath/abspath + a real
  containment check).
- A separator-safe containment check (e.g. path.relative(base, candidate) does
  not start with ".." and is not absolute).
- The validated path variable is used consistently in EVERY later file
  operation in the region (existence check, read, download, etc.) — never a
  mix of the old and new variable.
- Reject absolute paths and parent-directory escapes.

Insecure Cryptography — require:
- Cryptographically secure randomness for keys, tokens, secrets, nonces, salts:
  Node.js crypto.randomBytes / crypto.randomUUID (qualified OR a bare
  randomBytes/randomUUID call backed by a destructured or ES-module import of
  Node's 'crypto' module), Python secrets.token_bytes/token_hex/token_urlsafe
  or os.urandom, or Java SecureRandom.
- No Math.random() for any security-sensitive value.
- No MD5, SHA-1, DES, RC4, ECB mode, predictable seeds, or hardcoded secret keys.
- If you use a BARE randomBytes(...)/randomUUID() call (no `crypto.` prefix)
  and the source does not already import it, you MUST add the destructured
  import to "imports" (e.g. "const { randomBytes } = require('crypto');" or
  "import { randomBytes } from 'crypto';"). Do not require a new import if the
  needed functionality is already imported in the source file.

CSRF — require ONE of, and it must be VISIBLE in the supplied context, not
invented by you:
- Correct use of existing CSRF middleware actually visible in context.
- Comparison against a trusted server-side session/token-store value whose
  initialization or trusted storage is visible in context.
- An existing origin/referrer allowlist actually visible in context.
A token PRESENCE-ONLY check (e.g. `if (!csrfToken) return 403`) is NOT a valid
repair. Comparing two attacker-controlled request values against each other
(e.g. a header value vs a body field, a cookie vs a body field, or any value
against itself) is NOT a valid repair — at least one side of the comparison
must be a trusted server-side value. Forwarding the browser's CSRF token to an
unrelated payment gateway or other upstream service is NOT a repair. NEVER
invent `req.session.csrfToken` or any other session field/middleware/allowlist
unless it is actually visible (already initialized/configured) in context.
When no trusted CSRF source or middleware is visible, return needs_context —
do not guess.

XSS — require:
- No untrusted input passed to innerHTML/outerHTML/document.write/insertAdjacentHTML.
- Prefer textContent or framework-native escaping.
- Only use a sanitizer (e.g. DOMPurify) if it is actually visible/imported in
  the context — never invent a sanitizer function.

OS Command Injection — require:
- No attacker-controlled shell command strings; no shell=True.
- Argument arrays/lists instead of shell strings, with the shell disabled.
- Strict allowlisting when the executable or an option is attacker-controlled.

Insecure Deserialization — require:
- Safe parsers instead of eval, unsafe pickle.loads, unsafe yaml.load, or
  equivalents (e.g. ast.literal_eval, json.loads, yaml.safe_load).
- Schema/shape validation where reasonably possible.
- Do not silently change the expected data format without considering existing callers.

XML External Entity Injection — require:
- DTD processing disabled.
- External entity resolution disabled.
- Secure parser configuration appropriate to the language/library in use.

━━━ OUTPUT FORMAT — EXACTLY THIS JSON, NOTHING ELSE ━━━
{
  "status": "fixed",
  "replacement_code": "complete replacement for the entire editable region",
  "imports": [],
  "explanation": "one precise technical sentence"
}

When a complete secure repair cannot be produced from the visible context:
{
  "status": "needs_context",
  "replacement_code": "",
  "imports": [],
  "explanation": "state exactly which trusted dependency, middleware, configuration, secret source, or server-side state is missing"
}

Rules:
- "status" must be exactly "fixed" or "needs_context" — no other value.
- "fixed" requires non-empty "replacement_code". "needs_context" requires empty "replacement_code".
- "imports" is a JSON array of strings (each a complete import/require statement), or [].
- No markdown fences. No text before or after the JSON object. No extra fields.
- Escape newlines as \\n and double quotes as \\" inside string values.
- Output must be parseable by a strict JSON parser on the first attempt."""


# ══════════════════════════════════════════════════════════════════════════════
# File-type helpers
# ══════════════════════════════════════════════════════════════════════════════

def _ext(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


_JS_LIKE = {"js", "jsx", "ts", "tsx"}

IMPORT_LINE_PATTERNS: dict[str, re.Pattern] = {
    "py" : re.compile(r'^\s*(import\s|from\s+\S+\s+import\s)'),
    "js" : re.compile(r'^\s*(import\s|export\s+.*from\s|const\s+.+=\s*require\(|let\s+.+=\s*require\(|var\s+.+=\s*require\(|require\()'),
    "java": re.compile(r'^\s*(package\s|import\s)'),
    "cs"  : re.compile(r'^\s*using\s'),
    "php" : re.compile(r'^\s*(require|require_once|include|include_once|use\s)'),
    "rb"  : re.compile(r'^\s*require'),
    "go"  : re.compile(r'^\s*(package\s|import\s)'),
}
for _alias in ("jsx", "ts", "tsx"):
    IMPORT_LINE_PATTERNS[_alias] = IMPORT_LINE_PATTERNS["js"]


# ══════════════════════════════════════════════════════════════════════════════
# 1. Locate the complete editable region
# ══════════════════════════════════════════════════════════════════════════════
#
# locate_editable_region() returns (region_start, region_end, strategy).
# `strategy` is internal metadata only (never exposed through the API) —
# one of "python_ast", "brace_match", or "padded_fallback" — so callers can
# log/record how confident the localization is instead of silently treating
# every region as equally exact.

_MAX_DECL_BACKTRACK_LINES = 40  # safety cap for the multi-line declaration walk-back


def _python_region(source_lines: list[str], lo: int, hi: int) -> tuple[int, int] | None:
    """Use ast to find the smallest enclosing function/method containing [lo, hi]."""
    code = "\n".join(source_lines)
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return None

    best = None
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            start = node.lineno
            if getattr(node, "decorator_list", None):
                # ast gives the `def` line as lineno; pull the region start
                # back to the first decorator so decorators aren't dropped.
                start = min(start, min(d.lineno for d in node.decorator_list))
            end = getattr(node, "end_lineno", None) or start
            if start <= lo and hi <= end:
                if best is None or (end - start) < (best[1] - best[0]):
                    best = (start, end)
    return best


def _strip_block_comments(lines: list[str]) -> list[str]:
    """
    Blank out /* ... */ block-comment content, including comments that span
    multiple lines, while preserving line count and column positions (so
    every other line-number-based computation in this module stays valid).
    Heuristic: does not understand string literals, so a literal "/*" inside
    a string could be mis-treated as a comment start — an accepted trade-off
    for a dependency-free localizer.
    """
    out = []
    in_comment = False
    for line in lines:
        chars = list(line)
        i, n = 0, len(line)
        while i < n:
            if not in_comment:
                if chars[i] == "/" and i + 1 < n and chars[i + 1] == "*":
                    in_comment = True
                    chars[i] = chars[i + 1] = " "
                    i += 2
                    continue
                i += 1
            else:
                if chars[i] == "*" and i + 1 < n and chars[i + 1] == "/":
                    chars[i] = chars[i + 1] = " "
                    in_comment = False
                    i += 2
                    continue
                chars[i] = " "
                i += 1
        out.append("".join(chars))
    return out


def _strip_template_literals(lines: list[str]) -> list[str]:
    """
    Blank out backtick template-literal content, including literals that
    span multiple lines and any ${...} braces inside them, while preserving
    line/column structure. Heuristic, dependency-free.
    """
    out = []
    in_template = False
    for line in lines:
        if not in_template and "`" not in line:
            out.append(line)
            continue
        chars = list(line)
        i, n = 0, len(line)
        while i < n:
            if not in_template:
                if chars[i] == "`":
                    in_template = True
                    chars[i] = " "
                i += 1
            else:
                if chars[i] == "\\" and i + 1 < n:
                    chars[i] = chars[i + 1] = " "
                    i += 2
                    continue
                if chars[i] == "`":
                    in_template = False
                chars[i] = " "
                i += 1
        out.append("".join(chars))
    return out


_REGEX_LITERAL_CONTEXT = re.compile(
    r'(=|\(|,|return\s|:\s|test|match|replace|split)(\s*)(/(?:[^/\\\n]|\\.)+/[a-z]*)'
)


def _strip_regex_literals(line: str) -> str:
    """Best-effort blanking of /regex/ literals that could contain stray braces."""
    def _blank(m: re.Match) -> str:
        return m.group(1) + m.group(2) + " " * len(m.group(3))
    return _REGEX_LITERAL_CONTEXT.sub(_blank, line)


def _strip_for_braces(line: str) -> str:
    """
    Best-effort removal of remaining single-line string/regex/comment content
    so braces inside them don't confuse the brace matcher. Block comments and
    multi-line template literals are handled separately (see above) before
    this per-line pass runs.
    """
    line = _strip_regex_literals(line)
    line = re.sub(r'//.*$', '', line)
    line = re.sub(r'"(?:[^"\\]|\\.)*"', '""', line)
    line = re.sub(r"'(?:[^'\\]|\\.)*'", "''", line)
    line = re.sub(r'`(?:[^`\\]|\\.)*`', '``', line)
    return line


def _cleaned_lines_for_braces(source_lines: list[str]) -> list[str]:
    cleaned = _strip_block_comments(source_lines)
    cleaned = _strip_template_literals(cleaned)
    return [_strip_for_braces(line) for line in cleaned]


def _open_paren_origin_lines(cleaned_lines: list[str]) -> tuple[list[int], list[int]]:
    """
    Returns (paren_origin_before, brace_depth_before).

    paren_origin_before[i] = the line number where the OUTERMOST still-unclosed
    '(' carried into the start of line i was opened (0 if none).

    brace_depth_before[i] = the number of still-open '{' braces carried into
    the start of line i.

    Both let the region locator walk a declaration back across a multi-line
    argument/parameter list to find where the statement actually begins --
    brace_depth_before is used to make sure that backtrack never crosses INTO
    an enclosing scope (e.g. a nested callback's own multi-line call must not
    be confused with the outer function body it lives inside).
    """
    paren_stack: list[int] = []
    brace_depth = 0
    paren_origin_before = [0] * (len(cleaned_lines) + 2)
    brace_depth_before = [0] * (len(cleaned_lines) + 2)
    for idx, line in enumerate(cleaned_lines, start=1):
        paren_origin_before[idx] = paren_stack[0] if paren_stack else 0
        brace_depth_before[idx] = brace_depth
        for ch in line:
            if ch == "(":
                paren_stack.append(idx)
            elif ch == ")":
                if paren_stack:
                    paren_stack.pop()
            elif ch == "{":
                brace_depth += 1
            elif ch == "}":
                brace_depth = max(0, brace_depth - 1)
    return paren_origin_before, brace_depth_before


def _brace_region(source_lines: list[str], lo: int, hi: int) -> tuple[int, int] | None:
    """
    Generic brace-matching region finder. Finds the smallest {...} block that
    fully contains [lo, hi], then walks the declaration start backward across:
      - contiguous comment/decorator lines directly above the brace, AND
      - any multi-line call/parameter list that is still open when the
        brace's own line begins (e.g. a multi-line `router.post(...)` call
        whose final argument is the handler function).

    Used as the primary strategy for JavaScript/TypeScript (Express routes,
    function bodies) and as the fallback strategy for any other
    brace-delimited language (Java, C#, PHP, C/C++, Go).
    """
    cleaned = _cleaned_lines_for_braces(source_lines)

    stack: list[int] = []
    best: tuple[int, int] | None = None
    for idx, line in enumerate(cleaned, start=1):
        for ch in line:
            if ch == "{":
                stack.append(idx)
            elif ch == "}":
                if stack:
                    open_line = stack.pop()
                    if open_line <= lo and idx >= hi:
                        size = idx - open_line
                        if best is None or size < (best[1] - best[0]):
                            best = (open_line, idx)

    if not best:
        return None

    start, end = best
    paren_origin, brace_depth_before = _open_paren_origin_lines(cleaned)
    decl_start = start
    backtrack_budget = _MAX_DECL_BACKTRACK_LINES

    while backtrack_budget > 0:
        backtrack_budget -= 1
        moved = False

        # Absorb contiguous comment/decorator lines directly above.
        j = decl_start - 1
        while j >= 1 and backtrack_budget > 0:
            prev = source_lines[j - 1].strip()
            if prev.startswith(("//", "/*", "*", "@")):
                decl_start = j
                j -= 1
                backtrack_budget -= 1
                moved = True
                continue
            break

        # Walk back across an unfinished multi-line call/parameter list --
        # but ONLY if doing so stays at the SAME brace-nesting depth. If a
        # brace boundary lies between the paren's origin and decl_start, that
        # paren belongs to an enclosing scope (e.g. a nested callback's own
        # multi-line call vs. the function body it lives inside) and must
        # not be used to extend the region.
        origin = paren_origin[decl_start] if decl_start < len(paren_origin) else 0
        if (
            origin
            and origin < decl_start
            and brace_depth_before[origin] == brace_depth_before[decl_start]
        ):
            decl_start = origin
            moved = True

        if not moved:
            break

    return (decl_start, end)


def locate_editable_region(
    source_lines: list[str],
    filename: str,
    vuln_lines: list[int],
) -> tuple[int, int, str]:
    """
    Return (region_start, region_end, strategy), 1-based inclusive.
    strategy is internal metadata: "python_ast" | "brace_match" | "padded_fallback".

    vuln_lines is a localization HINT only. Falls back to a padded context
    window around vuln_lines when no enclosing unit can be located, or when
    the located unit is unreasonably large (MAX_REGION_LINES) — heuristic
    localization is never reported as exact when a fallback was used.
    """
    n = len(source_lines)
    if not vuln_lines:
        vuln_lines = [1]
    lo = max(1, min(min(vuln_lines), n))
    hi = max(1, min(max(vuln_lines), n))
    lo, hi = min(lo, hi), max(lo, hi)

    ext = _ext(filename)
    region = None
    strategy = "padded_fallback"

    if ext == "py":
        region = _python_region(source_lines, lo, hi)
        if region:
            strategy = "python_ast"

    if region is None:
        region = _brace_region(source_lines, lo, hi)
        if region:
            strategy = "brace_match"

    if region is None or (region[1] - region[0] + 1) > MAX_REGION_LINES:
        start = max(1, lo - FALLBACK_PAD_LINES)
        end   = min(n, hi + FALLBACK_PAD_LINES)
        region = (start, end)
        strategy = "padded_fallback"

    start, end = region
    start = max(1, min(start, n))
    end   = max(start, min(end, n))
    return start, end, strategy


# ══════════════════════════════════════════════════════════════════════════════
# 2. Build repair context (character/token-budget aware, not fixed-line-count)
# ══════════════════════════════════════════════════════════════════════════════

def _number_lines(lines: list[str]) -> str:
    width = len(str(max(1, len(lines))))
    return "\n".join(f"{i + 1:>{width}}: {line}" for i, line in enumerate(lines))


def _extract_import_section(source_lines: list[str], ext: str, max_scan: int = 80) -> int | None:
    """Return the 1-based line number of the last import/declaration line, or None."""
    pattern = IMPORT_LINE_PATTERNS.get(ext)
    if not pattern:
        return None

    last = None
    blank_run = 0
    for idx, line in enumerate(source_lines[:max_scan]):
        if pattern.match(line):
            last = idx
            blank_run = 0
        elif line.strip() == "":
            blank_run += 1
            if last is not None and blank_run > 2:
                break
        elif line.strip().startswith(("#", "//", "/*", "*")):
            continue
        else:
            if last is not None:
                break
    return (last + 1) if last is not None else None


def build_repair_context(
    source_lines: list[str],
    filename: str,
    region_start: int,
    region_end: int,
    vuln_lines: list[int],
) -> str:
    """
    Build the read-only + editable context sent to the model.

    - Full file (line-numbered, read-only) when it fits MAX_CONTEXT_CHARS.
    - Otherwise: import/declaration section + padded context before/after the
      editable region, all read-only, plus the editable region itself.

    The editable region text is given WITHOUT line-number prefixes so the
    model never mistakes the prefixes for part of the code to return.
    """
    full_text  = "\n".join(source_lines)
    region_raw = "\n".join(source_lines[region_start - 1:region_end])

    if len(full_text) <= MAX_CONTEXT_CHARS:
        numbered = _number_lines(source_lines)
        return (
            "FULL FILE (read-only context — for reference only, do not return this):\n"
            f"```\n{numbered}\n```\n\n"
            f"EDITABLE REGION — lines {region_start}-{region_end} of the file above:\n"
            f"```\n{region_raw}\n```"
        )

    ext = _ext(filename)
    import_end = _extract_import_section(source_lines, ext)
    pad = 25

    ctx_start = region_start - pad
    if import_end:
        ctx_start = max(ctx_start, import_end + 1)
    ctx_start = max(1, ctx_start)
    ctx_end   = min(len(source_lines), region_end + pad)

    pieces = []
    if import_end:
        import_text = "\n".join(source_lines[:import_end])
        pieces.append(
            f"IMPORT / DECLARATION SECTION (read-only, lines 1-{import_end}):\n```\n{import_text}\n```"
        )

    before_text = "\n".join(source_lines[ctx_start - 1:region_start - 1])
    after_text  = "\n".join(source_lines[region_end:ctx_end])

    if before_text.strip():
        pieces.append(
            f"CONTEXT BEFORE EDITABLE REGION (read-only, lines {ctx_start}-{region_start - 1}):\n```\n{before_text}\n```"
        )

    pieces.append(
        f"EDITABLE REGION (lines {region_start}-{region_end}):\n```\n{region_raw}\n```"
    )

    if after_text.strip():
        pieces.append(
            f"CONTEXT AFTER EDITABLE REGION (read-only, lines {region_end + 1}-{ctx_end}):\n```\n{after_text}\n```"
        )

    return "\n\n".join(pieces)


# ══════════════════════════════════════════════════════════════════════════════
# 3. Build prompts
# ══════════════════════════════════════════════════════════════════════════════

def build_prompt(
    context_text: str,
    vuln_type: str,
    region_start: int,
    region_end: int,
    vuln_lines: list[int],
    feedback: str | None = None,
) -> str:
    feedback_block = (
        f"\n━━━ PREVIOUS ATTEMPT REJECTED ━━━\n{feedback}\n"
        if feedback else ""
    )
    return f"""Vulnerability Type: {vuln_type}
Suspicious source line(s) — localization hint only, not the literal replace range: {vuln_lines}

{context_text}

The editable region is lines {region_start}-{region_end} (inclusive, 1-based, as shown above).
Return a COMPLETE replacement for exactly that region, including every unchanged line inside it.
{feedback_block}
Respond ONLY with a JSON object with exactly these fields:
{{
  "status": "fixed" or "needs_context",
  "replacement_code": "complete replacement for the entire editable region, or empty string if needs_context",
  "imports": ["each new import/require statement needed, else []"],
  "explanation": "one precise technical sentence"
}}"""


# ══════════════════════════════════════════════════════════════════════════════
# 4. Model calls
# ══════════════════════════════════════════════════════════════════════════════

def call_ollama_json(model_name: str, system_prompt: str, user_prompt: str) -> tuple[bool, str]:
    timeout = 360 if "7b" in model_name else 240
    print(f"  [RepairAgent] Trying {model_name} (timeout={timeout}s)...")
    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model"   : model_name,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user",   "content": user_prompt},
                ],
                "format" : "json",
                "options": {
                    "temperature" : 0.0,
                    "seed"        : 42,
                    "num_predict" : 2048,
                },
                "stream": False,
            },
            timeout=timeout,
        )
        response.raise_for_status()
        raw = response.json()["message"]["content"]
        if DEBUG_REPAIR_RESPONSES:
            print(f"  [DEBUG] {model_name} raw response ({len(raw)} chars):\n{raw}\n--- END ---")
        else:
            print(f"  [RepairAgent] {model_name} responded ({len(raw)} chars).")
        return True, raw
    except Exception as exc:
        print(f"  [RepairAgent] {model_name} call failed: {exc}")
        return False, ""


def call_gemini_json(system_prompt: str, user_prompt: str) -> tuple[bool, str]:
    # Defense in depth: even if this is somehow invoked directly (bypassing
    # _build_phases()), never make a network call unless cloud repair is
    # explicitly enabled AND a key is configured.
    if not ALLOW_CLOUD_REPAIR:
        print("  [RepairAgent] Gemini skipped — cloud fallback is disabled (ALLOW_CLOUD_REPAIR=false). No network request made.")
        return False, ""
    if not GEMINI_API_KEY:
        print("  [RepairAgent] Gemini skipped — GEMINI_API_KEY is not configured. No network request made.")
        return False, ""

    print("  [RepairAgent] Trying gemini-2.5-flash (last resort, cloud)...")
    try:
        payload = {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents"         : [{"role": "user", "parts": [{"text": user_prompt}]}],
            "generationConfig" : {
                "temperature"     : 0.0,
                "responseMimeType": "application/json",
            },
        }
        response = requests.post(
            f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
            json=payload,
            timeout=60,
        )
        response.raise_for_status()
        raw = response.json()["candidates"][0]["content"]["parts"][0]["text"]
        if DEBUG_REPAIR_RESPONSES:
            print(f"  [DEBUG][Gemini] raw response ({len(raw)} chars):\n{raw}\n--- END ---")
        else:
            print(f"  [RepairAgent] Gemini responded ({len(raw)} chars).")
        return True, raw
    except Exception as exc:
        print(f"  [RepairAgent] Gemini failed: {exc}")
        return False, ""


def _call_model(model_type: str, model_name: str, prompt: str) -> tuple[bool, str]:
    if model_type == "gemini":
        return call_gemini_json(REPAIR_SYSTEM_PROMPT, prompt)
    return call_ollama_json(model_name, REPAIR_SYSTEM_PROMPT, prompt)


# ══════════════════════════════════════════════════════════════════════════════
# 5. Strict JSON parsing
# ══════════════════════════════════════════════════════════════════════════════

_REQUIRED_FIELDS = {"status", "replacement_code", "imports", "explanation"}
_ALLOWED_STATUS  = {"fixed", "needs_context"}


def parse_response(raw: str) -> tuple[dict | None, str]:
    """
    Strict parse of the model's JSON response.
    Returns (parsed_dict, "") on success, or (None, error_message) on failure.
    Never falls back to regex extraction of malformed/truncated JSON.
    """
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        return None, f"Response was not valid JSON ({exc})."

    if not isinstance(data, dict):
        return None, "Response JSON must be an object."

    missing = _REQUIRED_FIELDS - data.keys()
    if missing:
        return None, f"Missing required field(s): {sorted(missing)}."

    extra = set(data.keys()) - _REQUIRED_FIELDS
    if extra:
        return None, f"Unexpected field(s) present: {sorted(extra)}. Only status, replacement_code, imports, explanation are allowed."

    status = data["status"]
    if status not in _ALLOWED_STATUS:
        return None, f"'status' must be exactly 'fixed' or 'needs_context', got {status!r}."

    if not isinstance(data["replacement_code"], str):
        return None, "'replacement_code' must be a string."

    if not isinstance(data["imports"], list) or not all(isinstance(i, str) for i in data["imports"]):
        return None, "'imports' must be a JSON array of strings."

    if not isinstance(data["explanation"], str) or not data["explanation"].strip():
        return None, "'explanation' must be a non-empty string."

    # Do NOT .strip() source code — only trim trailing newlines, per spec.
    replacement_code = data["replacement_code"].rstrip("\r\n")

    if status == "fixed" and not replacement_code.strip():
        return None, "status is 'fixed' but 'replacement_code' is empty."
    if status == "needs_context" and replacement_code.strip():
        return None, "status is 'needs_context' but 'replacement_code' is not empty — it must be empty."

    return {
        "status"          : status,
        "replacement_code": replacement_code,
        "imports"         : data["imports"],
        "explanation"     : data["explanation"].strip(),
    }, ""


# ══════════════════════════════════════════════════════════════════════════════
# 6. Apply region patch + deferred import handling
# ══════════════════════════════════════════════════════════════════════════════

def apply_region_patch(
    source_lines: list[str],
    region_start: int,
    region_end: int,
    replacement_code: str,
) -> list[str]:
    """Deterministically replace exactly [region_start, region_end] (1-based, inclusive)."""
    return (
        source_lines[:region_start - 1]
        + replacement_code.splitlines()
        + source_lines[region_end:]
    )


def _find_import_insertion_point(lines: list[str], ext: str) -> int:
    """Return the 0-based index to insert new import lines at."""
    idx = 0
    n = len(lines)

    if idx < n and lines[idx].startswith("#!"):
        idx += 1

    if ext == "py" and idx < n:
        stripped = lines[idx].strip()
        if stripped.startswith(('"""', "'''")):
            quote = stripped[:3]
            if len(stripped) > 3 and stripped.count(quote) >= 2:
                idx += 1
            else:
                idx += 1
                while idx < n and quote not in lines[idx]:
                    idx += 1
                if idx < n:
                    idx += 1

    if ext in _JS_LIKE and idx < n and lines[idx].strip() in ('"use strict";', "'use strict';"):
        idx += 1

    pattern = IMPORT_LINE_PATTERNS.get(ext)
    if pattern:
        last_import = idx - 1
        j = idx
        blank_run = 0
        while j < n:
            line = lines[j]
            if pattern.match(line):
                last_import = j
                blank_run = 0
            elif line.strip() == "":
                blank_run += 1
                if blank_run > 1:
                    break
            elif line.strip().startswith(("#", "//", "/*", "*")):
                pass
            else:
                break
            j += 1
        if last_import >= idx:
            return last_import + 1

    return idx


def deduplicate_imports(imports: list[str], existing_text: str = "") -> list[str]:
    """
    Order-preserving deduplication of import/require statements. Drops blank
    entries, exact duplicates, and anything already present verbatim in
    `existing_text` (when given).
    """
    seen: list[str] = []
    for imp in imports:
        imp = imp.strip()
        if not imp or imp in seen:
            continue
        if existing_text and imp in existing_text:
            continue
        seen.append(imp)
    return seen


def insert_imports(lines: list[str], imports: list[str], filename: str) -> list[str]:
    """
    Insert new, non-duplicate imports once, after shebang/docstring/use-strict/
    existing import block.

    IMPORTANT: this performs the actual insertion. Callers in the bottom-to-top
    repair loop must NOT call this per-finding against the persistent working
    source — doing so would shift every line number above the import section
    for findings not yet processed. Imports are collected into a
    `pending_imports` list during the loop and this function is called only
    ONCE, after every region patch has already been applied (see repair_all).
    A temporary candidate that includes imports may still be built ad hoc for
    syntax validation purposes without calling this on the persistent state.
    """
    new_imports = deduplicate_imports(imports, "\n".join(lines))
    if not new_imports:
        return lines

    ext = _ext(filename)
    insert_at = _find_import_insertion_point(lines, ext)
    return lines[:insert_at] + new_imports + lines[insert_at:]


# ══════════════════════════════════════════════════════════════════════════════
# 7. Syntax validation — cross-platform, validator resolution shared with /health
# ══════════════════════════════════════════════════════════════════════════════

def _resolve_validator(ext: str) -> list[str] | None:
    """
    Return the exact command template to use for syntax-checking a file of
    this extension, or None if no suitable validator exists on this host.
    This is the SINGLE source of truth for "is a validator available" — both
    validate_syntax() and validator_availability() (used by /health) call
    this, so they can never disagree about which executable is in use.
    """
    if ext == "py":
        # Always available: this is the same interpreter running this process,
        # so it works identically on Windows, Linux, and macOS.
        return [sys.executable, "-m", "py_compile", "{file}"]

    if ext == "js":
        if shutil.which("node"):
            return ["node", "--check", "{file}"]
        return None

    if ext == "jsx":
        # `node --check` is NOT JSX-aware and will reject valid JSX syntax —
        # never use it here. Prefer esbuild; tsc with --allowJs --jsx react
        # also parses .jsx correctly and is a reasonable fallback.
        if shutil.which("esbuild"):
            return ["esbuild", "--loader=jsx", "{file}", f"--outfile={os.devnull}"]
        if shutil.which("tsc"):
            return ["tsc", "--noEmit", "--skipLibCheck", "--allowJs",
                    "--target", "esnext", "--module", "esnext", "--jsx", "react", "{file}"]
        return None

    if ext in ("ts", "tsx"):
        # `node --check` is NOT TypeScript-aware — never use it here either.
        if shutil.which("tsc"):
            jsx_flags = ["--jsx", "react"] if ext == "tsx" else []
            # --noEmit + explicit, minimal flags so an isolated temp file is
            # checked on its own terms rather than against an unrelated
            # project-wide tsconfig.json that might be found by directory walk.
            # NOTE: deliberately NOT passing --moduleResolution — in some tsc
            # versions "node" is a deprecated value that itself raises an
            # error (TS5107), which would falsely fail perfectly valid code.
            return [
                "tsc", "--noEmit", "--skipLibCheck", "--allowJs",
                "--target", "esnext", "--module", "esnext",
                *jsx_flags, "{file}",
            ]
        if shutil.which("esbuild"):
            loader = "tsx" if ext == "tsx" else "ts"
            return ["esbuild", f"--loader={loader}", "{file}", f"--outfile={os.devnull}"]
        return None

    if ext == "php":
        return ["php", "-l", "{file}"] if shutil.which("php") else None

    if ext == "rb":
        return ["ruby", "-c", "{file}"] if shutil.which("ruby") else None

    return None


_UNAVAILABLE_MESSAGES = {
    "jsx": "No JSX-aware syntax validator (esbuild or tsc) is installed on this host; `node --check` is not JSX-aware and was deliberately not used.",
    "ts" : "No TypeScript-aware syntax validator (tsc/esbuild) is installed on this host; `node --check` is not TypeScript-aware and was deliberately not used.",
    "tsx": "No TypeScript-aware syntax validator (tsc/esbuild) is installed on this host; `node --check` is not TypeScript-aware and was deliberately not used.",
}


def validate_syntax(code: str, filename: str) -> tuple[bool, str, bool]:
    """
    Returns (passed, message, validator_available).

    - validator_available=False means NO real check was performed — this is
      never treated as a pass by callers' acceptance logic, and never treated
      as a failure either: a missing validator is not a syntax error.
    - A subprocess exception (validator crashed) or a timeout is reported
      distinctly from an actual syntax error, and also yields
      validator_available=False (since we cannot trust the result either way).
    """
    ext = _ext(filename)
    cmd_template = _resolve_validator(ext)

    if cmd_template is None:
        msg = _UNAVAILABLE_MESSAGES.get(ext, f"No syntax validator available on this host for .{ext} files.")
        return True, msg, False

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=f".{ext}", delete=False, encoding="utf-8"
        ) as tmp:
            tmp.write(code)
            tmp_path = tmp.name

        cmd = [part.format(file=tmp_path) for part in cmd_template]

        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=20,
                cwd=os.path.dirname(tmp_path) or None,
            )
        except subprocess.TimeoutExpired:
            return True, f"Syntax validator timed out after 20s; treated as unavailable for this check.", False
        except FileNotFoundError as exc:
            return True, f"Syntax validator executable not found ({exc}); treated as unavailable.", False

        if result.returncode == 0:
            return True, "", True

        msg = (result.stderr or result.stdout or "syntax error").strip()

        if ext in ("ts", "tsx", "jsx") and cmd[0].endswith("tsc"):
            # tsc --noEmit conflates parsing with full type-checking. Only
            # TS1xxx codes are genuine parser/syntax diagnostics; anything
            # else (TS2xxx type errors, TS7xxx implicit-any, missing
            # React/JSX type defs, etc.) is a semantic complaint caused by
            # checking an isolated file with no project type context, and
            # must NOT be reported as a syntax failure.
            if not re.search(r'error TS1\d{3}:', msg):
                return True, (
                    f"tsc reported only semantic/type diagnostics (no TS1xxx syntax errors) for this "
                    f"isolated file; treated as a syntax pass: {msg[:300]}"
                ), True

        return False, msg[:500], True
    except Exception as exc:
        return True, f"Syntax validator raised an unexpected error and was treated as unavailable: {exc}", False
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass
            pyc_dir = os.path.join(os.path.dirname(tmp_path), "__pycache__")
            if ext == "py" and os.path.isdir(pyc_dir):
                shutil.rmtree(pyc_dir, ignore_errors=True)


def validator_availability() -> dict:
    """
    Used by GET /health. Calls the exact same _resolve_validator() function
    that validate_syntax() uses, so availability reporting can never drift
    from actual validation behavior (e.g. Python always reports using
    sys.executable, never a hardcoded "python3"/"python" guess).
    """
    return {
        "python"    : _resolve_validator("py") is not None,
        "javascript": _resolve_validator("js") is not None,
        "jsx"       : _resolve_validator("jsx") is not None,
        "typescript": _resolve_validator("ts") is not None,
        "tsx"       : _resolve_validator("tsx") is not None,
        "php"       : _resolve_validator("php") is not None,
        "ruby"      : _resolve_validator("rb") is not None,
    }


# ══════════════════════════════════════════════════════════════════════════════
# 8. Vulnerability-specific security validation
# ══════════════════════════════════════════════════════════════════════════════

def _validate_general(original_region: str, replacement: str) -> tuple[bool, str]:
    if replacement.strip() == original_region.strip():
        return False, "The replacement is identical to the original vulnerable region."

    if re.search(r'\bTODO\b|\bFIXME\b|<insert|<your[\s_-]*code|\.\.\.\s*$', replacement, re.IGNORECASE | re.MULTILINE):
        return False, "The replacement contains a placeholder, TODO, or pseudocode."

    nonblank = [l.strip() for l in replacement.splitlines() if l.strip()]
    if nonblank:
        counts = Counter(nonblank)
        dup = next((line for line, c in counts.items() if c > 2 and len(line) > 20), None)
        if dup:
            return False, f"A statement appears to be duplicated in the replacement: {dup[:80]!r}"

    return True, ""


def _validate_sql_injection(replacement: str) -> tuple[bool, str]:
    has_sql_keyword = re.search(r'\b(SELECT|INSERT|UPDATE|DELETE)\b', replacement, re.IGNORECASE)
    if has_sql_keyword:
        concatenated = (
            re.search(r'["\'].{0,200}\b(SELECT|INSERT|UPDATE|DELETE)\b.{0,200}["\']\s*\+', replacement, re.IGNORECASE)
            or re.search(r'\+\s*["\'].{0,200}\b(SELECT|INSERT|UPDATE|DELETE)\b', replacement, re.IGNORECASE)
            or re.search(r'f["\'].{0,200}\{[^}]+\}.{0,200}\b(SELECT|INSERT|UPDATE|DELETE)\b', replacement, re.IGNORECASE)
            or re.search(r'%\s*\(.*?\)\s*%\s*["\']|["\']\s*%\s*\w+\s*$', replacement)
        )
        if concatenated:
            return False, "The SQL query text still appears to concatenate or interpolate a value directly into SQL."

    placeholder = re.search(r'(\?|%s|:[a-zA-Z_]\w*)', replacement)
    exec_calls   = re.findall(r'(?:\.execute|executeQuery|\.query)\s*\(([^)]*)\)', replacement)
    if placeholder and exec_calls and all(',' not in c for c in exec_calls):
        return False, "A parameter placeholder was added but the execute()/query() call was not updated with bound arguments."

    return True, ""


def _validate_path_traversal(original_region: str, replacement: str) -> tuple[bool, str]:
    has_resolve = re.search(
        r'path\.resolve|path\.normalize|os\.path\.(abspath|realpath|normpath)|Paths\.get\([^)]*\)\.normalize|realpath\(',
        replacement,
    )
    if not has_resolve:
        return False, "No path normalization/resolution call (e.g. path.resolve, os.path.realpath) found in the replacement."

    has_containment = re.search(r'path\.relative\s*\(|os\.path\.commonpath|\.startsWith\s*\(', replacement)
    if not has_containment:
        return False, "No base-directory containment validation found in the replacement."

    naive_prefix = re.search(r'\.startsWith\s*\(\s*[A-Za-z_][\w.]*\s*\)', replacement)
    if naive_prefix and "path.relative(" not in replacement and "os.path.commonpath" not in replacement:
        return False, "Containment check relies on a naive string prefix match (startsWith), which can be bypassed by a sibling directory sharing the same prefix."

    m = re.search(r'(?:const|let|var)\s+(\w+)\s*=\s*path\.resolve', replacement)
    if m:
        resolved_var = m.group(1)
        sink_pattern = r'(?:existsSync|readFile|readFileSync|createReadStream|download|sendFile)\s*\(\s*(\w+)'
        orig_sink_vars = set(re.findall(sink_pattern, original_region))
        for var in orig_sink_vars:
            if var != resolved_var and re.search(rf'(?:existsSync|readFile|readFileSync|createReadStream|download|sendFile)\s*\(\s*{re.escape(var)}\b', replacement):
                return False, f"'{var}' is still used in a file operation after '{resolved_var}' was introduced as the validated path."

    return True, ""


# ── Insecure Cryptography ───────────────────────────────────────────────────

_CRYPTO_SOURCE_RE = re.compile(r"""require\(\s*['"]crypto['"]\s*\)|from\s+['"]crypto['"]""")


def _crypto_import_lines(text: str) -> list[str]:
    return [line for line in text.splitlines() if _CRYPTO_SOURCE_RE.search(line)]


def _has_crypto_module_import(text: str) -> bool:
    """True if `text` imports Node's crypto module in ANY form (default, namespace, or destructured)."""
    return len(_crypto_import_lines(text)) > 0


def _has_named_crypto_import(name: str, text: str) -> bool:
    """True if `text` destructures `name` specifically from Node's crypto module."""
    for line in _crypto_import_lines(text):
        m = re.search(r'\{([^}]*)\}', line)
        if m and name in [n.strip() for n in m.group(1).split(',')]:
            return True
    return False


def _validate_crypto(replacement: str, imports: list[str], full_context: str) -> tuple[bool, str]:
    if re.search(r'Math\.random\s*\(', replacement):
        return False, "Math.random() is still present in the repaired security-sensitive region."

    if re.search(r'\bmd5\s*\(|\bsha1\s*\(|\bMD5\b|\bSHA-?1\b|\bDES\b|\bRC4\b|\bECB\b', replacement, re.IGNORECASE):
        return False, "A weak cryptographic primitive (MD5/SHA-1/DES/RC4/ECB) is still present."

    qualified_match = re.search(r'\bcrypto\.(randomBytes|randomUUID)\s*\(', replacement)
    bare_match      = re.search(r'(?<![.\w])(randomBytes|randomUUID)\s*\(', replacement)
    py_secrets      = re.search(r'\bsecrets\.\w+\s*\(', replacement)
    py_urandom      = re.search(r'\bos\.urandom\s*\(', replacement)
    java_secure     = re.search(r'\bSecureRandom\b', replacement)

    if not (qualified_match or bare_match or py_secrets or py_urandom or java_secure):
        return False, "No cryptographically secure replacement (e.g. crypto.randomBytes, Python secrets module, SecureRandom) was found."

    imports_text = "\n".join(imports)

    if qualified_match:
        # A qualified `crypto.xxx(...)` call needs *some* import of the
        # crypto module (default, namespace, or destructured all work, since
        # any of them puts a usable `crypto.randomBytes`-style binding in
        # scope in practice for this codebase's conventions).
        if not (_has_crypto_module_import(imports_text) or _has_crypto_module_import(full_context)):
            return False, "crypto.randomBytes/randomUUID is used but no import of the Node.js 'crypto' module is visible in the repair's imports or the existing source context."
    elif bare_match:
        # A bare call specifically needs a destructured import of THAT name.
        fn_name = bare_match.group(1)
        if not (_has_named_crypto_import(fn_name, imports_text) or _has_named_crypto_import(fn_name, full_context)):
            return False, (
                f"{fn_name}(...) is called without a 'crypto.' prefix, but no matching "
                f"`const {{ {fn_name} }} = require('crypto')` / `import {{ {fn_name} }} from 'crypto'` "
                f"is visible in the repair's imports or the existing source context."
            )

    return True, ""


# ── CSRF ─────────────────────────────────────────────────────────────────────

_ASSIGN_FROM_REQUEST = re.compile(r'(?:const|let|var)\s+(\w+)\s*=\s*req\.(headers|body|query|params|cookies)\b')
_COMPARISON_RE = re.compile(
    r'([A-Za-z_][\w.\[\]\'"]*(?:\([^)]*\))?)\s*(===|!==|==|!=)\s*([A-Za-z_][\w.\[\]\'"]*(?:\([^)]*\))?)'
)
_TRUSTED_MIDDLEWARE_RE = re.compile(r'\bcsurf\b|csrfProtection|CsrfProtect|verifyCsrfToken|validateCsrfToken|doubleCsrf')
_ALLOWLIST_RE = re.compile(r'ALLOWED_ORIGINS|TRUSTED_ORIGINS|allowlist|allowedOrigins', re.IGNORECASE)
_TOKEN_STORE_RE = re.compile(r'\btokenStore\b|csrfTokens\.verify|csrfTokens\.create|\btokenCache\b')


def _request_controlled_vars(text: str) -> set[str]:
    return {m.group(1) for m in _ASSIGN_FROM_REQUEST.finditer(text)}


def _expr_is_request_controlled(expr: str, controlled_vars: set[str]) -> bool:
    expr = expr.strip()
    if re.match(r'^req\.(headers|body|query|params|cookies)\b', expr):
        return True
    ident_match = re.match(r'^([A-Za-z_]\w*)', expr)
    return bool(ident_match and ident_match.group(1) in controlled_vars)


def _find_csrf_comparisons(text: str) -> list[tuple[str, str]]:
    out = []
    for m in _COMPARISON_RE.finditer(text):
        a, b = m.group(1), m.group(3)
        if "csrf" in a.lower() or "csrf" in b.lower():
            out.append((a, b))
    return out


def _validate_csrf(replacement: str, full_context: str) -> tuple[bool, str]:
    # 1. Presence-only check — no comparison operator anywhere near a csrf check.
    presence_only = re.search(r'if\s*\(\s*!\s*\w*[Cc]srf\w*\s*\)', replacement) and not re.search(
        r'===|!==|==|!=|compareSync|timingSafeEqual|\.equals\(', replacement
    )
    if presence_only:
        return False, "The patch only checks for CSRF token presence without comparing it against a trusted server-side value."

    # 2. A comparison naming "csrf" exists — reject request-vs-request and self-comparisons.
    controlled_vars = _request_controlled_vars(replacement)
    for a, b in _find_csrf_comparisons(replacement):
        a_controlled = _expr_is_request_controlled(a, controlled_vars)
        b_controlled = _expr_is_request_controlled(b, controlled_vars)
        if a_controlled and b_controlled:
            return False, (
                f"The CSRF check compares two attacker-controlled request values "
                f"({a.strip()} vs {b.strip()}) instead of a trusted server-side value — "
                f"this is not a valid CSRF defense."
            )
        if a.strip() == b.strip():
            return False, f"The CSRF check compares a value against itself ({a.strip()}), which always 'passes' and validates nothing."

    # 3. Invented session field used for CSRF.
    session_field_match = re.search(r'req\.session\.(\w*[Cc]srf\w*)', replacement)
    if session_field_match and session_field_match.group(0) not in full_context:
        return False, f"The patch relies on '{session_field_match.group(0)}', a session field that is not visible/initialized anywhere in the supplied context."

    # 4. Forwarding the token to an upstream/payment gateway.
    if re.search(r'(payment|gateway|upstream)\w*.{0,80}[Cc]srf', replacement) or re.search(r'[Cc]srf\w*.{0,80}(payment|gateway|upstream)', replacement):
        return False, "The browser's CSRF token appears to be forwarded to an unrelated upstream/payment gateway, which is not a valid fix."

    # 5. Origin/Referer checked only for presence, with no allowlist comparison.
    origin_presence_only = re.search(
        r'if\s*\(\s*!\s*req\.(headers\.origin|headers\.referer|get\([\'"]origin[\'"]\))',
        replacement, re.IGNORECASE,
    ) and not _ALLOWLIST_RE.search(replacement)
    if origin_presence_only:
        return False, "The patch only checks whether Origin/Referer is present, without comparing it against a trusted allowlist."

    # 6. A hardcoded single origin not present anywhere in the original context.
    hardcoded_origin = re.search(r'(origin|referer)\s*(===|==)\s*[\'"]https?://[^\'"]+[\'"]', replacement, re.IGNORECASE)
    if hardcoded_origin:
        literals = re.findall(r'https?://[^\'" ]+', hardcoded_origin.group(0))
        if literals and not any(lit in full_context for lit in literals):
            return False, "The patch hardcodes a single trusted origin that is not present anywhere in the original context or configuration."

    # 7. A trusted mechanism must be IDENTIFIABLE and itself visible in context
    #    (not merely typed by the model into the patch).
    middleware_match = _TRUSTED_MIDDLEWARE_RE.search(replacement)
    has_middleware = bool(middleware_match) and middleware_match.group(0) in full_context

    has_trusted_session = bool(session_field_match) and session_field_match.group(0) in full_context

    has_allowlist = bool(_ALLOWLIST_RE.search(replacement)) and bool(_ALLOWLIST_RE.search(full_context))

    token_store_match = _TOKEN_STORE_RE.search(replacement)
    has_token_store = bool(token_store_match) and bool(_TOKEN_STORE_RE.search(full_context))

    if not (has_middleware or has_trusted_session or has_allowlist or has_token_store):
        return False, (
            "No identifiable trusted server-side CSRF mechanism (middleware, pre-existing session/token "
            "store, or origin allowlist visible in the original context) was found in the replacement."
        )

    return True, ""


def _validate_xss(replacement: str, full_context: str) -> tuple[bool, str]:
    unsafe_sink = re.search(r'\.innerHTML\s*=\s*(?![\'"`])', replacement) or re.search(
        r'document\.write\s*\(\s*(?![\'"`])', replacement
    )
    if unsafe_sink:
        sanitizer = re.search(r'(DOMPurify|sanitizeHtml|sanitize-html|escapeHtml|encodeHTML)\s*\(', replacement)
        if not sanitizer:
            return False, "innerHTML/document.write is still assigned a non-literal value without a visible trusted sanitizer."
        if sanitizer.group(1) not in full_context:
            return False, f"References sanitizer '{sanitizer.group(1)}' that is not visible/imported in the supplied context."

    return True, ""


def _validate_os_command_injection(replacement: str) -> tuple[bool, str]:
    if re.search(r'shell\s*=\s*True', replacement):
        return False, "shell=True is still present, which allows shell metacharacter injection."

    if re.search(r'os\.system\s*\(|popen\s*\(', replacement):
        return False, "A shell-string execution call (os.system/popen) is still present."

    return True, ""


def _validate_deserialization(replacement: str) -> tuple[bool, str]:
    if re.search(r'\beval\s*\(|\bpickle\.loads\s*\(', replacement):
        return False, "An unsafe deserialization call (eval/pickle.loads) is still present."

    if re.search(r'yaml\.load\s*\(', replacement) and "Loader=" not in replacement and "safe_load" not in replacement:
        return False, "yaml.load() is used without a safe Loader (use yaml.safe_load instead)."

    return True, ""


def _validate_xxe(replacement: str) -> tuple[bool, str]:
    has_disable = re.search(
        r'DtdProcessing\.Prohibit|XmlResolver\s*=\s*null|resolve_entities\s*=\s*False|disableExternal|'
        r'defusedxml|FEATURE_SECURE_PROCESSING|setFeature\([^)]*external-general-entities[^)]*false',
        replacement,
        re.IGNORECASE,
    )
    if not has_disable:
        return False, "No DTD/external-entity-disabling configuration was found in the replacement."

    return True, ""


_FAMILY_VALIDATORS = {
    "SQL Injection"           : "_sql",
    "Path Traversal"          : "_path",
    "Insecure Cryptography"   : "_crypto",
    "CSRF"                    : "_csrf",
    "XSS"                     : "_xss",
    "OS Command Injection"    : "_cmdi",
    "Insecure Deserialization": "_deser",
    "XML Injection"           : "_xxe",
}


def validate_security_fix(
    label: str,
    original_region: str,
    replacement_code: str,
    imports: list[str],
    full_context: str,
) -> tuple[bool, str]:
    """
    Deterministic, family-specific acceptance check. Does not prove full
    program security — it catches obvious incomplete/fake repairs.
    """
    ok, msg = _validate_general(original_region, replacement_code)
    if not ok:
        return False, msg

    kind = _FAMILY_VALIDATORS.get(label)
    if kind == "_sql":
        return _validate_sql_injection(replacement_code)
    if kind == "_path":
        return _validate_path_traversal(original_region, replacement_code)
    if kind == "_crypto":
        return _validate_crypto(replacement_code, imports, full_context)
    if kind == "_csrf":
        return _validate_csrf(replacement_code, full_context)
    if kind == "_xss":
        return _validate_xss(replacement_code, full_context)
    if kind == "_cmdi":
        return _validate_os_command_injection(replacement_code)
    if kind == "_deser":
        return _validate_deserialization(replacement_code)
    if kind == "_xxe":
        return _validate_xxe(replacement_code)

    return True, ""


# ══════════════════════════════════════════════════════════════════════════════
# 9. repair_one / repair_all
# ══════════════════════════════════════════════════════════════════════════════

def _build_phases() -> list[tuple[dict, int]]:
    """(model_config, max_attempts_for_this_model) in priority order."""
    phases = []
    for m in REPAIR_MODELS:
        model_type = m.get("type", "ollama")
        if model_type == "gemini":
            if ALLOW_CLOUD_REPAIR and GEMINI_API_KEY:
                phases.append((m, 1))
            continue
        phases.append((m, 2))
    return phases


def _empty_repair_result(
    success: bool,
    status: str,
    explanation: str,
    error: str,
    model_used: str,
    elapsed: float,
    region_start: int,
    region_end: int,
    region_strategy: str = "padded_fallback",
    validation_error: str = "",
    syntax_available: bool = False,
) -> dict:
    return {
        "success"                    : success,
        "status"                     : status,
        "repaired_code"              : "",
        "imports"                    : [],
        "explanation"                : explanation,
        "model_used"                 : model_used,
        "elapsed_seconds"            : elapsed,
        "error"                      : error,
        "region_start"               : region_start,
        "region_end"                 : region_end,
        "region_strategy"            : region_strategy,
        "validation_passed"          : False,
        "validation_error"           : validation_error,
        "syntax_validation_available": syntax_available,
    }


def _mark_failed(result: dict, reason: str) -> None:
    result["success"]           = False
    result["status"]            = "failed"
    result["validation_passed"] = False
    result["validation_error"]  = reason
    result["error"]              = reason


def _normalized_vuln_lines(vuln: dict, n: int) -> list[int]:
    vuln_lines = vuln.get("vuln_lines") or list(
        range(vuln.get("start_line", 1), vuln.get("end_line", vuln.get("start_line", 1)) + 1)
    )
    vuln_lines = [l for l in vuln_lines if 1 <= l <= n]
    if not vuln_lines:
        vuln_lines = [min(max(1, vuln.get("start_line", 1)), max(n, 1))]
    return vuln_lines


def repair_one(vuln: dict, source_lines: list[str], filename: str) -> dict:
    """Repair a SINGLE vulnerability against the CURRENT working source_lines. Called individually and sequentially for every finding — never combined with another finding's request."""
    label = vuln.get("label", "Unknown")
    n = len(source_lines)
    vuln_lines = _normalized_vuln_lines(vuln, n)

    region_start, region_end, region_strategy = locate_editable_region(source_lines, filename, vuln_lines)
    original_region_text = "\n".join(source_lines[region_start - 1:region_end])
    context_text = build_repair_context(source_lines, filename, region_start, region_end, vuln_lines)

    start_time = time.time()
    needs_context_explanation: str | None = None
    last_model_tried = "none"

    for model_config, max_attempts in _build_phases():
        model_name = model_config["name"]
        model_type = model_config.get("type", "ollama")
        feedback: str | None = None
        phase_had_needs_context = False

        for _attempt in range(max_attempts):
            last_model_tried = model_name
            prompt = build_prompt(context_text, label, region_start, region_end, vuln_lines, feedback)

            ok, raw = _call_model(model_type, model_name, prompt)
            if not ok:
                feedback = "Your previous response could not be retrieved. Return ONLY the required JSON object."
                continue

            parsed, perr = parse_response(raw)
            if parsed is None:
                feedback = (
                    f"Your previous response was rejected because: {perr} "
                    f"Return ONLY a JSON object with exactly the fields status, replacement_code, imports, explanation."
                )
                continue

            if parsed["status"] == "needs_context":
                needs_context_explanation = parsed["explanation"]
                phase_had_needs_context = True
                break  # no retry for needs_context — move to next model phase

            candidate_lines = apply_region_patch(source_lines, region_start, region_end, parsed["replacement_code"])
            candidate_lines = insert_imports(candidate_lines, parsed["imports"], filename)
            candidate_code  = "\n".join(candidate_lines)

            syntax_ok, syntax_msg, syntax_available = validate_syntax(candidate_code, filename)
            if syntax_available and not syntax_ok:
                feedback = (
                    f"Your previous patch was rejected because the file failed syntax validation: {syntax_msg} "
                    f"Return a corrected complete replacement for the same editable region (lines {region_start}-{region_end})."
                )
                continue

            sec_ok, sec_msg = validate_security_fix(
                label, original_region_text, parsed["replacement_code"], parsed["imports"], context_text
            )
            if not sec_ok:
                feedback = (
                    f"Your previous patch was rejected because: {sec_msg} "
                    f"Return a corrected complete replacement for the same editable region (lines {region_start}-{region_end})."
                )
                continue

            return {
                "success"                    : True,
                "status"                     : "fixed",
                "repaired_code"              : parsed["replacement_code"],
                "imports"                    : parsed["imports"],
                "explanation"                : parsed["explanation"],
                "model_used"                 : model_name,
                "elapsed_seconds"            : round(time.time() - start_time, 2),
                "error"                      : "",
                "region_start"               : region_start,
                "region_end"                 : region_end,
                "region_strategy"            : region_strategy,
                "validation_passed"          : True,
                "validation_error"           : "",
                "syntax_validation_available": syntax_available,
            }

        if phase_had_needs_context:
            continue  # try next model before settling on needs_context

    if label == "CSRF" and needs_context_explanation is None:
        needs_context_explanation = (
            "No trusted server-side CSRF validation source (token store, middleware, "
            "or origin allowlist) is visible in the supplied context."
        )

    elapsed = round(time.time() - start_time, 2)
    if needs_context_explanation:
        return _empty_repair_result(
            success=False, status="needs_context", explanation=needs_context_explanation,
            error=needs_context_explanation, model_used=last_model_tried, elapsed=elapsed,
            region_start=region_start, region_end=region_end, region_strategy=region_strategy,
            validation_error=needs_context_explanation,
        )

    return _empty_repair_result(
        success=False, status="failed", explanation="",
        error="All configured repair models failed validation for this vulnerability.",
        model_used=last_model_tried, elapsed=elapsed,
        region_start=region_start, region_end=region_end, region_strategy=region_strategy,
        validation_error="All configured repair models failed validation.",
    )


def _normalize_for_membership(text: str) -> str:
    return re.sub(r'\s+', ' ', text).strip()


# ── Stale-anchor re-localization (sequential, single-vulnerability repairs) ──
#
# Every finding is repaired individually, strictly one at a time. When two
# findings share the same enclosing function/region, the FIRST one's patch
# can add or remove lines inside that region — which means the SECOND
# finding's original (scan-time) start_line/end_line/vuln_lines may now
# point at a different statement by the time its own repair_one() call runs.
#
# _capture_finding_anchors() snapshots, once, against the PRISTINE source
# (before any patch is applied): each finding's exact vuln_lines text (the
# "fingerprint") and its original enclosing region (used only to bound the
# re-localization SEARCH WINDOW later — never to combine or group repairs).
#
# _relocate_vuln_lines() is then called immediately before every single
# repair_one() call. For each vuln_line it first checks whether the SAME
# line in the CURRENT working_lines still holds the identical (whitespace-
# normalized) text — the common case for findings with no sibling in their
# region, including the very first finding processed, where nothing has
# changed yet. Only when that fast check fails does it search nearby, scoped
# strictly to [original_region_start - pad, original_region_end + pad], so a
# coincidentally identical line elsewhere in a large file can never be
# mistaken for it. Exactly one match = confident relocation. Zero or more
# than one match = not confident, and the caller must NOT patch an unrelated
# line — it reports needs_context/failed instead.

_RELOCATION_SEARCH_PAD = 15  # lines of slack on each side of the original region


def _capture_finding_anchors(vulnerabilities: list[dict], source_lines: list[str], filename: str) -> list[dict]:
    """One-time, read-only snapshot per finding against the pristine source."""
    n = len(source_lines)
    anchors = []
    for v in vulnerabilities:
        vuln_lines = _normalized_vuln_lines(v, n)
        region_start, region_end, _ = locate_editable_region(source_lines, filename, vuln_lines)
        anchors.append({
            "vuln_lines": vuln_lines,
            "line_text": [source_lines[l - 1] for l in vuln_lines],
            "region": (region_start, region_end),
        })
    return anchors


def _relocate_vuln_lines(
    anchor: dict, working_lines: list[str], pad: int = _RELOCATION_SEARCH_PAD
) -> tuple[list[int] | None, str | None]:
    """
    Re-locate every line in `anchor` inside the CURRENT working_lines.
    Returns (relocated_vuln_lines, None) on confident success, or
    (None, reason) if any single line could not be confidently re-located.
    """
    n = len(working_lines)
    region_start, region_end = anchor["region"]
    lo = max(1, region_start - pad)
    hi = min(n, region_end + pad)

    relocated: list[int] = []
    for orig_line, text in zip(anchor["vuln_lines"], anchor["line_text"]):
        target = _normalize_for_membership(text)
        if not target:
            return None, f"the original statement at line {orig_line} was blank; cannot safely re-localize it"

        # Fast path: this line hasn't moved.
        if 1 <= orig_line <= n and _normalize_for_membership(working_lines[orig_line - 1]) == target:
            relocated.append(orig_line)
            continue

        # Anchor has shifted — search nearby, scoped to the original region (+pad).
        matches = [
            ln for ln in range(lo, hi + 1)
            if _normalize_for_membership(working_lines[ln - 1]) == target
        ]
        if len(matches) != 1:
            kind = "no matching statement was found" if not matches else f"{len(matches)} ambiguous matches were found"
            return None, (
                f"the original statement that was at line {orig_line} could not be confidently re-located "
                f"({kind} within lines {lo}-{hi} after an earlier repair changed this shared region)"
            )
        relocated.append(matches[0])

    return relocated, None


def _has_committed_overlapping_sibling(
    i: int, anchors: list[dict], order: list[int], results: dict[int, dict]
) -> bool:
    """
    True if some OTHER finding, whose ORIGINAL editable region (computed
    upfront against the pristine source) overlaps finding i's, was processed
    AFTER i and also succeeded. That means i's own committed patch may have
    been legitimately folded into / superseded by that later, broader fix to
    the same shared region — not silently clobbered by a bug.
    """
    region_i = anchors[i]["region"]
    pos_i = order.index(i)
    for j in order[pos_i + 1:]:
        if not results.get(j, {}).get("success"):
            continue
        region_j = anchors[j]["region"]
        if max(region_i[0], region_j[0]) <= min(region_i[1], region_j[1]):
            return True
    return False


def _verify_repair_integrity(
    results: dict[int, dict],
    repaired_file_content: str,
    anchors: list[dict] | None = None,
    order: list[int] | None = None,
) -> None:
    """
    Final integrity check: confirm every finding marked success=True is
    actually present (modulo whitespace) in the returned file. Catches
    anything an earlier stage's in-memory success flag could miss — e.g.
    import insertion silently clobbering it.

    EXCEPTION: a finding whose ORIGINAL region overlapped a later-processed,
    also-successful finding is not flagged here even if its own snapshot text
    is no longer found verbatim — that later fix necessarily rewrote the same
    shared region (and was required to preserve this fix exactly), so this is
    expected supersession, not clobbering. `anchors`/`order` are optional so
    this function still works standalone; omit them to get the strict
    (pre-relocation) behavior.
    """
    normalized_file = _normalize_for_membership(repaired_file_content)
    for i, result in results.items():
        if not result["success"]:
            continue
        code = result.get("repaired_code", "")
        if not code.strip():
            continue
        if _normalize_for_membership(code) in normalized_file:
            continue
        if anchors is not None and order is not None and _has_committed_overlapping_sibling(i, anchors, order, results):
            continue
        _mark_failed(
            result,
            "Integrity check failed: this repair's replacement code could not be located in the final "
            "returned file (it may have been overwritten by another patch or import insertion).",
        )


def repair_all(
    vulnerabilities: list[dict],
    original_code: str,
    filename: str = "uploaded_file",
) -> tuple[list[dict], str]:
    """
    Repair every detected vulnerability and return (findings_raw, repaired_file_content).

    Pipeline:
      1. Every vulnerability is repaired individually, with its own dedicated
         model request — never grouped or combined with any other finding,
         even when two findings share the same enclosing function/region.
         This keeps every request small and avoids the timeouts that
         combined ("Policy A") requests used to trigger.
      2. Findings are processed bottom-to-top by start_line, so findings still
         to come (smaller line numbers) always see accurate, up-to-date line
         numbers in `working_lines` — already-applied patches are always
         strictly below not-yet-processed findings.
      3. Before EVERY repair_one() call, the finding's original vuln_lines are
         re-verified against the CURRENT working_lines (see
         _capture_finding_anchors/_relocate_vuln_lines). This catches the case
         where an earlier sibling finding in the SAME region added or removed
         lines, shifting this finding's statement to a new line number. Only a
         TEMPORARY copy of the finding (used solely for this repair_one call)
         carries the relocated vuln_lines/start_line/end_line — the original
         finding dict, and therefore the start_line/end_line/vuln_lines
         returned to the frontend for chunk display, are never modified. If
         the statement cannot be confidently re-located, this finding is
         reported as needs_context/failed instead of risking a patch against
         an unrelated line.
      4. Each accepted patch is committed to `working_lines` immediately,
         before the next finding is processed. Its IMPORTS are deferred into
         `pending_imports` and inserted only ONCE, after every patch has been
         applied — so import insertion never shifts line numbers for findings
         still to be processed.
      5. After import insertion, run a final whole-file syntax check. If it
         fails, fall back to the pre-import-insertion candidate (which was
         already validated per-patch) and fail only the repairs that
         declared a required import; if even that fallback is invalid,
         revert all the way to the original source.
      6. Run a final integrity verification confirming every repair marked
         successful is actually present in the returned file.
    """
    source_lines = original_code.splitlines()
    working_lines = list(source_lines)
    pending_imports: list[str] = []

    total = len(vulnerabilities)
    anchors = _capture_finding_anchors(vulnerabilities, source_lines, filename)
    order = sorted(
        range(total),
        key=lambda i: vulnerabilities[i].get("start_line", 0),
        reverse=True,
    )

    results: dict[int, dict] = {}

    for done, i in enumerate(order, start=1):
        vuln = vulnerabilities[i]
        print(
            f"  [RepairAgent] Repairing {done}/{total} "
            f"({vuln.get('label')}, lines {vuln.get('start_line')}-{vuln.get('end_line')})"
        )

        relocated_lines, relocation_error = _relocate_vuln_lines(anchors[i], working_lines)
        if relocation_error:
            print(f"  [RepairAgent] Re-localization failed for finding {done}/{total}: {relocation_error}")
            region_start, region_end = anchors[i]["region"]
            results[i] = _empty_repair_result(
                success=False, status="needs_context",
                explanation=(
                    f"Skipped: {relocation_error}. An earlier repair in this shared region changed line "
                    f"numbers and this vulnerability's exact statement could not be confidently re-located, "
                    f"so no patch was attempted to avoid touching unrelated code."
                ),
                error=relocation_error, model_used="none", elapsed=0.0,
                region_start=region_start, region_end=region_end, region_strategy="relocation_failed",
                validation_error=relocation_error,
            )
            continue

        # Temporary copy ONLY for this repair_one() call — the original finding
        # dict (and therefore its frontend-facing start_line/end_line/vuln_lines)
        # is never mutated.
        temp_vuln = {
            **vuln,
            "vuln_lines": relocated_lines,
            "start_line": min(relocated_lines),
            "end_line": max(relocated_lines),
        }

        result = repair_one(temp_vuln, working_lines, filename)

        if result["success"]:
            region_patched = apply_region_patch(working_lines, result["region_start"], result["region_end"], result["repaired_code"])
            validation_candidate = insert_imports(list(region_patched), result["imports"], filename)
            syntax_ok, syntax_msg, syntax_available = validate_syntax("\n".join(validation_candidate), filename)

            if syntax_available and not syntax_ok:
                _mark_failed(result, f"Whole-file syntax check failed after applying this patch: {syntax_msg}")
            else:
                # Commit ONLY the region replacement now — imports are deferred.
                working_lines = region_patched
                pending_imports.extend(result["imports"])

        results[i] = result

    # ── Deferred import insertion (once, after every region patch) ─────────
    pre_import_lines = list(working_lines)
    unique_imports = deduplicate_imports(pending_imports, "\n".join(working_lines))


    final_lines = working_lines
    if unique_imports:
        final_lines = insert_imports(list(working_lines), unique_imports, filename)


    repaired_file_content = "\n".join(final_lines)
    final_ok, final_msg, final_available = validate_syntax(repaired_file_content, filename)

    if final_available and not final_ok:
        print("  [RepairAgent] Final whole-file syntax validation FAILED after import insertion.")
        print("  [RepairAgent] Falling back to the last known valid candidate (region patches without pending imports).")
        fallback_code = "\n".join(pre_import_lines)
        fallback_ok, fallback_msg, fallback_available = validate_syntax(fallback_code, filename)

        if fallback_available and not fallback_ok:
            print("  [RepairAgent] Fallback candidate also failed syntax validation — reverting to the original source.")
            repaired_file_content = original_code
            for result in results.values():
                if result["success"]:
                    _mark_failed(
                        result,
                        f"Reverted to original source: final file failed syntax validation even without pending imports ({fallback_msg}).",
                    )
        else:
            # Pre-import candidate is valid: keep import-independent repairs,
            # fail only the repairs whose required import could not be applied.
            repaired_file_content = fallback_code
            for result in results.values():
                if result["success"] and result["imports"]:
                    _mark_failed(
                        result,
                        f"Reverted: this repair's required import could not be safely inserted ({final_msg}).",
                    )

    _verify_repair_integrity(results, repaired_file_content, anchors, order)

    findings_raw = [{**vulnerabilities[i], "repair": results[i]} for i in range(total)]
    return findings_raw, repaired_file_content


# ══════════════════════════════════════════════════════════════════════════════
# Ollama health check
# ══════════════════════════════════════════════════════════════════════════════

def check_ollama() -> str:
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        if response.status_code == 200:
            models = [m["name"] for m in response.json().get("models", [])]
            return f"ok — models: {models}"
        return f"error — status {response.status_code}"
    except Exception as exc:
        return f"unreachable — {exc}"
