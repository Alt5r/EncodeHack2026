"""Replay retrieval routes."""

from __future__ import annotations

import asyncio
from pathlib import Path

import orjson
from fastapi import APIRouter, HTTPException, Request

router = APIRouter(prefix="/replays", tags=["replays"])


@router.get("/{session_id}", summary="Read a session replay log")
async def get_replay(session_id: str, request: Request) -> dict[str, object]:
    """Return replay events for a finished or active session.

    Args:
        session_id: Session identifier.
        request: FastAPI request object.

    Returns:
        Replay payload containing the session id and ordered events.

    Raises:
        HTTPException: If the replay file does not exist.
    """
    replay_path = request.app.state.settings.replay_directory / f"{session_id}.jsonl"
    if not replay_path.exists():
        raise HTTPException(status_code=404, detail="Replay not found")

    events = await asyncio.to_thread(_read_replay_file, replay_path)
    return {"session_id": session_id, "events": events}


def _read_replay_file(replay_path: Path) -> list[dict[str, object]]:
    """Read replay events from disk.

    Args:
        replay_path: Replay JSONL path.

    Returns:
        Replay events decoded into dictionaries.
    """
    with replay_path.open("rb") as replay_file:
        return [orjson.loads(line) for line in replay_file if line.strip()]
