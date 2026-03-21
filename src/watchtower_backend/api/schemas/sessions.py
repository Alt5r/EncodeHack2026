"""Request and response schemas for session endpoints."""

from __future__ import annotations

from pydantic import BaseModel, Field

from watchtower_backend.domain.models.simulation import (
    GameStatus,
    ScoreSummary,
    SessionState,
    VegetationType,
    WaterType,
)


class TerrainCellData(BaseModel):
    """Terrain data for a single cell, sent from the frontend."""

    elevation: float = Field(ge=0.0, le=1.0)
    vegetation: VegetationType
    water: WaterType


class SessionCreateRequest(BaseModel):
    """Request body for creating a session."""

    doctrine_text: str = Field(
        min_length=1,
        max_length=8000,
        description="Player firefighting doctrine.",
    )
    doctrine_title: str | None = Field(default=None, max_length=200)
    terrain_grid: list[list[TerrainCellData]] | None = Field(
        default=None,
        description="32x32 terrain grid computed by the frontend. Optional for backward compat.",
    )


class SessionRead(BaseModel):
    """Response model for session state."""

    id: str
    status: GameStatus
    tick: int
    doctrine_title: str
    grid_size: int
    winner: str | None
    score: ScoreSummary

    @classmethod
    def from_state(cls, session_state: SessionState) -> SessionRead:
        """Build a response model from a session state."""
        return cls(
            id=session_state.id,
            status=session_state.status,
            tick=session_state.tick,
            doctrine_title=session_state.doctrine.title,
            grid_size=session_state.grid_size,
            winner=session_state.winner,
            score=session_state.score,
        )


class SessionDetail(SessionRead):
    """Detailed response model including world state."""

    wind: dict[str, object]
    village: dict[str, object]
    units: list[dict[str, object]]
    fire_cells: list[tuple[int, int]]
    firebreak_cells: list[tuple[int, int]]

    @classmethod
    def from_state(cls, session_state: SessionState) -> SessionDetail:
        """Build a detailed response model from a session state."""
        return cls(
            **SessionRead.from_state(session_state=session_state).model_dump(),
            wind=session_state.wind.model_dump(mode="json"),
            village=session_state.village.model_dump(mode="json"),
            units=[unit.model_dump(mode="json") for unit in session_state.units],
            fire_cells=session_state.fire_cells,
            firebreak_cells=session_state.firebreak_cells,
        )
