"""Planner implementations for WATCHTOWER sessions."""

from __future__ import annotations

import asyncio
import logging

import orjson
from anthropic import AsyncAnthropic

from watchtower_backend.domain.commands import UnitCommand
from watchtower_backend.domain.models.simulation import CommandAction, SessionState, UnitType
from watchtower_backend.services.planning.prompts import build_planner_prompt
from watchtower_backend.services.planning.schemas import PlannerResponse

logger = logging.getLogger(__name__)


class HeuristicPlanner:
    """Generate practical commands without requiring external LLM access.

    The planner prioritizes protecting the village while steering helicopters
    toward the nearest fire clusters and ground crews toward a defensive line
    above the village.

    Attributes:
        bundles_command_radio: When True, `SessionRuntime` emits one aggregate command radio line.
    """

    bundles_command_radio: bool = True

    async def plan(self, session_state: SessionState) -> list[UnitCommand]:
        """Plan the next wave of unit commands.

        Args:
            session_state: Current authoritative session state.

        Returns:
            Commands for the next simulation tick.
        """
        if not session_state.fire_cells:
            return []

        commands: list[UnitCommand] = []
        village_x, village_y = session_state.village.top_left
        sorted_fire = sorted(
            session_state.fire_cells,
            key=lambda cell: abs(cell[0] - village_x) + abs(cell[1] - village_y),
        )
        priority_fire = sorted_fire[0]

        for unit in session_state.units:
            if unit.unit_type is UnitType.ORCHESTRATOR:
                continue
            action = self._select_action(unit_type=unit.unit_type)
            target = (
                priority_fire
                if unit.unit_type is UnitType.HELICOPTER
                else (village_x - 2, village_y)
            )
            commands.append(
                UnitCommand(
                    session_id=session_state.id,
                    unit_id=unit.id,
                    action=action,
                    target=target,
                    rationale=f"{unit.label} responding to the highest-priority threat.",
                    state_version=session_state.version,
                )
            )
        return commands

    def _select_action(self, unit_type: UnitType) -> CommandAction:
        """Map unit type to the default action."""
        match unit_type:
            case UnitType.HELICOPTER:
                return CommandAction.DROP_WATER
            case UnitType.GROUND_CREW:
                return CommandAction.CREATE_FIREBREAK
            case _:
                return CommandAction.HOLD_POSITION


class AnthropicPlanner:
    """LLM-backed planner with deterministic fallback behavior.

    Attributes:
        bundles_command_radio: When True, `SessionRuntime` emits one aggregate command radio line.
    """

    bundles_command_radio: bool = True

    def __init__(
        self,
        model: str,
        timeout_seconds: float,
        max_tokens: int,
        fallback_planner: HeuristicPlanner,
        anthropic_client: AsyncAnthropic | None = None,
    ) -> None:
        """Initialize the planner.

        Args:
            model: Anthropic model identifier.
            timeout_seconds: Per-request timeout.
            max_tokens: Maximum response tokens.
            fallback_planner: Deterministic fallback planner.
            anthropic_client: Optional Anthropic client.
        """
        self._model = model
        self._timeout_seconds = timeout_seconds
        self._max_tokens = max_tokens
        self._fallback_planner = fallback_planner
        self._anthropic_client = anthropic_client

    async def plan(self, session_state: SessionState) -> list[UnitCommand]:
        """Plan commands with Anthropic, falling back on any failure.

        Args:
            session_state: Current session state snapshot.

        Returns:
            Commands for the next planner round.
        """
        if self._anthropic_client is None:
            return await self._fallback_planner.plan(session_state=session_state)

        prompt = build_planner_prompt(session_state=session_state)
        try:
            response = await asyncio.wait_for(
                self._anthropic_client.messages.create(
                    model=self._model,
                    max_tokens=self._max_tokens,
                    system=(
                        "You are a wildfire command planner. "
                        "Respond only with valid JSON matching the requested schema."
                    ),
                    messages=[{"role": "user", "content": prompt}],
                ),
                timeout=self._timeout_seconds,
            )
            content = "".join(
                block.text for block in response.content if getattr(block, "type", None) == "text"
            )
            parsed = PlannerResponse.model_validate(
                orjson.loads(_extract_json_object(raw_text=content))
            )
            commands = _convert_planner_response(
                session_state=session_state,
                planner_response=parsed,
            )
            if commands:
                return commands
        except Exception as error:
            logger.warning(
                "Anthropic planner failed; using heuristic fallback.",
                extra={"session_id": session_state.id, "error": str(error)},
            )

        return await self._fallback_planner.plan(session_state=session_state)


def _extract_json_object(raw_text: str) -> str:
    """Extract the first JSON object from a raw model response.

    Args:
        raw_text: Raw text returned by the model.

    Returns:
        Extracted JSON object string.

    Raises:
        ValueError: If no JSON object can be found.
    """
    start_index = raw_text.find("{")
    end_index = raw_text.rfind("}")
    if start_index == -1 or end_index == -1 or end_index <= start_index:
        raise ValueError("Planner response did not contain a JSON object.")
    return raw_text[start_index : end_index + 1]


def _convert_planner_response(
    session_state: SessionState,
    planner_response: PlannerResponse,
) -> list[UnitCommand]:
    """Convert planner JSON into validated unit commands.

    Args:
        session_state: Session state being planned.
        planner_response: Parsed planner response.

    Returns:
        Validated unit commands.
    """
    valid_units = {
        unit.id for unit in session_state.units if unit.unit_type is not UnitType.ORCHESTRATOR
    }
    commands: list[UnitCommand] = []
    for planner_command in planner_response.commands:
        if planner_command.unit_id not in valid_units:
            continue
        commands.append(
            UnitCommand(
                session_id=session_state.id,
                unit_id=planner_command.unit_id,
                action=planner_command.action,
                target=(planner_command.target_x, planner_command.target_y),
                rationale=planner_command.rationale,
                state_version=session_state.version,
            )
        )
    return commands
