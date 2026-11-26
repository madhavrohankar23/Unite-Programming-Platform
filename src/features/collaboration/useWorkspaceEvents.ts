import type { WorkspaceEventPayload } from '@shared/types/models';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EVENTS_WS_URL, HAS_REALTIME_WS } from '@/services/api/httpClient';

export function useWorkspaceEvents(
  workspaceId: string,
  accessToken: string | null,
  onEvent: (event: WorkspaceEventPayload) => void,
) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!HAS_REALTIME_WS || !workspaceId || !accessToken) {
      setConnected(false);
      return;
    }

    let closedByCleanup = false;
    let reconnectTimer: number | null = null;
    let attempt = 0;

    function connect() {
      const url = `${EVENTS_WS_URL}?workspaceId=${encodeURIComponent(workspaceId)}&token=${encodeURIComponent(accessToken!)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
      };

      ws.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(String(msg.data)) as WorkspaceEventPayload | { type: 'connected' };
          if (parsed.type === 'connected') return;
          onEventRef.current(parsed);
        } catch {
          // Ignore invalid payloads
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        if (!closedByCleanup) {
          const delay = Math.min(8000, 600 * Math.pow(1.6, attempt));
          attempt += 1;
          reconnectTimer = window.setTimeout(connect, delay);
        }
      };
    }

    connect();

    return () => {
      closedByCleanup = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, [workspaceId, accessToken]);

  const sendChatMessage = useCallback((text: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'chat:send', text }));
      return true;
    }
    return false;
  }, []);

  return { connected, sendChatMessage };
}

