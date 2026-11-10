/**
 * Where the app's data lives (VITE_DATA_MODE):
 * - "local"  (default) — this device's browser storage, no server needed
 * - "server" — same app, saved to your own server (/api/v1/planner/) and synced across devices
 * - "api"    — the full Django API at /api/v1/ (session auth + CSRF), as the backend grows
 * - "sample" — fixed sample data (design preview build)
 */
export type DataMode = 'local' | 'server' | 'api' | 'sample'

const envMode = import.meta.env.VITE_DATA_MODE as DataMode | undefined
export const DATA_MODE: DataMode = import.meta.env.MODE === 'preview' ? 'sample' : (envMode ?? 'local')

/** An API error with the standard {detail, code, fields} body (spec §13.2). */
export class ApiError extends Error {
  status: number
  code: string
  body: Record<string, unknown>
  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.detail === 'string' && body.detail ? body.detail : `Request failed (${status})`)
    this.status = status
    this.code = typeof body.code === 'string' ? body.code : 'error'
    this.body = body
  }
}

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
    throw new ApiError(res.status, body)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}
