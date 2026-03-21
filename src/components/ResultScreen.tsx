'use client';

import { useEffect, useRef, useState } from 'react';
import type { ScoreSummary } from '@/lib/types';
import { drawPaperGrain } from '@/lib/parchment';

interface ResultScreenProps {
  outcome: 'won' | 'lost';
  score: ScoreSummary;
  onRetry: () => void;
}

export default function ResultScreen({ outcome, score, onRetry }: ResultScreenProps) {
  const [visible, setVisible] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Draw parchment background
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    drawPaperGrain(canvas);

    const onResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      drawPaperGrain(canvas);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const won = outcome === 'won';

  const stampColor = won ? '#2d5a1e' : '#8b1a1a';
  const headline = won ? 'MISSION COMPLETE' : 'VILLAGE LOST';

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const debriefRows: Array<{ label: string; value: string; color: string }> = [
    { label: 'TIME ELAPSED', value: formatTime(score.time_elapsed_seconds), color: '#4a3728' },
    { label: 'CELLS BURNED', value: String(score.burned_cells), color: score.burned_cells > 0 ? '#c03020' : '#5a8a4a' },
    { label: 'CELLS SUPPRESSED', value: String(score.suppressed_cells), color: '#4682b4' },
    { label: 'FIREBREAK CELLS', value: String(score.firebreak_cells), color: '#8b7355' },
    { label: 'VILLAGE DAMAGE', value: String(score.village_damage), color: score.village_damage > 0 ? '#c03020' : '#5a8a4a' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.8s ease-out',
      }}
    >
      {/* Parchment canvas background */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* Map border — 40px inset */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          left: 40,
          right: 40,
          bottom: 40,
          border: '3px solid #1a1a1a',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Rubber stamp headline */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          transform: 'rotate(-3deg)',
          animation: visible ? 'wtStampSlam 0.4s ease-out forwards' : undefined,
          marginBottom: 48,
        }}
      >
        <h1
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 42,
            fontWeight: 'bold',
            letterSpacing: '0.2em',
            color: stampColor,
            border: `4px solid ${stampColor}`,
            padding: '12px 32px',
            margin: 0,
            textTransform: 'uppercase',
          }}
        >
          {headline}
        </h1>
      </div>

      {/* Debrief card — legend-box style */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          backgroundColor: 'rgba(255, 255, 240, 0.88)',
          border: '2px solid #1a1a1a',
          padding: '28px 36px',
          minWidth: 300,
          fontFamily: '"Courier New", Courier, monospace',
        }}
      >
        <div
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 9,
            letterSpacing: '0.15em',
            color: '#6b5a42',
            marginBottom: 16,
            textTransform: 'uppercase',
          }}
        >
          Debrief
        </div>

        {debriefRows.map((row) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 32,
              fontSize: 13,
              lineHeight: 2,
            }}
          >
            <span style={{ color: '#6b5a42' }}>{row.label}</span>
            <span style={{ color: row.color, fontWeight: 600 }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* Retry button — map style */}
      <button
        onClick={onRetry}
        style={{
          position: 'relative',
          zIndex: 2,
          marginTop: 40,
          padding: '10px 36px',
          fontSize: 13,
          fontWeight: 400,
          letterSpacing: '0.2em',
          textTransform: 'uppercase' as const,
          color: '#4a3728',
          backgroundColor: 'transparent',
          border: '1px solid #1a1a1a',
          cursor: 'pointer',
          fontFamily: 'Georgia, serif',
          transition: 'all 0.3s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(26, 26, 26, 0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        Try Again
      </button>

      {/* Stamp slam animation */}
      <style>{`
        @keyframes wtStampSlam {
          0% { transform: rotate(-3deg) scale(2); opacity: 0; }
          60% { transform: rotate(-3deg) scale(0.95); opacity: 1; }
          80% { transform: rotate(-3deg) scale(1.02); }
          100% { transform: rotate(-3deg) scale(1); }
        }
      `}</style>
    </div>
  );
}
