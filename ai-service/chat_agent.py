"""
VulnSneak API - chat_agent.py
==============================
Cybersecurity-only chat assistant.

Chat model priority:
  1. qwen2.5-coder:7b
  2. qwen3:4b
  3. gemini-2.5-flash

Gemini chat fallback is controlled independently by ALLOW_CLOUD_CHAT.
ALLOW_CLOUD_REPAIR continues to control source-code repair only.
"""

from __future__ import annotations

import re
from typing import Any

import requests

from config import (
    ALLOW_CLOUD_CHAT,
    CHAT_MODELS,
    GEMINI_API_KEY,
    GEMINI_API_URL,
    OLLAMA_URL,
)


SYSTEM_PROMPT = """You are VulnSneak Assistant, a specialized cybersecurity expert built into the VulnSneak vulnerability detection system.

Your only supported scope is:
- Software vulnerabilities, including SQL Injection, XSS, CSRF, Path Traversal, OS Command Injection, XML Injection, Insecure Cryptography, and Insecure Deserialization.
- Explaining why vulnerabilities are dangerous.
- Secure fixes and prevention.
- Secure coding best practices.
- Interpreting VulnSneak scan and repair results.

For a request outside this scope, respond with exactly:
"I am VulnSneak Assistant. I can only help with software vulnerabilities, secure coding practices, and security-related questions."

Respond in the same natural language used by the user. Use Arabic for Arabic questions and English for English questions.

Do not fabricate code from a scanned file that is not present in the conversation. Clearly label invented code as an example.

### Markdown formatting rules

- Return normal Markdown text, not JSON and not HTML.
- Put a blank line between headings, paragraphs, lists, and code blocks.
- Use `###` headings for major sections when the response is long enough to need sections.
- Use **bold** for short labels and important security terms, not entire paragraphs.
- Keep paragraphs short and readable. Never return one large unbroken paragraph.
- Use inline backticks only for short identifiers such as `clientId`.
- Put multi-line code in fenced code blocks and include the correct language tag when known.
- Put important SQL queries in a fenced `sql` block.
- Never put multi-line code in the middle of an Arabic or English sentence.
- Close every code fence.
- Never nest code fences.
- Never wrap the entire response in one outer code block.
- Do not use raw HTML for formatting.
- Use lists only when they improve clarity.
- Do not force a long template onto a short question.

For a detailed vulnerability explanation, use a structure similar to this and translate the labels to the user's language:

### Vulnerability Name

**Problem**

A concise technical explanation.

**Vulnerable Code**

```javascript
// vulnerable example
```

**Secure Fix**

```javascript
// secure example
```

**Why This Is Secure**

A concise explanation.

**Important Notes**

- First point.
- Second point.

For Arabic, use equivalent headings such as:

### اسم الثغرة

**المشكلة**

**الكود غير الآمن**

**الإصلاح الصحيح**

**لماذا الإصلاح آمن؟**

**ملاحظات مهمة**

When discussing a specific vulnerability fix and enough code context is available, show both the vulnerable and fixed versions.
"""

_VALID_HISTORY_ROLES = {"user", "assistant"}
MAX_HISTORY_MESSAGES = 20


def normalize_chat_history(history: list[dict[str, Any]] | None) -> list[dict[str, str]]:
    """Keep only valid recent user/assistant messages."""
    if not history:
        return []

    normalized: list[dict[str, str]] = []
    for item in history:
        if not isinstance(item, dict):
            continue

        role = item.get("role")
        content = item.get("content")

        if role not in _VALID_HISTORY_ROLES:
            continue
        if not isinstance(content, str):
            continue

        content = content.strip()
        if not content:
            continue

        normalized.append({"role": role, "content": content})

    return normalized[-MAX_HISTORY_MESSAGES:]


_OUTER_CODE_BLOCK = re.compile(
    r"\A```[^\n]*\n[\s\S]*\n```\s*\Z"
)


def validate_chat_markdown(text: str) -> tuple[bool, str]:
    """
    Reject only obvious Markdown failures.

    The function does not rewrite the response. A rejected response causes the
    pipeline to try the next configured model.
    """
    if not isinstance(text, str) or not text.strip():
        return False, "The model returned an empty response."

    if text.count("```") % 2:
        return False, "The response contains an unclosed fenced code block."

    if _OUTER_CODE_BLOCK.fullmatch(text.strip()):
        return False, "The entire response is wrapped in one outer code block."

    return True, ""


def _redact_secret(text: str) -> str:
    """Prevent the Gemini key from appearing in logs or error messages."""
    if GEMINI_API_KEY:
        return text.replace(GEMINI_API_KEY, "[REDACTED]")
    return text


def try_chat_model(model_name: str, messages: list[dict[str, str]]) -> tuple[bool, str]:
    """Call one local Ollama chat model."""
    timeout = 120 if "7b" in model_name else 90
    print(f"  [ChatAgent] Trying {model_name} (timeout={timeout}s)...")

    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": model_name,
                "messages": messages,
                "options": {
                    "temperature": 0.2,
                    "num_predict": 1800,
                },
                "stream": False,
            },
            timeout=timeout,
        )
        response.raise_for_status()

        payload = response.json()
        reply = payload.get("message", {}).get("content", "")
        if not isinstance(reply, str) or not reply.strip():
            print(f"  [ChatAgent] {model_name} returned an empty response.")
            return False, ""

        print(f"  [ChatAgent] {model_name} succeeded.")
        return True, reply.strip()

    except Exception as exc:
        print(f"  [ChatAgent] {model_name} failed: {_redact_secret(str(exc))}")
        return False, ""


def try_gemini_chat(messages: list[dict[str, str]]) -> tuple[bool, str]:
    """Call Gemini only as the final chat fallback."""
    if not ALLOW_CLOUD_CHAT:
        print(
            "  [ChatAgent] Gemini skipped because ALLOW_CLOUD_CHAT=false. "
            "No network request was made."
        )
        return False, ""

    if not GEMINI_API_KEY:
        print(
            "  [ChatAgent] Gemini skipped because GEMINI_API_KEY is not configured. "
            "No network request was made."
        )
        return False, ""

    system_text = next(
        (item["content"] for item in messages if item.get("role") == "system"),
        SYSTEM_PROMPT,
    )

    contents: list[dict[str, Any]] = []
    for item in messages:
        role = item.get("role")
        if role == "system":
            continue
        if role not in _VALID_HISTORY_ROLES:
            continue

        gemini_role = "user" if role == "user" else "model"
        contents.append(
            {
                "role": gemini_role,
                "parts": [{"text": item["content"]}],
            }
        )

    print("  [ChatAgent] Trying gemini-2.5-flash as the final chat fallback...")

    try:
        response = requests.post(
            f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
            json={
                "systemInstruction": {
                    "parts": [{"text": system_text}],
                },
                "contents": contents,
                "generationConfig": {
                    "temperature": 0.2,
                    "maxOutputTokens": 1800,
                },
            },
            timeout=60,
        )
        response.raise_for_status()

        payload = response.json()
        candidates = payload.get("candidates") or []
        if not candidates:
            print("  [ChatAgent] Gemini returned no candidates.")
            return False, ""

        parts = candidates[0].get("content", {}).get("parts") or []
        reply = parts[0].get("text", "") if parts else ""

        if not isinstance(reply, str) or not reply.strip():
            print("  [ChatAgent] Gemini returned an empty response.")
            return False, ""

        print("  [ChatAgent] Gemini succeeded.")
        return True, reply.strip()

    except Exception as exc:
        print(f"  [ChatAgent] Gemini failed: {_redact_secret(str(exc))}")
        return False, ""


def chat(user_message: str, history: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    """
    Return a cybersecurity chat response while preserving Markdown newlines.

    Model order is defined only by CHAT_MODELS.
    """
    clean_history = normalize_chat_history(history)

    messages: list[dict[str, str]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *clean_history,
        {"role": "user", "content": user_message},
    ]

    failures: list[str] = []

    for model_config in CHAT_MODELS:
        model_name = model_config["name"]
        model_type = model_config.get("type", "ollama")

        if model_type == "gemini":
            success, response_text = try_gemini_chat(messages)
        else:
            success, response_text = try_chat_model(model_name, messages)

        if not success:
            failures.append(f"{model_name}: unavailable or returned no usable response")
            continue

        markdown_valid, markdown_error = validate_chat_markdown(response_text)
        if not markdown_valid:
            print(
                f"  [ChatAgent] {model_name} response rejected: "
                f"{markdown_error} Trying the next model."
            )
            failures.append(f"{model_name}: {markdown_error}")
            continue

        return {
            "success": True,
            "response": response_text,
            "model_used": model_name,
            "error": "",
        }

    return {
        "success": False,
        "response": "All models are currently unavailable. Please try again.",
        "model_used": "none",
        "error": "; ".join(failures) or "All chat models failed.",
    }
