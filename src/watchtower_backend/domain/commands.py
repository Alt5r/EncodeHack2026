"""Command models exchanged between planner, executor, and simulation."""

from __future__ import annotations

from pydantic import BaseModel, Field

from watchtower_backend.domain.models.simulation import CommandAction, Coordinate


class UnitCommand(BaseModel):
    """A validated unit command produced by the planner.

    Attributes:
        session_id: Session receiving the command.
        unit_id: Unit that should execute the command.
        action: Operation to apply.
        target: Target coordinate for the action.
        rationale: Human-readable explanation for transcript/debug output.
        state_version: Session version the command was planned against.
    """

    session_id: str
    unit_id: str
    action: CommandAction
    target: Coordinate
    rationale: str = Field(min_length=1, max_length=300)
    state_version: int = Field(ge=0)


class Mission(BaseModel):
    """High-level intent for one field unit, produced by the orchestrator LLM.

    Attributes:
        agent_id: Target unit id (must match a non-orchestrator unit).
        intent: Short tactical label (e.g. suppress, firebreak, reserve, reposition).
        target: Grid coordinate for the mission focus.
        priority: Higher values win when merging duplicate unit proposals.
        reason: Seed text for sub-agent radio / rationale.
    """

    agent_id: str = Field(min_length=1, max_length=64)
    intent: str = Field(min_length=1, max_length=64)
    target: Coordinate
    priority: int = Field(default=0, ge=0, le=10_000)
    reason: str = Field(default="", max_length=500)


class SubAgentResponse(BaseModel):
    """Sub-agent output: one executable command plus a radio line."""

    proposed_command: UnitCommand
    radio_message: str = Field(min_length=1, max_length=500)
