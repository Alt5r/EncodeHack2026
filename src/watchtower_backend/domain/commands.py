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
