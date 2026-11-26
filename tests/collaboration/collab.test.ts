import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import * as Y from 'yjs';
import { buildCollabDocName } from '../../shared/types/models.js';
import { createUniteServer, type UniteServerInstance } from '../../server/src/app.js';

// Provide Node WebSocket global for HocuspocusProvider in Vitest Node environment
(globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocket;

function waitForSynced(provider: HocuspocusProvider): Promise<void> {
  return new Promise((resolve, reject) => {
    if (provider.isSynced) {
      resolve();
      return;
    }
    const timer = setTimeout(() => reject(new Error('Timed out waiting for Yjs sync')), 5000);
    const onSynced = () => {
      clearTimeout(timer);
      provider.off('synced', onSynced);
      resolve();
    };
    const onAuthFailed = ({ reason }: { reason: string }) => {
      clearTimeout(timer);
      reject(new Error(`Authentication failed: ${reason}`));
    };
    provider.on('synced', onSynced);
    provider.on('authenticationFailed', onAuthFailed);
  });
}

function waitUntil(predicate: () => boolean, timeoutMs = 4000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (predicate()) {
      resolve();
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      if (predicate()) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(new Error('Timed out waiting for condition'));
      }
    }, 30);
  });
}

describe('Real-Time Yjs + Hocuspocus Collaboration & Authorization', () => {
  let server: UniteServerInstance;
  let port: number;
  let ownerToken: string;
  let editorToken: string;
  let viewerToken: string;
  let outsiderToken: string;
  let workspaceId: string;
  let fileId: string;

  beforeAll(async () => {
    server = await createUniteServer({
      NODE_ENV: 'test',
      STORAGE_DRIVER: 'pglite',
      AUTH_PROVIDER: 'local',
    });
    const started = await server.listen(0);
    port = started.port;

    const r1 = await request(server.app).post('/api/auth/register').send({
      email: 'collab-a@unite.dev',
      password: 'Password123!',
      displayName: 'User Alpha',
    });
    ownerToken = r1.body.accessToken;

    const r2 = await request(server.app).post('/api/auth/register').send({
      email: 'collab-b@unite.dev',
      password: 'Password123!',
      displayName: 'User Beta',
    });
    editorToken = r2.body.accessToken;

    const r3 = await request(server.app).post('/api/auth/register').send({
      email: 'collab-v@unite.dev',
      password: 'Password123!',
      displayName: 'User Viewer',
    });
    viewerToken = r3.body.accessToken;

    const r4 = await request(server.app).post('/api/auth/register').send({
      email: 'collab-out@unite.dev',
      password: 'Password123!',
      displayName: 'Outsider',
    });
    outsiderToken = r4.body.accessToken;

    const wsRes = await request(server.app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Realtime Lab', template: 'blank' });
    workspaceId = wsRes.body.workspace.id;
    fileId = wsRes.body.workspace.files[0].id;

    // Join editor
    await request(server.app)
      .post('/api/invitations/join')
      .set('Authorization', `Bearer ${editorToken}`)
      .send({ tokenOrCode: wsRes.body.initialInvitation.joinCode });

    // Create & join viewer
    const vInv = await request(server.app)
      .post(`/api/workspaces/${workspaceId}/invitations`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'VIEWER' });
    await request(server.app)
      .post('/api/invitations/join')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ tokenOrCode: vInv.body.invitation.joinCode });
  });

  afterAll(async () => {
    await server.close();
  });

  it('synchronizes concurrent edits, awareness cursors, and persistence across two clients', async () => {
    const docName = buildCollabDocName(workspaceId, fileId);
    const docA = new Y.Doc();
    const docB = new Y.Doc();

    const wsA = new HocuspocusProviderWebsocket({
      url: `ws://127.0.0.1:${port}/collab`,
      WebSocketPolyfill: WebSocket as unknown as typeof globalThis.WebSocket,
    });
    const wsB = new HocuspocusProviderWebsocket({
      url: `ws://127.0.0.1:${port}/collab`,
      WebSocketPolyfill: WebSocket as unknown as typeof globalThis.WebSocket,
    });

    const providerA = new HocuspocusProvider({
      websocketProvider: wsA,
      name: docName,
      document: docA,
      token: ownerToken,
    });
    const providerB = new HocuspocusProvider({
      websocketProvider: wsB,
      name: docName,
      document: docB,
      token: editorToken,
    });

    await Promise.all([waitForSynced(providerA), waitForSynced(providerB)]);

    const textA = docA.getText('monaco');
    const textB = docB.getText('monaco');
    expect(textA.toString()).toContain('New Unite Workspace');
    expect(textB.toString()).toBe(textA.toString());

    // Client A edits
    textA.insert(0, '// Header A\n');
    await waitUntil(() => textB.toString().startsWith('// Header A\n'));

    // Client B edits concurrently at the end
    textB.insert(textB.length, '\n// Footer B');
    await waitUntil(() => textA.toString().endsWith('\n// Footer B'));
    expect(textA.toString()).toBe(textB.toString());

    // Awareness cursor propagation
    providerA.setAwarenessField('user', { name: 'User Alpha', color: '#22D3EE' });
    await waitUntil(() => {
      const states = Array.from(providerB.awareness?.getStates().values() ?? []);
      return states.some((s) => (s as { user?: { name?: string } }).user?.name === 'User Alpha');
    });

    // Trigger immediate document store and verify reconnection loads persisted state
    const activeDoc = server.collabServer.hocuspocus.documents.get(docName);
    if (activeDoc) {
      await server.collabServer.hocuspocus.storeDocumentHooks(activeDoc, {
        clientsCount: 2,
        context: {},
        document: activeDoc,
        documentName: docName,
        instance: server.collabServer.hocuspocus,
        requestHeaders: {},
        requestParameters: new URLSearchParams(),
        socketId: 'test',
      }, true);
    }

    providerA.destroy();
    providerB.destroy();
    wsA.destroy();
    wsB.destroy();

    // Client C connects fresh and receives persisted CRDT content
    const docC = new Y.Doc();
    const wsC = new HocuspocusProviderWebsocket({
      url: `ws://127.0.0.1:${port}/collab`,
      WebSocketPolyfill: WebSocket as unknown as typeof globalThis.WebSocket,
    });
    const providerC = new HocuspocusProvider({
      websocketProvider: wsC,
      name: docName,
      document: docC,
      token: ownerToken,
    });
    await waitForSynced(providerC);
    expect(docC.getText('monaco').toString()).toContain('// Header A');
    expect(docC.getText('monaco').toString()).toContain('// Footer B');

    providerC.destroy();
    wsC.destroy();
  });

  it('rejects outsiders and prevents viewers from mutating shared documents', async () => {
    const docName = buildCollabDocName(workspaceId, fileId);
    const outsiderDoc = new Y.Doc();
    const wsOut = new HocuspocusProviderWebsocket({
      url: `ws://127.0.0.1:${port}/collab`,
      WebSocketPolyfill: WebSocket as unknown as typeof globalThis.WebSocket,
    });

    const outsiderProvider = new HocuspocusProvider({
      websocketProvider: wsOut,
      name: docName,
      document: outsiderDoc,
      token: outsiderToken,
    });

    await expect(waitForSynced(outsiderProvider)).rejects.toThrow();
    outsiderProvider.destroy();
    wsOut.destroy();

    // Viewer connects read-only: edits made locally on viewerDoc must NOT propagate to owner
    const ownerDoc = new Y.Doc();
    const viewerDoc = new Y.Doc();
    const wsOwner = new HocuspocusProviderWebsocket({
      url: `ws://127.0.0.1:${port}/collab`,
      WebSocketPolyfill: WebSocket as unknown as typeof globalThis.WebSocket,
    });
    const wsViewer = new HocuspocusProviderWebsocket({
      url: `ws://127.0.0.1:${port}/collab`,
      WebSocketPolyfill: WebSocket as unknown as typeof globalThis.WebSocket,
    });

    const ownerProv = new HocuspocusProvider({
      websocketProvider: wsOwner,
      name: docName,
      document: ownerDoc,
      token: ownerToken,
    });
    const viewerProv = new HocuspocusProvider({
      websocketProvider: wsViewer,
      name: docName,
      document: viewerDoc,
      token: viewerToken,
    });
    await Promise.all([waitForSynced(ownerProv), waitForSynced(viewerProv)]);

    const initialOwnerText = ownerDoc.getText('monaco').toString();
    viewerDoc.getText('monaco').insert(0, 'UNAUTHORIZED_VIEWER_EDIT');
    await new Promise((r) => setTimeout(r, 300));
    expect(ownerDoc.getText('monaco').toString()).toBe(initialOwnerText);

    ownerProv.destroy();
    viewerProv.destroy();
    wsOwner.destroy();
    wsViewer.destroy();
  });
});

