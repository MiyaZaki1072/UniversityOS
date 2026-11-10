/**
 * Minimal API client for the Django backend (same-origin, session auth + CSRF).
 * Set VITE_USE_SAMPLE_DATA=false once the backend serves /api/v1/.
 */
export const USE_SAMPLE = import.meta.env.VITE_USE_SAMPLE_DATA !== 'false'

function csrfToken(): string | undefined {
  return document.cookie.match(/(?:^|; )csrftoken=([^;]+)/)?.[1]
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    credentials: 'same-origin',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.method && init.method !== 'GET' ? { 'X-CSRFToken': csrfToken() ?? '' } : {}),
      ...init.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? `Request failed (${res.status})`)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}
