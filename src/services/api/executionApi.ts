import type { ExecutionResultDto, ExecutionStatus } from '@shared/types/models';
import { apiFetch } from './httpClient';

export const executionApi = {
  executeHosted(
    workspaceId: string,
    payload: { fileId?: string | null; language: string; code: string; stdin?: string },
  ) {
    return apiFetch<{ result: ExecutionResultDto }>(`/workspaces/${workspaceId}/execute`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  recordClientExecution(
    workspaceId: string,
    payload: {
      fileId?: string | null;
      language: string;
      provider: string;
      status: Exclude<ExecutionStatus, 'PENDING' | 'RUNNING'>;
      exitCode: number | null;
      stdout: string;
      stderr: string;
      durationMs: number;
    },
  ) {
    return apiFetch<{ record: ExecutionResultDto }>(
      `/workspaces/${workspaceId}/executions/record`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  },
  listHistory(workspaceId: string) {
    return apiFetch<{ executions: ExecutionResultDto[] }>(
      `/workspaces/${workspaceId}/executions`,
    );
  },
};

