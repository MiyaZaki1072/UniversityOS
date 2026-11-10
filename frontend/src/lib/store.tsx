import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { sampleDashboard } from '../data/sampleDashboard'
import { apiFetch, DATA_MODE } from './api'
import type { ImportPlan } from './importConfig'
import { applyPlan, buildSummary, emptyDb, loadDb, saveDb, STORAGE_KEY, type LocalDB } from './localDb'
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

interface AppData {
  data: DashboardSummary | null
  loading: boolean
  error: string | null
  reload: () => void
  importOpen: boolean
  openImport: () => void
  closeImport: () => void
  applyImport: (plan: ImportPlan, opts: ImportOptions) => Promise<ImportOutcome>
  /** Local mode: the on-device database and how to change it. */
  db: LocalDB
  mutate: (recipe: Recipe) => void
  replaceDb: (next: LocalDB) => void
  saveFailed: boolean
}

const Ctx = createContext<AppData | null>(null)

function useMinuteTick() {
  const [tick, setTick] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return tick
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<LocalDB>(() => (DATA_MODE === 'local' ? loadDb() : emptyDb()))
  const [saveFailed, setSaveFailed] = useState(false)
  const [apiData, setApiData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(DATA_MODE === 'api')
  const [error, setError] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const tick = useMinuteTick()

  // Keep two open tabs in sync.
  useEffect(() => {
    if (DATA_MODE !== 'local') return
    const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && setDb(loadDb())
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const commit = useCallback((next: LocalDB) => {
    setSaveFailed(!saveDb(next))
    setDb(next)
  }, [])

  const mutate = useCallback(
    (recipe: Recipe) => {
      const draft = structuredClone(db)
      recipe(draft, () => draft.nextId++)
      commit(draft)
    },
    [db, commit],
  )

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
      const { next, added, skipped } = applyPlan(db, plan, opts.makeActive)
      commit(next)
      return { courses: added, semesterName: next.semester?.name ?? 'current semester', shownOnDashboard: true, skipped }
    },
    [db, commit, reload],
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
    }),
    [data, loading, error, reload, importOpen, applyImport, db, mutate, commit, saveFailed],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAppData(): AppData {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAppData must be used inside <AppDataProvider>')
  return v
}
