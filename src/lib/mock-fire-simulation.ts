import {
  buildDropCorridor,
  buildFallbackAirSupportMission,
  getMissionProgressPerSecond,
  PAYLOAD_SETTINGS,
} from './air-support';
import type { SessionTerrainCellData } from './cell-info';
import type {
  AirSupportMission,
  Cell,
  GridCoordinate,
  ScoreSummary,
  SessionState,
  TreatedCell,
  Unit,
} from './types';

const NEIGHBOURS: Array<{ dr: number; dc: number; diagonal: boolean }> = [
  { dr: 1, dc: 0, diagonal: false },
  { dr: -1, dc: 0, diagonal: false },
  { dr: 0, dc: 1, diagonal: false },
  { dr: 0, dc: -1, diagonal: false },
  { dr: 1, dc: 1, diagonal: true },
  { dr: 1, dc: -1, diagonal: true },
  { dr: -1, dc: 1, diagonal: true },
  { dr: -1, dc: -1, diagonal: true },
];

const WIND_VECTORS: Record<string, { row: number; col: number }> = {
  N: { row: -1, col: 0 },
  NE: { row: -0.7071, col: 0.7071 },
  E: { row: 0, col: 1 },
  SE: { row: 0.7071, col: 0.7071 },
  S: { row: 1, col: 0 },
  SW: { row: 0.7071, col: -0.7071 },
  W: { row: 0, col: -1 },
  NW: { row: -0.7071, col: -0.7071 },
};

const VEGETATION_FUEL: Record<SessionTerrainCellData['vegetation'], number> = {
  clearing: 0.2,
  meadow: 0.5,
  woodland: 0.8,
  forest: 1.0,
};

const VEGETATION_SPREAD: Record<SessionTerrainCellData['vegetation'], number> = {
  clearing: 0.25,
  meadow: 0.55,
  woodland: 1.0,
  forest: 1.3,
};

const UNIT_MOVE_STEPS_PER_TICK = {
  helicopter: 1,
  ground_crew: 2,
} as const;

const GROUND_CREW_MOVE_BUDGET_PER_TICK = 2.6;
const GROUND_CREW_DIAGONAL_COST = 0.15;
const GROUND_CREW_MAX_SLOPE_COST = 0.75;
const GROUND_CREW_FIRE_EDGE_PENALTY = 0.9;
const GROUND_CREW_FIRE_NEARBY_PENALTY = 0.3;
const GROUND_CREW_WATER_EDGE_PENALTY = 0.55;
const GROUND_CREW_WATER_NEARBY_PENALTY = 0.2;
const GROUND_CREW_MAX_STEP_COST = 2.35;

function randomFromSeed(seed: number): number {
  let value = seed | 0;
  value = (value + 0x6d2b79f5) | 0;
  let t = Math.imul(value ^ (value >>> 15), 1 | value);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function coordinateKey(row: number, col: number): string {
  return `${row},${col}`;
}

function sign(value: number): number {
  if (value === 0) return 0;
  return value > 0 ? 1 : -1;
}

function moveTowards(
  row: number,
  col: number,
  targetRow: number,
  targetCol: number,
  maxSteps: number,
) {
  let nextRow = row;
  let nextCol = col;
  for (let step = 0; step < maxSteps; step++) {
    if (nextRow === targetRow && nextCol === targetCol) break;
    nextRow += sign(targetRow - nextRow);
    nextCol += sign(targetCol - nextCol);
  }
  return { row: nextRow, col: nextCol };
}

function getActiveFireKeys(state: SessionState): Set<string> {
  return new Set(
    state.cells
      .filter((cell) => cell.state === 'fire')
      .map((cell) => coordinateKey(cell.row, cell.col)),
  );
}

function isGroundCellPassable(
  row: number,
  col: number,
  terrainGrid: SessionTerrainCellData[][],
  fireKeys: Set<string>,
): boolean {
  if (row < 0 || col < 0 || row >= terrainGrid.length || col >= terrainGrid.length) {
    return false;
  }
  if (terrainGrid[row][col].water !== 'none') {
    return false;
  }
  return !fireKeys.has(coordinateKey(row, col));
}

function getGroundWaterPenalty(
  row: number,
  col: number,
  terrainGrid: SessionTerrainCellData[][],
): number {
  for (let radius = 1; radius <= 2; radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
        const nextRow = row + dr;
        const nextCol = col + dc;
        if (nextRow < 0 || nextCol < 0 || nextRow >= terrainGrid.length || nextCol >= terrainGrid.length) {
          continue;
        }
        if (terrainGrid[nextRow][nextCol].water === 'none') continue;
        return radius === 1 ? GROUND_CREW_WATER_EDGE_PENALTY : GROUND_CREW_WATER_NEARBY_PENALTY;
      }
    }
  }
  return 0;
}

function getGroundFirePenalty(
  row: number,
  col: number,
  fireKeys: Set<string>,
): number {
  for (let radius = 1; radius <= 2; radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
        if (fireKeys.has(coordinateKey(row + dr, col + dc))) {
          return radius === 1 ? GROUND_CREW_FIRE_EDGE_PENALTY : GROUND_CREW_FIRE_NEARBY_PENALTY;
        }
      }
    }
  }
  return 0;
}

function getGroundStepCost(
  current: GridCoordinate,
  next: GridCoordinate,
  terrainGrid: SessionTerrainCellData[][],
  fireKeys: Set<string>,
): number {
  const diagonal = current.row !== next.row && current.col !== next.col;
  const elevationDelta = Math.abs(
    terrainGrid[next.row][next.col].elevation - terrainGrid[current.row][current.col].elevation,
  );
  const slopeCost = Math.min(GROUND_CREW_MAX_SLOPE_COST, elevationDelta * 2.5);
  const stepCost =
    1 +
    (diagonal ? GROUND_CREW_DIAGONAL_COST : 0) +
    slopeCost +
    getGroundFirePenalty(next.row, next.col, fireKeys) +
    getGroundWaterPenalty(next.row, next.col, terrainGrid);
  return Math.min(GROUND_CREW_MAX_STEP_COST, stepCost);
}

function reconstructGroundPath(
  parents: Map<string, GridCoordinate | null>,
  target: GridCoordinate,
): GridCoordinate[] {
  const path: GridCoordinate[] = [target];
  let current: GridCoordinate | null = target;
  while (current) {
    const parent: GridCoordinate | null = parents.get(coordinateKey(current.row, current.col)) ?? null;
    if (!parent) break;
    path.push(parent);
    current = parent;
  }
  path.reverse();
  return path;
}

function findGroundPath(
  origin: GridCoordinate,
  target: GridCoordinate,
  state: SessionState,
  terrainGrid: SessionTerrainCellData[][],
): GridCoordinate[] | null {
  const fireKeys = getActiveFireKeys(state);
  if (!isGroundCellPassable(target.row, target.col, terrainGrid, fireKeys)) {
    return null;
  }
  if (origin.row === target.row && origin.col === target.col) {
    return [origin];
  }

  const frontier: Array<GridCoordinate & { priority: number; serial: number }> = [
    { ...origin, priority: 0, serial: 0 },
  ];
  const parents = new Map<string, GridCoordinate | null>([
    [coordinateKey(origin.row, origin.col), null],
  ]);
  const costSoFar = new Map<string, number>([
    [coordinateKey(origin.row, origin.col), 0],
  ]);
  let serial = 1;

  while (frontier.length > 0) {
    frontier.sort((a, b) => (
      a.priority === b.priority ? a.serial - b.serial : a.priority - b.priority
    ));
    const current = frontier.shift()!;
    if (current.row === target.row && current.col === target.col) {
      return reconstructGroundPath(parents, target);
    }

    const currentKey = coordinateKey(current.row, current.col);
    const currentCost = costSoFar.get(currentKey) ?? 0;

    for (const neighbour of NEIGHBOURS) {
      const nextRow = current.row + neighbour.dr;
      const nextCol = current.col + neighbour.dc;
      if (!isGroundCellPassable(nextRow, nextCol, terrainGrid, fireKeys)) {
        continue;
      }
      const next: GridCoordinate = { row: nextRow, col: nextCol };
      const nextKey = coordinateKey(nextRow, nextCol);
      const nextCost = currentCost + getGroundStepCost(
        { row: current.row, col: current.col },
        next,
        terrainGrid,
        fireKeys,
      );
      const known = costSoFar.get(nextKey);
      if (known != null && known <= nextCost) {
        continue;
      }
      costSoFar.set(nextKey, nextCost);
      parents.set(nextKey, { row: current.row, col: current.col });
      frontier.push({
        ...next,
        priority: nextCost + Math.max(Math.abs(target.row - nextRow), Math.abs(target.col - nextCol)),
        serial,
      });
      serial += 1;
    }
  }

  return null;
}

function moveGroundUnit(
  unit: Unit,
  state: SessionState,
  terrainGrid: SessionTerrainCellData[][],
): GridCoordinate {
  if (!unit.target) {
    return { row: unit.row, col: unit.col };
  }
  const path = findGroundPath(
    { row: unit.row, col: unit.col },
    unit.target,
    state,
    terrainGrid,
  );
  if (!path || path.length <= 1) {
    return { row: unit.row, col: unit.col };
  }

  const fireKeys = getActiveFireKeys(state);
  let budgetRemaining = GROUND_CREW_MOVE_BUDGET_PER_TICK;
  let current = { row: unit.row, col: unit.col };
  for (const next of path.slice(1)) {
    const stepCost = getGroundStepCost(current, next, terrainGrid, fireKeys);
    if (stepCost > budgetRemaining) {
      break;
    }
    budgetRemaining -= stepCost;
    current = next;
  }
  return current;
}

function resolveGroundCrewCasualties(state: SessionState): SessionState {
  const fireKeys = getActiveFireKeys(state);
  return {
    ...state,
    units: state.units.map((unit) => {
      if (
        unit.type !== 'ground_crew' ||
        !unit.is_active ||
        !fireKeys.has(coordinateKey(unit.row, unit.col))
      ) {
        return unit;
      }
      return {
        ...unit,
        is_active: false,
        target: null,
        status_text: 'lost',
      };
    }),
  };
}

function buildVillageSet(state: SessionState): Set<string> {
  const cells = new Set<string>();
  for (const village of state.villages) {
    for (let row = village.row; row < village.row + village.size; row++) {
      for (let col = village.col; col < village.col + village.size; col++) {
        cells.add(coordinateKey(row, col));
      }
    }
  }
  return cells;
}

function getTreatedCell(row: number, col: number, state: SessionState): TreatedCell | undefined {
  return state.treatedCells.find((cell) => cell.row === row && cell.col === col);
}

function getMoisture(
  row: number,
  col: number,
  terrainGrid: SessionTerrainCellData[][],
  state: SessionState,
): number {
  if (terrainGrid[row][col].water !== 'none') return 1;

  for (let radius = 1; radius <= 2; radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        const nextRow = row + dr;
        const nextCol = col + dc;
        if (nextRow < 0 || nextCol < 0 || nextRow >= terrainGrid.length || nextCol >= terrainGrid.length) {
          continue;
        }
        if (terrainGrid[nextRow][nextCol].water === 'none') continue;
        return radius === 1 ? 0.7 : 0.5;
      }
    }
  }

  const treated = getTreatedCell(row, col, state);
  if (!treated) return 0.3;
  return Math.min(1, 0.3 + PAYLOAD_SETTINGS[treated.payloadType].moistureBoost * treated.strength);
}

function computeSpreadProbability(
  source: Cell,
  targetRow: number,
  targetCol: number,
  terrainGrid: SessionTerrainCellData[][],
  state: SessionState,
  windDirection: string,
  windSpeed: number,
  diagonal: boolean,
): number {
  const sourceTerrain = terrainGrid[source.row][source.col];
  const targetTerrain = terrainGrid[targetRow][targetCol];
  const wind = WIND_VECTORS[windDirection] ?? { row: 0, col: 0 };

  const spreadRow = targetRow - source.row;
  const spreadCol = targetCol - source.col;
  const spreadLength = Math.hypot(spreadRow, spreadCol) || 1;
  const alignment = (spreadRow / spreadLength) * wind.row + (spreadCol / spreadLength) * wind.col;
  const windFactor = Math.max(0.15, Math.min(2.6, 1 + alignment * (windSpeed / 20)));

  const slopeDelta = targetTerrain.elevation - sourceTerrain.elevation;
  const slopeFactor = Math.max(0.35, Math.min(2.4, 1 + slopeDelta * 5));
  const moistureFactor = 1 - getMoisture(targetRow, targetCol, terrainGrid, state) * 0.75;
  const treated = getTreatedCell(targetRow, targetCol, state);
  const treatmentFactor = treated
    ? Math.max(0.2, 1 - PAYLOAD_SETTINGS[treated.payloadType].spreadReduction * treated.strength)
    : 1;
  const diagonalFactor = diagonal ? 0.72 : 1;
  const fuelFactor = 0.55 + source.fuel * 0.8;

  const probability =
    0.14 *
    VEGETATION_SPREAD[targetTerrain.vegetation] *
    windFactor *
    slopeFactor *
    moistureFactor *
    treatmentFactor *
    diagonalFactor *
    fuelFactor;

  return Math.max(0, Math.min(0.75, probability));
}

function buildScore(state: SessionState, villageCells: Set<string>): ScoreSummary {
  const burned = state.cells.filter((cell) => cell.state === 'burned');
  const villageDamage = burned.filter((cell) => villageCells.has(coordinateKey(cell.row, cell.col))).length;

  return {
    time_elapsed_seconds: state.tick,
    burned_cells: burned.length,
    suppressed_cells: state.cells.filter((cell) => cell.state === 'suppressed').length,
    firebreak_cells: state.cells.filter((cell) => cell.state === 'firebreak').length,
    village_damage: villageDamage,
  };
}

function naturalBurnoutUnlocked(state: SessionState): boolean {
  return state.cells.some((cell) => cell.state === 'suppressed');
}

function decayTreatedCells(treatedCells: TreatedCell[]): TreatedCell[] {
  return treatedCells
    .map((cell) => ({
      ...cell,
      remainingTicks: cell.remainingTicks - 1,
      strength: Math.max(
        0.15,
        cell.strength * (cell.payloadType === 'retardant' ? 0.96 : 0.9),
      ),
    }))
    .filter((cell) => cell.remainingTicks > 0);
}

function mergeTreatedCells(existing: TreatedCell[], incoming: TreatedCell[]): TreatedCell[] {
  const map = new Map<string, TreatedCell>();
  for (const cell of existing) {
    map.set(coordinateKey(cell.row, cell.col), cell);
  }
  for (const cell of incoming) {
    const key = coordinateKey(cell.row, cell.col);
    const current = map.get(key);
    if (!current) {
      map.set(key, cell);
      continue;
    }
    map.set(key, {
      row: cell.row,
      col: cell.col,
      payloadType:
        PAYLOAD_SETTINGS[cell.payloadType].durationTicks >= PAYLOAD_SETTINGS[current.payloadType].durationTicks
          ? cell.payloadType
          : current.payloadType,
      strength: Math.max(cell.strength, current.strength),
      remainingTicks: Math.max(cell.remainingTicks, current.remainingTicks),
    });
  }
  return [...map.values()];
}

function applyAirSupportDrop(
  state: SessionState,
  mission: AirSupportMission,
  terrainGrid: SessionTerrainCellData[][],
  seed: number,
): SessionState {
  const corridor = buildDropCorridor(mission.dropStart, mission.dropEnd, state.grid_size, 1);
  const fireMap = new Map(
    state.cells
      .filter((cell) => cell.state === 'fire')
      .map((cell) => [coordinateKey(cell.row, cell.col), cell]),
  );
  const nonFireCells = state.cells.filter((cell) => cell.state !== 'fire');
  const suppressedCells: Cell[] = [];
  const nextFire: Cell[] = [];
  const treatedCells: TreatedCell[] = [];

  for (const cell of corridor) {
    if (terrainGrid[cell.row][cell.col].water === 'none') {
      treatedCells.push({
        row: cell.row,
        col: cell.col,
        payloadType: mission.payloadType,
        strength: mission.payloadType === 'retardant' ? 1 : 0.9,
        remainingTicks: PAYLOAD_SETTINGS[mission.payloadType].durationTicks,
      });
    }

    const key = coordinateKey(cell.row, cell.col);
    const fireCell = fireMap.get(key);
    if (!fireCell) continue;
    const roll = randomFromSeed(seed + state.tick * 701 + cell.row * 37 + cell.col * 53);
    if (roll < PAYLOAD_SETTINGS[mission.payloadType].directSuppressChance) {
      suppressedCells.push({
        ...fireCell,
        state: 'suppressed',
        fuel: Math.max(0.1, fireCell.fuel - 0.3),
        moisture: 0.95,
      });
      fireMap.delete(key);
      continue;
    }
    nextFire.push({
      ...fireCell,
      fuel: Math.max(0.05, fireCell.fuel - (mission.payloadType === 'retardant' ? 0.18 : 0.3)),
      moisture: Math.max(fireCell.moisture, 0.7),
    });
    fireMap.delete(key);
  }

  for (const fireCell of fireMap.values()) {
    nextFire.push(fireCell);
  }

  return {
    ...state,
    cells: [...nonFireCells, ...suppressedCells, ...nextFire],
    treatedCells: mergeTreatedCells(state.treatedCells, treatedCells),
  };
}

function advanceAirSupportMissions(
  state: SessionState,
  terrainGrid: SessionTerrainCellData[][],
  seed: number,
): SessionState {
  let nextState: SessionState = {
    ...state,
    treatedCells: decayTreatedCells(state.treatedCells),
  };

  let missions = nextState.airSupportMissions;
  const newMissionIds = new Set<string>();
  if (missions.length === 0 && nextState.tick > 0 && nextState.tick % 6 === 0) {
    const payloadType = nextState.cells.filter((cell) => cell.state === 'fire').length <= 4
      ? 'water'
      : 'retardant';
    const generated = buildFallbackAirSupportMission(nextState, seed, payloadType);
    if (generated) {
      missions = [...missions, generated];
      newMissionIds.add(generated.id);
    }
  }

  const nextMissions: AirSupportMission[] = [];
  for (const mission of missions) {
    if (newMissionIds.has(mission.id)) {
      nextMissions.push(mission);
      continue;
    }
    const progress = Math.min(1, mission.progress + getMissionProgressPerSecond(mission.phase));
    if (mission.phase === 'approach') {
      if (progress >= 1) {
        const dropMission: AirSupportMission = { ...mission, phase: 'drop', progress: 0 };
        nextState = applyAirSupportDrop(nextState, dropMission, terrainGrid, seed);
        nextMissions.push(dropMission);
      } else {
        nextMissions.push({ ...mission, progress });
      }
      continue;
    }

    if (mission.phase === 'drop') {
      if (progress >= 1) {
        nextMissions.push({ ...mission, phase: 'exit', progress: 0 });
      } else {
        nextMissions.push({ ...mission, progress });
      }
      continue;
    }

    if (mission.phase === 'exit' && progress < 1) {
      nextMissions.push({ ...mission, progress });
    }
  }

  return {
    ...nextState,
    airSupportMissions: nextMissions,
  };
}

function advanceUnits(
  state: SessionState,
  terrainGrid: SessionTerrainCellData[][],
): SessionState {
  return {
    ...state,
    units: state.units.map((unit) => {
      if (!unit.is_active) {
        return { ...unit, target: null };
      }
      if (!unit.target || unit.status_text === 'holding') {
        return unit.status_text === 'holding' && unit.target
          ? { ...unit, target: null }
          : unit;
      }
      if (unit.row === unit.target.row && unit.col === unit.target.col) {
        return unit.status_text === 'moving'
          ? { ...unit, target: null, status_text: 'ready' }
          : unit;
      }

      if (unit.type === 'ground_crew') {
        const safePath = findGroundPath(
          { row: unit.row, col: unit.col },
          unit.target,
          state,
          terrainGrid,
        );
        if (!safePath) {
          return {
            ...unit,
            target: null,
            status_text: 'holding',
          };
        }
      }

      const moved = unit.type === 'ground_crew'
        ? moveGroundUnit(unit, state, terrainGrid)
        : moveTowards(
          unit.row,
          unit.col,
          unit.target.row,
          unit.target.col,
          UNIT_MOVE_STEPS_PER_TICK[unit.type],
        );
      const reached = moved.row === unit.target.row && moved.col === unit.target.col;
      return {
        ...unit,
        row: moved.row,
        col: moved.col,
        target: reached && unit.status_text === 'moving' ? null : unit.target,
        status_text: reached && unit.status_text === 'moving' ? 'ready' : unit.status_text,
      };
    }),
  };
}

export function advanceMockSessionState(
  state: SessionState,
  terrainGrid: SessionTerrainCellData[][],
  seed: number,
): SessionState {
  if (state.status === 'won' || state.status === 'lost' || state.status === 'ended') {
    return state;
  }

  const airSupportState = advanceAirSupportMissions(state, terrainGrid, seed);
  const casualtyCheckedState = resolveGroundCrewCasualties(airSupportState);
  const movementState = advanceUnits(casualtyCheckedState, terrainGrid);

  const staticCells = movementState.cells.filter((cell) => cell.state !== 'fire' && cell.state !== 'burned');
  const currentFire = movementState.cells.filter((cell) => cell.state === 'fire');
  const burnedCells = movementState.cells.filter((cell) => cell.state === 'burned');
  const occupied = new Set<string>([
    ...staticCells.map((cell) => coordinateKey(cell.row, cell.col)),
    ...burnedCells.map((cell) => coordinateKey(cell.row, cell.col)),
    ...currentFire.map((cell) => coordinateKey(cell.row, cell.col)),
  ]);

  const nextFire: Cell[] = [];
  const nextBurned = [...burnedCells];
  const newKeys = new Set<string>();
  const burnoutUnlocked = naturalBurnoutUnlocked(movementState);

  for (const cell of currentFire) {
    const remainingFuel = Math.max(0, cell.fuel - 0.045);
    if (remainingFuel <= 0.01) {
      if (!burnoutUnlocked) {
        nextFire.push({ ...cell, fuel: 0.01, moisture: getMoisture(cell.row, cell.col, terrainGrid, movementState) });
        continue;
      }
      nextBurned.push({ ...cell, state: 'burned', fuel: 0, moisture: 0 });
      occupied.delete(coordinateKey(cell.row, cell.col));
      continue;
    }
    nextFire.push({ ...cell, fuel: remainingFuel });
  }

  const spreadSources = [...nextFire];

  for (const source of spreadSources) {
    for (const neighbour of NEIGHBOURS) {
      const row = source.row + neighbour.dr;
      const col = source.col + neighbour.dc;

      if (row < 0 || col < 0 || row >= movementState.grid_size || col >= movementState.grid_size) continue;

      const key = coordinateKey(row, col);
      if (occupied.has(key) || newKeys.has(key)) continue;
      if (terrainGrid[row][col].water !== 'none') continue;

      const probability = computeSpreadProbability(
        source,
        row,
        col,
        terrainGrid,
        movementState,
        movementState.wind.direction,
        movementState.wind.speed_mph,
        neighbour.diagonal,
      );
      const roll = randomFromSeed(
        seed + movementState.tick * 10007 + source.row * 431 + source.col * 863 + row * 1733 + col * 3467,
      );
      if (roll >= probability) continue;

      newKeys.add(key);
      nextFire.push({
        row,
        col,
        state: 'fire',
        fuel: VEGETATION_FUEL[terrainGrid[row][col].vegetation],
        moisture: getMoisture(row, col, terrainGrid, airSupportState),
      });
    }
  }

  const villageCells = buildVillageSet(movementState);
  const activeVillageFire = nextFire.some((cell) => villageCells.has(coordinateKey(cell.row, cell.col)));

  const nextState: SessionState = {
    ...movementState,
    tick: movementState.tick + 1,
    status: activeVillageFire ? 'lost' : nextFire.length === 0 && burnoutUnlocked ? 'won' : 'running',
    cells: [...staticCells, ...nextBurned, ...nextFire],
  };

  const casualtyResolvedState = resolveGroundCrewCasualties(nextState);
  casualtyResolvedState.score = buildScore(casualtyResolvedState, villageCells);
  return casualtyResolvedState;
}
