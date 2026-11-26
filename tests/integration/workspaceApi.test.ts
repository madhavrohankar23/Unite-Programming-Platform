import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createUniteServer, type UniteServerInstance } from '../../server/src/app.js';

describe('Workspace, File & Security Integration API', () => {
  let server: UniteServerInstance;
  let ownerToken: string;
  let editorToken: string;
  let viewerToken: string;
  let outsiderToken: string;
  let editorUserId: string;
  let workspaceId: string;
  let createdFileId: string;
  let viewerInviteCode: string;

  beforeAll(async () => {
    server = await createUniteServer({
      NODE_ENV: 'test',
      STORAGE_DRIVER: 'pglite',
      AUTH_PROVIDER: 'local',
      EXECUTION_PROVIDER: 'disabled',
    });

    const r1 = await request(server.app).post('/api/auth/register').send({
      email: 'owner@unite.dev',
      password: 'Password123!',
      displayName: 'Alice Owner',
    });
    ownerToken = r1.body.accessToken;

    const r2 = await request(server.app).post('/api/auth/register').send({
      email: 'editor@unite.dev',
      password: 'Password123!',
      displayName: 'Bob Editor',
    });
    editorToken = r2.body.accessToken;
    editorUserId = r2.body.user.id;

    const r3 = await request(server.app).post('/api/auth/register').send({
      email: 'viewer@unite.dev',
      password: 'Password123!',
      displayName: 'Charlie Viewer',
    });
    viewerToken = r3.body.accessToken;

    const r4 = await request(server.app).post('/api/auth/register').send({
      email: 'outsider@unite.dev',
      password: 'Password123!',
      displayName: 'Eve Outsider',
    });
    outsiderToken = r4.body.accessToken;
  });

  afterAll(async () => {
    await server.close();
  });

  it('creates a workspace with initial template files and invitation', async () => {
    const res = await request(server.app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Core Platform', defaultLanguage: 'javascript', template: 'node-starter' });

    expect(res.status).toBe(201);
    expect(res.body.workspace.name).toBe('Core Platform');
    expect(res.body.workspace.currentUserRole).toBe('OWNER');
    expect(res.body.workspace.files.length).toBeGreaterThanOrEqual(4);
    expect(res.body.initialInvitation.joinCode).toMatch(/^UNITE-/);
    workspaceId = res.body.workspace.id;

    // Editor joins via initial invitation
    const joinRes = await request(server.app)
      .post('/api/invitations/join')
      .set('Authorization', `Bearer ${editorToken}`)
      .send({ tokenOrCode: res.body.initialInvitation.joinCode });
    expect(joinRes.status).toBe(200);
    expect(joinRes.body.workspace.currentUserRole).toBe('EDITOR');
  });

  it('creates a viewer invitation, validates it, and enforces viewer read-only permissions', async () => {
    const invRes = await request(server.app)
      .post(`/api/workspaces/${workspaceId}/invitations`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'VIEWER', expiresInHours: 24, maxUses: 1 });
    expect(invRes.status).toBe(201);
    viewerInviteCode = invRes.body.invitation.joinCode;

    const valRes = await request(server.app)
      .post('/api/invitations/validate')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ tokenOrCode: viewerInviteCode });
    expect(valRes.status).toBe(200);
    expect(valRes.body.role).toBe('VIEWER');

    const joinRes = await request(server.app)
      .post('/api/invitations/join')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ tokenOrCode: viewerInviteCode });
    expect(joinRes.status).toBe(200);
    expect(joinRes.body.workspace.currentUserRole).toBe('VIEWER');

    // Second use of maxUses=1 invitation fails for outsider
    const exhaustedRes = await request(server.app)
      .post('/api/invitations/join')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ tokenOrCode: viewerInviteCode });
    expect(exhaustedRes.status).toBe(403);

    // Viewer cannot create files
    const viewerFileRes = await request(server.app)
      .post(`/api/workspaces/${workspaceId}/files`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ parentId: null, name: 'hack.js', nodeType: 'FILE' });
    expect(viewerFileRes.status).toBe(403);

    // Viewer cannot invoke execution
    const viewerExecRes = await request(server.app)
      .post(`/api/workspaces/${workspaceId}/execute`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ language: 'cpp', code: 'int main() { return 0; }' });
    expect(viewerExecRes.status).toBe(403);
  });

  it('blocks unauthorized outsiders and prevents path traversal', async () => {
    const unauthRes = await request(server.app).get(`/api/workspaces/${workspaceId}`);
    expect(unauthRes.status).toBe(401);

    const outsiderRes = await request(server.app)
      .get(`/api/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(outsiderRes.status).toBe(403);

    const traversalRes = await request(server.app)
      .post(`/api/workspaces/${workspaceId}/files`)
      .set('Authorization', `Bearer ${editorToken}`)
      .send({ parentId: null, name: '../../etc/passwd', nodeType: 'FILE' });
    expect(traversalRes.status).toBe(400);
  });

  it('allows editors to create, rename, and delete files while protecting owner-only operations', async () => {
    const createRes = await request(server.app)
      .post(`/api/workspaces/${workspaceId}/files`)
      .set('Authorization', `Bearer ${editorToken}`)
      .send({
        parentId: null,
        name: 'helper.py',
        nodeType: 'FILE',
        initialContent: 'print("hello")',
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.file.language).toBe('python');
    createdFileId = createRes.body.file.id;

    const renameRes = await request(server.app)
      .patch(`/api/workspaces/${workspaceId}/files/${createdFileId}`)
      .set('Authorization', `Bearer ${editorToken}`)
      .send({ name: 'helper.ts' });
    expect(renameRes.status).toBe(200);
    expect(renameRes.body.file.language).toBe('typescript');

    // Editor cannot remove members or delete workspace
    const roleChangeRes = await request(server.app)
      .patch(`/api/workspaces/${workspaceId}/members/${editorUserId}`)
      .set('Authorization', `Bearer ${editorToken}`)
      .send({ role: 'VIEWER' });
    expect(roleChangeRes.status).toBe(403);

    const deleteWsRes = await request(server.app)
      .delete(`/api/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${editorToken}`);
    expect(deleteWsRes.status).toBe(403);

    const delFileRes = await request(server.app)
      .delete(`/api/workspaces/${workspaceId}/files/${createdFileId}`)
      .set('Authorization', `Bearer ${editorToken}`);
    expect(delFileRes.status).toBe(200);
    expect(delFileRes.body.deletedIds).toContain(createdFileId);
  });

  it('supports revoking invitations', async () => {
    const inv = await request(server.app)
      .post(`/api/workspaces/${workspaceId}/invitations`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'EDITOR' });
    const invId = inv.body.invitation.id;
    const code = inv.body.invitation.joinCode;

    const revoke = await request(server.app)
      .delete(`/api/workspaces/${workspaceId}/invitations/${invId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(revoke.status).toBe(204);

    const joinRevoked = await request(server.app)
      .post('/api/invitations/join')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ tokenOrCode: code });
    expect(joinRevoked.status).toBe(403);
  });
});

