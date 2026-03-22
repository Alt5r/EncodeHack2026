"""Structured planner schemas for LLM command generation."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from watchtower_backend.domain.models.simulation import AirSupportPayload, CommandAction


class PlannerCommandPayload(BaseModel):
    """One planner-produced command.

    Attributes:
        unit_id: Unit to command.
        action: Action to perform.
        target_x: Target row coordinate.
        target_y: Target column coordinate.
        rationale: Brief explanation for the command.
    """

    unit_id: str = Field(min_length=1, max_length=64)
    action: CommandAction
    target_x: int
    target_y: int
    rationale: str = Field(min_length=1, max_length=300)


class PlannerResponse(BaseModel):
    """Planner response envelope."""

    commands: list[PlannerCommandPayload] = Field(default_factory=list)


class MissionPayload(BaseModel):
    """Orchestrator JSON row for one unit mission."""

    agent_id: str = Field(min_length=1, max_length=64)
    intent: str = Field(min_length=1, max_length=64)
    target_x: int
    target_y: int
    priority: int = Field(default=0, ge=0, le=10_000)
    reason: str = Field(default="", max_length=500)


class CoordinatePayload(BaseModel):
    """One coordinate that may be on-map or just off-map for approach legs."""

    x: int
    y: int


class AirSupportRequestPayload(BaseModel):
    """Orchestrator JSON row for one fixed-wing mission request."""

    action: Literal["call_air_support"] = "call_air_support"
    payload_type: AirSupportPayload
    target_x: int
    target_y: int
    drop_start_x: int | None = None
    drop_start_y: int | None = None
    drop_end_x: int | None = None
    drop_end_y: int | None = None
    approach_points: list[CoordinatePayload] = Field(default_factory=list)
    priority: int = Field(default=0, ge=0, le=10_000)
    rationale: str = Field(min_length=1, max_length=300)


class OrchestratorMissionsResponse(BaseModel):
    """JSON envelope from the orchestrator model."""

    missions: list[MissionPayload] = Field(default_factory=list)
    air_support_requests: list[AirSupportRequestPayload] = Field(default_factory=list)


class SubAgentLLMPayload(BaseModel):
    """JSON from a tactical sub-agent for one mission."""

    unit_id: str = Field(min_length=1, max_length=64)
    action: CommandAction
    target_x: int
    target_y: int
    rationale: str = Field(min_length=1, max_length=300)
    radio_message: str = Field(min_length=1, max_length=500)
