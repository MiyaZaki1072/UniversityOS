/**
 * Local (on-device) data store. Everything lives in this browser's localStorage,
 * so the app works with no server. The shapes follow the API spec closely so the
 * data can be moved to the backend later via the backup file.
 */
import { USER_TZ } from './format'
import { COURSE_COLORS, type ImportPlan, type PlanBand } from './importConfig'
import type { CourseRef, DashboardSummary, GradeStanding, Occurrence } from './types'

export const STORAGE_KEY = 'university-os:v1'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface LMeeting {
  id: number
  weekday: number // 0 = Monday
  start_time: string // HH:MM:SS
  end_time: string
  location: string
  starts_on: string | null
  ends_on: string | null
}

export interface LAssessment {
  id: number
  title: string
  points_possible: string
  points_earned: string | null
  due_at: string | null
}

export interface LCategory {
  id: number
  name: string
  weight_percent: string
  assessments: LAssessment[]
}

export interface LExam {
  id: number
  title: string
  event_type: 'EXAM' | 'QUIZ'
  start_at: string
  end_at: string
  location: string
}

export interface LResource {
  id: number
  title: string
  url: string
  description: string
}

export interface LCourse {
  id: number
  code: string
  name: string
  credits: string
  instructor: string
  color: string
  meetings: LMeeting[]
  categories: LCategory[]
  scale: PlanBand[]
  exams: LExam[]
  resources: LResource[]
}

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH'

export interface LTask {
  id: number
  title: string
  course_id: number | null
  due_at: string | null
  status: TaskStatus
  priority: TaskPriority
  notes: string
  completed_at: string | null
}

export interface LSemester {
  name: string
  start_date: string
  end_date: string
}

export interface LHabit {
  id: number
  name: string
  /** DAILY = every day. WEEKLY = `target_per_week` times a week. */
  frequency: 'DAILY' | 'WEEKLY'
  target_per_week: number
  target_minutes: number | null
  archived: boolean
  created_on: string // YYYY-MM-DD
}

/** One completed day of a habit. At most one per habit per date. */
export interface LHabitLog {
  habit_id: number
  date: string // YYYY-MM-DD
}

export interface LStudySession {
  id: number
  course_id: number | null
  started_at: string // ISO
  /** null while the timer is running. At most one running session. */
  ended_at: string | null
  note: string
}

/** A saved link, global (course_id null) or for one course. */
export interface LLink {
  id: number
  title: string
  url: string
  description: string
  course_id: number | null
  category: string
  favorite: boolean
}

export interface LSettings {
  weekly_study_target_minutes: number
}

export interface LocalDB {
  version: 1
  semester: LSemester | null
  courses: LCourse[]
  tasks: LTask[]
  habits: LHabit[]
  habitLogs: LHabitLog[]
  studySessions: LStudySession[]
  links: LLink[]
  settings: LSettings
  nextId: number
}

export const emptyDb = (): LocalDB => ({
  version: 1,
  semester: null,
  courses: [],
  tasks: [],
  habits: [],
  habitLogs: [],
  studySessions: [],
  links: [],
  settings: { weekly_study_target_minutes: 1200 },
  nextId: 1,
})

/**
 * Bring an older saved planner up to the current shape: fill in collections added later
 * and move per-course imported links into the shared `links` list.
 */
export function normalizeDb(raw: LocalDB): LocalDB {
  const base = emptyDb()
  const db: LocalDB = {
    ...base,
    ...raw,
    habits: raw.habits ?? [],
    habitLogs: raw.habitLogs ?? [],
    studySessions: raw.studySessions ?? [],
    links: [...(raw.links ?? [])],
    settings: { ...base.settings, ...(raw.settings ?? {}) },
  }
  if (db.courses.some((c) => c.resources?.length)) {
    db.courses = db.courses.map((c) => {
      for (const r of c.resources ?? []) {
        db.links.push({ id: r.id, title: r.title, url: r.url, description: r.description, course_id: c.id, category: '', favorite: false })
      }
      return { ...c, resources: [] }
    })
  }
  // Links are rendered as <a href>; only web addresses are allowed (a restored file could hold anything).
  db.links = db.links.filter((l) => typeof l.url === 'string' && /^https?:\/\//i.test(l.url))
  return db
}

/** Default scale (spec §5.4): 80 → A, 79.99 → B+. Highest band first. */
export const DEFAULT_SCALE: PlanBand[] = [
  { grade_label: 'A', minimum_percentage: '80', grade_point: '4' },
  { grade_label: 'B+', minimum_percentage: '75', grade_point: '3.5' },
  { grade_label: 'B', minimum_percentage: '70', grade_point: '3' },
  { grade_label: 'C+', minimum_percentage: '65', grade_point: '2.5' },
  { grade_label: 'C', minimum_percentage: '60', grade_point: '2' },
  { grade_label: 'D+', minimum_percentage: '55', grade_point: '1.5' },
  { grade_label: 'D', minimum_percentage: '50', grade_point: '1' },
  { grade_label: 'F', minimum_percentage: '0', grade_point: '0' },
]

/* ------------------------------------------------------------------ */
/* Load / save                                                         */
/* ------------------------------------------------------------------ */

export function isLocalDb(v: unknown): v is LocalDB {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return o.version === 1 && Array.isArray(o.courses) && Array.isArray(o.tasks) && typeof o.nextId === 'number'
}

export function loadDb(): LocalDB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyDb()
    const parsed: unknown = JSON.parse(raw)
    return isLocalDb(parsed) ? normalizeDb(parsed) : emptyDb()
  } catch {
    return emptyDb()
  }
}

export function saveDb(db: LocalDB): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
    return true
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

export const todayKey = (d: Date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: USER_TZ }).format(d)

/** 0 = Monday … 6 = Sunday for a YYYY-MM-DD date. */
export const weekdayOf = (dateKey: string) => (new Date(`${dateKey}T12:00:00+07:00`).getUTCDay() + 6) % 7

export const addDays = (dateKey: string, n: number) =>
  new Date(Date.parse(`${dateKey}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

/** Monday of the week containing dateKey. */
export const weekStart = (dateKey: string) => addDays(dateKey, -weekdayOf(dateKey))

/** "2026-11-10T09:00" (datetime-local input) → ISO with Bangkok offset. */
export const fromLocalInput = (v: string) => (v ? `${v.length === 16 ? `${v}:00` : v}+07:00` : null)

/** ISO → "2026-11-10T09:00" for a datetime-local input, in the user's timezone. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const date = todayKey(d)
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: USER_TZ }).format(d)
  return `${date}T${time}`
}

/* ------------------------------------------------------------------ */
/* Grades (same rules as spec §5.3; display-only precision)            */
/* ------------------------------------------------------------------ */

export function weightTotal(c: LCourse): number {
  return Math.round(c.categories.reduce((s, g) => s + Number(g.weight_percent), 0) * 100) / 100
}

export function standingFor(c: LCourse): GradeStanding {
  const total = weightTotal(c)
  const weight_status: GradeStanding['weight_status'] =
    c.categories.length === 0 ? 'empty' : total === 100 ? 'valid' : total < 100 ? 'underweight' : 'invalid'

  let contribution = 0
  let gradedWeight = 0
  let ungraded = 0
  for (const g of c.categories) {
    const graded = g.assessments.filter((a) => a.points_earned !== null && a.points_earned !== '')
    ungraded += g.assessments.length - graded.length
    if (graded.length === 0) continue
    const earned = graded.reduce((s, a) => s + Number(a.points_earned), 0)
    const possible = graded.reduce((s, a) => s + Number(a.points_possible), 0)
    if (possible <= 0) continue
    contribution += (earned / possible) * Number(g.weight_percent)
    gradedWeight += Number(g.weight_percent)
  }
  const current = gradedWeight > 0 ? (contribution / gradedWeight) * 100 : null
  const scale = c.scale.length ? c.scale : DEFAULT_SCALE
  const band = (pct: number) =>
    [...scale].sort((a, b) => Number(b.minimum_percentage) - Number(a.minimum_percentage)).find((b) => pct >= Number(b.minimum_percentage))
      ?.grade_label ?? null
  const isFinal = weight_status === 'valid' && ungraded === 0 && c.categories.every((g) => g.assessments.length > 0)
  const projected = weight_status === 'valid' && current !== null ? band(current) : null

  return {
    course_id: c.id,
    current_grade: current === null ? null : String(current),
    graded_category_weight: gradedWeight.toFixed(2),
    weight_status,
    projected_letter_grade: projected,
    letter_grade: isFinal ? projected : null,
    is_final: isFinal,
    ungraded_assessments: ungraded,
  }
}

/* ------------------------------------------------------------------ */
/* Occurrences (calendar items) for any date range                     */
/* ------------------------------------------------------------------ */

export function meetingActiveOn(m: LMeeting, dateKey: string, semester: LSemester | null): boolean {
  const from = m.starts_on ?? semester?.start_date ?? null
  const to = m.ends_on ?? semester?.end_date ?? null
  return m.weekday === weekdayOf(dateKey) && (!from || dateKey >= from) && (!to || dateKey <= to)
}

/** All occurrences between two dates (inclusive), sorted by start. */
export function occurrencesBetween(db: LocalDB, fromKey: string, toKey: string): Occurrence[] {
  const out: Occurrence[] = []
  for (let d = fromKey; d <= toKey; d = addDays(d, 1)) {
    for (const c of db.courses) {
      for (const m of c.meetings) {
        if (!meetingActiveOn(m, d, db.semester)) continue
        out.push({
          id: `class-${m.id}-${d}`,
          source_type: 'class_meeting',
          title: c.name,
          start_at: `${d}T${m.start_time}+07:00`,
          end_at: `${d}T${m.end_time}+07:00`,
          location: m.location || null,
          course_id: c.id,
        })
      }
    }
  }
  const inRange = (iso: string) => {
    const k = todayKey(new Date(iso))
    return k >= fromKey && k <= toKey
  }
  for (const c of db.courses) {
    for (const e of c.exams) {
      if (!inRange(e.start_at)) continue
      out.push({
        id: `event-${e.id}`,
        source_type: 'calendar_event',
        event_type: e.event_type,
        title: e.title,
        start_at: e.start_at,
        end_at: e.end_at,
        location: e.location || null,
        course_id: c.id,
      })
    }
    for (const g of c.categories) {
      for (const a of g.assessments) {
        if (!a.due_at || a.points_earned !== null || !inRange(a.due_at)) continue
        out.push({
          id: `assessment-${a.id}`,
          source_type: 'assessment_deadline',
          title: a.title,
          start_at: a.due_at,
          end_at: a.due_at,
          location: null,
          course_id: c.id,
        })
      }
    }
  }
  for (const t of db.tasks) {
    if (!t.due_at || t.status === 'COMPLETED' || !inRange(t.due_at)) continue
    out.push(taskOccurrence(t))
  }
  return out.sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at))
}

export function taskOccurrence(t: LTask): Occurrence {
  return {
    id: `task-${t.id}`,
    source_type: 'task_deadline',
    title: t.title,
    start_at: t.due_at!,
    end_at: t.due_at!,
    location: null,
    course_id: t.course_id,
    status: t.status,
    priority: t.priority,
  }
}

/* ------------------------------------------------------------------ */
/* Habits                                                              */
/* ------------------------------------------------------------------ */

export const habitDoneOn = (db: LocalDB, habitId: number, dateKey: string) =>
  db.habitLogs.some((l) => l.habit_id === habitId && l.date === dateKey)

/** How many times a habit was done in the Monday-Sunday week containing dateKey. */
export function habitWeekCount(db: LocalDB, habitId: number, dateKey: string): number {
  const from = weekStart(dateKey)
  const to = addDays(from, 6)
  return db.habitLogs.filter((l) => l.habit_id === habitId && l.date >= from && l.date <= to).length
}

/**
 * Current streak in days. Daily habits: consecutive done days ending today (or yesterday if
 * today is not done yet). Weekly habits: consecutive weeks that met the target, times 7.
 */
export function habitStreak(db: LocalDB, habit: LHabit, today: string): number {
  if (habit.frequency === 'WEEKLY') {
    const target = Math.max(1, habit.target_per_week)
    let week = weekStart(today)
    if (habitWeekCount(db, habit.id, week) < target) week = addDays(week, -7)
    let weeks = 0
    while (weeks < 520 && habitWeekCount(db, habit.id, week) >= target) {
      weeks++
      week = addDays(week, -7)
    }
    return weeks * 7
  }
  const done = new Set(db.habitLogs.filter((l) => l.habit_id === habit.id).map((l) => l.date))
  let day = done.has(today) ? today : addDays(today, -1)
  let n = 0
  while (done.has(day)) {
    n++
    day = addDays(day, -1)
  }
  return n
}

export function habitsToday(db: LocalDB, today: string): DashboardSummary['habits'] {
  const items = db.habits
    .filter((h) => !h.archived)
    .map((h) => ({
      id: h.id,
      name: h.name,
      target_minutes: h.target_minutes,
      completed: habitDoneOn(db, h.id, today),
      streak_days: habitStreak(db, h, today),
    }))
  return { completed: items.filter((i) => i.completed).length, total: items.length, items }
}

/* ------------------------------------------------------------------ */
/* Study sessions                                                      */
/* ------------------------------------------------------------------ */

/** Whole minutes of a session; a running session counts up to `now`. */
export function sessionMinutes(s: LStudySession, now: Date = new Date()): number {
  const end = s.ended_at ? Date.parse(s.ended_at) : now.getTime()
  return Math.max(0, Math.floor((end - Date.parse(s.started_at)) / 60_000))
}

/** Minutes studied on a date (a session belongs to the day it started, in the user's timezone). */
export function studyMinutesOn(db: LocalDB, dateKey: string, now: Date = new Date()): number {
  return db.studySessions.filter((s) => todayKey(new Date(s.started_at)) === dateKey).reduce((t, s) => t + sessionMinutes(s, now), 0)
}

export const activeSession = (db: LocalDB) => db.studySessions.find((s) => s.ended_at === null) ?? null

export function studySummary(db: LocalDB, now: Date = new Date()): DashboardSummary['study'] {
  const today = todayKey(now)
  const monday = weekStart(today)
  const week_by_day = Array.from({ length: 7 }, (_, i) => studyMinutesOn(db, addDays(monday, i), now))
  return {
    today_minutes: studyMinutesOn(db, today, now),
    week_minutes: week_by_day.reduce((a, b) => a + b, 0),
    week_by_day,
    weekly_target_minutes: db.settings.weekly_study_target_minutes,
  }
}

/* ------------------------------------------------------------------ */
/* Dashboard summary                                                   */
/* ------------------------------------------------------------------ */

export function courseRef(c: LCourse): CourseRef {
  return { id: c.id, code: c.code, name: c.name, color: c.color }
}

export function buildSummary(db: LocalDB, now: Date = new Date()): DashboardSummary {
  const today = todayKey(now)
  const todays = occurrencesBetween(db, today, today)
  const weekAhead = addDays(today, 7)
  const nowMs = now.getTime()

  const exams: Occurrence[] = db.courses
    .flatMap((c) =>
      c.exams.map<Occurrence>((e) => ({
        id: `event-${e.id}`,
        source_type: 'calendar_event',
        event_type: e.event_type,
        title: e.title,
        start_at: e.start_at,
        end_at: e.end_at,
        location: e.location || null,
        course_id: c.id,
      })),
    )
    .filter((e) => Date.parse(e.end_at) >= nowMs)
    .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at))

  // Open work due within 7 days, plus anything overdue that is still open.
  const deadlines: Occurrence[] = [
    ...db.tasks.filter((t) => t.due_at && t.status !== 'COMPLETED').map(taskOccurrence),
    ...db.courses.flatMap((c) =>
      c.categories.flatMap((g) =>
        g.assessments
          .filter((a) => a.due_at && a.points_earned === null && Date.parse(a.due_at) >= nowMs)
          .map<Occurrence>((a) => ({
            id: `assessment-${a.id}`,
            source_type: 'assessment_deadline',
            title: a.title,
            start_at: a.due_at!,
            end_at: a.due_at!,
            location: null,
            course_id: c.id,
          })),
      ),
    ),
  ]
    .filter((o) => todayKey(new Date(o.end_at)) <= weekAhead)
    .sort((a, b) => Date.parse(a.end_at) - Date.parse(b.end_at))

  return {
    date: today,
    active_semester: db.semester ? { id: 1, ...db.semester } : null,
    courses: db.courses.map(courseRef),
    today: {
      classes: todays.filter((o) => o.source_type === 'class_meeting'),
      events: todays.filter((o) => o.source_type === 'calendar_event'),
      tasks: todays.filter((o) => o.source_type === 'task_deadline' || o.source_type === 'assessment_deadline'),
    },
    upcoming_exams: exams,
    upcoming_deadlines: deadlines,
    habits: habitsToday(db, today),
    study: studySummary(db, now),
    grade_standing: db.courses.map(standingFor),
  }
}

/* ------------------------------------------------------------------ */
/* Import from the AI file                                             */
/* ------------------------------------------------------------------ */

export function applyPlan(db: LocalDB, plan: ImportPlan, makeActive: boolean): { next: LocalDB; added: number; skipped: string[] } {
  let id = db.nextId
  const nid = () => id++
  const sameSemester = plan.semester !== null && db.semester !== null && plan.semester.name.trim() === db.semester.name.trim()
  const replaceSemester = plan.semester !== null && !sameSemester && (makeActive || db.semester === null)
  // A new semester replaces the current one (one semester at a time on this device).
  const keep = replaceSemester ? [] : db.courses
  const existing = new Set(keep.map((c) => c.code.toUpperCase()))
  const skipped: string[] = []
  const added: LCourse[] = []

  for (const pc of plan.courses) {
    if (existing.has(pc.code.toUpperCase())) {
      skipped.push(pc.code)
      continue
    }
    existing.add(pc.code.toUpperCase())
    added.push({
      id: nid(),
      code: pc.code,
      name: pc.name,
      credits: pc.credits,
      instructor: pc.instructor,
      color: pc.color || COURSE_COLORS[(keep.length + added.length) % COURSE_COLORS.length],
      meetings: pc.meetings.map((m) => ({ id: nid(), ...m })),
      categories: pc.categories.map((g) => ({
        id: nid(),
        name: g.name,
        weight_percent: g.weight_percent,
        assessments: g.assessments.map((a) => ({ id: nid(), ...a })),
      })),
      scale: pc.scale.length ? pc.scale : DEFAULT_SCALE,
      exams: pc.exams.map((e) => ({ id: nid(), ...e })),
      resources: pc.resources.map((r) => ({ id: nid(), ...r })),
    })
  }

  const semester: LSemester | null = replaceSemester
    ? { name: plan.semester!.name, start_date: plan.semester!.start_date, end_date: plan.semester!.end_date }
    : db.semester

  // Tasks linked to removed courses become unlinked rather than lost.
  const keptIds = new Set(keep.map((c) => c.id))
  const tasks = db.tasks.map((t) => (t.course_id !== null && !keptIds.has(t.course_id) ? { ...t, course_id: null } : t))

  // Links and study sessions of removed courses stay, just without a course.
  const unlink = <T extends { course_id: number | null }>(x: T): T => (x.course_id !== null && !keptIds.has(x.course_id) ? { ...x, course_id: null } : x)
  const next = normalizeDb({
    ...db,
    semester,
    courses: [...keep, ...added],
    tasks,
    links: db.links.map(unlink),
    studySessions: db.studySessions.map(unlink),
    nextId: id,
  })
  return { next, added: added.length, skipped }
}
