"""Shared planning safety helpers for fire-edge targeting and crew standoff."""

from __future__ import annotations

from watchtower_backend.domain.models.simulation import CommandAction, SessionState

NEIGHBOUR_OFFSETS: tuple[tuple[int, int], ...] = (
    (1, 0),
    (-1, 0),
    (0, 1),
    (0, -1),
    (1, 1),
    (1, -1),
    (-1, 1),
    (-1, -1),
)

_GROUND_MIN_FIRE_CLEARANCE = 2
_GROUND_DESIRED_FIRE_CLEARANCE = 3


def fire_edge_context(session_state: SessionState) -> tuple[list[tuple[int, int]], list[tuple[int, int]]]:
    """Return burning edge cells and their immediate non-burning neighbours."""
    fire_set = set(session_state.fire_cells)
    edge_cells: list[tuple[int, int]] = []
    containment_cells: dict[tuple[int, int], None] = {}

    for row, col in session_state.fire_cells:
        is_edge = False
        for delta_row, delta_col in NEIGHBOUR_OFFSETS:
            next_row = row + delta_row
            next_col = col + delta_col
            if not (0 <= next_row < session_state.grid_size and 0 <= next_col < session_state.grid_size):
                continue
            neighbour = (next_row, next_col)
            if neighbour in fire_set:
                continue
            is_edge = True
            containment_cells[neighbour] = None
        if is_edge:
            edge_cells.append((row, col))

    return edge_cells, list(containment_cells.keys())


def preview_firebreak_cells(
    session_state: SessionState,
    target: tuple[int, int],
) -> list[tuple[int, int]]:
    """Return the cells that would be affected by a firebreak centered on target."""
    max_index = session_state.grid_size - 1
    cells: list[tuple[int, int]] = []
    for offset in range(-1, 2):
        cell = (
            max(0, min(max_index, target[0] + offset)),
            max(0, min(max_index, target[1])),
        )
        if cell not in cells:
            cells.append(cell)
    return cells


def fire_clearance(
    session_state: SessionState,
    cell: tuple[int, int],
) -> int:
    """Return Chebyshev distance from one cell to the nearest active fire."""
    if not session_state.fire_cells:
        return session_state.grid_size
    return min(
        max(abs(cell[0] - fire[0]), abs(cell[1] - fire[1]))
        for fire in session_state.fire_cells
    )


def ground_target_safe(
    session_state: SessionState,
    action: CommandAction,
    target: tuple[int, int],
) -> bool:
    """Return whether one ground target keeps enough standoff from the active fire."""
    fire_cells = set(session_state.fire_cells)
    if target in fire_cells:
        return False
    if fire_clearance(session_state, target) < _GROUND_MIN_FIRE_CLEARANCE:
        return False
    if action is CommandAction.CREATE_FIREBREAK:
        preview = preview_firebreak_cells(session_state, target)
        if any(cell in fire_cells for cell in preview):
            return False
        if any(fire_clearance(session_state, cell) < _GROUND_MIN_FIRE_CLEARANCE for cell in preview):
            return False
    return True


def safe_ground_candidates(
    session_state: SessionState,
    *,
    preferred_target: tuple[int, int] | None = None,
    limit: int = 24,
) -> list[tuple[int, int]]:
    """Return safe ground-crew target candidates ranked by usefulness."""
    if preferred_target is None:
        village_anchor = session_state.village.top_left
        edge_cells, _ = fire_edge_context(session_state)
        preferred_target = min(
            edge_cells or session_state.fire_cells or [village_anchor],
            key=lambda cell: abs(cell[0] - village_anchor[0]) + abs(cell[1] - village_anchor[1]),
        )

    village_anchor = session_state.village.top_left
    candidates: list[tuple[tuple[int, int, int], tuple[int, int]]] = []
    for row in range(session_state.grid_size):
        for col in range(session_state.grid_size):
            cell = (row, col)
            if not ground_target_safe(session_state, CommandAction.CREATE_FIREBREAK, cell):
                continue
            clearance = fire_clearance(session_state, cell)
            score = (
                abs(clearance - _GROUND_DESIRED_FIRE_CLEARANCE),
                abs(cell[0] - preferred_target[0]) + abs(cell[1] - preferred_target[1]),
                abs(cell[0] - village_anchor[0]) + abs(cell[1] - village_anchor[1]),
            )
            candidates.append((score, cell))

    candidates.sort(key=lambda row: row[0])
    return [cell for _, cell in candidates[:limit]]


def choose_safe_ground_target(
    session_state: SessionState,
    *,
    preferred_target: tuple[int, int] | None = None,
) -> tuple[int, int] | None:
    """Pick the best currently safe ground-crew target near the requested area."""
    candidates = safe_ground_candidates(
        session_state,
        preferred_target=preferred_target,
        limit=1,
    )
    return candidates[0] if candidates else None
