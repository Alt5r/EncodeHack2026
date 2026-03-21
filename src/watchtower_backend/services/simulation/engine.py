"""Deterministic wildfire simulation engine."""

from __future__ import annotations

from random import Random

import numpy as np

from watchtower_backend.core.errors import CommandValidationError
from watchtower_backend.domain.commands import UnitCommand
from watchtower_backend.domain.models.simulation import (
    CommandAction,
    Coordinate,
    GameStatus,
    SessionState,
    UnitState,
    UnitType,
)


class SimulationEngine:
    """Owns authoritative mutation of the simulation state."""

    def __init__(self, session_state: SessionState, seed: int) -> None:
        """Initialize the simulation engine.

        Args:
            session_state: Initial session state.
            seed: Deterministic seed used for terrain and fire spread.
        """
        self._session_state = session_state
        self._random = Random(seed)
        self._terrain = self._generate_terrain(size=session_state.grid_size)

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
        for command in commands:
            mutation_records.extend(self._apply_command(command=command))

        new_fire_cells = self._spread_fire()
        if new_fire_cells:
            mutation_records.append({"kind": "fire_spread", "cells": new_fire_cells})

        self._update_score()
        self._update_game_status()
        return mutation_records

    def _generate_terrain(self, size: int) -> np.ndarray:
        """Generate lightweight terrain noise.

        Args:
            size: Grid size.

        Returns:
            Terrain grid.
        """
        base = np.fromiter((self._random.random() for _ in range(size * size)), dtype=float)
        return base.reshape((size, size))

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

    def _sign(self, value: int) -> int:
        """Return the sign of an integer value."""
        if value == 0:
            return 0
        return 1 if value > 0 else -1

    def _clamp_coordinate(self, coordinate: Coordinate) -> Coordinate:
        """Clamp a coordinate to the map bounds."""
        max_index = self._session_state.grid_size - 1
        return (
            max(0, min(max_index, coordinate[0])),
            max(0, min(max_index, coordinate[1])),
        )

    def _spread_fire(self) -> list[Coordinate]:
        """Spread fire to neighboring cells.

        Returns:
            Newly ignited cells.
        """
        active_fire = set(self._session_state.fire_cells)
        firebreaks = set(self._session_state.firebreak_cells)
        new_cells: set[Coordinate] = set()
        wind_bonus = 0.04 if self._session_state.wind.direction in {"N", "NE", "E"} else 0.02
        spread_chance = min(0.35, 0.10 + wind_bonus + (self._session_state.wind.speed_mph / 100.0))

        for cell_x, cell_y in active_fire:
            for offset_x, offset_y in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                neighbor = self._clamp_coordinate((cell_x + offset_x, cell_y + offset_y))
                if neighbor in active_fire or neighbor in firebreaks:
                    continue
                terrain_factor = 1.0 + (self._terrain[neighbor[0], neighbor[1]] * 0.2)
                if self._random.random() < spread_chance * terrain_factor:
                    new_cells.add(neighbor)

        for cell in sorted(new_cells):
            if cell not in self._session_state.fire_cells:
                self._session_state.fire_cells.append(cell)
        return sorted(new_cells)

    def _suppress_fire(self, center: Coordinate, radius: int) -> list[Coordinate]:
        """Suppress fire cells near a target location."""
        suppressed: list[Coordinate] = []
        remaining_fire: list[Coordinate] = []
        fire_set = set(self._session_state.fire_cells)

        for cell in fire_set:
            if abs(cell[0] - center[0]) <= radius and abs(cell[1] - center[1]) <= radius:
                suppressed.append(cell)
            else:
                remaining_fire.append(cell)

        self._session_state.fire_cells = sorted(remaining_fire)
        self._session_state.suppressed_cells.extend(suppressed)
        return sorted(suppressed)

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
        if not fire_cells:
            self._session_state.status = GameStatus.WON
            self._session_state.winner = "player"
