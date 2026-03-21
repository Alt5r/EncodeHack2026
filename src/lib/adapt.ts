import type { SessionState, Cell, Unit, RawSessionState } from './types';

/**
 * Converts a raw backend session snapshot into the frontend SessionState shape.
 *
 * Key mappings:
 * - Status:      pending → waiting, won|lost|terminated → ended
 * - Coordinates: backend [x, y] → frontend { row: y, col: x }
 * - Village:     singular with top_left → villages array with { row, col, size }
 * - Cells:       separate arrays merged into one Cell[] with default fuel/moisture
 * - Units:       orchestrator filtered out, unit_type → type, position → {row, col}
 */
export function adaptSessionState(raw: RawSessionState): SessionState {
  // ── Status mapping ──
  let status: SessionState['status'];
  switch (raw.status) {
    case 'pending':
      status = 'waiting';
      break;
    case 'running':
      status = 'running';
      break;
    case 'won':
      status = 'won';
      break;
    case 'lost':
      status = 'lost';
      break;
    case 'terminated':
      status = 'ended';
      break;
  }

  // ── Coordinate helper: [x, y] → { row: y, col: x } ──
  const toRowCol = (coord: [number, number]) => ({ row: coord[1], col: coord[0] });

  // ── Cells: merge all cell arrays into one sparse Cell[] ──
  const cells: Cell[] = [
    ...raw.fire_cells.map((c): Cell => ({
      ...toRowCol(c),
      state: 'fire',
      fuel: 0.8,
      moisture: 0.1,
    })),
    ...raw.burned_cells.map((c): Cell => ({
      ...toRowCol(c),
      state: 'burned',
      fuel: 0.0,
      moisture: 0.0,
    })),
    ...raw.suppressed_cells.map((c): Cell => ({
      ...toRowCol(c),
      state: 'suppressed',
      fuel: 0.3,
      moisture: 0.9,
    })),
    ...raw.firebreak_cells.map((c): Cell => ({
      ...toRowCol(c),
      state: 'firebreak',
      fuel: 0.0,
      moisture: 0.0,
    })),
  ];

  // ── Units: filter out orchestrator, map fields ──
  const units: Unit[] = raw.units
    .filter((u) => u.unit_type !== 'orchestrator')
    .map((u): Unit => ({
      id: u.id,
      type: u.unit_type as 'helicopter' | 'ground_crew',
      label: u.label,
      ...toRowCol(u.position),
      target: u.target ? toRowCol(u.target) : null,
      water_capacity: u.water_capacity,
      water_remaining: u.water_remaining,
      firebreak_strength: u.firebreak_strength,
      status_text: u.status_text,
    }));

  // ── Village: singular → array, top_left [x,y] → { row, col } ──
  const villages = [
    {
      ...toRowCol(raw.village.top_left),
      size: raw.village.size,
    },
  ];

  return {
    grid_size: raw.grid_size,
    tick: raw.tick,
    status,
    cells,
    units,
    villages,
    wind: raw.wind,
    score: raw.score,
  };
}
