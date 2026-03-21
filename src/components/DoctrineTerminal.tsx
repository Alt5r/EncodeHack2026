'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { drawPaperGrain } from '@/lib/parchment';

const INITIAL_LINES = [
  'WATCHTOWER COMMAND SYSTEM v1.0',
  '================================',
  '',
  '> ENTER FIREFIGHTING DOCTRINE',
  '',
  'Your strategy will be injected into the orchestrator agent.',
  'It will use this doctrine to make all in-game decisions.',
  'The agent acts alone. You will not intervene.',
  '',
  'Examples of effective doctrines:',
  '- Prioritize village protection above all else',
  '- Use helicopters for direct suppression, ground crews for firebreaks',
  '- Establish firebreaks at natural barriers (rivers, roads)',
  '- Attack fire from downwind to prevent spread acceleration',
  '',
  'Type your doctrine below. Press ENTER twice to deploy.',
  '',
  'DOCTRINE >',
];

const DEPLOY_SEQUENCE = [
  '',
  'Initializing orchestrator...',
  'Fetching wind conditions... [London, 12mph NE]',
  'Spawning sub-agents... [3x HELICOPTER] [4x GROUND CREW]',
  'Injecting doctrine into command layer...',
  'Fire ignition point set.',
  '',
  'Stand by.',
  '',
  'DEPLOYING...',
];

interface DoctrineTerminalProps {
  onDeploy: (text: string) => void;
  onBack: () => void;
}

export default function DoctrineTerminal({ onDeploy, onBack }: DoctrineTerminalProps) {
  const [lines, setLines] = useState<string[]>(INITIAL_LINES);
  const [currentInput, setCurrentInput] = useState('');
  const [doctrineLines, setDoctrineLines] = useState<string[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [deployIndex, setDeployIndex] = useState(0);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  // Blinking cursor
  useEffect(() => {
    const interval = setInterval(() => setCursorVisible((v) => !v), 530);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  // Focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Deploy sequence animation
  useEffect(() => {
    if (isDeploying && deployIndex < DEPLOY_SEQUENCE.length) {
      const timeout = setTimeout(() => {
        setLines((prev) => [...prev, DEPLOY_SEQUENCE[deployIndex]]);
        setDeployIndex((i) => i + 1);
      }, 300 + Math.random() * 400);
      return () => clearTimeout(timeout);
    } else if (isDeploying && deployIndex >= DEPLOY_SEQUENCE.length) {
      const timeout = setTimeout(() => {
        onDeploy(doctrineLines.join('\n'));
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [isDeploying, deployIndex, onDeploy, doctrineLines]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (isDeploying) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        if (currentInput.trim() === '') {
          if (doctrineLines.length > 0) {
            setIsDeploying(true);
            setLines((prev) => [...prev, '', '> DEPLOY']);
          }
        } else {
          setDoctrineLines((prev) => [...prev, currentInput]);
          setLines((prev) => [...prev, currentInput]);
          setCurrentInput('');
        }
      } else if (e.key === 'Backspace' && currentInput === '' && doctrineLines.length > 0) {
        e.preventDefault();
        const lastLine = doctrineLines[doctrineLines.length - 1];
        setDoctrineLines((prev) => prev.slice(0, -1));
        setLines((prev) => prev.slice(0, -1));
        setCurrentInput(lastLine);
      }
    },
    [currentInput, doctrineLines, isDeploying],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isDeploying) return;
    setCurrentInput(e.target.value.replace(/\n/g, ''));
  };

  const getLineColor = (line: string): string => {
    if (line.startsWith('DEPLOYING')) return '#a02818';
    if (
      line.startsWith('Initializing') ||
      line.startsWith('Fetching') ||
      line.startsWith('Spawning') ||
      line.startsWith('Injecting') ||
      line.startsWith('Fire ignition')
    ) {
      return '#3a2a1a';
    }
    if (line.startsWith('>')) return '#1a1a1a';
    if (line.startsWith('WATCHTOWER')) return '#1a1a1a';
    if (line.startsWith('===')) return '#5a4530';
    return '#2a1e14';
  };

  const getLineFontWeight = (line: string): number => {
    if (line.startsWith('>') || line.startsWith('WATCHTOWER')) return 700;
    return 400;
  };

  const getLineFontSize = (line: string): number => {
    if (line.startsWith('WATCHTOWER')) return 18;
    return 14;
  };

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        fontFamily: '"Courier New", Courier, monospace',
        cursor: 'text',
        overflow: 'hidden',
      }}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Parchment canvas background */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* Faint ruled lines */}
      <div
        style={{
          pointerEvents: 'none',
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          background:
            'repeating-linear-gradient(0deg, transparent 0px, transparent 21px, rgba(139, 115, 85, 0.1) 21px, rgba(139, 115, 85, 0.1) 22px)',
        }}
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
          zIndex: 2,
        }}
      />

      {/* Terminal container — inside the map border */}
      <div style={{ position: 'relative', zIndex: 20, padding: '56px 60px' }}>
        <div
          ref={terminalRef}
          style={{
            maxWidth: 896,
            margin: '0 auto',
            height: 'calc(100vh - 112px)',
            overflowY: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {/* Header */}
          <div
            style={{
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: '#3a2a1a',
              fontSize: 12,
              fontFamily: 'Georgia, serif',
              letterSpacing: '0.1em',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#3a2a1a',
                animation: 'wtTermPulse 2s ease-in-out infinite',
              }}
            />
            <span>FIELD ORDERS</span>
          </div>

          {/* Lines */}
          {lines.map((line, i) => (
            <div
              key={i}
              style={{
                color: getLineColor(line),
                fontWeight: getLineFontWeight(line),
                fontSize: getLineFontSize(line),
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                minHeight: '1.6em',
              }}
            >
              {line}
            </div>
          ))}

          {/* Current input line with cursor */}
          {!isDeploying && (
            <div style={{ display: 'flex', color: '#2a1e14', marginTop: 0 }}>
              <span style={{ whiteSpace: 'pre-wrap' }}>{currentInput}</span>
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 18,
                  backgroundColor: '#1a1a1a',
                  marginLeft: 2,
                  opacity: cursorVisible ? 1 : 0,
                }}
              />
            </div>
          )}

          {/* Hidden textarea */}
          <textarea
            ref={inputRef}
            value={currentInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
            autoFocus
            disabled={isDeploying}
          />

          <div style={{ height: 80 }} />
        </div>
      </div>

      {/* Status indicator */}
      <div
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          fontSize: 14,
          zIndex: 30,
          fontFamily: '"Courier New", Courier, monospace',
          color: isDeploying ? '#a02818' : '#5a4530',
          animation: isDeploying ? 'wtTermPulse 1s ease-in-out infinite' : undefined,
        }}
      >
        {isDeploying
          ? 'DEPLOYING AGENT...'
          : doctrineLines.length > 0
            ? `${doctrineLines.length} lines | ENTER to add, ENTER twice to deploy`
            : 'Awaiting doctrine input...'}
      </div>

      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          position: 'fixed',
          bottom: 16,
          left: 16,
          fontSize: 14,
          zIndex: 30,
          color: '#5a4530',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'Georgia, serif',
          transition: 'color 0.3s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#1a1a1a';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#5a4530';
        }}
      >
        {'<'} ABORT
      </button>

      <style>{`
        @keyframes wtTermPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
