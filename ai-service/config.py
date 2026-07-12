"""
VulnSneak API - config.py
==========================
All settings in one place.
Edit this file to match your environment, or override via environment
variables (recommended for secrets and machine-specific addresses).
"""

import os
from pathlib import Path


# ── Model Paths ────────────────────────────────────────────────────────────────
BINARY_MODEL_PATH = Path(os.getenv("BINARY_MODEL_PATH", "./models/binary_model"))
FAMILY_MODEL_PATH = Path(os.getenv("FAMILY_MODEL_PATH", "./models/family_model"))

# ── Chunking ───────────────────────────────────────────────────────────────────
WINDOW_LINES         = 24
STRIDE_LINES         = 12

# ── Tokenization ───────────────────────────────────────────────────────────────
MAX_LENGTH           = 256

# ── Binary Model ───────────────────────────────────────────────────────────────
BINARY_THRESHOLD     = 0.60   # tuned from validation set

# ── Family Model ───────────────────────────────────────────────────────────────
FAMILY_CONFIDENCE_FLOOR = 0.50
MERGE_LINE_TOLERANCE    = 5

FAMILIES = [
    "CSRF",
    "Insecure Cryptography",
    "Insecure Deserialization",
    "OS Command Injection",
    "Path Traversal",
    "SQL Injection",
    "XML Injection",
    "XSS",
]

# ── Ollama (Repair Models - Second Machine) ────────────────────────────────────
# Set the OLLAMA_URL environment variable to point at the Ollama machine
# using a LAN IP or an ngrok tunnel URL — see .env.example
OLLAMA_URL = os.getenv("OLLAMA_URL", "")  # Set via environment variable — see .env.example

# ── Gemini API ─────────────────────────────────────────────────────────────────
# SECURITY: a Gemini API key was previously hardcoded in this file and was
# shared in a chat conversation. That key must be treated as compromised:
# revoke it in Google AI Studio / Google Cloud console and generate a new one.
# The new key must be supplied ONLY via the GEMINI_API_KEY environment
# variable - never hardcode it back into this file or into version control.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")  # Set via environment variable — see .env.example
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

# Cloud repair is OFF by default. Local Ollama models are the default and
# preferred repair path. Set ALLOW_CLOUD_REPAIR=true only if you accept
# sending source code to a third-party cloud API as a last-resort fallback.
ALLOW_CLOUD_REPAIR = os.getenv("ALLOW_CLOUD_REPAIR", "true").strip().lower() in ("1", "true", "yes")

# Cloud chat is independent from source-code repair. It is ON by default so
# Gemini can act as the final chat fallback when both local Ollama models fail,
# but Gemini is still skipped unless GEMINI_API_KEY is configured.
ALLOW_CLOUD_CHAT = os.getenv("ALLOW_CLOUD_CHAT", "true").strip().lower() in ("1", "true", "yes")

# When False (default), full model responses and full source code are never
# printed to logs - only short status lines. Enable for local debugging only.
DEBUG_REPAIR_RESPONSES = os.getenv("DEBUG_REPAIR_RESPONSES", "false").strip().lower() in ("1", "true", "yes")

# ── Repair Models ──────────────────────────────────────────────────────────────
# Priority order: primary → secondary → last resort (cloud, gated by
# ALLOW_CLOUD_REPAIR above - skipped entirely when that flag is false).

REPAIR_MODELS = [
    {
        "name"        : "qwen2.5-coder:7b",
        "type"        : "ollama",
        "description" : "Primary - strongest local code repair",
    },
    {
        "name"        : "qwen3:4b",
        "type"        : "ollama",
        "description" : "Secondary - faster local model",
    },
    {
        "name"        : "gemini-2.5-flash",
        "type"        : "gemini",
        "description" : "Last resort - cloud fallback when local models fail (requires ALLOW_CLOUD_REPAIR=true)",
    },
]

# ── Chat Models ────────────────────────────────────────────────────────────────
# Independent from REPAIR_MODELS. Gemini is the automatic final chat fallback
# when both local models fail, provided ALLOW_CLOUD_CHAT=true and an API key is
# configured.
CHAT_MODELS = [
    {
        "name"        : "qwen2.5-coder:7b",
        "type"        : "ollama",
        "description" : "Primary local chat model",
    },
    {
        "name"        : "qwen3:4b",
        "type"        : "ollama",
        "description" : "Secondary local chat model",
    },
    {
        "name"        : "gemini-2.5-flash",
        "type"        : "gemini",
        "description" : "Automatic cloud chat fallback (requires ALLOW_CLOUD_CHAT=true and GEMINI_API_KEY)",
    },
]

# ── Repair Region / Context Limits ─────────────────────────────────────────────
# Caps used by repair_agent.py when locating the editable region and when
# deciding how much of the file to send as context. Character-based, not a
# fixed line count, so context scales sensibly across file sizes.
MAX_REGION_LINES   = 160     # cap on the editable region size before falling back to a padded window
FALLBACK_PAD_LINES = 15      # context padding when no enclosing function/route/class is found
MAX_CONTEXT_CHARS  = 12000   # character budget for sending the full file as read-only context

# ── API ────────────────────────────────────────────────────────────────────────
API_HOST = "0.0.0.0"
API_PORT = 8000

# ── CORS ───────────────────────────────────────────────────────────────────────
# allow_origins=["*"] combined with allow_credentials=True is rejected by
# browsers and is a privacy smell besides. List the frontend's real
# origin(s) explicitly, comma-separated, via the CORS_ORIGINS env var.
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000",
    ).split(",")
    if origin.strip()
]
