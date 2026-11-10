/**
 * "University OS import format v1" — a JSON file an AI (ChatGPT, Claude, Gemini…)
 * writes from a syllabus, timetable or screenshot. This module cleans it up,
 * validates it and turns it into a plan the user can review before anything is saved.
 *
 * The backend re-validates the same rules at POST /api/v1/imports/academic/
 * (see docs/AI_IMPORT_GUIDE.md); this copy exists so mistakes show up instantly.
 */

export const IMPORT_FORMAT = 'university-os/v1'
const DEFAULT_OFFSET = '+07:00'

/** Colors assigned to courses that arrive without one (match the app palette). */
export const COURSE_COLORS = ['#D8693A', '#8C8A5E', '#D9A64A', '#6F8A86', '#A2574A', '#9FAA80', '#B88A5C', '#7D6A9A']

/* ------------------------------------------------------------------ */
/* Normalized plan                                                     */
/* ------------------------------------------------------------------ */

export interface PlanMeeting {
  weekday: number // 0 = Monday
  start_time: string // HH:MM:SS
  end_time: string
  location: string
  starts_on: string | null
  ends_on: string | null
}

export interface PlanAssessment {
  title: string
  points_possible: string
  points_earned: string | null
  due_at: string | null
}

export interface PlanCategory {
  name: string
  weight_percent: string
  assessments: PlanAssessment[]
}

export interface PlanBand {
  grade_label: string
  minimum_percentage: string
  grade_point: string
}

export interface PlanExam {
  title: string
  event_type: 'EXAM' | 'QUIZ'
  start_at: string
  end_at: string
  location: string
}

export interface PlanResource {
  title: string
  url: string
  description: string
}

export interface PlanCourse {
  code: string
  name: string
  credits: string
  instructor: string
  color: string
  meetings: PlanMeeting[]
  categories: PlanCategory[]
  weight_total: number
  scale: PlanBand[]
  exams: PlanExam[]
  resources: PlanResource[]
}

export interface PlanSemester {
  name: string
  academic_year: string
  term: string
  start_date: string
  end_date: string
}

export interface ImportPlan {
  semester: PlanSemester | null
  courses: PlanCourse[]
  notes: string[]
  counts: {
    courses: number
    meetings: number
    categories: number
    assessments: number
    exams: number
    resources: number
  }
}

export interface Issue {
  path: string
  message: string
}

export interface ParseResult {
  plan: ImportPlan | null
  errors: Issue[]
  warnings: Issue[]
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')

const WEEKDAYS: Record<string, number> = {
  MON: 0, MONDAY: 0, TUE: 1, TUES: 1, TUESDAY: 1, WED: 2, WEDNESDAY: 2,
  THU: 3, THUR: 3, THURS: 3, THURSDAY: 3, FRI: 4, FRIDAY: 4,
  SAT: 5, SATURDAY: 5, SUN: 6, SUNDAY: 6,
}

/** AIs often wrap JSON in ``` fences or add a sentence before it. Pull out the object. */
export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  return start !== -1 && end > start ? body.slice(start, end + 1) : body.trim()
}

class Checker {
  errors: Issue[] = []
  warnings: Issue[] = []
  err(path: string, message: string) {
    this.errors.push({ path, message })
  }
  warn(path: string, message: string) {
    this.warnings.push({ path, message })
  }

  text(o: Obj, key: string, path: string, opts: { required?: boolean; max?: number } = {}): string {
    const v = str(o[key])
    if (!v && opts.required) this.err(`${path}.${key}`, 'is required.')
    if (opts.max && v.length > opts.max) this.err(`${path}.${key}`, `must be ${opts.max} characters or fewer.`)
    return v
  }

  decimal(v: unknown, path: string, opts: { required?: boolean; min?: number; max?: number; gtZero?: boolean } = {}): string | null {
    if (v === null || v === undefined || v === '') {
      if (opts.required) this.err(path, 'is required.')
      return null
    }
    const n = typeof v === 'number' ? v : Number(String(v).replace('%', '').trim())
    if (!Number.isFinite(n)) {
      this.err(path, `"${String(v)}" is not a number.`)
      return null
    }
    if (opts.gtZero && n <= 0) this.err(path, 'must be greater than 0.')
    if (opts.min !== undefined && n < opts.min) this.err(path, `must be at least ${opts.min}.`)
    if (opts.max !== undefined && n > opts.max) this.err(path, `must be at most ${opts.max}.`)
    return String(Math.round(n * 100) / 100)
  }

  date(v: unknown, path: string, required = false): string | null {
    const s = str(v)
    if (!s) {
      if (required) this.err(path, 'is required (YYYY-MM-DD).')
      return null
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`))) {
      this.err(path, `"${s}" should be a date like 2026-08-01.`)
      return null
    }
    return s
  }

  time(v: unknown, path: string): string | null {
    const s = str(v)
    const m = s.match(/^(\d{1,2})[:.](\d{2})(?::(\d{2}))?$/)
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) {
      this.err(path, s ? `"${s}" should be a 24-hour time like 09:00.` : 'is required (HH:MM).')
      return null
    }
    return `${m[1].padStart(2, '0')}:${m[2]}:${m[3] ?? '00'}`
  }

  datetime(v: unknown, path: string, required = false): string | null {
    let s = str(v)
    if (!s) {
      if (required) this.err(path, 'is required (YYYY-MM-DDTHH:MM).')
      return null
    }
    s = s.replace(' ', 'T')
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += 'T23:59:00'
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) s += ':00'
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) {
      this.warn(path, `No timezone given; assumed Bangkok time (${DEFAULT_OFFSET}).`)
      s += DEFAULT_OFFSET
    }
    if (Number.isNaN(Date.parse(s))) {
      this.err(path, `"${str(v)}" should look like 2026-11-24T13:00:00+07:00.`)
      return null
    }
    return s
  }

  list(o: Obj, key: string, path: string): unknown[] {
    const v = o[key]
    if (v === undefined || v === null) return []
    if (!Array.isArray(v)) {
      this.err(`${path}.${key}`, 'should be a list [ … ].')
      return []
    }
    return v
  }
}

/* ------------------------------------------------------------------ */
/* Parse + validate                                                    */
/* ------------------------------------------------------------------ */

export function parseImport(text: string, existingCodes: string[] = []): ParseResult {
  const c = new Checker()
  if (!text.trim()) {
    c.err('file', 'Paste the JSON your AI produced, or upload a .json file.')
    return { plan: null, errors: c.errors, warnings: c.warnings }
  }

  let raw: unknown
  try {
    raw = JSON.parse(extractJson(text))
  } catch (e) {
    c.err('file', `This isn't valid JSON (${(e as Error).message}). Ask the AI to "output only valid JSON" and paste again.`)
    return { plan: null, errors: c.errors, warnings: c.warnings }
  }

  if (!isObj(raw)) {
    c.err('file', 'The top level must be an object { … }.')
    return { plan: null, errors: c.errors, warnings: c.warnings }
  }

  if (raw.format && raw.format !== IMPORT_FORMAT) {
    c.warn('format', `Expected "${IMPORT_FORMAT}", got "${str(raw.format)}". Trying anyway.`)
  }

  /* Semester (optional) */
  let semester: PlanSemester | null = null
  if (isObj(raw.semester)) {
    const s = raw.semester
    const p = 'semester'
    const start = c.date(s.start_date, `${p}.start_date`, true)
    const end = c.date(s.end_date, `${p}.end_date`, true)
    if (start && end && end < start) c.err(`${p}.end_date`, 'must be on or after start_date.')
    semester = {
      name: c.text(s, 'name', p, { required: true, max: 100 }),
      academic_year: c.text(s, 'academic_year', p, { max: 20 }),
      term: c.text(s, 'term', p, { max: 30 }),
      start_date: start ?? '',
      end_date: end ?? '',
    }
  }

  /* Courses */
  const rawCourses = c.list(raw, 'courses', '')
  if (rawCourses.length === 0) c.err('courses', 'No courses found. The file needs a "courses": [ … ] list.')

  const seen = new Set<string>()
  const existing = new Set(existingCodes.map((x) => x.toUpperCase()))
  const courses: PlanCourse[] = []

  rawCourses.forEach((rc, i) => {
    const p = `courses[${i}]`
    if (!isObj(rc)) return c.err(p, 'should be an object { … }.')

    const code = c.text(rc, 'code', p, { required: true, max: 30 }).toUpperCase()
    const name = c.text(rc, 'name', p, { required: true, max: 150 })
    const label = code || name || p

    if (code && seen.has(code)) return c.err(`${p}.code`, `${code} appears twice in this file.`)
    seen.add(code)
    if (code && existing.has(code) && !semester) {
      c.warn(label, `${code} already exists in your current semester and will be skipped.`)
      return
    }

    let color = str(rc.color)
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      c.warn(`${label}.color`, `"${color}" isn't a #RRGGBB color; a palette color was used instead.`)
      color = ''
    }
    color = color || COURSE_COLORS[courses.length % COURSE_COLORS.length]

    /* Class meetings */
    const meetings: PlanMeeting[] = []
    c.list(rc, 'class_meetings', label).forEach((rm, j) => {
      const mp = `${label}.class_meetings[${j}]`
      if (!isObj(rm)) return c.err(mp, 'should be an object.')
      const wdRaw = rm.weekday
      const weekday =
        typeof wdRaw === 'number' && wdRaw >= 0 && wdRaw <= 6 ? wdRaw : WEEKDAYS[str(wdRaw).toUpperCase()]
      if (weekday === undefined) c.err(`${mp}.weekday`, `"${str(wdRaw)}" should be MON, TUE, WED, THU, FRI, SAT or SUN.`)
      const start = c.time(rm.start_time, `${mp}.start_time`)
      const end = c.time(rm.end_time, `${mp}.end_time`)
      if (start && end && end <= start) c.err(`${mp}.end_time`, 'must be later than start_time.')
      const startsOn = c.date(rm.starts_on, `${mp}.starts_on`)
      const endsOn = c.date(rm.ends_on, `${mp}.ends_on`)
      if (startsOn && endsOn && endsOn < startsOn) c.err(`${mp}.ends_on`, 'must be on or after starts_on.')
      if (weekday !== undefined && start && end) {
        meetings.push({ weekday, start_time: start, end_time: end, location: str(rm.location), starts_on: startsOn, ends_on: endsOn })
      }
    })

    /* Grade categories + assessments */
    const categories: PlanCategory[] = []
    c.list(rc, 'grade_categories', label).forEach((rg, j) => {
      const gp = `${label}.grade_categories[${j}]`
      if (!isObj(rg)) return c.err(gp, 'should be an object.')
      const catName = c.text(rg, 'name', gp, { required: true, max: 100 })
      const weight = c.decimal(rg.weight_percent, `${gp}.weight_percent`, { required: true, min: 0, max: 100 })
      const assessments: PlanAssessment[] = []
      c.list(rg, 'assessments', gp).forEach((ra, k) => {
        const ap = `${gp}.assessments[${k}]`
        if (!isObj(ra)) return c.err(ap, 'should be an object.')
        const title = c.text(ra, 'title', ap, { required: true, max: 150 })
        const possible = c.decimal(ra.points_possible, `${ap}.points_possible`, { required: true, gtZero: true })
        const earned = c.decimal(ra.points_earned, `${ap}.points_earned`, { min: 0 })
        if (possible && earned && Number(earned) > Number(possible)) {
          c.err(`${ap}.points_earned`, `${earned} is more than the maximum ${possible}.`)
        }
        const due = c.datetime(ra.due_at, `${ap}.due_at`)
        if (title && possible) assessments.push({ title, points_possible: possible, points_earned: earned, due_at: due })
      })
      if (catName && weight !== null) categories.push({ name: catName, weight_percent: weight, assessments })
    })

    const weightTotal = Math.round(categories.reduce((s, g) => s + Number(g.weight_percent), 0) * 100) / 100
    if (weightTotal > 100) c.err(`${label}.grade_categories`, `Weights add up to ${weightTotal}%. They can't exceed 100%.`)
    else if (categories.length > 0 && weightTotal < 100)
      c.warn(`${label}.grade_categories`, `Weights add up to ${weightTotal}%. Letter grades stay off until they total 100%.`)

    /* Grade scale */
    let scale: PlanBand[] = []
    const rawScale = c.list(rc, 'grade_scale', label)
    rawScale.forEach((rb, j) => {
      const bp = `${label}.grade_scale[${j}]`
      if (!isObj(rb)) return c.err(bp, 'should be an object.')
      const gl = c.text(rb, 'grade_label', bp, { required: true, max: 10 })
      const min = c.decimal(rb.minimum_percentage, `${bp}.minimum_percentage`, { required: true, min: 0, max: 100 })
      const gpnt = c.decimal(rb.grade_point, `${bp}.grade_point`, { min: 0 }) ?? '0'
      if (gl && min !== null) scale.push({ grade_label: gl, minimum_percentage: min, grade_point: gpnt })
    })
    if (scale.length) {
      const mins = scale.map((b) => Number(b.minimum_percentage))
      if (new Set(mins).size !== mins.length) {
        c.warn(`${label}.grade_scale`, 'Two bands share the same minimum; the grade scale was skipped.')
        scale = []
      } else if (!mins.includes(0)) {
        c.warn(`${label}.grade_scale`, 'No band starts at 0%, so the grade scale was skipped. Add e.g. F at 0.')
        scale = []
      } else scale.sort((a, b) => Number(b.minimum_percentage) - Number(a.minimum_percentage))
    }

    /* Exams */
    const exams: PlanExam[] = []
    c.list(rc, 'exams', label).forEach((re, j) => {
      const ep = `${label}.exams[${j}]`
      if (!isObj(re)) return c.err(ep, 'should be an object.')
      const title = c.text(re, 'title', ep, { required: true, max: 200 })
      const type = str(re.type).toUpperCase() === 'QUIZ' ? 'QUIZ' : 'EXAM'
      const start = c.datetime(re.start_at, `${ep}.start_at`, true)
      let end = c.datetime(re.end_at, `${ep}.end_at`)
      if (start && !end) {
        end = start
        c.warn(`${ep}.end_at`, 'No end time; set to the start time.')
      }
      if (start && end && Date.parse(end) < Date.parse(start)) c.err(`${ep}.end_at`, 'must not be before start_at.')
      if (title && start && end) exams.push({ title, event_type: type, start_at: start, end_at: end, location: str(re.location) })
    })

    /* Resources */
    const resources: PlanResource[] = []
    c.list(rc, 'resources', label).forEach((rr, j) => {
      const rp = `${label}.resources[${j}]`
      if (!isObj(rr)) return c.err(rp, 'should be an object.')
      const url = str(rr.url)
      if (!/^https?:\/\/\S+$/i.test(url)) return c.warn(`${rp}.url`, `"${url}" isn't an http(s) link; skipped.`)
      resources.push({ title: str(rr.title) || url, url, description: str(rr.description) })
    })

    if (meetings.length === 0) c.warn(label, 'No class times; this course won\'t appear on the timetable.')

    courses.push({
      code,
      name,
      credits: c.decimal(rc.credits, `${label}.credits`, { min: 0 }) ?? '0',
      instructor: str(rc.instructor),
      color,
      meetings,
      categories,
      weight_total: weightTotal,
      scale,
      exams,
      resources,
    })
  })

  const notes = Array.isArray(raw.notes) ? raw.notes.map(str).filter(Boolean) : []

  const plan: ImportPlan = {
    semester,
    courses,
    notes,
    counts: {
      courses: courses.length,
      meetings: courses.reduce((s, x) => s + x.meetings.length, 0),
      categories: courses.reduce((s, x) => s + x.categories.length, 0),
      assessments: courses.reduce((s, x) => s + x.categories.reduce((t, g) => t + g.assessments.length, 0), 0),
      exams: courses.reduce((s, x) => s + x.exams.length, 0),
      resources: courses.reduce((s, x) => s + x.resources.length, 0),
    },
  }

  return { plan: c.errors.length ? null : plan, errors: c.errors, warnings: c.warnings }
}
