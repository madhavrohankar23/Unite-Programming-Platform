import { PrismaClient, type Prisma } from '@prisma/client';
import type { WorkspaceCategory } from '../../../shared/constants/languages.js';
import type { WorkspaceRole } from '../../../shared/constants/roles.js';
import type {
  ApprovalStatus,
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
  DatabaseRepositories,
  InternalUserRecord,
  WorkspaceEntity,
} from './types.js';

function mapUser(u: {
  id: string;
  authUserId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  passwordHash: string | null;
  createdAt: Date;
}): InternalUserRecord {
  return {
    id: u.id,
    authUserId: u.authUserId,
    email: u.email,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    passwordHash: u.passwordHash,
    createdAt: u.createdAt.toISOString(),
  };
}

function mapWorkspace(w: {
  id: string;
  name: string;
  ownerId: string;
  joinCode: string;
  category: string;
  defaultLanguage: string;
  liveServerEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): WorkspaceEntity {
  return {
    id: w.id,
    name: w.name,
    ownerId: w.ownerId,
    joinCode: w.joinCode,
    category: w.category as WorkspaceCategory,
    defaultLanguage: w.defaultLanguage,
    liveServerEnabled: w.liveServerEnabled,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}

function mapFile(f: {
  id: string;
  workspaceId: string;
  parentId: string | null;
  name: string;
  nodeType: string;
  language: string;
  contentSnapshot: string | null;
  createdAt: Date;
  updatedAt: Date;
}): WorkspaceFileDto {
  return {
    id: f.id,
    workspaceId: f.workspaceId,
    parentId: f.parentId,
    name: f.name,
    nodeType: f.nodeType as FileNodeType,
    language: f.language,
    contentSnapshot: f.contentSnapshot,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  };
}

function mapMember(m: {
  id: string;
  workspaceId: string;
  userId: string;
  role: string;
  joinedAt: Date;
  user: {
    id: string;
    authUserId: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    createdAt: Date;
  };
}): WorkspaceMemberDto {
  return {
    id: m.id,
    workspaceId: m.workspaceId,
    userId: m.userId,
    role: m.role as WorkspaceRole,
    joinedAt: m.joinedAt.toISOString(),
    user: {
      id: m.user.id,
      authUserId: m.user.authUserId,
      email: m.user.email,
      displayName: m.user.displayName,
      avatarUrl: m.user.avatarUrl,
      createdAt: m.user.createdAt.toISOString(),
    },
  };
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  );
}

export async function createPrismaRepositories(databaseUrl?: string): Promise<DatabaseRepositories> {
  const prisma = new PrismaClient(
    databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined,
  );
  await prisma.$connect();

  return {
    users: {
      async findById(id) {
        const u = await prisma.userProfile.findUnique({ where: { id } });
        return u ? mapUser(u) : null;
      },
      async findByAuthUserId(authUserId) {
        const u = await prisma.userProfile.findUnique({ where: { authUserId } });
        return u ? mapUser(u) : null;
      },
      async findByEmail(email) {
        const u = await prisma.userProfile.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
        });
        return u ? mapUser(u) : null;
      },
      async create(input) {
        try {
          const u = await prisma.userProfile.create({
            data: {
              id: input.id,
              authUserId: input.authUserId,
              email: input.email.toLowerCase(),
              displayName: input.displayName,
              avatarUrl: input.avatarUrl ?? null,
              passwordHash: input.passwordHash ?? null,
            },
          });
          return mapUser(u);
        } catch (err) {
          if (isUniqueViolation(err)) {
            throw new ConflictError('An account with this email already exists', 'EMAIL_EXISTS');
          }
          throw err;
        }
      },
      async upsertByAuthUser(input) {
        const u = await prisma.userProfile.upsert({
          where: { authUserId: input.authUserId },
          create: {
            id: input.id,
            authUserId: input.authUserId,
            email: input.email.toLowerCase(),
            displayName: input.displayName,
            avatarUrl: input.avatarUrl ?? null,
          },
          update: {
            email: input.email.toLowerCase(),
            displayName: input.displayName,
            avatarUrl: input.avatarUrl ?? undefined,
          },
        });
        return mapUser(u);
      },
      async updateProfile(id, input) {
        const u = await prisma.userProfile.update({
          where: { id },
          data: {
            displayName: input.displayName,
            avatarUrl: input.avatarUrl,
          },
        });
        return mapUser(u);
      },
    },

    workspaces: {
      async createWithOwnerAndFiles(input) {
        const ws = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          return tx.workspace.create({
            data: {
              id: input.workspace.id,
              name: input.workspace.name,
              ownerId: input.workspace.ownerId,
              joinCode: input.workspace.joinCode,
              category: input.workspace.category,
              defaultLanguage: input.workspace.defaultLanguage,
              liveServerEnabled: input.workspace.liveServerEnabled,
              members: {
                create: {
                  id: input.ownerMemberId,
                  userId: input.workspace.ownerId,
                  role: 'OWNER',
                },
              },
              files: {
                create: input.initialFiles.map((f) => ({
                  id: f.id,
                  parentId: f.parentId,
                  name: f.name,
                  nodeType: f.nodeType,
                  language: f.language,
                  contentSnapshot: f.contentSnapshot,
                  createdById: input.workspace.ownerId,
                })),
              },
            },
          });
        });
        return mapWorkspace(ws);
      },

      async findById(id) {
        const ws = await prisma.workspace.findUnique({ where: { id } });
        return ws ? mapWorkspace(ws) : null;
      },

      async findByJoinCode(joinCode) {
        const ws = await prisma.workspace.findUnique({ where: { joinCode: joinCode.trim() } });
        return ws ? mapWorkspace(ws) : null;
      },

      async listForUser(userId) {
        const rows = await prisma.workspaceMember.findMany({
          where: { userId },
          include: {
            workspace: {
              include: {
                _count: { select: { members: true } },
                files: { where: { nodeType: 'FILE' }, select: { id: true } },
              },
            },
          },
          orderBy: { workspace: { updatedAt: 'desc' } },
        });
        return rows.map((r): WorkspaceSummaryDto => ({
          id: r.workspace.id,
          name: r.workspace.name,
          ownerId: r.workspace.ownerId,
          joinCode: r.workspace.joinCode,
          category: r.workspace.category as WorkspaceCategory,
          defaultLanguage: r.workspace.defaultLanguage,
          liveServerEnabled: r.workspace.liveServerEnabled,
          createdAt: r.workspace.createdAt.toISOString(),
          updatedAt: r.workspace.updatedAt.toISOString(),
          currentUserRole: r.role as WorkspaceRole,
          memberCount: r.workspace._count.members,
          fileCount: r.workspace.files.length,
        }));
      },

      async update(id, input) {
        const ws = await prisma.workspace.update({
          where: { id },
          data: {
            name: input.name,
            defaultLanguage: input.defaultLanguage,
            liveServerEnabled: input.liveServerEnabled,
          },
        });
        return mapWorkspace(ws);
      },

      async delete(id) {
        await prisma.workspace.delete({ where: { id } });
      },

      async findMember(workspaceId, userId) {
        const m = await prisma.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId, userId } },
          include: { user: true },
        });
        return m ? mapMember(m) : null;
      },

      async listMembers(workspaceId) {
        const rows = await prisma.workspaceMember.findMany({
          where: { workspaceId },
          include: { user: true },
          orderBy: { joinedAt: 'asc' },
        });
        return rows.map(mapMember);
      },

      async addMember(input) {
        const m = await prisma.workspaceMember.create({
          data: {
            id: input.id,
            workspaceId: input.workspaceId,
            userId: input.userId,
            role: input.role,
          },
          include: { user: true },
        });
        return mapMember(m);
      },

      async updateMemberRole(workspaceId, userId, role) {
        const m = await prisma.workspaceMember.update({
          where: { workspaceId_userId: { workspaceId, userId } },
          data: { role },
          include: { user: true },
        });
        return mapMember(m);
      },

      async removeMember(workspaceId, userId) {
        await prisma.workspaceMember.delete({
          where: { workspaceId_userId: { workspaceId, userId } },
        });
      },

      async createInvitation(input) {
        const inv = await prisma.workspaceInvitation.create({
          data: {
            id: input.id,
            workspaceId: input.workspaceId,
            tokenHash: input.tokenHash,
            codePrefix: input.codePrefix,
            role: input.role,
            expiresAt: input.expiresAt,
            maxUses: input.maxUses,
            createdById: input.createdById,
          },
        });
        return {
          id: inv.id,
          workspaceId: inv.workspaceId,
          codePrefix: inv.codePrefix,
          role: inv.role as WorkspaceRole,
          expiresAt: inv.expiresAt ? inv.expiresAt.toISOString() : null,
          maxUses: inv.maxUses,
          useCount: inv.useCount,
          createdById: inv.createdById,
          revokedAt: inv.revokedAt ? inv.revokedAt.toISOString() : null,
          createdAt: inv.createdAt.toISOString(),
        };
      },

      async listInvitations(workspaceId) {
        const list = await prisma.workspaceInvitation.findMany({
          where: { workspaceId },
          orderBy: { createdAt: 'desc' },
        });
        return list.map((inv): WorkspaceInvitationDto => ({
          id: inv.id,
          workspaceId: inv.workspaceId,
          codePrefix: inv.codePrefix,
          role: inv.role as WorkspaceRole,
          expiresAt: inv.expiresAt ? inv.expiresAt.toISOString() : null,
          maxUses: inv.maxUses,
          useCount: inv.useCount,
          createdById: inv.createdById,
          revokedAt: inv.revokedAt ? inv.revokedAt.toISOString() : null,
          createdAt: inv.createdAt.toISOString(),
        }));
      },

      async findInvitationByTokenHash(tokenHash) {
        const inv = await prisma.workspaceInvitation.findUnique({ where: { tokenHash } });
        if (!inv) return null;
        return {
          id: inv.id,
          workspaceId: inv.workspaceId,
          tokenHash: inv.tokenHash,
          codePrefix: inv.codePrefix,
          role: inv.role as WorkspaceRole,
          expiresAt: inv.expiresAt ? inv.expiresAt.toISOString() : null,
          maxUses: inv.maxUses,
          useCount: inv.useCount,
          createdById: inv.createdById,
          revokedAt: inv.revokedAt ? inv.revokedAt.toISOString() : null,
          createdAt: inv.createdAt.toISOString(),
        };
      },

      async findInvitationById(id) {
        const inv = await prisma.workspaceInvitation.findUnique({ where: { id } });
        if (!inv) return null;
        return {
          id: inv.id,
          workspaceId: inv.workspaceId,
          codePrefix: inv.codePrefix,
          role: inv.role as WorkspaceRole,
          expiresAt: inv.expiresAt ? inv.expiresAt.toISOString() : null,
          maxUses: inv.maxUses,
          useCount: inv.useCount,
          createdById: inv.createdById,
          revokedAt: inv.revokedAt ? inv.revokedAt.toISOString() : null,
          createdAt: inv.createdAt.toISOString(),
        };
      },

      async incrementInvitationUse(id) {
        await prisma.workspaceInvitation.update({
          where: { id },
          data: { useCount: { increment: 1 } },
        });
      },

      async revokeInvitation(id) {
        await prisma.workspaceInvitation.update({
          where: { id },
          data: { revokedAt: new Date() },
        });
      },
    },

    joinRequests: {
      async create(input) {
        const jr = await prisma.workspaceJoinRequest.create({
          data: {
            id: input.id,
            workspaceId: input.workspaceId,
            userId: input.userId,
            status: 'PENDING',
          },
          include: { workspace: true, user: true },
        });
        return {
          id: jr.id,
          workspaceId: jr.workspaceId,
          workspaceName: jr.workspace.name,
          userId: jr.userId,
          status: jr.status as ApprovalStatus,
          assignedRole: jr.assignedRole as WorkspaceRole | null,
          createdAt: jr.createdAt.toISOString(),
          decidedAt: jr.decidedAt ? jr.decidedAt.toISOString() : null,
          user: mapUser(jr.user),
        } satisfies WorkspaceJoinRequestDto;
      },

      async findById(id) {
        const jr = await prisma.workspaceJoinRequest.findUnique({
          where: { id },
          include: { workspace: true, user: true },
        });
        if (!jr) return null;
        return {
          id: jr.id,
          workspaceId: jr.workspaceId,
          workspaceName: jr.workspace.name,
          userId: jr.userId,
          status: jr.status as ApprovalStatus,
          assignedRole: jr.assignedRole as WorkspaceRole | null,
          createdAt: jr.createdAt.toISOString(),
          decidedAt: jr.decidedAt ? jr.decidedAt.toISOString() : null,
          user: mapUser(jr.user),
        };
      },

      async findPendingForUser(workspaceId, userId) {
        const jr = await prisma.workspaceJoinRequest.findFirst({
          where: { workspaceId, userId, status: 'PENDING' },
          include: { workspace: true, user: true },
          orderBy: { createdAt: 'desc' },
        });
        if (!jr) return null;
        return {
          id: jr.id,
          workspaceId: jr.workspaceId,
          workspaceName: jr.workspace.name,
          userId: jr.userId,
          status: jr.status as ApprovalStatus,
          assignedRole: jr.assignedRole as WorkspaceRole | null,
          createdAt: jr.createdAt.toISOString(),
          decidedAt: jr.decidedAt ? jr.decidedAt.toISOString() : null,
          user: mapUser(jr.user),
        };
      },

      async listPendingForWorkspace(workspaceId) {
        const rows = await prisma.workspaceJoinRequest.findMany({
          where: { workspaceId, status: 'PENDING' },
          include: { workspace: true, user: true },
          orderBy: { createdAt: 'asc' },
        });
        return rows.map((jr): WorkspaceJoinRequestDto => ({
          id: jr.id,
          workspaceId: jr.workspaceId,
          workspaceName: jr.workspace.name,
          userId: jr.userId,
          status: jr.status as ApprovalStatus,
          assignedRole: jr.assignedRole as WorkspaceRole | null,
          createdAt: jr.createdAt.toISOString(),
          decidedAt: jr.decidedAt ? jr.decidedAt.toISOString() : null,
          user: mapUser(jr.user),
        }));
      },

      async decide(input) {
        const jr = await prisma.workspaceJoinRequest.update({
          where: { id: input.id },
          data: {
            status: input.status,
            assignedRole: input.assignedRole,
            decidedAt: new Date(),
          },
          include: { workspace: true, user: true },
        });
        return {
          id: jr.id,
          workspaceId: jr.workspaceId,
          workspaceName: jr.workspace.name,
          userId: jr.userId,
          status: jr.status as ApprovalStatus,
          assignedRole: jr.assignedRole as WorkspaceRole | null,
          createdAt: jr.createdAt.toISOString(),
          decidedAt: jr.decidedAt ? jr.decidedAt.toISOString() : null,
          user: mapUser(jr.user),
        };
      },
    },

    files: {
      async listByWorkspace(workspaceId) {
        const rows = await prisma.workspaceFile.findMany({
          where: { workspaceId },
          orderBy: [{ nodeType: 'desc' }, { name: 'asc' }],
        });
        return rows.map(mapFile);
      },

      async findById(workspaceId, fileId) {
        const row = await prisma.workspaceFile.findFirst({
          where: { workspaceId, id: fileId },
        });
        return row ? mapFile(row) : null;
      },

      async create(input) {
        if (input.parentId === null) {
          const existing = await prisma.workspaceFile.findFirst({
            where: { workspaceId: input.workspaceId, parentId: null, name: input.name },
          });
          if (existing) {
            throw new ConflictError(
              `A file or folder named "${input.name}" already exists in this folder`,
              'FILE_EXISTS',
            );
          }
        }
        try {
          const row = await prisma.workspaceFile.create({
            data: {
              id: input.id,
              workspaceId: input.workspaceId,
              parentId: input.parentId,
              name: input.name,
              nodeType: input.nodeType,
              language: input.language,
              contentSnapshot: input.contentSnapshot,
              createdById: input.createdById,
            },
          });
          return mapFile(row);
        } catch (err) {
          if (isUniqueViolation(err)) {
            throw new ConflictError(
              `A file or folder named "${input.name}" already exists in this folder`,
              'FILE_EXISTS',
            );
          }
          throw err;
        }
      },

      async update(workspaceId, fileId, input) {
        const existing = await prisma.workspaceFile.findFirst({
          where: { workspaceId, id: fileId },
        });
        if (!existing) throw new NotFoundError('File or folder not found');
        try {
          const updated = await prisma.workspaceFile.update({
            where: { id: fileId },
            data: {
              name: input.name,
              parentId: input.parentId,
              language: input.language,
            },
          });
          return mapFile(updated);
        } catch (err) {
          if (isUniqueViolation(err)) {
            throw new ConflictError(
              'A file or folder with that name already exists in the destination',
              'FILE_EXISTS',
            );
          }
          throw err;
        }
      },

      async updateSnapshot(fileId, contentSnapshot) {
        await prisma.workspaceFile.update({
          where: { id: fileId },
          data: { contentSnapshot },
        });
      },

      async deleteSubtree(workspaceId, nodeId) {
        const all = await prisma.workspaceFile.findMany({
          where: { workspaceId },
          select: { id: true, parentId: true },
        });
        if (!all.some((n) => n.id === nodeId)) return [];
        const deletedIds: string[] = [];
        const queue = [nodeId];
        while (queue.length > 0) {
          const curr = queue.shift()!;
          deletedIds.push(curr);
          for (const child of all) {
            if (child.parentId === curr) queue.push(child.id);
          }
        }
        await prisma.workspaceFile.delete({ where: { id: nodeId } });
        return deletedIds;
      },
    },

    changeRequests: {
      async create(input) {
        const cr = await prisma.fileChangeRequest.create({
          data: {
            id: input.id,
            workspaceId: input.workspaceId,
            fileId: input.fileId,
            authorId: input.authorId,
            previousContent: input.previousContent,
            proposedContent: input.proposedContent,
            summary: input.summary,
          },
          include: { file: true, author: true },
        });
        return {
          id: cr.id,
          workspaceId: cr.workspaceId,
          fileId: cr.fileId,
          fileName: cr.file.name,
          authorId: cr.authorId,
          authorName: cr.author.displayName,
          previousContent: cr.previousContent,
          proposedContent: cr.proposedContent,
          summary: cr.summary,
          status: cr.status as ApprovalStatus,
          createdAt: cr.createdAt.toISOString(),
          decidedAt: cr.decidedAt ? cr.decidedAt.toISOString() : null,
        } satisfies FileChangeRequestDto;
      },

      async findById(id) {
        const cr = await prisma.fileChangeRequest.findUnique({
          where: { id },
          include: { file: true, author: true },
        });
        if (!cr) return null;
        return {
          id: cr.id,
          workspaceId: cr.workspaceId,
          fileId: cr.fileId,
          fileName: cr.file.name,
          authorId: cr.authorId,
          authorName: cr.author.displayName,
          previousContent: cr.previousContent,
          proposedContent: cr.proposedContent,
          summary: cr.summary,
          status: cr.status as ApprovalStatus,
          createdAt: cr.createdAt.toISOString(),
          decidedAt: cr.decidedAt ? cr.decidedAt.toISOString() : null,
        };
      },

      async listPendingForWorkspace(workspaceId) {
        const rows = await prisma.fileChangeRequest.findMany({
          where: { workspaceId, status: 'PENDING' },
          include: { file: true, author: true },
          orderBy: { createdAt: 'asc' },
        });
        return rows.map((cr): FileChangeRequestDto => ({
          id: cr.id,
          workspaceId: cr.workspaceId,
          fileId: cr.fileId,
          fileName: cr.file.name,
          authorId: cr.authorId,
          authorName: cr.author.displayName,
          previousContent: cr.previousContent,
          proposedContent: cr.proposedContent,
          summary: cr.summary,
          status: cr.status as ApprovalStatus,
          createdAt: cr.createdAt.toISOString(),
          decidedAt: cr.decidedAt ? cr.decidedAt.toISOString() : null,
        }));
      },

      async decide(input) {
        const cr = await prisma.fileChangeRequest.update({
          where: { id: input.id },
          data: { status: input.status, decidedAt: new Date() },
          include: { file: true, author: true },
        });
        return {
          id: cr.id,
          workspaceId: cr.workspaceId,
          fileId: cr.fileId,
          fileName: cr.file.name,
          authorId: cr.authorId,
          authorName: cr.author.displayName,
          previousContent: cr.previousContent,
          proposedContent: cr.proposedContent,
          summary: cr.summary,
          status: cr.status as ApprovalStatus,
          createdAt: cr.createdAt.toISOString(),
          decidedAt: cr.decidedAt ? cr.decidedAt.toISOString() : null,
        };
      },
    },

    versions: {
      async create(input) {
        const latest = await prisma.fileVersion.findFirst({
          where: { fileId: input.fileId },
          orderBy: { versionNumber: 'desc' },
          select: { versionNumber: true },
        });
        const versionNumber = (latest?.versionNumber ?? 0) + 1;

        const v = await prisma.fileVersion.create({
          data: {
            id: input.id,
            workspaceId: input.workspaceId,
            fileId: input.fileId,
            versionNumber,
            content: input.content,
            summary: input.summary,
            authorId: input.authorId,
            approvedById: input.approvedById,
          },
          include: { author: true, approvedBy: true },
        });
        return {
          id: v.id,
          workspaceId: v.workspaceId,
          fileId: v.fileId,
          versionNumber: v.versionNumber,
          content: v.content,
          summary: v.summary,
          authorId: v.authorId,
          authorName: v.author.displayName,
          approvedById: v.approvedById,
          approvedByName: v.approvedBy.displayName,
          createdAt: v.createdAt.toISOString(),
        } satisfies FileVersionDto;
      },

      async listByFile(workspaceId, fileId) {
        const rows = await prisma.fileVersion.findMany({
          where: { workspaceId, fileId },
          include: { author: true, approvedBy: true },
          orderBy: { versionNumber: 'desc' },
        });
        return rows.map((v): FileVersionDto => ({
          id: v.id,
          workspaceId: v.workspaceId,
          fileId: v.fileId,
          versionNumber: v.versionNumber,
          content: v.content,
          summary: v.summary,
          authorId: v.authorId,
          authorName: v.author.displayName,
          approvedById: v.approvedById,
          approvedByName: v.approvedBy.displayName,
          createdAt: v.createdAt.toISOString(),
        }));
      },

      async findById(workspaceId, versionId) {
        const v = await prisma.fileVersion.findFirst({
          where: { workspaceId, id: versionId },
          include: { author: true, approvedBy: true },
        });
        if (!v) return null;
        return {
          id: v.id,
          workspaceId: v.workspaceId,
          fileId: v.fileId,
          versionNumber: v.versionNumber,
          content: v.content,
          summary: v.summary,
          authorId: v.authorId,
          authorName: v.author.displayName,
          approvedById: v.approvedById,
          approvedByName: v.approvedBy.displayName,
          createdAt: v.createdAt.toISOString(),
        };
      },
    },

    collab: {
      async findByDocName(docName) {
        const doc = await prisma.collabDocument.findUnique({ where: { docName } });
        if (!doc) return null;
        return {
          id: doc.id,
          docName: doc.docName,
          workspaceId: doc.workspaceId,
          fileId: doc.fileId,
          state: new Uint8Array(doc.state),
          updatedAt: doc.updatedAt.toISOString(),
        };
      },

      async upsertDocument(input) {
        await prisma.collabDocument.upsert({
          where: { docName: input.docName },
          create: {
            id: input.id,
            docName: input.docName,
            workspaceId: input.workspaceId,
            fileId: input.fileId,
            state: Buffer.from(input.state),
          },
          update: {
            state: Buffer.from(input.state),
          },
        });
      },
    },

    executions: {
      async create(input) {
        const rec = await prisma.executionRecord.create({
          data: {
            id: input.id,
            workspaceId: input.workspaceId,
            fileId: input.fileId,
            userId: input.userId,
            language: input.language,
            provider: input.provider,
            status: input.status,
            exitCode: input.exitCode,
            stdout: input.stdout,
            stderr: input.stderr,
            durationMs: input.durationMs,
            startedAt: input.startedAt,
            finishedAt: input.finishedAt,
          },
        });
        return {
          id: rec.id,
          workspaceId: rec.workspaceId,
          fileId: rec.fileId,
          userId: rec.userId,
          language: rec.language,
          provider: rec.provider,
          status: rec.status as ExecutionStatus,
          exitCode: rec.exitCode,
          stdout: rec.stdout,
          stderr: rec.stderr,
          durationMs: rec.durationMs,
          startedAt: rec.startedAt.toISOString(),
          finishedAt: rec.finishedAt.toISOString(),
        };
      },

      async listByWorkspace(workspaceId, limit = 25) {
        const rows = await prisma.executionRecord.findMany({
          where: { workspaceId },
          orderBy: { startedAt: 'desc' },
          take: limit,
        });
        return rows.map((rec) => ({
          id: rec.id,
          workspaceId: rec.workspaceId,
          fileId: rec.fileId,
          userId: rec.userId,
          language: rec.language,
          provider: rec.provider,
          status: rec.status as ExecutionStatus,
          exitCode: rec.exitCode,
          stdout: rec.stdout,
          stderr: rec.stderr,
          durationMs: rec.durationMs,
          startedAt: rec.startedAt.toISOString(),
          finishedAt: rec.finishedAt.toISOString(),
        }));
      },
    },

    audit: {
      async log(input) {
        await prisma.auditLog.create({
          data: {
            id: input.id,
            workspaceId: input.workspaceId,
            userId: input.userId,
            action: input.action,
            resourceType: input.resourceType,
            resourceId: input.resourceId,
            metadata: JSON.stringify(input.metadata ?? {}),
          },
        });
      },
    },

    async close() {
      await prisma.$disconnect();
    },
  };
}
