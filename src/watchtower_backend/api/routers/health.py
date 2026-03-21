"""Operational health routes."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", summary="Health check")
async def health_check() -> dict[str, str]:
    """Return a simple health response."""
    return {"status": "ok"}
