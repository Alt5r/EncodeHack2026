"""Planner tests."""

from __future__ import annotations

from dataclasses import dataclass

from watchtower_backend.domain.models.simulation import WindState
from watchtower_backend.services.planning.orchestrator import AnthropicPlanner, HeuristicPlanner
from watchtower_backend.services.sessions.runtime import build_initial_state


@dataclass
class _FakeTextBlock:
    type: str
    text: str


@dataclass
class _FakeAnthropicResponse:
    content: list[_FakeTextBlock]


class _FakeMessagesClient:
    async def create(self, **_: object) -> _FakeAnthropicResponse:
        return _FakeAnthropicResponse(
            content=[
                _FakeTextBlock(
                    type="text",
                    text=(
                        '{"commands":[{"unit_id":"heli-alpha","action":"drop_water",'
                        '"target_x":4,"target_y":12,"rationale":"Hit the lead edge."}]}'
                    ),
                )
            ]
        )


class _FakeAnthropicClient:
    def __init__(self) -> None:
        self.messages = _FakeMessagesClient()


async def test_anthropic_planner_uses_structured_response() -> None:
    """Anthropic planner should convert JSON output into unit commands.

    Returns:
        None.
    """
    state = build_initial_state(
        doctrine_text="Protect the village.",
        doctrine_title="Doctrine",
        wind=WindState(direction="NE", speed_mph=10.0),
        grid_size=24,
    )
    planner = AnthropicPlanner(
        model="fake-model",
        timeout_seconds=1.0,
        max_tokens=100,
        fallback_planner=HeuristicPlanner(),
        anthropic_client=_FakeAnthropicClient(),
    )

    commands = await planner.plan(session_state=state)

    assert len(commands) == 1
    assert commands[0].unit_id == "heli-alpha"
    assert commands[0].target == (4, 12)


async def test_anthropic_planner_falls_back_without_client() -> None:
    """Anthropic planner should defer to the heuristic planner when disabled.

    Returns:
        None.
    """
    state = build_initial_state(
        doctrine_text="Protect the village.",
        doctrine_title="Doctrine",
        wind=WindState(direction="NE", speed_mph=10.0),
        grid_size=24,
    )
    planner = AnthropicPlanner(
        model="fake-model",
        timeout_seconds=1.0,
        max_tokens=100,
        fallback_planner=HeuristicPlanner(),
        anthropic_client=None,
    )

    commands = await planner.plan(session_state=state)

    assert len(commands) >= 1
