import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import { buildCollabDocName, type UserProfileDto } from '@shared/types/models';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';
import { getCollaboratorColor } from '@/lib/utilities/colors';
import { COLLAB_WS_URL } from '@/services/api/httpClient';

export type CollabConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export interface AwarenessPeer {
  clientId: number;
  userId: string;
  name: string;
  color: string;
  activeFileId?: string;
  activeFileName?: string;
  isSelf: boolean;
}

interface UseCollabDocumentOptions {
  workspaceId: string;
  fileId: string | null;
  fileName: string | null;
  user: UserProfileDto | null;
  accessToken: string | null;
}

export function useCollabDocument({
  workspaceId,
  fileId,
  fileName,
  user,
  accessToken,
}: UseCollabDocumentOptions) {
  const [status, setStatus] = useState<CollabConnectionStatus>('disconnected');
  const [isSynced, setIsSynced] = useState(false);
  const [peers, setPeers] = useState<AwarenessPeer[]>([]);
  const [docInstance, setDocInstance] = useState<Y.Doc | null>(null);
  const [providerInstance, setProviderInstance] = useState<HocuspocusProvider | null>(null);
  const styleElRef = useRef<HTMLStyleElement | null>(null);

  const docName = useMemo(
    () => (fileId ? buildCollabDocName(workspaceId, fileId) : null),
    [workspaceId, fileId],
  );

  useEffect(() => {
    if (!docName || !user || !accessToken) {
      setDocInstance(null);
      setProviderInstance(null);
      setIsSynced(false);
      setPeers([]);
      setStatus('disconnected');
      return;
    }

    setStatus('connecting');
    setIsSynced(false);

    const yDoc = new Y.Doc();
    const wsProvider = new HocuspocusProviderWebsocket({
      url: COLLAB_WS_URL,
      minDelay: 500,
      maxDelay: 8000,
    });

    const provider = new HocuspocusProvider({
      websocketProvider: wsProvider,
      name: docName,
      document: yDoc,
      token: accessToken,
      onStatus: ({ status: nextStatus }) => {
        if (nextStatus === 'connected') {
          setStatus('connected');
        } else if (nextStatus === 'connecting') {
          setStatus((prev) => (prev === 'connected' ? 'reconnecting' : 'connecting'));
        } else {
          setStatus('disconnected');
        }
      },
      onSynced: ({ state }) => {
        setIsSynced(state);
        if (state) setStatus('connected');
      },
      onAuthenticationFailed: () => {
        setStatus('error');
      },
      onDisconnect: () => {
        setIsSynced(false);
        setStatus('reconnecting');
      },
    });

    const userColor = getCollaboratorColor(user.id);
    provider.setAwarenessField('user', {
      id: user.id,
      name: user.displayName,
      color: userColor,
    });
    provider.setAwarenessField('file', {
      fileId,
      fileName,
    });

    const syncPeers = () => {
      const awareness = provider.awareness;
      if (!awareness) return;
      const localClientId = awareness.clientID;
      const list: AwarenessPeer[] = [];
      const cssRules: string[] = [];

      awareness.getStates().forEach((state, clientId) => {
        const u = state.user as { id?: string; name?: string; color?: string } | undefined;
        const f = state.file as { fileId?: string; fileName?: string } | undefined;
        if (!u?.name) return;

        const color = u.color ?? getCollaboratorColor(u.id ?? String(clientId));
        list.push({
          clientId,
          userId: u.id ?? String(clientId),
          name: u.name,
          color,
          activeFileId: f?.fileId,
          activeFileName: f?.fileName,
          isSelf: clientId === localClientId,
        });

        if (clientId !== localClientId) {
          const safeName = u.name.replace(/["\\]/g, '');
          cssRules.push(
            `.yRemoteSelection-${clientId} { background-color: ${color}33; }`,
            `.yRemoteSelectionHead-${clientId} { border-color: ${color}; }`,
            `.yRemoteSelectionHead-${clientId}::after { content: "${safeName}"; background-color: ${color}; }`,
          );
        }
      });

      setPeers(list);
      if (!styleElRef.current) {
        const el = document.createElement('style');
        el.dataset.uniteCursors = 'true';
        document.head.appendChild(el);
        styleElRef.current = el;
      }
      styleElRef.current.textContent = cssRules.join('\n');
    };

    provider.awareness?.on('change', syncPeers);
    syncPeers();

    setDocInstance(yDoc);
    setProviderInstance(provider);

    return () => {
      provider.awareness?.off('change', syncPeers);
      provider.destroy();
      wsProvider.destroy();
      yDoc.destroy();
      if (styleElRef.current) {
        styleElRef.current.textContent = '';
      }
    };
  }, [docName, fileId, fileName, user, accessToken]);

  return {
    yDoc: docInstance,
    provider: providerInstance,
    status,
    isSynced,
    peers,
  };
}

