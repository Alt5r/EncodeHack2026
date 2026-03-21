/** Cell states matching the backend grid model */
export type CellState =
  | 'normal'
  | 'fire'
  | 'burned'
  | 'suppressed'
  | 'firebreak'
  | 'village'
  | 'water'
  | 'river'
  | 'lake';

/** A single cell in the 32×32 grid */
export interface Cell {
  row: number;
  col: number;
  state: CellState;
  fuel: number;        // 0–1, remaining fuel
  moisture: number;     // 0–1
}

export interface GridCoordinate {
  row: number;
  col: number;
}

/** Wind conditions */
export interface Wind {
  direction: string;   // compass: "N", "NE", "E", etc.
  speed_mph: number;
}

/** Village position and size */
export interface Village {
  row: number;
  col: number;
  size: number;        // side length in cells (e.g. 4 = 4×4)
}

/** Unit types (matches backend UnitType enum) */
export type UnitType = 'helicopter' | 'ground_crew';

export type AircraftModel =
  | 'P2V'
  | 'HC-130H'
  | 'BAe-146'
  | 'MD-87'
  | 'C-130Q'
  | 'RJ85'
  | 'C-130 H & J';

export type AirSupportPayload = 'water' | 'retardant';
export type AirSupportPhase = 'approach' | 'drop' | 'exit' | 'complete';

export interface TreatedCell {
  row: number;
  col: number;
  payloadType: AirSupportPayload;
  strength: number;
  remainingTicks: number;
}

export interface AirSupportMission {
  id: string;
  aircraftModel: AircraftModel;
  payloadType: AirSupportPayload;
  approachPoints: GridCoordinate[];
  dropStart: GridCoordinate;
  dropEnd: GridCoordinate;
  exitPoints: GridCoordinate[];
  phase: AirSupportPhase;
  progress: number;
}

/** A unit on the map */
export interface Unit {
  id: string;               // e.g. "heli-alpha", "ground-1"
  type: UnitType;
  label: string;            // display label: "Alpha", "Bravo", "Ground 1"
  row: number;
  col: number;
  target?: { row: number; col: number } | null;
  water_capacity?: number;  // helicopters only (max 6)
  water_remaining?: number; // helicopters only
  firebreak_strength?: number; // ground crew only
  status_text: string;      // "ready" | "moving" | "suppressing" | "laying firebreak" | "holding"
}

/** End-of-game score summary (matches backend ScoreSummary) */
export interface ScoreSummary {
  time_elapsed_seconds: number;
  burned_cells: number;
  suppressed_cells: number;
  firebreak_cells: number;
  village_damage: number;
}

/** Full game state from the backend */
export interface SessionState {
  grid_size: number;   // always 32
  tick: number;
  status: 'waiting' | 'running' | 'won' | 'lost' | 'ended';
  cells: Cell[];       // only non-normal cells (sparse)
  units: Unit[];
  villages: Village[];
  wind: Wind;
  score: ScoreSummary;
  airSupportMissions: AirSupportMission[];
  treatedCells: TreatedCell[];
}

// ── Raw backend types (what the WebSocket/API actually sends) ──

type Coordinate = [number, number]; // [x, y] tuple

export interface RawUnitState {
  id: string;
  unit_type: 'orchestrator' | 'helicopter' | 'ground_crew';
  label: string;
  position: Coordinate;
  target: Coordinate | null;
  water_capacity: number;
  water_remaining: number;
  firebreak_strength: number;
  status_text: string;
}

export interface RawVillageState {
  top_left: Coordinate;
  size: number;
  is_intact: boolean;
}

export interface RawTreatedCellState {
  coordinate: Coordinate;
  payload_type: AirSupportPayload;
  strength: number;
  remaining_ticks: number;
}

export interface RawAirSupportMission {
  id: string;
  aircraft_model: AircraftModel;
  payload_type: AirSupportPayload;
  approach_points: Coordinate[];
  drop_start: Coordinate;
  drop_end: Coordinate;
  exit_points: Coordinate[];
  phase: AirSupportPhase;
  progress: number;
}

export interface RawSessionState {
  id: string;
  status: 'pending' | 'running' | 'won' | 'lost' | 'terminated';
  tick: number;
  grid_size: number;
  wind: { direction: string; speed_mph: number };
  village: RawVillageState;
  units: RawUnitState[];
  fire_cells: Coordinate[];
  burned_cells?: Coordinate[];
  suppressed_cells?: Coordinate[];
  firebreak_cells?: Coordinate[];
  air_support_missions?: RawAirSupportMission[];
  treated_cells?: RawTreatedCellState[];
  score: ScoreSummary;
  winner: string | null;
  version: number;
}
