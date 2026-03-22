"""Helpers for transient fixed-wing air-support missions."""

from __future__ import annotations

from dataclasses import dataclass

from watchtower_backend.domain.models.simulation import (
    AirSupportMission,
    AirSupportPayload,
    AirSupportPhase,
    Coordinate,
    SessionState,
)

AIRCRAFT_MODELS: tuple[str, ...] = (
    "P2V",
    "HC-130H",
    "BAe-146",
    "MD-87",
    "C-130Q",
    "RJ85",
    "C-130 H & J",
)

RUN_DIRECTION_CANDIDATES: tuple[Coordinate, ...] = (
    (1, 0),
    (0, 1),
    (1, 1),
    (1, -1),
)


@dataclass(frozen=True)
class PayloadSettings:
    duration_ticks: int
    spread_reduction: float
    moisture_boost: float
    direct_suppress_chance: float


PAYLOAD_SETTINGS: dict[AirSupportPayload, PayloadSettings] = {
    AirSupportPayload.WATER: PayloadSettings(
        duration_ticks=8,
        spread_reduction=0.28,
        moisture_boost=0.35,
        direct_suppress_chance=0.72,
    ),
    AirSupportPayload.RETARDANT: PayloadSettings(
        duration_ticks=18,
        spread_reduction=0.46,
        moisture_boost=0.2,
        direct_suppress_chance=0.4,
    ),
}

MISSION_PROGRESS_PER_TICK: dict[AirSupportPhase, float] = {
    AirSupportPhase.APPROACH: 0.5,
    AirSupportPhase.DROP: 0.5,
    AirSupportPhase.EXIT: 0.42,
    AirSupportPhase.COMPLETE: 0.0,
}


def get_mission_progress_per_tick(phase: AirSupportPhase) -> float:
    """Return the coarse per-tick progress increment for a mission phase."""
    return MISSION_PROGRESS_PER_TICK[phase]


def choose_aircraft_model(seed: int) -> str:
    """Pick a visual aircraft model deterministically from the approved list."""
    return AIRCRAFT_MODELS[seed % len(AIRCRAFT_MODELS)]


def clamp_coordinate(coordinate: Coordinate, grid_size: int) -> Coordinate:
    """Clamp a coordinate to the simulation bounds."""
    max_index = grid_size - 1
    return (
        max(0, min(max_index, int(round(coordinate[0])))),
        max(0, min(max_index, int(round(coordinate[1])))),
    )


def normalize(direction: Coordinate) -> tuple[float, float]:
    """Return a normalized vector."""
    row, col = direction
    length = ((row * row) + (col * col)) ** 0.5 or 1.0
    return (row / length, col / length)


def project_span(cells: list[Coordinate], direction: Coordinate) -> float:
    """Project a set of fire cells onto one axis and return its span."""
    unit_row, unit_col = normalize(direction)
    projections = [(row * unit_row) + (col * unit_col) for row, col in cells]
    return max(projections) - min(projections)


def wind_vector(direction: str) -> Coordinate:
    """Convert a compass direction into a coarse row/col vector."""
    match direction:
        case "N":
            return (-1, 0)
        case "NE":
            return (-1, 1)
        case "E":
            return (0, 1)
        case "SE":
            return (1, 1)
        case "S":
            return (1, 0)
        case "SW":
            return (1, -1)
        case "W":
            return (0, -1)
        case "NW":
            return (-1, -1)
        case _:
            return (0, 1)


def choose_run_direction(fire_cells: list[Coordinate], wind: Coordinate) -> Coordinate:
    """Pick a sensible horizontal, vertical, or diagonal drop axis."""
    wind_row, wind_col = normalize(wind)
    best = RUN_DIRECTION_CANDIDATES[0]
    best_score = float("-inf")
    for candidate in RUN_DIRECTION_CANDIDATES:
        unit_row, unit_col = normalize(candidate)
        span_score = project_span(fire_cells, candidate)
        crosswind_score = 1 - abs((unit_row * wind_row) + (unit_col * wind_col))
        diagonal_bonus = 0.12 if candidate[0] != 0 and candidate[1] != 0 else 0.0
        score = span_score * 1.4 + crosswind_score * 3.0 + diagonal_bonus
        if score > best_score:
            best = candidate
            best_score = score
    return best


def extend_point(point: Coordinate, direction: Coordinate, distance: int) -> Coordinate:
    """Move a point along a direction without clamping it to the map."""
    return (
        point[0] + direction[0] * distance,
        point[1] + direction[1] * distance,
    )


def step_direction(start: Coordinate, end: Coordinate) -> Coordinate:
    """Return the sign-only direction from start to end."""
    return (
        0 if end[0] == start[0] else 1 if end[0] > start[0] else -1,
        0 if end[1] == start[1] else 1 if end[1] > start[1] else -1,
    )


def off_map_distance(grid_size: int, multiplier: int = 1) -> int:
    """How far outside the map entry and exit legs should start."""
    return grid_size * multiplier + 8


def rasterize_line(start: Coordinate, end: Coordinate) -> list[Coordinate]:
    """Rasterize a straight line across grid cells."""
    row, col = start
    delta_row = abs(end[0] - start[0])
    delta_col = abs(end[1] - start[1])
    step_row = 1 if row < end[0] else -1
    step_col = 1 if col < end[1] else -1
    error = delta_row - delta_col
    cells: list[Coordinate] = []

    while True:
        cells.append((row, col))
        if row == end[0] and col == end[1]:
            break
        double_error = error * 2
        if double_error > -delta_col:
            error -= delta_col
            row += step_row
        if double_error < delta_row:
            error += delta_row
            col += step_col
    return cells


def build_drop_corridor(
    start: Coordinate,
    end: Coordinate,
    grid_size: int,
    width: int = 1,
) -> list[Coordinate]:
    """Build a widened straight-line drop corridor across the grid."""
    cells: dict[Coordinate, None] = {}
    for cell_row, cell_col in rasterize_line(start, end):
        for delta_row in range(-width, width + 1):
            for delta_col in range(-width, width + 1):
                next_cell = clamp_coordinate((cell_row + delta_row, cell_col + delta_col), grid_size)
                cells[next_cell] = None
    return list(cells.keys())


def build_fallback_air_support_mission(
    session_state: SessionState,
    seed: int,
    payload_type: AirSupportPayload,
    *,
    focus_target: Coordinate | None = None,
    approach_points: list[Coordinate] | None = None,
    drop_start: Coordinate | None = None,
    drop_end: Coordinate | None = None,
) -> AirSupportMission | None:
    """Create one transient air-support mission using planner geometry or fallback rules."""
    fire_cells = list(session_state.fire_cells)
    if not fire_cells and focus_target is None:
        return None

    grid_size = session_state.grid_size
    wind = wind_vector(session_state.wind.direction)
    focus = focus_target
    if focus is None:
        focus = (
            round(sum(cell[0] for cell in fire_cells) / len(fire_cells)),
            round(sum(cell[1] for cell in fire_cells) / len(fire_cells)),
        )
    focus = clamp_coordinate(focus, grid_size)

    if drop_start is None or drop_end is None:
        run_axis = choose_run_direction(fire_cells or [focus], wind)
        radius = 3
        drop_start = clamp_coordinate(
            (focus[0] - run_axis[0] * radius, focus[1] - run_axis[1] * radius),
            grid_size,
        )
        drop_end = clamp_coordinate(
            (focus[0] + run_axis[0] * radius, focus[1] + run_axis[1] * radius),
            grid_size,
        )
    else:
        drop_start = clamp_coordinate(drop_start, grid_size)
        drop_end = clamp_coordinate(drop_end, grid_size)

    entry_direction = (
        -(wind[0] or step_direction(drop_start, drop_end)[0] or 1),
        -(wind[1] or step_direction(drop_start, drop_end)[1] or 0),
    )
    entry = extend_point(drop_start, entry_direction, off_map_distance(grid_size))
    mid = extend_point(drop_start, entry_direction, max(4, grid_size // 10))
    run_direction = step_direction(drop_start, drop_end)
    exit_near = extend_point(drop_end, run_direction, off_map_distance(grid_size))
    exit_far = extend_point(drop_end, run_direction, off_map_distance(grid_size, 2))

    approach = list(approach_points or [])
    if not approach:
        approach = [entry, mid, drop_start]
    elif approach[-1] != drop_start:
        approach.append(drop_start)

    return AirSupportMission(
        id=f"air-{seed}",
        aircraft_model=choose_aircraft_model(seed),
        payload_type=payload_type,
        approach_points=approach,
        drop_start=drop_start,
        drop_end=drop_end,
        exit_points=[exit_near, exit_far],
        phase=AirSupportPhase.APPROACH,
        progress=0.0,
    )
