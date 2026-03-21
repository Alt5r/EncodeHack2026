'use client';

import { useEffect, useRef, useState } from 'react';
import type { RadioMessage } from '../lib/types';

interface Props {
  messages: RadioMessage[];
}

const VOICE_CONFIG: Record<string, { color: string; dimColor: string; tag: string; label: string }> = {
  command:    { color: '#ffb347', dimColor: '#5a4020', tag: 'CMD', label: 'Command'     },
  helicopter: { color: '#4fc3f7', dimColor: '#1a4060', tag: 'HLI', label: 'Helicopter' },
  ground_crew:{ color: '#4caf50', dimColor: '#1a4020', tag: 'GND', label: 'Ground'     },
};

function voiceConfig(key: string) {
  return VOICE_CONFIG[key] ?? { color: '#8a9080', dimColor: '#2a3025', tag: '???', label: key };
}

const WAVEFORM_HEIGHTS = [3, 8, 5, 12, 4, 10, 7, 3, 11, 6, 4, 9, 5, 13, 4, 7, 3, 10, 6, 4];
const WAVEFORM_ANIMS   = ['wave-a', 'wave-b', 'wave-c', 'wave-d', 'wave-b', 'wave-a', 'wave-c', 'wave-d', 'wave-a', 'wave-c', 'wave-b', 'wave-d', 'wave-a', 'wave-b', 'wave-c', 'wave-a', 'wave-d', 'wave-b', 'wave-c', 'wave-a'];

export default function RadioPanel({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [waveActive, setWaveActive] = useState(false);
  const waveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Activate waveform on new message, deactivate after 3s
  useEffect(() => {
    if (messages.length === 0) return;
    setWaveActive(true);
    if (waveTimerRef.current) clearTimeout(waveTimerRef.current);
    waveTimerRef.current = setTimeout(() => setWaveActive(false), 3000);
  }, [messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div
      className="flex flex-col shrink-0"
      style={{
        width: '290px',
        background: '#050d06',
        borderLeft: '1px solid #162016',
        fontFamily: 'Courier New, monospace',
      }}
    >
      {/* Header */}
      <div
        className="px-3 py-2.5 shrink-0 flex items-center justify-between"
        style={{ borderBottom: '1px solid #162016', background: '#040b05' }}
      >
        <div className="flex items-center gap-2.5">
          <Waveform active={waveActive} />
          <span className="text-xs font-bold tracking-widest" style={{ color: '#4a6040', letterSpacing: '0.2em' }}>
            RADIO
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-1 h-1 rounded-full"
            style={{
              background: waveActive ? '#ff4500' : '#2a2a20',
              boxShadow: waveActive ? '0 0 4px #ff4500' : 'none',
              transition: 'all 0.3s',
            }}
          />
          <span className="text-xs" style={{ color: '#2a3a20', fontSize: '10px' }}>
            {waveActive ? 'LIVE' : 'STANDBY'}
          </span>
        </div>
      </div>

      {/* Message log */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 gap-2">
            <p className="text-xs tracking-widest" style={{ color: '#1e2e1a', letterSpacing: '0.2em', fontSize: '10px' }}>
              STANDING BY
            </p>
            <div className="flex gap-1">
              {[0.4, 0.7, 1.0].map((o, i) => (
                <div key={i} style={{ width: '2px', height: '8px', background: `rgba(50,80,40,${o})` }} />
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <RadioEntry key={msg.message_id ?? i} msg={msg} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <div
        className="px-3 py-2 shrink-0 flex items-center justify-between"
        style={{ borderTop: '1px solid #0e1a0e' }}
      >
        <span className="text-xs" style={{ color: '#1e2e1a', fontSize: '10px' }}>
          {messages.length} transmissions
        </span>
        <div className="flex gap-0.5">
          {[1,2,3,4,5].map((i) => (
            <div
              key={i}
              style={{
                width: '3px',
                height: `${i * 2 + 2}px`,
                background: i <= Math.min(Math.ceil(messages.length / 5), 5) ? '#2a4a28' : '#141e12',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Individual message entry                                             */
/* ------------------------------------------------------------------ */

function RadioEntry({ msg }: { msg: RadioMessage }) {
  const cfg = voiceConfig(msg.voice_key);
  const time = new Date(msg.created_at).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  return (
    <div
      className="animate-fade-in rounded-sm overflow-hidden"
      style={{ border: `1px solid ${cfg.dimColor}`, background: `${cfg.dimColor}30` }}
    >
      {/* Speaker row */}
      <div
        className="flex items-center justify-between px-2 py-1"
        style={{ borderBottom: `1px solid ${cfg.dimColor}`, background: `${cfg.dimColor}50` }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="text-xs font-bold"
            style={{
              color: cfg.color,
              fontSize: '9px',
              letterSpacing: '0.1em',
              padding: '1px 4px',
              border: `1px solid ${cfg.color}50`,
              background: `${cfg.color}15`,
            }}
          >
            {cfg.tag}
          </span>
          <span className="text-xs font-bold" style={{ color: cfg.color, fontSize: '11px' }}>
            {msg.speaker}
          </span>
        </div>
        <span style={{ color: cfg.dimColor, fontSize: '9px' }}>{time}</span>
      </div>

      {/* Message text */}
      <p
        className="px-2 py-1.5 text-xs leading-relaxed"
        style={{ color: '#b0c8a0', fontSize: '11px', lineHeight: '1.6' }}
      >
        {msg.text}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Animated waveform                                                    */
/* ------------------------------------------------------------------ */

function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-px" style={{ height: '20px' }}>
      {WAVEFORM_HEIGHTS.map((h, i) => (
        <div
          key={i}
          style={{
            width: '2px',
            height: active ? `${h}px` : '2px',
            background: active
              ? `rgba(74, 180, 74, ${0.4 + (i % 4) * 0.15})`
              : '#1a2a18',
            animation: active
              ? `${WAVEFORM_ANIMS[i]} ${0.6 + (i % 4) * 0.15}s ease-in-out infinite alternate ${i * 0.03}s`
              : 'none',
            transition: 'height 0.3s, background 0.3s',
          }}
        />
      ))}
    </div>
  );
}
