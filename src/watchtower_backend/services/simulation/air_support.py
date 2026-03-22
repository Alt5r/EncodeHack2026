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

NEIGHBOUR_OFFSETS: tuple[Coordinate, ...] = (
    (1, 0),
    (-1, 0),
    (0, 1),
    (0, -1),
    (1, 1),
    (1, -1),
    (-1, 1),
    (-1, -1),
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
    AirSupportPhase.EXIT: 0.32,
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


def manhattan_distance(a: Coordinate, b: Coordinate) -> int:
    """Return Manhattan distance between two cells."""
    return abs(a[0] - b[0]) + abs(a[1] - b[1])


def midpoint(start: Coordinate, end: Coordinate) -> Coordinate:
    """Return the integer midpoint of a run."""
    return (
        round((start[0] + end[0]) / 2),
        round((start[1] + end[1]) / 2),
    )


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


def fire_edge_and_containment_cells(
    fire_cells: list[Coordinate],
    grid_size: int,
) -> tuple[list[Coordinate], list[Coordinate]]:
    """Return burning edge cells and adjacent non-burning containment cells."""
    fire_set = set(fire_cells)
    edge_cells: list[Coordinate] = []
    containment_cells: dict[Coordinate, None] = {}

    for cell in fire_cells:
        is_edge = False
        for delta_row, delta_col in NEIGHBOUR_OFFSETS:
            next_row = cell[0] + delta_row
            next_col = cell[1] + delta_col
            if not (0 <= next_row < grid_size and 0 <= next_col < grid_size):
                continue
            neighbour = (next_row, next_col)
            if neighbour in fire_set:
                continue
            is_edge = True
            containment_cells[neighbour] = None
        if is_edge:
            edge_cells.append(cell)

    return edge_cells, list(containment_cells.keys())


def choose_containment_focus(
    session_state: SessionState,
    fire_cells: list[Coordinate],
    focus_target: Coordinate | None,
) -> tuple[Coordinate, list[Coordinate]]:
    """Choose a containment focus just outside the active fire front."""
    grid_size = session_state.grid_size
    if not fire_cells:
        focus = clamp_coordinate(focus_target or (grid_size // 2, grid_size // 2), grid_size)
        return focus, [focus]

    edge_cells, containment_cells = fire_edge_and_containment_cells(fire_cells, grid_size)
    village_anchor = session_state.village.top_left
    run_cells = edge_cells or fire_cells
    anchor = clamp_coordinate(
        focus_target or min(run_cells, key=lambda cell: manhattan_distance(cell, village_anchor)),
        grid_size,
    )

    if not containment_cells:
        return anchor, run_cells

    nearest_edge = min(run_cells, key=lambda cell: manhattan_distance(cell, anchor))
    nearby_containment = [
        cell
        for cell in containment_cells
        if max(abs(cell[0] - nearest_edge[0]), abs(cell[1] - nearest_edge[1])) <= 2
    ]
    focus = min(
        nearby_containment or containment_cells,
        key=lambda cell: (
            manhattan_distance(cell, anchor),
            manhattan_distance(cell, village_anchor),
        ),
    )

    fire_set = set(fire_cells)
    outward = step_direction(nearest_edge, focus)
    nudged = clamp_coordinate((focus[0] + outward[0], focus[1] + outward[1]), grid_size)
    if nudged not in fire_set:
        focus = nudged

    return focus, run_cells


def shift_run_toward_focus(
    drop_start: Coordinate,
    drop_end: Coordinate,
    focus: Coordinate,
    fire_cells: list[Coordinate],
    grid_size: int,
) -> tuple[Coordinate, Coordinate]:
    """Nudge a run toward the containment focus when it overlaps too much active fire."""
    fire_set = set(fire_cells)
    shift = step_direction(midpoint(drop_start, drop_end), focus)
    if shift == (0, 0):
        return drop_start, drop_end

    def score_run(start: Coordinate, end: Coordinate) -> tuple[int, int]:
        overlap = sum(
            1 for cell in build_drop_corridor(start, end, grid_size, width=1) if cell in fire_set
        )
        return (overlap, manhattan_distance(midpoint(start, end), focus))

    best_start = drop_start
    best_end = drop_end
    best_score = score_run(drop_start, drop_end)

    for steps in range(1, 4):
        candidate_start = clamp_coordinate(
            (drop_start[0] + shift[0] * steps, drop_start[1] + shift[1] * steps),
            grid_size,
        )
        candidate_end = clamp_coordinate(
            (drop_end[0] + shift[0] * steps, drop_end[1] + shift[1] * steps),
            grid_size,
        )
        candidate_score = score_run(candidate_start, candidate_end)
        if candidate_score < best_score:
            best_start = candidate_start
            best_end = candidate_end
            best_score = candidate_score

    return best_start, best_end


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
    focus, run_cells = choose_containment_focus(session_state, fire_cells, focus_target)

    if drop_start is None or drop_end is None:
        run_axis = choose_run_direction(run_cells or [focus], wind)
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

    if fire_cells:
        drop_start, drop_end = shift_run_toward_focus(
            drop_start,
            drop_end,
            focus,
            fire_cells,
            grid_size,
        )

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
