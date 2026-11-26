import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import type { WorkspaceCategory } from '../../../shared/constants/languages.js';
import type { WorkspaceRole } from '../../../shared/constants/roles.js';
import type {
  ExecutionStatus,
  FileChangeRequestDto,
  FileNodeType,
  FileVersionDto,
  WorkspaceFileDto,
  WorkspaceInvitationDto,
  WorkspaceJoinRequestDto,
  WorkspaceMemberDto,
  WorkspaceSummaryDto,
} from '../../../shared/types/models.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import type {
  CollabDocRecord,
  DatabaseRepositories,
  ExecutionRecordRow,
  InternalUserRecord,
  InvitationWithWorkspace,
  WorkspaceEntity,
} from './types.js';

const PGLITE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  auth_user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  join_code TEXT UNIQUE,
  category TEXT NOT NULL DEFAULT 'programming',
  default_language TEXT NOT NULL DEFAULT 'javascript',
  live_server_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS join_code TEXT UNIQUE;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'programming';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS live_server_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS workspace_members (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'EDITOR', 'VIEWER')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS workspace_invitations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  code_prefix TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'EDITOR', 'VIEWER')),
  expires_at TIMESTAMPTZ,
  max_uses INTEGER,
  use_count INTEGER NOT NULL DEFAULT 0,
  created_by_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspace_join_requests (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  assigned_role TEXT CHECK (assigned_role IN ('OWNER', 'EDITOR', 'VIEWER')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS workspace_files (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES workspace_files(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  node_type TEXT NOT NULL CHECK (node_type IN ('FILE', 'FOLDER')),
  language TEXT NOT NULL DEFAULT 'plaintext',
  content_snapshot TEXT,
  created_by_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_files_unique_root
  ON workspace_files (workspace_id, name) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_files_unique_nested
  ON workspace_files (workspace_id, parent_id, name) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_workspace ON workspace_files (workspace_id);

CREATE TABLE IF NOT EXISTS file_change_requests (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL REFERENCES workspace_files(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  previous_content TEXT NOT NULL,
  proposed_content TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT 'Proposed code update',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS file_versions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL REFERENCES workspace_files(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT 'Saved snapshot',
  author_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  approved_by_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collab_documents (
  id TEXT PRIMARY KEY,
  doc_name TEXT NOT NULL UNIQUE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL UNIQUE REFERENCES workspace_files(id) ON DELETE CASCADE,
  state BYTEA NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS execution_records (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  file_id TEXT REFERENCES workspace_files(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  exit_code INTEGER,
  stdout TEXT NOT NULL DEFAULT '',
  stderr TEXT NOT NULL DEFAULT '',
  duration_ms INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function mapUser(row: Record<string, unknown>): InternalUserRecord {
  return {
    id: String(row.id),
    authUserId: String(row.auth_user_id),
    email: String(row.email),
    displayName: String(row.display_name),
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    passwordHash: row.password_hash ? String(row.password_hash) : null,
    createdAt: toIso(row.created_at),
  };
}

function mapWorkspace(row: Record<string, unknown>): WorkspaceEntity {
  return {
    id: String(row.id),
    name: String(row.name),
    ownerId: String(row.owner_id),
    joinCode: row.join_code ? String(row.join_code) : '000000',
    category: (row.category ? String(row.category) : 'programming') as WorkspaceCategory,
    defaultLanguage: String(row.default_language),
    liveServerEnabled: Boolean(row.live_server_enabled),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapMember(row: Record<string, unknown>): WorkspaceMemberDto {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    userId: String(row.user_id),
    role: row.role as WorkspaceRole,
    joinedAt: toIso(row.joined_at),
    user: {
      id: String(row.u_id),
      authUserId: String(row.u_auth_user_id),
      email: String(row.u_email),
      displayName: String(row.u_display_name),
      avatarUrl: row.u_avatar_url ? String(row.u_avatar_url) : null,
      createdAt: toIso(row.u_created_at),
    },
  };
}

function mapInvitation(row: Record<string, unknown>): InvitationWithWorkspace {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    tokenHash: String(row.token_hash),
    codePrefix: String(row.code_prefix),
    role: row.role as WorkspaceRole,
    expiresAt: row.expires_at ? toIso(row.expires_at) : null,
    maxUses: row.max_uses !== null && row.max_uses !== undefined ? Number(row.max_uses) : null,
    useCount: Number(row.use_count),
    createdById: String(row.created_by_id),
    revokedAt: row.revoked_at ? toIso(row.revoked_at) : null,
    createdAt: toIso(row.created_at),
  };
}

function mapFile(row: Record<string, unknown>): WorkspaceFileDto {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    parentId: row.parent_id ? String(row.parent_id) : null,
    name: String(row.name),
    nodeType: row.node_type as FileNodeType,
    language: String(row.language),
    contentSnapshot:
      row.content_snapshot !== null && row.content_snapshot !== undefined
        ? String(row.content_snapshot)
        : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapJoinRequest(row: Record<string, unknown>): WorkspaceJoinRequestDto {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    workspaceName: String(row.workspace_name),
    userId: String(row.user_id),
    status: row.status as WorkspaceJoinRequestDto['status'],
    assignedRole: row.assigned_role ? (row.assigned_role as WorkspaceRole) : null,
    createdAt: toIso(row.created_at),
    decidedAt: row.decided_at ? toIso(row.decided_at) : null,
    user: {
      id: String(row.u_id),
      authUserId: String(row.u_auth_user_id),
      email: String(row.u_email),
      displayName: String(row.u_display_name),
      avatarUrl: row.u_avatar_url ? String(row.u_avatar_url) : null,
      createdAt: toIso(row.u_created_at),
    },
  };
}

function mapChangeRequest(row: Record<string, unknown>): FileChangeRequestDto {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    fileId: String(row.file_id),
    fileName: String(row.file_name),
    authorId: String(row.author_id),
    authorName: String(row.author_name),
    previousContent: String(row.previous_content),
    proposedContent: String(row.proposed_content),
    summary: String(row.summary),
    status: row.status as FileChangeRequestDto['status'],
    createdAt: toIso(row.created_at),
    decidedAt: row.decided_at ? toIso(row.decided_at) : null,
  };
}

function mapVersion(row: Record<string, unknown>): FileVersionDto {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    fileId: String(row.file_id),
    versionNumber: Number(row.version_number),
    content: String(row.content),
    summary: String(row.summary),
    authorId: String(row.author_id),
    authorName: String(row.author_name),
    approvedById: String(row.approved_by_id),
    approvedByName: String(row.approved_by_name),
    createdAt: toIso(row.created_at),
  };
}

export async function createPgliteRepositories(
  dataDir: string | 'memory',
): Promise<DatabaseRepositories> {
  let db: PGlite;
  if (dataDir === 'memory') {
    db = new PGlite();
  } else {
    const resolved = path.resolve(process.cwd(), dataDir);
    fs.mkdirSync(resolved, { recursive: true });
    db = new PGlite(resolved);
  }
  await db.exec(PGLITE_SCHEMA_SQL);

  return {
    users: {
      async findById(id) {
        const res = await db.query<Record<string, unknown>>(
          'SELECT * FROM user_profiles WHERE id = $1',
          [id],
        );
        return res.rows[0] ? mapUser(res.rows[0]) : null;
      },
      async findByAuthUserId(authUserId) {
        const res = await db.query<Record<string, unknown>>(
          'SELECT * FROM user_profiles WHERE auth_user_id = $1',
          [authUserId],
        );
        return res.rows[0] ? mapUser(res.rows[0]) : null;
      },
      async findByEmail(email) {
        const res = await db.query<Record<string, unknown>>(
          'SELECT * FROM user_profiles WHERE LOWER(email) = LOWER($1)',
          [email],
        );
        return res.rows[0] ? mapUser(res.rows[0]) : null;
      },
      async create(input) {
        try {
          const res = await db.query<Record<string, unknown>>(
            `INSERT INTO user_profiles (id, auth_user_id, email, display_name, avatar_url, password_hash)
             VALUES ($1, $2, LOWER($3), $4, $5, $6)
             RETURNING *`,
            [
              input.id,
              input.authUserId,
              input.email,
              input.displayName,
              input.avatarUrl ?? null,
              input.passwordHash ?? null,
            ],
          );
          return mapUser(res.rows[0]!);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '';
          if (msg.includes('unique') || msg.includes('duplicate')) {
            throw new ConflictError('An account with this email already exists', 'EMAIL_EXISTS');
          }
          throw err;
        }
      },
      async upsertByAuthUser(input) {
        const res = await db.query<Record<string, unknown>>(
          `INSERT INTO user_profiles (id, auth_user_id, email, display_name, avatar_url)
           VALUES ($1, $2, LOWER($3), $4, $5)
           ON CONFLICT (auth_user_id) DO UPDATE SET
             email = EXCLUDED.email,
             display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), user_profiles.display_name),
             avatar_url = COALESCE(EXCLUDED.avatar_url, user_profiles.avatar_url),
             updated_at = NOW()
           RETURNING *`,
          [input.id, input.authUserId, input.email, input.displayName, input.avatarUrl ?? null],
        );
        return mapUser(res.rows[0]!);
      },
      async updateProfile(id, input) {
        const res = await db.query<Record<string, unknown>>(
          `UPDATE user_profiles
           SET display_name = COALESCE($2, display_name),
               avatar_url = CASE WHEN $3::boolean THEN $4 ELSE avatar_url END,
               updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [id, input.displayName ?? null, input.avatarUrl !== undefined, input.avatarUrl ?? null],
        );
        if (!res.rows[0]) throw new NotFoundError('User not found');
        return mapUser(res.rows[0]);
      },
    },

    workspaces: {
      async createWithOwnerAndFiles(input) {
        return db.transaction(async (tx) => {
          const wsRes = await tx.query<Record<string, unknown>>(
            `INSERT INTO workspaces (id, name, owner_id, join_code, category, default_language, live_server_enabled)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
              input.workspace.id,
              input.workspace.name,
              input.workspace.ownerId,
              input.workspace.joinCode,
              input.workspace.category,
              input.workspace.defaultLanguage,
              input.workspace.liveServerEnabled,
            ],
          );
          await tx.query(
            `INSERT INTO workspace_members (id, workspace_id, user_id, role)
             VALUES ($1, $2, $3, 'OWNER')`,
            [input.ownerMemberId, input.workspace.id, input.workspace.ownerId],
          );
          for (const file of input.initialFiles) {
            await tx.query(
              `INSERT INTO workspace_files
                (id, workspace_id, parent_id, name, node_type, language, content_snapshot, created_by_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                file.id,
                input.workspace.id,
                file.parentId,
                file.name,
                file.nodeType,
                file.language,
                file.contentSnapshot,
                input.workspace.ownerId,
              ],
            );
          }
          return mapWorkspace(wsRes.rows[0]!);
        });
      },

      async findById(id) {
        const res = await db.query<Record<string, unknown>>(
          'SELECT * FROM workspaces WHERE id = $1',
          [id],
        );
        return res.rows[0] ? mapWorkspace(res.rows[0]) : null;
      },

      async findByJoinCode(joinCode) {
        const res = await db.query<Record<string, unknown>>(
          'SELECT * FROM workspaces WHERE join_code = $1',
          [joinCode.trim()],
        );
        return res.rows[0] ? mapWorkspace(res.rows[0]) : null;
      },

      async listForUser(userId) {
        const res = await db.query<Record<string, unknown>>(
          `SELECT w.*, wm.role AS current_user_role,
            (SELECT COUNT(*)::int FROM workspace_members m WHERE m.workspace_id = w.id) AS member_count,
            (SELECT COUNT(*)::int FROM workspace_files f WHERE f.workspace_id = w.id AND f.node_type = 'FILE') AS file_count
           FROM workspaces w
           INNER JOIN workspace_members wm ON wm.workspace_id = w.id
           WHERE wm.user_id = $1
           ORDER BY w.updated_at DESC`,
          [userId],
        );
        return res.rows.map((r): WorkspaceSummaryDto => ({
          id: String(r.id),
          name: String(r.name),
          ownerId: String(r.owner_id),
          joinCode: r.join_code ? String(r.join_code) : '000000',
          category: (r.category ? String(r.category) : 'programming') as WorkspaceCategory,
          defaultLanguage: String(r.default_language),
          liveServerEnabled: Boolean(r.live_server_enabled),
          createdAt: toIso(r.created_at),
          updatedAt: toIso(r.updated_at),
          currentUserRole: r.current_user_role as WorkspaceRole,
          memberCount: Number(r.member_count),
          fileCount: Number(r.file_count),
        }));
      },

      async update(id, input) {
        const res = await db.query<Record<string, unknown>>(
          `UPDATE workspaces
           SET name = COALESCE($2, name),
               default_language = COALESCE($3, default_language),
               live_server_enabled = COALESCE($4, live_server_enabled),
               updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [id, input.name ?? null, input.defaultLanguage ?? null, input.liveServerEnabled ?? null],
        );
        if (!res.rows[0]) throw new NotFoundError('Workspace not found');
        return mapWorkspace(res.rows[0]);
      },

      async delete(id) {
        await db.query('DELETE FROM workspaces WHERE id = $1', [id]);
      },

      async findMember(workspaceId, userId) {
        const res = await db.query<Record<string, unknown>>(
          `SELECT wm.*, u.id AS u_id, u.auth_user_id AS u_auth_user_id, u.email AS u_email,
                  u.display_name AS u_display_name, u.avatar_url AS u_avatar_url, u.created_at AS u_created_at
           FROM workspace_members wm
           INNER JOIN user_profiles u ON u.id = wm.user_id
           WHERE wm.workspace_id = $1 AND wm.user_id = $2`,
          [workspaceId, userId],
        );
        return res.rows[0] ? mapMember(res.rows[0]) : null;
      },

      async listMembers(workspaceId) {
        const res = await db.query<Record<string, unknown>>(
          `SELECT wm.*, u.id AS u_id, u.auth_user_id AS u_auth_user_id, u.email AS u_email,
                  u.display_name AS u_display_name, u.avatar_url AS u_avatar_url, u.created_at AS u_created_at
           FROM workspace_members wm
           INNER JOIN user_profiles u ON u.id = wm.user_id
           WHERE wm.workspace_id = $1
           ORDER BY wm.joined_at ASC`,
          [workspaceId],
        );
        return res.rows.map(mapMember);
      },

      async addMember(input) {
        await db.query(
          `INSERT INTO workspace_members (id, workspace_id, user_id, role)
           VALUES ($1, $2, $3, $4)`,
          [input.id, input.workspaceId, input.userId, input.role],
        );
        const created = await this.findMember(input.workspaceId, input.userId);
        return created!;
      },

      async updateMemberRole(workspaceId, userId, role) {
        await db.query(
          `UPDATE workspace_members SET role = $3 WHERE workspace_id = $1 AND user_id = $2`,
          [workspaceId, userId, role],
        );
        const updated = await this.findMember(workspaceId, userId);
        if (!updated) throw new NotFoundError('Workspace member not found');
        return updated;
      },

      async removeMember(workspaceId, userId) {
        await db.query(
          'DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
          [workspaceId, userId],
        );
      },

      async createInvitation(input) {
        const res = await db.query<Record<string, unknown>>(
          `INSERT INTO workspace_invitations
            (id, workspace_id, token_hash, code_prefix, role, expires_at, max_uses, created_by_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            input.id,
            input.workspaceId,
            input.tokenHash,
            input.codePrefix,
            input.role,
            input.expiresAt ? input.expiresAt.toISOString() : null,
            input.maxUses,
            input.createdById,
          ],
        );
        const mapped = mapInvitation(res.rows[0]!);
        const { tokenHash: _th, ...dto } = mapped;
        return dto;
      },

      async listInvitations(workspaceId) {
        const res = await db.query<Record<string, unknown>>(
          `SELECT * FROM workspace_invitations
           WHERE workspace_id = $1
           ORDER BY created_at DESC`,
          [workspaceId],
        );
        return res.rows.map((r): WorkspaceInvitationDto => {
          const { tokenHash: _th, ...dto } = mapInvitation(r);
          return dto;
        });
      },

      async findInvitationByTokenHash(tokenHash) {
        const res = await db.query<Record<string, unknown>>(
          'SELECT * FROM workspace_invitations WHERE token_hash = $1',
          [tokenHash],
        );
        return res.rows[0] ? mapInvitation(res.rows[0]) : null;
      },

      async findInvitationById(id) {
        const res = await db.query<Record<string, unknown>>(
          'SELECT * FROM workspace_invitations WHERE id = $1',
          [id],
        );
        if (!res.rows[0]) return null;
        const { tokenHash: _th, ...dto } = mapInvitation(res.rows[0]);
        return dto;
      },

      async incrementInvitationUse(id) {
        await db.query(
          'UPDATE workspace_invitations SET use_count = use_count + 1 WHERE id = $1',
          [id],
        );
      },

      async revokeInvitation(id) {
        await db.query(
          'UPDATE workspace_invitations SET revoked_at = NOW() WHERE id = $1',
          [id],
        );
      },
    },

    joinRequests: {
      async create(input) {
        await db.query(
          `INSERT INTO workspace_join_requests (id, workspace_id, user_id, status)
           VALUES ($1, $2, $3, 'PENDING')`,
          [input.id, input.workspaceId, input.userId],
        );
        const created = await this.findById(input.id);
        return created!;
      },

      async findById(id) {
        const res = await db.query<Record<string, unknown>>(
          `SELECT jr.*, w.name AS workspace_name,
                  u.id AS u_id, u.auth_user_id AS u_auth_user_id, u.email AS u_email,
                  u.display_name AS u_display_name, u.avatar_url AS u_avatar_url, u.created_at AS u_created_at
           FROM workspace_join_requests jr
           INNER JOIN workspaces w ON w.id = jr.workspace_id
           INNER JOIN user_profiles u ON u.id = jr.user_id
           WHERE jr.id = $1`,
          [id],
        );
        return res.rows[0] ? mapJoinRequest(res.rows[0]) : null;
      },

      async findPendingForUser(workspaceId, userId) {
        const res = await db.query<Record<string, unknown>>(
          `SELECT jr.*, w.name AS workspace_name,
                  u.id AS u_id, u.auth_user_id AS u_auth_user_id, u.email AS u_email,
                  u.display_name AS u_display_name, u.avatar_url AS u_avatar_url, u.created_at AS u_created_at
           FROM workspace_join_requests jr
           INNER JOIN workspaces w ON w.id = jr.workspace_id
           INNER JOIN user_profiles u ON u.id = jr.user_id
           WHERE jr.workspace_id = $1 AND jr.user_id = $2 AND jr.status = 'PENDING'
           ORDER BY jr.created_at DESC
           LIMIT 1`,
          [workspaceId, userId],
        );
        return res.rows[0] ? mapJoinRequest(res.rows[0]) : null;
      },

      async listPendingForWorkspace(workspaceId) {
        const res = await db.query<Record<string, unknown>>(
          `SELECT jr.*, w.name AS workspace_name,
                  u.id AS u_id, u.auth_user_id AS u_auth_user_id, u.email AS u_email,
                  u.display_name AS u_display_name, u.avatar_url AS u_avatar_url, u.created_at AS u_created_at
           FROM workspace_join_requests jr
           INNER JOIN workspaces w ON w.id = jr.workspace_id
           INNER JOIN user_profiles u ON u.id = jr.user_id
           WHERE jr.workspace_id = $1 AND jr.status = 'PENDING'
           ORDER BY jr.created_at ASC`,
          [workspaceId],
        );
        return res.rows.map(mapJoinRequest);
      },

      async decide(input) {
        await db.query(
          `UPDATE workspace_join_requests
           SET status = $2, assigned_role = $3, decided_at = NOW()
           WHERE id = $1`,
          [input.id, input.status, input.assignedRole],
        );
        const updated = await this.findById(input.id);
        if (!updated) throw new NotFoundError('Join request not found');
        return updated;
      },
    },

    files: {
      async listByWorkspace(workspaceId) {
        const res = await db.query<Record<string, unknown>>(
          `SELECT * FROM workspace_files
           WHERE workspace_id = $1
           ORDER BY node_type DESC, name ASC`,
          [workspaceId],
        );
        return res.rows.map(mapFile);
      },

      async findById(workspaceId, fileId) {
        const res = await db.query<Record<string, unknown>>(
          'SELECT * FROM workspace_files WHERE workspace_id = $1 AND id = $2',
          [workspaceId, fileId],
        );
        return res.rows[0] ? mapFile(res.rows[0]) : null;
      },

      async create(input) {
        try {
          const res = await db.query<Record<string, unknown>>(
            `INSERT INTO workspace_files
              (id, workspace_id, parent_id, name, node_type, language, content_snapshot, created_by_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
              input.id,
              input.workspaceId,
              input.parentId,
              input.name,
              input.nodeType,
              input.language,
              input.contentSnapshot,
              input.createdById,
            ],
          );
          return mapFile(res.rows[0]!);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '';
          if (msg.includes('unique') || msg.includes('duplicate')) {
            throw new ConflictError(
              `A file or folder named "${input.name}" already exists in this folder`,
              'FILE_EXISTS',
            );
          }
          throw err;
        }
      },

      async update(workspaceId, fileId, input) {
        try {
          const res = await db.query<Record<string, unknown>>(
            `UPDATE workspace_files
             SET name = COALESCE($3, name),
                 parent_id = CASE WHEN $4::boolean THEN $5 ELSE parent_id END,
                 language = COALESCE($6, language),
                 updated_at = NOW()
             WHERE workspace_id = $1 AND id = $2
             RETURNING *`,
            [
              workspaceId,
              fileId,
              input.name ?? null,
              input.parentId !== undefined,
              input.parentId ?? null,
              input.language ?? null,
            ],
          );
          if (!res.rows[0]) throw new NotFoundError('File or folder not found');
          return mapFile(res.rows[0]);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '';
          if (msg.includes('unique') || msg.includes('duplicate')) {
            throw new ConflictError(
              'A file or folder with that name already exists in the destination',
              'FILE_EXISTS',
            );
          }
          throw err;
        }
      },

      async updateSnapshot(fileId, contentSnapshot) {
        await db.query(
          'UPDATE workspace_files SET content_snapshot = $2, updated_at = NOW() WHERE id = $1',
          [fileId, contentSnapshot],
        );
      },

      async deleteSubtree(workspaceId, nodeId) {
        const res = await db.query<{ id: string }>(
          `WITH RECURSIVE subtree AS (
             SELECT id FROM workspace_files WHERE workspace_id = $1 AND id = $2
             UNION ALL
             SELECT f.id FROM workspace_files f INNER JOIN subtree s ON f.parent_id = s.id
           )
           SELECT id FROM subtree`,
          [workspaceId, nodeId],
        );
        const deletedIds = res.rows.map((r) => r.id);
        if (deletedIds.length === 0) return [];
        await db.query('DELETE FROM workspace_files WHERE workspace_id = $1 AND id = $2', [
          workspaceId,
          nodeId,
        ]);
        return deletedIds;
      },
    },

    changeRequests: {
      async create(input) {
        await db.query(
          `INSERT INTO file_change_requests
            (id, workspace_id, file_id, author_id, previous_content, proposed_content, summary, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')`,
          [
            input.id,
            input.workspaceId,
            input.fileId,
            input.authorId,
            input.previousContent,
            input.proposedContent,
            input.summary,
          ],
        );
        const created = await this.findById(input.id);
        return created!;
      },

      async findById(id) {
        const res = await db.query<Record<string, unknown>>(
          `SELECT cr.*, f.name AS file_name, u.display_name AS author_name
           FROM file_change_requests cr
           INNER JOIN workspace_files f ON f.id = cr.file_id
           INNER JOIN user_profiles u ON u.id = cr.author_id
           WHERE cr.id = $1`,
          [id],
        );
        return res.rows[0] ? mapChangeRequest(res.rows[0]) : null;
      },

      async listPendingForWorkspace(workspaceId) {
        const res = await db.query<Record<string, unknown>>(
          `SELECT cr.*, f.name AS file_name, u.display_name AS author_name
           FROM file_change_requests cr
           INNER JOIN workspace_files f ON f.id = cr.file_id
           INNER JOIN user_profiles u ON u.id = cr.author_id
           WHERE cr.workspace_id = $1 AND cr.status = 'PENDING'
           ORDER BY cr.created_at ASC`,
          [workspaceId],
        );
        return res.rows.map(mapChangeRequest);
      },

      async decide(input) {
        await db.query(
          `UPDATE file_change_requests
           SET status = $2, decided_at = NOW()
           WHERE id = $1`,
          [input.id, input.status],
        );
        const updated = await this.findById(input.id);
        if (!updated) throw new NotFoundError('Change request not found');
        return updated;
      },
    },

    versions: {
      async create(input) {
        const maxRes = await db.query<{ next_ver: number }>(
          'SELECT COALESCE(MAX(version_number), 0)::int + 1 AS next_ver FROM file_versions WHERE file_id = $1',
          [input.fileId],
        );
        const versionNumber = maxRes.rows[0]?.next_ver ?? 1;

        await db.query(
          `INSERT INTO file_versions
            (id, workspace_id, file_id, version_number, content, summary, author_id, approved_by_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            input.id,
            input.workspaceId,
            input.fileId,
            versionNumber,
            input.content,
            input.summary,
            input.authorId,
            input.approvedById,
          ],
        );

        const created = await this.findById(input.workspaceId, input.id);
        return created!;
      },

      async listByFile(workspaceId, fileId) {
        const res = await db.query<Record<string, unknown>>(
          `SELECT v.*, a.display_name AS author_name, ap.display_name AS approved_by_name
           FROM file_versions v
           INNER JOIN user_profiles a ON a.id = v.author_id
           INNER JOIN user_profiles ap ON ap.id = v.approved_by_id
           WHERE v.workspace_id = $1 AND v.file_id = $2
           ORDER BY v.version_number DESC`,
          [workspaceId, fileId],
        );
        return res.rows.map(mapVersion);
      },

      async findById(workspaceId, versionId) {
        const res = await db.query<Record<string, unknown>>(
          `SELECT v.*, a.display_name AS author_name, ap.display_name AS approved_by_name
           FROM file_versions v
           INNER JOIN user_profiles a ON a.id = v.author_id
           INNER JOIN user_profiles ap ON ap.id = v.approved_by_id
           WHERE v.workspace_id = $1 AND v.id = $2`,
          [workspaceId, versionId],
        );
        return res.rows[0] ? mapVersion(res.rows[0]) : null;
      },
    },

    collab: {
      async findByDocName(docName) {
        const res = await db.query<Record<string, unknown>>(
          'SELECT * FROM collab_documents WHERE doc_name = $1',
          [docName],
        );
        const row = res.rows[0];
        if (!row) return null;
        const rawState = row.state;
        const state =
          rawState instanceof Uint8Array
            ? rawState
            : Buffer.isBuffer(rawState)
              ? new Uint8Array(rawState)
              : new Uint8Array(rawState as ArrayBuffer);
        return {
          id: String(row.id),
          docName: String(row.doc_name),
          workspaceId: String(row.workspace_id),
          fileId: String(row.file_id),
          state,
          updatedAt: toIso(row.updated_at),
        } satisfies CollabDocRecord;
      },

      async upsertDocument(input) {
        await db.query(
          `INSERT INTO collab_documents (id, doc_name, workspace_id, file_id, state, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (doc_name) DO UPDATE SET
             state = EXCLUDED.state,
             updated_at = NOW()`,
          [input.id, input.docName, input.workspaceId, input.fileId, Buffer.from(input.state)],
        );
      },
    },

    executions: {
      async create(input) {
        const res = await db.query<Record<string, unknown>>(
          `INSERT INTO execution_records
            (id, workspace_id, file_id, user_id, language, provider, status, exit_code, stdout, stderr, duration_ms, started_at, finished_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           RETURNING *`,
          [
            input.id,
            input.workspaceId,
            input.fileId,
            input.userId,
            input.language,
            input.provider,
            input.status,
            input.exitCode,
            input.stdout,
            input.stderr,
            input.durationMs,
            input.startedAt.toISOString(),
            input.finishedAt.toISOString(),
          ],
        );
        const r = res.rows[0]!;
        return {
          id: String(r.id),
          workspaceId: String(r.workspace_id),
          fileId: r.file_id ? String(r.file_id) : null,
          userId: String(r.user_id),
          language: String(r.language),
          provider: String(r.provider),
          status: r.status as ExecutionStatus,
          exitCode: r.exit_code !== null && r.exit_code !== undefined ? Number(r.exit_code) : null,
          stdout: String(r.stdout),
          stderr: String(r.stderr),
          durationMs: Number(r.duration_ms),
          startedAt: toIso(r.started_at),
          finishedAt: toIso(r.finished_at),
        } satisfies ExecutionRecordRow;
      },

      async listByWorkspace(workspaceId, limit = 25) {
        const res = await db.query<Record<string, unknown>>(
          `SELECT * FROM execution_records
           WHERE workspace_id = $1
           ORDER BY started_at DESC
           LIMIT $2`,
          [workspaceId, limit],
        );
        return res.rows.map((r): ExecutionRecordRow => ({
          id: String(r.id),
          workspaceId: String(r.workspace_id),
          fileId: r.file_id ? String(r.file_id) : null,
          userId: String(r.user_id),
          language: String(r.language),
          provider: String(r.provider),
          status: r.status as ExecutionStatus,
          exitCode: r.exit_code !== null && r.exit_code !== undefined ? Number(r.exit_code) : null,
          stdout: String(r.stdout),
          stderr: String(r.stderr),
          durationMs: Number(r.duration_ms),
          startedAt: toIso(r.started_at),
          finishedAt: toIso(r.finished_at),
        }));
      },
    },

    audit: {
      async log(input) {
        await db.query(
          `INSERT INTO audit_logs (id, workspace_id, user_id, action, resource_type, resource_id, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            input.id,
            input.workspaceId,
            input.userId,
            input.action,
            input.resourceType,
            input.resourceId,
            JSON.stringify(input.metadata ?? {}),
          ],
        );
      },
    },

    async close() {
      await db.close();
    },
  };
}
