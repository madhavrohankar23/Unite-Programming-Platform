import type { WorkspaceCategory } from '../../../shared/constants/languages.js';
import type { WorkspaceRole } from '../../../shared/constants/roles.js';
import type {
  ApprovalStatus,
  ExecutionStatus,
  FileChangeRequestDto,
  FileNodeType,
  FileVersionDto,
  UserProfileDto,
  WorkspaceFileDto,
  WorkspaceInvitationDto,
  WorkspaceJoinRequestDto,
  WorkspaceMemberDto,
  WorkspaceSummaryDto,
} from '../../../shared/types/models.js';

export type { ApprovalStatus };

export interface InternalUserRecord extends UserProfileDto {
  passwordHash: string | null;
}

export interface WorkspaceEntity {
  id: string;
  name: string;
  ownerId: string;
  joinCode: string;
  category: WorkspaceCategory;
  defaultLanguage: string;
  liveServerEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InvitationWithWorkspace extends WorkspaceInvitationDto {
  tokenHash: string;
}

export interface CollabDocRecord {
  id: string;
  docName: string;
  workspaceId: string;
  fileId: string;
  state: Uint8Array;
  updatedAt: string;
}

export interface ExecutionRecordRow {
  id: string;
  workspaceId: string;
  fileId: string | null;
  userId: string;
  language: string;
  provider: string;
  status: ExecutionStatus;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  startedAt: string;
  finishedAt: string;
}

export interface DatabaseRepositories {
  users: {
    findById(id: string): Promise<InternalUserRecord | null>;
    findByAuthUserId(authUserId: string): Promise<InternalUserRecord | null>;
    findByEmail(email: string): Promise<InternalUserRecord | null>;
    create(input: {
      id: string;
      authUserId: string;
      email: string;
      displayName: string;
      avatarUrl?: string | null;
      passwordHash?: string | null;
    }): Promise<InternalUserRecord>;
    upsertByAuthUser(input: {
      id: string;
      authUserId: string;
      email: string;
      displayName: string;
      avatarUrl?: string | null;
    }): Promise<InternalUserRecord>;
    updateProfile(
      id: string,
      input: { displayName?: string; avatarUrl?: string | null },
    ): Promise<InternalUserRecord>;
  };

  workspaces: {
    createWithOwnerAndFiles(input: {
      workspace: {
        id: string;
        name: string;
        ownerId: string;
        joinCode: string;
        category: WorkspaceCategory;
        defaultLanguage: string;
        liveServerEnabled: boolean;
      };
      ownerMemberId: string;
      initialFiles: Array<{
        id: string;
        parentId: string | null;
        name: string;
        nodeType: FileNodeType;
        language: string;
        contentSnapshot: string | null;
      }>;
    }): Promise<WorkspaceEntity>;
    findById(id: string): Promise<WorkspaceEntity | null>;
    findByJoinCode(joinCode: string): Promise<WorkspaceEntity | null>;
    listForUser(userId: string): Promise<WorkspaceSummaryDto[]>;
    update(
      id: string,
      input: { name?: string; defaultLanguage?: string; liveServerEnabled?: boolean },
    ): Promise<WorkspaceEntity>;
    delete(id: string): Promise<void>;
    findMember(workspaceId: string, userId: string): Promise<WorkspaceMemberDto | null>;
    listMembers(workspaceId: string): Promise<WorkspaceMemberDto[]>;
    addMember(input: {
      id: string;
      workspaceId: string;
      userId: string;
      role: WorkspaceRole;
    }): Promise<WorkspaceMemberDto>;
    updateMemberRole(
      workspaceId: string,
      userId: string,
      role: WorkspaceRole,
    ): Promise<WorkspaceMemberDto>;
    removeMember(workspaceId: string, userId: string): Promise<void>;
    createInvitation(input: {
      id: string;
      workspaceId: string;
      tokenHash: string;
      codePrefix: string;
      role: WorkspaceRole;
      expiresAt: Date | null;
      maxUses: number | null;
      createdById: string;
    }): Promise<WorkspaceInvitationDto>;
    listInvitations(workspaceId: string): Promise<WorkspaceInvitationDto[]>;
    findInvitationByTokenHash(tokenHash: string): Promise<InvitationWithWorkspace | null>;
    findInvitationById(id: string): Promise<WorkspaceInvitationDto | null>;
    incrementInvitationUse(id: string): Promise<void>;
    revokeInvitation(id: string): Promise<void>;
  };

  joinRequests: {
    create(input: {
      id: string;
      workspaceId: string;
      userId: string;
    }): Promise<WorkspaceJoinRequestDto>;
    findById(id: string): Promise<WorkspaceJoinRequestDto | null>;
    findPendingForUser(workspaceId: string, userId: string): Promise<WorkspaceJoinRequestDto | null>;
    listPendingForWorkspace(workspaceId: string): Promise<WorkspaceJoinRequestDto[]>;
    decide(input: {
      id: string;
      status: 'APPROVED' | 'REJECTED';
      assignedRole: WorkspaceRole | null;
    }): Promise<WorkspaceJoinRequestDto>;
  };

  files: {
    listByWorkspace(workspaceId: string): Promise<WorkspaceFileDto[]>;
    findById(workspaceId: string, fileId: string): Promise<WorkspaceFileDto | null>;
    create(input: {
      id: string;
      workspaceId: string;
      parentId: string | null;
      name: string;
      nodeType: FileNodeType;
      language: string;
      contentSnapshot: string | null;
      createdById: string;
    }): Promise<WorkspaceFileDto>;
    update(
      workspaceId: string,
      fileId: string,
      input: { name?: string; parentId?: string | null; language?: string },
    ): Promise<WorkspaceFileDto>;
    updateSnapshot(fileId: string, contentSnapshot: string): Promise<void>;
    deleteSubtree(workspaceId: string, nodeId: string): Promise<string[]>;
  };

  changeRequests: {
    create(input: {
      id: string;
      workspaceId: string;
      fileId: string;
      authorId: string;
      previousContent: string;
      proposedContent: string;
      summary: string;
    }): Promise<FileChangeRequestDto>;
    findById(id: string): Promise<FileChangeRequestDto | null>;
    listPendingForWorkspace(workspaceId: string): Promise<FileChangeRequestDto[]>;
    decide(input: {
      id: string;
      status: 'APPROVED' | 'REJECTED';
    }): Promise<FileChangeRequestDto>;
  };

  versions: {
    create(input: {
      id: string;
      workspaceId: string;
      fileId: string;
      content: string;
      summary: string;
      authorId: string;
      approvedById: string;
    }): Promise<FileVersionDto>;
    listByFile(workspaceId: string, fileId: string): Promise<FileVersionDto[]>;
    findById(workspaceId: string, versionId: string): Promise<FileVersionDto | null>;
  };

  collab: {
    findByDocName(docName: string): Promise<CollabDocRecord | null>;
    upsertDocument(input: {
      id: string;
      docName: string;
      workspaceId: string;
      fileId: string;
      state: Uint8Array;
    }): Promise<void>;
  };

  executions: {
    create(input: {
      id: string;
      workspaceId: string;
      fileId: string | null;
      userId: string;
      language: string;
      provider: string;
      status: ExecutionStatus;
      exitCode: number | null;
      stdout: string;
      stderr: string;
      durationMs: number;
      startedAt: Date;
      finishedAt: Date;
    }): Promise<ExecutionRecordRow>;
    listByWorkspace(workspaceId: string, limit?: number): Promise<ExecutionRecordRow[]>;
  };

  audit: {
    log(input: {
      id: string;
      workspaceId: string | null;
      userId: string;
      action: string;
      resourceType: string;
      resourceId: string;
      metadata?: Record<string, unknown>;
    }): Promise<void>;
  };

  close(): Promise<void>;
}
