"""Schemas for leaderboard endpoints."""

from __future__ import annotations

from pydantic import BaseModel

from watchtower_backend.persistence.models import LeaderboardEntryModel


class LeaderboardEntryRead(BaseModel):
    """Leaderboard response row."""

    session_id: str
    doctrine_title: str
    doctrine_snippet: str
    outcome: str
    time_elapsed_seconds: int
    burned_cells: int
    suppressed_cells: int
    firebreak_cells: int
    village_damage: int

    @classmethod
    def from_model(cls, model: LeaderboardEntryModel) -> LeaderboardEntryRead:
        """Build a response row from an ORM model."""
        return cls(
            session_id=model.session_id,
            doctrine_title=model.doctrine_title,
            doctrine_snippet=model.doctrine_snippet,
            outcome=model.outcome,
            time_elapsed_seconds=model.time_elapsed_seconds,
            burned_cells=model.burned_cells,
            suppressed_cells=model.suppressed_cells,
            firebreak_cells=model.firebreak_cells,
            village_damage=model.village_damage,
        )
