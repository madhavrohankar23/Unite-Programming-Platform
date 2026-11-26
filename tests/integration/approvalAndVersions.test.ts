import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createUniteServer, type UniteServerInstance } from '../../server/src/app.js';

describe('6-Digit Join Approval, Save Change Approval, Version History & Workspace Modes', () => {
  let server: UniteServerInstance;
  let adminToken: string;
  let devToken: string;
  let viewerToken: string;
  let workspaceId: string;
  let joinCode: string;
  let mainFileId: string;

  beforeAll(async () => {
    server = await createUniteServer({
      NODE_ENV: 'test',
      STORAGE_DRIVER: 'pglite',
      AUTH_PROVIDER: 'local',
    });

    const r1 = await request(server.app).post('/api/auth/register').send({
      email: 'host@unite.dev',
      password: 'Password123!',
      displayName: 'Host Admin',
    });
    adminToken = r1.body.accessToken;

    const r2 = await request(server.app).post('/api/auth/register').send({
      email: 'dev@unite.dev',
      password: 'Password123!',
      displayName: 'Dev Contributor',
    });
    devToken = r2.body.accessToken;

    const r3 = await request(server.app).post('/api/auth/register').send({
      email: 'observer@unite.dev',
      password: 'Password123!',
      displayName: 'Read Observer',
    });
    viewerToken = r3.body.accessToken;
  });

  afterAll(async () => {
    await server.close();
  });

  it('creates workspaces for Programming, Development (Live Server), and Custom modes with unique 6-digit codes', async () => {
    const javaWs = await request(server.app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Java Algo',
        category: 'programming',
        defaultLanguage: 'java',
        stack: 'java',
      });
    expect(javaWs.status).toBe(201);
    expect(javaWs.body.workspace.joinCode).toMatch(/^\d{6}$/);
    expect(javaWs.body.workspace.files.some((f: { name: string }) => f.name === 'Main.java')).toBe(
      true,
    );

    const reactWs = await request(server.app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'React Web',
        category: 'development',
        defaultLanguage: 'javascriptreact',
        stack: 'react',
        liveServerEnabled: true,
      });
    expect(reactWs.status).toBe(201);
    expect(reactWs.body.workspace.joinCode).toMatch(/^\d{6}$/);
    expect(reactWs.body.workspace.joinCode).not.toBe(javaWs.body.workspace.joinCode);
    expect(reactWs.body.workspace.liveServerEnabled).toBe(true);
    expect(reactWs.body.workspace.files.some((f: { name: string }) => f.name === 'App.jsx')).toBe(
      true,
    );

    const customWs = await request(server.app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Rust Only',
        category: 'custom',
        defaultLanguage: 'rust',
        stack: 'rust',
      });
    expect(customWs.status).toBe(201);
    expect(customWs.body.workspace.joinCode).toMatch(/^\d{6}$/);
    expect(customWs.body.workspace.files).toHaveLength(1);
    expect(customWs.body.workspace.files[0].name).toBe('main.rs');

    workspaceId = javaWs.body.workspace.id;
    joinCode = javaWs.body.workspace.joinCode;
    mainFileId = javaWs.body.workspace.files.find(
      (f: { name: string }) => f.name === 'Main.java',
    ).id;
  });

  it('requires host approval with Edit or Read-Only mode when joining via 6-digit code', async () => {
    const reqDev = await request(server.app)
      .post('/api/workspaces/join-requests')
      .set('Authorization', `Bearer ${devToken}`)
      .send({ joinCode });
    expect(reqDev.status).toBe(202);
    expect(reqDev.body.alreadyMember).toBe(false);
    const devRequestId = reqDev.body.request.id as string;

    // While pending, user is NOT allowed to access the workspace
    const blocked = await request(server.app)
      .get(`/api/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${devToken}`);
    expect(blocked.status).toBe(403);

    // Host sees pending request and approves Dev as EDITOR
    const pendingList = await request(server.app)
      .get(`/api/workspaces/${workspaceId}/join-requests`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(pendingList.status).toBe(200);
    expect(pendingList.body.requests.some((r: { id: string }) => r.id === devRequestId)).toBe(true);

    const approveDev = await request(server.app)
      .post(`/api/workspaces/${workspaceId}/join-requests/${devRequestId}/decide`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'APPROVE', role: 'EDITOR' });
    expect(approveDev.status).toBe(200);
    expect(approveDev.body.request.status).toBe('APPROVED');
    expect(approveDev.body.request.assignedRole).toBe('EDITOR');

    // Now Dev can enter workspace as EDITOR
    const allowed = await request(server.app)
      .get(`/api/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${devToken}`);
    expect(allowed.status).toBe(200);
    expect(allowed.body.workspace.currentUserRole).toBe('EDITOR');

    // Second user requests join and Host grants Read-Only VIEWER role
    const reqViewer = await request(server.app)
      .post('/api/workspaces/join-requests')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ joinCode });
    const viewerRequestId = reqViewer.body.request.id as string;

    const approveViewer = await request(server.app)
      .post(`/api/workspaces/${workspaceId}/join-requests/${viewerRequestId}/decide`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'APPROVE', role: 'VIEWER' });
    expect(approveViewer.status).toBe(200);
    expect(approveViewer.body.request.assignedRole).toBe('VIEWER');
  });

  it('routes Editor saves through Admin approval and records Version History with restore', async () => {
    // Owner creates initial v1 snapshot
    const ownerSave = await request(server.app)
      .post(`/api/workspaces/${workspaceId}/files/${mainFileId}/save`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        content: 'public class Main { public static void main(String[] a) { System.out.println("v1"); } }',
        summary: 'Initial v1',
      });
    expect(ownerSave.status).toBe(201);
    expect(ownerSave.body.mode).toBe('SAVED');
    const v1Id = ownerSave.body.version.id as string;

    // Editor saves -> creates PENDING FileChangeRequest
    const editorSave = await request(server.app)
      .post(`/api/workspaces/${workspaceId}/files/${mainFileId}/save`)
      .set('Authorization', `Bearer ${devToken}`)
      .send({
        content: 'public class Main { public static void main(String[] a) { System.out.println("v2 by Dev"); } }',
        summary: 'Updated print output',
      });
    expect(editorSave.status).toBe(202);
    expect(editorSave.body.mode).toBe('PENDING_APPROVAL');
    const changeReqId = editorSave.body.changeRequest.id as string;

    // Non-owner cannot approve their own change request
    const selfApprove = await request(server.app)
      .post(`/api/workspaces/${workspaceId}/change-requests/${changeReqId}/decide`)
      .set('Authorization', `Bearer ${devToken}`)
      .send({ decision: 'APPROVE' });
    expect(selfApprove.status).toBe(403);

    // Host approves -> creates v2 in Version History
    const approveChange = await request(server.app)
      .post(`/api/workspaces/${workspaceId}/change-requests/${changeReqId}/decide`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'APPROVE' });
    expect(approveChange.status).toBe(200);
    expect(approveChange.body.version.versionNumber).toBe(2);
    expect(approveChange.body.version.authorName).toBe('Dev Contributor');

    // Version history lists v2 and v1
    const history = await request(server.app)
      .get(`/api/workspaces/${workspaceId}/files/${mainFileId}/versions`)
      .set('Authorization', `Bearer ${devToken}`);
    expect(history.status).toBe(200);
    expect(history.body.versions).toHaveLength(2);
    expect(history.body.versions[0].versionNumber).toBe(2);
    expect(history.body.versions[1].versionNumber).toBe(1);

    // Owner restores v1 -> creates v3 with v1 content
    const restore = await request(server.app)
      .post(`/api/workspaces/${workspaceId}/files/${mainFileId}/versions/${v1Id}/restore`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(restore.status).toBe(200);
    expect(restore.body.version.versionNumber).toBe(3);
    expect(restore.body.version.content).toContain('"v1"');
  });
});

