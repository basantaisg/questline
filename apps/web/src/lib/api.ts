const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Access token lives in memory only — never in localStorage. */
let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function rawRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = Array.isArray(body?.message)
      ? body.message[0]
      : (body?.message ?? `Request failed (${res.status})`);
    throw new ApiError(res.status, message);
  }
  return body as T;
}

/** Silent refresh: retry once with a fresh access token on 401. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, init);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && !path.startsWith('/auth')) {
      const refreshed = await tryRefresh();
      if (refreshed) return rawRequest<T>(path, init);
    }
    throw err;
  }
}

export async function tryRefresh(): Promise<boolean> {
  try {
    const result = await rawRequest<{ accessToken: string }>('/auth/refresh', {
      method: 'POST',
    });
    accessToken = result.accessToken;
    return true;
  } catch {
    accessToken = null;
    return false;
  }
}

export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export const patch = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });

export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' });
