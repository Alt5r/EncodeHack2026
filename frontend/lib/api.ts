import type { LeaderboardEntry, SessionDetail } from './types';

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000') + '/api/v1';

export async function createSession(
  doctrineText: string,
  doctrineTitle?: string,
): Promise<SessionDetail> {
  const res = await fetch(`${BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctrine_text: doctrineText,
      ...(doctrineTitle ? { doctrine_title: doctrineTitle } : {}),
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${BASE}/leaderboard`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function createWebSocket(sessionId: string): WebSocket {
  const wsBase = BASE.replace(/^https/, 'wss').replace(/^http/, 'ws');
  return new WebSocket(`${wsBase}/sessions/${sessionId}/ws`);
}
