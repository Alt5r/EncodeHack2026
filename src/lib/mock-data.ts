import type { SessionState } from './types';

/**
 * Empty initial state — used as the default before any backend snapshot arrives.
 * All cells come from the live backend; nothing is mocked.
 */

export const MOCK_STATE: SessionState = {
  grid_size: 64,
  tick: 0,
  status: 'running',
  cells: [],
  units: [],
  villages: [
    { row: 38, col: 40, size: 14 },  // the village — one large settlement to protect
  ],
  wind: { direction: 'NE', speed_mph: 12 },
  score: {
    time_elapsed_seconds: 0,
    burned_cells: 0,
    suppressed_cells: 0,
    firebreak_cells: 0,
    village_damage: 0,
  },
};
