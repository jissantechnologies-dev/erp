import type { Paginated } from '@erp/shared';

/**
 * Thin fetch wrapper with silent access-token refresh.
 *
 * The access token is held in memory only — never localStorage — so an XSS bug
 * cannot read it back later. Durability comes from the httpOnly refresh cookie,
 * which the browser sends to /api/auth/refresh on reload.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Per-field messages from the server's Zod validation, keyed by field name. */
    readonly fieldErrors?: Record<string, string>,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let accessToken: string | null = null;
let tenantSlug: string | null = localStorage.getItem('erp:tenant');

export const setAccessToken = (t: string | null): void => {
  accessToken = t;
};
export const getAccessToken = (): string | null => accessToken;

export const setTenantSlug = (slug: string | null): void => {
  tenantSlug = slug;
  if (slug) localStorage.setItem('erp:tenant', slug);
  else localStorage.removeItem('erp:tenant');
};
export const getTenantSlug = (): string | null => tenantSlug;

/** Notifies the app when refresh fails, so it can route to /login. */
type Listener = () => void;
const sessionLostListeners = new Set<Listener>();
export const onSessionLost = (fn: Listener): (() => void) => {
  sessionLostListeners.add(fn);
  return () => sessionLostListeners.delete(fn);
};

/** Single in-flight refresh, shared by all callers that 401 at once. */
let refreshing: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { accessToken: string };
      accessToken = data.accessToken;
      return true;
    } catch {
      return false;
    } finally {
      // Cleared on the next tick so concurrent callers all observe this result.
      setTimeout(() => {
        refreshing = null;
      }, 0);
    }
  })();
  return refreshing;
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  /** Set false for login/register, which must not trigger a refresh loop. */
  retryOnUnauthorised?: boolean;
};

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { body, retryOnUnauthorised = true, ...init } = opts;

  const send = (): Promise<Response> =>
    fetch(`/api${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(tenantSlug ? { 'X-Tenant': tenantSlug } : {}),
        ...init.headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

  let res = await send();

  if (res.status === 401 && retryOnUnauthorised) {
    if (await refreshAccessToken()) {
      res = await send();
    } else {
      sessionLostListeners.forEach((fn) => fn());
      throw new ApiError(401, 'Your session has expired. Sign in again.');
    }
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const b = (data ?? {}) as { message?: string | string[]; fieldErrors?: Record<string, string> };
    const message = Array.isArray(b.message) ? b.message.join(', ') : b.message;
    throw new ApiError(res.status, message ?? `Request failed (${res.status})`, b.fieldErrors, data);
  }

  return data as T;
}

/** Serialises a query object, dropping empty values so the URL stays clean. */
export const qs = (params: Record<string, unknown>): string => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
};

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),

  /** Typed list helper: `api.list<PartRow>('/masters/parts', { q, page })`. */
  list: <T>(path: string, params: Record<string, unknown> = {}) =>
    request<Paginated<T>>(`${path}${qs(params)}`),

  refresh: refreshAccessToken,
};
