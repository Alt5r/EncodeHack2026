'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSession } from '../lib/api';

type Phase = 'landing' | 'terminal' | 'deploying';

const DEFAULT_DOCTRINE =
  'Prioritize protecting the village at all costs. ' +
  'Deploy helicopters to suppress the fire leading edge ahead of the wind. ' +
  'Ground crews establish firebreaks between fire and village — cut a defensive line 3 cells wide. ' +
  'Helicopter Alpha leads suppression; Bravo covers flanks. ' +
  'If fire reaches within 4 cells of the village, redirect all units to direct defense. ' +
  'Report status every action.';

const BOOT_LINES = [
  'Initialising orchestrator...',
  'Fetching wind conditions from OpenWeather...',
  'Spawning sub-agents... [2x HELICOPTER] [3x GROUND CREW]',
  'Fire ignition point set.',
  'Stand by.',
];

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export default function LandingPage() {
  const [phase, setPhase] = useState<Phase>('landing');
  const [doctrine, setDoctrine] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [bootLines, setBootLines] = useState<string[]>([]);
  const router = useRouter();

  async function deploy(doctrineText: string, doctrineTitle?: string) {
    setPhase('deploying');
    setBootLines([]);
    setError(null);
    for (let i = 0; i < BOOT_LINES.length; i++) {
      await sleep(320 + Math.random() * 280);
      setBootLines((prev) => [...prev, BOOT_LINES[i]]);
    }
    try {
      const session = await createSession(doctrineText, doctrineTitle);
      await sleep(500);
      router.push(`/play/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to server.');
      setPhase('terminal');
      setBootLines([]);
    }
  }

  function handleDeploy() {
    const text = doctrine.trim();
    if (!text) { setError('Doctrine cannot be empty.'); return; }
    setError(null);
    deploy(text, title.trim() || undefined);
  }

  if (phase === 'landing') {
    return <LandingScreen onDefault={() => deploy(DEFAULT_DOCTRINE, 'DEFAULT PROTOCOL')} onWrite={() => setPhase('terminal')} />;
  }

  return (
    <TerminalScreen
      phase={phase}
      doctrine={doctrine}
      title={title}
      error={error}
      bootLines={bootLines}
      onDoctrineChange={setDoctrine}
      onTitleChange={setTitle}
      onDeploy={handleDeploy}
      onBack={() => { setPhase('landing'); setError(null); }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Landing Screen                                                       */
/* ------------------------------------------------------------------ */

const EMBER_CONFIG = [
  { left: '8%',  delay: '0s',    dur: '4s',   size: 3 },
  { left: '15%', delay: '0.7s',  dur: '3.2s', size: 2 },
  { left: '22%', delay: '1.4s',  dur: '5s',   size: 4 },
  { left: '31%', delay: '0.3s',  dur: '3.8s', size: 2 },
  { left: '39%', delay: '2s',    dur: '4.2s', size: 3 },
  { left: '47%', delay: '0.9s',  dur: '3.5s', size: 5 },
  { left: '54%', delay: '1.8s',  dur: '4.8s', size: 2 },
  { left: '62%', delay: '0.4s',  dur: '3.9s', size: 3 },
  { left: '70%', delay: '1.2s',  dur: '4.4s', size: 4 },
  { left: '77%', delay: '2.5s',  dur: '3.3s', size: 2 },
  { left: '84%', delay: '0.6s',  dur: '5.2s', size: 3 },
  { left: '91%', delay: '1.6s',  dur: '4s',   size: 2 },
];

function LandingScreen({ onDefault, onWrite }: { onDefault: () => void; onWrite: () => void }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(to bottom, #100800 0%, #0d1a0e 50%, #061008 100%)' }}
    >
      {/* Ember particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {EMBER_CONFIG.map((e, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              bottom: '28%',
              left: e.left,
              width: `${e.size}px`,
              height: `${e.size}px`,
              borderRadius: '50%',
              background: '#ff6600',
              boxShadow: `0 0 ${e.size * 2}px #ff4400, 0 0 ${e.size}px #ffaa00`,
              animation: `ember-rise ${e.dur} ${e.delay} infinite ease-out`,
            }}
          />
        ))}
      </div>

      {/* Forest silhouette back layer */}
      <svg
        viewBox="0 0 1440 220"
        className="absolute bottom-0 left-0 right-0 w-full"
        preserveAspectRatio="none"
        style={{ height: '220px' }}
      >
        <path
          d="M0,220 L0,140 L30,100 L60,135 L90,90 L130,120 L165,75 L200,110 L235,68 L275,100 L310,72 L350,105 L385,60 L420,95 L460,55 L500,88 L535,50 L575,82 L610,48 L650,80 L690,52 L730,88 L768,55 L805,90 L845,58 L882,92 L920,62 L958,95 L995,65 L1035,100 L1072,70 L1110,105 L1148,72 L1185,108 L1222,78 L1260,112 L1300,80 L1340,115 L1380,88 L1440,120 L1440,220 Z"
          fill="#071510"
        />
        <path
          d="M0,220 L0,160 L45,125 L85,158 L125,130 L165,162 L210,135 L250,165 L290,138 L335,168 L375,140 L415,170 L460,142 L500,168 L540,140 L582,165 L622,142 L665,168 L705,140 L748,166 L790,140 L830,168 L875,142 L915,170 L958,142 L1000,168 L1042,140 L1085,166 L1128,140 L1170,165 L1212,140 L1255,165 L1298,140 L1340,162 L1390,142 L1440,158 L1440,220 Z"
          fill="#0a1e0d"
        />
        {/* Gradient fade at bottom */}
        <defs>
          <linearGradient id="fadeup" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0a1e0d" stopOpacity="0" />
            <stop offset="100%" stopColor="#061008" stopOpacity="1" />
          </linearGradient>
        </defs>
        <rect x="0" y="140" width="1440" height="80" fill="url(#fadeup)" />
      </svg>

      {/* Fire glow at horizon */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: '26%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '80px',
          background: 'radial-gradient(ellipse at center bottom, rgba(255,90,0,0.25) 0%, transparent 70%)',
          animation: 'pulse-glow 3s ease-in-out infinite',
        }}
      />

      {/* Watchtower icon */}
      <div
        className="mb-5 select-none animate-fade-in-slow"
        style={{ fontSize: '56px', filter: 'drop-shadow(0 0 24px rgba(255,160,50,0.5))' }}
      >
        &#x1F5FC;
      </div>

      {/* Title */}
      <h1
        className="glow-amber font-bold tracking-widest select-none animate-fade-in-slow"
        style={{
          color: '#ffb347',
          fontFamily: 'Courier New, monospace',
          fontSize: 'clamp(2.5rem, 8vw, 5.5rem)',
          letterSpacing: '0.35em',
          animationDelay: '0.2s',
        }}
      >
        WATCHTOWER
      </h1>

      {/* Divider line */}
      <div
        className="my-4 animate-fade-in-slow"
        style={{
          width: '320px',
          height: '1px',
          background: 'linear-gradient(to right, transparent, #6a4020, transparent)',
          animationDelay: '0.4s',
        }}
      />

      <p
        className="text-xs tracking-widest mb-12 animate-fade-in-slow"
        style={{ color: '#a07040', letterSpacing: '0.3em', animationDelay: '0.5s' }}
      >
        MULTI-AGENT WILDFIRE COMMAND SIMULATION
      </p>

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 animate-fade-in-slow" style={{ animationDelay: '0.7s' }}>
        <LandingButton onClick={onDefault} dim>
          DEPLOY DEFAULT AGENT
        </LandingButton>
        <LandingButton onClick={onWrite} primary>
          WRITE YOUR DOCTRINE
        </LandingButton>
      </div>

      <p
        className="mt-12 text-xs tracking-widest animate-fade-in-slow"
        style={{ color: '#4a3520', letterSpacing: '0.2em', animationDelay: '1s' }}
      >
        ONCE DEPLOYED, THE AGENT ACTS ALONE
      </p>
    </div>
  );
}

function LandingButton({
  onClick,
  children,
  primary,
  dim,
}: {
  onClick: () => void;
  children: React.ReactNode;
  primary?: boolean;
  dim?: boolean;
}) {
  const base = {
    fontFamily: 'Courier New, monospace',
    letterSpacing: '0.15em',
    padding: '12px 28px',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    background: 'transparent',
    display: 'inline-block',
  };

  const style = primary
    ? {
        ...base,
        border: '1px solid #ffb347',
        color: '#ffb347',
        boxShadow: '0 0 16px rgba(255,179,71,0.2), inset 0 0 16px rgba(255,179,71,0.03)',
      }
    : {
        ...base,
        border: '1px solid #3a2818',
        color: '#7a5838',
      };

  return (
    <button
      onClick={onClick}
      style={style as React.CSSProperties}
      onMouseEnter={(e) => {
        if (primary) {
          e.currentTarget.style.background = 'rgba(255,179,71,0.08)';
          e.currentTarget.style.boxShadow = '0 0 24px rgba(255,179,71,0.35), inset 0 0 20px rgba(255,179,71,0.05)';
        } else {
          e.currentTarget.style.borderColor = '#6a4828';
          e.currentTarget.style.color = '#c8a060';
        }
      }}
      onMouseLeave={(e) => {
        if (primary) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.boxShadow = '0 0 16px rgba(255,179,71,0.2), inset 0 0 16px rgba(255,179,71,0.03)';
        } else {
          e.currentTarget.style.borderColor = '#3a2818';
          e.currentTarget.style.color = '#7a5838';
        }
      }}
    >
      [ {children} ]
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Terminal Screen                                                      */
/* ------------------------------------------------------------------ */

interface TerminalProps {
  phase: Phase;
  doctrine: string;
  title: string;
  error: string | null;
  bootLines: string[];
  onDoctrineChange: (v: string) => void;
  onTitleChange: (v: string) => void;
  onDeploy: () => void;
  onBack: () => void;
}

function TerminalScreen({
  phase, doctrine, title, error, bootLines,
  onDoctrineChange, onTitleChange, onDeploy, onBack,
}: TerminalProps) {
  const deploying = phase === 'deploying';
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!deploying) textareaRef.current?.focus();
  }, [deploying]);

  return (
    <div
      className="min-h-screen flex items-start justify-center p-6 pt-10 scanlines"
      style={{ background: '#080600' }}
    >
      <div className="w-full max-w-2xl animate-fade-in">
        {/* Title bar */}
        <div
          className="flex items-center justify-between mb-8 pb-3"
          style={{ borderBottom: '1px solid #2a1a08' }}
        >
          <div className="flex items-center gap-3">
            <span style={{ color: '#ff4500', fontSize: '10px' }}>&#9632;</span>
            <span style={{ color: '#ff8c00', fontSize: '10px' }}>&#9632;</span>
            <span style={{ color: '#4caf50', fontSize: '10px' }}>&#9632;</span>
            <span className="text-xs tracking-widest ml-2" style={{ color: '#5a4020' }}>
              WATCHTOWER COMMAND SYSTEM v1.0
            </span>
          </div>
          {!deploying && (
            <button
              onClick={onBack}
              className="text-xs transition-opacity hover:opacity-80"
              style={{ color: '#5a4020', fontFamily: 'Courier New, monospace', letterSpacing: '0.1em' }}
            >
              &#x2190; BACK
            </button>
          )}
        </div>

        {!deploying ? (
          <>
            <div className="mb-6">
              <p className="text-xs mb-1" style={{ color: '#5a4020' }}>&#62; ENTER FIREFIGHTING DOCTRINE</p>
              <p className="text-xs mb-5 leading-relaxed" style={{ color: '#3a2810', lineHeight: '1.8' }}>
                Your strategy will be injected into the orchestrator agent.<br />
                The agent acts alone. You will not intervene.
              </p>
            </div>

            <div className="mb-5">
              <label className="block text-xs mb-2 tracking-widest" style={{ color: '#6a4820' }}>
                DOCTRINE
              </label>
              <textarea
                ref={textareaRef}
                value={doctrine}
                onChange={(e) => onDoctrineChange(e.target.value)}
                rows={9}
                placeholder="Protect the village. Deploy helicopters to the fire front. Ground crews establish firebreaks..."
                className="w-full p-4 text-sm resize-y outline-none"
                style={{
                  background: '#050400',
                  border: '1px solid #2a1a08',
                  color: '#ffb347',
                  fontFamily: 'Courier New, monospace',
                  lineHeight: '1.7',
                  borderRadius: 0,
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#6a4020')}
                onBlur={(e) => (e.target.style.borderColor = '#2a1a08')}
              />
            </div>

            <div className="mb-7">
              <label className="block text-xs mb-2 tracking-widest" style={{ color: '#6a4820' }}>
                DOCTRINE TITLE <span style={{ color: '#3a2810' }}>(optional)</span>
              </label>
              <input
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="e.g. SIERRA-PROTOCOL"
                className="w-full p-3 text-sm outline-none"
                style={{
                  background: '#050400',
                  border: '1px solid #2a1a08',
                  color: '#ffb347',
                  fontFamily: 'Courier New, monospace',
                  borderRadius: 0,
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#6a4020')}
                onBlur={(e) => (e.target.style.borderColor = '#2a1a08')}
                maxLength={100}
              />
            </div>

            {error && (
              <p className="text-xs mb-4 animate-fade-in" style={{ color: '#ff4500', letterSpacing: '0.05em' }}>
                &#62; ERROR: {error}
              </p>
            )}

            <button
              onClick={onDeploy}
              className="px-12 py-3 text-sm tracking-widest transition-all duration-200"
              style={{
                border: '1px solid #ffb347',
                color: '#ffb347',
                background: 'transparent',
                fontFamily: 'Courier New, monospace',
                letterSpacing: '0.25em',
                boxShadow: '0 0 20px rgba(255,179,71,0.15)',
                borderRadius: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,179,71,0.08)';
                e.currentTarget.style.boxShadow = '0 0 30px rgba(255,179,71,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.boxShadow = '0 0 20px rgba(255,179,71,0.15)';
              }}
            >
              &#62; DEPLOY
            </button>
          </>
        ) : (
          <BootSequence lines={bootLines} />
        )}
      </div>
    </div>
  );
}

function BootSequence({ lines }: { lines: string[] }) {
  return (
    <div className="space-y-3">
      <p className="text-xs mb-6" style={{ color: '#3a2810' }}>
        &#62; DEPLOYING AGENT...
      </p>
      {lines.map((line, i) => (
        <div key={i} className="animate-fade-in flex items-start gap-3" style={{ animationDelay: '0s' }}>
          <span style={{ color: '#4a8a4a', fontSize: '10px', marginTop: '2px' }}>&#9654;</span>
          <p className="text-sm" style={{ color: '#ffb347', fontFamily: 'Courier New, monospace', lineHeight: '1.5' }}>
            {line}
          </p>
        </div>
      ))}
      {lines.length < BOOT_LINES.length && (
        <div className="flex items-center gap-2 mt-4">
          <span
            className="animate-blink inline-block"
            style={{ width: '8px', height: '16px', background: '#ffb347' }}
          />
        </div>
      )}
      {lines.length === BOOT_LINES.length && (
        <p className="text-xs mt-6 animate-fade-in" style={{ color: '#4caf50' }}>
          &#62; Launching...
        </p>
      )}
    </div>
  );
}
