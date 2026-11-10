/**
 * Where the app's data lives (VITE_DATA_MODE):
 * - "local"  (default) — this device's browser storage, no server needed
 * - "api"    — the Django backend at /api/v1/ (session auth + CSRF)
 * - "sample" — fixed sample data (design preview build)
 */
export type DataMode = 'local' | 'api' | 'sample'

const envMode = import.meta.env.VITE_DATA_MODE as DataMode | undefined
export const DATA_MODE: DataMode = import.meta.env.MODE === 'preview' ? 'sample' : (envMode ?? 'local')

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
