"""Central configuration for the VulnSneak dataset-generation pipeline.

Every value that used to be hardcoded inside individual generator scripts
(API keys, model names, sample targets, file paths, token budgets, batch
sizes) now lives here and is resolved from environment variables at import
time. This keeps secrets out of source control and lets every generator
be reconfigured (e.g. for a smaller smoke-test run) without touching code.

Usage:
    from config import Settings
    settings = Settings.for_generator("xss")
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# ──────────────────────────────────────────────────────────────────────────
#  Paths
# ──────────────────────────────────────────────────────────────────────────
PROJECT_ROOT: Path = Path(__file__).resolve().parent
OUTPUT_DIR: Path = Path(os.getenv("VULNSNEAK_OUTPUT_DIR", PROJECT_ROOT / "output"))
CHECKPOINT_DIR: Path = Path(os.getenv("VULNSNEAK_CHECKPOINT_DIR", OUTPUT_DIR / "checkpoints"))

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)

# ──────────────────────────────────────────────────────────────────────────
#  API credentials — never hardcode these; set them in your .env file
# ──────────────────────────────────────────────────────────────────────────
CEREBRAS_API_BASE_URL: str = os.getenv("CEREBRAS_API_BASE_URL", "https://api.cerebras.ai/v1")
CEREBRAS_MODEL: str = os.getenv("CEREBRAS_MODEL", "qwen-3-235b-a22b-instruct-2507")


def _load_api_keys() -> list[str]:
    """Load one or more Cerebras API keys from the environment.

    Supports both a single-key setup (``CEREBRAS_API_KEY``) and a
    multi-key, round-robin setup for parallel generation
    (``CEREBRAS_API_KEYS`` as a comma-separated list).

    Returns:
        A list of non-empty API key strings. Empty if none are configured
        (callers should fail fast with a clear error in that case).
    """
    multi = os.getenv("CEREBRAS_API_KEYS", "")
    if multi.strip():
        return [k.strip() for k in multi.split(",") if k.strip()]

    single = os.getenv("CEREBRAS_API_KEY", "")
    return [single] if single.strip() else []


CEREBRAS_API_KEYS: list[str] = _load_api_keys()

# ──────────────────────────────────────────────────────────────────────────
#  CodeBERT / RoBERTa token-budget constants
#  [CLS] + vuln_tokens + [SEP] + safe_tokens + [SEP] = 512 max
# ──────────────────────────────────────────────────────────────────────────
CODEBERT_MAX_TOKENS: int = 512
SPECIAL_TOKEN_COUNT: int = 3  # [CLS], [SEP], [SEP]
DEFAULT_WP_BUDGET: int = CODEBERT_MAX_TOKENS - SPECIAL_TOKEN_COUNT  # 509

# Empirically calibrated chars-per-wordpiece-token ratio for RobertaTokenizer
# (see docs/ENGINEERING_DECISIONS.md for derivation).
CHARS_PER_WP_TOKEN: float = 3.5

# ──────────────────────────────────────────────────────────────────────────
#  Near-duplicate detection defaults
# ──────────────────────────────────────────────────────────────────────────
NGRAM_SIZE: int = 4
NEAR_DUP_JACCARD_THRESHOLD: float = 0.80

# ──────────────────────────────────────────────────────────────────────────
#  Generation defaults (overridable per generator)
# ──────────────────────────────────────────────────────────────────────────
DEFAULT_BATCH_SIZE: int = int(os.getenv("VULNSNEAK_BATCH_SIZE", "4"))
DEFAULT_TEMPERATURE: float = float(os.getenv("VULNSNEAK_TEMPERATURE", "0.8"))
DEFAULT_MAX_TOKENS: int = int(os.getenv("VULNSNEAK_MAX_TOKENS", "600"))
CHECKPOINT_EVERY_N: int = int(os.getenv("VULNSNEAK_CHECKPOINT_EVERY", "10"))
RATE_LIMIT_SLEEP_SECONDS: float = float(os.getenv("VULNSNEAK_RATE_LIMIT_SLEEP", "62.0"))
API_MAX_RETRIES: int = int(os.getenv("VULNSNEAK_API_MAX_RETRIES", "5"))


@dataclass(frozen=True)
class GeneratorSettings:
    """Per-generator run configuration.

    Attributes:
        name: Short identifier for the vulnerability class (e.g. "sqli").
        state_label: The label written into the ``state`` field of each
            generated sample (e.g. "SQL Injection").
        target_samples: Number of accepted samples to generate before
            stopping.
        output_file: Path to the final JSONL dataset file.
        checkpoint_file: Path to the incremental checkpoint JSONL file.
        wp_budget: Max combined word-piece token budget for a vuln/safe pair.
        max_chars: Hard character ceiling before acceptance.
        batch_size: Number of parallel API requests per round (only used
            by generators that support parallel key rotation).
    """

    name: str
    state_label: str
    target_samples: int
    output_file: Path
    checkpoint_file: Path
    wp_budget: int = DEFAULT_WP_BUDGET
    max_chars: int = 1900
    batch_size: int = DEFAULT_BATCH_SIZE

    @classmethod
    def for_generator(
        cls,
        name: str,
        state_label: str,
        target_samples: int,
        wp_budget: int = DEFAULT_WP_BUDGET,
        max_chars: int = 1900,
        batch_size: int = DEFAULT_BATCH_SIZE,
    ) -> "GeneratorSettings":
        """Build a :class:`GeneratorSettings` with standardized file paths.

        Args:
            name: Short slug used to derive output/checkpoint filenames,
                e.g. ``"sqli"`` -> ``output/sqli_output.jsonl``.
            state_label: Value stored in the ``state`` field of samples.
            target_samples: How many accepted samples to generate.
            wp_budget: Word-piece token budget for the vuln/safe pair.
            max_chars: Character ceiling before acceptance.
            batch_size: Parallel request batch size.

        Returns:
            A populated :class:`GeneratorSettings` instance.
        """
        return cls(
            name=name,
            state_label=state_label,
            target_samples=target_samples,
            output_file=OUTPUT_DIR / f"{name}_output.jsonl",
            checkpoint_file=CHECKPOINT_DIR / f"{name}_checkpoint.jsonl",
            wp_budget=wp_budget,
            max_chars=max_chars,
            batch_size=batch_size,
        )


def require_api_keys() -> list[str]:
    """Return configured API keys or raise a clear, actionable error.

    Raises:
        RuntimeError: If no ``CEREBRAS_API_KEY`` / ``CEREBRAS_API_KEYS``
            environment variable is set.
    """
    if not CEREBRAS_API_KEYS:
        raise RuntimeError(
            "No Cerebras API key found. Set CEREBRAS_API_KEY (single key) "
            "or CEREBRAS_API_KEYS (comma-separated, for parallel generation) "
            "in your environment or .env file. See .env.example."
        )
    return CEREBRAS_API_KEYS
