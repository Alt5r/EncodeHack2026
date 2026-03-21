"""Session manager for active WATCHTOWER games."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from watchtower_backend.core.config import Settings
from watchtower_backend.core.errors import SessionNotFoundError
from watchtower_backend.domain.events import BroadcastEnvelope
from watchtower_backend.domain.models.simulation import GameStatus, SessionState, TerrainCell
from watchtower_backend.domain.protocols import Planner, RadioSink, WeatherProvider
from watchtower_backend.persistence.replay_store import ReplayStore
from watchtower_backend.persistence.repositories.leaderboard import (
    LeaderboardRepository,
    ReplayIndexRepository,
)
from watchtower_backend.services.sessions.runtime import SessionRuntime, build_initial_state


class SessionManager:
    """Create, track, and persist WATCHTOWER session runtimes."""

    def __init__(
        self,
        settings: Settings,
        session_factory: async_sessionmaker[AsyncSession],
        weather_provider: WeatherProvider,
        planner: Planner,
        radio_sink: RadioSink,
    ) -> None:
        """Initialize the session manager.

        Args:
            settings: Application settings.
            session_factory: Database session factory.
            weather_provider: Provider used for initial wind conditions.
            planner: Planner implementation.
            radio_sink: Radio publishing sink.
        """
        self._settings = settings
        self._session_factory = session_factory
        self._weather_provider = weather_provider
        self._planner = planner
        self._radio_sink = radio_sink
        self._replay_store = ReplayStore(root_directory=settings.replay_directory)
        self._leaderboard_repository = LeaderboardRepository()
        self._replay_index_repository = ReplayIndexRepository()
        self._runtimes: dict[str, SessionRuntime] = {}
        self._monitor_tasks: dict[str, asyncio.Task[None]] = {}
        self._persisted_session_ids: set[str] = set()
        self._lock = asyncio.Lock()

    async def create_session(
        self,
        doctrine_text: str,
        doctrine_title: str | None = None,
        terrain_grid: list[list[TerrainCell]] | None = None,
    ) -> SessionState:
        """Create and start a new session runtime.

        Args:
            doctrine_text: Doctrine text entered by the player.
            doctrine_title: Optional doctrine title.
            terrain_grid: Optional terrain grid from the frontend.

        Returns:
            Initial session state.
        """
        wind = await self._weather_provider.get_wind()
        session_state = build_initial_state(
            doctrine_text=doctrine_text,
            doctrine_title=doctrine_title,
            wind=wind,
            grid_size=self._settings.default_grid_size,
        )
        runtime = SessionRuntime(
            session_state=session_state,
            planner=self._planner,
            radio_sink=self._radio_sink,
            replay_store=self._replay_store,
            tick_interval_seconds=self._settings.default_tick_interval_seconds,
            planner_interval_seconds=self._settings.default_planner_interval_seconds,
            max_event_backlog=self._settings.max_session_event_backlog,
            seed=sum(ord(character) for character in session_state.id),
            terrain_grid=terrain_grid,
        )
        async with self._lock:
            self._runtimes[session_state.id] = runtime
        await runtime.start()
        self._monitor_tasks[session_state.id] = asyncio.create_task(
            self._monitor_runtime(session_id=session_state.id, runtime=runtime)
        )
        return runtime.session_state

    async def get_session(self, session_id: str) -> SessionState:
        """Return current state for an active session."""
        runtime = await self._get_runtime(session_id=session_id)
        return runtime.session_state

    async def list_sessions(self) -> list[SessionState]:
        """Return active session states."""
        return [runtime.session_state for runtime in self._runtimes.values()]

    async def stop_session(self, session_id: str) -> SessionState:
        """Stop a session and persist results.

        Args:
            session_id: Session identifier.

        Returns:
            Final session state.
        """
        async with self._lock:
            runtime = self._runtimes.get(session_id)
            if runtime is None:
                raise SessionNotFoundError(session_id=session_id)
            monitor_task = self._monitor_tasks.pop(session_id, None)
            self._runtimes.pop(session_id, None)
        if monitor_task is not None:
            monitor_task.cancel()
            with suppress(asyncio.CancelledError):
                await monitor_task
        final_state = await runtime.stop()
        await self._persist_session(final_state=final_state)
        return final_state

    async def subscribe(self, session_id: str) -> AsyncIterator[asyncio.Queue[BroadcastEnvelope]]:
        """Subscribe to a session event stream.

        Args:
            session_id: Session identifier.

        Returns:
            Async context manager yielding a subscriber queue.
        """
        runtime = await self._get_runtime(session_id=session_id)

        @asynccontextmanager
        async def manager() -> AsyncIterator[asyncio.Queue[BroadcastEnvelope]]:
            queue = await runtime.broadcaster.subscribe()
            try:
                await runtime.broadcaster.publish_snapshot(snapshot=runtime.snapshot())
                yield queue
            finally:
                await runtime.broadcaster.unsubscribe(queue=queue)

        return manager()

    async def close(self) -> None:
        """Stop all active runtimes.

        Returns:
            None.
        """
        for session_id in list(self._runtimes.keys()):
            await self.stop_session(session_id=session_id)

    async def publish_external_event(
        self,
        session_id: str,
        event_type: str,
        payload: dict[str, object],
    ) -> None:
        """Publish an integration event to an active session.

        Args:
            session_id: Session identifier.
            event_type: Event type identifier.
            payload: Event payload.

        Returns:
            None.
        """
        runtime = self._runtimes.get(session_id)
        if runtime is None:
            return
        await runtime.publish_external_event(
            event_type=event_type,
            payload=payload,
        )

    async def _get_runtime(self, session_id: str) -> SessionRuntime:
        """Return the runtime for a session.

        Raises:
            SessionNotFoundError: If the session does not exist.
        """
        runtime = self._runtimes.get(session_id)
        if runtime is None:
            raise SessionNotFoundError(session_id=session_id)
        return runtime

    async def _persist_session(self, final_state: SessionState) -> None:
        """Persist a terminal session result when needed."""
        if final_state.status not in {
            GameStatus.WON,
            GameStatus.LOST,
            GameStatus.TERMINATED,
        }:
            return
        if final_state.id in self._persisted_session_ids:
            return
        async with self._session_factory() as session:
            await self._leaderboard_repository.record_session(
                session=session,
                session_state=final_state,
            )
        async with self._session_factory() as session:
            await self._replay_index_repository.record_replay(
                session=session,
                session_id=final_state.id,
                doctrine_title=final_state.doctrine.title,
                replay_path=str(self._replay_store.get_replay_path(session_id=final_state.id)),
                outcome=final_state.status.value,
            )
        self._persisted_session_ids.add(final_state.id)

    async def _monitor_runtime(self, session_id: str, runtime: SessionRuntime) -> None:
        """Persist sessions that complete naturally.

        Args:
            session_id: Session identifier.
            runtime: Runtime to monitor.

        Returns:
            None.
        """
        final_state = await runtime.wait()
        await self._persist_session(final_state=final_state)
        if final_state.status in {GameStatus.WON, GameStatus.LOST}:
            async with self._lock:
                self._runtimes.pop(session_id, None)
                self._monitor_tasks.pop(session_id, None)
