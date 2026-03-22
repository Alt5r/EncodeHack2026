"""Session runtime tests."""

from __future__ import annotations

import asyncio

from watchtower_backend.domain.commands import UnitCommand
from watchtower_backend.domain.models.simulation import AirSupportPayload, CommandAction
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


class _AirSupportPlanner(_FakePlanner):
    async def plan(self, session_state):  # type: ignore[no-untyped-def]
        self.calls.append(session_state.tick)
        return [
            UnitCommand(
                session_id=session_state.id,
                unit_id="tower",
                action=CommandAction.CALL_AIR_SUPPORT,
                target=(12, 12),
                rationale="Dispatch a retardant line.",
                state_version=session_state.version,
                air_support_payload=AirSupportPayload.RETARDANT,
                drop_start=(8, 8),
                drop_end=(14, 14),
            )
        ]


class _FakeRadioSink:
    def __init__(self) -> None:
        self.messages = []

    async def publish(self, session_state, message):  # type: ignore[no-untyped-def]
        _ = session_state
        self.messages.append(message)


class _ClosableRadioSink(_FakeRadioSink):
    def __init__(self) -> None:
        super().__init__()
        self.closed_session_ids: list[str] = []

    async def close_session(self, session_id: str) -> None:
        self.closed_session_ids.append(session_id)


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


async def test_session_runtime_gives_ground_crews_opening_orders_while_planner_is_in_flight(tmp_path) -> None:
    """Ground crews should start moving during the opening phase even if Kiro is still thinking."""
    planner = _SlowPlanner(delay_seconds=0.2)
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
    await asyncio.sleep(0.05)
    current = runtime.session_state
    ground_1 = next(unit for unit in current.units if unit.id == "ground-1")
    ground_2 = next(unit for unit in current.units if unit.id == "ground-2")
    heli = next(unit for unit in current.units if unit.id == "heli-alpha")
    await runtime.stop()

    assert planner.calls == [0]
    assert ground_1.position != (14, 16) or ground_1.target is not None
    assert ground_2.position != (16, 14) or ground_2.target is not None
    assert heli.position == (2, 2)
    assert heli.target is None


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
    await asyncio.sleep(0.14)
    current = runtime.session_state
    heli = next(unit for unit in current.units if unit.id == "heli-alpha")
    await runtime.stop()

    assert planner.calls == [0]
    assert current.tick > 0
    assert heli.position == (5, 5)
    assert heli.target is None
    assert heli.status_text == "ready"


async def test_session_runtime_emits_air_support_radio_updates(tmp_path) -> None:
    """Air-support missions should speak on dispatch, drop, and exit."""
    planner = _AirSupportPlanner()
    radio_sink = _FakeRadioSink()
    runtime = SessionRuntime(
        session_state=build_initial_state(
            doctrine_text="Protect the village.",
            doctrine_title="Doctrine",
            wind=WindState(direction="NE", speed_mph=10.0),
            grid_size=24,
        ),
        planner=planner,
        radio_sink=radio_sink,
        replay_store=ReplayStore(root_directory=tmp_path / "replays"),
        tick_interval_seconds=0.01,
        planner_interval_seconds=99999.0,
        max_event_backlog=10,
        seed=123,
    )

    await runtime.start()
    await asyncio.sleep(0.25)
    await runtime.stop()

    texts = [message.text for message in radio_sink.messages]
    assert any(message.speaker == "Watchtower" and "inbound" in message.text for message in radio_sink.messages)
    assert any("drop underway" in text for text in texts)
    assert any("Drop complete, exiting sector." == text for text in texts)


async def test_session_runtime_closes_radio_when_session_completes(tmp_path) -> None:
    """Terminal sessions should shut down their radio stream before returning."""
    radio_sink = _ClosableRadioSink()
    runtime = SessionRuntime(
        session_state=build_initial_state(
            doctrine_text="Protect the village.",
            doctrine_title="Doctrine",
            wind=WindState(direction="NE", speed_mph=10.0),
            grid_size=24,
        ),
        planner=_FakePlanner(),
        radio_sink=radio_sink,
        replay_store=ReplayStore(root_directory=tmp_path / "replays"),
        tick_interval_seconds=0.01,
        planner_interval_seconds=99999.0,
        max_event_backlog=10,
        seed=123,
    )
    runtime.session_state.fire_cells = []

    await runtime.start()
    await asyncio.sleep(0.03)
    await runtime.wait()

    assert runtime.session_state.status.value == "won"
    assert radio_sink.closed_session_ids == [runtime.session_state.id]
