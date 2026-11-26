import { detectLanguageFromFileName } from '../../../shared/constants/languages.js';
import type { WorkspaceRole } from '../../../shared/constants/roles.js';
import type {
  FileChangeRequestDto,
  FileNodeType,
  FileVersionDto,
  UserProfileDto,
  WorkspaceFileDto,
} from '../../../shared/types/models.js';
import type { CollaborationServer } from '../collaboration/collabServer.js';
import type { WorkspaceEventHub } from '../collaboration/workspaceEventHub.js';
import type { DatabaseRepositories } from '../database/types.js';
import { assertNoCircularParent, sanitizeNodeName } from '../security/paths.js';
import { generateSecureId } from '../security/tokens.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

export class FileService {
  constructor(
    private readonly db: DatabaseRepositories,
    private readonly eventHub?: WorkspaceEventHub,
    private readonly collabServer?: CollaborationServer,
  ) {}

  public async listFiles(workspaceId: string): Promise<WorkspaceFileDto[]> {
    return this.db.files.listByWorkspace(workspaceId);
  }

  public async createNode(
    workspaceId: string,
    actor: UserProfileDto,
    input: {
      parentId: string | null;
      name: string;
      nodeType: FileNodeType;
      language?: string;
      initialContent?: string;
    },
  ): Promise<WorkspaceFileDto> {
    const cleanName = sanitizeNodeName(input.name);

    if (input.parentId) {
      const parent = await this.db.files.findById(workspaceId, input.parentId);
      if (!parent) {
        throw new NotFoundError('Parent folder not found', 'PARENT_NOT_FOUND');
      }
      if (parent.nodeType !== 'FOLDER') {
        throw new BadRequestError('Parent node must be a folder', 'PARENT_NOT_FOLDER');
      }
    }

    const detected =
      input.nodeType === 'FILE'
        ? input.language ?? detectLanguageFromFileName(cleanName).id
        : 'plaintext';

    const created = await this.db.files.create({
      id: generateSecureId(input.nodeType === 'FOLDER' ? 'fld' : 'fil'),
      workspaceId,
      parentId: input.parentId,
      name: cleanName,
      nodeType: input.nodeType,
      language: detected,
      contentSnapshot: input.nodeType === 'FILE' ? (input.initialContent ?? '') : null,
      createdById: actor.id,
    });

    await this.db.audit.log({
      id: generateSecureId('aud'),
      workspaceId,
      userId: actor.id,
      action: input.nodeType === 'FOLDER' ? 'FOLDER_CREATED' : 'FILE_CREATED',
      resourceType: 'file',
      resourceId: created.id,
      metadata: { name: created.name, parentId: created.parentId },
    });

    this.eventHub?.broadcast(workspaceId, {
      type: 'file:created',
      workspaceId,
      file: created,
      actorId: actor.id,
    });

    return created;
  }

  public async updateNode(
    workspaceId: string,
    fileId: string,
    actor: UserProfileDto,
    input: { name?: string; parentId?: string | null; language?: string },
  ): Promise<WorkspaceFileDto> {
    const existing = await this.db.files.findById(workspaceId, fileId);
    if (!existing) {
      throw new NotFoundError('File or folder not found', 'FILE_NOT_FOUND');
    }

    const cleanName = input.name !== undefined ? sanitizeNodeName(input.name) : undefined;

    if (input.parentId !== undefined && input.parentId !== null) {
      const targetParent = await this.db.files.findById(workspaceId, input.parentId);
      if (!targetParent || targetParent.nodeType !== 'FOLDER') {
        throw new BadRequestError('Destination parent must be an existing folder', 'INVALID_PARENT');
      }
      const all = await this.db.files.listByWorkspace(workspaceId);
      const lookup = new Map(all.map((f) => [f.id, f.parentId]));
      assertNoCircularParent(fileId, input.parentId, lookup);
    }

    let nextLanguage = input.language;
    if (
      nextLanguage === undefined &&
      cleanName !== undefined &&
      existing.nodeType === 'FILE'
    ) {
      nextLanguage = detectLanguageFromFileName(cleanName).id;
    }

    const updated = await this.db.files.update(workspaceId, fileId, {
      name: cleanName,
      parentId: input.parentId,
      language: nextLanguage,
    });

    this.eventHub?.broadcast(workspaceId, {
      type: 'file:updated',
      workspaceId,
      file: updated,
      actorId: actor.id,
    });

    return updated;
  }

  public async deleteNode(
    workspaceId: string,
    fileId: string,
    actor: UserProfileDto,
  ): Promise<string[]> {
    const existing = await this.db.files.findById(workspaceId, fileId);
    if (!existing) {
      throw new NotFoundError('File or folder not found', 'FILE_NOT_FOUND');
    }
    const deletedIds = await this.db.files.deleteSubtree(workspaceId, fileId);

    await this.db.audit.log({
      id: generateSecureId('aud'),
      workspaceId,
      userId: actor.id,
      action: existing.nodeType === 'FOLDER' ? 'FOLDER_DELETED' : 'FILE_DELETED',
      resourceType: 'file',
      resourceId: fileId,
      metadata: { name: existing.name, deletedCount: deletedIds.length },
    });

    this.eventHub?.broadcast(workspaceId, {
      type: 'file:deleted',
      workspaceId,
      deletedIds,
      actorId: actor.id,
    });

    return deletedIds;
  }

  /**
   * When an OWNER saves: immediately creates a Version History milestone and persists snapshot.
   * When an EDITOR saves: creates a FileChangeRequest and sends a live approval popup to the workspace Admin/Host.
   */
  public async submitSave(
    workspaceId: string,
    fileId: string,
    actor: UserProfileDto,
    actorRole: WorkspaceRole,
    input: { content: string; summary: string },
  ): Promise<
    | { mode: 'SAVED'; version: FileVersionDto }
    | { mode: 'PENDING_APPROVAL'; changeRequest: FileChangeRequestDto }
  > {
    const file = await this.db.files.findById(workspaceId, fileId);
    if (!file || file.nodeType !== 'FILE') {
      throw new NotFoundError('File not found', 'FILE_NOT_FOUND');
    }

    if (actorRole === 'OWNER') {
      await this.db.files.updateSnapshot(fileId, input.content);
      await this.collabServer?.replaceDocumentContent(workspaceId, fileId, input.content);
      const version = await this.db.versions.create({
        id: generateSecureId('ver'),
        workspaceId,
        fileId,
        content: input.content,
        summary: input.summary || `Saved by ${actor.displayName}`,
        authorId: actor.id,
        approvedById: actor.id,
      });

      this.eventHub?.broadcast(workspaceId, {
        type: 'version:created',
        workspaceId,
        version,
      });

      return { mode: 'SAVED', version };
    }

    const changeRequest = await this.db.changeRequests.create({
      id: generateSecureId('creq'),
      workspaceId,
      fileId,
      authorId: actor.id,
      previousContent: file.contentSnapshot ?? '',
      proposedContent: input.content,
      summary: input.summary || `Changes by ${actor.displayName}`,
    });

    await this.db.audit.log({
      id: generateSecureId('aud'),
      workspaceId,
      userId: actor.id,
      action: 'CHANGE_REQUEST_CREATED',
      resourceType: 'change_request',
      resourceId: changeRequest.id,
      metadata: { fileId, fileName: file.name },
    });

    const workspace = await this.db.workspaces.findById(workspaceId);
    const payload = {
      type: 'change:requested' as const,
      workspaceId,
      changeRequest,
    };
    this.eventHub?.broadcast(workspaceId, payload);
    if (workspace) {
      this.eventHub?.sendToUser(workspace.ownerId, payload);
    }

    return { mode: 'PENDING_APPROVAL', changeRequest };
  }

  public async listPendingChangeRequests(workspaceId: string): Promise<FileChangeRequestDto[]> {
    return this.db.changeRequests.listPendingForWorkspace(workspaceId);
  }

  public async decideChangeRequest(
    workspaceId: string,
    requestId: string,
    actor: UserProfileDto,
    decision: 'APPROVE' | 'REJECT',
  ): Promise<{ changeRequest: FileChangeRequestDto; version?: FileVersionDto }> {
    const existing = await this.db.changeRequests.findById(requestId);
    if (!existing || existing.workspaceId !== workspaceId) {
      throw new NotFoundError('Change request not found');
    }
    if (existing.status !== 'PENDING') {
      throw new BadRequestError('This change request has already been decided');
    }

    const status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const updated = await this.db.changeRequests.decide({ id: requestId, status });

    let version: FileVersionDto | undefined;
    if (decision === 'APPROVE') {
      await this.db.files.updateSnapshot(existing.fileId, existing.proposedContent);
      await this.collabServer?.replaceDocumentContent(
        workspaceId,
        existing.fileId,
        existing.proposedContent,
      );

      version = await this.db.versions.create({
        id: generateSecureId('ver'),
        workspaceId,
        fileId: existing.fileId,
        content: existing.proposedContent,
        summary: `${existing.summary} (Approved from ${existing.authorName})`,
        authorId: existing.authorId,
        approvedById: actor.id,
      });

      this.eventHub?.broadcast(workspaceId, {
        type: 'version:created',
        workspaceId,
        version,
      });
    }

    await this.db.audit.log({
      id: generateSecureId('aud'),
      workspaceId,
      userId: actor.id,
      action: decision === 'APPROVE' ? 'CHANGE_REQUEST_APPROVED' : 'CHANGE_REQUEST_REJECTED',
      resourceType: 'change_request',
      resourceId: requestId,
      metadata: { authorId: existing.authorId, fileId: existing.fileId },
    });

    const decidedPayload = {
      type: 'change:decided' as const,
      workspaceId,
      changeRequest: updated,
    };
    this.eventHub?.broadcast(workspaceId, decidedPayload);
    this.eventHub?.sendToUser(existing.authorId, decidedPayload);

    return { changeRequest: updated, version };
  }

  public async listFileVersions(workspaceId: string, fileId: string): Promise<FileVersionDto[]> {
    return this.db.versions.listByFile(workspaceId, fileId);
  }

  public async restoreFileVersion(
    workspaceId: string,
    fileId: string,
    versionId: string,
    actor: UserProfileDto,
  ): Promise<FileVersionDto> {
    const version = await this.db.versions.findById(workspaceId, versionId);
    if (!version || version.fileId !== fileId) {
      throw new NotFoundError('File version not found');
    }

    await this.db.files.updateSnapshot(fileId, version.content);
    await this.collabServer?.replaceDocumentContent(workspaceId, fileId, version.content);

    const restored = await this.db.versions.create({
      id: generateSecureId('ver'),
      workspaceId,
      fileId,
      content: version.content,
      summary: `Restored v${version.versionNumber}`,
      authorId: actor.id,
      approvedById: actor.id,
    });

    this.eventHub?.broadcast(workspaceId, {
      type: 'version:created',
      workspaceId,
      version: restored,
    });

    return restored;
  }
}
