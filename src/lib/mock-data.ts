import type { SessionState, Cell } from './types';

/**
 * Static mock SessionState for visual development.
 * Fire cluster in upper-left, burned trail behind it,
 * suppressed cells where heli dropped water, firebreak near village.
 */

const fireCells: Cell[] = [
  // Active fire cluster — upper-left quadrant
  { row: 4, col: 5, state: 'fire', fuel: 0.6, moisture: 0.1 },
  { row: 4, col: 6, state: 'fire', fuel: 0.5, moisture: 0.1 },
  { row: 5, col: 4, state: 'fire', fuel: 0.7, moisture: 0.1 },
  { row: 5, col: 5, state: 'fire', fuel: 0.4, moisture: 0.1 },
  { row: 5, col: 6, state: 'fire', fuel: 0.3, moisture: 0.1 },
  { row: 5, col: 7, state: 'fire', fuel: 0.8, moisture: 0.1 },
  { row: 6, col: 5, state: 'fire', fuel: 0.5, moisture: 0.1 },
  { row: 6, col: 6, state: 'fire', fuel: 0.6, moisture: 0.1 },
  { row: 6, col: 7, state: 'fire', fuel: 0.7, moisture: 0.1 },
  { row: 6, col: 8, state: 'fire', fuel: 0.9, moisture: 0.1 },
  { row: 7, col: 6, state: 'fire', fuel: 0.8, moisture: 0.1 },
  { row: 7, col: 7, state: 'fire', fuel: 0.5, moisture: 0.1 },
  { row: 7, col: 8, state: 'fire', fuel: 0.6, moisture: 0.1 },
  { row: 8, col: 7, state: 'fire', fuel: 0.9, moisture: 0.1 },
  { row: 8, col: 8, state: 'fire', fuel: 0.7, moisture: 0.1 },
];

const burnedCells: Cell[] = [
  // Burned area — behind the fire (upwind side)
  { row: 3, col: 4, state: 'burned', fuel: 0.0, moisture: 0.0 },
  { row: 3, col: 5, state: 'burned', fuel: 0.0, moisture: 0.0 },
  { row: 4, col: 3, state: 'burned', fuel: 0.0, moisture: 0.0 },
  { row: 4, col: 4, state: 'burned', fuel: 0.0, moisture: 0.0 },
  { row: 3, col: 3, state: 'burned', fuel: 0.05, moisture: 0.0 },
  { row: 2, col: 4, state: 'burned', fuel: 0.0, moisture: 0.0 },
  { row: 3, col: 6, state: 'burned', fuel: 0.0, moisture: 0.0 },
  { row: 2, col: 5, state: 'burned', fuel: 0.0, moisture: 0.0 },
];

const suppressedCells: Cell[] = [
  // Suppressed — where heli-alpha dropped water
  { row: 7, col: 9, state: 'suppressed', fuel: 0.3, moisture: 0.9 },
  { row: 7, col: 10, state: 'suppressed', fuel: 0.4, moisture: 0.8 },
  { row: 8, col: 9, state: 'suppressed', fuel: 0.2, moisture: 0.9 },
  { row: 8, col: 10, state: 'suppressed', fuel: 0.3, moisture: 0.85 },
];

const firebreakCells: Cell[] = [
  // Firebreak — dug by ground crew near village approach
  { row: 22, col: 23, state: 'firebreak', fuel: 0.0, moisture: 0.0 },
  { row: 23, col: 23, state: 'firebreak', fuel: 0.0, moisture: 0.0 },
  { row: 24, col: 23, state: 'firebreak', fuel: 0.0, moisture: 0.0 },
];

export const MOCK_STATE: SessionState = {
  grid_size: 64,
  tick: 12,
  status: 'running',
  cells: [...fireCells, ...burnedCells, ...suppressedCells, ...firebreakCells],
  units: [
    { id: 'heli-alpha', type: 'helicopter', label: 'Alpha', row: 9, col: 10, water_capacity: 6, water_remaining: 4, status_text: 'moving', target: { row: 6, col: 7 } },
    { id: 'heli-bravo', type: 'helicopter', label: 'Bravo', row: 12, col: 14, water_capacity: 6, water_remaining: 6, status_text: 'ready', target: null },
    { id: 'ground-1', type: 'ground_crew', label: 'Ground 1', row: 23, col: 22, firebreak_strength: 3, status_text: 'laying firebreak', target: { row: 22, col: 23 } },
    { id: 'ground-2', type: 'ground_crew', label: 'Ground 2', row: 24, col: 24, firebreak_strength: 3, status_text: 'ready', target: null },
  ],
  villages: [
    { row: 38, col: 40, size: 14 },  // the village — one large settlement to protect
  ],
  wind: { direction: 'NE', speed_mph: 12 },
  score: {
    time_elapsed_seconds: 0,
    burned_cells: 8,
    suppressed_cells: 4,
    firebreak_cells: 3,
    village_damage: 0,
  },
};
