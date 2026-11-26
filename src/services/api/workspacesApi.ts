import type { WorkspaceCategory } from '@shared/constants/languages';
import type { WorkspaceRole } from '@shared/constants/roles';
import type {
  CreatedInvitationDto,
  WorkspaceDto,
  WorkspaceInvitationDto,
  WorkspaceJoinRequestDto,
  WorkspaceMemberDto,
  WorkspaceSummaryDto,
} from '@shared/types/models';
import { apiFetch } from './httpClient';

export interface ValidateInvitationResponse {
  valid: boolean;
  mode?: 'approval-required' | 'direct-invite';
  workspaceId: string;
  workspaceName: string;
  role: WorkspaceRole | null;
  expiresAt: string | null;
}

export type SubmitJoinRequestResponse =
  | { alreadyMember: true; workspace: WorkspaceDto }
  | { alreadyMember: false; request: WorkspaceJoinRequestDto };

export const workspacesApi = {
  list() {
    return apiFetch<{ workspaces: WorkspaceSummaryDto[] }>('/workspaces');
  },
  get(workspaceId: string) {
    return apiFetch<{ workspace: WorkspaceDto }>(`/workspaces/${workspaceId}`);
  },
  create(payload: {
    name: string;
    category?: WorkspaceCategory;
    defaultLanguage?: string;
    stack?: string;
    liveServerEnabled?: boolean;
    template?: 'node-starter' | 'python-starter' | 'cpp-starter' | 'blank';
  }) {
    return apiFetch<{ workspace: WorkspaceDto; initialInvitation: CreatedInvitationDto }>(
      '/workspaces',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  },
  update(
    workspaceId: string,
    payload: { name?: string; defaultLanguage?: string; liveServerEnabled?: boolean },
  ) {
    return apiFetch<{ workspace: WorkspaceDto }>(`/workspaces/${workspaceId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  delete(workspaceId: string) {
    return apiFetch<void>(`/workspaces/${workspaceId}`, { method: 'DELETE' });
  },
  submitJoinRequest(joinCode: string) {
    return apiFetch<SubmitJoinRequestResponse>('/workspaces/join-requests', {
      method: 'POST',
      body: JSON.stringify({ joinCode }),
    });
  },
  getJoinRequestStatus(requestId: string) {
    return apiFetch<{ request: WorkspaceJoinRequestDto }>(`/join-requests/${requestId}`);
  },
  listPendingJoinRequests(workspaceId: string) {
    return apiFetch<{ requests: WorkspaceJoinRequestDto[] }>(
      `/workspaces/${workspaceId}/join-requests`,
    );
  },
  decideJoinRequest(
    workspaceId: string,
    requestId: string,
    payload: { decision: 'APPROVE' | 'REJECT'; role: 'EDITOR' | 'VIEWER' },
  ) {
    return apiFetch<{ request: WorkspaceJoinRequestDto }>(
      `/workspaces/${workspaceId}/join-requests/${requestId}/decide`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  },
  createInvitation(
    workspaceId: string,
    payload: { role: 'EDITOR' | 'VIEWER'; expiresInHours?: number | null; maxUses?: number | null },
  ) {
    return apiFetch<{ invitation: CreatedInvitationDto }>(
      `/workspaces/${workspaceId}/invitations`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  },
  listInvitations(workspaceId: string) {
    return apiFetch<{ invitations: WorkspaceInvitationDto[] }>(
      `/workspaces/${workspaceId}/invitations`,
    );
  },
  revokeInvitation(workspaceId: string, invitationId: string) {
    return apiFetch<void>(`/workspaces/${workspaceId}/invitations/${invitationId}`, {
      method: 'DELETE',
    });
  },
  validateInvitation(tokenOrCode: string) {
    return apiFetch<ValidateInvitationResponse>('/invitations/validate', {
      method: 'POST',
      body: JSON.stringify({ tokenOrCode }),
    });
  },
  joinWorkspace(tokenOrCode: string) {
    return apiFetch<{ workspace: WorkspaceDto }>('/invitations/join', {
      method: 'POST',
      body: JSON.stringify({ tokenOrCode }),
    });
  },
  updateMemberRole(workspaceId: string, userId: string, role: 'EDITOR' | 'VIEWER') {
    return apiFetch<{ member: WorkspaceMemberDto }>(
      `/workspaces/${workspaceId}/members/${userId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      },
    );
  },
  removeMember(workspaceId: string, userId: string) {
    return apiFetch<void>(`/workspaces/${workspaceId}/members/${userId}`, {
      method: 'DELETE',
    });
  },
  leave(workspaceId: string) {
    return apiFetch<void>(`/workspaces/${workspaceId}/leave`, { method: 'POST' });
  },
};
