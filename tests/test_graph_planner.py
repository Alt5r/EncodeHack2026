"""Tests for LangGraph hierarchical planner."""

from __future__ import annotations

from dataclasses import dataclass

from watchtower_backend.domain.models.simulation import WindState
from watchtower_backend.services.planning.graph_planner import LangGraphPlanner
from watchtower_backend.services.planning.orchestrator import HeuristicPlanner
from watchtower_backend.services.sessions.runtime import build_initial_state


@dataclass
class _FakeTextBlock:
    type: str
    text: str


@dataclass
class _FakeAnthropicResponse:
    content: list[_FakeTextBlock]


class _FakeMessagesClient:
    def __init__(self, responses: list[str]) -> None:
        self._responses = responses
        self._index = 0

    async def create(self, **_: object) -> _FakeAnthropicResponse:
        text = self._responses[min(self._index, len(self._responses) - 1)]
        self._index += 1
        return _FakeAnthropicResponse(content=[_FakeTextBlock(type="text", text=text)])


class _FakeAnthropicClient:
    def __init__(self, responses: list[str]) -> None:
        self.messages = _FakeMessagesClient(responses)


async def test_langgraph_planner_runs_graph_and_returns_command() -> None:
    """LangGraph path should merge orchestrator + sub-agent JSON into commands."""
    state = build_initial_state(
        doctrine_text="Protect the village.",
        doctrine_title="Doctrine",
        wind=WindState(direction="NE", speed_mph=10.0),
        grid_size=24,
    )
    orch = (
        '{"missions":[{"agent_id":"heli-alpha","intent":"suppress",'
        '"target_x":4,"target_y":12,"priority":10,"reason":"lead edge"}]}'
    )
    sub = (
        '{"unit_id":"heli-alpha","action":"drop_water","target_x":4,"target_y":12,'
        '"rationale":"Suppressing.","radio_message":"Dropping on the fire now."}'
    )
    planner = LangGraphPlanner(
        orchestrator_model="fake-orch",
        subagent_model="fake-sub",
        timeout_seconds=30.0,
        max_tokens=500,
        graph_invoke_timeout_seconds=60.0,
        fallback_planner=HeuristicPlanner(),
        anthropic_client=_FakeAnthropicClient([orch, sub]),
        radio_sink=None,
        use_kiro=False,
    )

    commands = await planner.plan(session_state=state)

    assert len(commands) == 1
    assert commands[0].unit_id == "heli-alpha"
    assert commands[0].target == (4, 12)


async def test_langgraph_planner_falls_back_without_client() -> None:
    """Without Anthropic client, LangGraph planner should use heuristic fallback."""
    state = build_initial_state(
        doctrine_text="Protect the village.",
        doctrine_title="Doctrine",
        wind=WindState(direction="NE", speed_mph=10.0),
        grid_size=24,
    )
    planner = LangGraphPlanner(
        orchestrator_model="x",
        subagent_model="y",
        timeout_seconds=5.0,
        max_tokens=100,
        fallback_planner=HeuristicPlanner(),
        anthropic_client=None,
        use_kiro=False,
    )

    commands = await planner.plan(session_state=state)

    assert len(commands) >= 1


async def test_langgraph_planner_uses_kiro_path_when_enabled(monkeypatch) -> None:
    """With Kiro enabled, the planner should accept orchestrator and sub-agent JSON."""
    state = build_initial_state(
        doctrine_text="Protect the village.",
        doctrine_title="Doctrine",
        wind=WindState(direction="NE", speed_mph=10.0),
        grid_size=24,
    )
    planner = LangGraphPlanner(
        orchestrator_model="unused",
        subagent_model="unused",
        timeout_seconds=5.0,
        max_tokens=100,
        fallback_planner=HeuristicPlanner(),
        anthropic_client=None,
        use_kiro=True,
    )

    async def fake_call(agent_name: str, _: str) -> str:
        if agent_name == "watchtower-orchestrator":
            return (
                '{"missions":[{"agent_id":"heli-alpha","intent":"suppress",'
                '"target_x":4,"target_y":12,"priority":10,"reason":"lead edge"}]}'
            )
        return (
            '{"unit_id":"heli-alpha","action":"drop_water","target_x":4,"target_y":12,'
            '"rationale":"Suppressing.","radio_message":"Dropping on the fire now."}'
        )

    monkeypatch.setattr(planner, "_call_kiro", fake_call)

    commands = await planner.plan(session_state=state)

    assert len(commands) == 1
    assert commands[0].unit_id == "heli-alpha"
    assert commands[0].target == (4, 12)


async def test_langgraph_planner_accepts_orchestrator_air_support_requests(monkeypatch) -> None:
    """The Kiro orchestrator path should pass through direct air-support commands."""
    state = build_initial_state(
        doctrine_text="Protect the village.",
        doctrine_title="Doctrine",
        wind=WindState(direction="NE", speed_mph=10.0),
        grid_size=24,
    )
    planner = LangGraphPlanner(
        orchestrator_model="unused",
        subagent_model="unused",
        timeout_seconds=5.0,
        max_tokens=100,
        fallback_planner=HeuristicPlanner(),
        anthropic_client=None,
        use_kiro=True,
    )

    async def fake_call(agent_name: str, _: str) -> str:
        if agent_name == "watchtower-orchestrator":
            return (
                '{"missions":[{"agent_id":"heli-alpha","intent":"suppress","target_x":4,"target_y":12,'
                '"priority":10,"reason":"lead edge"}],'
                '"air_support_requests":[{"action":"call_air_support","payload_type":"retardant",'
                '"target_x":6,"target_y":13,"drop_start_x":4,"drop_start_y":10,"drop_end_x":8,'
                '"drop_end_y":16,"approach_points":[{"x":-8,"y":10},{"x":1,"y":12}],'
                '"priority":800,"rationale":"shield the village flank"}]}'
            )
        return (
            '{"unit_id":"heli-alpha","action":"drop_water","target_x":4,"target_y":12,'
            '"rationale":"Suppressing.","radio_message":"Dropping on the fire now."}'
        )

    monkeypatch.setattr(planner, "_call_kiro", fake_call)

    commands = await planner.plan(session_state=state)

    assert len(commands) == 2
    assert any(command.unit_id == "tower" and command.action.value == "call_air_support" for command in commands)
    assert any(command.unit_id == "heli-alpha" and command.action.value == "drop_water" for command in commands)


async def test_langgraph_planner_parses_kiro_wrapped_json(monkeypatch) -> None:
    """Kiro-style prose and fenced JSON should still produce valid commands."""
    state = build_initial_state(
        doctrine_text="Protect the village.",
        doctrine_title="Doctrine",
        wind=WindState(direction="NE", speed_mph=10.0),
        grid_size=24,
    )
    planner = LangGraphPlanner(
        orchestrator_model="unused",
        subagent_model="unused",
        timeout_seconds=5.0,
        max_tokens=100,
        fallback_planner=HeuristicPlanner(),
        anthropic_client=None,
        use_kiro=True,
    )

    async def fake_call(agent_name: str, _: str) -> str:
        if agent_name == "watchtower-orchestrator":
            return (
                "I can help with that.\n\n"
                "```json\n"
                '{"missions":[{"agent_id":"heli-alpha","intent":"suppress","target_x":4,"target_y":12,'
                '"priority":10,"reason":"lead edge"}],"air_support_requests":[]}'
                "\n```\n"
                "This assigns the helicopter to the lead edge."
            )
        return (
            "Sure.\n"
            "```json\n"
            '{"unit_id":"heli-alpha","action":"drop_water","target_x":4,"target_y":12,'
            '"rationale":"Suppressing.","radio_message":"Dropping on the fire now."}'
            "\n```\n"
            "That is the legal unit command."
        )

    monkeypatch.setattr(planner, "_call_kiro", fake_call)

    commands = await planner.plan(session_state=state)

    assert len(commands) == 1
    assert commands[0].unit_id == "heli-alpha"
    assert commands[0].action.value == "drop_water"
    assert commands[0].target == (4, 12)


async def test_langgraph_planner_filters_ground_commands_into_active_fire(monkeypatch) -> None:
    """Unsafe ground-crew targets on burning cells should be rejected before execution."""
    state = build_initial_state(
        doctrine_text="Protect the village.",
        doctrine_title="Doctrine",
        wind=WindState(direction="NE", speed_mph=10.0),
        grid_size=24,
    )
    state.fire_cells = [(14, 14)]
    planner = LangGraphPlanner(
        orchestrator_model="unused",
        subagent_model="unused",
        timeout_seconds=5.0,
        max_tokens=100,
        graph_invoke_timeout_seconds=60.0,
        fallback_planner=HeuristicPlanner(),
        anthropic_client=None,
        radio_sink=None,
        use_kiro=True,
    )

    async def fake_call(agent_name: str, _: str) -> str:
        if agent_name == "watchtower-orchestrator":
            return (
                '{"missions":[{"agent_id":"ground-1","intent":"firebreak","target_x":14,"target_y":14,'
                '"priority":10,"reason":"stop the head fire"}],"air_support_requests":[]}'
            )
        return (
            '{"unit_id":"ground-1","action":"create_firebreak","target_x":14,"target_y":14,'
            '"rationale":"Dig through the active fire.","radio_message":"Pushing into the flames."}'
        )

    monkeypatch.setattr(planner, "_call_kiro", fake_call)

    commands = await planner.plan(session_state=state)

    assert all(
        not (command.unit_id == "ground-1" and command.target in state.fire_cells)
        for command in commands
    )


async def test_langgraph_planner_ignores_inactive_units(monkeypatch) -> None:
    """Inactive crews should drop out of mission assignment and command validation."""
    state = build_initial_state(
        doctrine_text="Protect the village.",
        doctrine_title="Doctrine",
        wind=WindState(direction="NE", speed_mph=10.0),
        grid_size=24,
    )
    for unit in state.units:
        if unit.id == "ground-1":
            unit.is_active = False
            unit.status_text = "lost"
            unit.target = None

    planner = LangGraphPlanner(
        orchestrator_model="unused",
        subagent_model="unused",
        timeout_seconds=5.0,
        max_tokens=100,
        graph_invoke_timeout_seconds=60.0,
        fallback_planner=HeuristicPlanner(),
        anthropic_client=None,
        radio_sink=None,
        use_kiro=True,
    )

    async def fake_call(agent_name: str, _: str) -> str:
        if agent_name == "watchtower-orchestrator":
            return (
                '{"missions":[{"agent_id":"ground-1","intent":"firebreak","target_x":12,"target_y":12,'
                '"priority":10,"reason":"assign the lost crew"}],"air_support_requests":[]}'
            )
        return (
            '{"unit_id":"ground-1","action":"create_firebreak","target_x":12,"target_y":12,'
            '"rationale":"Continuing operations.","radio_message":"Still working the line."}'
        )

    monkeypatch.setattr(planner, "_call_kiro", fake_call)

    commands = await planner.plan(session_state=state)

    assert all(command.unit_id != "ground-1" for command in commands)
