"""Session runtime tests."""

from __future__ import annotations

import asyncio

from watchtower_backend.domain.commands import UnitCommand
from watchtower_backend.domain.models.simulation import CommandAction
from watchtower_backend.persistence.replay_store import ReplayStore
from watchtower_backend.services.sessions.runtime import SessionRuntime, build_initial_state
from watchtower_backend.domain.models.simulation import WindState


class _FakePlanner:
    bundles_command_radio = False

    def __init__(self) -> None:
        self.calls: list[int] = []

    async def plan(self, session_state):  # type: ignore[no-untyped-def]
        self.calls.append(session_state.tick)
        return []


class _SlowPlanner(_FakePlanner):
    def __init__(self, delay_seconds: float) -> None:
        super().__init__()
        self._delay_seconds = delay_seconds

    async def plan(self, session_state):  # type: ignore[no-untyped-def]
        self.calls.append(session_state.tick)
        await asyncio.sleep(self._delay_seconds)
        return []


class _SlowCommandPlanner(_FakePlanner):
    def __init__(self, delay_seconds: float) -> None:
        super().__init__()
        self._delay_seconds = delay_seconds

    async def plan(self, session_state):  # type: ignore[no-untyped-def]
        self.calls.append(session_state.tick)
        await asyncio.sleep(self._delay_seconds)
        return [
            UnitCommand(
                session_id=session_state.id,
                unit_id="heli-alpha",
                action=CommandAction.MOVE,
                target=(5, 5),
                rationale="Move to the village flank.",
                state_version=session_state.version,
            )
        ]


class _FakeRadioSink:
    async def publish(self, session_state, message):  # type: ignore[no-untyped-def]
        _ = (session_state, message)


async def test_session_runtime_runs_planner_immediately(tmp_path) -> None:
    """New sessions should not wait a full planner interval before first planning."""
    planner = _FakePlanner()
    runtime = SessionRuntime(
        session_state=build_initial_state(
            doctrine_text="Protect the village.",
            doctrine_title="Doctrine",
            wind=WindState(direction="NE", speed_mph=10.0),
            grid_size=24,
        ),
        planner=planner,
        radio_sink=_FakeRadioSink(),
        replay_store=ReplayStore(root_directory=tmp_path / "replays"),
        tick_interval_seconds=0.01,
        planner_interval_seconds=99999.0,
        max_event_backlog=10,
        seed=123,
    )

    await runtime.start()
    await asyncio.sleep(0.03)
    await runtime.stop()

    assert planner.calls
    assert planner.calls[0] == 0


async def test_session_runtime_keeps_ticking_while_planner_is_in_flight(tmp_path) -> None:
    """Slow Kiro-like planning must not freeze simulation ticks or air-support progress."""
    planner = _SlowPlanner(delay_seconds=0.05)
    runtime = SessionRuntime(
        session_state=build_initial_state(
            doctrine_text="Protect the village.",
            doctrine_title="Doctrine",
            wind=WindState(direction="NE", speed_mph=10.0),
            grid_size=24,
        ),
        planner=planner,
        radio_sink=_FakeRadioSink(),
        replay_store=ReplayStore(root_directory=tmp_path / "replays"),
        tick_interval_seconds=0.01,
        planner_interval_seconds=99999.0,
        max_event_backlog=10,
        seed=123,
    )

    await runtime.start()
    await asyncio.sleep(0.03)
    current = runtime.session_state
    await runtime.stop()

    assert planner.calls == [0]
    assert current.tick > 0
    assert runtime._planner_task is None


async def test_session_runtime_applies_slow_planner_commands_once_ready(tmp_path) -> None:
    """Delayed planner commands should still be applied when they eventually arrive."""
    planner = _SlowCommandPlanner(delay_seconds=0.05)
    runtime = SessionRuntime(
        session_state=build_initial_state(
            doctrine_text="Protect the village.",
            doctrine_title="Doctrine",
            wind=WindState(direction="NE", speed_mph=10.0),
            grid_size=24,
        ),
        planner=planner,
        radio_sink=_FakeRadioSink(),
        replay_store=ReplayStore(root_directory=tmp_path / "replays"),
        tick_interval_seconds=0.01,
        planner_interval_seconds=99999.0,
        max_event_backlog=10,
        seed=123,
    )

    await runtime.start()
    await asyncio.sleep(0.09)
    current = runtime.session_state
    heli = next(unit for unit in current.units if unit.id == "heli-alpha")
    await runtime.stop()

    assert planner.calls == [0]
    assert current.tick > 0
    assert heli.target == (5, 5)
    assert heli.status_text == "moving"
