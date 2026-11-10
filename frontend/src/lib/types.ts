/**
 * Types mirroring the University OS API (spec v1.1).
 * Once the backend exists, replace these with types generated from
 * /api/schema/ via `openapi-typescript`.
 */

export type ISODate = string // "2026-11-10"
export type ISODateTime = string // "2026-11-10T09:00:00+07:00"
export type DecimalString = string // "84.921875"

export interface CourseRef {
  id: number
  code: string
  name: string
  color: string
}

export type OccurrenceSource =
  | 'class_meeting'
  | 'calendar_event'
  | 'task_deadline'
  | 'assessment_deadline'

export type EventType = 'EXAM' | 'QUIZ' | 'EVENT' | 'PERSONAL' | 'OTHER'

/** One item from /calendar/agenda/ — also used inside the dashboard summary. */
export interface Occurrence {
  id: string
  source_type: OccurrenceSource
  title: string
  start_at: ISODateTime
  end_at: ISODateTime
  location: string | null
  course_id: number | null
  event_type?: EventType
  /** Present on task deadlines. */
  status?: 'TODO' | 'IN_PROGRESS' | 'COMPLETED'
  priority?: 'LOW' | 'MEDIUM' | 'HIGH'
}

export interface HabitToday {
  id: number
  name: string
  target_minutes: number | null
  completed: boolean
  streak_days: number
}

export interface GradeStanding {
  course_id: number
  current_grade: DecimalString | null
  graded_category_weight: DecimalString
  weight_status: 'valid' | 'underweight' | 'invalid' | 'empty'
  projected_letter_grade: string | null
  letter_grade: string | null
  is_final: boolean
  ungraded_assessments: number
}

/** GET /dashboard/summary/ */
export interface DashboardSummary {
  date: ISODate
  active_semester: { id: number; name: string; start_date: ISODate; end_date: ISODate } | null
  courses: CourseRef[]
  today: {
    classes: Occurrence[]
    events: Occurrence[]
    tasks: Occurrence[]
  }
  upcoming_exams: Occurrence[]
  upcoming_deadlines: Occurrence[]
  habits: { completed: number; total: number; items: HabitToday[] }
  study: {
    today_minutes: number
    week_minutes: number
    /** Monday-first minutes for the current week. */
    week_by_day: number[]
    weekly_target_minutes: number
  }
  grade_standing: GradeStanding[]
}
