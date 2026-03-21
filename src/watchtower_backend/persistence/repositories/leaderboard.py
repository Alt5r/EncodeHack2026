"""Repositories for leaderboard and replay metadata."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from watchtower_backend.domain.models.simulation import SessionState
from watchtower_backend.persistence.models import LeaderboardEntryModel, ReplayIndexModel


class LeaderboardRepository:
    """Persist and query leaderboard entries."""

    async def record_session(self, session: AsyncSession, session_state: SessionState) -> None:
        """Persist a leaderboard row for a finished session.

        Args:
            session: Database session.
            session_state: Session state to persist.

        Returns:
            None.
        """
        entry = LeaderboardEntryModel(
            session_id=session_state.id,
            doctrine_title=session_state.doctrine.title,
            doctrine_snippet=session_state.doctrine.text[:100],
            outcome=session_state.status.value,
            time_elapsed_seconds=session_state.score.time_elapsed_seconds,
            burned_cells=session_state.score.burned_cells,
            suppressed_cells=session_state.score.suppressed_cells,
            firebreak_cells=session_state.score.firebreak_cells,
            village_damage=session_state.score.village_damage,
        )
        session.add(entry)
        await session.commit()

    async def list_top(self, session: AsyncSession, limit: int = 20) -> list[LeaderboardEntryModel]:
        """Return top leaderboard rows sorted by damage and time.

        Args:
            session: Database session.
            limit: Maximum number of rows to return.

        Returns:
            Leaderboard entries ordered best-first.
        """
        statement = (
            select(LeaderboardEntryModel)
            .order_by(
                LeaderboardEntryModel.village_damage.asc(),
                LeaderboardEntryModel.burned_cells.asc(),
                LeaderboardEntryModel.time_elapsed_seconds.asc(),
            )
            .limit(limit)
        )
        result = await session.execute(statement)
        return list(result.scalars().all())


class ReplayIndexRepository:
    """Persist replay index metadata."""

    async def record_replay(
        self,
        session: AsyncSession,
        session_id: str,
        doctrine_title: str,
        replay_path: str,
        outcome: str,
    ) -> None:
        """Persist replay metadata for later lookup.

        Args:
            session: Database session.
            session_id: Session identifier.
            doctrine_title: Doctrine title.
            replay_path: Replay JSONL path.
            outcome: Final game outcome.

        Returns:
            None.
        """
        session.add(
            ReplayIndexModel(
                session_id=session_id,
                doctrine_title=doctrine_title,
                replay_path=replay_path,
                outcome=outcome,
            )
        )
        await session.commit()
