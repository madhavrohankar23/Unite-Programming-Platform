let activeWorker: Worker | null = null;

function getWorker(): Worker {
  if (!activeWorker) {
    activeWorker = new Worker(new URL('./pyodideWorker.ts', import.meta.url), {
      type: 'module',
    });
  }
  return activeWorker;
}

export function executePythonInPyodide(options: {
  code: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<{
  status: 'COMPLETED' | 'RUNTIME_ERROR' | 'TIMEOUT' | 'CANCELLED' | 'UNAVAILABLE';
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}> {
  const startedAt = Date.now();
  const timeoutMs = options.timeoutMs ?? 15_000;

  return new Promise((resolve) => {
    const worker = getWorker();
    const runId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    let settled = false;

    const cleanup = () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      options.signal?.removeEventListener('abort', onAbort);
      clearTimeout(timer);
    };

    const terminateAndReset = () => {
      worker.terminate();
      activeWorker = null;
    };

    const onMessage = (
      ev: MessageEvent<{ id: string; ok: boolean; stdout: string; stderr: string }>,
    ) => {
      if (ev.data.id !== runId || settled) return;
      settled = true;
      cleanup();
      resolve({
        status: ev.data.ok ? 'COMPLETED' : 'RUNTIME_ERROR',
        exitCode: ev.data.ok ? 0 : 1,
        stdout: ev.data.stdout,
        stderr: ev.data.stderr,
        durationMs: Date.now() - startedAt,
      });
    };

    const onError = (err: ErrorEvent) => {
      if (settled) return;
      settled = true;
      cleanup();
      terminateAndReset();
      resolve({
        status: 'UNAVAILABLE',
        exitCode: null,
        stdout: '',
        stderr: err.message || 'Pyodide worker failed to execute Python code.',
        durationMs: Date.now() - startedAt,
      });
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      terminateAndReset();
      resolve({
        status: 'CANCELLED',
        exitCode: null,
        stdout: '',
        stderr: 'Python execution cancelled.',
        durationMs: Date.now() - startedAt,
      });
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      terminateAndReset();
      resolve({
        status: 'TIMEOUT',
        exitCode: null,
        stdout: '',
        stderr: `Python execution timed out after ${timeoutMs}ms.`,
        durationMs: Date.now() - startedAt,
      });
    }, timeoutMs);

    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    options.signal?.addEventListener('abort', onAbort);
    worker.postMessage({ id: runId, code: options.code });
  });
}

