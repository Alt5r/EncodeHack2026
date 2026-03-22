'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { BroadcastEnvelope } from './radio-types';
import type { RawSessionState } from './types';
import { adaptSessionState } from './adapt';

interface WebSocketHandlers {
  onMessage?: (envelope: BroadcastEnvelope) => void;
}

interface UseSessionWebSocketReturn {
  isConnected: boolean;
  error: string | null;
}

/**
 * Connects to the backend session WebSocket and routes parsed envelopes
 * to the provided handler. Reconnects with exponential backoff on disconnect.
 * Does nothing when sessionId is null (allows running without a backend).
 */
export function useSessionWebSocket(
  sessionId: string | null,
  handlers: WebSocketHandlers,
): UseSessionWebSocketReturn {
  const [connectedSessionId, setConnectedSessionId] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [errorSessionId, setErrorSessionId] = useState<string | null>(null);

  // Keep handlers in a ref so reconnect logic always calls the latest version
  const handlersRef = useRef(handlers);

  const reconnectAttempt = useRef(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const unmountedRef = useRef(false);
  const sessionIdRef = useRef<string | null>(sessionId);
  const connectRef = useRef<(sid: string) => void>(() => {});

  const connect = useCallback((sid: string) => {
    if (unmountedRef.current) return;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${protocol}://${window.location.host}/api/v1/sessions/${sid}/ws`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current || wsRef.current !== ws || sessionIdRef.current !== sid) {
        ws.close();
        return;
      }
      setConnectedSessionId(sid);
      setConnectionError(null);
      setErrorSessionId(null);
      reconnectAttempt.current = 0;
    };

    ws.onmessage = (evt) => {
      if (unmountedRef.current || wsRef.current !== ws || sessionIdRef.current !== sid) {
        return;
      }
      try {
        const envelope = JSON.parse(evt.data) as BroadcastEnvelope;

        if (envelope.event?.session_id && envelope.event.session_id !== sid) {
          return;
        }
        if (
          envelope.kind === 'snapshot'
          && envelope.snapshot
          && 'id' in envelope.snapshot
          && envelope.snapshot.id !== sid
        ) {
          return;
        }

        // Adapt raw backend snapshots into frontend SessionState shape
        if (envelope.kind === 'snapshot' && envelope.snapshot) {
          const adapted = adaptSessionState(envelope.snapshot as unknown as RawSessionState);
          envelope.snapshot = adapted as unknown as Record<string, unknown>;
        }

        handlersRef.current.onMessage?.(envelope);
      } catch {
        // Ignore unparseable frames
      }
    };

    ws.onerror = () => {
      if (wsRef.current !== ws || sessionIdRef.current !== sid) {
        return;
      }
      setConnectedSessionId((current) => (current === sid ? null : current));
      setConnectionError('WebSocket error');
      setErrorSessionId(sid);
    };

    ws.onclose = (event) => {
      if (unmountedRef.current || wsRef.current !== ws || sessionIdRef.current !== sid) return;
      setConnectedSessionId((current) => (current === sid ? null : current));
      if (event.code === 4404) {
        setConnectionError('Session ended');
        setErrorSessionId(sid);
        return;
      }

      // Exponential backoff: 1s → 2s → 4s → 8s max
      const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 8000);
      reconnectAttempt.current += 1;
      reconnectTimeoutRef.current = window.setTimeout(() => {
        if (sessionIdRef.current === sid) {
          connectRef.current(sid);
        }
      }, delay);
    };
  }, []);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    unmountedRef.current = false;
    sessionIdRef.current = sessionId;
    reconnectAttempt.current = 0;
    if (reconnectTimeoutRef.current !== null) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    wsRef.current?.close();
    wsRef.current = null;

    if (!sessionId) {
      return;
    }

    connect(sessionId);

    return () => {
      unmountedRef.current = true;
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [sessionId, connect]);

  return {
    isConnected: sessionId ? connectedSessionId === sessionId : false,
    error: sessionId && errorSessionId === sessionId ? connectionError : null,
  };
}
