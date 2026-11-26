import { getLanguageById } from '@shared/constants/languages';
import type { ExecutionResultDto, WorkspaceFileDto } from '@shared/types/models';
import { executionApi } from '@/services/api/executionApi';
import { executePythonInPyodide } from './pyodideRuntime';
import { executeJsOrTsInWebContainer } from './webContainerRuntime';

export async function runWorkspaceCode(options: {
  workspaceId: string;
  fileId: string | null;
  language: string;
  code: string;
  stdin?: string;
  files: WorkspaceFileDto[];
  liveContents: Map<string, string>;
  signal?: AbortSignal;
}): Promise<ExecutionResultDto> {
  const langDef = getLanguageById(options.language);
  const startedIso = new Date().toISOString();

  if (!langDef.executable || langDef.runtime === 'editor-only') {
    return {
      id: `local_${Date.now()}`,
      workspaceId: options.workspaceId,
      fileId: options.fileId,
      language: langDef.id,
      provider: 'none',
      status: 'UNAVAILABLE',
      exitCode: null,
      stdout: '',
      stderr: `"${langDef.label}" is an editor-only language (syntax highlighting & editing). Select an executable language such as JavaScript, TypeScript, Python, C, C++, or Java to run code.`,
      durationMs: 0,
      truncated: false,
      startedAt: startedIso,
      finishedAt: startedIso,
    };
  }

  if (langDef.runtime === 'browser-webcontainer') {
    const res = await executeJsOrTsInWebContainer({
      files: options.files,
      liveContents: options.liveContents,
      fileId: options.fileId,
      language: langDef.id,
      code: options.code,
      signal: options.signal,
    });

    try {
      const { record } = await executionApi.recordClientExecution(options.workspaceId, {
        fileId: options.fileId,
        language: langDef.id,
        provider: 'webcontainer',
        status: res.status,
        exitCode: res.exitCode,
        stdout: res.stdout.slice(0, 60_000),
        stderr: res.stderr.slice(0, 60_000),
        durationMs: res.durationMs,
      });
      return record;
    } catch {
      return {
        id: `wc_${Date.now()}`,
        workspaceId: options.workspaceId,
        fileId: options.fileId,
        language: langDef.id,
        provider: 'webcontainer',
        status: res.status,
        exitCode: res.exitCode,
        stdout: res.stdout,
        stderr: res.stderr,
        durationMs: res.durationMs,
        truncated: false,
        startedAt: startedIso,
        finishedAt: new Date().toISOString(),
      };
    }
  }

  if (langDef.runtime === 'browser-pyodide') {
    const res = await executePythonInPyodide({
      code: options.code,
      signal: options.signal,
    });

    try {
      const { record } = await executionApi.recordClientExecution(options.workspaceId, {
        fileId: options.fileId,
        language: langDef.id,
        provider: 'pyodide',
        status: res.status,
        exitCode: res.exitCode,
        stdout: res.stdout.slice(0, 60_000),
        stderr: res.stderr.slice(0, 60_000),
        durationMs: res.durationMs,
      });
      return record;
    } catch {
      return {
        id: `py_${Date.now()}`,
        workspaceId: options.workspaceId,
        fileId: options.fileId,
        language: langDef.id,
        provider: 'pyodide',
        status: res.status,
        exitCode: res.exitCode,
        stdout: res.stdout,
        stderr: res.stderr,
        durationMs: res.durationMs,
        truncated: false,
        startedAt: startedIso,
        finishedAt: new Date().toISOString(),
      };
    }
  }

  // Hosted Sandbox Execution (C, C++, Java, Go, Rust, PHP)
  const { result } = await executionApi.executeHosted(options.workspaceId, {
    fileId: options.fileId,
    language: langDef.id,
    code: options.code,
    stdin: options.stdin ?? '',
  });
  return result;
}

