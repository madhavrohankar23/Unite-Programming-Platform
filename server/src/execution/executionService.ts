import { HOSTED_SANDBOX_LANGUAGES } from '../../../shared/constants/languages.js';
import type {
  ExecutionResultDto,
  ExecutionStatus,
  UserProfileDto,
} from '../../../shared/types/models.js';
import type { DatabaseRepositories } from '../database/types.js';
import { generateSecureId } from '../security/tokens.js';
import type { ServerEnv } from '../utils/env.js';
import { BadRequestError, ServiceUnavailableError } from '../utils/errors.js';

interface PistonLanguageConfig {
  language: string;
  version: string;
  fileName: string;
}

const PISTON_LANGUAGE_MAP: Record<string, PistonLanguageConfig> = {
  c: { language: 'c', version: '*', fileName: 'main.c' },
  cpp: { language: 'c++', version: '*', fileName: 'main.cpp' },
  java: { language: 'java', version: '*', fileName: 'Main.java' },
  go: { language: 'go', version: '*', fileName: 'main.go' },
  rust: { language: 'rust', version: '*', fileName: 'main.rs' },
  php: { language: 'php', version: '*', fileName: 'index.php' },
};

interface PistonExecuteResponse {
  compile?: {
    stdout?: string;
    stderr?: string;
    code?: number | null;
    signal?: string | null;
  };
  run?: {
    stdout?: string;
    stderr?: string;
    code?: number | null;
    signal?: string | null;
  };
  message?: string;
}

function truncateOutput(text: string, maxBytes: number): { value: string; truncated: boolean } {
  const buf = Buffer.from(text, 'utf8');
  if (buf.byteLength <= maxBytes) {
    return { value: text, truncated: false };
  }
  const sliced = buf.subarray(0, maxBytes).toString('utf8');
  return {
    value: `${sliced}\n\n[Output truncated at ${maxBytes} bytes]`,
    truncated: true,
  };
}

export class HostedExecutionService {
  constructor(
    private readonly env: ServerEnv,
    private readonly db: DatabaseRepositories,
  ) {}

  public async execute(
    workspaceId: string,
    actor: UserProfileDto,
    input: { fileId?: string | null; language: string; code: string; stdin?: string },
  ): Promise<ExecutionResultDto> {
    if (!HOSTED_SANDBOX_LANGUAGES.has(input.language)) {
      throw new BadRequestError(
        `Language "${input.language}" is not handled by the hosted sandbox endpoint. JavaScript/TypeScript run in WebContainers and Python runs in Pyodide.`,
        'UNSUPPORTED_HOSTED_LANGUAGE',
      );
    }

    if (this.env.EXECUTION_PROVIDER === 'disabled' || !this.env.EXECUTION_API_URL) {
      throw new ServiceUnavailableError(
        'Hosted execution service is not configured on this server (EXECUTION_PROVIDER=disabled).',
        'EXECUTION_SERVICE_UNAVAILABLE',
      );
    }

    const config = PISTON_LANGUAGE_MAP[input.language];
    if (!config) {
      throw new BadRequestError(`No runtime mapping for ${input.language}`, 'UNSUPPORTED_LANGUAGE');
    }

    const startedAt = new Date();
    const startMs = Date.now();
    const recordId = generateSecureId('exec');

    let status: ExecutionStatus = 'COMPLETED';
    let exitCode: number | null = 0;
    let rawStdout = '';
    let rawStderr = '';
    let compileOutput = '';

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.env.EXECUTION_API_KEY) {
        headers.Authorization = `Bearer ${this.env.EXECUTION_API_KEY}`;
      }

      const response = await fetch(this.env.EXECUTION_API_URL, {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(this.env.EXECUTION_TIMEOUT_MS + 3000),
        body: JSON.stringify({
          language: config.language,
          version: config.version,
          files: [{ name: config.fileName, content: input.code }],
          stdin: input.stdin ?? '',
          compile_timeout: this.env.EXECUTION_TIMEOUT_MS,
          run_timeout: this.env.EXECUTION_TIMEOUT_MS,
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new ServiceUnavailableError(
          `Hosted execution provider returned HTTP ${response.status}: ${text.slice(0, 200)}`,
          'EXECUTION_PROVIDER_ERROR',
        );
      }

      const data = (await response.json()) as PistonExecuteResponse;
      if (data.compile && (data.compile.code ?? 0) !== 0) {
        status = 'COMPILE_ERROR';
        exitCode = data.compile.code ?? 1;
        compileOutput = [data.compile.stdout ?? '', data.compile.stderr ?? '']
          .filter(Boolean)
          .join('\n');
        rawStderr = compileOutput;
      } else if (data.run) {
        rawStdout = data.run.stdout ?? '';
        rawStderr = data.run.stderr ?? '';
        exitCode = data.run.code ?? null;
        if (data.run.signal === 'SIGKILL' || data.run.signal === 'SIGTERM') {
          status = 'TIMEOUT';
        } else if ((exitCode ?? 0) !== 0) {
          status = 'RUNTIME_ERROR';
        } else {
          status = 'COMPLETED';
        }
      } else {
        status = 'UNAVAILABLE';
        rawStderr = data.message ?? 'Unexpected response from execution sandbox';
      }
    } catch (err) {
      if (err instanceof ServiceUnavailableError) {
        throw err;
      }
      if (err instanceof Error && err.name === 'TimeoutError') {
        status = 'TIMEOUT';
        exitCode = null;
        rawStderr = `Execution timed out after ${this.env.EXECUTION_TIMEOUT_MS}ms`;
      } else {
        throw new ServiceUnavailableError(
          err instanceof Error ? err.message : 'Unable to reach hosted execution sandbox',
          'EXECUTION_UNREACHABLE',
        );
      }
    }

    const finishedAt = new Date();
    const durationMs = Date.now() - startMs;
    const outRes = truncateOutput(rawStdout, this.env.EXECUTION_MAX_OUTPUT_BYTES);
    const errRes = truncateOutput(rawStderr, this.env.EXECUTION_MAX_OUTPUT_BYTES);

    await this.db.executions.create({
      id: recordId,
      workspaceId,
      fileId: input.fileId ?? null,
      userId: actor.id,
      language: input.language,
      provider: 'piston',
      status,
      exitCode,
      stdout: outRes.value,
      stderr: errRes.value,
      durationMs,
      startedAt,
      finishedAt,
    });

    await this.db.audit.log({
      id: generateSecureId('aud'),
      workspaceId,
      userId: actor.id,
      action: 'CODE_EXECUTED',
      resourceType: 'execution',
      resourceId: recordId,
      metadata: { language: input.language, status, durationMs },
    });

    return {
      id: recordId,
      workspaceId,
      fileId: input.fileId ?? null,
      language: input.language,
      provider: 'piston',
      status,
      exitCode,
      stdout: outRes.value,
      stderr: errRes.value,
      compileOutput: compileOutput || undefined,
      durationMs,
      truncated: outRes.truncated || errRes.truncated,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
    };
  }
}

