import {
  ArrowLeft,
  CalendarCheck,
  CalendarClock,
  Check,
  Clock,
  FileInput,
  ListChecks,
  MapPin,
  NotebookPen,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { FormField } from '../components/ui/FormField'
import { Modal } from '../components/ui/Overlay'
import { EmptyState, PageHeader, RecordCard, SectionHeader } from '../components/ui/Panels'
import { SelectField } from '../components/ui/SelectField'
import { StatusStamp } from '../components/ui/StatusStamp'
import { daysUntil, formatPercent, formatShortDate, formatTime, relativeDue } from '../lib/format'
import { COURSE_COLORS } from '../lib/importConfig'
import {
  addDays,
  attendanceSummary,
  courseSessions,
  DEFAULT_SCALE,
  dueTopics,
  isSU,
  reviewTopic,
  setAttendance,
  suPassMark,
  suScale,
  fromLocalInput,
  meetingActiveOn,
  standingFor,
  todayKey,
  toLocalInput,
  topicNextReview,
  topicStats,
  type AttendanceStatus,
  type Confidence,
  type LCourse,
  type LExam,
  type LMeeting,
  type LTopic,
} from '../lib/localDb'
import { useAppData } from '../lib/store'

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const hhmm = (t: string) => t.slice(0, 5)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Next class of a course within the coming two weeks, as "Tue 09:00". */
function nextClass(c: LCourse, semester: Parameters<typeof meetingActiveOn>[2]): string | null {
  const now = new Date()
  const today = todayKey(now)
  const nowTime = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' }).format(now)
  for (let i = 0; i < 14; i++) {
    const d = addDays(today, i)
    const hits = c.meetings
      .filter((m) => meetingActiveOn(m, d, semester) && (i > 0 || hhmm(m.start_time) > nowTime))
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
    if (hits.length) {
      const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : formatShortDate(`${d}T12:00:00+07:00`)
      return `${label} ${hhmm(hits[0].start_time)}`
    }
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Forms                                                               */
/* ------------------------------------------------------------------ */

function CourseFormModal({ open, onClose, course }: { open: boolean; onClose: () => void; course?: LCourse | null }) {
  const { db, mutate } = useAppData()
  const navigate = useNavigate()
  const [f, setF] = useState({
    code: '',
    name: '',
    credits: '3',
    instructor: '',
    instructorEmail: '',
    officeHours: '',
    color: COURSE_COLORS[0],
    grading: 'LETTER' as 'LETTER' | 'SU',
    pass: '50',
    attendanceMin: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    setF(
      course
        ? {
            code: course.code,
            name: course.name,
            credits: course.credits,
            instructor: course.instructor,
            instructorEmail: course.instructor_email ?? '',
            officeHours: course.office_hours ?? '',
            color: course.color,
            grading: isSU(course) ? 'SU' : 'LETTER',
            pass: isSU(course) ? suPassMark(course) : '50',
            attendanceMin: course.attendance_min_percent ?? '',
          }
        : {
            code: '',
            name: '',
            credits: '3',
            instructor: '',
            instructorEmail: '',
            officeHours: '',
            color: COURSE_COLORS[db.courses.length % COURSE_COLORS.length],
            grading: 'LETTER',
            pass: '50',
            attendanceMin: '',
          },
    )
  }, [open, course, db.courses.length])

  const save = (e?: FormEvent) => {
    e?.preventDefault()
    const code = f.code.trim().toUpperCase()
    const attTrim = f.attendanceMin.trim()
    const emailTrim = f.instructorEmail.trim()
    const officeTrim = f.officeHours.trim()
    const errs: Record<string, string> = {}
    if (!code) errs.code = 'Required.'
    else if (db.courses.some((c) => c.code.toUpperCase() === code && c.id !== course?.id)) errs.code = `${code} already exists.`
    if (!f.name.trim()) errs.name = 'Required.'
    if (!/^#[0-9A-Fa-f]{6}$/.test(f.color)) errs.color = 'Use a color like #D8693A.'
    if (Number.isNaN(Number(f.credits)) || Number(f.credits) < 0) errs.credits = 'Must be 0 or more.'
    if (f.grading === 'SU' && (f.pass === '' || Number.isNaN(Number(f.pass)) || Number(f.pass) < 0 || Number(f.pass) > 100)) errs.pass = '0 to 100.'
    if (attTrim !== '' && (Number.isNaN(Number(attTrim)) || Number(attTrim) < 0 || Number(attTrim) > 100)) errs.attendanceMin = '0 to 100.'
    if (emailTrim !== '' && !EMAIL_RE.test(emailTrim)) errs.instructorEmail = 'Enter a valid email.'
    if (officeTrim.length > 200) errs.officeHours = 'Keep under 200 characters.'
    setErrors(errs)
    if (Object.keys(errs).length) return

    let newId: number | null = null
    mutate((d, nid) => {
      const values = {
        code,
        name: f.name.trim(),
        credits: f.credits || '0',
        instructor: f.instructor.trim(),
        instructor_email: emailTrim === '' ? null : emailTrim,
        office_hours: officeTrim === '' ? null : officeTrim,
        color: f.color,
        grading: f.grading,
        attendance_min_percent: attTrim === '' ? null : attTrim,
      }
      const scaleFor = (prev: LCourse | undefined) =>
        f.grading === 'SU'
          ? suScale(f.pass)
          : prev && !isSU(prev)
            ? prev.scale
            : DEFAULT_SCALE.map((b) => ({ ...b }))
      if (course) {
        const c = d.courses.find((x) => x.id === course.id)
        if (c) {
          const scale = scaleFor(c)
          Object.assign(c, values, { scale })
          // A letter grade entered before switching modes no longer fits the scale.
          if (c.official_grade && !scale.some((b) => b.grade_label === c.official_grade)) c.official_grade = null
        }
      } else {
        newId = nid()
        d.courses.push({ id: newId, ...values, meetings: [], categories: [], scale: scaleFor(undefined), exams: [], resources: [] })
      }
    })
    onClose()
    if (newId !== null) navigate(`/courses/${newId}`)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      label="FORM C-1"
      title={course ? 'Edit course' : 'New course'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => save()}>
            Save
          </Button>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={save}>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Code" mono autoFocus placeholder="MATH101" value={f.code} error={errors.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
          <FormField label="Credits" mono type="number" min={0} step="0.5" value={f.credits} error={errors.credits} onChange={(e) => setF({ ...f, credits: e.target.value })} />
        </div>
        <FormField label="Name" placeholder="Calculus I" value={f.name} error={errors.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <FormField label="Instructor" placeholder="Optional" value={f.instructor} onChange={(e) => setF({ ...f, instructor: e.target.value })} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Instructor email"
            type="email"
            placeholder="Optional"
            value={f.instructorEmail}
            error={errors.instructorEmail}
            onChange={(e) => setF({ ...f, instructorEmail: e.target.value })}
          />
          <FormField
            label="Office hours"
            placeholder="e.g. Tue 13:00–15:00, Rm 1203"
            maxLength={200}
            value={f.officeHours}
            error={errors.officeHours}
            onChange={(e) => setF({ ...f, officeHours: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Grading"
            value={f.grading}
            onChange={(e) => setF({ ...f, grading: e.target.value as 'LETTER' | 'SU' })}
            options={[
              { value: 'LETTER', label: 'Letter grade (A–F)' },
              { value: 'SU', label: 'S/U (pass/fail)' },
            ]}
          />
          {f.grading === 'SU' && (
            <FormField label="Pass mark (%)" mono type="number" min={0} max={100} step="0.5" value={f.pass} error={errors.pass} hint="S at or above this" onChange={(e) => setF({ ...f, pass: e.target.value })} />
          )}
        </div>
        {f.grading === 'SU' && <p className="-mt-2 text-[12.5px] text-ink-muted">S/U courses show S or U and are not counted in your GPA.</p>}
        <FormField
          label="Attendance needed (%)"
          mono
          type="number"
          min={0}
          max={100}
          step="any"
          placeholder="80"
          hint="Leave empty for no rule"
          value={f.attendanceMin}
          error={errors.attendanceMin}
          onChange={(e) => setF({ ...f, attendanceMin: e.target.value })}
        />
        <div className="flex flex-col gap-1.5">
          <span className="micro !text-ink">Color</span>
          <div className="flex flex-wrap gap-2">
            {COURSE_COLORS.map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => setF({ ...f, color: col })}
                className={`w-8 h-8 rounded-xs border-2 ${f.color.toUpperCase() === col ? 'border-ink' : 'border-transparent'}`}
                style={{ background: col }}
                aria-label={`Color ${col}`}
                aria-pressed={f.color.toUpperCase() === col}
              />
            ))}
          </div>
          {errors.color && <p className="text-[12px] text-danger">{errors.color}</p>}
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}

function MeetingFormModal({ open, onClose, courseId, meeting }: { open: boolean; onClose: () => void; courseId: number; meeting?: LMeeting | null }) {
  const { mutate } = useAppData()
  const [f, setF] = useState({ weekday: '0', start: '09:00', end: '10:30', location: '' })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setF(
      meeting
        ? { weekday: String(meeting.weekday), start: hhmm(meeting.start_time), end: hhmm(meeting.end_time), location: meeting.location }
        : { weekday: '0', start: '09:00', end: '10:30', location: '' },
    )
  }, [open, meeting])

  const save = (e?: FormEvent) => {
    e?.preventDefault()
    if (!f.start || !f.end) return setError('Set a start and end time.')
    if (f.end <= f.start) return setError('End time must be after the start time.')
    mutate((d, nid) => {
      const c = d.courses.find((x) => x.id === courseId)
      if (!c) return
      const values = { weekday: Number(f.weekday), start_time: `${f.start}:00`, end_time: `${f.end}:00`, location: f.location.trim() }
      if (meeting) {
        const m = c.meetings.find((x) => x.id === meeting.id)
        if (m) Object.assign(m, values)
      } else c.meetings.push({ id: nid(), ...values, starts_on: null, ends_on: null })
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      label="FORM C-2"
      title={meeting ? 'Edit weekly class' : 'Add weekly class'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => save()}>
            Save
          </Button>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={save}>
        <SelectField label="Day" value={f.weekday} onChange={(e) => setF({ ...f, weekday: e.target.value })} options={WEEKDAYS.map((w, i) => ({ value: String(i), label: w }))} />
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Starts" type="time" mono value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
          <FormField label="Ends" type="time" mono value={f.end} error={error ?? undefined} onChange={(e) => setF({ ...f, end: e.target.value })} />
        </div>
        <FormField label="Room" placeholder="e.g. SC1-201" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}

function ExamFormModal({ open, onClose, courseId, exam }: { open: boolean; onClose: () => void; courseId: number; exam?: LExam | null }) {
  const { mutate } = useAppData()
  const [f, setF] = useState({ title: '', type: 'EXAM' as LExam['event_type'], start: '', end: '', location: '' })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setF(
      exam
        ? { title: exam.title, type: exam.event_type, start: toLocalInput(exam.start_at), end: toLocalInput(exam.end_at), location: exam.location }
        : { title: '', type: 'EXAM', start: '', end: '', location: '' },
    )
  }, [open, exam])

  const save = (e?: FormEvent) => {
    e?.preventDefault()
    if (!f.title.trim()) return setError('Give it a title.')
    if (!f.start) return setError('Set the start date and time.')
    const end = f.end || f.start
    if (end < f.start) return setError('End must not be before the start.')
    mutate((d, nid) => {
      const c = d.courses.find((x) => x.id === courseId)
      if (!c) return
      const values = { title: f.title.trim(), event_type: f.type, start_at: fromLocalInput(f.start)!, end_at: fromLocalInput(end)!, location: f.location.trim() }
      if (exam) {
        const x = c.exams.find((y) => y.id === exam.id)
        if (x) Object.assign(x, values)
      } else c.exams.push({ id: nid(), ...values })
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      label="FORM C-3"
      title={exam ? 'Edit exam' : 'Add exam or quiz'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => save()}>
            Save
          </Button>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={save}>
        <FormField label="Title" placeholder="Midterm exam" autoFocus value={f.title} error={error ?? undefined} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <SelectField
          label="Type"
          value={f.type}
          onChange={(e) => setF({ ...f, type: e.target.value as LExam['event_type'] })}
          options={[
            { value: 'EXAM', label: 'Exam' },
            { value: 'QUIZ', label: 'Quiz' },
          ]}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Starts" type="datetime-local" mono value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
          <FormField label="Ends" type="datetime-local" mono value={f.end} hint="Optional" onChange={(e) => setF({ ...f, end: e.target.value })} />
        </div>
        <FormField label="Room" placeholder="Optional" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

export function CoursesPage() {
  const { db, openImport } = useAppData()
  const [formOpen, setFormOpen] = useState(false)
  const now = new Date()
  const nowMs = now.getTime()
  const today = todayKey(now)

  return (
    <>
      <PageHeader
        division="Division 03 · Academic Records"
        title="Academic Records"
        subtitle={db.semester ? `${db.semester.name} · ${db.courses.length} courses` : `${db.courses.length} courses`}
        aside={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<FileInput size={16} />} onClick={openImport}>
              Import with AI
            </Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setFormOpen(true)}>
              New course
            </Button>
          </div>
        }
      />

      {db.courses.length === 0 ? (
        <RecordCard>
          <EmptyState
            title="No courses yet"
            body="Add one by hand, or Import with AI: give any AI chat your timetable or syllabus and paste its reply."
            action={
              <div className="flex gap-2">
                <Button variant="primary" size="sm" icon={<FileInput size={14} />} onClick={openImport}>
                  Import with AI
                </Button>
                <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setFormOpen(true)}>
                  New course
                </Button>
              </div>
            }
          />
        </RecordCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {db.courses.map((c) => {
            const s = standingFor(c)
            const next = nextClass(c, db.semester)
            const att = attendanceSummary(c, db.semester, today)
            const openTasks = db.tasks.filter((t) => t.course_id === c.id && t.status !== 'COMPLETED')
            const overdueCount = openTasks.filter((t) => t.due_at !== null && Date.parse(t.due_at) < nowMs).length
            const nextExam = [...c.exams]
              .filter((e) => Date.parse(e.start_at) >= nowMs)
              .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at))[0]
            const examDays = nextExam ? Math.max(0, daysUntil(nextExam.start_at, now)) : null
            const topicsDue = dueTopics([c], today).length
            const hasRollups = att.total > 0 || openTasks.length > 0 || nextExam !== undefined || topicsDue > 0

            const attTone =
              att.status === 'over' ? 'text-danger' : att.status === 'close' ? 'text-mustard-ink' : ''
            const attLeftText =
              att.status === 'close' && att.canStillMiss !== null
                ? ` · ${att.canStillMiss} left`
                : att.status === 'over' && att.canStillMiss !== null
                  ? ` · ${Math.abs(att.canStillMiss)} over`
                  : ''
            const examTone =
              examDays !== null && examDays <= 3
                ? 'text-danger'
                : examDays !== null && examDays <= 7
                  ? 'text-mustard-ink'
                  : ''
            const examLabel = nextExam?.event_type === 'QUIZ' ? 'Quiz' : 'Exam'

            return (
              <Link key={c.id} to={`/courses/${c.id}`} className="block group">
                <RecordCard indicator={c.color} className="h-full p-4 pl-6 flex flex-col gap-3 group-hover:border-border-strong">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="tabular text-[12px] text-ink-muted">{c.code}</div>
                      <div className="font-display text-lg font-medium text-ink leading-tight">{c.name}</div>
                      {c.instructor && <div className="text-[13px] text-ink-muted mt-0.5">{c.instructor}</div>}
                    </div>
                    <span className="tabular text-[12px] text-ink-muted shrink-0">
                      {Number(c.credits)} cr{isSU(c) && ' · S/U'}
                    </span>
                  </div>
                  <div className="mt-auto flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 tabular text-[12px] text-ink-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock size={13} aria-hidden="true" />
                        {next ?? 'No upcoming class'}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <NotebookPen size={13} aria-hidden="true" />
                        {s.current_grade === null ? 'Ungraded' : `${formatPercent(s.current_grade)}%`}
                        {s.projected_letter_grade && ` · ${s.letter_grade ?? s.projected_letter_grade}`}
                      </span>
                    </div>
                    {hasRollups && (
                      <div className="pt-2 border-t border-rule flex flex-wrap items-center gap-x-3 gap-y-1 tabular text-[11.5px] text-ink-muted">
                        {att.total > 0 && (
                          <span className={`inline-flex items-center gap-1 ${attTone}`}>
                            <CalendarCheck size={12} aria-hidden="true" />
                            Att {att.percent === null ? '—' : `${Math.round(att.percent)}%`}
                            {attLeftText}
                          </span>
                        )}
                        {openTasks.length > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <ListChecks size={12} aria-hidden="true" />
                            <span>{openTasks.length} open</span>
                            {overdueCount > 0 && <span className="text-danger">· {overdueCount} overdue</span>}
                          </span>
                        )}
                        {nextExam && examDays !== null && (
                          <span className={`inline-flex items-center gap-1 ${examTone}`}>
                            <Clock size={12} aria-hidden="true" />
                            {examDays === 0 ? `${examLabel} today` : `${examLabel} in ${examDays}d`}
                          </span>
                        )}
                        {topicsDue > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <NotebookPen size={12} aria-hidden="true" />
                            {topicsDue} to revise
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </RecordCard>
              </Link>
            )
          })}
        </div>
      )}

      <CourseFormModal open={formOpen} onClose={() => setFormOpen(false)} />
    </>
  )
}

const ATTENDANCE_OPTS: { status: AttendanceStatus; short: string; label: string; activeClass: string }[] = [
  { status: 'PRESENT', short: 'P', label: 'Present', activeClass: 'bg-sage-wash text-sage-ink border-sage' },
  { status: 'LATE', short: 'L', label: 'Late', activeClass: 'bg-mustard-wash text-mustard-ink border-mustard' },
  { status: 'ABSENT', short: 'A', label: 'Absent', activeClass: 'bg-danger-wash text-danger border-danger' },
  { status: 'EXCUSED', short: 'E', label: 'Excused', activeClass: 'bg-surface-2 text-ink border-border-strong' },
]

const CONFIDENCE_OPTS: { value: Confidence; short: string; label: string; activeClass: string }[] = [
  { value: 'RED', short: 'R', label: 'Confident: red', activeClass: 'bg-danger-wash text-danger border-danger' },
  { value: 'AMBER', short: 'A', label: 'Confident: amber', activeClass: 'bg-mustard-wash text-mustard-ink border-mustard' },
  { value: 'GREEN', short: 'G', label: 'Confident: green', activeClass: 'bg-sage-wash text-sage-ink border-sage' },
]

const shortDayMonth = (dateKey: string) =>
  formatShortDate(`${dateKey}T12:00:00+07:00`).replace(/^[A-Za-z]+,\s*/, '')

export function CourseDetailPage() {
  const { id } = useParams()
  const { db, mutate } = useAppData()
  const navigate = useNavigate()
  const course = db.courses.find((c) => c.id === Number(id))
  const [editOpen, setEditOpen] = useState(false)
  const [meetingForm, setMeetingForm] = useState<{ open: boolean; meeting: LMeeting | null }>({ open: false, meeting: null })
  const [examForm, setExamForm] = useState<{ open: boolean; exam: LExam | null }>({ open: false, exam: null })
  const [showAllSessions, setShowAllSessions] = useState(false)
  const [topicInput, setTopicInput] = useState('')
  const [bulkTopics, setBulkTopics] = useState(false)
  const [bulkInput, setBulkInput] = useState('')
  const [editingTopicId, setEditingTopicId] = useState<number | null>(null)
  const [editingTopicTitle, setEditingTopicTitle] = useState('')
  const [questionInput, setQuestionInput] = useState('')

  useEffect(() => {
    setShowAllSessions(false)
    setTopicInput('')
    setBulkTopics(false)
    setBulkInput('')
    setEditingTopicId(null)
    setEditingTopicTitle('')
    setQuestionInput('')
  }, [id])

  const today = todayKey()

  const meetings = useMemo(
    () => [...(course?.meetings ?? [])].sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time)),
    [course],
  )
  const exams = useMemo(() => [...(course?.exams ?? [])].sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at)), [course])
  const sessions = useMemo(() => (course ? courseSessions(course, db.semester) : []), [course, db.semester])
  const attendance = useMemo(() => (course ? attendanceSummary(course, db.semester, today) : null), [course, db.semester, today])
  const heldSessions = useMemo(() => [...sessions.filter((s) => s.date <= today)].reverse(), [sessions, today])
  const meetingById = useMemo(() => new Map((course?.meetings ?? []).map((m) => [m.id, m])), [course])
  const attendanceMap = useMemo(
    () => new Map((course?.attendance ?? []).map((r) => [`${r.meeting_id}:${r.date}`, r.status])),
    [course],
  )
  const topicsStats = useMemo(() => (course ? topicStats(course, today) : null), [course, today])
  const taskTitles = useMemo(() => new Set(db.tasks.map((t) => t.title)), [db.tasks])

  if (!course) {
    return (
      <RecordCard>
        <EmptyState
          code="RECORD NOT FOUND"
          title="This course doesn't exist"
          action={
            <Link to="/courses">
              <Button size="sm">All courses</Button>
            </Link>
          }
        />
      </RecordCard>
    )
  }

  const tasks = db.tasks.filter((t) => t.course_id === course.id && t.status !== 'COMPLETED')
  const links = db.links.filter((l) => l.course_id === course.id)

  const removeCourse = () => {
    if (!window.confirm(`Delete ${course.code} with its classes, exams and grades? Its tasks are kept without a course.`)) return
    mutate((d) => {
      d.courses = d.courses.filter((c) => c.id !== course.id)
      for (const x of [...d.tasks, ...d.links, ...d.studySessions]) {
        if (x.course_id === course.id) x.course_id = null
      }
    })
    navigate('/courses')
  }

  const removeMeeting = (m: LMeeting) =>
    mutate((d) => {
      const c = d.courses.find((x) => x.id === course.id)
      if (c) c.meetings = c.meetings.filter((x) => x.id !== m.id)
    })

  const removeExam = (e: LExam) => {
    if (!window.confirm(`Delete "${e.title}"?`)) return
    mutate((d) => {
      const c = d.courses.find((x) => x.id === course.id)
      if (c) c.exams = c.exams.filter((x) => x.id !== e.id)
    })
  }

  const markAttendance = (meetingId: number, date: string, status: AttendanceStatus) => {
    const current = attendanceMap.get(`${meetingId}:${date}`) ?? null
    const next = current === status ? null : status
    mutate((d) => {
      const c = d.courses.find((x) => x.id === course.id)
      if (c) setAttendance(c, meetingId, date, next)
    })
  }

  const addCatchUpTask = (date: string) => {
    const title = `Catch up: ${course.code} ${date}`
    mutate((d, nid) => {
      if (d.tasks.some((t) => t.title === title)) return
      d.tasks.push({
        id: nid(),
        title,
        course_id: course.id,
        due_at: fromLocalInput(`${addDays(todayKey(), 3)}T23:59`),
        status: 'TODO',
        priority: 'MEDIUM',
        notes: '',
        completed_at: null,
      })
    })
  }

  const addSingleTopic = (e: FormEvent) => {
    e.preventDefault()
    const title = topicInput.trim()
    if (!title) return
    mutate((d, nid) => {
      const c = d.courses.find((x) => x.id === course.id)
      if (!c) return
      c.topics ??= []
      c.topics.push({ id: nid(), title, confidence: null, last_reviewed: null, review_count: 0 })
    })
    setTopicInput('')
  }

  const addBulkTopics = (e: FormEvent) => {
    e.preventDefault()
    const lines = bulkInput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    if (lines.length === 0) return
    mutate((d, nid) => {
      const c = d.courses.find((x) => x.id === course.id)
      if (!c) return
      c.topics ??= []
      for (const title of lines) {
        c.topics.push({ id: nid(), title, confidence: null, last_reviewed: null, review_count: 0 })
      }
    })
    setBulkInput('')
    setBulkTopics(false)
  }

  const commitTopicRename = (topicId: number) => {
    const title = editingTopicTitle.trim()
    setEditingTopicId(null)
    if (!title) return
    mutate((d) => {
      const c = d.courses.find((x) => x.id === course.id)
      const t = c?.topics?.find((x) => x.id === topicId)
      if (t) t.title = title
    })
  }

  const rateTopic = (topicId: number, confidence: Confidence) => {
    mutate((d) => {
      const c = d.courses.find((x) => x.id === course.id)
      const t = c?.topics?.find((x) => x.id === topicId)
      if (t) reviewTopic(t, confidence, todayKey())
    })
  }

  const removeTopic = (t: LTopic) => {
    if (!window.confirm(`Delete "${t.title}"?`)) return
    mutate((d) => {
      const c = d.courses.find((x) => x.id === course.id)
      if (c && c.topics) c.topics = c.topics.filter((x) => x.id !== t.id)
    })
    if (editingTopicId === t.id) setEditingTopicId(null)
  }

  const addQuestion = (e: FormEvent) => {
    e.preventDefault()
    const text = questionInput.trim()
    if (!text) return
    mutate((d, nid) => {
      const c = d.courses.find((x) => x.id === course.id)
      if (!c) return
      c.questions ??= []
      c.questions.push({ id: nid(), text, created_at: new Date().toISOString(), answered: false })
    })
    setQuestionInput('')
  }

  const toggleQuestion = (questionId: number) => {
    mutate((d) => {
      const c = d.courses.find((x) => x.id === course.id)
      const q = c?.questions?.find((x) => x.id === questionId)
      if (q) q.answered = !q.answered
    })
  }

  const removeQuestion = (questionId: number) => {
    mutate((d) => {
      const c = d.courses.find((x) => x.id === course.id)
      if (c && c.questions) c.questions = c.questions.filter((x) => x.id !== questionId)
    })
  }

  const s = standingFor(course)
  const topics = course.topics ?? []
  const visibleSessions = showAllSessions ? heldSessions : heldSessions.slice(0, 10)
  const sortedQuestions = [...(course.questions ?? [])].sort((a, b) => Number(a.answered) - Number(b.answered))
  const openQuestionsCount = sortedQuestions.filter((q) => !q.answered).length
  const instructorEmail = course.instructor_email?.trim() ?? ''
  const validInstructorEmail = instructorEmail !== '' && EMAIL_RE.test(instructorEmail)
  const officeHours = course.office_hours?.trim() ?? ''

  return (
    <>
      <Link to="/courses" className="inline-flex items-center gap-1.5 mb-4 text-[13px] text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> All courses
      </Link>
      <PageHeader
        division={`Course record · ${course.code}`}
        title={course.name}
        subtitle={
          <span className="tabular text-[13px]">
            {Number(course.credits)} credits{isSU(course) && ' · S/U, not in GPA'}{course.instructor && ` · ${course.instructor}`}
          </span>
        }
        aside={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Pencil size={16} />} onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button variant="ghost" icon={<Trash2 size={16} />} onClick={removeCourse} aria-label={`Delete ${course.code}`}>
              Delete
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
        <div className="lg:col-span-7 flex flex-col gap-4 lg:gap-5">
          <RecordCard indicator={course.color}>
            <SectionHeader
              index="01"
              title="Weekly classes"
              action={
                <Button size="sm" icon={<Plus size={14} />} onClick={() => setMeetingForm({ open: true, meeting: null })}>
                  Add
                </Button>
              }
            />
            {meetings.length === 0 ? (
              <EmptyState code="NO CLASSES ON FILE" title="No weekly classes" body="Add the days and times this course meets." />
            ) : (
              <ul className="divide-y divide-rule">
                {meetings.map((m) => (
                  <li key={m.id} className="flex items-center gap-4 px-4 sm:px-5 py-3">
                    <span className="w-24 font-medium text-ink">{WEEKDAYS[m.weekday]}</span>
                    <span className="tabular text-ink">
                      {hhmm(m.start_time)}–{hhmm(m.end_time)}
                    </span>
                    {m.location && (
                      <span className="hidden sm:inline-flex items-center gap-1.5 text-[13px] text-ink-muted min-w-0 truncate">
                        <MapPin size={13} aria-hidden="true" />
                        {m.location}
                      </span>
                    )}
                    <div className="ml-auto flex">
                      <button onClick={() => setMeetingForm({ open: true, meeting: m })} className="p-1.5 text-ink-muted hover:text-ink" aria-label="Edit class">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => removeMeeting(m)} className="p-1.5 text-ink-muted hover:text-danger" aria-label="Delete class">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </RecordCard>

          <RecordCard>
            <SectionHeader
              index="02"
              title="Attendance"
              meta={attendance && attendance.total > 0 ? `${attendance.held} of ${attendance.total} held` : undefined}
            />
            {meetings.length === 0 ? (
              <EmptyState code="NO CLASSES ON FILE" title="Add class times to track attendance." />
            ) : sessions.length === 0 || !attendance ? (
              <EmptyState code="NO TERM DATES" title="Set the semester dates to count classes." />
            ) : (
              <>
                <div className="px-4 sm:px-5 py-4 flex flex-col gap-2 border-b border-rule">
                  <div className="flex items-baseline gap-3">
                    <span className="tabular text-[30px] leading-none text-ink">
                      {attendance.percent === null
                        ? '—'
                        : `${Number.isInteger(attendance.percent) ? attendance.percent : formatPercent(String(attendance.percent), 1)}%`}
                    </span>
                    {attendance.minPercent !== null && (
                      <span className="tabular text-[12px] text-ink-muted">min {attendance.minPercent}%</span>
                    )}
                  </div>
                  <p className="tabular text-[12.5px] text-ink-muted">
                    Present {attendance.present} · Late {attendance.late} · Absent {attendance.absent} · Excused {attendance.excused}
                  </p>
                  {attendance.status === 'ok' && attendance.canStillMiss !== null && (
                    <p className="text-[14px] text-ink">
                      You can still miss <strong className="tabular font-semibold">{attendance.canStillMiss}</strong>{' '}
                      {attendance.canStillMiss === 1 ? 'class' : 'classes'}.
                    </p>
                  )}
                  {attendance.status === 'close' && attendance.canStillMiss !== null && (
                    <p className="text-[14px] text-mustard-ink">
                      {attendance.canStillMiss === 0 ? (
                        <>
                          <strong className="tabular font-semibold">0</strong> — don&apos;t miss another one.
                        </>
                      ) : (
                        <>
                          You can still miss <strong className="tabular font-semibold">{attendance.canStillMiss}</strong>{' '}
                          {attendance.canStillMiss === 1 ? 'class' : 'classes'}.
                        </>
                      )}
                    </p>
                  )}
                  {attendance.status === 'over' && attendance.canStillMiss !== null && (
                    <p className="text-[14px] text-danger">
                      Over the limit by <strong className="tabular font-semibold">{Math.abs(attendance.canStillMiss)}</strong>{' '}
                      {Math.abs(attendance.canStillMiss) === 1 ? 'class' : 'classes'}. You may not be allowed to sit the final.
                    </p>
                  )}
                  {attendance.status === 'none' && (
                    <p className="text-[13px] text-ink-muted">No attendance rule set. Add one with Edit.</p>
                  )}
                  {attendance.unmarked > 0 && (
                    <p className="tabular text-[12px] text-ink-muted">
                      {attendance.unmarked} past {attendance.unmarked === 1 ? 'class' : 'classes'} not marked yet
                    </p>
                  )}
                </div>

                {heldSessions.length === 0 ? (
                  <p className="px-4 sm:px-5 py-4 text-[13px] text-ink-muted">No classes held yet.</p>
                ) : (
                  <>
                    <ul className="divide-y divide-rule">
                      {visibleSessions.map((session) => {
                        const m = meetingById.get(session.meeting_id)
                        const current = attendanceMap.get(`${session.meeting_id}:${session.date}`) ?? null
                        const catchUpTitle = `Catch up: ${course.code} ${session.date}`
                        const showCatchUp = current === 'ABSENT' && !taskTitles.has(catchUpTitle)
                        return (
                          <li key={`${session.meeting_id}-${session.date}`} className="px-4 sm:px-5 py-2.5 flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="tabular text-[13px] font-medium text-ink">
                                  {formatShortDate(`${session.date}T12:00:00+07:00`)}
                                </div>
                                {m && (
                                  <div className="tabular text-[12px] text-ink-muted">
                                    {formatTime(`${session.date}T${m.start_time}+07:00`)}–{formatTime(`${session.date}T${m.end_time}+07:00`)}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {ATTENDANCE_OPTS.map((opt) => {
                                  const active = current === opt.status
                                  return (
                                    <button
                                      key={opt.status}
                                      type="button"
                                      onClick={() => markAttendance(session.meeting_id, session.date, opt.status)}
                                      aria-label={opt.label}
                                      aria-pressed={active}
                                      title={opt.label}
                                      className={
                                        'w-7 h-7 grid place-items-center rounded-xs border tabular text-[12px] font-semibold cursor-pointer transition-colors ' +
                                        (active
                                          ? opt.activeClass
                                          : 'bg-surface-sunken text-ink-muted border-border hover:border-border-strong hover:text-ink')
                                      }
                                    >
                                      {opt.short}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                            {showCatchUp && (
                              <div>
                                <Button size="sm" variant="secondary" icon={<Plus size={13} />} onClick={() => addCatchUpTask(session.date)}>
                                  Add catch-up task
                                </Button>
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                    {heldSessions.length > 10 && (
                      <div className="border-t border-rule px-4 sm:px-5 py-2.5">
                        <button
                          type="button"
                          onClick={() => setShowAllSessions((v) => !v)}
                          className="text-[13px] font-medium text-accent-strong hover:underline cursor-pointer"
                        >
                          {showAllSessions ? 'Show recent' : `Show all (${heldSessions.length})`}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </RecordCard>

          <RecordCard>
            <SectionHeader
              index="03"
              title="Topics"
              meta={
                topicsStats && topicsStats.total > 0
                  ? `R ${topicsStats.red} · A ${topicsStats.amber} · G ${topicsStats.green} · — ${topicsStats.unrated}`
                  : undefined
              }
              action={
                <button
                  type="button"
                  onClick={() => setBulkTopics((v) => !v)}
                  className="text-[13px] font-medium text-accent-strong hover:underline cursor-pointer"
                >
                  {bulkTopics ? 'Add one' : 'Add several'}
                </button>
              }
            />

            {topicsStats && topicsStats.total > 0 && (
              <div className="px-4 sm:px-5 pt-3 flex flex-col gap-1.5">
                <div className="flex h-1.5 w-full overflow-hidden rounded-xs bg-surface-sunken" aria-hidden="true">
                  {topicsStats.red > 0 && (
                    <div className="bg-danger" style={{ width: `${(topicsStats.red / topicsStats.total) * 100}%` }} />
                  )}
                  {topicsStats.amber > 0 && (
                    <div className="bg-mustard" style={{ width: `${(topicsStats.amber / topicsStats.total) * 100}%` }} />
                  )}
                  {topicsStats.green > 0 && (
                    <div className="bg-sage" style={{ width: `${(topicsStats.green / topicsStats.total) * 100}%` }} />
                  )}
                  {topicsStats.unrated > 0 && (
                    <div className="bg-border" style={{ width: `${(topicsStats.unrated / topicsStats.total) * 100}%` }} />
                  )}
                </div>
                <div className="sm:hidden tabular text-[11.5px] text-ink-muted">
                  R {topicsStats.red} · A {topicsStats.amber} · G {topicsStats.green} · — {topicsStats.unrated}
                </div>
              </div>
            )}

            {bulkTopics ? (
              <form onSubmit={addBulkTopics} className="px-4 sm:px-5 py-3 flex flex-col gap-2 border-b border-rule">
                <textarea
                  rows={4}
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder="One topic per line..."
                  aria-label="Topics, one per line"
                  className="w-full p-2.5 bg-surface-sunken border border-border-strong rounded-xs text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-ink-muted">One topic per line</span>
                  <Button type="submit" size="sm" variant="primary" icon={<Plus size={14} />} disabled={!bulkInput.trim()}>
                    Add topics
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={addSingleTopic} className="px-4 sm:px-5 py-3 flex items-center gap-2 border-b border-rule">
                <input
                  type="text"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  placeholder="Add a topic or lecture..."
                  aria-label="New topic title"
                  className="h-9 flex-1 min-w-0 px-2.5 bg-surface-sunken border border-border-strong rounded-xs text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent"
                />
                <Button type="submit" size="sm" variant="secondary" icon={<Plus size={14} />} disabled={!topicInput.trim()}>
                  Add
                </Button>
              </form>
            )}

            {topics.length === 0 ? (
              <EmptyState
                code="NO TOPICS ON FILE"
                title="No topics yet"
                body="Add the topics or lectures of this course, then rate how well you know each one after revising."
              />
            ) : (
              <ul className="divide-y divide-rule">
                {topics.map((t) => {
                  const next = topicNextReview(t)
                  const overdue = next !== null && next < today
                  const isEditing = editingTopicId === t.id
                  return (
                    <li key={t.id} className="px-4 sm:px-5 py-2.5 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <input
                            type="text"
                            autoFocus
                            value={editingTopicTitle}
                            onChange={(e) => setEditingTopicTitle(e.target.value)}
                            onBlur={() => commitTopicRename(t.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                commitTopicRename(t.id)
                              } else if (e.key === 'Escape') {
                                setEditingTopicId(null)
                              }
                            }}
                            aria-label="Rename topic"
                            className="h-8 w-full min-w-0 px-2 bg-surface border border-border-strong rounded-xs text-[14px] text-ink focus:outline-none focus:border-accent"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTopicId(t.id)
                              setEditingTopicTitle(t.title)
                            }}
                            className="text-left font-medium text-ink hover:underline underline-offset-2 decoration-ink-muted break-words cursor-text"
                          >
                            {t.title}
                          </button>
                        )}
                        {t.review_count > 0 && t.last_reviewed ? (
                          <div className="mt-0.5 tabular text-[12px] text-ink-muted">
                            Reviewed {t.review_count}× · last {shortDayMonth(t.last_reviewed)}
                            {next && (
                              <>
                                {' · '}
                                <span className={overdue ? 'text-danger font-medium' : ''}>next {shortDayMonth(next)}</span>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="mt-0.5 tabular text-[12px] text-ink-muted">Not reviewed yet</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 pt-0.5">
                        {CONFIDENCE_OPTS.map((opt) => {
                          const active = t.confidence === opt.value
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => rateTopic(t.id, opt.value)}
                              aria-label={opt.label}
                              aria-pressed={active}
                              title={opt.label}
                              className={
                                'w-7 h-7 grid place-items-center rounded-xs border tabular text-[12px] font-semibold cursor-pointer transition-colors ' +
                                (active
                                  ? opt.activeClass
                                  : 'bg-surface-sunken text-ink-muted border-border hover:border-border-strong hover:text-ink')
                              }
                            >
                              {opt.short}
                            </button>
                          )
                        })}
                        <button
                          type="button"
                          onClick={() => removeTopic(t)}
                          className="p-1.5 text-ink-muted hover:text-danger cursor-pointer"
                          aria-label={`Delete ${t.title}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </RecordCard>

          <RecordCard>
            <SectionHeader
              index="04"
              title="Exams & quizzes"
              action={
                <Button size="sm" icon={<Plus size={14} />} onClick={() => setExamForm({ open: true, exam: null })}>
                  Add
                </Button>
              }
            />
            {exams.length === 0 ? (
              <EmptyState code="NO EXAMINATIONS SCHEDULED" title="No exams yet" />
            ) : (
              <ul className="divide-y divide-rule">
                {exams.map((e) => {
                  const past = Date.parse(e.end_at) < Date.now()
                  return (
                    <li key={e.id} className={`flex items-center gap-3 px-4 sm:px-5 py-3 ${past ? 'opacity-55' : ''}`}>
                      <StatusStamp status={e.event_type} />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-ink">{e.title}</div>
                        <div className="tabular text-[12px] text-ink-muted">
                          {formatShortDate(e.start_at)} {formatTime(e.start_at)}–{formatTime(e.end_at)}
                          {e.location && ` · ${e.location}`}
                          {!past && ` · ${relativeDue(e.start_at)}`}
                        </div>
                      </div>
                      <button onClick={() => setExamForm({ open: true, exam: e })} className="p-1.5 text-ink-muted hover:text-ink" aria-label={`Edit ${e.title}`}>
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => removeExam(e)} className="p-1.5 text-ink-muted hover:text-danger" aria-label={`Delete ${e.title}`}>
                        <Trash2 size={16} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </RecordCard>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-4 lg:gap-5">
          <RecordCard className="p-4 sm:p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="micro">Grade standing</span>
              <Link to={`/gradebook/${course.id}`} className="text-[13px] font-medium text-accent-strong hover:underline">
                Open ledger
              </Link>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="tabular text-[30px] leading-none text-ink">
                {s.current_grade === null ? '—' : `${formatPercent(s.current_grade)}%`}
              </span>
              {(s.letter_grade ?? s.projected_letter_grade) && (
                <span className={`font-display text-2xl font-semibold ${s.is_final ? 'text-ink' : 'text-mustard-ink'}`}>
                  {s.letter_grade ?? s.projected_letter_grade}
                </span>
              )}
            </div>
            <p className="text-[13px] text-ink-muted">
              {course.categories.length === 0
                ? 'No grading structure yet. Add categories in the ledger.'
                : `${Number(s.graded_category_weight).toFixed(0)}% of the weight graded · ${s.ungraded_assessments} items ungraded`}
            </p>
          </RecordCard>

          <RecordCard>
            <SectionHeader
              index="05"
              title="Instructor"
              meta={
                openQuestionsCount > 0
                  ? `${openQuestionsCount} open ${openQuestionsCount === 1 ? 'question' : 'questions'}`
                  : undefined
              }
            />
            <div className="px-4 sm:px-5 py-4 flex flex-col gap-2">
              {course.instructor && <div className="font-medium text-ink">{course.instructor}</div>}
              {validInstructorEmail && (
                <a href={`mailto:${instructorEmail}`} className="text-[13px] text-accent-strong hover:underline break-all">
                  {instructorEmail}
                </a>
              )}
              {officeHours && (
                <div className="flex items-start gap-1.5 text-[13px] text-ink-muted">
                  <Clock size={13} className="mt-1 shrink-0" aria-hidden="true" />
                  <span className="break-words">{officeHours}</span>
                </div>
              )}
              {!validInstructorEmail && !officeHours && (
                <p className="text-[13px] text-ink-muted">Add the instructor&apos;s email and office hours with Edit.</p>
              )}
            </div>

            <div className="border-t border-rule px-4 sm:px-5 py-3 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="micro">Questions to ask</span>
                {openQuestionsCount > 0 && (
                  <span className="sm:hidden tabular text-[11.5px] text-ink-muted">{openQuestionsCount} open</span>
                )}
              </div>
              <form onSubmit={addQuestion} className="flex items-center gap-2">
                <input
                  type="text"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  placeholder="Add a question for class or office hours..."
                  aria-label="New question to ask"
                  className="h-9 flex-1 min-w-0 px-2.5 bg-surface-sunken border border-border-strong rounded-xs text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent"
                />
                <Button type="submit" size="sm" variant="secondary" icon={<Plus size={14} />} disabled={!questionInput.trim()}>
                  Add
                </Button>
              </form>
              {sortedQuestions.length === 0 ? (
                <p className="text-[12.5px] text-ink-muted">No questions on file yet.</p>
              ) : (
                <ul className="divide-y divide-rule -mx-4 sm:-mx-5 border-t border-rule">
                  {sortedQuestions.map((q) => (
                    <li key={q.id} className="flex items-start gap-3 px-4 sm:px-5 py-2.5">
                      <button
                        type="button"
                        onClick={() => toggleQuestion(q.id)}
                        aria-pressed={q.answered}
                        aria-label={q.answered ? `Mark "${q.text}" unanswered` : `Mark "${q.text}" answered`}
                        className={`mt-0.5 w-5 h-5 shrink-0 grid place-items-center border-[1.5px] rounded-xs cursor-pointer ${
                          q.answered ? 'bg-sage border-sage text-bg' : 'border-border-strong hover:border-accent'
                        }`}
                      >
                        {q.answered && <Check size={14} strokeWidth={3} />}
                      </button>
                      <span
                        className={`min-w-0 flex-1 text-[13.5px] leading-snug break-words ${
                          q.answered ? 'text-ink-muted line-through' : 'text-ink'
                        }`}
                      >
                        {q.text}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeQuestion(q.id)}
                        className="p-1 text-ink-muted hover:text-danger shrink-0 cursor-pointer"
                        aria-label={`Delete question "${q.text}"`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </RecordCard>

          <RecordCard>
            <SectionHeader
              index="06"
              title="Open tasks"
              meta={`${tasks.length}`}
              action={
                <Link to="/tasks" className="text-[13px] font-medium text-accent-strong hover:underline">
                  All tasks
                </Link>
              }
            />
            {tasks.length === 0 ? (
              <p className="px-5 py-4 text-[13px] text-ink-muted">Nothing open for this course.</p>
            ) : (
              <ul className="divide-y divide-rule">
                {tasks.map((t) => (
                  <li key={t.id} className="px-4 sm:px-5 py-2.5">
                    <div className="font-medium text-ink">{t.title}</div>
                    {t.due_at && <div className="tabular text-[12px] text-ink-muted">{relativeDue(t.due_at)}</div>}
                  </li>
                ))}
              </ul>
            )}
          </RecordCard>

          {links.length > 0 && (
            <RecordCard>
              <SectionHeader index="07" title="Links" />
              <ul className="divide-y divide-rule">
                {links.map((r) => (
                  <li key={r.id} className="px-4 sm:px-5 py-2.5">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-medium text-accent-strong hover:underline break-all">
                      {r.title}
                    </a>
                    {r.description && <div className="text-[12px] text-ink-muted">{r.description}</div>}
                  </li>
                ))}
              </ul>
            </RecordCard>
          )}
        </div>
      </div>

      <CourseFormModal open={editOpen} onClose={() => setEditOpen(false)} course={course} />
      <MeetingFormModal open={meetingForm.open} onClose={() => setMeetingForm({ open: false, meeting: null })} courseId={course.id} meeting={meetingForm.meeting} />
      <ExamFormModal open={examForm.open} onClose={() => setExamForm({ open: false, exam: null })} courseId={course.id} exam={examForm.exam} />
    </>
  )
}
