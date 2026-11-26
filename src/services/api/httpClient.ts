function isLocalHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

function resolveApiBaseUrl(): string {
  // On deployed remote production/preview domains (non-localhost):
  if (!isLocalHost()) {
    const configured = (import.meta.env.VITE_API_URL as string | undefined)
      ?.trim()
      .replace(/\/$/, '');
    // Only use an explicitly configured remote HTTPS backend URL
    if (configured && configured.startsWith('https://')) {
      return configured;
    }
    // Always use same-origin relative URLs (/api/*) in production
    return '';
  }

  // Local development on localhost:
  const configured = (import.meta.env.VITE_API_URL as string | undefined)
    ?.trim()
    .replace(/\/$/, '');
  return configured || 'http://localhost:4000';
}

export const API_BASE_URL = resolveApiBaseUrl();

export const HAS_REALTIME_WS = Boolean(
  isLocalHost() ||
    Boolean(
      (import.meta.env.VITE_COLLAB_WS_URL as string | undefined)
        ?.trim()
        ?.startsWith('wss://'),
    ),
);

function resolveWsUrl(envValue: string | undefined, path: string): string {
  if (isLocalHost()) {
    const configured = envValue?.trim().replace(/\/$/, '');
    if (configured) return configured;
    return `ws://localhost:4000${path}`;
  }

  const configured = envValue?.trim().replace(/\/$/, '');
  if (configured && configured.startsWith('wss://')) {
    return configured;
  }
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}${path}`;
  }
  return '';
}

export const COLLAB_WS_URL = resolveWsUrl(
  import.meta.env.VITE_COLLAB_WS_URL as string | undefined,
  '/collab',
);

export const EVENTS_WS_URL = resolveWsUrl(
  import.meta.env.VITE_EVENTS_WS_URL as string | undefined,
  '/ws/events',
);

export const NOTIFICATIONS_WS_URL = resolveWsUrl(undefined, '/ws/notifications');

export const TERMINAL_WS_URL = resolveWsUrl(
  import.meta.env.VITE_TERMINAL_WS_URL as string | undefined,
  '/ws/terminal',
);

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

let tokenProvider: () => Promise<string | null> | string | null = () => null;

export function setApiTokenProvider(provider: () => Promise<string | null> | string | null) {
  tokenProvider = provider;
}

export async function getActiveAccessToken(): Promise<string | null> {
  return tokenProvider();
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (!options.skipAuth) {
    const token = await tokenProvider();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api${path}`, {
      ...options,
      headers,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ApiClientError(
      0,
      'NETWORK_ERROR',
      `Network request failed (${msg}). Please verify server connectivity.`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const errObj = data?.error;
    throw new ApiClientError(
      response.status,
      errObj?.code ?? 'REQUEST_FAILED',
      errObj?.message ?? `Request failed with status ${response.status}`,
      errObj?.details,
    );
  }

  return data as T;
}
