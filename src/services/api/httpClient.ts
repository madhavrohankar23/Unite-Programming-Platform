export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:4000';

export const COLLAB_WS_URL =
  (import.meta.env.VITE_COLLAB_WS_URL as string | undefined)?.replace(/\/$/, '') ||
  API_BASE_URL.replace(/^http/, 'ws') + '/collab';

export const EVENTS_WS_URL =
  (import.meta.env.VITE_EVENTS_WS_URL as string | undefined)?.replace(/\/$/, '') ||
  API_BASE_URL.replace(/^http/, 'ws') + '/ws/events';

export const NOTIFICATIONS_WS_URL =
  API_BASE_URL.replace(/^http/, 'ws') + '/ws/notifications';

export const TERMINAL_WS_URL =
  (import.meta.env.VITE_TERMINAL_WS_URL as string | undefined)?.replace(/\/$/, '') ||
  API_BASE_URL.replace(/^http/, 'ws') + '/ws/terminal';

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

  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    ...options,
    headers,
  });

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

