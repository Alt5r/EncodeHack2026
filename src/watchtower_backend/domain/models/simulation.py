"""Simulation and session domain models.

This module provides:
- Core enums for unit and game state.
- Pydantic models for authoritative simulation state.
"""

from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field

type Coordinate = tuple[int, int]


class UnitType(StrEnum):
    """Supported unit types."""

    ORCHESTRATOR = "orchestrator"
    HELICOPTER = "helicopter"
    GROUND_CREW = "ground_crew"


class GameStatus(StrEnum):
    """Lifecycle states for a game session."""

    PENDING = "pending"
    RUNNING = "running"
    WON = "won"
    LOST = "lost"
    TERMINATED = "terminated"


class CommandAction(StrEnum):
    """Low-level simulation commands."""

    MOVE = "move"
    DROP_WATER = "drop_water"
    CREATE_FIREBREAK = "create_firebreak"
    HOLD_POSITION = "hold_position"
    CALL_AIR_SUPPORT = "call_air_support"


class AirSupportPayload(StrEnum):
    """Supported fixed-wing drop payloads."""

    WATER = "water"
    RETARDANT = "retardant"


class AirSupportPhase(StrEnum):
    """Lifecycle stages for transient fixed-wing missions."""

    APPROACH = "approach"
    DROP = "drop"
    EXIT = "exit"
    COMPLETE = "complete"


class VegetationType(StrEnum):
    """Vegetation types that affect fire spread rate and fuel."""

    CLEARING = "clearing"
    MEADOW = "meadow"
    WOODLAND = "woodland"
    FOREST = "forest"


class WaterType(StrEnum):
    """Water presence that blocks fire spread."""

    NONE = "none"
    WATER = "water"


class FireIntensity(StrEnum):
    """Fire intensity stages as a cell burns."""

    EMBER = "ember"
    BURNING = "burning"
    INFERNO = "inferno"


class WindState(BaseModel):
    """Wind conditions that influence fire spread.

    Attributes:
        direction: Cardinal direction code.
        speed_mph: Wind speed in miles per hour.
    """

    model_config = ConfigDict(frozen=True)

    direction: str = Field(default="NE", min_length=1, max_length=4)
    speed_mph: float = Field(default=12.0, ge=0.0, le=100.0)


class TerrainCell(BaseModel):
    """Terrain data for a single grid cell, sent from the frontend."""

    model_config = ConfigDict(frozen=True)

    elevation: float = Field(default=0.0, ge=0.0, le=1.0)
    vegetation: VegetationType = VegetationType.WOODLAND
    water: WaterType = WaterType.NONE


class VillageState(BaseModel):
    """State of the protected village asset."""

    model_config = ConfigDict(frozen=True)

    top_left: Coordinate
    size: int = Field(default=14, ge=2, le=20)
    is_intact: bool = True


class UnitState(BaseModel):
    """Authoritative state for a unit on the map."""

    id: str
    unit_type: UnitType
    label: str
    position: Coordinate
    target: Coordinate | None = None
    water_capacity: int = Field(default=0, ge=0)
    water_remaining: int = Field(default=0, ge=0)
    firebreak_strength: int = Field(default=0, ge=0)
    is_active: bool = True
    status_text: str = Field(default="ready", min_length=1, max_length=200)


class AirSupportMission(BaseModel):
    """Transient fixed-wing mission rendered separately from normal units."""

    id: str
    aircraft_model: str = Field(min_length=1, max_length=64)
    payload_type: AirSupportPayload
    approach_points: list[Coordinate] = Field(default_factory=list)
    drop_start: Coordinate
    drop_end: Coordinate
    exit_points: list[Coordinate] = Field(default_factory=list)
    phase: AirSupportPhase = AirSupportPhase.APPROACH
    progress: float = Field(default=0.0, ge=0.0, le=1.0)


class TreatedCellState(BaseModel):
    """Residual water or retardant effect on one terrain cell."""

    coordinate: Coordinate
    payload_type: AirSupportPayload
    strength: float = Field(default=1.0, ge=0.0, le=1.0)
    remaining_ticks: int = Field(default=0, ge=0)


class Doctrine(BaseModel):
    """Player-authored doctrine and metadata."""

    title: str = Field(default_factory=lambda: f"DOCTRINE-{uuid4().hex[:8].upper()}")
    text: str = Field(min_length=1, max_length=8000)


class ScoreSummary(BaseModel):
    """End-of-game score summary."""

    time_elapsed_seconds: int = Field(default=0, ge=0)
    burned_cells: int = Field(default=0, ge=0)
    suppressed_cells: int = Field(default=0, ge=0)
    firebreak_cells: int = Field(default=0, ge=0)
    village_damage: int = Field(default=0, ge=0)


class SessionState(BaseModel):
    """Authoritative state for one WATCHTOWER session."""

    id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(tz=UTC))
    status: GameStatus = GameStatus.PENDING
    tick: int = Field(default=0, ge=0)
    grid_size: int = Field(ge=16, le=128)
    doctrine: Doctrine
    wind: WindState
    village: VillageState
    units: list[UnitState]
    fire_cells: list[Coordinate]
    burned_cells: list[Coordinate] = Field(default_factory=list)
    suppressed_cells: list[Coordinate] = Field(default_factory=list)
    firebreak_cells: list[Coordinate] = Field(default_factory=list)
    air_support_missions: list[AirSupportMission] = Field(default_factory=list)
    treated_cells: list[TreatedCellState] = Field(default_factory=list)
    score: ScoreSummary = Field(default_factory=ScoreSummary)
    winner: str | None = None
    version: int = Field(default=0, ge=0)
