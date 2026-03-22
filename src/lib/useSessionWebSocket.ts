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
  const [connectionState, setConnectionState] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Keep handlers in a ref so reconnect logic always calls the latest version
  const handlersRef = useRef(handlers);

  const reconnectAttempt = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const unmountedRef = useRef(false);
  const connectRef = useRef<(sid: string) => void>(() => {});

  const connect = useCallback((sid: string) => {
    if (unmountedRef.current) return;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${protocol}://${window.location.host}/api/v1/sessions/${sid}/ws`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) { ws.close(); return; }
      setConnectionState(true);
      setConnectionError(null);
      reconnectAttempt.current = 0;
    };

    ws.onmessage = (evt) => {
      try {
        const envelope = JSON.parse(evt.data) as BroadcastEnvelope;

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
      setConnectionError('WebSocket error');
    };

    ws.onclose = (event) => {
      if (unmountedRef.current) return;
      setConnectionState(false);
      if (event.code === 4404) {
        setConnectionError('Session ended');
        return;
      }

      // Exponential backoff: 1s → 2s → 4s → 8s max
      const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 8000);
      reconnectAttempt.current += 1;
      setTimeout(() => connectRef.current(sid), delay);
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

    if (!sessionId) {
      return;
    }

    connect(sessionId);

    return () => {
      unmountedRef.current = true;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [sessionId, connect]);

  return {
    isConnected: sessionId ? connectionState : false,
    error: sessionId ? connectionError : null,
  };
}
