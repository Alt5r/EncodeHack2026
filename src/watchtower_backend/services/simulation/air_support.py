"""Helpers for transient fixed-wing air-support missions."""

from __future__ import annotations

import math
from random import Random

from watchtower_backend.domain.models.simulation import (
    AirSupportMission,
    AirSupportPayload,
    AircraftModel,
    Coordinate,
)

_AIRCRAFT_MODELS: tuple[AircraftModel, ...] = (
    AircraftModel.P2V,
    AircraftModel.HC130H,
    AircraftModel.BAE146,
    AircraftModel.MD87,
    AircraftModel.C130Q,
    AircraftModel.RJ85,
    AircraftModel.C130_HJ,
)

_WIND_VECTORS: dict[str, tuple[int, int]] = {
    "N": (0, -1),
    "NE": (1, -1),
    "E": (1, 0),
    "SE": (1, 1),
    "S": (0, 1),
    "SW": (-1, 1),
    "W": (-1, 0),
    "NW": (-1, -1),
}

_RUN_DIRECTION_CANDIDATES: tuple[Coordinate, ...] = (
    (1, 0),
    (0, 1),
    (1, 1),
    (1, -1),
)


def choose_aircraft_model(random: Random) -> AircraftModel:
    """Pick a visual aircraft model for one mission."""
    return random.choice(_AIRCRAFT_MODELS)


def clamp_coordinate(coordinate: Coordinate, grid_size: int) -> Coordinate:
    """Clamp a coordinate to the map bounds."""
    max_index = grid_size - 1
    return (
        max(0, min(max_index, coordinate[0])),
        max(0, min(max_index, coordinate[1])),
    )


def _step_direction(start: Coordinate, end: Coordinate) -> Coordinate:
    """Return a simple integer direction vector from start to end."""
    def sign(value: int) -> int:
        if value == 0:
            return 0
        return 1 if value > 0 else -1

    return (sign(end[0] - start[0]), sign(end[1] - start[1]))


def _off_map_distance(grid_size: int, multiplier: int = 1) -> int:
    """Return a distance guaranteed to push a point beyond the map bounds."""
    return grid_size * multiplier + 8


def _extend_point(point: Coordinate, direction: Coordinate, distance: int) -> Coordinate:
    """Project a point forward or backward without clamping to the map bounds."""
    return (point[0] + direction[0] * distance, point[1] + direction[1] * distance)


def _normalize(direction: Coordinate) -> tuple[float, float]:
    """Return a unit-length direction vector."""
    length = math.hypot(direction[0], direction[1]) or 1.0
    return (direction[0] / length, direction[1] / length)


def _project_span(cells: list[Coordinate], direction: Coordinate) -> float:
    """Measure fire extent along one candidate run direction."""
    unit_x, unit_y = _normalize(direction)
    projections = [(cell[0] * unit_x) + (cell[1] * unit_y) for cell in cells]
    return max(projections) - min(projections)


def _choose_run_direction(
    fire_cells: list[Coordinate],
    wind_direction: str,
) -> Coordinate:
    """Select a drop-line direction from fire footprint and wind."""
    wind = _normalize(_WIND_VECTORS.get(wind_direction, (1, 0)))
    footprint = fire_cells or [(0, 0)]

    best_direction = (0, 1)
    best_score = float("-inf")

    for candidate in _RUN_DIRECTION_CANDIDATES:
        unit = _normalize(candidate)
        span_score = _project_span(footprint, candidate)
        crosswind_score = 1.0 - abs((unit[0] * wind[0]) + (unit[1] * wind[1]))
        diagonal_bonus = 0.12 if candidate[0] != 0 and candidate[1] != 0 else 0.0
        score = span_score * 1.4 + crosswind_score * 3.0 + diagonal_bonus
        if score > best_score:
            best_direction = candidate
            best_score = score

    return best_direction


def _ensure_off_map_entry(route: list[Coordinate], grid_size: int) -> list[Coordinate]:
    """Prepend an off-map entry point if the provided route starts on the map."""
    if not route:
        return route
    first = route[0]
    if first[0] < 0 or first[0] >= grid_size or first[1] < 0 or first[1] >= grid_size:
        return route
    reference = route[1] if len(route) > 1 else route[0]
    reverse = _step_direction(reference, first)
    if reverse == (0, 0):
        reverse = (-1, 0)
    distance = _off_map_distance(grid_size)
    off_map = _extend_point(first, reverse, distance)
    return [off_map, first, *route[1:]]


def _build_exit_points(drop_start: Coordinate, drop_end: Coordinate, grid_size: int) -> list[Coordinate]:
    """Build a short exit leg that carries the aircraft off the visible map."""
    direction = _step_direction(drop_start, drop_end)
    if direction == (0, 0):
        direction = (1, 0)
    near_exit = _extend_point(drop_end, direction, _off_map_distance(grid_size))
    far_exit = _extend_point(drop_end, direction, _off_map_distance(grid_size, multiplier=2))
    return [near_exit, far_exit]


def build_fallback_air_support_geometry(
    fire_cells: list[Coordinate],
    grid_size: int,
    wind_direction: str,
) -> tuple[list[Coordinate], Coordinate, Coordinate, list[Coordinate]]:
    """Build a deterministic approach route and straight drop run."""
    if not fire_cells:
        center = (grid_size // 2, grid_size // 2)
    else:
        avg_x = sum(cell[0] for cell in fire_cells) / len(fire_cells)
        avg_y = sum(cell[1] for cell in fire_cells) / len(fire_cells)
        center = clamp_coordinate((round(avg_x), round(avg_y)), grid_size)

    wind_x, wind_y = _WIND_VECTORS.get(wind_direction, (1, 0))
    run_dx, run_dy = _choose_run_direction(fire_cells, wind_direction)

    radius = 3
    drop_start = clamp_coordinate(
        (center[0] - run_dx * radius, center[1] - run_dy * radius),
        grid_size,
    )
    drop_end = clamp_coordinate(
        (center[0] + run_dx * radius, center[1] + run_dy * radius),
        grid_size,
    )

    entry = (
        drop_start[0] - wind_x * _off_map_distance(grid_size) - run_dx * max(2, grid_size // 10),
        drop_start[1] - wind_y * _off_map_distance(grid_size) - run_dy * max(2, grid_size // 10),
    )
    approach_mid = (
        drop_start[0] - wind_x * max(4, grid_size // 10) - run_dx * max(2, grid_size // 12),
        drop_start[1] - wind_y * max(4, grid_size // 10) - run_dy * max(2, grid_size // 12),
    )
    exit_points = _build_exit_points(drop_start, drop_end, grid_size)

    return [entry, approach_mid, drop_start], drop_start, drop_end, exit_points


def rasterize_line(start: Coordinate, end: Coordinate) -> list[Coordinate]:
    """Return all coordinates on a line using a Bresenham-style walk."""
    x0, y0 = start
    x1, y1 = end
    dx = abs(x1 - x0)
    dy = -abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx + dy

    cells: list[Coordinate] = []
    while True:
        cells.append((x0, y0))
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy
    return cells


def build_drop_corridor(
    start: Coordinate,
    end: Coordinate,
    grid_size: int,
    width: int = 1,
) -> list[Coordinate]:
    """Expand a straight drop line into a narrow treated strip."""
    corridor: set[Coordinate] = set()
    for cell in rasterize_line(start, end):
        for offset_x in range(-width, width + 1):
            for offset_y in range(-width, width + 1):
                corridor.add(clamp_coordinate((cell[0] + offset_x, cell[1] + offset_y), grid_size))
    return sorted(corridor)


def build_air_support_mission(
    *,
    mission_id: str,
    random: Random,
    payload_type: AirSupportPayload,
    fire_cells: list[Coordinate],
    grid_size: int,
    wind_direction: str,
    approach_points: list[Coordinate] | None = None,
    drop_start: Coordinate | None = None,
    drop_end: Coordinate | None = None,
    exit_points: list[Coordinate] | None = None,
) -> AirSupportMission:
    """Create a mission, falling back to generated geometry when needed."""
    if drop_start is None or drop_end is None:
        fallback_approach, fallback_start, fallback_end, fallback_exit = build_fallback_air_support_geometry(
            fire_cells=fire_cells,
            grid_size=grid_size,
            wind_direction=wind_direction,
        )
        approach = fallback_approach
        start = fallback_start
        end = fallback_end
        exit_route = fallback_exit
    else:
        start = clamp_coordinate(drop_start, grid_size)
        end = clamp_coordinate(drop_end, grid_size)
        approach = list(approach_points or [])
        if not approach:
            approach = [start]
        elif approach[-1] != start:
            approach.append(start)
        approach = _ensure_off_map_entry(approach, grid_size)
        exit_route = list(exit_points or _build_exit_points(start, end, grid_size))

    return AirSupportMission(
        id=mission_id,
        aircraft_model=choose_aircraft_model(random),
        payload_type=payload_type,
        approach_points=approach,
        drop_start=start,
        drop_end=end,
        exit_points=exit_route,
    )
