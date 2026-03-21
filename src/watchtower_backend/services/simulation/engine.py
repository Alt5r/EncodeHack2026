"""Deterministic wildfire simulation engine."""

from __future__ import annotations

import math
from dataclasses import dataclass
from random import Random

from watchtower_backend.core.errors import CommandValidationError
from watchtower_backend.domain.commands import UnitCommand
from watchtower_backend.domain.models.simulation import (
    AirSupportMission,
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
    build_air_support_mission,
    build_drop_corridor,
)

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

_MIN_PERSISTENT_FUEL = 0.01
_AIR_SUPPORT_PROGRESS_STEP: dict[AirSupportPhase, float] = {
    AirSupportPhase.APPROACH: 0.5,
    AirSupportPhase.DROP: 0.5,
    AirSupportPhase.EXIT: 0.42,
}

_TREATMENT_DURATION: dict[AirSupportPayload, int] = {
    AirSupportPayload.WATER: 8,
    AirSupportPayload.RETARDANT: 18,
}

_TREATMENT_DECAY: dict[AirSupportPayload, float] = {
    AirSupportPayload.WATER: 0.9,
    AirSupportPayload.RETARDANT: 0.96,
}

_TREATMENT_MOISTURE_BONUS: dict[AirSupportPayload, float] = {
    AirSupportPayload.WATER: 0.35,
    AirSupportPayload.RETARDANT: 0.2,
}

_TREATMENT_SPREAD_REDUCTION: dict[AirSupportPayload, float] = {
    AirSupportPayload.WATER: 0.28,
    AirSupportPayload.RETARDANT: 0.46,
}

_DIRECT_HIT_SUPPRESS_CHANCE: dict[AirSupportPayload, float] = {
    AirSupportPayload.WATER: 0.72,
    AirSupportPayload.RETARDANT: 0.4,
}

_DIRECT_HIT_FUEL_REDUCTION: dict[AirSupportPayload, float] = {
    AirSupportPayload.WATER: 0.3,
    AirSupportPayload.RETARDANT: 0.18,
}

# --- Spread constants ---
_BASE_RATE = 0.096
_MAX_SPREAD_PROB = 0.65
_DIAGONAL_PENALTY = 0.7

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

        # Precompute water proximity moisture boost
        self._moisture_boost = self._compute_moisture_boost()

        # Initialize internal fire state for existing fire cells
        self._fire_states: dict[Coordinate, _CellFireState] = {}
        for cell in session_state.fire_cells:
            self._fire_states[cell] = self._make_fire_state(cell)

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

        existing_mission_ids = {mission.id for mission in self._session_state.air_support_missions}
        mutation_records: list[dict[str, object]] = []
        for command in commands:
            mutation_records.extend(self._apply_command(command=command))

        new_mission_ids = {
            mission.id
            for mission in self._session_state.air_support_missions
            if mission.id not in existing_mission_ids
        }
        mutation_records.extend(self._advance_air_support_missions(skip_ids=new_mission_ids))

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

        self._decay_treated_cells()
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
        water_cells: set[Coordinate] = set()
        for row in range(self._grid_size):
            for col in range(self._grid_size):
                if self._terrain_grid[row][col].water != WaterType.NONE:
                    water_cells.add((row, col))

        boost: dict[Coordinate, float] = {}
        for wx, wy in water_cells:
            for dx in range(-2, 3):
                for dy in range(-2, 3):
                    nx, ny = wx + dx, wy + dy
                    if 0 <= nx < self._grid_size and 0 <= ny < self._grid_size:
                        coord = (nx, ny)
                        if coord in water_cells:
                            continue
                        dist = max(abs(dx), abs(dy))
                        if dist == 1:
                            boost[coord] = max(boost.get(coord, 0.0), 0.7)
                        elif dist == 2:
                            boost[coord] = max(boost.get(coord, 0.0), 0.5)
        return boost

    def _get_terrain(self, coord: Coordinate) -> TerrainCell:
        """Return the terrain cell at a coordinate."""
        return self._terrain_grid[coord[0]][coord[1]]

    def _get_cell_moisture(self, coord: Coordinate) -> float:
        """Return effective moisture for a cell (base + water proximity boost)."""
        moisture = self._moisture_boost.get(coord, _BASE_MOISTURE)
        treated = self._treated_cell(coord)
        if treated is None:
            return moisture
        boosted = moisture + (_TREATMENT_MOISTURE_BONUS[treated.payload_type] * treated.strength)
        return min(1.0, boosted)

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
        burnout_unlocked = self._natural_burnout_unlocked()

        for coord, fire_state in self._fire_states.items():
            # Consume fuel
            fire_state.fuel -= _INTENSITY_FUEL_CONSUMPTION[fire_state.intensity]
            fire_state.burn_ticks += 1

            # Check burn-out
            if fire_state.fuel <= 0.0:
                if not burnout_unlocked:
                    # Passive burnout is disabled until agents have actually suppressed fire.
                    fire_state.fuel = _MIN_PERSISTENT_FUEL
                    fire_state.intensity = FireIntensity.EMBER
                    continue
                fire_state.fuel = 0.0
                to_remove.append(coord)
                burned_out.append(coord)
                continue

            # Update intensity (only progresses upward, never drops back)
            if fire_state.intensity != FireIntensity.INFERNO:
                terrain = self._get_terrain(coord)
                if fire_state.burn_ticks >= 5 and terrain.vegetation == VegetationType.FOREST and fire_state.fuel > 0.5:
                    fire_state.intensity = FireIntensity.INFERNO
                elif fire_state.burn_ticks >= 2:
                    fire_state.intensity = FireIntensity.BURNING

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
        treatment_factor = self._treatment_spread_factor(target)

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
                unit.position = self._move_towards(origin=unit.position, target=target)
                unit.target = target
                unit.status_text = "moving"
                return [{"kind": "unit_moved", "unit_id": unit.id, "position": unit.position}]
            case CommandAction.DROP_WATER:
                if unit.unit_type is not UnitType.HELICOPTER:
                    raise CommandValidationError("Only helicopters can drop water.")
                if unit.water_remaining <= 0:
                    raise CommandValidationError("Helicopter is out of water.")
                unit.position = self._move_towards(origin=unit.position, target=target)
                suppressed = self._suppress_fire(center=target, radius=2)
                unit.water_remaining -= 1
                unit.status_text = "suppressing"
                return [
                    {
                        "kind": "water_drop",
                        "unit_id": unit.id,
                        "target": target,
                        "cells": suppressed,
                    }
                ]
            case CommandAction.DROP_AIR_SUPPORT:
                if unit.unit_type is not UnitType.ORCHESTRATOR:
                    raise CommandValidationError("Only the watchtower can dispatch air support.")
                mission = self._create_air_support_mission(command=command, target=target)
                unit.target = mission.drop_end
                unit.status_text = f"dispatching {mission.payload_type.value}"
                self._session_state.air_support_missions.append(mission)
                return [
                    {
                        "kind": "air_support_dispatched",
                        "unit_id": unit.id,
                        "mission": mission.model_dump(mode="json"),
                    }
                ]
            case CommandAction.CREATE_FIREBREAK:
                if unit.unit_type is not UnitType.GROUND_CREW:
                    raise CommandValidationError("Only ground crews can create firebreaks.")
                unit.position = self._move_towards(origin=unit.position, target=target)
                cells = self._create_firebreak(center=target)
                unit.status_text = "laying firebreak"
                return [
                    {
                        "kind": "firebreak_created",
                        "unit_id": unit.id,
                        "target": target,
                        "cells": cells,
                    }
                ]
            case CommandAction.HOLD_POSITION:
                unit.status_text = "holding"
                return [{"kind": "unit_holding", "unit_id": unit.id, "position": unit.position}]

    # --- Helpers ---

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
                return unit
        raise CommandValidationError(f"Unit {unit_id} does not exist.")

    def _move_towards(self, origin: Coordinate, target: Coordinate) -> Coordinate:
        """Move one step toward a target coordinate.

        Args:
            origin: Starting coordinate.
            target: Destination coordinate.

        Returns:
            New coordinate after one movement step.
        """
        next_x = origin[0] + self._sign(target[0] - origin[0])
        next_y = origin[1] + self._sign(target[1] - origin[1])
        return self._clamp_coordinate((next_x, next_y))

    def _create_air_support_mission(
        self,
        command: UnitCommand,
        target: Coordinate,
    ) -> AirSupportMission:
        """Build a transient mission from planner data or fallback geometry."""
        mission_id = f"air-support-{self._session_state.tick}-{len(self._session_state.air_support_missions) + 1}"
        return build_air_support_mission(
            mission_id=mission_id,
            random=self._random,
            payload_type=command.payload_type or AirSupportPayload.RETARDANT,
            fire_cells=self._session_state.fire_cells or [target],
            grid_size=self._grid_size,
            wind_direction=self._session_state.wind.direction,
            approach_points=command.approach_points,
            drop_start=command.drop_start,
            drop_end=command.drop_end,
        )

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

    def _advance_air_support_missions(self, skip_ids: set[str] | None = None) -> list[dict[str, object]]:
        """Advance active missions and apply drops when they enter the release run."""
        if not self._session_state.air_support_missions:
            return []

        skipped = skip_ids or set()
        mutations: list[dict[str, object]] = []
        next_missions: list[AirSupportMission] = []

        for mission in self._session_state.air_support_missions:
            if mission.id in skipped:
                next_missions.append(mission)
                continue
            progress = min(1.0, mission.progress + _AIR_SUPPORT_PROGRESS_STEP.get(mission.phase, 0.5))

            if mission.phase is AirSupportPhase.APPROACH:
                if progress >= 1.0:
                    drop_phase_mission = mission.model_copy(
                        update={"phase": AirSupportPhase.DROP, "progress": 0.0}
                    )
                    treated_cells, suppressed = self._apply_air_support_drop(drop_phase_mission)
                    mutations.append(
                        {
                            "kind": "air_support_drop",
                            "mission_id": mission.id,
                            "payload_type": mission.payload_type.value,
                            "cells": treated_cells,
                            "suppressed": suppressed,
                        }
                    )
                    next_missions.append(drop_phase_mission)
                else:
                    next_missions.append(mission.model_copy(update={"progress": progress}))
                continue

            if mission.phase is AirSupportPhase.DROP:
                if progress >= 1.0:
                    next_missions.append(
                        mission.model_copy(update={"phase": AirSupportPhase.EXIT, "progress": 0.0})
                    )
                    continue
                next_missions.append(mission.model_copy(update={"progress": progress}))
                continue

            if mission.phase is AirSupportPhase.EXIT:
                if progress >= 1.0:
                    mutations.append({"kind": "air_support_complete", "mission_id": mission.id})
                    continue
                next_missions.append(mission.model_copy(update={"progress": progress}))

        self._session_state.air_support_missions = next_missions
        return mutations

    def _apply_air_support_drop(
        self,
        mission: AirSupportMission,
    ) -> tuple[list[Coordinate], list[Coordinate]]:
        """Apply the payload strip to terrain and any active fire cells it hits."""
        corridor = build_drop_corridor(
            mission.drop_start,
            mission.drop_end,
            self._grid_size,
            width=1,
        )
        treated_map = {cell.coordinate: cell for cell in self._session_state.treated_cells}
        active_fire = set(self._session_state.fire_cells)
        suppressed: list[Coordinate] = []
        touched_cells: list[Coordinate] = []

        for cell in corridor:
            terrain = self._get_terrain(cell)
            if terrain.water == WaterType.NONE:
                touched_cells.append(cell)
                treated_map[cell] = self._merge_treated_cell(
                    existing=treated_map.get(cell),
                    coordinate=cell,
                    payload_type=mission.payload_type,
                )

            if cell not in active_fire:
                continue

            fire_state = self._fire_states.get(cell)
            suppress_chance = _DIRECT_HIT_SUPPRESS_CHANCE[mission.payload_type]
            if fire_state is not None:
                suppress_chance *= _INTENSITY_SUPPRESS_CHANCE[fire_state.intensity]

            if self._random.random() < suppress_chance:
                suppressed.append(cell)
                self._fire_states.pop(cell, None)
                continue

            if fire_state is not None:
                fire_state.intensity = FireIntensity.EMBER
                fire_state.fuel = max(
                    _MIN_PERSISTENT_FUEL,
                    fire_state.fuel - _DIRECT_HIT_FUEL_REDUCTION[mission.payload_type],
                )
                fire_state.moisture = max(fire_state.moisture, self._get_cell_moisture(cell))

        if suppressed:
            suppressed_set = set(suppressed)
            self._session_state.fire_cells = [
                cell for cell in self._session_state.fire_cells if cell not in suppressed_set
            ]
            self._session_state.suppressed_cells.extend(suppressed)

        self._session_state.treated_cells = [treated_map[cell] for cell in sorted(treated_map)]
        return touched_cells, sorted(suppressed)

    def _merge_treated_cell(
        self,
        existing: TreatedCellState | None,
        coordinate: Coordinate,
        payload_type: AirSupportPayload,
    ) -> TreatedCellState:
        """Merge a new drop into the treated-cell layer predictably."""
        duration = _TREATMENT_DURATION[payload_type]
        strength = 1.0 if payload_type is AirSupportPayload.RETARDANT else 0.9
        if existing is None:
            return TreatedCellState(
                coordinate=coordinate,
                payload_type=payload_type,
                strength=strength,
                remaining_ticks=duration,
            )

        winner_payload = (
            payload_type
            if _TREATMENT_DURATION[payload_type] >= _TREATMENT_DURATION[existing.payload_type]
            else existing.payload_type
        )
        return TreatedCellState(
            coordinate=coordinate,
            payload_type=winner_payload,
            strength=max(existing.strength, strength),
            remaining_ticks=max(existing.remaining_ticks, duration),
        )

    def _decay_treated_cells(self) -> None:
        """Fade residual water and retardant effects over time."""
        next_cells: list[TreatedCellState] = []
        for cell in self._session_state.treated_cells:
            remaining_ticks = cell.remaining_ticks - 1
            if remaining_ticks <= 0:
                continue
            next_cells.append(
                TreatedCellState(
                    coordinate=cell.coordinate,
                    payload_type=cell.payload_type,
                    strength=max(0.15, cell.strength * _TREATMENT_DECAY[cell.payload_type]),
                    remaining_ticks=remaining_ticks,
                )
            )
        self._session_state.treated_cells = next_cells

    def _treated_cell(self, coordinate: Coordinate) -> TreatedCellState | None:
        """Return the treated-cell entry for a coordinate, if any."""
        for cell in self._session_state.treated_cells:
            if cell.coordinate == coordinate:
                return cell
        return None

    def _treatment_spread_factor(self, coordinate: Coordinate) -> float:
        """Return the multiplicative spread penalty from treated terrain."""
        treated = self._treated_cell(coordinate)
        if treated is None:
            return 1.0
        reduction = _TREATMENT_SPREAD_REDUCTION[treated.payload_type] * treated.strength
        return max(0.2, 1.0 - reduction)

    def _create_firebreak(self, center: Coordinate) -> list[Coordinate]:
        """Create a small firebreak line centered on a coordinate."""
        created: list[Coordinate] = []
        for offset in range(-1, 2):
            cell = self._clamp_coordinate((center[0] + offset, center[1]))
            if cell not in self._session_state.firebreak_cells:
                self._session_state.firebreak_cells.append(cell)
                created.append(cell)
        self._session_state.firebreak_cells.sort()
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
        if not fire_cells and self._natural_burnout_unlocked():
            self._session_state.status = GameStatus.WON
            self._session_state.winner = "player"

    def _natural_burnout_unlocked(self) -> bool:
        """Return whether the fire is allowed to resolve naturally."""
        return bool(self._session_state.suppressed_cells)
