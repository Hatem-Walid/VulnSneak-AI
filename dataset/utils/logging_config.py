"""Centralized logging configuration.

Replaces the ``print()``-based progress reporting used throughout the
original scripts with structured, leveled logging that can be redirected,
filtered, or shipped to a log aggregator in a production setting.
"""

from __future__ import annotations

import logging
import sys

_CONFIGURED = False


def get_logger(name: str) -> logging.Logger:
    """Return a configured module-level logger.

    Configures the root logging handler exactly once per process (subsequent
    calls just attach a named child logger), so importing this from multiple
    generator modules is safe and does not duplicate log lines.

    Args:
        name: Usually ``__name__`` of the calling module.

    Returns:
        A :class:`logging.Logger` instance writing to stdout with a
        timestamped, leveled format.
    """
    global _CONFIGURED
    if not _CONFIGURED:
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s  %(levelname)-7s  %(name)s  %(message)s",
            datefmt="%H:%M:%S",
            stream=sys.stdout,
        )
        _CONFIGURED = True
    return logging.getLogger(name)
