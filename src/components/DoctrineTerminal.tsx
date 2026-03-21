'use client';

import { useState, useEffect, useRef, useCallback, useId } from 'react';
import WatchtowerScene from '@/components/WatchtowerScene';

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
  const sessionCode = useId().replace(/:/g, '').slice(-6).toUpperCase();

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

  const getLineClassName = (line: string): string => {
    if (
      line.startsWith('Initializing') ||
      line.startsWith('Fetching') ||
      line.startsWith('Spawning') ||
      line.startsWith('Injecting') ||
      line.startsWith('Fire ignition') ||
      line.startsWith('DEPLOYING')
    ) {
      return 'whitespace-pre-wrap leading-relaxed text-green-500';
    }
    if (line.startsWith('WATCHTOWER')) {
      return 'whitespace-pre-wrap text-lg leading-relaxed text-amber-300';
    }
    if (line.startsWith('===')) {
      return 'whitespace-pre-wrap leading-relaxed text-amber-600';
    }
    if (line.startsWith('>')) {
      return 'whitespace-pre-wrap font-bold leading-relaxed text-amber-400';
    }
    return 'whitespace-pre-wrap leading-relaxed text-amber-500';
  };

  return (
    <div
      className="relative min-h-screen cursor-text overflow-hidden bg-black font-mono"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="absolute inset-0 z-0 scale-105 opacity-40 blur-md">
        <WatchtowerScene hideUI />
      </div>
      <div className="absolute inset-0 z-10 bg-black/75" />
      <div
        className="pointer-events-none fixed inset-0 z-50"
        style={{
          background:
            'repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.1) 0px, rgba(0, 0, 0, 0.1) 1px, transparent 1px, transparent 2px)',
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 z-40"
        style={{ boxShadow: 'inset 0 0 150px rgba(255, 176, 50, 0.03)' }}
      />

      <div className="relative z-20 p-4 md:p-8">
        <div
          ref={terminalRef}
          className="mx-auto h-[calc(100vh-4rem)] max-w-4xl overflow-y-auto"
          style={{
            scrollbarWidth: 'none',
            textShadow: '0 0 8px rgba(255, 176, 50, 0.5)',
          }}
        >
          <div className="mb-6 flex items-center gap-2 text-xs text-amber-500/60">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500/60" />
            <span>SECURE TERMINAL</span>
            <span className="ml-auto">SESSION: {sessionCode}</span>
          </div>

          {lines.map((line, i) => (
            <div key={i} className={getLineClassName(line)}>
              {line}
            </div>
          ))}

          {!isDeploying && (
            <div className="mt-0 flex text-amber-500">
              <span className="whitespace-pre-wrap">{currentInput}</span>
              <span
                className={`ml-0.5 inline-block h-5 w-2 bg-amber-500 ${
                  cursorVisible ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </div>
          )}

          <textarea
            ref={inputRef}
            value={currentInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="pointer-events-none absolute opacity-0"
            autoFocus
            disabled={isDeploying}
          />

          <div className="h-20" />
        </div>
      </div>

      <div
        className="fixed bottom-4 right-4 z-30 text-sm text-amber-500/40"
      >
        {isDeploying ? (
          <span className="animate-pulse text-green-500">DEPLOYING AGENT...</span>
        ) : doctrineLines.length > 0 ? (
          <span>{doctrineLines.length} lines | ENTER to add, ENTER twice to deploy</span>
        ) : (
          <span>Awaiting doctrine input...</span>
        )}
      </div>

      <button
        onClick={onBack}
        className="fixed bottom-4 left-4 z-30 text-sm text-amber-500/40 transition-colors hover:text-amber-500/80"
      >
        {'<'} ABORT
      </button>

      <style>{`
        ::-webkit-scrollbar {
          display: none;
        }
        @keyframes wtTermPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
