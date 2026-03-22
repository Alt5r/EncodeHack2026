"""Per-session runtime orchestration."""

from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from watchtower_backend.core.errors import CommandValidationError
from watchtower_backend.domain.commands import UnitCommand
from watchtower_backend.domain.events import RadioMessage, SessionEvent
from watchtower_backend.domain.models.simulation import (
    Doctrine,
    GameStatus,
    SessionState,
    TerrainCell,
    UnitState,
    UnitType,
    VillageState,
    WindState,
)
from watchtower_backend.domain.protocols import Planner, RadioSink
from watchtower_backend.persistence.replay_store import ReplayStore
from watchtower_backend.services.projections.websocket import SessionBroadcaster
from watchtower_backend.services.simulation.engine import SimulationEngine

logger = logging.getLogger(__name__)

type SessionEventListener = Callable[[SessionEvent], Awaitable[None]]


class SessionRuntime:
    """Own the active runtime for one WATCHTOWER session."""

    def __init__(
        self,
        session_state: SessionState,
        planner: Planner,
        radio_sink: RadioSink,
        replay_store: ReplayStore,
        tick_interval_seconds: float,
        planner_interval_seconds: float,
        max_event_backlog: int,
        seed: int,
        terrain_grid: list[list[TerrainCell]] | None = None,
        session_event_listener: SessionEventListener | None = None,
    ) -> None:
        """Initialize the session runtime.

        Args:
            session_state: Initial session state.
            planner: Planner implementation.
            radio_sink: Radio transcript sink.
            replay_store: Replay event persistence sink.
            tick_interval_seconds: Simulation tick interval.
            planner_interval_seconds: Planner execution interval.
            max_event_backlog: Per-subscriber queue size.
            seed: Seed for deterministic simulation behavior.
            terrain_grid: Optional terrain grid from the frontend.
            session_event_listener: Optional async hook after each session event is recorded.
        """
        self._session_state = session_state
        self._planner = planner
        self._radio_sink = radio_sink
        self._replay_store = replay_store
        self._tick_interval_seconds = tick_interval_seconds
        self._planner_interval_seconds = planner_interval_seconds
        self._engine = SimulationEngine(
            session_state=session_state, seed=seed, terrain_grid=terrain_grid,
        )
        self._broadcaster = SessionBroadcaster(max_backlog=max_event_backlog)
        self._task: asyncio.Task[None] | None = None
        self._planner_task: asyncio.Task[list[UnitCommand]] | None = None
        self._stop_event = asyncio.Event()
        self._session_event_listener = session_event_listener

    @property
    def session_state(self) -> SessionState:
        """Return current session state."""
        return self._session_state

    @property
    def broadcaster(self) -> SessionBroadcaster:
        """Return the session broadcaster."""
        return self._broadcaster

    async def start(self) -> None:
        """Start the background session loop.

        Returns:
            None.
        """
        if self._task is None:
            self._task = asyncio.create_task(
                self._run(),
                name=f"session-runtime-{self._session_state.id}",
            )

    async def stop(self, status: GameStatus = GameStatus.TERMINATED) -> SessionState:
        """Stop the background session loop.

        Args:
            status: Final status to apply when not already terminal.

        Returns:
            Final session state.
        """
        if self._session_state.status in {GameStatus.WON, GameStatus.LOST}:
            status = self._session_state.status
        else:
            self._session_state.status = status

        self._stop_event.set()
        if self._planner_task is not None:
            self._planner_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._planner_task
            self._planner_task = None
        if self._task is not None:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
        return self._session_state

    async def wait(self) -> SessionState:
        """Wait for the runtime loop to finish naturally.

        Returns:
            Final session state.
        """
        if self._task is not None:
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
        return self._session_state

    async def publish_external_event(
        self,
        event_type: str,
        payload: dict[str, object],
    ) -> None:
        """Publish an external integration event for this session.

        Args:
            event_type: Event type identifier.
            payload: Event payload.

        Returns:
            None.
        """
        await self._emit_event(event_type=event_type, payload=payload)

    async def _run(self) -> None:
        """Execute the session loop until completion."""
        await self._emit_event(
            event_type="session.started",
            payload={
                "doctrine_title": self._session_state.doctrine.title,
                "wind": self._session_state.wind.model_dump(mode="json"),
            },
        )
        # Start one planning round immediately, but do not block the simulation
        # loop on slow planner responses.
        last_plan_requested_at = datetime.now(tz=UTC) - timedelta(
            seconds=self._planner_interval_seconds
        )
        while not self._stop_event.is_set():
            commands: list[UnitCommand] = []
            now = datetime.now(tz=UTC)
            if self._planner_task is not None and self._planner_task.done():
                try:
                    commands = [
                        command.model_copy(update={"state_version": self._session_state.version})
                        for command in self._planner_task.result()
                    ]
                except asyncio.CancelledError:
                    commands = []
                except Exception:
                    logger.exception(
                        "Planner task failed unexpectedly.",
                        extra={"session_id": self._session_state.id},
                    )
                    commands = []
                self._planner_task = None
                if commands and getattr(self._planner, "bundles_command_radio", True):
                    await self._emit_planner_messages(commands=commands)

            if (
                self._planner_task is None
                and (now - last_plan_requested_at).total_seconds()
                >= self._planner_interval_seconds
            ):
                self._planner_task = asyncio.create_task(
                    self._planner.plan(
                        session_state=self._session_state.model_copy(deep=True)
                    ),
                    name=f"planner-{self._session_state.id}",
                )
                last_plan_requested_at = now

            try:
                mutations = self._engine.step(commands=commands)
            except CommandValidationError as error:
                logger.warning(
                    "Command rejected",
                    extra={"session_id": self._session_state.id, "error": str(error)},
                )
                await self._emit_event(
                    event_type="command.rejected",
                    payload={"reason": str(error)},
                )
                mutations = []

            for mutation in mutations:
                await self._emit_event(
                    event_type=f"simulation.{mutation['kind']}", payload=mutation
                )
                await self._emit_mutation_radio(mutation=mutation)

            await self._emit_snapshot()

            if self._session_state.status in {GameStatus.WON, GameStatus.LOST}:
                await self._emit_event(
                    event_type="session.completed",
                    payload={
                        "status": self._session_state.status.value,
                        "score": self._session_state.score.model_dump(mode="json"),
                    },
                )
                return

            await asyncio.sleep(self._tick_interval_seconds)

    async def _emit_planner_messages(self, commands: list[UnitCommand]) -> None:
        """Publish radio transcript for planner decisions."""
        if not commands:
            return

        text = " ".join(
            f"{command.unit_id} -> {command.action.value} {command.target}" for command in commands
        )
        radio_message = RadioMessage(
            speaker="Command",
            voice_key="command",
            text=text,
        )
        await self._radio_sink.publish(
            session_state=self._session_state,
            message=radio_message,
        )

    async def _emit_mutation_radio(self, mutation: dict[str, object]) -> None:
        """Publish radio lines for high-signal simulation mutations."""
        kind = str(mutation.get("kind", ""))
        radio_message: RadioMessage | None = None

        if kind == "air_support_dispatched":
            aircraft_model = str(mutation.get("aircraft_model", "Airtanker"))
            payload_type = str(mutation.get("payload_type", "retardant"))
            drop_start = self._format_coordinate(mutation.get("drop_start"))
            drop_end = self._format_coordinate(mutation.get("drop_end"))
            route_text = (
                f" Run from grid {drop_start} to {drop_end}."
                if drop_start is not None and drop_end is not None
                else ""
            )
            radio_message = RadioMessage(
                speaker="Watchtower",
                voice_key="command",
                text=f"{aircraft_model} inbound with {payload_type}.{route_text}",
            )

        elif kind == "air_support_drop":
            aircraft_model = str(mutation.get("aircraft_model", "Airtanker"))
            payload_type = str(mutation.get("payload_type", "retardant"))
            drop_start = self._format_coordinate(mutation.get("drop_start"))
            drop_end = self._format_coordinate(mutation.get("drop_end"))
            route_text = (
                f" from grid {drop_start} to {drop_end}"
                if drop_start is not None and drop_end is not None
                else ""
            )
            radio_message = RadioMessage(
                speaker=aircraft_model,
                voice_key="helicopter",
                text=f"{payload_type.title()} drop underway{route_text}.",
            )

        elif kind == "air_support_completed":
            aircraft_model = str(mutation.get("aircraft_model", "Airtanker"))
            radio_message = RadioMessage(
                speaker=aircraft_model,
                voice_key="helicopter",
                text="Drop complete, exiting sector.",
            )

        elif kind == "unit_killed":
            label = str(mutation.get("label", "Ground crew"))
            radio_message = RadioMessage(
                speaker="Watchtower",
                voice_key="command",
                text=f"{label} is overrun. Marking unit lost.",
            )

        if radio_message is None:
            return
        await self._radio_sink.publish(
            session_state=self._session_state,
            message=radio_message,
        )

    def _format_coordinate(self, value: object) -> str | None:
        """Render one coordinate payload as a compact grid string."""
        if isinstance(value, (list, tuple)) and len(value) == 2:
            try:
                x = int(value[0])
                y = int(value[1])
            except (TypeError, ValueError):
                return None
            return f"{x},{y}"
        return None

    async def _emit_event(self, event_type: str, payload: dict[str, object]) -> None:
        """Emit one typed session event."""
        event = SessionEvent(
            type=event_type,
            session_id=self._session_state.id,
            tick=self._session_state.tick,
            payload=payload,
        )
        await self._broadcaster.publish_event(event=event)
        await self._replay_store.append(event=event)
        if self._session_event_listener is not None:
            await self._session_event_listener(event)

    async def _emit_snapshot(self) -> None:
        """Broadcast the latest session snapshot."""
        await self._broadcaster.publish_snapshot(snapshot=self.snapshot())

    def snapshot(self) -> dict[str, object]:
        """Return a JSON-serializable snapshot."""
        return self._session_state.model_dump(mode="json")


def build_initial_state(
    doctrine_text: str,
    doctrine_title: str | None,
    wind: WindState,
    grid_size: int,
) -> SessionState:
    """Construct the initial session state for a new game.

    Args:
        doctrine_text: User-provided doctrine.
        doctrine_title: Optional doctrine title.
        wind: Initial wind state.
        grid_size: Square map size.

    Returns:
        Initial session state.
    """
    doctrine = (
        Doctrine(text=doctrine_text)
        if doctrine_title is None
        else Doctrine(text=doctrine_text, title=doctrine_title)
    )
    session_id = uuid4().hex
    village_top_left = (40, 38)
    units = [
        UnitState(
            id="tower",
            unit_type=UnitType.ORCHESTRATOR,
            label="Watchtower",
            position=(grid_size // 2, grid_size // 2),
        ),
        UnitState(
            id="heli-alpha",
            unit_type=UnitType.HELICOPTER,
            label="Alpha",
            position=(2, 2),
            water_capacity=6,
            water_remaining=6,
        ),
        UnitState(
            id="heli-bravo",
            unit_type=UnitType.HELICOPTER,
            label="Bravo",
            position=(2, 4),
            water_capacity=6,
            water_remaining=6,
        ),
        UnitState(
            id="ground-1",
            unit_type=UnitType.GROUND_CREW,
            label="Ground 1",
            position=(grid_size - 10, grid_size - 8),
            firebreak_strength=3,
        ),
        UnitState(
            id="ground-2",
            unit_type=UnitType.GROUND_CREW,
            label="Ground 2",
            position=(grid_size - 8, grid_size - 10),
            firebreak_strength=3,
        ),
    ]
    return SessionState(
        id=session_id,
        grid_size=grid_size,
        doctrine=doctrine,
        wind=wind,
        village=VillageState(top_left=village_top_left),
        units=units,
        fire_cells=[(2, grid_size // 2)],
    )
