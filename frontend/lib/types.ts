export type Coordinate = [number, number];

export type UnitType = 'orchestrator' | 'helicopter' | 'ground_crew';

export type GameStatus = 'pending' | 'running' | 'won' | 'lost' | 'terminated';

export interface WindState {
  direction: string;
  speed_mph: number;
}

export interface VillageState {
  top_left: Coordinate;
  size: number;
  is_intact: boolean;
}

export interface UnitState {
  id: string;
  unit_type: UnitType;
  label: string;
  position: Coordinate;
  target: Coordinate | null;
  water_capacity: number;
  water_remaining: number;
  firebreak_strength: number;
  status_text: string;
}

export interface Doctrine {
  title: string;
  text: string;
}

export interface ScoreSummary {
  time_elapsed_seconds: number;
  burned_cells: number;
  suppressed_cells: number;
  firebreak_cells: number;
  village_damage: number;
}

/** Full session state — matches SessionState.model_dump() from the backend. */
export interface SessionSnapshot {
  id: string;
  created_at: string;
  status: GameStatus;
  tick: number;
  grid_size: number;
  doctrine: Doctrine;
  wind: WindState;
  village: VillageState;
  units: UnitState[];
  fire_cells: Coordinate[];
  burned_cells: Coordinate[];
  suppressed_cells: Coordinate[];
  firebreak_cells: Coordinate[];
  score: ScoreSummary;
  winner: string | null;
  version: number;
}

export interface RadioMessage {
  message_id: string;
  speaker: string;
  voice_key: string;
  text: string;
  created_at: string;
}

export interface SessionEvent {
  type: string;
  session_id: string;
  tick: number;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface BroadcastEnvelope {
  kind: 'event' | 'snapshot';
  event?: SessionEvent;
  snapshot?: SessionSnapshot;
}

export interface LeaderboardEntry {
  session_id: string;
  doctrine_title: string;
  doctrine_snippet: string;
  outcome: string;
  time_elapsed_seconds: number;
  burned_cells: number;
  suppressed_cells: number;
  firebreak_cells: number;
  village_damage: number;
}

/** Minimal session info returned by POST /sessions and GET /sessions/:id (REST, not WS snapshot). */
export interface SessionDetail {
  id: string;
  status: GameStatus;
  tick: number;
  doctrine_title: string;
  grid_size: number;
  winner: string | null;
  score: ScoreSummary;
  wind: WindState;
  village: VillageState;
  units: UnitState[];
  fire_cells: Coordinate[];
  firebreak_cells: Coordinate[];
}
