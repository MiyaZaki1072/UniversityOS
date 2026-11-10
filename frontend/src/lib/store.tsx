import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { sampleDashboard } from '../data/sampleDashboard'
import { ApiError, apiFetch, DATA_MODE } from './api'
import type { ImportPlan } from './importConfig'
import { applyPlan, buildSummary, emptyDb, isLocalDb, loadDb, saveDb, STORAGE_KEY, type LocalDB } from './localDb'
import type { DashboardSummary } from './types'

export interface ImportOptions {
  /** Only used when the file contains a semester: make it the current one. */
  makeActive: boolean
  /** The parsed JSON exactly as the AI wrote it; the server validates it again. */
  raw: unknown
}

export interface ImportOutcome {
  courses: number
  semesterName: string
  shownOnDashboard: boolean
  skipped?: string[]
}

/** Edit the local database: change `draft` in place; `nid()` hands out new ids. */
export type Recipe = (draft: LocalDB, nid: () => number) => void

export interface Me {
  id: number
  username: string
  display_name: string
  timezone: string
}

/** Server mode only: is the user signed in? */
export type AuthState = 'checking' | 'signed_out' | 'ready'
/** Server mode only: where the latest change is. */
export type SyncState = 'saved' | 'saving' | 'offline' | 'error'

interface AppData {
  data: DashboardSummary | null
  loading: boolean
  error: string | null
  reload: () => void
  importOpen: boolean
  openImport: () => void
  closeImport: () => void
  applyImport: (plan: ImportPlan, opts: ImportOptions) => Promise<ImportOutcome>
  /** The planner on this device and how to change it (local and server modes). */
  db: LocalDB
  mutate: (recipe: Recipe) => void
  replaceDb: (next: LocalDB) => void
  saveFailed: boolean
  /** Server mode. */
  auth: AuthState
  me: Me | null
  sync: SyncState
  notice: string | null
  dismissNotice: () => void
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  syncNow: () => void
}

const Ctx = createContext<AppData | null>(null)

/* ------------------------------------------------------------------ */
/* Server sync bookkeeping (kept next to the cached planner)           */
/* ------------------------------------------------------------------ */

const META_KEY = 'university-os:sync'
interface SyncMeta {
  /** Server version this device's copy is based on. */
  base: number
  /** This device has changes the server hasn't got yet. */
  pending: boolean
  /** Whose planner is cached here. */
  user: number | null
}
interface RemoteState {
  version: number
  data: unknown
  updated_at: string | null
}

function loadMeta(): SyncMeta {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) ?? 'null')
    if (m && typeof m.base === 'number') return { base: m.base, pending: !!m.pending, user: m.user ?? null }
  } catch {
    /* fall through */
  }
  return { base: 0, pending: false, user: null }
}
function saveMeta(m: SyncMeta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(m))
  } catch {
    /* storage blocked; the in-memory copy still works */
  }
}
const hasData = (d: LocalDB) => d.courses.length > 0 || d.tasks.length > 0 || d.semester !== null
const isServer = DATA_MODE === 'server'
const usesLocalDb = DATA_MODE === 'local' || DATA_MODE === 'server'

function useMinuteTick() {
  const [tick, setTick] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return tick
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<LocalDB>(() => (usesLocalDb ? loadDb() : emptyDb()))
  const [saveFailed, setSaveFailed] = useState(false)
  const [apiData, setApiData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(DATA_MODE === 'api')
  const [error, setError] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [auth, setAuth] = useState<AuthState>(isServer ? 'checking' : 'ready')
  const [me, setMe] = useState<Me | null>(null)
  const [sync, setSync] = useState<SyncState>('saved')
  const [notice, setNotice] = useState<string | null>(null)
  const tick = useMinuteTick()

  const dbRef = useRef(db)
  const metaRef = useRef<SyncMeta>(isServer ? loadMeta() : { base: 0, pending: false, user: null })
  const timer = useRef<number | undefined>(undefined)
  const inflight = useRef(false)

  const setMeta = (m: SyncMeta) => {
    metaRef.current = m
    saveMeta(m)
  }

  /** Put a planner on screen and in this device's cache. */
  const show = useCallback((next: LocalDB) => {
    dbRef.current = next
    setSaveFailed(!saveDb(next))
    setDb(next)
  }, [])

  const adoptRemote = useCallback(
    (remote: RemoteState) => {
      show(isLocalDb(remote.data) ? remote.data : emptyDb())
      setMeta({ ...metaRef.current, base: remote.version, pending: false })
      setSync('saved')
    },
    [show],
  )

  const handleSyncError = useCallback((e: unknown) => {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      setAuth('signed_out')
      setNotice('You were signed out. Sign in again; changes on this device are kept and will be saved.')
    } else if (e instanceof ApiError) {
      setSync('error')
    } else {
      setSync('offline')
    }
  }, [])

  const push = useCallback(async () => {
    if (!isServer || inflight.current) return
    if (!metaRef.current.pending) {
      setSync('saved')
      return
    }
    inflight.current = true
    setSync('saving')
    const sent = dbRef.current
    try {
      const res = await apiFetch<RemoteState>('/planner/state/', {
        method: 'PUT',
        body: JSON.stringify({ base_version: metaRef.current.base, data: sent }),
      })
      const changedMeanwhile = dbRef.current !== sent
      setMeta({ ...metaRef.current, base: res.version, pending: changedMeanwhile })
      setSync(changedMeanwhile ? 'saving' : 'saved')
      if (changedMeanwhile) timer.current = window.setTimeout(() => void push(), 300)
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.body.current) {
        adoptRemote(e.body.current as RemoteState)
        setNotice('Your planner was changed on another device at the same time, so this device now shows the newest saved copy.')
      } else handleSyncError(e)
    } finally {
      inflight.current = false
    }
  }, [adoptRemote, handleSyncError])

  const schedulePush = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void push(), 700)
  }, [push])

  /** Fetch the server copy and reconcile with this device. */
  const pull = useCallback(async () => {
    if (!isServer || inflight.current) return
    try {
      const remote = await apiFetch<RemoteState>('/planner/state/')
      const meta = metaRef.current
      if (remote.version === 0) {
        // Nothing saved on the server yet: upload what this device has.
        if (hasData(dbRef.current)) {
          setMeta({ ...meta, base: 0, pending: true })
          await push()
        } else setSync('saved')
      } else if (meta.pending && remote.version === meta.base) {
        await push()
      } else if (remote.version !== meta.base || meta.pending) {
        if (meta.pending) setNotice('This device had unsaved changes, but a newer copy was saved from another device. Showing the newest copy.')
        adoptRemote(remote)
      } else setSync('saved')
    } catch (e) {
      handleSyncError(e)
    }
  }, [adoptRemote, handleSyncError, push])

  /** Change the planner (local and server modes). */
  const commit = useCallback(
    (next: LocalDB) => {
      show(next)
      if (isServer) {
        setMeta({ ...metaRef.current, pending: true })
        setSync('saving')
        schedulePush()
      }
    },
    [show, schedulePush],
  )

  const mutate = useCallback(
    (recipe: Recipe) => {
      const draft = structuredClone(dbRef.current)
      recipe(draft, () => draft.nextId++)
      commit(draft)
    },
    [commit],
  )

  /* Server mode: who is signed in? Then load the planner. */
  const startSession = useCallback(
    async (user: Me) => {
      if (metaRef.current.user !== null && metaRef.current.user !== user.id) {
        // A different account used this device before: don't mix planners.
        show(emptyDb())
        setMeta({ base: 0, pending: false, user: user.id })
      } else setMeta({ ...metaRef.current, user: user.id })
      setMe(user)
      setAuth('ready')
      await pull()
    },
    [pull, show],
  )

  useEffect(() => {
    if (!isServer) return
    let cancelled = false
    ;(async () => {
      try {
        await apiFetch('/auth/csrf/')
        const user = await apiFetch<Me>('/auth/me/')
        if (!cancelled) await startSession(user)
      } catch (e) {
        if (cancelled) return
        if (e instanceof ApiError) setAuth('signed_out')
        else {
          // Server unreachable: keep working from this device's copy if there is one.
          setAuth(hasData(dbRef.current) ? 'ready' : 'signed_out')
          setSync('offline')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [startSession])

  /* Server mode: catch up when the app comes back to the front, and retry while offline. */
  useEffect(() => {
    if (!isServer || auth !== 'ready') return
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      if (metaRef.current.pending) void push()
      else void pull()
    }
    const retry = window.setInterval(() => {
      if (metaRef.current.pending) void push()
    }, 20_000)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('online', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(retry)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('online', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [auth, pull, push])

  // Keep two open tabs on the same device in step.
  useEffect(() => {
    if (!usesLocalDb) return
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const next = loadDb()
        dbRef.current = next
        setDb(next)
      }
      if (e.key === META_KEY && isServer) metaRef.current = loadMeta()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const login = useCallback(
    async (username: string, password: string) => {
      await apiFetch('/auth/csrf/')
      const user = await apiFetch<Me>('/auth/login/', { method: 'POST', body: JSON.stringify({ username, password }) })
      await apiFetch('/auth/csrf/') // Django rotates the CSRF token on login.
      setNotice(null)
      await startSession(user)
    },
    [startSession],
  )

  const logout = useCallback(async () => {
    if (metaRef.current.pending) await push()
    await apiFetch('/auth/logout/', { method: 'POST' }).catch(() => undefined)
    // Don't leave this account's planner on a shared device.
    try {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(META_KEY)
    } catch {
      /* ignore */
    }
    metaRef.current = { base: 0, pending: false, user: null }
    dbRef.current = emptyDb()
    setDb(dbRef.current)
    setMe(null)
    setAuth('signed_out')
  }, [push])

  const reload = useCallback(() => {
    if (DATA_MODE !== 'api') return
    setLoading(true)
    setError(null)
    apiFetch<DashboardSummary>('/dashboard/summary/')
      .then(setApiData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(reload, [reload])

  const data = useMemo<DashboardSummary | null>(() => {
    if (DATA_MODE === 'sample') return sampleDashboard
    if (DATA_MODE === 'api') return apiData
    return buildSummary(db, new Date(tick))
  }, [db, apiData, tick])

  const applyImport = useCallback(
    async (plan: ImportPlan, opts: ImportOptions): Promise<ImportOutcome> => {
      if (DATA_MODE === 'api') {
        const res = await apiFetch<{ courses_created: number; semester: { name: string; is_active: boolean } }>(
          '/imports/academic/',
          { method: 'POST', body: JSON.stringify({ config: opts.raw, make_active: opts.makeActive, dry_run: false }) },
        )
        reload()
        return { courses: res.courses_created, semesterName: res.semester.name, shownOnDashboard: res.semester.is_active }
      }
      const { next, added, skipped } = applyPlan(dbRef.current, plan, opts.makeActive)
      commit(next)
      return { courses: added, semesterName: next.semester?.name ?? 'current semester', shownOnDashboard: true, skipped }
    },
    [commit, reload],
  )

  const value = useMemo<AppData>(
    () => ({
      data,
      loading,
      error,
      reload,
      importOpen,
      openImport: () => setImportOpen(true),
      closeImport: () => setImportOpen(false),
      applyImport,
      db,
      mutate,
      replaceDb: commit,
      saveFailed,
      auth,
      me,
      sync,
      notice,
      dismissNotice: () => setNotice(null),
      login,
      logout,
      syncNow: () => (metaRef.current.pending ? void push() : void pull()),
    }),
    [data, loading, error, reload, importOpen, applyImport, db, mutate, commit, saveFailed, auth, me, sync, notice, login, logout, push, pull],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAppData(): AppData {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAppData must be used inside <AppDataProvider>')
  return v
}
