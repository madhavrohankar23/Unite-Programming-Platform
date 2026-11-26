import { WebContainer, type FileSystemTree, type WebContainerProcess } from '@webcontainer/api';
import type { WorkspaceFileDto } from '@shared/types/models';
import { transform } from 'sucrase';

let bootPromise: Promise<WebContainer> | null = null;
let instance: WebContainer | null = null;

export function isWebContainerSupported(): boolean {
  return typeof window !== 'undefined' && window.crossOriginIsolated === true;
}

export async function getWebContainerInstance(): Promise<WebContainer> {
  if (!isWebContainerSupported()) {
    throw new Error(
      'WebContainer requires Cross-Origin Isolation (COOP: same-origin, COEP: credentialless).',
    );
  }
  if (instance) return instance;
  if (!bootPromise) {
    bootPromise = WebContainer.boot().then((wc) => {
      instance = wc;
      return wc;
    });
  }
  return bootPromise;
}

export function buildFileSystemTree(
  files: WorkspaceFileDto[],
  liveContents: Map<string, string>,
): { tree: FileSystemTree; pathByFileId: Map<string, string> } {
  const byId = new Map(files.map((f) => [f.id, f]));
  const pathByFileId = new Map<string, string>();

  const computePath = (file: WorkspaceFileDto): string => {
    const segments: string[] = [file.name];
    let currParent = file.parentId;
    const seen = new Set<string>([file.id]);
    while (currParent && !seen.has(currParent)) {
      seen.add(currParent);
      const parent = byId.get(currParent);
      if (!parent) break;
      segments.unshift(parent.name);
      currParent = parent.parentId;
    }
    return segments.join('/');
  };

  const root: FileSystemTree = {};

  for (const node of files) {
    const relPath = computePath(node);
    pathByFileId.set(node.id, relPath);

    const parts = relPath.split('/');
    let cursor: FileSystemTree = root;
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i]!;
      const isLast = i === parts.length - 1;
      if (isLast && node.nodeType === 'FILE') {
        const contents = liveContents.get(node.id) ?? node.contentSnapshot ?? '';
        cursor[part] = { file: { contents } };
      } else {
        const existing = cursor[part];
        if (!existing || !('directory' in existing)) {
          cursor[part] = { directory: {} };
        }
        cursor = (cursor[part] as { directory: FileSystemTree }).directory;
      }
    }
  }

  return { tree: root, pathByFileId };
}

export async function syncWorkspaceToWebContainer(
  files: WorkspaceFileDto[],
  liveContents: Map<string, string>,
): Promise<{ wc: WebContainer; pathByFileId: Map<string, string> }> {
  const wc = await getWebContainerInstance();
  const { tree, pathByFileId } = buildFileSystemTree(files, liveContents);
  await wc.mount(tree);
  return { wc, pathByFileId };
}

export async function executeJsOrTsInWebContainer(options: {
  files: WorkspaceFileDto[];
  liveContents: Map<string, string>;
  fileId: string | null;
  language: string;
  code: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<{
  status: 'COMPLETED' | 'COMPILE_ERROR' | 'RUNTIME_ERROR' | 'TIMEOUT' | 'CANCELLED' | 'UNAVAILABLE';
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}> {
  const startedAt = Date.now();
  if (!isWebContainerSupported()) {
    return {
      status: 'UNAVAILABLE',
      exitCode: null,
      stdout: '',
      stderr:
        'Browser WebContainer sandbox is unavailable because Cross-Origin Isolation (SharedArrayBuffer) is not enabled in this browser context.',
      durationMs: Date.now() - startedAt,
    };
  }

  try {
    const { wc, pathByFileId } = await syncWorkspaceToWebContainer(
      options.files,
      options.liveContents,
    );

    let entryPath =
      (options.fileId ? pathByFileId.get(options.fileId) : undefined) ?? '.__unite_run.js';

    if (options.language === 'typescript') {
      try {
        const compiled = transform(options.code, {
          transforms: ['typescript'],
        }).code;
        entryPath = '.__unite_compiled.mjs';
        await wc.fs.writeFile(entryPath, compiled);
      } catch (err) {
        return {
          status: 'COMPILE_ERROR',
          exitCode: 1,
          stdout: '',
          stderr: err instanceof Error ? err.message : 'TypeScript transpilation failed',
          durationMs: Date.now() - startedAt,
        };
      }
    } else if (!options.fileId) {
      await wc.fs.writeFile(entryPath, options.code);
    }

    const proc = await wc.spawn('node', [entryPath]);
    let output = '';
    const maxBytes = 65_536;

    const reader = proc.output.getReader();
    let timedOut = false;
    let cancelled = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, options.timeoutMs ?? 12_000);

    const onAbort = () => {
      cancelled = true;
      proc.kill();
    };
    options.signal?.addEventListener('abort', onAbort);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (output.length < maxBytes) {
          output += value;
        }
      }
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    }

    const exitCode = await proc.exit;
    const durationMs = Date.now() - startedAt;

    if (cancelled) {
      return {
        status: 'CANCELLED',
        exitCode,
        stdout: output,
        stderr: 'Execution cancelled by user.',
        durationMs,
      };
    }
    if (timedOut) {
      return {
        status: 'TIMEOUT',
        exitCode,
        stdout: output,
        stderr: `Execution timed out after ${options.timeoutMs ?? 12_000}ms.`,
        durationMs,
      };
    }

    return {
      status: exitCode === 0 ? 'COMPLETED' : 'RUNTIME_ERROR',
      exitCode,
      stdout: output,
      stderr: '',
      durationMs,
    };
  } catch (err) {
    return {
      status: 'UNAVAILABLE',
      exitCode: null,
      stdout: '',
      stderr: err instanceof Error ? err.message : 'WebContainer failed to boot or run code',
      durationMs: Date.now() - startedAt,
    };
  }
}

export async function spawnWebContainerShell(cols: number, rows: number): Promise<WebContainerProcess> {
  const wc = await getWebContainerInstance();
  return wc.spawn('jsh', {
    terminal: { cols, rows },
  });
}

