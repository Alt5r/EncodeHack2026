import type {
  AirSupportMission,
  AirSupportPhase,
  AirSupportPayload,
  AircraftModel,
  Cell,
  GridCoordinate,
  SessionState,
} from './types';

export const AIRCRAFT_MODELS: readonly AircraftModel[] = [
  'P2V',
  'HC-130H',
  'BAe-146',
  'MD-87',
  'C-130Q',
  'RJ85',
  'C-130 H & J',
];

export const PAYLOAD_SETTINGS: Record<AirSupportPayload, {
  durationTicks: number;
  spreadReduction: number;
  moistureBoost: number;
  directSuppressChance: number;
}> = {
  water: {
    durationTicks: 8,
    spreadReduction: 0.28,
    moistureBoost: 0.35,
    directSuppressChance: 0.72,
  },
  retardant: {
    durationTicks: 18,
    spreadReduction: 0.46,
    moistureBoost: 0.2,
    directSuppressChance: 0.4,
  },
};

const MISSION_PROGRESS_PER_SECOND: Record<AirSupportPhase, number> = {
  approach: 0.5,
  drop: 0.5,
  exit: 0.16,
  complete: 0,
};

const RUN_DIRECTION_CANDIDATES: GridCoordinate[] = [
  { row: 1, col: 0 },
  { row: 0, col: 1 },
  { row: 1, col: 1 },
  { row: 1, col: -1 },
];

const NEIGHBOUR_OFFSETS: GridCoordinate[] = [
  { row: 1, col: 0 },
  { row: -1, col: 0 },
  { row: 0, col: 1 },
  { row: 0, col: -1 },
  { row: 1, col: 1 },
  { row: 1, col: -1 },
  { row: -1, col: 1 },
  { row: -1, col: -1 },
];

function offMapDistance(gridSize: number, multiplier: number = 1): number {
  return gridSize * multiplier + 8;
}

function exitDepartureDistance(gridSize: number): number {
  return Math.max(10, Math.floor(gridSize / 6));
}

function manhattanDistance(a: GridCoordinate, b: GridCoordinate): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

function midpoint(a: GridCoordinate, b: GridCoordinate): GridCoordinate {
  return {
    row: Math.round((a.row + b.row) / 2),
    col: Math.round((a.col + b.col) / 2),
  };
}

export const AIRCRAFT_SPRITES: Record<AircraftModel, Array<[number, number]>> = {
  P2V: [[0, 2], [1, 1], [1, 2], [1, 3], [2, 2], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [4, 2], [5, 1], [5, 2], [5, 3], [6, 2]],
  'HC-130H': [[0, 2], [1, 2], [2, 1], [2, 2], [2, 3], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [4, 2], [5, 1], [5, 2], [5, 3], [6, 2], [7, 2]],
  'BAe-146': [[0, 2], [1, 1], [1, 2], [1, 3], [2, 2], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [4, 0], [4, 4], [5, 1], [5, 2], [5, 3], [6, 2]],
  'MD-87': [[0, 2], [1, 2], [2, 1], [2, 2], [2, 3], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [4, 2], [5, 1], [5, 2], [5, 3], [6, 1], [6, 3]],
  'C-130Q': [[0, 2], [1, 2], [2, 1], [2, 2], [2, 3], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [4, 0], [4, 4], [5, 1], [5, 2], [5, 3], [6, 2], [7, 2]],
  RJ85: [[0, 2], [1, 1], [1, 2], [1, 3], [2, 1], [2, 2], [2, 3], [3, 0], [3, 2], [3, 4], [4, 1], [4, 2], [4, 3], [5, 2], [6, 2]],
  'C-130 H & J': [[0, 2], [1, 2], [2, 1], [2, 2], [2, 3], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [4, 0], [4, 4], [5, 1], [5, 2], [5, 3], [6, 2], [7, 1], [7, 3]],
};

function clampCoordinate(coordinate: GridCoordinate, gridSize: number): GridCoordinate {
  const max = gridSize - 1;
  return {
    row: Math.max(0, Math.min(max, coordinate.row)),
    col: Math.max(0, Math.min(max, coordinate.col)),
  };
}

function randomFromSeed(seed: number): number {
  let value = seed | 0;
  value = (value + 0x6d2b79f5) | 0;
  let t = Math.imul(value ^ (value >>> 15), 1 | value);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function interpolatePoint(a: GridCoordinate, b: GridCoordinate, progress: number): GridCoordinate {
  return {
    row: a.row + (b.row - a.row) * progress,
    col: a.col + (b.col - a.col) * progress,
  };
}

function normalize(direction: GridCoordinate): { row: number; col: number } {
  const length = Math.hypot(direction.row, direction.col) || 1;
  return {
    row: direction.row / length,
    col: direction.col / length,
  };
}

function projectSpan(cells: GridCoordinate[], direction: GridCoordinate): number {
  const unit = normalize(direction);
  const projections = cells.map((cell) => (cell.row * unit.row) + (cell.col * unit.col));
  return Math.max(...projections) - Math.min(...projections);
}

function chooseRunDirection(
  fireCells: GridCoordinate[],
  wind: GridCoordinate,
): GridCoordinate {
  const windUnit = normalize(wind);
  let best = RUN_DIRECTION_CANDIDATES[0];
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of RUN_DIRECTION_CANDIDATES) {
    const unit = normalize(candidate);
    const spanScore = projectSpan(fireCells, candidate);
    const crosswindScore = 1 - Math.abs((unit.row * windUnit.row) + (unit.col * windUnit.col));
    const diagonalBonus = candidate.row !== 0 && candidate.col !== 0 ? 0.12 : 0;
    const score = spanScore * 1.4 + crosswindScore * 3 + diagonalBonus;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

function getPhaseRoute(mission: AirSupportMission, phase: AirSupportPhase): GridCoordinate[] {
  switch (phase) {
    case 'approach':
      return mission.approachPoints.length > 0 ? mission.approachPoints : [mission.dropStart];
    case 'drop':
      return [mission.dropStart, mission.dropEnd];
    case 'exit':
      return mission.exitPoints.length > 0 ? [mission.dropEnd, ...mission.exitPoints] : [mission.dropEnd];
    default:
      return [mission.dropEnd];
  }
}

function getRouteSegmentState(points: GridCoordinate[], progress: number): {
  position: GridCoordinate;
  heading: GridCoordinate;
} {
  if (points.length <= 1) {
    return {
      position: points[0] ?? { row: 0, col: 0 },
      heading: { row: 0, col: 1 },
    };
  }

  const segmentLengths = points.slice(0, -1).map((point, index) =>
    Math.hypot(
      points[index + 1].row - point.row,
      points[index + 1].col - point.col,
    ) || 1,
  );
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0) || 1;
  let remaining = Math.max(0, Math.min(1, progress)) * totalLength;
  let index = 0;

  while (index < segmentLengths.length - 1 && remaining > segmentLengths[index]) {
    remaining -= segmentLengths[index];
    index += 1;
  }

  const localProgress = Math.max(
    0,
    Math.min(1, remaining / (segmentLengths[index] || 1)),
  );
  return {
    position: interpolatePoint(points[index], points[index + 1], localProgress),
    heading: {
      row: points[index + 1].row - points[index].row,
      col: points[index + 1].col - points[index].col,
    },
  };
}

export function getMissionRenderState(
  mission: AirSupportMission,
  progress: number = mission.progress,
): {
  position: GridCoordinate;
  heading: GridCoordinate;
  phaseRoute: GridCoordinate[];
} {
  const phaseRoute = getPhaseRoute(mission, mission.phase);
  const segment = getRouteSegmentState(phaseRoute, progress);
  return {
    position: segment.position,
    heading: segment.heading,
    phaseRoute,
  };
}

export function getMissionProgressPerSecond(phase: AirSupportPhase): number {
  return MISSION_PROGRESS_PER_SECOND[phase];
}

export function rasterizeLine(start: GridCoordinate, end: GridCoordinate): GridCoordinate[] {
  let row = start.row;
  let col = start.col;
  const dRow = Math.abs(end.row - start.row);
  const dCol = Math.abs(end.col - start.col);
  const stepRow = row < end.row ? 1 : -1;
  const stepCol = col < end.col ? 1 : -1;
  let error = dRow - dCol;
  const cells: GridCoordinate[] = [];

  while (true) {
    cells.push({ row, col });
    if (row === end.row && col === end.col) break;
    const doubleError = error * 2;
    if (doubleError > -dCol) {
      error -= dCol;
      row += stepRow;
    }
    if (doubleError < dRow) {
      error += dRow;
      col += stepCol;
    }
  }

  return cells;
}

export function buildDropCorridor(
  start: GridCoordinate,
  end: GridCoordinate,
  gridSize: number,
  width: number = 1,
): GridCoordinate[] {
  const cells = new Map<string, GridCoordinate>();
  for (const cell of rasterizeLine(start, end)) {
    for (let dr = -width; dr <= width; dr++) {
      for (let dc = -width; dc <= width; dc++) {
        const next = clampCoordinate({ row: cell.row + dr, col: cell.col + dc }, gridSize);
        cells.set(`${next.row},${next.col}`, next);
      }
    }
  }
  return [...cells.values()];
}

export function chooseAircraftModel(seed: number): AircraftModel {
  const index = Math.floor(randomFromSeed(seed) * AIRCRAFT_MODELS.length) % AIRCRAFT_MODELS.length;
  return AIRCRAFT_MODELS[index];
}

function getWindVector(direction: SessionState['wind']['direction']): GridCoordinate {
  switch (direction) {
    case 'N': return { row: -1, col: 0 };
    case 'NE': return { row: -1, col: 1 };
    case 'E': return { row: 0, col: 1 };
    case 'SE': return { row: 1, col: 1 };
    case 'S': return { row: 1, col: 0 };
    case 'SW': return { row: 1, col: -1 };
    case 'W': return { row: 0, col: -1 };
    case 'NW': return { row: -1, col: -1 };
    default: return { row: 0, col: 1 };
  }
}

function extendPoint(point: GridCoordinate, direction: GridCoordinate, distance: number): GridCoordinate {
  return {
    row: point.row + direction.row * distance,
    col: point.col + direction.col * distance,
  };
}

function stepDirection(start: GridCoordinate, end: GridCoordinate): GridCoordinate {
  return {
    row: Math.sign(end.row - start.row),
    col: Math.sign(end.col - start.col),
  };
}

function getFireEdgeAndContainmentCells(
  fireCells: GridCoordinate[],
  gridSize: number,
): { edgeCells: GridCoordinate[]; containmentCells: GridCoordinate[] } {
  const fireSet = new Set(fireCells.map((cell) => `${cell.row},${cell.col}`));
  const edgeCells: GridCoordinate[] = [];
  const containment = new Map<string, GridCoordinate>();

  for (const cell of fireCells) {
    let isEdge = false;
    for (const offset of NEIGHBOUR_OFFSETS) {
      const nextRow = cell.row + offset.row;
      const nextCol = cell.col + offset.col;
      if (nextRow < 0 || nextCol < 0 || nextRow >= gridSize || nextCol >= gridSize) {
        continue;
      }
      const key = `${nextRow},${nextCol}`;
      if (fireSet.has(key)) continue;
      isEdge = true;
      containment.set(key, { row: nextRow, col: nextCol });
    }
    if (isEdge) edgeCells.push(cell);
  }

  return {
    edgeCells,
    containmentCells: [...containment.values()],
  };
}

function chooseContainmentFocus(
  state: SessionState,
  fireCells: GridCoordinate[],
): { focus: GridCoordinate; runCells: GridCoordinate[] } {
  const village = state.villages[0]
    ? { row: state.villages[0].row, col: state.villages[0].col }
    : { row: Math.floor(state.grid_size / 2), col: Math.floor(state.grid_size / 2) };
  const { edgeCells, containmentCells } = getFireEdgeAndContainmentCells(fireCells, state.grid_size);
  const runCells = edgeCells.length > 0 ? edgeCells : fireCells;
  const anchor = runCells.reduce((best, cell) =>
    manhattanDistance(cell, village) < manhattanDistance(best, village) ? cell : best,
  );

  if (containmentCells.length === 0) {
    return { focus: anchor, runCells };
  }

  const nearestEdge = runCells.reduce((best, cell) =>
    manhattanDistance(cell, anchor) < manhattanDistance(best, anchor) ? cell : best,
  );
  const nearbyContainment = containmentCells.filter((cell) =>
    Math.max(Math.abs(cell.row - nearestEdge.row), Math.abs(cell.col - nearestEdge.col)) <= 2,
  );
  let focus = (nearbyContainment.length > 0 ? nearbyContainment : containmentCells).reduce((best, cell) => {
    const bestScore = manhattanDistance(best, anchor) + manhattanDistance(best, village);
    const cellScore = manhattanDistance(cell, anchor) + manhattanDistance(cell, village);
    return cellScore < bestScore ? cell : best;
  });

  const fireSet = new Set(fireCells.map((cell) => `${cell.row},${cell.col}`));
  const outward = stepDirection(nearestEdge, focus);
  const nudged = clampCoordinate(
    { row: focus.row + outward.row, col: focus.col + outward.col },
    state.grid_size,
  );
  if (!fireSet.has(`${nudged.row},${nudged.col}`)) {
    focus = nudged;
  }

  return { focus, runCells };
}

function shiftRunTowardFocus(
  dropStart: GridCoordinate,
  dropEnd: GridCoordinate,
  focus: GridCoordinate,
  fireCells: GridCoordinate[],
  gridSize: number,
): { dropStart: GridCoordinate; dropEnd: GridCoordinate } {
  const fireSet = new Set(fireCells.map((cell) => `${cell.row},${cell.col}`));
  const shift = stepDirection(midpoint(dropStart, dropEnd), focus);
  if (shift.row === 0 && shift.col === 0) {
    return { dropStart, dropEnd };
  }

  const scoreRun = (start: GridCoordinate, end: GridCoordinate) => {
    const overlap = buildDropCorridor(start, end, gridSize, 1)
      .filter((cell) => fireSet.has(`${cell.row},${cell.col}`)).length;
    return overlap * 1000 + manhattanDistance(midpoint(start, end), focus);
  };

  let bestStart = dropStart;
  let bestEnd = dropEnd;
  let bestScore = scoreRun(dropStart, dropEnd);

  for (let steps = 1; steps <= 3; steps++) {
    const nextStart = clampCoordinate(
      { row: dropStart.row + shift.row * steps, col: dropStart.col + shift.col * steps },
      gridSize,
    );
    const nextEnd = clampCoordinate(
      { row: dropEnd.row + shift.row * steps, col: dropEnd.col + shift.col * steps },
      gridSize,
    );
    const score = scoreRun(nextStart, nextEnd);
    if (score < bestScore) {
      bestStart = nextStart;
      bestEnd = nextEnd;
      bestScore = score;
    }
  }

  return { dropStart: bestStart, dropEnd: bestEnd };
}

function buildCenteredRun(
  focus: GridCoordinate,
  runAxis: GridCoordinate,
  gridSize: number,
  radius: number = 3,
): { dropStart: GridCoordinate; dropEnd: GridCoordinate } {
  return {
    dropStart: clampCoordinate(
      { row: focus.row - runAxis.row * radius, col: focus.col - runAxis.col * radius },
      gridSize,
    ),
    dropEnd: clampCoordinate(
      { row: focus.row + runAxis.row * radius, col: focus.col + runAxis.col * radius },
      gridSize,
    ),
  };
}

function getRunFireOverlap(
  dropStart: GridCoordinate,
  dropEnd: GridCoordinate,
  fireCells: GridCoordinate[],
  gridSize: number,
): number {
  const fireSet = new Set(fireCells.map((cell) => `${cell.row},${cell.col}`));
  return buildDropCorridor(dropStart, dropEnd, gridSize, 1)
    .filter((cell) => fireSet.has(`${cell.row},${cell.col}`)).length;
}

function sanitizeRunToContainment(
  dropStart: GridCoordinate,
  dropEnd: GridCoordinate,
  focus: GridCoordinate,
  runCells: GridCoordinate[],
  fireCells: GridCoordinate[],
  wind: GridCoordinate,
  gridSize: number,
): { dropStart: GridCoordinate; dropEnd: GridCoordinate } {
  if (fireCells.length === 0) {
    return { dropStart, dropEnd };
  }

  let best = shiftRunTowardFocus(dropStart, dropEnd, focus, fireCells, gridSize);
  let bestOverlap = getRunFireOverlap(best.dropStart, best.dropEnd, fireCells, gridSize);
  if (bestOverlap <= 2) {
    return best;
  }

  const requestedAxis = stepDirection(dropStart, dropEnd);
  const runAxis = requestedAxis.row !== 0 || requestedAxis.col !== 0
    ? requestedAxis
    : chooseRunDirection(runCells.length > 0 ? runCells : [focus], wind);
  const nearestEdge = (runCells.length > 0 ? runCells : fireCells).reduce((currentBest, cell) =>
    manhattanDistance(cell, focus) < manhattanDistance(currentBest, focus) ? cell : currentBest,
  );
  const outward = stepDirection(nearestEdge, focus);
  const outwardRow = outward.row || (-wind.row || 1);
  const outwardCol = outward.col || (-wind.col || 0);

  for (let shiftSteps = 0; shiftSteps <= 5; shiftSteps += 1) {
    const shiftedFocus = clampCoordinate(
      {
        row: focus.row + outwardRow * shiftSteps,
        col: focus.col + outwardCol * shiftSteps,
      },
      gridSize,
    );
    const candidate = buildCenteredRun(shiftedFocus, runAxis, gridSize);
    const overlap = getRunFireOverlap(candidate.dropStart, candidate.dropEnd, fireCells, gridSize);
    if (
      overlap < bestOverlap
      || (overlap === bestOverlap
        && manhattanDistance(midpoint(candidate.dropStart, candidate.dropEnd), focus)
          < manhattanDistance(midpoint(best.dropStart, best.dropEnd), focus))
    ) {
      best = candidate;
      bestOverlap = overlap;
    }
  }

  return best;
}

export function buildFallbackAirSupportMission(
  state: SessionState,
  seed: number,
  payloadType: AirSupportPayload = 'retardant',
): AirSupportMission | null {
  const fireCells = state.cells.filter((cell): cell is Cell => cell.state === 'fire');
  if (fireCells.length === 0) return null;

  const { focus, runCells } = chooseContainmentFocus(state, fireCells);
  const wind = getWindVector(state.wind.direction);
  const runAxis = chooseRunDirection(runCells, wind);
  let { dropStart, dropEnd } = buildCenteredRun(focus, runAxis, state.grid_size);
  ({ dropStart, dropEnd } = sanitizeRunToContainment(
    dropStart,
    dropEnd,
    focus,
    runCells,
    fireCells,
    wind,
    state.grid_size,
  ));
  const entryDirection = { row: -(wind.row || runAxis.row || 1), col: -(wind.col || runAxis.col || 0) };
  const entry = extendPoint(
    dropStart,
    entryDirection,
    offMapDistance(state.grid_size),
  );
  const mid = extendPoint(
    dropStart,
    entryDirection,
    Math.max(4, Math.floor(state.grid_size / 10)),
  );
  const runDirection = stepDirection(dropStart, dropEnd);
  const exitNear = extendPoint(dropEnd, runDirection, exitDepartureDistance(state.grid_size));

  return {
    id: `mock-air-${state.tick + 1}`,
    aircraftModel: chooseAircraftModel(seed + state.tick * 37),
    payloadType,
    approachPoints: [entry, mid, dropStart],
    dropStart,
    dropEnd,
    exitPoints: [exitNear],
    phase: 'approach',
    progress: 0,
  };
}
