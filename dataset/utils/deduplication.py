"""N-gram fingerprinting for near-duplicate detection across a growing corpus.

Why this exists (see docs/ENGINEERING_DECISIONS.md for the full rationale):
an LLM asked the same "give me a SQL injection example" prompt hundreds of
times will happily produce near-identical samples with only variable names
swapped. Exact-match dedup misses these. A sliding 4-gram token fingerprint
with a Jaccard threshold catches them cheaply without requiring embeddings
or a second model call.
"""

from __future__ import annotations

from config import NEAR_DUP_JACCARD_THRESHOLD, NGRAM_SIZE
from utils.text_processing import tokenize


def build_ngram_fingerprint(code: str, n: int = NGRAM_SIZE) -> frozenset[str]:
    """Build a set of overlapping n-gram fingerprints for a code snippet.

    Args:
        code: Source code to fingerprint.
        n: N-gram window size (token count per gram).

    Returns:
        A frozenset of ``"tok1|tok2|...|tokN"`` fingerprint strings. If the
        snippet has fewer than ``n`` tokens, falls back to the raw token set.
    """
    tokens = tokenize(code)
    if len(tokens) < n:
        return frozenset(tokens)
    return frozenset("|".join(tokens[i : i + n]) for i in range(len(tokens) - n + 1))


def is_near_duplicate(
    fingerprint: frozenset[str],
    seen_fingerprints: list[frozenset[str]],
    threshold: float = NEAR_DUP_JACCARD_THRESHOLD,
) -> bool:
    """Check a fingerprint against every previously accepted fingerprint.

    Args:
        fingerprint: N-gram fingerprint of the candidate sample.
        seen_fingerprints: Fingerprints of all previously accepted samples
            (including any restored from checkpoint or an existing dataset).
        threshold: Jaccard overlap at/above which two samples are
            considered near-duplicates.

    Returns:
        True if the candidate is a near-duplicate of any prior sample.

    Note:
        This is O(n) per call against the full corpus, which is the
        dominant cost at scale (~thousands of samples). It's kept simple
        and dependency-free rather than swapped for an LSH index, since
        generation throughput is bottlenecked by the LLM API, not this
        check, at the target dataset sizes used here.
    """
    for prior in seen_fingerprints:
        intersection = len(fingerprint & prior)
        union = len(fingerprint) + len(prior) - intersection
        if union and intersection / union >= threshold:
            return True
    return False
