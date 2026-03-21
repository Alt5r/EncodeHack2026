'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { TranscriptMessage, VoiceKey } from '@/lib/radio-types';

const ROLE_COLORS: Record<string, string> = {
  command: '#8b5e3c',
  helicopter: '#4a7c59',
  ground: '#a0522d',
};

const ROLE_LABELS: Record<string, string> = {
  command: 'CMD',
  helicopter: 'AIR',
  ground: 'GND',
};

const BAR_COUNT = 24;
const IDLE_HEIGHT = 0.08;

interface RadioTranscriptProps {
  isOpen: boolean;
  messages: TranscriptMessage[];
  isPlaying: boolean;
  currentSpeaker: string | null;
  currentVoiceKey: VoiceKey | null;
  analyserNode: AnalyserNode | null;
}

export default function RadioTranscript({
  isOpen,
  messages,
  isPlaying,
  currentSpeaker,
  currentVoiceKey,
  analyserNode,
}: RadioTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Waveform animation driven by real AnalyserNode frequency data
  const animateWaveform = useCallback(() => {
    const container = barsRef.current;
    if (!container) return;

    const bars = container.children;
    if (!bars.length) return;

    if (analyserNode && isPlaying) {
      const freqData = new Uint8Array(analyserNode.frequencyBinCount);
      analyserNode.getByteFrequencyData(freqData);

      for (let i = 0; i < BAR_COUNT; i++) {
        // Map frequency bins to bar indices (skip bin 0 — DC offset)
        const binIndex = Math.min(i + 1, freqData.length - 1);
        const normalized = freqData[binIndex] / 255;
        const height = Math.max(IDLE_HEIGHT, normalized);
        (bars[i] as HTMLElement).style.height = `${height * 100}%`;
        (bars[i] as HTMLElement).style.background = '#8b5e3c';
      }
    } else {
      // Decay to idle baseline
      for (let i = 0; i < BAR_COUNT; i++) {
        const el = bars[i] as HTMLElement;
        const current = parseFloat(el.style.height) / 100 || IDLE_HEIGHT;
        const decayed = current + (IDLE_HEIGHT - current) * 0.15;
        el.style.height = `${decayed * 100}%`;
        el.style.background = 'rgba(120, 90, 60, 0.3)';
      }
    }

    rafRef.current = requestAnimationFrame(animateWaveform);
  }, [analyserNode, isPlaying]);

  useEffect(() => {
    if (!isOpen) return;
    rafRef.current = requestAnimationFrame(animateWaveform);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isOpen, animateWaveform]);

  // Status text
  const statusText = isPlaying && currentSpeaker
    ? currentSpeaker
    : 'STANDBY';

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(212, 197, 160, 0.95)',
        border: '2px solid rgba(120, 90, 60, 0.4)',
        borderTop: 'none',
        fontFamily: "'Courier New', monospace",
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid rgba(120, 90, 60, 0.3)',
          background: 'rgba(180, 160, 120, 0.4)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#4a3728', letterSpacing: '0.15em' }}>
            RADIO COMMS
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: isPlaying ? '#5a8a4a' : '#8a7a5a',
                boxShadow: isPlaying ? '0 0 8px #5a8a4a' : 'none',
                transition: 'all 0.3s',
              }}
            />
            <span style={{ fontSize: 10, color: '#6a5a4a', letterSpacing: '0.1em' }}>
              {statusText}
            </span>
            {isPlaying && currentVoiceKey && (
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 700,
                  color: '#d4c5a0',
                  background: ROLE_COLORS[currentVoiceKey] || '#8a7a5a',
                  padding: '1px 5px',
                  borderRadius: 2,
                  letterSpacing: '0.05em',
                }}
              >
                {ROLE_LABELS[currentVoiceKey] || currentVoiceKey.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Frequency */}
        <div
          style={{
            background: 'rgba(60, 50, 35, 0.85)',
            borderRadius: 2,
            padding: '6px 12px',
            marginBottom: 10,
          }}
        >
          <span style={{ fontSize: 15, color: '#c4a55a', letterSpacing: '0.2em', fontWeight: 700 }}>
            142.850 MHz
          </span>
        </div>

        {/* Waveform */}
        <div
          ref={barsRef}
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: 2,
            height: 28,
            background: 'rgba(60, 50, 35, 0.3)',
            borderRadius: 2,
            padding: '0 10px',
          }}
        >
          {Array.from({ length: BAR_COUNT }, (_, i) => (
            <div
              key={i}
              style={{
                width: 3,
                height: `${IDLE_HEIGHT * 100}%`,
                background: 'rgba(120, 90, 60, 0.3)',
                borderRadius: 1,
              }}
            />
          ))}
        </div>
      </div>

      {/* Transcript */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 18px',
        }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#9a8a6a', fontSize: 12, paddingTop: 60 }}>
            Awaiting transmission...
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: '#d4c5a0',
                  background: ROLE_COLORS[msg.voiceKey] || '#8a7a5a',
                  padding: '1px 6px',
                  borderRadius: 2,
                  letterSpacing: '0.05em',
                }}
              >
                {ROLE_LABELS[msg.voiceKey] || msg.voiceKey.toUpperCase()}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: ROLE_COLORS[msg.voiceKey] || '#8a7a5a' }}>
                {msg.speaker}
              </span>
              <span style={{ fontSize: 9, color: '#9a8a6a', marginLeft: 'auto' }}>
                {msg.time}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: '#3a2e20' }}>
              {msg.text}
            </p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '8px 18px',
          borderTop: '1px solid rgba(120, 90, 60, 0.3)',
          background: 'rgba(180, 160, 120, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 9,
          color: '#8a7a5a',
          letterSpacing: '0.1em',
          flexShrink: 0,
        }}
      >
        <span>WATCHTOWER CMD v1.0</span>
        <span>ENCRYPTED</span>
      </div>
    </div>
  );
}
