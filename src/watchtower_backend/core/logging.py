"""Logging helpers for the WATCHTOWER backend."""

from __future__ import annotations

import logging


def configure_logging() -> None:
    """Configure process-wide logging once at startup.

    Returns:
        None.
    """
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
