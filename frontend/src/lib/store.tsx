import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { sampleDashboard } from '../data/sampleDashboard'
import { apiFetch, USE_SAMPLE } from './api'
import type { ImportPlan, PlanCourse } from './importConfig'
import type { CourseRef, DashboardSummary, GradeStanding, Occurrence } from './types'

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
}

interface AppData {
  data: DashboardSummary | null
  loading: boolean
  error: string | null
  reload: () => void
  importOpen: boolean
  openImport: () => void
  closeImport: () => void
  applyImport: (plan: ImportPlan, opts: ImportOptions) => Promise<ImportOutcome>
}

const Ctx = createContext<AppData | null>(null)

/* ------------------------------------------------------------------ */
/* Sample-mode import: mirrors what the backend will return so the     */
/* design preview reacts to an import. The server is authoritative.    */
/* ------------------------------------------------------------------ */

function standingFor(courseId: number, c: PlanCourse): GradeStanding {
  const total = c.weight_total
  const weight_status: GradeStanding['weight_status'] =
    c.categories.length === 0 ? 'empty' : total === 100 ? 'valid' : total < 100 ? 'underweight' : 'invalid'

  let contribution = 0
  let gradedWeight = 0
  let ungraded = 0
  let everyCategoryGraded = true
  for (const g of c.categories) {
    const graded = g.assessments.filter((a) => a.points_earned !== null)
    ungraded += g.assessments.length - graded.length
    if (graded.length === 0) {
      if (Number(g.weight_percent) > 0) everyCategoryGraded = false
      continue
    }
    const earned = graded.reduce((s, a) => s + Number(a.points_earned), 0)
    const possible = graded.reduce((s, a) => s + Number(a.points_possible), 0)
    contribution += ((earned / possible) * 100 * Number(g.weight_percent)) / 100
    gradedWeight += Number(g.weight_percent)
  }
  const current = gradedWeight > 0 ? (contribution / gradedWeight) * 100 : null
  const band = (pct: number) => c.scale.find((b) => pct >= Number(b.minimum_percentage))?.grade_label ?? null
  const isFinal = weight_status === 'valid' && everyCategoryGraded && ungraded === 0
  const projected = weight_status === 'valid' && current !== null && c.scale.length ? band(current) : null

  return {
    course_id: courseId,
    current_grade: current === null ? null : String(current),
    graded_category_weight: gradedWeight.toFixed(2),
    weight_status,
    projected_letter_grade: projected,
    letter_grade: isFinal ? projected : null,
    is_final: isFinal,
    ungraded_assessments: ungraded,
  }
}

function localPlan(prev: DashboardSummary, plan: ImportPlan, opts: ImportOptions): { next: DashboardSummary; outcome: ImportOutcome } {
  const replacing = plan.semester !== null && opts.makeActive
  const semester = replacing
    ? { id: Date.now(), name: plan.semester!.name, start_date: plan.semester!.start_date, end_date: plan.semester!.end_date }
    : prev.active_semester

  // A new semester that isn't made current is filed but not shown on today's briefing.
  if (plan.semester && !opts.makeActive) {
    return { next: prev, outcome: { courses: plan.courses.length, semesterName: plan.semester.name, shownOnDashboard: false } }
  }

  const base: DashboardSummary = replacing
    ? {
        ...prev,
        active_semester: semester,
        courses: [],
        today: { classes: [], events: [], tasks: [] },
        upcoming_exams: [],
        upcoming_deadlines: [],
        grade_standing: [],
      }
    : prev

  const today = prev.date
  const todayWeekday = (new Date(`${today}T12:00:00+07:00`).getUTCDay() + 6) % 7
  const weekAhead = new Date(`${today}T00:00:00+07:00`).getTime() + 8 * 86_400_000
  const now = Date.now()
  let nextId = Math.max(0, ...base.courses.map((c) => c.id)) + 1

  const courses: CourseRef[] = []
  const standings: GradeStanding[] = []
  const classes: Occurrence[] = []
  const events: Occurrence[] = []
  const exams: Occurrence[] = []
  const deadlines: Occurrence[] = []

  for (const c of plan.courses) {
    const id = nextId++
    courses.push({ id, code: c.code, name: c.name, color: c.color })
    standings.push(standingFor(id, c))

    c.meetings.forEach((m, j) => {
      const from = m.starts_on ?? semester?.start_date ?? today
      const to = m.ends_on ?? semester?.end_date ?? today
      if (m.weekday === todayWeekday && today >= from && today <= to) {
        classes.push({
          id: `class-new${id}${j}-${today.replace(/-/g, '')}`,
          source_type: 'class_meeting',
          title: c.name,
          start_at: `${today}T${m.start_time}+07:00`,
          end_at: `${today}T${m.end_time}+07:00`,
          location: m.location || null,
          course_id: id,
        })
      }
    })

    c.exams.forEach((e, j) => {
      const occ: Occurrence = {
        id: `event-new${id}${j}`,
        source_type: 'calendar_event',
        event_type: e.event_type,
        title: e.title,
        start_at: e.start_at,
        end_at: e.end_at,
        location: e.location || null,
        course_id: id,
      }
      if (e.start_at.startsWith(today)) events.push(occ)
      if (e.event_type === 'EXAM' && Date.parse(e.start_at) > now) exams.push(occ)
    })

    c.categories.forEach((g, j) =>
      g.assessments.forEach((a, k) => {
        if (!a.due_at) return
        const due = Date.parse(a.due_at)
        if (due >= now && due < weekAhead) {
          deadlines.push({
            id: `assessment-new${id}${j}${k}`,
            source_type: 'assessment_deadline',
            title: a.title,
            start_at: a.due_at,
            end_at: a.due_at,
            location: null,
            course_id: id,
          })
        }
      }),
    )
  }

  const byStart = (a: Occurrence, b: Occurrence) => Date.parse(a.start_at) - Date.parse(b.start_at)
  const next: DashboardSummary = {
    ...base,
    courses: [...base.courses, ...courses],
    grade_standing: [...base.grade_standing, ...standings],
    today: {
      ...base.today,
      classes: [...base.today.classes, ...classes].sort(byStart),
      events: [...base.today.events, ...events].sort(byStart),
    },
    upcoming_exams: [...base.upcoming_exams, ...exams].sort(byStart),
    upcoming_deadlines: [...base.upcoming_deadlines, ...deadlines].sort(byStart),
  }

  return {
    next,
    outcome: { courses: plan.courses.length, semesterName: semester?.name ?? 'current semester', shownOnDashboard: true },
  }
}

/* ------------------------------------------------------------------ */

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DashboardSummary | null>(USE_SAMPLE ? sampleDashboard : null)
  const [loading, setLoading] = useState(!USE_SAMPLE)
  const [error, setError] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const reload = useCallback(() => {
    if (USE_SAMPLE) return
    setLoading(true)
    setError(null)
    apiFetch<DashboardSummary>('/dashboard/summary/')
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(reload, [reload])

  const applyImport = useCallback(
    async (plan: ImportPlan, opts: ImportOptions): Promise<ImportOutcome> => {
      if (!USE_SAMPLE) {
        const res = await apiFetch<{ courses_created: number; semester: { name: string; is_active: boolean } }>(
          '/imports/academic/',
          { method: 'POST', body: JSON.stringify({ config: opts.raw, make_active: opts.makeActive, dry_run: false }) },
        )
        reload()
        return { courses: res.courses_created, semesterName: res.semester.name, shownOnDashboard: res.semester.is_active }
      }
      if (!data) throw new Error('Nothing loaded yet.')
      const { next, outcome } = localPlan(data, plan, opts)
      setData(next)
      return outcome
    },
    [data, reload],
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
    }),
    [data, loading, error, reload, importOpen, applyImport],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAppData(): AppData {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAppData must be used inside <AppDataProvider>')
  return v
}
