"""Shared utility modules for the VulnSneak dataset-generation pipeline.

These modules were extracted from duplicated logic that previously lived
independently inside each ``generate_<vuln>.py`` script (token budgeting,
near-duplicate detection, checkpointing, API client with key rotation,
and response parsing). Centralizing them keeps every generator's
prompt-engineering and validation logic front-and-center while removing
~200 lines of copy-pasted boilerplate per file.
"""
