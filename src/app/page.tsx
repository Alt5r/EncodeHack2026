'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import MapCanvas, { getMapGeometry } from '@/components/MapCanvas';
import CellInfoPanel from '@/components/CellInfoPanel';
import RadioTranscript from '@/components/RadioTranscript';
import MenuScreen from '@/components/MenuScreen';
import DoctrineTerminal from '@/components/DoctrineTerminal';
import ScoreHUD from '@/components/ScoreHUD';
import ResultScreen from '@/components/ResultScreen';
import { generateHeightmap, DEFAULT_PARAMS, type TerrainParams } from '@/lib/terrain';
import { getCellTerrain } from '@/lib/cell-info';
import { MOCK_STATE } from '@/lib/mock-data';
import { useSessionWebSocket } from '@/lib/useSessionWebSocket';
import { useRadioAudio } from '@/lib/useRadioAudio';
import type { ScoreSummary } from '@/lib/types';
import type {
  BroadcastEnvelope,
  TranscriptMessage,
  RadioMessagePayload,
  AudioReadyPayload,
  VoiceKey,
} from '@/lib/radio-types';

// ── State machine ────────────────────────────────────────────

type Screen =
  | { kind: 'menu' }
  | { kind: 'doctrine' }
  | { kind: 'game'; sessionId: string }
  | { kind: 'result'; outcome: 'won' | 'lost'; score: ScoreSummary };

const DEFAULT_DOCTRINE =
  'Prioritize village protection. Use helicopters for direct water suppression on the nearest fire cells. Deploy ground crews to build firebreaks between the fire front and the village. Fall back to defensive positions if the fire breaches the first line.';

// ── Component ────────────────────────────────────────────────

export default function Home() {
  const [screen, setScreen] = useState<Screen>({ kind: 'menu' });
  const [showGrid, setShowGrid] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [radioMessages, setRadioMessages] = useState<TranscriptMessage[]>([]);
  const [terrainParams, setTerrainParams] = useState<TerrainParams>(
    () => ({ ...DEFAULT_PARAMS, seed: Date.now() }),
  );

  // Score tracking for HUD (updated from snapshots)
  const [scoreTick, setScoreTick] = useState(0);
  const [burnedCells, setBurnedCells] = useState(0);
  const [suppressedCells, setSuppressedCells] = useState(0);
  const [firebreakCells, setFirebreakCells] = useState(0);
  const [villageDamage, setVillageDamage] = useState(0);

  // voice_key lookup — radio.audio_ready doesn't include voice_key,
  // so we stash it when radio.message arrives
  const voiceKeyMap = useRef<Map<string, VoiceKey>>(new Map());

  // Ref for screen so WebSocket callback can read latest without re-binding
  const screenRef = useRef(screen);
  screenRef.current = screen;

  // Generate heightmap (deterministic per seed — same params → same result as MapCanvas)
  const heightmap = useMemo(() => generateHeightmap(210, 210, terrainParams), [terrainParams]);

  // Audio engine
  const {
    isPlaying,
    currentSpeaker,
    currentVoiceKey,
    analyserNode,
    enqueueAudio,
    initAudio,
  } = useRadioAudio();

  // Format tick number as a time string (HH:MM:SS style based on tick)
  const tickToTime = useCallback((tick: number): string => {
    const h = Math.floor(tick / 3600);
    const m = Math.floor((tick % 3600) / 60);
    const s = tick % 60;
    return `${String(14 + h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, []);

  // ── Session creation ────────────────────────────────────────

  const createSession = useCallback(async (doctrine: string): Promise<string> => {
    try {
      const res = await fetch('/api/v1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctrine_text: doctrine }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.id as string;
    } catch {
      // Backend not available — fall back to mock
      return 'mock-session';
    }
  }, []);

  const startGame = useCallback(
    async (doctrine: string) => {
      const sessionId = await createSession(doctrine);
      setTerrainParams({ ...DEFAULT_PARAMS, seed: Date.now() });
      setRadioMessages([]);
      setScoreTick(0);
      setBurnedCells(0);
      setSuppressedCells(0);
      setFirebreakCells(0);
      setVillageDamage(0);
      setSelectedCell(null);
      setScreen({ kind: 'game', sessionId });
    },
    [createSession],
  );

  // ── WebSocket event routing ─────────────────────────────────

  const activeSessionId = screen.kind === 'game' ? screen.sessionId : null;

  useSessionWebSocket(activeSessionId, {
    onMessage: useCallback(
      (envelope: BroadcastEnvelope) => {
        // Handle snapshot envelopes (full state dumps)
        if (envelope.kind === 'snapshot' && envelope.snapshot) {
          const snap = envelope.snapshot;
          if (typeof snap.tick === 'number') setScoreTick(snap.tick);
          if (Array.isArray(snap.burned_cells)) setBurnedCells(snap.burned_cells.length);
          if (Array.isArray(snap.suppressed_cells)) setSuppressedCells(snap.suppressed_cells.length);
          if (Array.isArray(snap.firebreak_cells)) setFirebreakCells(snap.firebreak_cells.length);
          if (snap.score && typeof (snap.score as Record<string, unknown>).village_damage === 'number') {
            setVillageDamage((snap.score as Record<string, unknown>).village_damage as number);
          }

          // Check for game completion
          const status = snap.status as string | undefined;
          if (status === 'won' || status === 'lost') {
            const score: ScoreSummary = snap.score
              ? (snap.score as ScoreSummary)
              : {
                  time_elapsed_seconds: (snap.tick as number) ?? 0,
                  burned_cells: Array.isArray(snap.burned_cells) ? snap.burned_cells.length : 0,
                  suppressed_cells: Array.isArray(snap.suppressed_cells) ? snap.suppressed_cells.length : 0,
                  firebreak_cells: Array.isArray(snap.firebreak_cells) ? snap.firebreak_cells.length : 0,
                  village_damage: 0,
                };
            setScreen({ kind: 'result', outcome: status, score });
            return;
          }
        }

        // Handle event envelopes
        if (!envelope.event) return;
        const { type, payload } = envelope.event;

        // session.completed → result screen
        if (type === 'session.completed') {
          const p = payload as { outcome?: string; score?: ScoreSummary };
          const outcome = (p.outcome === 'won' || p.outcome === 'lost') ? p.outcome : 'lost';
          const score: ScoreSummary = p.score ?? {
            time_elapsed_seconds: 0,
            burned_cells: 0,
            suppressed_cells: 0,
            firebreak_cells: 0,
            village_damage: 0,
          };
          setScreen({ kind: 'result', outcome, score });
          return;
        }

        if (type === 'radio.message') {
          const p = payload as RadioMessagePayload;
          voiceKeyMap.current.set(p.message_id, p.voice_key);

          const msg: TranscriptMessage = {
            id: p.message_id,
            speaker: p.speaker,
            voiceKey: p.voice_key,
            text: p.text,
            time: tickToTime(p.tick),
            hasAudio: false,
          };
          setRadioMessages((prev) => [...prev, msg]);
        }

        if (type === 'radio.audio_ready') {
          const p = payload as AudioReadyPayload;
          const voiceKey = voiceKeyMap.current.get(p.message_id) ?? 'command';

          setRadioMessages((prev) =>
            prev.map((m) =>
              m.id === p.message_id ? { ...m, hasAudio: true } : m,
            ),
          );

          enqueueAudio({
            messageId: p.message_id,
            speaker: p.speaker,
            voiceKey,
            audioUrl: p.audio_url,
          });
        }
      },
      [tickToTime, enqueueAudio],
    ),
  });

  // ── Terrain / cell lookups (game screen only) ───────────────

  const cellInfo = useMemo(() => {
    if (!selectedCell) return null;
    const w = typeof window !== 'undefined' ? window.innerWidth : 1400;
    const h = typeof window !== 'undefined' ? window.innerHeight : 900;
    const { mapW, mapH } = getMapGeometry(w, h);
    return getCellTerrain(
      selectedCell.row, selectedCell.col,
      MOCK_STATE.grid_size, heightmap,
      mapW, mapH, terrainParams,
    );
  }, [selectedCell, heightmap, terrainParams]);

  const selectedGameCell = useMemo(() => {
    if (!selectedCell) return undefined;
    const found = MOCK_STATE.cells.find(c => c.row === selectedCell.row && c.col === selectedCell.col);
    if (found) return found;
    for (const v of MOCK_STATE.villages) {
      if (
        selectedCell.row >= v.row && selectedCell.row < v.row + v.size &&
        selectedCell.col >= v.col && selectedCell.col < v.col + v.size
      ) {
        return { row: selectedCell.row, col: selectedCell.col, state: 'village' as const, fuel: 0.8, moisture: 0.2 };
      }
    }
    return undefined;
  }, [selectedCell]);

  const selectedUnit = useMemo(() => {
    if (!selectedCell) return undefined;
    return MOCK_STATE.units.find(u => u.row === selectedCell.row && u.col === selectedCell.col);
  }, [selectedCell]);

  const handleCellSelect = useCallback((cell: { row: number; col: number } | null) => {
    setSelectedCell(cell);
  }, []);

  // ── Render ──────────────────────────────────────────────────

  if (screen.kind === 'menu') {
    return (
      <MenuScreen
        onDeployDefault={() => startGame(DEFAULT_DOCTRINE)}
        onWriteDoctrine={() => setScreen({ kind: 'doctrine' })}
      />
    );
  }

  if (screen.kind === 'doctrine') {
    return (
      <DoctrineTerminal
        onDeploy={(text) => startGame(text)}
        onBack={() => setScreen({ kind: 'menu' })}
      />
    );
  }

  if (screen.kind === 'result') {
    return (
      <ResultScreen
        outcome={screen.outcome}
        score={screen.score}
        onRetry={() => setScreen({ kind: 'menu' })}
      />
    );
  }

  // screen.kind === 'game'
  return (
    <div
      style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}
      onClick={initAudio}
    >
      {/* Map area */}
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        <MapCanvas
          params={terrainParams}
          gameState={MOCK_STATE}
          showGrid={showGrid}
          selectedCell={selectedCell}
          onCellSelect={handleCellSelect}
        />
        <button
          onClick={() => setShowGrid(g => !g)}
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            padding: '6px 12px',
            background: showGrid ? 'rgba(30, 30, 30, 0.85)' : 'rgba(255, 255, 240, 0.75)',
            color: showGrid ? '#fff' : '#1a1a1a',
            border: '1px solid #1a1a1a',
            borderRadius: 4,
            fontSize: 12,
            fontFamily: 'Georgia, serif',
            cursor: 'pointer',
            zIndex: 10,
          }}
        >
          {showGrid ? 'Hide Grid' : 'Show Grid'}
        </button>

      </div>

      {/* Right sidebar */}
      <div style={{
        width: '30vw',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
      }}>
        <ScoreHUD
          tick={scoreTick}
          burnedCells={burnedCells}
          suppressedCells={suppressedCells}
          firebreakCells={firebreakCells}
          villageDamage={villageDamage}
        />
        <CellInfoPanel
          row={selectedCell?.row}
          col={selectedCell?.col}
          terrain={cellInfo}
          cell={selectedGameCell}
          unit={selectedUnit}
        />
        <RadioTranscript
          isOpen={true}
          messages={radioMessages}
          isPlaying={isPlaying}
          currentSpeaker={currentSpeaker}
          currentVoiceKey={currentVoiceKey}
          analyserNode={analyserNode}
        />
      </div>
    </div>
  );
}
