"""Deterministic wildfire simulation engine."""

from __future__ import annotations

import math
from dataclasses import dataclass
from heapq import heappop, heappush
from random import Random

from watchtower_backend.core.errors import CommandValidationError
from watchtower_backend.domain.commands import UnitCommand
from watchtower_backend.domain.models.simulation import (
    AirSupportPayload,
    AirSupportPhase,
    CommandAction,
    Coordinate,
    FireIntensity,
    GameStatus,
    SessionState,
    TerrainCell,
    TreatedCellState,
    UnitState,
    UnitType,
    VegetationType,
    WaterType,
)
from watchtower_backend.services.simulation.air_support import (
    PAYLOAD_SETTINGS,
    build_drop_corridor,
    build_fallback_air_support_mission,
    get_mission_progress_per_tick,
)
from watchtower_backend.services.planning.safety import safe_ground_candidates

# --- Wind direction unit vectors ---
_WIND_VECTORS: dict[str, tuple[float, float]] = {
    "N": (0.0, -1.0),
    "NE": (0.7071, -0.7071),
    "E": (1.0, 0.0),
    "SE": (0.7071, 0.7071),
    "S": (0.0, 1.0),
    "SW": (-0.7071, 0.7071),
    "W": (-1.0, 0.0),
    "NW": (-0.7071, -0.7071),
}

# --- Vegetation spread multipliers ---
_VEGETATION_SPREAD: dict[VegetationType, float] = {
    VegetationType.CLEARING: 0.3,
    VegetationType.MEADOW: 0.6,
    VegetationType.WOODLAND: 1.0,
    VegetationType.FOREST: 1.4,
}

# --- Base fuel by vegetation ---
_VEGETATION_FUEL: dict[VegetationType, float] = {
    VegetationType.CLEARING: 0.2,
    VegetationType.MEADOW: 0.5,
    VegetationType.WOODLAND: 0.8,
    VegetationType.FOREST: 1.0,
}

# --- Base moisture (uniform, boosted near water) ---
_BASE_MOISTURE = 0.3

# --- Intensity config ---
_INTENSITY_SPREAD: dict[FireIntensity, float] = {
    FireIntensity.EMBER: 0.3,
    FireIntensity.BURNING: 1.0,
    FireIntensity.INFERNO: 1.5,
}

_INTENSITY_FUEL_CONSUMPTION: dict[FireIntensity, float] = {
    FireIntensity.EMBER: 0.015,
    FireIntensity.BURNING: 0.03,
    FireIntensity.INFERNO: 0.06,
}

_INTENSITY_SUPPRESS_CHANCE: dict[FireIntensity, float] = {
    FireIntensity.EMBER: 1.0,
    FireIntensity.BURNING: 0.8,
    FireIntensity.INFERNO: 0.5,
}

# --- Spread constants ---
_BASE_RATE = 0.096
_MAX_SPREAD_PROB = 0.65
_DIAGONAL_PENALTY = 0.7

# --- Unit movement (kept separate from fire timing) ---
_UNIT_MOVE_STEPS_PER_TICK: dict[UnitType, int] = {
    UnitType.HELICOPTER: 1,
    UnitType.GROUND_CREW: 2,
}

_GROUND_CREW_MOVE_BUDGET_PER_TICK = 2.6
_GROUND_CREW_DIAGONAL_COST = 0.15
_GROUND_CREW_MAX_SLOPE_COST = 0.75
_GROUND_CREW_FIRE_EDGE_PENALTY = 0.9
_GROUND_CREW_FIRE_NEARBY_PENALTY = 0.3
_GROUND_CREW_WATER_EDGE_PENALTY = 0.55
_GROUND_CREW_WATER_NEARBY_PENALTY = 0.2
_GROUND_CREW_MAX_STEP_COST = 2.35
_MIN_TICKS_BEFORE_TOTAL_EXTINGUISH = 10
_PERSISTENT_HOTSPOT_FUEL = 0.08
_PERSISTENT_HOTSPOT_MOISTURE = 0.3

# 8-directional offsets: (dx, dy, is_diagonal)
_NEIGHBOURS: list[tuple[int, int, bool]] = [
    (1, 0, False),
    (-1, 0, False),
    (0, 1, False),
    (0, -1, False),
    (1, 1, True),
    (1, -1, True),
    (-1, 1, True),
    (-1, -1, True),
]


@dataclass
class _CellFireState:
    """Internal fire state for a burning cell."""

    fuel: float
    moisture: float
    burn_ticks: int = 0
    intensity: FireIntensity = FireIntensity.EMBER


class SimulationEngine:
    """Owns authoritative mutation of the simulation state."""

    def __init__(
        self,
        session_state: SessionState,
        seed: int,
        terrain_grid: list[list[TerrainCell]] | None = None,
    ) -> None:
        """Initialize the simulation engine.

        Args:
            session_state: Initial session state.
            seed: Deterministic seed used for fire spread.
            terrain_grid: Optional terrain grid from the frontend.
                          Falls back to random woodland terrain for backward compat.
        """
        self._session_state = session_state
        self._random = Random(seed)
        self._grid_size = session_state.grid_size

        # Store terrain grid (frontend-provided or generated fallback)
        if terrain_grid is not None:
            self._terrain_grid = terrain_grid
        else:
            self._terrain_grid = self._generate_fallback_terrain()

        self._water_cells: set[Coordinate] = {
            (col, row)
            for row in range(self._grid_size)
            for col in range(self._grid_size)
            if self._terrain_grid[row][col].water != WaterType.NONE
        }

        # Precompute water proximity moisture boost
        self._moisture_boost = self._compute_moisture_boost()
        self._ground_water_penalty = self._compute_ground_water_penalty()

        # Initialize internal fire state for existing fire cells
        self._fire_states: dict[Coordinate, _CellFireState] = {}
        for cell in session_state.fire_cells:
            self._fire_states[cell] = self._make_fire_state(cell)
        self._new_air_support_mission_ids: set[str] = set()

    @property
    def session_state(self) -> SessionState:
        """Return the authoritative session state."""
        return self._session_state

    def step(self, commands: list[UnitCommand]) -> list[dict[str, object]]:
        """Advance the simulation by one tick.

        Args:
            commands: Validated commands to apply for this tick.

        Returns:
            Human-readable mutation records for event emission.
        """
        if self._session_state.status not in {GameStatus.PENDING, GameStatus.RUNNING}:
            return []

        self._session_state.status = GameStatus.RUNNING
        self._session_state.tick += 1
        self._session_state.version += 1

        mutation_records: list[dict[str, object]] = []
        mutation_records.extend(self._resolve_ground_crew_casualties())
        self._new_air_support_mission_ids = set()
        for command in commands:
            try:
                mutation_records.extend(self._apply_command(command=command))
            except CommandValidationError as error:
                mutation_records.append(
                    {
                        "kind": "command_rejected",
                        "unit_id": command.unit_id,
                        "action": command.action.value,
                        "reason": str(error),
                    }
                )

        mutation_records.extend(self._advance_units())
        self._decay_treated_cells()
        mutation_records.extend(
            self._advance_air_support_missions(
                newly_created_ids=self._new_air_support_mission_ids
            )
        )

        # Advance burning cells (consume fuel, update intensity, burn out)
        burned_out = self._advance_burning_cells()

        # Spread fire to neighbours
        new_fire_cells = self._spread_fire()

        if new_fire_cells or burned_out:
            mutation_records.append({
                "kind": "fire_spread",
                "cells": new_fire_cells,
                "burned_out": burned_out,
            })
        mutation_records.extend(self._resolve_ground_crew_casualties())

        self._update_score()
        self._update_game_status()
        return mutation_records

    # --- Terrain ---

    def _generate_fallback_terrain(self) -> list[list[TerrainCell]]:
        """Generate random woodland terrain for backward compatibility."""
        grid: list[list[TerrainCell]] = []
        for _ in range(self._grid_size):
            row: list[TerrainCell] = []
            for _ in range(self._grid_size):
                elevation = self._random.random()
                row.append(TerrainCell(
                    elevation=elevation,
                    vegetation=VegetationType.WOODLAND,
                    water=WaterType.NONE,
                ))
            grid.append(row)
        return grid

    def _compute_moisture_boost(self) -> dict[Coordinate, float]:
        """Precompute moisture boost from water proximity."""
        boost: dict[Coordinate, float] = {}
        for wx, wy in self._water_cells:
            for dx in range(-2, 3):
                for dy in range(-2, 3):
                    nx, ny = wx + dx, wy + dy
                    if 0 <= nx < self._grid_size and 0 <= ny < self._grid_size:
                        coord = (nx, ny)
                        if coord in self._water_cells:
                            continue
                        dist = max(abs(dx), abs(dy))
                        if dist == 1:
                            boost[coord] = max(boost.get(coord, 0.0), 0.7)
                        elif dist == 2:
                            boost[coord] = max(boost.get(coord, 0.0), 0.5)
        return boost

    def _compute_ground_water_penalty(self) -> dict[Coordinate, float]:
        """Precompute traversal slowdowns for cells near water."""
        penalties: dict[Coordinate, float] = {}
        for wx, wy in self._water_cells:
            for dx in range(-2, 3):
                for dy in range(-2, 3):
                    nx, ny = wx + dx, wy + dy
                    if not (0 <= nx < self._grid_size and 0 <= ny < self._grid_size):
                        continue
                    coord = (nx, ny)
                    if coord in self._water_cells:
                        continue
                    dist = max(abs(dx), abs(dy))
                    if dist == 1:
                        penalties[coord] = max(
                            penalties.get(coord, 0.0),
                            _GROUND_CREW_WATER_EDGE_PENALTY,
                        )
                    elif dist == 2:
                        penalties[coord] = max(
                            penalties.get(coord, 0.0),
                            _GROUND_CREW_WATER_NEARBY_PENALTY,
                        )
        return penalties

    def _get_terrain(self, coord: Coordinate) -> TerrainCell:
        """Return the terrain cell at a coordinate."""
        return self._terrain_grid[coord[1]][coord[0]]

    def _get_cell_moisture(self, coord: Coordinate) -> float:
        """Return effective moisture for a cell (base + water proximity boost)."""
        moisture = self._moisture_boost.get(coord, _BASE_MOISTURE)
        treated = self._get_treated_cell(coord)
        if treated is not None:
            moisture = max(
                moisture,
                min(
                    1.0,
                    _BASE_MOISTURE
                    + PAYLOAD_SETTINGS[treated.payload_type].moisture_boost * treated.strength,
                ),
            )
        return moisture

    def _get_treated_cell(self, coord: Coordinate) -> TreatedCellState | None:
        """Return the lingering treatment state for one cell, if any."""
        return next(
            (cell for cell in self._session_state.treated_cells if cell.coordinate == coord),
            None,
        )

    # --- Fire state management ---

    def _make_fire_state(self, coord: Coordinate) -> _CellFireState:
        """Create initial fire state for a newly ignited cell."""
        terrain = self._get_terrain(coord)
        return _CellFireState(
            fuel=_VEGETATION_FUEL[terrain.vegetation],
            moisture=self._get_cell_moisture(coord),
        )

    def _advance_burning_cells(self) -> list[Coordinate]:
        """Advance burn ticks, consume fuel, update intensity. Return burned-out cells."""
        burned_out: list[Coordinate] = []
        to_remove: list[Coordinate] = []
        active_fire = set(self._session_state.fire_cells)

        for coord, fire_state in self._fire_states.items():
            # Consume fuel
            fire_state.fuel -= _INTENSITY_FUEL_CONSUMPTION[fire_state.intensity]
            fire_state.burn_ticks += 1

            # Check burn-out
            if fire_state.fuel <= 0.0:
                fire_state.fuel = 0.0
                to_remove.append(coord)
                burned_out.append(coord)
                continue

            # Update intensity (only progresses upward, never drops back)
            if fire_state.intensity != FireIntensity.INFERNO:
                terrain = self._get_terrain(coord)
                if (
                    fire_state.burn_ticks >= 5
                    and terrain.vegetation == VegetationType.FOREST
                    and fire_state.fuel > 0.5
                ):
                    fire_state.intensity = FireIntensity.INFERNO
                elif fire_state.burn_ticks >= 2:
                    fire_state.intensity = FireIntensity.BURNING

        if to_remove and not self._total_extinguish_unlocked():
            survivors = active_fire.difference(to_remove)
            if not survivors:
                hotspot = self._pick_hotspot_survivor(to_remove)
                if hotspot is not None:
                    to_remove.remove(hotspot)
                    burned_out.remove(hotspot)
                    self._stabilize_hotspot(hotspot)

        # Move burned-out cells
        for coord in to_remove:
            del self._fire_states[coord]
            if coord in self._session_state.fire_cells:
                self._session_state.fire_cells.remove(coord)
            if coord not in self._session_state.burned_cells:
                self._session_state.burned_cells.append(coord)

        return sorted(burned_out)

    # --- Fire spread ---

    def _spread_fire(self) -> list[Coordinate]:
        """Spread fire to neighbouring cells using the terrain-aware formula.

        Returns:
            Newly ignited cells.
        """
        active_fire = set(self._session_state.fire_cells)
        firebreaks = set(self._session_state.firebreak_cells)
        burned = set(self._session_state.burned_cells)
        suppressed = set(self._session_state.suppressed_cells)
        new_cells: set[Coordinate] = set()

        # Resolve wind vector
        wind = self._session_state.wind
        wind_vec = _WIND_VECTORS.get(wind.direction, (0.0, 0.0))

        # Snapshot current fire cells (don't iterate over a changing set)
        current_fire = list(active_fire)

        for source in current_fire:
            fire_state = self._fire_states.get(source)
            if fire_state is None:
                continue

            source_terrain = self._get_terrain(source)

            for dx, dy, is_diagonal in _NEIGHBOURS:
                nx, ny = source[0] + dx, source[1] + dy

                # Bounds check
                if not (0 <= nx < self._grid_size and 0 <= ny < self._grid_size):
                    continue

                neighbour: Coordinate = (nx, ny)

                # Skip already burning, firebreak, burned-out, or suppressed
                if neighbour in active_fire or neighbour in firebreaks:
                    continue
                if neighbour in burned or neighbour in suppressed:
                    continue
                if neighbour in new_cells:
                    continue

                # Water blocks fire completely
                target_terrain = self._get_terrain(neighbour)
                if target_terrain.water != WaterType.NONE:
                    continue
                if is_diagonal and self._fire_diagonal_transition_blocked(
                    source=source,
                    target=neighbour,
                    firebreaks=firebreaks,
                ):
                    continue

                prob = self._calc_spread_probability(
                    source=source,
                    target=neighbour,
                    source_terrain=source_terrain,
                    target_terrain=target_terrain,
                    fire_state=fire_state,
                    wind_vec=wind_vec,
                    wind_speed=wind.speed_mph,
                    is_diagonal=is_diagonal,
                )

                if self._random.random() < prob:
                    new_cells.add(neighbour)

        # Apply new ignitions
        for cell in sorted(new_cells):
            self._session_state.fire_cells.append(cell)
            self._fire_states[cell] = self._make_fire_state(cell)

        return sorted(new_cells)

    def _calc_spread_probability(
        self,
        source: Coordinate,
        target: Coordinate,
        source_terrain: TerrainCell,
        target_terrain: TerrainCell,
        fire_state: _CellFireState,
        wind_vec: tuple[float, float],
        wind_speed: float,
        is_diagonal: bool,
    ) -> float:
        """Calculate probability of fire spreading from source to target.

        P(spread) = BASE_RATE x vegetation x wind x slope x moisture x diagonal x intensity
        Clamped to [0.0, MAX_SPREAD_PROB].
        """
        # Vegetation factor (target cell)
        veg_factor = _VEGETATION_SPREAD[target_terrain.vegetation]

        # Wind factor: dot product of spread direction and wind vector
        spread_dx = float(target[0] - source[0])
        spread_dy = float(target[1] - source[1])
        spread_len = math.sqrt(spread_dx * spread_dx + spread_dy * spread_dy)
        if spread_len > 0:
            spread_dx /= spread_len
            spread_dy /= spread_len
        alignment = spread_dx * wind_vec[0] + spread_dy * wind_vec[1]
        wind_factor = max(0.1, min(3.0, 1.0 + alignment * (wind_speed / 20.0)))

        # Slope factor: elevation delta between source and target
        elev_delta = target_terrain.elevation - source_terrain.elevation
        if elev_delta > 0:
            slope_factor = 1.0 + elev_delta * 8.0  # Fire races uphill
        else:
            slope_factor = 1.0 + elev_delta * 3.0  # Slower downhill
        slope_factor = max(0.2, min(3.0, slope_factor))

        # Moisture factor (target cell)
        target_moisture = self._get_cell_moisture(target)
        moisture_factor = 1.0 - (target_moisture * 0.8)
        treated = self._get_treated_cell(target)
        treatment_factor = 1.0
        if treated is not None:
            treatment_factor = max(
                0.2,
                1.0 - PAYLOAD_SETTINGS[treated.payload_type].spread_reduction * treated.strength,
            )

        # Diagonal penalty
        diagonal_factor = _DIAGONAL_PENALTY if is_diagonal else 1.0

        # Intensity factor (source cell)
        intensity_factor = _INTENSITY_SPREAD[fire_state.intensity]

        prob = (
            _BASE_RATE
            * veg_factor
            * wind_factor
            * slope_factor
            * moisture_factor
            * treatment_factor
            * diagonal_factor
            * intensity_factor
        )
        return max(0.0, min(_MAX_SPREAD_PROB, prob))

    # --- Suppression ---

    def _suppress_fire(self, center: Coordinate, radius: int) -> list[Coordinate]:
        """Suppress fire cells near a target location.

        Intensity-aware: higher intensity fires are harder to suppress.
        """
        suppressed: list[Coordinate] = []
        remaining_fire: list[Coordinate] = []
        fire_set = set(self._session_state.fire_cells)

        for cell in fire_set:
            if abs(cell[0] - center[0]) <= radius and abs(cell[1] - center[1]) <= radius:
                fire_state = self._fire_states.get(cell)
                suppress_chance = 1.0
                if fire_state is not None:
                    suppress_chance = _INTENSITY_SUPPRESS_CHANCE[fire_state.intensity]

                if self._random.random() < suppress_chance:
                    suppressed.append(cell)
                    # Clean up fire state
                    self._fire_states.pop(cell, None)
                else:
                    remaining_fire.append(cell)
            else:
                remaining_fire.append(cell)

        if suppressed and not self._total_extinguish_unlocked() and not remaining_fire:
            hotspot = self._pick_hotspot_survivor(suppressed, focus=center)
            if hotspot is not None:
                suppressed.remove(hotspot)
                remaining_fire.append(hotspot)
                self._stabilize_hotspot(hotspot)

        self._session_state.fire_cells = sorted(remaining_fire)
        self._session_state.suppressed_cells.extend(suppressed)
        return sorted(suppressed)

    # --- Commands ---

    def _apply_command(self, command: UnitCommand) -> list[dict[str, object]]:
        """Apply a single command to the simulation state.

        Args:
            command: Command to apply.

        Returns:
            Mutation records.

        Raises:
            CommandValidationError: If the command cannot be applied.
        """
        unit = self._get_unit(unit_id=command.unit_id)
        if command.state_version < self._session_state.version - 1:
            raise CommandValidationError("Command was planned against stale state.")

        target = self._clamp_coordinate(command.target)
        match command.action:
            case CommandAction.MOVE:
                if unit.unit_type is UnitType.GROUND_CREW and target in self._session_state.fire_cells:
                    raise CommandValidationError("Ground crews cannot move into active fire.")
                if unit.unit_type is UnitType.GROUND_CREW and not self._ground_target_reachable(
                    origin=unit.position,
                    target=target,
                ):
                    raise CommandValidationError(
                        "Ground crews cannot safely reach that target without crossing fire or water."
                    )
                unit.target = target
                unit.status_text = "moving"
                return []
            case CommandAction.DROP_WATER:
                if unit.unit_type is not UnitType.HELICOPTER:
                    raise CommandValidationError("Only helicopters can drop water.")
                if unit.water_remaining <= 0:
                    raise CommandValidationError("Helicopter is out of water.")
                unit.target = target
                unit.status_text = "suppressing"
                return []
            case CommandAction.CREATE_FIREBREAK:
                if unit.unit_type is not UnitType.GROUND_CREW:
                    raise CommandValidationError("Only ground crews can create firebreaks.")
                preview_cells = self._preview_firebreak(center=target)
                if any(cell in self._session_state.fire_cells for cell in preview_cells):
                    raise CommandValidationError(
                        "Ground crews cannot cut firebreaks through active fire."
                    )
                if not self._ground_target_reachable(origin=unit.position, target=target):
                    raise CommandValidationError(
                        "Ground crews cannot safely reach that firebreak position."
                    )
                unit.target = target
                unit.status_text = "laying firebreak"
                return []
            case CommandAction.HOLD_POSITION:
                unit.target = None
                unit.status_text = "holding"
                return [{"kind": "unit_holding", "unit_id": unit.id, "position": unit.position}]
            case CommandAction.CALL_AIR_SUPPORT:
                if unit.unit_type is not UnitType.ORCHESTRATOR:
                    raise CommandValidationError("Only the watchtower can dispatch air support.")
                if command.air_support_payload is None:
                    raise CommandValidationError("Air-support command is missing its payload type.")
                if self._session_state.air_support_missions:
                    raise CommandValidationError(
                        "Air-support mission already active; wait for the current run to finish."
                    )
                mission = build_fallback_air_support_mission(
                    self._session_state,
                    seed=self._random.randrange(1_000_000),
                    payload_type=command.air_support_payload,
                    focus_target=target,
                    approach_points=command.approach_points or None,
                    drop_start=command.drop_start,
                    drop_end=command.drop_end,
                )
                if mission is None:
                    raise CommandValidationError("Cannot dispatch air support without a target or active fire.")
                self._session_state.air_support_missions.append(mission)
                self._new_air_support_mission_ids.add(mission.id)
                unit.target = target
                unit.status_text = "dispatching air support"
                return [
                    {
                        "kind": "air_support_dispatched",
                        "unit_id": unit.id,
                        "mission_id": mission.id,
                        "aircraft_model": mission.aircraft_model,
                        "payload_type": mission.payload_type.value,
                        "drop_start": mission.drop_start,
                        "drop_end": mission.drop_end,
                        "target": target,
                    }
                ]

    # --- Helpers ---

    def _decay_treated_cells(self) -> None:
        """Decay long-lived water and retardant treatment over time."""
        next_cells: list[TreatedCellState] = []
        for cell in self._session_state.treated_cells:
            remaining_ticks = cell.remaining_ticks - 1
            if remaining_ticks <= 0:
                continue
            multiplier = 0.96 if cell.payload_type is AirSupportPayload.RETARDANT else 0.9
            next_cells.append(
                cell.model_copy(
                    update={
                        "remaining_ticks": remaining_ticks,
                        "strength": max(0.15, cell.strength * multiplier),
                    }
                )
            )
        self._session_state.treated_cells = next_cells

    def _merge_treated_cells(self, incoming: list[TreatedCellState]) -> None:
        """Merge fresh treatment onto the existing lingering strip state."""
        merged: dict[Coordinate, TreatedCellState] = {
            cell.coordinate: cell for cell in self._session_state.treated_cells
        }
        for cell in incoming:
            existing = merged.get(cell.coordinate)
            if existing is None:
                merged[cell.coordinate] = cell
                continue
            stronger = (
                cell.payload_type
                if PAYLOAD_SETTINGS[cell.payload_type].duration_ticks
                >= PAYLOAD_SETTINGS[existing.payload_type].duration_ticks
                else existing.payload_type
            )
            merged[cell.coordinate] = TreatedCellState(
                coordinate=cell.coordinate,
                payload_type=stronger,
                strength=max(existing.strength, cell.strength),
                remaining_ticks=max(existing.remaining_ticks, cell.remaining_ticks),
            )
        self._session_state.treated_cells = list(merged.values())

    def _apply_air_support_drop(self, mission) -> dict[str, object]:  # type: ignore[no-untyped-def]
        """Apply one fixed-wing drop run to the terrain and active fire."""
        corridor = build_drop_corridor(
            mission.drop_start,
            mission.drop_end,
            self._grid_size,
            width=1,
        )
        settings = PAYLOAD_SETTINGS[mission.payload_type]
        treated_cells: list[TreatedCellState] = []
        suppressed: list[Coordinate] = []
        cooled: list[Coordinate] = []

        for cell in corridor:
            terrain = self._get_terrain(cell)
            if terrain.water == WaterType.NONE:
                treated_cells.append(
                    TreatedCellState(
                        coordinate=cell,
                        payload_type=mission.payload_type,
                        strength=1.0 if mission.payload_type is AirSupportPayload.RETARDANT else 0.9,
                        remaining_ticks=settings.duration_ticks,
                    )
                )

            fire_state = self._fire_states.get(cell)
            if fire_state is None:
                continue

            if self._random.random() < settings.direct_suppress_chance:
                suppressed.append(cell)
                continue

            fire_state.fuel = max(
                0.05,
                fire_state.fuel - (0.18 if mission.payload_type is AirSupportPayload.RETARDANT else 0.3),
            )
            fire_state.moisture = max(fire_state.moisture, 0.7)
            if fire_state.intensity is FireIntensity.INFERNO and fire_state.fuel < 0.6:
                fire_state.intensity = FireIntensity.BURNING
            cooled.append(cell)

        if treated_cells:
            self._merge_treated_cells(treated_cells)

        if suppressed:
            suppressed_set = set(suppressed)
            if not self._total_extinguish_unlocked():
                remaining_fire = [
                    cell for cell in self._session_state.fire_cells if cell not in suppressed_set
                ]
                if not remaining_fire:
                    focus = (
                        (mission.drop_start[0] + mission.drop_end[0]) // 2,
                        (mission.drop_start[1] + mission.drop_end[1]) // 2,
                    )
                    hotspot = self._pick_hotspot_survivor(sorted(suppressed_set), focus=focus)
                    if hotspot is not None:
                        suppressed_set.discard(hotspot)
                        self._stabilize_hotspot(hotspot)
            self._session_state.fire_cells = [
                cell for cell in self._session_state.fire_cells if cell not in suppressed_set
            ]
            self._session_state.suppressed_cells.extend(sorted(suppressed_set))
            for cell in suppressed_set:
                self._fire_states.pop(cell, None)

        return {
            "kind": "air_support_drop",
            "mission_id": mission.id,
            "aircraft_model": mission.aircraft_model,
            "payload_type": mission.payload_type.value,
            "drop_start": mission.drop_start,
            "drop_end": mission.drop_end,
            "cells": corridor,
            "suppressed": sorted(set(suppressed)),
            "cooled": sorted(set(cooled)),
        }

    def _advance_air_support_missions(
        self,
        *,
        newly_created_ids: set[str],
    ) -> list[dict[str, object]]:
        """Advance transient air-support missions and emit drop events."""
        next_missions = []
        mutations: list[dict[str, object]] = []

        for mission in self._session_state.air_support_missions:
            if mission.id in newly_created_ids:
                next_missions.append(mission)
                continue

            progress = min(1.0, mission.progress + get_mission_progress_per_tick(mission.phase))
            if mission.phase is AirSupportPhase.APPROACH:
                if progress >= 1.0:
                    drop_mission = mission.model_copy(
                        update={"phase": AirSupportPhase.DROP, "progress": 0.0}
                    )
                    mutations.append(self._apply_air_support_drop(drop_mission))
                    next_missions.append(drop_mission)
                else:
                    next_missions.append(mission.model_copy(update={"progress": progress}))
                continue

            if mission.phase is AirSupportPhase.DROP:
                if progress >= 1.0:
                    next_missions.append(
                        mission.model_copy(update={"phase": AirSupportPhase.EXIT, "progress": 0.0})
                    )
                else:
                    next_missions.append(mission.model_copy(update={"progress": progress}))
                continue

            if mission.phase is AirSupportPhase.EXIT:
                if progress < 1.0:
                    next_missions.append(mission.model_copy(update={"progress": progress}))
                else:
                    mutations.append(
                        {
                            "kind": "air_support_completed",
                            "mission_id": mission.id,
                            "aircraft_model": mission.aircraft_model,
                            "payload_type": mission.payload_type.value,
                            "drop_start": mission.drop_start,
                            "drop_end": mission.drop_end,
                        }
                    )

        self._session_state.air_support_missions = next_missions
        tower = next((unit for unit in self._session_state.units if unit.unit_type is UnitType.ORCHESTRATOR), None)
        if tower is not None and not next_missions:
            tower.status_text = "ready"
        return mutations

    def _advance_units(self) -> list[dict[str, object]]:
        """Advance mobile units independently from the fire tick rate."""
        mutations: list[dict[str, object]] = []
        fire_cells = set(self._session_state.fire_cells)
        for unit in self._session_state.units:
            if (
                unit.unit_type is UnitType.ORCHESTRATOR
                or not unit.is_active
                or unit.target is None
            ):
                continue
            if unit.status_text == "holding":
                unit.target = None
                continue
            if unit.position == unit.target:
                mutations.extend(self._complete_unit_assignment(unit))
                continue

            if unit.unit_type is UnitType.GROUND_CREW:
                if not self._is_ground_cell_passable(unit.target, fire_cells):
                    mutations.extend(self._retarget_ground_unit(unit, preferred_target=unit.target))
                    continue
                next_position = self._move_ground_towards(
                    origin=unit.position,
                    target=unit.target,
                    active_fire=fire_cells,
                )
                if next_position == unit.position and not self._ground_target_reachable(
                    origin=unit.position,
                    target=unit.target,
                ):
                    mutations.extend(self._retarget_ground_unit(unit, preferred_target=unit.target))
                    continue
            else:
                next_position = self._move_towards(
                    origin=unit.position,
                    target=unit.target,
                    max_steps=self._move_steps_for_unit(unit),
                )
            if next_position == unit.position:
                continue

            unit.position = next_position
            mutations.append({"kind": "unit_moved", "unit_id": unit.id, "position": unit.position})

            if unit.position == unit.target:
                mutations.extend(self._complete_unit_assignment(unit))
        return mutations

    def _complete_unit_assignment(self, unit: UnitState) -> list[dict[str, object]]:
        """Execute the action that was waiting on this unit reaching its target."""
        if unit.target is None:
            return []

        if unit.status_text == "moving":
            unit.status_text = "ready"
            unit.target = None
            return []

        if unit.status_text == "suppressing":
            if unit.unit_type is not UnitType.HELICOPTER or unit.water_remaining <= 0:
                unit.status_text = "ready"
                unit.target = None
                return []
            target = unit.target
            suppressed = self._suppress_fire(center=target, radius=2)
            unit.water_remaining -= 1
            unit.status_text = "ready"
            unit.target = None
            return [
                {
                    "kind": "water_drop",
                    "unit_id": unit.id,
                    "target": target,
                    "cells": suppressed,
                }
            ]

        if unit.status_text == "laying firebreak":
            if unit.unit_type is not UnitType.GROUND_CREW:
                unit.status_text = "ready"
                unit.target = None
                return []
            target = unit.target
            preview_cells = self._preview_firebreak(center=target)
            if any(cell in self._session_state.fire_cells for cell in preview_cells):
                return self._retarget_ground_unit(unit, preferred_target=target)
            cells = self._create_firebreak(center=target)
            unit.status_text = "ready"
            unit.target = None
            return [
                {
                    "kind": "firebreak_created",
                    "unit_id": unit.id,
                    "target": target,
                    "cells": cells,
                }
            ]

        return []

    def _retarget_ground_unit(
        self,
        unit: UnitState,
        *,
        preferred_target: Coordinate,
    ) -> list[dict[str, object]]:
        """Retask one ground crew to the next safe reachable line instead of freezing."""
        replacement_target = self._choose_safe_reachable_ground_target(
            origin=unit.position,
            preferred_target=preferred_target,
        )
        if replacement_target is None:
            unit.target = None
            unit.status_text = "holding"
            return [{"kind": "unit_holding", "unit_id": unit.id, "position": unit.position}]

        if replacement_target == unit.position and unit.status_text == "laying firebreak":
            cells = self._create_firebreak(center=replacement_target)
            unit.target = None
            unit.status_text = "ready"
            return [
                {
                    "kind": "firebreak_created",
                    "unit_id": unit.id,
                    "target": replacement_target,
                    "cells": cells,
                }
            ]

        unit.target = replacement_target
        if unit.status_text not in {"laying firebreak", "moving"}:
            unit.status_text = "laying firebreak"
        return [
            {
                "kind": "unit_retasked",
                "unit_id": unit.id,
                "position": unit.position,
                "target": replacement_target,
                "status_text": unit.status_text,
            }
        ]

    def _choose_safe_reachable_ground_target(
        self,
        *,
        origin: Coordinate,
        preferred_target: Coordinate,
    ) -> Coordinate | None:
        """Pick the nearest safe reachable fallback target for one ground crew."""
        for candidate in safe_ground_candidates(
            self._session_state,
            preferred_target=preferred_target,
            limit=48,
        ):
            if candidate == origin:
                return candidate
            if self._ground_target_reachable(origin=origin, target=candidate):
                return candidate
        return None

    def _get_unit(self, unit_id: str) -> UnitState:
        """Return the matching unit state.

        Args:
            unit_id: Unit identifier.

        Returns:
            The matching unit.

        Raises:
            CommandValidationError: If the unit does not exist.
        """
        for unit in self._session_state.units:
            if unit.id == unit_id:
                if not unit.is_active:
                    raise CommandValidationError(f"Unit {unit_id} is no longer active.")
                return unit
        raise CommandValidationError(f"Unit {unit_id} does not exist.")

    def _resolve_ground_crew_casualties(self) -> list[dict[str, object]]:
        """Kill any active ground crews that are currently inside live fire."""
        fire_cells = set(self._session_state.fire_cells)
        casualties: list[dict[str, object]] = []
        for unit in self._session_state.units:
            if (
                unit.unit_type is not UnitType.GROUND_CREW
                or not unit.is_active
                or unit.position not in fire_cells
            ):
                continue
            unit.is_active = False
            unit.target = None
            unit.status_text = "lost"
            casualties.append(
                {
                    "kind": "unit_killed",
                    "unit_id": unit.id,
                    "label": unit.label,
                    "position": unit.position,
                }
            )
        return casualties

    def _move_towards(
        self,
        origin: Coordinate,
        target: Coordinate,
        *,
        max_steps: int = 1,
    ) -> Coordinate:
        """Move up to ``max_steps`` steps toward a target coordinate.

        Args:
            origin: Starting coordinate.
            target: Destination coordinate.
            max_steps: Maximum grid steps this move may cover.

        Returns:
            New coordinate after movement.
        """
        row, col = origin
        for _ in range(max_steps):
            if (row, col) == target:
                break
            row += self._sign(target[0] - row)
            col += self._sign(target[1] - col)
        return self._clamp_coordinate((row, col))

    def _move_steps_for_unit(self, unit: UnitState) -> int:
        """Return the number of grid steps a unit can travel in one tick."""
        return _UNIT_MOVE_STEPS_PER_TICK.get(unit.unit_type, 0)

    def _move_ground_towards(
        self,
        origin: Coordinate,
        target: Coordinate,
        *,
        active_fire: set[Coordinate],
    ) -> Coordinate:
        """Move a ground crew along its safest available path."""
        path = self._find_ground_path(origin=origin, target=target, active_fire=active_fire)
        if path is None or len(path) <= 1:
            return origin

        budget_remaining = _GROUND_CREW_MOVE_BUDGET_PER_TICK
        current = origin
        for next_cell in path[1:]:
            diagonal = current[0] != next_cell[0] and current[1] != next_cell[1]
            step_cost = self._ground_step_cost(
                current=current,
                next_cell=next_cell,
                diagonal=diagonal,
                active_fire=active_fire,
            )
            if step_cost > budget_remaining:
                break
            budget_remaining -= step_cost
            current = next_cell
        return current

    def _diagonal_side_cells(
        self,
        source: Coordinate,
        target: Coordinate,
    ) -> tuple[Coordinate, Coordinate]:
        """Return the orthogonal side cells adjacent to one diagonal transition."""
        delta_x = self._sign(target[0] - source[0])
        delta_y = self._sign(target[1] - source[1])
        return (
            (source[0] + delta_x, source[1]),
            (source[0], source[1] + delta_y),
        )

    def _fire_diagonal_transition_blocked(
        self,
        *,
        source: Coordinate,
        target: Coordinate,
        firebreaks: set[Coordinate],
    ) -> bool:
        """Block diagonal fire spread across water or firebreak corners."""
        side_a, side_b = self._diagonal_side_cells(source, target)
        for side in (side_a, side_b):
            if not (0 <= side[0] < self._grid_size and 0 <= side[1] < self._grid_size):
                return True
            if side in firebreaks:
                return True
            if self._get_terrain(side).water is not WaterType.NONE:
                return True
        return False

    def _ground_diagonal_transition_blocked(
        self,
        *,
        source: Coordinate,
        target: Coordinate,
        active_fire: set[Coordinate],
    ) -> bool:
        """Prevent crews from cutting diagonally across fire or water corners."""
        side_a, side_b = self._diagonal_side_cells(source, target)
        return not (
            self._is_ground_cell_passable(side_a, active_fire)
            and self._is_ground_cell_passable(side_b, active_fire)
        )

    def _ground_target_reachable(self, origin: Coordinate, target: Coordinate) -> bool:
        """Return whether a ground crew can safely reach the target now."""
        return self._find_ground_path(
            origin=origin,
            target=target,
            active_fire=set(self._session_state.fire_cells),
        ) is not None

    def _find_ground_path(
        self,
        *,
        origin: Coordinate,
        target: Coordinate,
        active_fire: set[Coordinate],
    ) -> list[Coordinate] | None:
        """Find the safest terrain-aware path for a ground crew."""
        if origin == target:
            return [origin]
        if not self._is_ground_cell_passable(target, active_fire):
            return None

        frontier: list[tuple[float, int, Coordinate]] = []
        heappush(frontier, (0.0, 0, origin))
        came_from: dict[Coordinate, Coordinate | None] = {origin: None}
        cost_so_far: dict[Coordinate, float] = {origin: 0.0}
        serial = 1

        while frontier:
            _, _, current = heappop(frontier)
            if current == target:
                return self._reconstruct_path(came_from, target)

            for delta_row, delta_col, diagonal in _NEIGHBOURS:
                next_row = current[0] + delta_row
                next_col = current[1] + delta_col
                next_cell = (next_row, next_col)
                if not self._is_ground_cell_passable(next_cell, active_fire):
                    continue
                if diagonal and self._ground_diagonal_transition_blocked(
                    source=current,
                    target=next_cell,
                    active_fire=active_fire,
                ):
                    continue
                step_cost = self._ground_step_cost(
                    current=current,
                    next_cell=next_cell,
                    diagonal=diagonal,
                    active_fire=active_fire,
                )
                new_cost = cost_so_far[current] + step_cost
                if new_cost >= cost_so_far.get(next_cell, float("inf")):
                    continue
                cost_so_far[next_cell] = new_cost
                priority = new_cost + self._ground_path_heuristic(next_cell, target)
                came_from[next_cell] = current
                heappush(frontier, (priority, serial, next_cell))
                serial += 1
        return None

    def _reconstruct_path(
        self,
        came_from: dict[Coordinate, Coordinate | None],
        target: Coordinate,
    ) -> list[Coordinate]:
        """Reconstruct a path from an A* parent map."""
        path = [target]
        current = target
        while came_from[current] is not None:
            current = came_from[current]  # type: ignore[assignment]
            path.append(current)
        path.reverse()
        return path

    def _ground_path_heuristic(self, current: Coordinate, target: Coordinate) -> float:
        """Cheap lower bound for A* path search."""
        return max(abs(target[0] - current[0]), abs(target[1] - current[1]))

    def _is_ground_cell_passable(
        self,
        coord: Coordinate,
        active_fire: set[Coordinate],
    ) -> bool:
        """Return whether a ground crew may occupy one cell."""
        row, col = coord
        if not (0 <= row < self._grid_size and 0 <= col < self._grid_size):
            return False
        if coord in active_fire:
            return False
        return self._get_terrain(coord).water is WaterType.NONE

    def _ground_step_cost(
        self,
        *,
        current: Coordinate,
        next_cell: Coordinate,
        diagonal: bool,
        active_fire: set[Coordinate],
    ) -> float:
        """Cost model for ground-crew pathfinding and per-tick travel."""
        current_terrain = self._get_terrain(current)
        next_terrain = self._get_terrain(next_cell)
        slope_cost = min(
            _GROUND_CREW_MAX_SLOPE_COST,
            abs(next_terrain.elevation - current_terrain.elevation) * 2.5,
        )
        fire_penalty = self._ground_fire_penalty(next_cell, active_fire)
        water_penalty = self._ground_water_penalty.get(next_cell, 0.0)
        step_cost = (
            1.0
            + (_GROUND_CREW_DIAGONAL_COST if diagonal else 0.0)
            + slope_cost
            + fire_penalty
            + water_penalty
        )
        return min(_GROUND_CREW_MAX_STEP_COST, step_cost)

    def _ground_fire_penalty(
        self,
        coord: Coordinate,
        active_fire: set[Coordinate],
    ) -> float:
        """Penalty for stepping near active fire without stepping into it."""
        for delta_row in range(-1, 2):
            for delta_col in range(-1, 2):
                if delta_row == 0 and delta_col == 0:
                    continue
                if (coord[0] + delta_row, coord[1] + delta_col) in active_fire:
                    return _GROUND_CREW_FIRE_EDGE_PENALTY
        for delta_row in range(-2, 3):
            for delta_col in range(-2, 3):
                if max(abs(delta_row), abs(delta_col)) != 2:
                    continue
                if (coord[0] + delta_row, coord[1] + delta_col) in active_fire:
                    return _GROUND_CREW_FIRE_NEARBY_PENALTY
        return 0.0

    def _sign(self, value: int) -> int:
        """Return the sign of an integer value."""
        if value == 0:
            return 0
        return 1 if value > 0 else -1

    def _clamp_coordinate(self, coordinate: Coordinate) -> Coordinate:
        """Clamp a coordinate to the map bounds."""
        max_index = self._grid_size - 1
        return (
            max(0, min(max_index, coordinate[0])),
            max(0, min(max_index, coordinate[1])),
        )

    def _create_firebreak(self, center: Coordinate) -> list[Coordinate]:
        """Create a small firebreak line centered on a coordinate."""
        created: list[Coordinate] = []
        for cell in self._preview_firebreak(center=center):
            if cell not in self._session_state.firebreak_cells:
                self._session_state.firebreak_cells.append(cell)
                created.append(cell)
        self._session_state.firebreak_cells.sort()
        return created

    def _preview_firebreak(self, center: Coordinate) -> list[Coordinate]:
        """Preview the cells that would be affected by a firebreak command."""
        created: list[Coordinate] = []
        for offset in range(-1, 2):
            cell = self._clamp_coordinate((center[0] + offset, center[1]))
            if cell not in created:
                created.append(cell)
        return created

    def _update_score(self) -> None:
        """Refresh derived score values from state."""
        self._session_state.score.time_elapsed_seconds = self._session_state.tick
        self._session_state.score.burned_cells = len(
            set(self._session_state.burned_cells).union(self._session_state.fire_cells)
        )
        self._session_state.score.suppressed_cells = len(set(self._session_state.suppressed_cells))
        self._session_state.score.firebreak_cells = len(set(self._session_state.firebreak_cells))
        village_cells = self._village_cells()
        self._session_state.score.village_damage = len(
            village_cells.intersection(self._session_state.fire_cells)
        )

    def _village_cells(self) -> set[Coordinate]:
        """Return all village coordinates."""
        cells: set[Coordinate] = set()
        top_left_x, top_left_y = self._session_state.village.top_left
        for offset_x in range(self._session_state.village.size):
            for offset_y in range(self._session_state.village.size):
                cells.add((top_left_x + offset_x, top_left_y + offset_y))
        return cells

    def _update_game_status(self) -> None:
        """Update terminal game state if win or loss conditions are met."""
        village_cells = self._village_cells()
        fire_cells = set(self._session_state.fire_cells)
        if village_cells.intersection(fire_cells):
            self._session_state.status = GameStatus.LOST
            self._session_state.village = self._session_state.village.model_copy(
                update={"is_intact": False}
            )
            self._session_state.winner = "fire"
            return
        if not fire_cells:
            if not self._total_extinguish_unlocked():
                self._session_state.status = GameStatus.RUNNING
                self._session_state.winner = None
                return
            self._session_state.status = GameStatus.WON
            self._session_state.winner = "player"

    def _total_extinguish_unlocked(self) -> bool:
        """Return whether the incident is allowed to be fully extinguished."""
        return self._session_state.tick >= _MIN_TICKS_BEFORE_TOTAL_EXTINGUISH

    def _pick_hotspot_survivor(
        self,
        candidates: list[Coordinate],
        *,
        focus: Coordinate | None = None,
    ) -> Coordinate | None:
        """Pick one fire cell to keep alive so the incident cannot end too early."""
        if not candidates:
            return None
        if focus is None:
            return sorted(candidates)[0]
        return min(
            candidates,
            key=lambda coord: (abs(coord[0] - focus[0]) + abs(coord[1] - focus[1]), coord[0], coord[1]),
        )

    def _stabilize_hotspot(self, coord: Coordinate) -> None:
        """Keep one low-intensity hotspot alive during the opening phase."""
        fire_state = self._fire_states.get(coord)
        if fire_state is None:
            fire_state = self._make_fire_state(coord)
            self._fire_states[coord] = fire_state
        fire_state.fuel = max(fire_state.fuel, _PERSISTENT_HOTSPOT_FUEL)
        fire_state.moisture = min(fire_state.moisture, _PERSISTENT_HOTSPOT_MOISTURE)
        fire_state.intensity = FireIntensity.EMBER
        fire_state.burn_ticks = min(fire_state.burn_ticks, 1)
        if coord not in self._session_state.fire_cells:
            self._session_state.fire_cells.append(coord)
            self._session_state.fire_cells.sort()
