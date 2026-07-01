"""Text and code-processing primitives shared by every generator.

These functions operate purely on strings and carry no dataset-specific
knowledge (no vulnerability subtypes, no mitigation keyword lists) — that
logic stays in each generator's ``validation.py``-style section so the
security reasoning remains explicit and auditable per vulnerability class.
"""

from __future__ import annotations

import re

from config import CHARS_PER_WP_TOKEN

_COMMENT_PATTERNS: tuple[re.Pattern, ...] = (
    re.compile(r"#.*"),
    re.compile(r"//.*"),
    re.compile(r"/\*.*?\*/", re.DOTALL),
    re.compile(r'""".*?"""', re.DOTALL),
    re.compile(r"'''.*?'''", re.DOTALL),
)

_IDENTIFIER_PATTERN = re.compile(r"[a-zA-Z_]\w*|[0-9]+")

# Keywords that signal "this text contains a real function/route definition"
# across the ~10 languages covered by the generators. Kept broad on purpose:
# false positives here are cheap (caught later by other validation checks),
# false negatives silently discard good samples.
FUNCTION_KEYWORDS: tuple[str, ...] = (
    "def ", "func ", "fn ", "function ", "async function",
    "public ", "private ", "protected ", "internal ", "override ",
    "static ", "void ", "async ",
    "const ", "let ", "var ", "module.exports", "exports.",
    "<?php", "fun ", "object ", "class ", "interface ", "sub ",
    "router.", "app.get(", "app.post(", "app.put(", "app.delete(",
    "http.HandleFunc(", "http.Handle(", "Route::", "@app.route", "@router.",
    "@GetMapping", "@PostMapping", "@RequestMapping", "@Controller",
    " do\n", " do |", "post '", "get '", "put '", "delete '",
    "post \"", "get \"",
)


def strip_comments(code: str) -> str:
    """Remove line and block comments from a code snippet.

    Used before scanning ``safe_code`` for forbidden patterns, so that a
    forbidden API call mentioned only in a comment doesn't cause a false
    rejection.

    Args:
        code: Raw source code snippet.

    Returns:
        The snippet with comments removed (structure otherwise untouched).
    """
    for pattern in _COMMENT_PATTERNS:
        code = pattern.sub("", code)
    return code


def tokenize(code: str) -> list[str]:
    """Split code into identifier/number tokens for similarity comparisons.

    Args:
        code: Source code snippet.

    Returns:
        List of word-like and numeric tokens (punctuation is discarded).
    """
    return _IDENTIFIER_PATTERN.findall(code)


def jaccard(tokens_a: list[str], tokens_b: list[str]) -> float:
    """Compute Jaccard similarity between two token multisets (as sets).

    Args:
        tokens_a: Tokens from the first snippet.
        tokens_b: Tokens from the second snippet.

    Returns:
        A value in [0, 1]; 1.0 when both are empty (defined as identical).
    """
    set_a, set_b = set(tokens_a), set(tokens_b)
    if not set_a and not set_b:
        return 1.0
    intersection = len(set_a & set_b)
    union = len(set_a) + len(set_b) - intersection
    return intersection / union if union else 0.0


def wp_tokens(text: str) -> int:
    """Estimate the RoBERTa/CodeBERT word-piece token count of a string.

    This is a calibrated approximation (chars / 3.5), not a real
    tokenizer call — good enough for a conservative acceptance gate
    without paying the cost of loading a tokenizer per sample. See
    ``docs/ENGINEERING_DECISIONS.md`` for the empirical derivation.

    Args:
        text: Source text to estimate.

    Returns:
        Estimated word-piece token count (minimum 1).
    """
    return max(1, int(len(text) / CHARS_PER_WP_TOKEN))


def has_function(code: str, extra_keywords: tuple[str, ...] = ()) -> bool:
    """Check whether a snippet looks like it contains a real function/route.

    Args:
        code: Source code snippet.
        extra_keywords: Additional language-specific keywords to check,
            appended to the shared :data:`FUNCTION_KEYWORDS` list.

    Returns:
        True if any known function/definition keyword is present.
    """
    keywords = FUNCTION_KEYWORDS + extra_keywords
    return any(kw in code for kw in keywords)


def smart_truncate(code: str, wp_budget: int) -> str:
    """Trim code line-by-line to fit within a word-piece token budget.

    Closes any C-family braces left dangling by the truncation so the
    resulting snippet stays syntactically plausible.

    Args:
        code: Source code to truncate.
        wp_budget: Maximum estimated word-piece tokens to retain.

    Returns:
        The truncated code, brace-balanced where applicable.
    """
    lines = code.split("\n")
    kept: list[str] = []
    total = 0
    for line in lines:
        cost = wp_tokens(line)
        if total + cost > wp_budget:
            break
        kept.append(line)
        total += cost

    result = "\n".join(kept)
    if len(kept) < len(lines):
        unclosed_braces = result.count("{") - result.count("}")
        if unclosed_braces > 0:
            result += "\n" + "}\n" * unclosed_braces
    return result


def parse_vuln_safe_blocks(raw_text: str) -> tuple[str | None, str | None]:
    """Extract ``VULN:`` / ``SAFE:`` sections from a raw LLM completion.

    Strips markdown fences and bold markers defensively, since the model
    occasionally wraps the requested plain-text format despite instructions.

    Args:
        raw_text: The full text returned by the API.

    Returns:
        A ``(vuln_code, safe_code)`` tuple; either element is ``None`` if
        the expected sections could not be located.
    """
    text = re.sub(r"\*\*(VULN|SAFE):\*\*", r"\1:", raw_text, flags=re.IGNORECASE)
    text = re.sub(r"```[a-zA-Z]*\n?", "", text)
    text = re.sub(r"```", "", text)

    vuln_match = re.search(r"VULN:\s*\n(.*?)(?=\nSAFE:)", text, re.DOTALL | re.IGNORECASE)
    safe_match = re.search(r"SAFE:\s*\n(.+)$", text, re.DOTALL | re.IGNORECASE)
    if not vuln_match or not safe_match:
        return None, None
    return vuln_match.group(1).strip(), safe_match.group(1).strip()
