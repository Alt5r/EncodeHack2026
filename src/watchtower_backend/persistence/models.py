"""ORM models used by persistence repositories."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from watchtower_backend.persistence.db import Base


class LeaderboardEntryModel(Base):
    """Leaderboard row persisted at the end of a session."""

    __tablename__ = "leaderboard_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(64), index=True, unique=True)
    doctrine_title: Mapped[str] = mapped_column(String(200))
    doctrine_snippet: Mapped[str] = mapped_column(String(100))
    outcome: Mapped[str] = mapped_column(String(32), index=True)
    time_elapsed_seconds: Mapped[int] = mapped_column(Integer)
    burned_cells: Mapped[int] = mapped_column(Integer)
    suppressed_cells: Mapped[int] = mapped_column(Integer)
    firebreak_cells: Mapped[int] = mapped_column(Integer)
    village_damage: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(tz=UTC),
    )


class ReplayIndexModel(Base):
    """Session metadata for locating replay files."""

    __tablename__ = "replay_index"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(64), index=True, unique=True)
    doctrine_title: Mapped[str] = mapped_column(String(200))
    replay_path: Mapped[str] = mapped_column(Text)
    outcome: Mapped[str] = mapped_column(String(32), index=True)
