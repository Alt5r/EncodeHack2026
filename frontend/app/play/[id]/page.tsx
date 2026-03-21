'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createWebSocket } from '../../../lib/api';
import type { BroadcastEnvelope, RadioMessage, SessionSnapshot } from '../../../lib/types';
import GameMap from '../../../components/GameMap';
import RadioPanel from '../../../components/RadioPanel';
import Leaderboard from '../../../components/Leaderboard';

export default function PlayPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [radioLog, setRadioLog] = useState<RadioMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  useEffect(() => {
    if (!id) return;
    const ws = createWebSocket(id);
    ws.onopen = () => { setConnected(true); setWsError(null); };
    ws.onmessage = (e: MessageEvent) => {
      try {
        const envelope: BroadcastEnvelope = JSON.parse(e.data);
        if (envelope.kind === 'snapshot' && envelope.snapshot) {
          setSnapshot(envelope.snapshot);
        } else if (envelope.kind === 'event' && envelope.event?.type === 'radio.message') {
          const msg = envelope.event.payload as unknown as RadioMessage;
          setRadioLog((prev) => [...prev.slice(-99), msg]);
        }
      } catch { /* ignore */ }
    };
    ws.onerror = () => { setWsError('Connection lost. The session may have ended.'); setConnected(false); };
    ws.onclose = () => setConnected(false);
    return () => ws.close();
  }, [id]);

  const status = snapshot?.status;
  const isTerminal = status === 'won' || status === 'lost' || status === 'terminated';

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#080e08' }}>
      <StatusBar snapshot={snapshot} connected={connected} onLeaderboard={() => setShowLeaderboard(true)} />

      <div className="flex flex-1 overflow-hidden">
        {/* Map area */}
        <div
          className="flex-1 flex items-center justify-center relative overflow-hidden"
          style={{ background: 'radial-gradient(ellipse at center, #0d1a0e 0%, #060e07 100%)' }}
        >
          {snapshot ? (
            <GameMap snapshot={snapshot} />
          ) : (
            <WaitingScreen error={wsError} />
          )}
        </div>

        <RadioPanel messages={radioLog} />
      </div>

      {isTerminal && snapshot && (
        <EndOverlay
          snapshot={snapshot}
          onReplay={() => router.push('/')}
          onLeaderboard={() => setShowLeaderboard(true)}
        />
      )}

      {showLeaderboard && <Leaderboard onClose={() => setShowLeaderboard(false)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Status Bar                                                           */
/* ------------------------------------------------------------------ */

function StatusBar({
  snapshot,
  connected,
  onLeaderboard,
}: {
  snapshot: SessionSnapshot | null;
  connected: boolean;
  onLeaderboard: () => void;
}) {
  const status = snapshot?.status ?? 'pending';
  const statusMeta: Record<string, { color: string; label: string }> = {
    pending:    { color: '#6a8060', label: 'PENDING'    },
    running:    { color: '#4caf50', label: 'RUNNING'    },
    won:        { color: '#ffb347', label: 'CONTAINED'  },
    lost:       { color: '#ff4500', label: 'LOST'       },
    terminated: { color: '#888',    label: 'TERMINATED' },
  };
  const { color, label } = statusMeta[status] ?? statusMeta.pending;

  return (
    <div
      className="flex items-center justify-between px-4 shrink-0"
      style={{
        height: '42px',
        background: '#050a05',
        borderBottom: '1px solid #162016',
        fontFamily: 'Courier New, monospace',
      }}
    >
      {/* Left */}
      <div className="flex items-center gap-4">
        <span className="font-bold tracking-widest text-xs" style={{ color: '#ffb347', letterSpacing: '0.25em' }}>
          WATCHTOWER
        </span>

        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: color, boxShadow: `0 0 6px ${color}` }}
          />
          <span className="text-xs tracking-wider" style={{ color }}>
            {label}
          </span>
        </div>

        {snapshot && (
          <>
            <span className="text-xs" style={{ color: '#3a5030' }}>|</span>
            <span className="text-xs" style={{ color: '#4a6040' }}>
              TICK <span style={{ color: '#7a9060' }}>{snapshot.tick}</span>
            </span>
            <span className="text-xs" style={{ color: '#3a5030' }}>|</span>
            <span className="text-xs" style={{ color: '#4a6040' }}>
              WIND&nbsp;
              <span style={{ color: '#7a9060' }}>
                {snapshot.wind.speed_mph.toFixed(0)} mph {snapshot.wind.direction}
              </span>
            </span>
            <span className="text-xs" style={{ color: '#3a5030' }}>|</span>
            <span className="text-xs" style={{ color: '#4a6040' }}>
              FIRE&nbsp;
              <span style={{ color: snapshot.fire_cells.length > 0 ? '#ff6030' : '#4caf50' }}>
                {snapshot.fire_cells.length} cells
              </span>
            </span>
          </>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-4">
        {snapshot && (
          <span className="text-xs max-w-[180px] truncate" style={{ color: '#4a6040' }}>
            {snapshot.doctrine.title}
          </span>
        )}
        <button
          onClick={onLeaderboard}
          className="text-xs tracking-widest transition-all duration-150 hover:opacity-80"
          style={{ color: '#7a6030', letterSpacing: '0.1em', fontFamily: 'Courier New, monospace' }}
        >
          [SCORES]
        </button>
        {/* Connection dot */}
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{
              background: connected ? '#4caf50' : '#3a3030',
              boxShadow: connected ? '0 0 5px #4caf50' : 'none',
              transition: 'all 0.3s',
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Waiting screen                                                       */
/* ------------------------------------------------------------------ */

function WaitingScreen({ error }: { error: string | null }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3"
      style={{ fontFamily: 'Courier New, monospace' }}
    >
      {error ? (
        <p className="text-xs animate-fade-in" style={{ color: '#ff4500' }}>{error}</p>
      ) : (
        <>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="inline-block w-1.5 h-1.5 rounded-full animate-blink"
                style={{ background: '#4caf50', animationDelay: `${i * 0.3}s` }}
              />
            ))}
          </div>
          <p className="text-xs tracking-widest" style={{ color: '#3a5030', letterSpacing: '0.2em' }}>
            CONNECTING
          </p>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* End Overlay                                                          */
/* ------------------------------------------------------------------ */

function EndOverlay({
  snapshot,
  onReplay,
  onLeaderboard,
}: {
  snapshot: SessionSnapshot;
  onReplay: () => void;
  onLeaderboard: () => void;
}) {
  const won = snapshot.status === 'won';
  const accentColor = won ? '#ffb347' : '#ff4500';
  const bgGlow = won ? 'rgba(255,179,71,0.12)' : 'rgba(255,69,0,0.12)';

  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(3, 6, 3, 0.92)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-sm mx-4 animate-fade-in"
        style={{
          border: `1px solid ${accentColor}40`,
          background: '#070d07',
          boxShadow: `0 0 60px ${bgGlow}, 0 0 120px ${bgGlow}`,
          fontFamily: 'Courier New, monospace',
        }}
      >
        {/* Header band */}
        <div
          className="px-6 py-4"
          style={{ borderBottom: `1px solid ${accentColor}25`, background: `${accentColor}08` }}
        >
          <p className="text-xs tracking-widest mb-1" style={{ color: `${accentColor}80` }}>
            {won ? 'MISSION COMPLETE' : 'MISSION FAILED'}
          </p>
          <h2
            className="text-xl font-bold tracking-widest"
            style={{ color: accentColor, letterSpacing: '0.2em' }}
          >
            {won ? 'FIRE CONTAINED' : 'VILLAGE LOST'}
          </h2>
        </div>

        {/* Radio quote */}
        <div className="px-6 py-4" style={{ borderBottom: `1px solid #162016` }}>
          <p className="text-xs leading-relaxed" style={{ color: '#4a6040', fontStyle: 'italic' }}>
            {won
              ? '"All units, stand down. Village is secure. Fire contained. Good work."'
              : '"It\'s at the perimeter — we can\'t hold it. All units fall back."'}
          </p>
        </div>

        {/* Score */}
        <div className="px-6 py-4" style={{ borderBottom: `1px solid #162016` }}>
          {[
            ['TIME ELAPSED',  `${snapshot.score.time_elapsed_seconds}s`],
            ['CELLS BURNED',  String(snapshot.score.burned_cells)],
            ['SUPPRESSED',    String(snapshot.score.suppressed_cells)],
            ['FIREBREAKS',    String(snapshot.score.firebreak_cells)],
            ['VILLAGE DAMAGE', `${snapshot.score.village_damage} cells`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between items-center py-1">
              <span className="text-xs" style={{ color: '#3a5030' }}>{k}</span>
              <span
                className="text-xs font-bold"
                style={{
                  color: k === 'VILLAGE DAMAGE'
                    ? snapshot.score.village_damage > 0 ? '#ff4500' : '#4caf50'
                    : '#8aaa70',
                }}
              >
                {v}
              </span>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="flex">
          <EndButton onClick={onReplay} color="#4a6040">
            REDEPLOY
          </EndButton>
          <EndButton onClick={onLeaderboard} color={accentColor} primary>
            LEADERBOARD
          </EndButton>
        </div>
      </div>
    </div>
  );
}

function EndButton({
  onClick,
  children,
  color,
  primary,
}: {
  onClick: () => void;
  children: React.ReactNode;
  color: string;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 py-3 text-xs tracking-widest transition-all duration-200"
      style={{
        borderTop: `1px solid ${color}30`,
        borderRight: primary ? 'none' : `1px solid ${color}20`,
        color,
        background: 'transparent',
        fontFamily: 'Courier New, monospace',
        letterSpacing: '0.15em',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = `${color}10`)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      [ {children} ]
    </button>
  );
}
