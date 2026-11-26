import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { createUniteServer, type UniteServerInstance } from '../../server/src/app.js';

function connectWsExpectClose(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => reject(new Error('WS did not close in time')), 4000);
    ws.on('close', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
    ws.on('error', () => {
      // Wait for close
    });
  });
}

function connectWsExpectOpen(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => reject(new Error('WS did not open in time')), 4000);
    ws.on('open', () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.on('close', (code) => {
      clearTimeout(timer);
      reject(new Error(`WS closed unexpectedly with code ${code}`));
    });
  });
}

describe('WebSocket, Execution & Security Enforcement', () => {
  let server: UniteServerInstance;
  let port: number;
  let ownerToken: string;
  let viewerToken: string;
  let outsiderToken: string;
  let workspaceId: string;

  beforeAll(async () => {
    server = await createUniteServer({
      NODE_ENV: 'test',
      STORAGE_DRIVER: 'pglite',
      AUTH_PROVIDER: 'local',
      EXECUTION_PROVIDER: 'disabled',
    });
    const started = await server.listen(0);
    port = started.port;

    const r1 = await request(server.app).post('/api/auth/register').send({
      email: 'sec-owner@unite.dev',
      password: 'Password123!',
      displayName: 'Sec Owner',
    });
    ownerToken = r1.body.accessToken;

    const r2 = await request(server.app).post('/api/auth/register').send({
      email: 'sec-viewer@unite.dev',
      password: 'Password123!',
      displayName: 'Sec Viewer',
    });
    viewerToken = r2.body.accessToken;

    const r3 = await request(server.app).post('/api/auth/register').send({
      email: 'sec-out@unite.dev',
      password: 'Password123!',
      displayName: 'Sec Outsider',
    });
    outsiderToken = r3.body.accessToken;

    const wsRes = await request(server.app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Security Workspace', template: 'blank' });
    workspaceId = wsRes.body.workspace.id;

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

  it('blocks unauthenticated and unauthorized WebSocket terminal connections', async () => {
    const noTokenCode = await connectWsExpectClose(
      `ws://127.0.0.1:${port}/ws/terminal?workspaceId=${workspaceId}`,
    );
    expect(noTokenCode).toBe(4001);

    const outsiderCode = await connectWsExpectClose(
      `ws://127.0.0.1:${port}/ws/terminal?workspaceId=${workspaceId}&token=${outsiderToken}`,
    );
    expect(outsiderCode).toBe(4003);

    const viewerCode = await connectWsExpectClose(
      `ws://127.0.0.1:${port}/ws/terminal?workspaceId=${workspaceId}&token=${viewerToken}`,
    );
    expect(viewerCode).toBe(4003);

    const ownerWs = await connectWsExpectOpen(
      `ws://127.0.0.1:${port}/ws/terminal?workspaceId=${workspaceId}&token=${ownerToken}`,
    );
    ownerWs.close();
  });

  it('blocks outsiders from workspace event WebSockets and allows members', async () => {
    const outsiderCode = await connectWsExpectClose(
      `ws://127.0.0.1:${port}/ws/events?workspaceId=${workspaceId}&token=${outsiderToken}`,
    );
    expect(outsiderCode).toBe(4003);

    const viewerWs = await connectWsExpectOpen(
      `ws://127.0.0.1:${port}/ws/events?workspaceId=${workspaceId}&token=${viewerToken}`,
    );
    viewerWs.close();
  });

  it('rejects oversized payloads, unsupported hosted languages, and disabled hosted runtime honestly', async () => {
    const oversized = 'x'.repeat(120_000);
    const sizeRes = await request(server.app)
      .post(`/api/workspaces/${workspaceId}/execute`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ language: 'cpp', code: oversized });
    expect(sizeRes.status).toBe(400);

    const unsupportedRes = await request(server.app)
      .post(`/api/workspaces/${workspaceId}/execute`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ language: 'markdown', code: '# hello' });
    expect(unsupportedRes.status).toBe(400);

    const disabledRes = await request(server.app)
      .post(`/api/workspaces/${workspaceId}/execute`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ language: 'cpp', code: 'int main() { return 0; }' });
    expect(disabledRes.status).toBe(503);
  });
});

