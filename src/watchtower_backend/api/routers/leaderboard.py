"""Leaderboard routes."""

from __future__ import annotations

from fastapi import APIRouter, Request

from watchtower_backend.api.schemas.leaderboard import LeaderboardEntryRead
from watchtower_backend.persistence.repositories.leaderboard import LeaderboardRepository

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


@router.get("", response_model=list[LeaderboardEntryRead], summary="List leaderboard entries")
async def list_leaderboard(request: Request) -> list[LeaderboardEntryRead]:
    """Return persisted leaderboard rows."""
    session_factory = request.app.state.session_factory
    repository = LeaderboardRepository()
    async with session_factory() as session:
        entries = await repository.list_top(session=session)
    return [LeaderboardEntryRead.from_model(model=entry) for entry in entries]
