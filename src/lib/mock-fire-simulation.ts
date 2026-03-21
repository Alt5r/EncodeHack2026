import type { SessionTerrainCellData } from './cell-info';
import type { Cell, ScoreSummary, SessionState } from './types';

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

function getMoisture(row: number, col: number, terrainGrid: SessionTerrainCellData[][]): number {
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

  return 0.3;
}

function computeSpreadProbability(
  source: Cell,
  targetRow: number,
  targetCol: number,
  terrainGrid: SessionTerrainCellData[][],
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
  const moistureFactor = 1 - getMoisture(targetRow, targetCol, terrainGrid) * 0.75;
  const diagonalFactor = diagonal ? 0.72 : 1;
  const fuelFactor = 0.55 + source.fuel * 0.8;

  const probability =
    0.14 *
    VEGETATION_SPREAD[targetTerrain.vegetation] *
    windFactor *
    slopeFactor *
    moistureFactor *
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

export function advanceMockSessionState(
  state: SessionState,
  terrainGrid: SessionTerrainCellData[][],
  seed: number,
): SessionState {
  if (state.status === 'won' || state.status === 'lost' || state.status === 'ended') {
    return state;
  }

  const staticCells = state.cells.filter((cell) => cell.state !== 'fire' && cell.state !== 'burned');
  const currentFire = state.cells.filter((cell) => cell.state === 'fire');
  const burnedCells = state.cells.filter((cell) => cell.state === 'burned');
  const occupied = new Set<string>([
    ...staticCells.map((cell) => coordinateKey(cell.row, cell.col)),
    ...burnedCells.map((cell) => coordinateKey(cell.row, cell.col)),
    ...currentFire.map((cell) => coordinateKey(cell.row, cell.col)),
  ]);

  const nextFire: Cell[] = [];
  const nextBurned = [...burnedCells];
  const newKeys = new Set<string>();

  for (const cell of currentFire) {
    const remainingFuel = Math.max(0, cell.fuel - 0.045);
    if (remainingFuel <= 0.01) {
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

      if (row < 0 || col < 0 || row >= state.grid_size || col >= state.grid_size) continue;

      const key = coordinateKey(row, col);
      if (occupied.has(key) || newKeys.has(key)) continue;
      if (terrainGrid[row][col].water !== 'none') continue;

      const probability = computeSpreadProbability(
        source,
        row,
        col,
        terrainGrid,
        state.wind.direction,
        state.wind.speed_mph,
        neighbour.diagonal,
      );
      const roll = randomFromSeed(
        seed + state.tick * 10007 + source.row * 431 + source.col * 863 + row * 1733 + col * 3467,
      );
      if (roll >= probability) continue;

      newKeys.add(key);
      nextFire.push({
        row,
        col,
        state: 'fire',
        fuel: VEGETATION_FUEL[terrainGrid[row][col].vegetation],
        moisture: getMoisture(row, col, terrainGrid),
      });
    }
  }

  const villageCells = buildVillageSet(state);
  const activeVillageFire = nextFire.some((cell) => villageCells.has(coordinateKey(cell.row, cell.col)));

  const nextState: SessionState = {
    ...state,
    tick: state.tick + 1,
    status: activeVillageFire ? 'lost' : nextFire.length === 0 ? 'won' : 'running',
    cells: [...staticCells, ...nextBurned, ...nextFire],
  };

  nextState.score = buildScore(nextState, villageCells);
  return nextState;
}
