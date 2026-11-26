import type { WorkspaceEventPayload } from '@shared/types/models';
import { useEffect, useRef } from 'react';
import { HAS_REALTIME_WS, NOTIFICATIONS_WS_URL } from '@/services/api/httpClient';

export function useUserNotifications(
  accessToken: string | null,
  enabled: boolean,
  onEvent: (event: WorkspaceEventPayload) => void,
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!HAS_REALTIME_WS || !enabled || !accessToken) return;

    let closed = false;
    let ws: WebSocket | null = null;
    let timer: number | null = null;

    function connect() {
      ws = new WebSocket(`${NOTIFICATIONS_WS_URL}?token=${encodeURIComponent(accessToken!)}`);
      ws.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(String(msg.data)) as
            | WorkspaceEventPayload
            | { type: 'notifications:ready' };
          if (parsed.type === 'notifications:ready') return;
          onEventRef.current(parsed);
        } catch {
          // ignore malformed messages
        }
      };
      ws.onclose = () => {
        if (!closed) {
          timer = window.setTimeout(connect, 1500);
        }
      };
    }

    connect();

    return () => {
      closed = true;
      if (timer !== null) window.clearTimeout(timer);
      ws?.close();
    };
  }, [accessToken, enabled]);
}

