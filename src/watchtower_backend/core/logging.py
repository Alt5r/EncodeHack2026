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
    # Third-party polling/network clients can emit enough INFO traffic to
    # bog down the live dev server while the simulation is running.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("luffa_bot").setLevel(logging.WARNING)
