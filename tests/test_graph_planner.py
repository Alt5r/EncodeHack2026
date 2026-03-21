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
    )

    commands = await planner.plan(session_state=state)

    assert len(commands) >= 1
