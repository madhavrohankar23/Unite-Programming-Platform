import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import * as Y from 'yjs';
import { buildCollabDocName } from '../../shared/types/models.js';
import { createUniteServer } from '../../server/src/app.js';

(globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocket;

function waitForSynced(provider: HocuspocusProvider): Promise<void> {
  return new Promise((resolve, reject) => {
    if (provider.isSynced) {
      resolve();
      return;
    }
    const timer = setTimeout(() => reject(new Error('Sync timeout')), 5000);
    provider.on('synced', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

describe('Persistence Across Server Restarts', () => {
  const tempDataDir = path.join(os.tmpdir(), `unite-persist-${Date.now()}`);

  afterAll(() => {
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  });

  it('persists workspace metadata, files, and Yjs CRDT state across full server restart', async () => {
    // --- Boot Instance 1 ---
    const s1 = await createUniteServer({
      NODE_ENV: 'development',
      STORAGE_DRIVER: 'pglite',
      PGLITE_DATA_DIR: tempDataDir,
      AUTH_PROVIDER: 'local',
    });
    const { port: port1 } = await s1.listen(0);

    const reg = await request(s1.app).post('/api/auth/register').send({
      email: 'persist@unite.dev',
      password: 'Password123!',
      displayName: 'Persist User',
    });
    expect(reg.status).toBe(201);
    const token1 = reg.body.accessToken as string;

    const wsRes = await request(s1.app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${token1}`)
      .send({ name: 'Persistent Project', template: 'blank' });
    expect(wsRes.status).toBe(201);
    const workspaceId = wsRes.body.workspace.id as string;
    const fileId = wsRes.body.workspace.files[0].id as string;
    const docName = buildCollabDocName(workspaceId, fileId);

    const doc1 = new Y.Doc();
    const ws1 = new HocuspocusProviderWebsocket({
      url: `ws://127.0.0.1:${port1}/collab`,
      WebSocketPolyfill: WebSocket as unknown as typeof globalThis.WebSocket,
    });
    const prov1 = new HocuspocusProvider({
      websocketProvider: ws1,
      name: docName,
      document: doc1,
      token: token1,
    });
    await waitForSynced(prov1);
    doc1.getText('monaco').insert(0, '// Persisted across restart\n');

    await new Promise((r) => setTimeout(r, 700));
    const activeDoc = s1.collabServer.hocuspocus.documents.get(docName);
    if (activeDoc) {
      await s1.collabServer.hocuspocus.storeDocumentHooks(
        activeDoc,
        {
          clientsCount: 1,
          context: {},
          document: activeDoc,
          documentName: docName,
          instance: s1.collabServer.hocuspocus,
          requestHeaders: {},
          requestParameters: new URLSearchParams(),
          socketId: 'persist-test',
        },
        true,
      );
    }

    prov1.destroy();
    ws1.destroy();
    await s1.close();

    // --- Boot Instance 2 pointing to same disk database ---
    const s2 = await createUniteServer({
      NODE_ENV: 'development',
      STORAGE_DRIVER: 'pglite',
      PGLITE_DATA_DIR: tempDataDir,
      AUTH_PROVIDER: 'local',
    });
    const { port: port2 } = await s2.listen(0);

    const loginRes = await request(s2.app).post('/api/auth/login').send({
      email: 'persist@unite.dev',
      password: 'Password123!',
    });
    expect(loginRes.status).toBe(200);
    const token2 = loginRes.body.accessToken as string;

    const fetchedWs = await request(s2.app)
      .get(`/api/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${token2}`);
    expect(fetchedWs.status).toBe(200);
    expect(fetchedWs.body.workspace.name).toBe('Persistent Project');

    const doc2 = new Y.Doc();
    const ws2 = new HocuspocusProviderWebsocket({
      url: `ws://127.0.0.1:${port2}/collab`,
      WebSocketPolyfill: WebSocket as unknown as typeof globalThis.WebSocket,
    });
    const prov2 = new HocuspocusProvider({
      websocketProvider: ws2,
      name: docName,
      document: doc2,
      token: token2,
    });
    await waitForSynced(prov2);
    expect(doc2.getText('monaco').toString()).toContain('// Persisted across restart');

    prov2.destroy();
    ws2.destroy();
    await s2.close();
  });
});

