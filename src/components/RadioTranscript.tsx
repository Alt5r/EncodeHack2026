'use client';

import { useEffect, useRef, useCallback } from 'react';
import { GAME_PALETTE } from '@/lib/game-palette';
import type { TranscriptMessage, VoiceKey } from '@/lib/radio-types';

const ROLE_COLORS: Record<string, string> = {
  command: GAME_PALETTE.accent,
  helicopter: GAME_PALETTE.waterHighlight,
  ground: GAME_PALETTE.groundHighlight,
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
  const chatterAnimationUntilRef = useRef(0);
  const chatterFrameRef = useRef(0);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Backup-style radio chatter pulse when a message arrives, even without TTS audio.
  useEffect(() => {
    if (messages.length === 0) return;
    chatterAnimationUntilRef.current = performance.now() + 3000;
  }, [messages.length]);

  // Waveform animation driven by real AnalyserNode frequency data
  const updateWaveform = useCallback(() => {
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
        (bars[i] as HTMLElement).style.background = GAME_PALETTE.accent;
      }
    } else if (performance.now() < chatterAnimationUntilRef.current) {
      const now = performance.now();
      if (now - chatterFrameRef.current > 100) {
        chatterFrameRef.current = now;
        for (let i = 0; i < BAR_COUNT; i++) {
          const el = bars[i] as HTMLElement;
          const jitter = 0.1 + Math.random() * 0.9;
          el.style.height = `${jitter * 100}%`;
          el.style.background = GAME_PALETTE.accent;
        }
      }
    } else {
      // Decay to idle baseline
      for (let i = 0; i < BAR_COUNT; i++) {
        const el = bars[i] as HTMLElement;
        const current = parseFloat(el.style.height) / 100 || IDLE_HEIGHT;
        const decayed = current + (IDLE_HEIGHT - current) * 0.15;
        el.style.height = `${decayed * 100}%`;
        el.style.background = GAME_PALETTE.panelDivider;
      }
    }

  }, [analyserNode, isPlaying]);

  useEffect(() => {
    if (!isOpen) return;
    const tick = () => {
      updateWaveform();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isOpen, updateWaveform]);

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
        background: GAME_PALETTE.panelBg,
        border: `1px solid ${GAME_PALETTE.panelOutline}`,
        borderTop: 'none',
        fontFamily: "'Courier New', monospace",
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 18px',
          borderBottom: `1px solid ${GAME_PALETTE.panelDivider}`,
          background: GAME_PALETTE.panelBgSecondary,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: GAME_PALETTE.accent, letterSpacing: '0.15em' }}>
            RADIO COMMS
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: isPlaying ? GAME_PALETTE.success : GAME_PALETTE.textMuted,
                boxShadow: isPlaying ? `0 0 8px ${GAME_PALETTE.success}` : 'none',
                transition: 'all 0.3s',
              }}
            />
            <span style={{ fontSize: 10, color: GAME_PALETTE.textMuted, letterSpacing: '0.1em' }}>
              {statusText}
            </span>
            {isPlaying && currentVoiceKey && (
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 700,
                  color: GAME_PALETTE.pageBase,
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
            background: GAME_PALETTE.panelBgTertiary,
            borderRadius: 2,
            padding: '6px 12px',
            marginBottom: 10,
          }}
        >
          <span style={{ fontSize: 15, color: GAME_PALETTE.accentStrong, letterSpacing: '0.2em', fontWeight: 700 }}>
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
            background: GAME_PALETTE.panelBgTertiary,
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
                background: GAME_PALETTE.panelDivider,
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
          <div style={{ textAlign: 'center', color: GAME_PALETTE.textMuted, fontSize: 12, paddingTop: 60 }}>
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
                  color: GAME_PALETTE.pageBase,
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
              <span style={{ fontSize: 9, color: GAME_PALETTE.textMuted, marginLeft: 'auto' }}>
                {msg.time}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: GAME_PALETTE.textPrimary }}>
              {msg.text}
            </p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '8px 18px',
          borderTop: `1px solid ${GAME_PALETTE.panelDivider}`,
          background: GAME_PALETTE.panelBgSecondary,
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 9,
          color: GAME_PALETTE.textMuted,
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
