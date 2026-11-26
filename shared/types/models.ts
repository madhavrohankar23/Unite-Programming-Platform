import type { WorkspaceCategory } from '../constants/languages.js';
import type { WorkspaceRole } from '../constants/roles.js';

export type FileNodeType = 'FILE' | 'FOLDER';

export type ExecutionStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'COMPILE_ERROR'
  | 'RUNTIME_ERROR'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'UNAVAILABLE';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type JoinRequestStatus = ApprovalStatus;
export type ChangeRequestStatus = ApprovalStatus;

export interface UserProfileDto {
  id: string;
  authUserId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface WorkspaceMemberDto {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
  user: UserProfileDto;
}

export interface WorkspaceInvitationDto {
  id: string;
  workspaceId: string;
  codePrefix: string;
  role: WorkspaceRole;
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
  createdById: string;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreatedInvitationDto extends WorkspaceInvitationDto {
  token: string;
  joinCode: string;
}

export interface WorkspaceFileDto {
  id: string;
  workspaceId: string;
  parentId: string | null;
  name: string;
  nodeType: FileNodeType;
  language: string;
  contentSnapshot: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceJoinRequestDto {
  id: string;
  workspaceId: string;
  workspaceName: string;
  userId: string;
  status: JoinRequestStatus;
  assignedRole: WorkspaceRole | null;
  createdAt: string;
  decidedAt: string | null;
  user: UserProfileDto;
}

export interface FileChangeRequestDto {
  id: string;
  workspaceId: string;
  fileId: string;
  fileName: string;
  authorId: string;
  authorName: string;
  previousContent: string;
  proposedContent: string;
  summary: string;
  status: ChangeRequestStatus;
  createdAt: string;
  decidedAt: string | null;
}

export interface FileVersionDto {
  id: string;
  workspaceId: string;
  fileId: string;
  versionNumber: number;
  content: string;
  summary: string;
  authorId: string;
  authorName: string;
  approvedById: string;
  approvedByName: string;
  createdAt: string;
}

export interface WorkspaceDto {
  id: string;
  name: string;
  ownerId: string;
  joinCode: string;
  category: WorkspaceCategory;
  defaultLanguage: string;
  liveServerEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  currentUserRole: WorkspaceRole;
  members: WorkspaceMemberDto[];
  files: WorkspaceFileDto[];
}

export interface WorkspaceSummaryDto {
  id: string;
  name: string;
  ownerId: string;
  joinCode: string;
  category: WorkspaceCategory;
  defaultLanguage: string;
  liveServerEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  currentUserRole: WorkspaceRole;
  memberCount: number;
  fileCount: number;
}

export interface ExecutionResultDto {
  id: string;
  workspaceId: string;
  fileId: string | null;
  language: string;
  provider: string;
  status: ExecutionStatus;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  compileOutput?: string;
  durationMs: number;
  truncated: boolean;
  startedAt: string;
  finishedAt: string;
}

export type WorkspaceEventPayload =
  | { type: 'file:created'; workspaceId: string; file: WorkspaceFileDto; actorId: string }
  | { type: 'file:updated'; workspaceId: string; file: WorkspaceFileDto; actorId: string }
  | { type: 'file:deleted'; workspaceId: string; deletedIds: string[]; actorId: string }
  | { type: 'member:joined'; workspaceId: string; member: WorkspaceMemberDto }
  | { type: 'member:updated'; workspaceId: string; member: WorkspaceMemberDto }
  | { type: 'member:removed'; workspaceId: string; userId: string }
  | { type: 'workspace:updated'; workspaceId: string; name: string }
  | { type: 'workspace:deleted'; workspaceId: string }
  | { type: 'join:requested'; workspaceId: string; request: WorkspaceJoinRequestDto }
  | { type: 'join:decided'; workspaceId: string; request: WorkspaceJoinRequestDto }
  | { type: 'change:requested'; workspaceId: string; changeRequest: FileChangeRequestDto }
  | { type: 'change:decided'; workspaceId: string; changeRequest: FileChangeRequestDto }
  | { type: 'version:created'; workspaceId: string; version: FileVersionDto }
  | { type: 'chat:message'; workspaceId: string; id: string; userId: string; displayName: string; text: string; sentAt: string };

export function buildCollabDocName(workspaceId: string, fileId: string): string {
  return `workspace:${workspaceId}:file:${fileId}`;
}

export function parseCollabDocName(
  docName: string,
): { workspaceId: string; fileId: string } | null {
  const match = /^workspace:([a-zA-Z0-9_-]+):file:([a-zA-Z0-9_-]+)$/.exec(docName);
  if (!match || !match[1] || !match[2]) {
    return null;
  }
  return { workspaceId: match[1], fileId: match[2] };
}
