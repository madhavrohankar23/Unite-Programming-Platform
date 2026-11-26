/// <reference lib="webworker" />

interface PyodideInstance {
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (opts: { batched: (msg: string) => void }) => void;
  setStderr: (opts: { batched: (msg: string) => void }) => void;
}

let pyodidePromise: Promise<PyodideInstance> | null = null;

async function ensurePyodide(): Promise<PyodideInstance> {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      // Load Pyodide ESM runtime from official CDN inside isolated Web Worker
      const pyodideUrl = 'https://cdn.jsdelivr.net/pyodide/v0.27.3/full/pyodide.mjs';
      const mod = (await import(/* @vite-ignore */ pyodideUrl)) as {
        loadPyodide: (opts: { indexURL: string }) => Promise<PyodideInstance>;
      };
      return mod.loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.3/full/',
      });
    })();
  }
  return pyodidePromise;
}

self.onmessage = async (event: MessageEvent<{ id: string; code: string }>) => {
  const { id, code } = event.data;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  try {
    const pyodide = await ensurePyodide();
    pyodide.setStdout({
      batched: (text: string) => {
        stdoutLines.push(text);
      },
    });
    pyodide.setStderr({
      batched: (text: string) => {
        stderrLines.push(text);
      },
    });

    await pyodide.runPythonAsync(code);

    self.postMessage({
      id,
      ok: true,
      stdout: stdoutLines.join('\n'),
      stderr: stderrLines.join('\n'),
    });
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      stdout: stdoutLines.join('\n'),
      stderr: [stderrLines.join('\n'), err instanceof Error ? err.message : String(err)]
        .filter(Boolean)
        .join('\n'),
    });
  }
};
