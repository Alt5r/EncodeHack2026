'use client';

import { useEffect, useState } from 'react';
import { getLeaderboard } from '../lib/api';
import type { LeaderboardEntry } from '../lib/types';

interface Props {
  onClose: () => void;
}

const OUTCOME_COLOR: Record<string, string> = {
  won: '#ffb347',
  lost: '#ff4500',
  terminated: '#888',
};

export default function Leaderboard({ onClose }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLeaderboard()
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(5, 10, 6, 0.88)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="border p-6 max-w-2xl w-full mx-4 animate-fade-in max-h-[80vh] flex flex-col"
        style={{
          borderColor: '#3a5030',
          background: '#0a1208',
          fontFamily: 'Courier New, monospace',
          boxShadow: '0 0 40px rgba(255,179,71,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className="text-lg font-bold tracking-widest" style={{ color: '#ffb347' }}>
            LEADERBOARD
          </h2>
          <button
            onClick={onClose}
            className="text-xs opacity-50 hover:opacity-80 transition-opacity"
            style={{ color: '#e8d5b0' }}
          >
            [CLOSE]
          </button>
        </div>

        {/* Column headers */}
        {!loading && !error && entries.length > 0 && (
          <div
            className="grid text-xs mb-2 pb-2 border-b shrink-0"
            style={{
              gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
              borderColor: '#2a3020',
              color: '#6a8060',
              letterSpacing: '0.1em',
            }}
          >
            <span>DOCTRINE</span>
            <span className="text-center">OUTCOME</span>
            <span className="text-center">TIME</span>
            <span className="text-center">BURNED</span>
            <span className="text-center">SUPPRESSED</span>
          </div>
        )}

        {/* Entries */}
        <div className="overflow-y-auto flex-1">
          {loading && (
            <p className="text-xs text-center py-8 opacity-40" style={{ color: '#a0b890' }}>
              Loading...
            </p>
          )}
          {error && (
            <p className="text-xs text-center py-8" style={{ color: '#ff4500' }}>
              {error}
            </p>
          )}
          {!loading && !error && entries.length === 0 && (
            <p className="text-xs text-center py-8 opacity-40" style={{ color: '#a0b890' }}>
              No entries yet. Be the first.
            </p>
          )}
          {!loading &&
            !error &&
            entries.map((entry, i) => (
              <LeaderboardRow key={entry.session_id} entry={entry} rank={i + 1} />
            ))}
        </div>
      </div>
    </div>
  );
}

function LeaderboardRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const outcomeColor = OUTCOME_COLOR[entry.outcome] ?? '#888';
  return (
    <div
      className="grid text-xs py-2 border-b items-start"
      style={{
        gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
        borderColor: '#1a2018',
        color: '#a0b890',
      }}
    >
      <div>
        <span className="opacity-40 mr-2">#{rank}</span>
        <span style={{ color: '#e8d5b0' }}>{entry.doctrine_title}</span>
        <p className="opacity-40 mt-0.5 text-xs leading-relaxed" style={{ fontSize: '10px' }}>
          {entry.doctrine_snippet}
        </p>
      </div>
      <span className="text-center font-bold" style={{ color: outcomeColor }}>
        {entry.outcome.toUpperCase()}
      </span>
      <span className="text-center">{entry.time_elapsed_seconds}s</span>
      <span className="text-center">{entry.burned_cells}</span>
      <span className="text-center">{entry.suppressed_cells}</span>
    </div>
  );
}
