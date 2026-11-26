import type { WorkspaceCategory } from '../../../shared/constants/languages.js';
import type { WorkspaceRole } from '../../../shared/constants/roles.js';
import type {
  CreatedInvitationDto,
  UserProfileDto,
  WorkspaceDto,
  WorkspaceInvitationDto,
  WorkspaceJoinRequestDto,
  WorkspaceMemberDto,
  WorkspaceSummaryDto,
} from '../../../shared/types/models.js';
import type { WorkspaceEventHub } from '../collaboration/workspaceEventHub.js';
import type { DatabaseRepositories } from '../database/types.js';
import {
  extractTokenFromInviteInput,
  generateInvitationToken,
  generateSecureId,
  generateSixDigitJoinCode,
  hashToken,
} from '../security/tokens.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import {
  buildWorkspaceFilesForSelection,
  type WorkspaceTemplateId,
} from './templates.js';

export class WorkspaceService {
  constructor(
    private readonly db: DatabaseRepositories,
    private readonly eventHub?: WorkspaceEventHub,
  ) {}

  private async allocateUniqueJoinCode(): Promise<string> {
    for (let i = 0; i < 15; i += 1) {
      const candidate = generateSixDigitJoinCode();
      const existing = await this.db.workspaces.findByJoinCode(candidate);
      if (!existing) return candidate;
    }
    throw new Error('Unable to allocate unique 6-digit workspace code');
  }

  public async createWorkspace(
    user: UserProfileDto,
    input: {
      name: string;
      category?: WorkspaceCategory;
      defaultLanguage: string;
      stack?: string;
      liveServerEnabled?: boolean;
      template?: WorkspaceTemplateId;
    },
  ): Promise<{ workspace: WorkspaceDto; initialInvitation: CreatedInvitationDto }> {
    const workspaceId = generateSecureId('ws');
    const joinCode = await this.allocateUniqueJoinCode();
    const category: WorkspaceCategory = input.category ?? 'programming';
    const liveServerEnabled =
      input.liveServerEnabled ?? category === 'development';

    const initialFiles = buildWorkspaceFilesForSelection({
      category,
      defaultLanguage: input.defaultLanguage,
      stack: input.stack,
      template: input.template,
    });

    const created = await this.db.workspaces.createWithOwnerAndFiles({
      workspace: {
        id: workspaceId,
        name: input.name.trim(),
        ownerId: user.id,
        joinCode,
        category,
        defaultLanguage: input.defaultLanguage,
        liveServerEnabled,
      },
      ownerMemberId: generateSecureId('mem'),
      initialFiles,
    });

    const initialInvitation = await this.createInvitation(workspaceId, user, {
      role: 'EDITOR',
      expiresInHours: 72,
      maxUses: null,
    });

    await this.db.audit.log({
      id: generateSecureId('aud'),
      workspaceId,
      userId: user.id,
      action: 'WORKSPACE_CREATED',
      resourceType: 'workspace',
      resourceId: workspaceId,
      metadata: {
        name: created.name,
        category,
        stack: input.stack,
        defaultLanguage: input.defaultLanguage,
        liveServerEnabled,
      },
    });

    const members = await this.db.workspaces.listMembers(workspaceId);
    const files = await this.db.files.listByWorkspace(workspaceId);

    return {
      workspace: {
        ...created,
        currentUserRole: 'OWNER',
        members,
        files,
      },
      initialInvitation,
    };
  }

  public async listForUser(userId: string): Promise<WorkspaceSummaryDto[]> {
    return this.db.workspaces.listForUser(userId);
  }

  public async getWorkspaceDetails(
    workspaceId: string,
    member: WorkspaceMemberDto,
  ): Promise<WorkspaceDto> {
    const workspace = await this.db.workspaces.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundError('Workspace not found', 'WORKSPACE_NOT_FOUND');
    }
    const [members, files] = await Promise.all([
      this.db.workspaces.listMembers(workspaceId),
      this.db.files.listByWorkspace(workspaceId),
    ]);
    return {
      ...workspace,
      currentUserRole: member.role,
      members,
      files,
    };
  }

  public async updateWorkspace(
    workspaceId: string,
    actor: UserProfileDto,
    input: { name?: string; defaultLanguage?: string; liveServerEnabled?: boolean },
  ) {
    const updated = await this.db.workspaces.update(workspaceId, {
      name: input.name?.trim(),
      defaultLanguage: input.defaultLanguage,
      liveServerEnabled: input.liveServerEnabled,
    });
    await this.db.audit.log({
      id: generateSecureId('aud'),
      workspaceId,
      userId: actor.id,
      action: 'WORKSPACE_UPDATED',
      resourceType: 'workspace',
      resourceId: workspaceId,
      metadata: input,
    });
    if (input.name) {
      this.eventHub?.broadcast(workspaceId, {
        type: 'workspace:updated',
        workspaceId,
        name: updated.name,
      });
    }
    return updated;
  }

  public async deleteWorkspace(workspaceId: string, actor: UserProfileDto): Promise<void> {
    this.eventHub?.broadcast(workspaceId, {
      type: 'workspace:deleted',
      workspaceId,
    });
    await this.db.audit.log({
      id: generateSecureId('aud'),
      workspaceId: null,
      userId: actor.id,
      action: 'WORKSPACE_DELETED',
      resourceType: 'workspace',
      resourceId: workspaceId,
    });
    await this.db.workspaces.delete(workspaceId);
  }

  /**
   * 6-digit workspace code join request -> requires host/admin approval to choose Edit or Read-Only role.
   */
  public async submitJoinRequest(
    user: UserProfileDto,
    joinCode: string,
  ): Promise<
    | { alreadyMember: true; workspace: WorkspaceDto }
    | { alreadyMember: false; request: WorkspaceJoinRequestDto }
  > {
    const workspace = await this.db.workspaces.findByJoinCode(joinCode);
    if (!workspace) {
      throw new NotFoundError('No workspace found for that 6-digit code', 'INVALID_JOIN_CODE');
    }

    const existingMember = await this.db.workspaces.findMember(workspace.id, user.id);
    if (existingMember) {
      const fullWs = await this.getWorkspaceDetails(workspace.id, existingMember);
      return { alreadyMember: true, workspace: fullWs };
    }

    let pending = await this.db.joinRequests.findPendingForUser(workspace.id, user.id);
    if (!pending) {
      pending = await this.db.joinRequests.create({
        id: generateSecureId('jreq'),
        workspaceId: workspace.id,
        userId: user.id,
      });
      await this.db.audit.log({
        id: generateSecureId('aud'),
        workspaceId: workspace.id,
        userId: user.id,
        action: 'JOIN_REQUEST_SUBMITTED',
        resourceType: 'join_request',
        resourceId: pending.id,
      });
    }

    const payload = {
      type: 'join:requested' as const,
      workspaceId: workspace.id,
      request: pending,
    };
    this.eventHub?.broadcast(workspace.id, payload);
    this.eventHub?.sendToUser(workspace.ownerId, payload);

    return { alreadyMember: false, request: pending };
  }

  public async getJoinRequestStatus(
    requestId: string,
    user: UserProfileDto,
  ): Promise<WorkspaceJoinRequestDto> {
    const req = await this.db.joinRequests.findById(requestId);
    if (!req) {
      throw new NotFoundError('Join request not found');
    }
    if (req.userId !== user.id) {
      const member = await this.db.workspaces.findMember(req.workspaceId, user.id);
      if (!member || member.role !== 'OWNER') {
        throw new ForbiddenError('Not authorized to view this join request');
      }
    }
    return req;
  }

  public async listPendingJoinRequests(workspaceId: string): Promise<WorkspaceJoinRequestDto[]> {
    return this.db.joinRequests.listPendingForWorkspace(workspaceId);
  }

  public async decideJoinRequest(
    workspaceId: string,
    requestId: string,
    actor: UserProfileDto,
    input: { decision: 'APPROVE' | 'REJECT'; role: 'EDITOR' | 'VIEWER' },
  ): Promise<WorkspaceJoinRequestDto> {
    const existing = await this.db.joinRequests.findById(requestId);
    if (!existing || existing.workspaceId !== workspaceId) {
      throw new NotFoundError('Join request not found');
    }
    if (existing.status !== 'PENDING') {
      throw new BadRequestError('This join request has already been decided', 'ALREADY_DECIDED');
    }

    const status = input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const assignedRole = input.decision === 'APPROVE' ? input.role : null;

    const updated = await this.db.joinRequests.decide({
      id: requestId,
      status,
      assignedRole,
    });

    if (input.decision === 'APPROVE' && assignedRole) {
      const already = await this.db.workspaces.findMember(workspaceId, existing.userId);
      const member =
        already ??
        (await this.db.workspaces.addMember({
          id: generateSecureId('mem'),
          workspaceId,
          userId: existing.userId,
          role: assignedRole,
        }));

      this.eventHub?.broadcast(workspaceId, {
        type: 'member:joined',
        workspaceId,
        member,
      });
    }

    await this.db.audit.log({
      id: generateSecureId('aud'),
      workspaceId,
      userId: actor.id,
      action: input.decision === 'APPROVE' ? 'JOIN_REQUEST_APPROVED' : 'JOIN_REQUEST_REJECTED',
      resourceType: 'join_request',
      resourceId: requestId,
      metadata: { targetUserId: existing.userId, assignedRole },
    });

    const decidedPayload = {
      type: 'join:decided' as const,
      workspaceId,
      request: updated,
    };
    this.eventHub?.broadcast(workspaceId, decidedPayload);
    this.eventHub?.sendToUser(existing.userId, decidedPayload);

    return updated;
  }

  public async createInvitation(
    workspaceId: string,
    actor: UserProfileDto,
    input: { role: 'EDITOR' | 'VIEWER'; expiresInHours: number | null; maxUses: number | null },
  ): Promise<CreatedInvitationDto> {
    const { rawToken, tokenHash, codePrefix } = generateInvitationToken();
    const expiresAt = input.expiresInHours
      ? new Date(Date.now() + input.expiresInHours * 3600 * 1000)
      : null;

    const invitation = await this.db.workspaces.createInvitation({
      id: generateSecureId('inv'),
      workspaceId,
      tokenHash,
      codePrefix,
      role: input.role,
      expiresAt,
      maxUses: input.maxUses,
      createdById: actor.id,
    });

    await this.db.audit.log({
      id: generateSecureId('aud'),
      workspaceId,
      userId: actor.id,
      action: 'INVITATION_CREATED',
      resourceType: 'invitation',
      resourceId: invitation.id,
      metadata: { role: input.role, expiresInHours: input.expiresInHours },
    });

    return {
      ...invitation,
      token: rawToken,
      joinCode: rawToken,
    };
  }

  public async listInvitations(workspaceId: string): Promise<WorkspaceInvitationDto[]> {
    return this.db.workspaces.listInvitations(workspaceId);
  }

  public async revokeInvitation(
    workspaceId: string,
    invitationId: string,
    actor: UserProfileDto,
  ): Promise<void> {
    const inv = await this.db.workspaces.findInvitationById(invitationId);
    if (!inv || inv.workspaceId !== workspaceId) {
      throw new NotFoundError('Invitation not found', 'INVITATION_NOT_FOUND');
    }
    await this.db.workspaces.revokeInvitation(invitationId);
    await this.db.audit.log({
      id: generateSecureId('aud'),
      workspaceId,
      userId: actor.id,
      action: 'INVITATION_REVOKED',
      resourceType: 'invitation',
      resourceId: invitationId,
    });
  }

  public async validateInvitation(tokenOrCode: string) {
    const extracted = extractTokenFromInviteInput(tokenOrCode);
    // Support 6-digit workspace code lookup as well
    if (/^\d{6}$/.test(extracted)) {
      const ws = await this.db.workspaces.findByJoinCode(extracted);
      if (!ws) {
        throw new NotFoundError('No workspace found for that 6-digit code', 'INVALID_INVITATION');
      }
      return {
        mode: 'approval-required' as const,
        workspace: ws,
        invitation: null,
      };
    }

    const tokenHash = hashToken(extracted);
    const inv = await this.db.workspaces.findInvitationByTokenHash(tokenHash);
    if (!inv) {
      throw new NotFoundError('Invalid invitation link or join code', 'INVALID_INVITATION');
    }
    if (inv.revokedAt) {
      throw new ForbiddenError('This invitation has been revoked', 'INVITATION_REVOKED');
    }
    if (inv.expiresAt && new Date(inv.expiresAt).getTime() <= Date.now()) {
      throw new ForbiddenError('This invitation has expired', 'INVITATION_EXPIRED');
    }
    if (inv.maxUses !== null && inv.useCount >= inv.maxUses) {
      throw new ForbiddenError('This invitation has reached its maximum uses', 'INVITATION_EXHAUSTED');
    }
    const workspace = await this.db.workspaces.findById(inv.workspaceId);
    if (!workspace) {
      throw new NotFoundError('Workspace no longer exists', 'WORKSPACE_NOT_FOUND');
    }
    return { mode: 'direct-invite' as const, invitation: inv, workspace };
  }

  public async joinWorkspace(user: UserProfileDto, tokenOrCode: string): Promise<WorkspaceDto> {
    const validated = await this.validateInvitation(tokenOrCode);
    if (validated.mode === 'approval-required' || !validated.invitation) {
      throw new BadRequestError(
        '6-digit workspace codes require host approval via /api/workspaces/join-requests',
        'APPROVAL_REQUIRED',
      );
    }

    const { invitation, workspace } = validated;
    const existingMember = await this.db.workspaces.findMember(workspace.id, user.id);
    let member = existingMember;
    if (!member) {
      member = await this.db.workspaces.addMember({
        id: generateSecureId('mem'),
        workspaceId: workspace.id,
        userId: user.id,
        role: invitation.role,
      });
      await this.db.workspaces.incrementInvitationUse(invitation.id);

      await this.db.audit.log({
        id: generateSecureId('aud'),
        workspaceId: workspace.id,
        userId: user.id,
        action: 'MEMBER_JOINED',
        resourceType: 'member',
        resourceId: member.id,
        metadata: { role: member.role, invitationId: invitation.id },
      });

      this.eventHub?.broadcast(workspace.id, {
        type: 'member:joined',
        workspaceId: workspace.id,
        member,
      });
    }

    return this.getWorkspaceDetails(workspace.id, member);
  }

  public async updateMemberRole(
    workspaceId: string,
    targetUserId: string,
    role: Exclude<WorkspaceRole, 'OWNER'>,
    actor: UserProfileDto,
  ): Promise<WorkspaceMemberDto> {
    const workspace = await this.db.workspaces.findById(workspaceId);
    if (!workspace) throw new NotFoundError('Workspace not found');
    if (targetUserId === workspace.ownerId) {
      throw new BadRequestError('Cannot change the workspace owner role', 'CANNOT_MODIFY_OWNER');
    }
    const updated = await this.db.workspaces.updateMemberRole(workspaceId, targetUserId, role);
    await this.db.audit.log({
      id: generateSecureId('aud'),
      workspaceId,
      userId: actor.id,
      action: 'MEMBER_ROLE_UPDATED',
      resourceType: 'member',
      resourceId: updated.id,
      metadata: { targetUserId, role },
    });
    this.eventHub?.broadcast(workspaceId, {
      type: 'member:updated',
      workspaceId,
      member: updated,
    });
    return updated;
  }

  public async removeMember(
    workspaceId: string,
    targetUserId: string,
    actor: UserProfileDto,
  ): Promise<void> {
    const workspace = await this.db.workspaces.findById(workspaceId);
    if (!workspace) throw new NotFoundError('Workspace not found');
    if (targetUserId === workspace.ownerId) {
      throw new BadRequestError('Cannot remove the workspace owner', 'CANNOT_REMOVE_OWNER');
    }
    const existing = await this.db.workspaces.findMember(workspaceId, targetUserId);
    if (!existing) throw new NotFoundError('Member not found');

    await this.db.workspaces.removeMember(workspaceId, targetUserId);
    await this.db.audit.log({
      id: generateSecureId('aud'),
      workspaceId,
      userId: actor.id,
      action: 'MEMBER_REMOVED',
      resourceType: 'member',
      resourceId: existing.id,
      metadata: { targetUserId },
    });
    this.eventHub?.broadcast(workspaceId, {
      type: 'member:removed',
      workspaceId,
      userId: targetUserId,
    });
  }

  public async leaveWorkspace(workspaceId: string, actor: UserProfileDto): Promise<void> {
    const workspace = await this.db.workspaces.findById(workspaceId);
    if (!workspace) throw new NotFoundError('Workspace not found');
    if (workspace.ownerId === actor.id) {
      throw new BadRequestError(
        'Workspace owners cannot leave without deleting the workspace',
        'OWNER_CANNOT_LEAVE',
      );
    }
    await this.db.workspaces.removeMember(workspaceId, actor.id);
    await this.db.audit.log({
      id: generateSecureId('aud'),
      workspaceId,
      userId: actor.id,
      action: 'MEMBER_LEFT',
      resourceType: 'workspace',
      resourceId: workspaceId,
    });
    this.eventHub?.broadcast(workspaceId, {
      type: 'member:removed',
      workspaceId,
      userId: actor.id,
    });
  }
}
