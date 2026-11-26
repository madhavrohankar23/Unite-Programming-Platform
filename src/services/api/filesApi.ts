import type {
  FileChangeRequestDto,
  FileNodeType,
  FileVersionDto,
  WorkspaceFileDto,
} from '@shared/types/models';
import { apiFetch } from './httpClient';

export type SaveFileResponse =
  | { mode: 'SAVED'; version: FileVersionDto }
  | { mode: 'PENDING_APPROVAL'; changeRequest: FileChangeRequestDto };

export const filesApi = {
  list(workspaceId: string) {
    return apiFetch<{ files: WorkspaceFileDto[] }>(`/workspaces/${workspaceId}/files`);
  },
  create(
    workspaceId: string,
    payload: {
      parentId: string | null;
      name: string;
      nodeType: FileNodeType;
      language?: string;
      initialContent?: string;
    },
  ) {
    return apiFetch<{ file: WorkspaceFileDto }>(`/workspaces/${workspaceId}/files`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  update(
    workspaceId: string,
    fileId: string,
    payload: { name?: string; parentId?: string | null; language?: string },
  ) {
    return apiFetch<{ file: WorkspaceFileDto }>(`/workspaces/${workspaceId}/files/${fileId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  remove(workspaceId: string, fileId: string) {
    return apiFetch<{ deletedIds: string[] }>(`/workspaces/${workspaceId}/files/${fileId}`, {
      method: 'DELETE',
    });
  },
  submitSave(
    workspaceId: string,
    fileId: string,
    payload: { content: string; summary?: string },
  ) {
    return apiFetch<SaveFileResponse>(`/workspaces/${workspaceId}/files/${fileId}/save`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  listPendingChangeRequests(workspaceId: string) {
    return apiFetch<{ changeRequests: FileChangeRequestDto[] }>(
      `/workspaces/${workspaceId}/change-requests`,
    );
  },
  decideChangeRequest(
    workspaceId: string,
    requestId: string,
    decision: 'APPROVE' | 'REJECT',
  ) {
    return apiFetch<{ changeRequest: FileChangeRequestDto; version?: FileVersionDto }>(
      `/workspaces/${workspaceId}/change-requests/${requestId}/decide`,
      {
        method: 'POST',
        body: JSON.stringify({ decision }),
      },
    );
  },
  listVersions(workspaceId: string, fileId: string) {
    return apiFetch<{ versions: FileVersionDto[] }>(
      `/workspaces/${workspaceId}/files/${fileId}/versions`,
    );
  },
  restoreVersion(workspaceId: string, fileId: string, versionId: string) {
    return apiFetch<{ version: FileVersionDto }>(
      `/workspaces/${workspaceId}/files/${fileId}/versions/${versionId}/restore`,
      { method: 'POST' },
    );
  },
};
