'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import MapCanvas, { getMapGeometry } from '@/components/MapCanvas';
import CellInfoPanel from '@/components/CellInfoPanel';
import RadioTranscript from '@/components/RadioTranscript';
import MenuScreen from '@/components/MenuScreen';
import DoctrineTerminal from '@/components/DoctrineTerminal';
import ScoreHUD from '@/components/ScoreHUD';
import ResultScreen from '@/components/ResultScreen';
import { GAME_PALETTE } from '@/lib/game-palette';
import { generateHeightmap, DEFAULT_PARAMS, type TerrainParams } from '@/lib/terrain';
import { buildSessionTerrainGrid, getCellTerrain } from '@/lib/cell-info';
import { MOCK_STATE } from '@/lib/mock-data';
import { advanceMockSessionState } from '@/lib/mock-fire-simulation';
import { useSessionWebSocket } from '@/lib/useSessionWebSocket';
import { useRadioAudio } from '@/lib/useRadioAudio';
import type { ScoreSummary, SessionState } from '@/lib/types';
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

function buildPendingLiveState(sessionId: string): SessionState {
  return {
    id: sessionId,
    grid_size: MOCK_STATE.grid_size,
    tick: 0,
    status: 'waiting',
    cells: [],
    units: [],
    villages: MOCK_STATE.villages,
    wind: MOCK_STATE.wind,
    score: {
      time_elapsed_seconds: 0,
      burned_cells: 0,
      suppressed_cells: 0,
      firebreak_cells: 0,
      village_damage: 0,
    },
    airSupportMissions: [],
    treatedCells: [],
  };
}

// ── Component ────────────────────────────────────────────────

export default function Home() {
  const [screen, setScreen] = useState<Screen>({ kind: 'menu' });
  const [showGrid, setShowGrid] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [radioMessages, setRadioMessages] = useState<TranscriptMessage[]>([]);
  const [terrainParams, setTerrainParams] = useState<TerrainParams>(
    () => ({ ...DEFAULT_PARAMS, seed: Date.now() }),
  );
  const [gameState, setGameState] = useState<SessionState>(MOCK_STATE);

  // Score tracking for HUD (updated from snapshots)
  const [scoreTick, setScoreTick] = useState(0);
  const [burnedCells, setBurnedCells] = useState(0);
  const [suppressedCells, setSuppressedCells] = useState(0);
  const [firebreakCells, setFirebreakCells] = useState(0);
  const [villageDamage, setVillageDamage] = useState(0);
  const loggedAirSupportMissionIdsRef = useRef<Set<string>>(new Set());
  const lastLiveConnectionRef = useRef(false);
  const startRequestSeqRef = useRef(0);
  const isStartingSessionRef = useRef(false);

  // voice_key lookup — radio.audio_ready doesn't include voice_key,
  // so we stash it when radio.message arrives
  const voiceKeyMap = useRef<Map<string, VoiceKey>>(new Map());

  // Ref for screen so WebSocket callback can read latest without re-binding
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // Generate heightmap (deterministic per seed — same params → same result as MapCanvas)
  const heightmap = useMemo(() => generateHeightmap(210, 210, terrainParams), [terrainParams]);
  const isMockSession = screen.kind === 'game' && screen.sessionId === 'mock-session';
  const mockTerrainGrid = useMemo(() => {
    if (!isMockSession) return null;
    const w = typeof window !== 'undefined' ? window.innerWidth : 1400;
    const h = typeof window !== 'undefined' ? window.innerHeight : 900;
    const { mapW, mapH } = getMapGeometry(w, h);
    return buildSessionTerrainGrid(gameState.grid_size, heightmap, mapW, mapH, terrainParams);
  }, [isMockSession, gameState.grid_size, heightmap, terrainParams]);

  // Audio engine
  const {
    isPlaying,
    currentSpeaker,
    currentVoiceKey,
    analyserNode,
    enqueueAudio,
    initAudio,
    stopAudio,
  } = useRadioAudio();
  const ignoreRadioForSessionIdRef = useRef<string | null>(null);

  // Format tick number as a time string (HH:MM:SS style based on tick)
  const tickToTime = useCallback((tick: number): string => {
    const h = Math.floor(tick / 3600);
    const m = Math.floor((tick % 3600) / 60);
    const s = tick % 60;
    return `${String(14 + h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, []);

  // ── Session creation ────────────────────────────────────────

  const createSession = useCallback(async (doctrine: string, nextTerrainParams: TerrainParams): Promise<string> => {
    try {
      const w = typeof window !== 'undefined' ? window.innerWidth : 1400;
      const h = typeof window !== 'undefined' ? window.innerHeight : 900;
      const { mapW, mapH } = getMapGeometry(w, h);
      const nextHeightmap = generateHeightmap(210, 210, nextTerrainParams);
      const terrainGrid = buildSessionTerrainGrid(
        MOCK_STATE.grid_size,
        nextHeightmap,
        mapW,
        mapH,
        nextTerrainParams,
      );
      const res = await fetch('/api/v1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctrine_text: doctrine,
          terrain_grid: terrainGrid,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.id as string;
    } catch {
      // Backend not available — fall back to mock
      console.warn(
        '[WATCHTOWER][MOCK] Session creation fell back to mock mode. Live backend agents are not controlling this run.',
      );
      return 'mock-session';
    }
  }, []);

  const startGame = useCallback(
    async (doctrine: string) => {
      if (isStartingSessionRef.current) {
        return;
      }
      isStartingSessionRef.current = true;
      const requestSeq = startRequestSeqRef.current + 1;
      startRequestSeqRef.current = requestSeq;
      stopAudio();
      initAudio();
      const nextTerrainParams = { ...DEFAULT_PARAMS, seed: Date.now() };
      setTerrainParams(nextTerrainParams);
      const sessionId = await createSession(doctrine, nextTerrainParams);
      if (startRequestSeqRef.current !== requestSeq) {
        isStartingSessionRef.current = false;
        return;
      }
      setGameState(sessionId === 'mock-session' ? MOCK_STATE : buildPendingLiveState(sessionId));
      setRadioMessages([]);
      voiceKeyMap.current.clear();
      ignoreRadioForSessionIdRef.current = null;
      setScoreTick(sessionId === 'mock-session' ? MOCK_STATE.tick : 0);
      setBurnedCells(sessionId === 'mock-session' ? MOCK_STATE.score.burned_cells : 0);
      setSuppressedCells(sessionId === 'mock-session' ? MOCK_STATE.score.suppressed_cells : 0);
      setFirebreakCells(sessionId === 'mock-session' ? MOCK_STATE.score.firebreak_cells : 0);
      setVillageDamage(sessionId === 'mock-session' ? MOCK_STATE.score.village_damage : 0);
      setSelectedCell(null);
      loggedAirSupportMissionIdsRef.current.clear();
      lastLiveConnectionRef.current = false;
      if (sessionId === 'mock-session') {
        console.warn(
          '[WATCHTOWER][MOCK] Running mock fallback session. Any air-support decisions you see are not live agent behavior.',
        );
      } else {
        console.info(
          `[WATCHTOWER][LIVE] Created backend session ${sessionId}. Waiting for live planner decisions.`,
        );
      }
      setScreen({ kind: 'game', sessionId });
      isStartingSessionRef.current = false;
    },
    [createSession, initAudio, stopAudio],
  );

  // ── WebSocket event routing ─────────────────────────────────

  const activeSessionId = screen.kind === 'game' && screen.sessionId !== 'mock-session'
    ? screen.sessionId
    : null;

  const { isConnected: isLiveSessionConnected, error: liveSessionError } = useSessionWebSocket(activeSessionId, {
    onMessage: useCallback(
      (envelope: BroadcastEnvelope) => {
        if (activeSessionId && envelope.event?.session_id && envelope.event.session_id !== activeSessionId) {
          return;
        }

        // Handle snapshot envelopes (full state dumps)
        if (envelope.kind === 'snapshot' && envelope.snapshot) {
          const snap = envelope.snapshot as unknown as SessionState;
          if (activeSessionId && snap.id !== activeSessionId) {
            return;
          }
          setGameState(snap);
          setScoreTick(snap.tick);
          setBurnedCells(snap.cells.filter((cell) => cell.state === 'burned').length);
          setSuppressedCells(snap.cells.filter((cell) => cell.state === 'suppressed').length);
          setFirebreakCells(snap.cells.filter((cell) => cell.state === 'firebreak').length);
          if (snap.score) setVillageDamage(snap.score.village_damage);

          // Check for game completion
          if (snap.status === 'won' || snap.status === 'lost') {
            const score: ScoreSummary = snap.score ?? {
              time_elapsed_seconds: snap.tick,
              burned_cells: snap.cells.filter((cell) => cell.state === 'burned').length,
              suppressed_cells: snap.cells.filter((cell) => cell.state === 'suppressed').length,
              firebreak_cells: snap.cells.filter((cell) => cell.state === 'firebreak').length,
              village_damage: 0,
            };
            if (activeSessionId) {
              ignoreRadioForSessionIdRef.current = activeSessionId;
            }
            stopAudio();
            setScreen({ kind: 'result', outcome: snap.status, score });
            return;
          }
        }

        // Handle event envelopes
        if (!envelope.event) return;
        const { type, payload } = envelope.event;

        // session.completed → result screen
        if (type === 'session.completed') {
          const p = payload as { outcome?: string; status?: string; score?: ScoreSummary };
          const outcomeValue = p.outcome ?? p.status;
          const outcome = (outcomeValue === 'won' || outcomeValue === 'lost') ? outcomeValue : 'lost';
          const score: ScoreSummary = p.score ?? {
            time_elapsed_seconds: 0,
            burned_cells: 0,
            suppressed_cells: 0,
            firebreak_cells: 0,
              village_damage: 0,
          };
          if (activeSessionId) {
            ignoreRadioForSessionIdRef.current = activeSessionId;
          }
          stopAudio();
          setScreen({ kind: 'result', outcome, score });
          return;
        }

        if (type === 'simulation.air_support_dispatched') {
          const p = payload as {
            mission_id?: string;
            payload_type?: string;
            target?: [number, number];
            unit_id?: string;
          };
          console.info('[WATCHTOWER][LIVE][AGENT] Air-support mission dispatched by the live planner.', {
            sessionId: activeSessionId,
            missionId: p.mission_id ?? 'unknown',
            payloadType: p.payload_type ?? 'unknown',
            target: p.target ?? null,
            sourceUnit: p.unit_id ?? 'tower',
          });
        }

        if (type === 'radio.message') {
          if (ignoreRadioForSessionIdRef.current === activeSessionId) {
            return;
          }
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
          if (ignoreRadioForSessionIdRef.current === activeSessionId) {
            return;
          }
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
      [activeSessionId, tickToTime, enqueueAudio, stopAudio],
    ),
  });

  useEffect(() => {
    if (!activeSessionId) {
      lastLiveConnectionRef.current = false;
      return;
    }
    if (isLiveSessionConnected && !lastLiveConnectionRef.current) {
      console.info(
        `[WATCHTOWER][LIVE] WebSocket connected for session ${activeSessionId}. Frontend is now receiving live backend planner output.`,
      );
    }
    lastLiveConnectionRef.current = isLiveSessionConnected;
  }, [activeSessionId, isLiveSessionConnected]);

  useEffect(() => {
    if (screen.kind === 'game') {
      return;
    }
    stopAudio();
  }, [screen.kind, stopAudio]);

  useEffect(() => {
    if (screen.kind !== 'game') {
      loggedAirSupportMissionIdsRef.current.clear();
      return;
    }

    for (const mission of gameState.airSupportMissions) {
      if (loggedAirSupportMissionIdsRef.current.has(mission.id)) {
        continue;
      }
      loggedAirSupportMissionIdsRef.current.add(mission.id);

      const missionSummary = {
        missionId: mission.id,
        aircraftModel: mission.aircraftModel,
        payloadType: mission.payloadType,
        dropStart: mission.dropStart,
        dropEnd: mission.dropEnd,
      };

      if (isMockSession) {
        console.warn(
          '[WATCHTOWER][MOCK] Mock fallback generated an air-support mission.',
          missionSummary,
        );
      } else {
        console.info(
          '[WATCHTOWER][LIVE] Air-support mission observed from backend snapshot.',
          missionSummary,
        );
      }
    }
  }, [screen.kind, isMockSession, gameState.airSupportMissions]);

  useEffect(() => {
    if (!isMockSession || !mockTerrainGrid) return;

    const intervalId = window.setInterval(() => {
      const next = advanceMockSessionState(gameStateRef.current, mockTerrainGrid, terrainParams.seed);
      gameStateRef.current = next;
      setGameState(next);
      setScoreTick(next.tick);
      setBurnedCells(next.score.burned_cells);
      setSuppressedCells(next.score.suppressed_cells);
      setFirebreakCells(next.score.firebreak_cells);
      setVillageDamage(next.score.village_damage);

      if (next.status === 'won' || next.status === 'lost') {
        window.clearInterval(intervalId);
        setScreen({ kind: 'result', outcome: next.status, score: next.score });
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isMockSession, mockTerrainGrid, terrainParams.seed]);

  // ── Terrain / cell lookups (game screen only) ───────────────

  const cellInfo = useMemo(() => {
    if (!selectedCell) return null;
    const w = typeof window !== 'undefined' ? window.innerWidth : 1400;
    const h = typeof window !== 'undefined' ? window.innerHeight : 900;
    const { mapW, mapH } = getMapGeometry(w, h);
    return getCellTerrain(
      selectedCell.row, selectedCell.col,
      gameState.grid_size, heightmap,
      mapW, mapH, terrainParams,
    );
  }, [selectedCell, gameState.grid_size, heightmap, terrainParams]);

  const selectedGameCell = useMemo(() => {
    if (!selectedCell) return undefined;
    const found = gameState.cells.find(c => c.row === selectedCell.row && c.col === selectedCell.col);
    if (found) return found;
    for (const v of gameState.villages) {
      if (
        selectedCell.row >= v.row && selectedCell.row < v.row + v.size &&
        selectedCell.col >= v.col && selectedCell.col < v.col + v.size
      ) {
        return { row: selectedCell.row, col: selectedCell.col, state: 'village' as const, fuel: 0.8, moisture: 0.2 };
      }
    }
    return undefined;
  }, [selectedCell, gameState.cells, gameState.villages]);

  const selectedUnit = useMemo(() => {
    if (!selectedCell) return undefined;
    return gameState.units.find(u => u.row === selectedCell.row && u.col === selectedCell.col);
  }, [selectedCell, gameState.units]);

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
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: GAME_PALETTE.pageGradient,
        color: GAME_PALETTE.textPrimary,
      }}
      onClick={initAudio}
    >
      {/* Map area */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          minWidth: 0,
          background: GAME_PALETTE.pageBase,
        }}
      >
        <MapCanvas
          params={terrainParams}
          gameState={gameState}
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
            background: showGrid ? 'rgba(0, 0, 0, 0.5)' : 'rgba(26, 21, 32, 0.72)',
            color: showGrid ? GAME_PALETTE.accentStrong : GAME_PALETTE.textPrimary,
            border: `1px solid ${GAME_PALETTE.panelOutline}`,
            borderRadius: 4,
            fontSize: 12,
            fontFamily: '"Courier New", Courier, monospace',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            backdropFilter: 'blur(10px)',
            cursor: 'pointer',
            zIndex: 10,
          }}
        >
          {showGrid ? 'Hide Grid' : 'Show Grid'}
        </button>

        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 6,
          }}
        >
          <div
            style={{
              padding: '6px 12px',
              background: isMockSession
                ? 'rgba(92, 61, 94, 0.82)'
                : isLiveSessionConnected
                  ? 'rgba(79, 155, 109, 0.22)'
                  : 'rgba(0, 0, 0, 0.5)',
              color: isMockSession
                ? GAME_PALETTE.accentStrong
                : isLiveSessionConnected
                  ? 'rgba(175, 240, 192, 0.95)'
                  : GAME_PALETTE.textPrimary,
              border: `1px solid ${GAME_PALETTE.panelOutline}`,
              borderRadius: 4,
              fontSize: 11,
              fontFamily: '"Courier New", Courier, monospace',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              backdropFilter: 'blur(10px)',
            }}
          >
            {isMockSession ? 'Mock Fallback' : isLiveSessionConnected ? 'Live Backend' : 'Connecting'}
          </div>
          {!isMockSession && liveSessionError ? (
            <div
              style={{
                maxWidth: 220,
                padding: '5px 9px',
                background: 'rgba(0, 0, 0, 0.5)',
                color: GAME_PALETTE.textSecondary,
                border: `1px solid ${GAME_PALETTE.panelOutline}`,
                borderRadius: 4,
                fontSize: 10,
                fontFamily: '"Courier New", Courier, monospace',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                textAlign: 'right',
              }}
            >
              {liveSessionError}
            </div>
          ) : null}
        </div>

      </div>

      {/* Right sidebar */}
      <div style={{
        width: '30vw',
        display: 'flex',
        flexDirection: 'column',
        background: GAME_PALETTE.panelBg,
        borderLeft: `1px solid ${GAME_PALETTE.panelDivider}`,
        boxShadow: '-24px 0 40px rgba(0, 0, 0, 0.35)',
        backdropFilter: 'blur(16px)',
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
