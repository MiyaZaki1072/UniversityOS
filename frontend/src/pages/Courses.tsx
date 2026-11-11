import { ArrowLeft, CalendarClock, FileInput, MapPin, NotebookPen, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { FormField } from '../components/ui/FormField'
import { Modal } from '../components/ui/Overlay'
import { EmptyState, PageHeader, RecordCard, SectionHeader } from '../components/ui/Panels'
import { SelectField } from '../components/ui/SelectField'
import { StatusStamp } from '../components/ui/StatusStamp'
import { formatPercent, formatShortDate, formatTime, relativeDue } from '../lib/format'
import { COURSE_COLORS } from '../lib/importConfig'
import {
  addDays,
  DEFAULT_SCALE,
  fromLocalInput,
  meetingActiveOn,
  standingFor,
  todayKey,
  toLocalInput,
  type LCourse,
  type LExam,
  type LMeeting,
} from '../lib/localDb'
import { useAppData } from '../lib/store'

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const hhmm = (t: string) => t.slice(0, 5)

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
  const [f, setF] = useState({ code: '', name: '', credits: '3', instructor: '', color: COURSE_COLORS[0] })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    setF(
      course
        ? { code: course.code, name: course.name, credits: course.credits, instructor: course.instructor, color: course.color }
        : { code: '', name: '', credits: '3', instructor: '', color: COURSE_COLORS[db.courses.length % COURSE_COLORS.length] },
    )
  }, [open, course, db.courses.length])

  const save = (e?: FormEvent) => {
    e?.preventDefault()
    const code = f.code.trim().toUpperCase()
    const errs: Record<string, string> = {}
    if (!code) errs.code = 'Required.'
    else if (db.courses.some((c) => c.code.toUpperCase() === code && c.id !== course?.id)) errs.code = `${code} already exists.`
    if (!f.name.trim()) errs.name = 'Required.'
    if (!/^#[0-9A-Fa-f]{6}$/.test(f.color)) errs.color = 'Use a color like #D8693A.'
    if (Number.isNaN(Number(f.credits)) || Number(f.credits) < 0) errs.credits = 'Must be 0 or more.'
    setErrors(errs)
    if (Object.keys(errs).length) return

    let newId: number | null = null
    mutate((d, nid) => {
      const values = { code, name: f.name.trim(), credits: f.credits || '0', instructor: f.instructor.trim(), color: f.color }
      if (course) {
        const c = d.courses.find((x) => x.id === course.id)
        if (c) Object.assign(c, values)
      } else {
        newId = nid()
        d.courses.push({ id: newId, ...values, meetings: [], categories: [], scale: DEFAULT_SCALE, exams: [], resources: [] })
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
            return (
              <Link key={c.id} to={`/courses/${c.id}`} className="block group">
                <RecordCard indicator={c.color} className="h-full p-4 pl-6 flex flex-col gap-3 group-hover:border-border-strong">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="tabular text-[12px] text-ink-muted">{c.code}</div>
                      <div className="font-display text-lg font-medium text-ink leading-tight">{c.name}</div>
                      {c.instructor && <div className="text-[13px] text-ink-muted mt-0.5">{c.instructor}</div>}
                    </div>
                    <span className="tabular text-[12px] text-ink-muted shrink-0">{Number(c.credits)} cr</span>
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 tabular text-[12px] text-ink-muted">
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

export function CourseDetailPage() {
  const { id } = useParams()
  const { db, mutate } = useAppData()
  const navigate = useNavigate()
  const course = db.courses.find((c) => c.id === Number(id))
  const [editOpen, setEditOpen] = useState(false)
  const [meetingForm, setMeetingForm] = useState<{ open: boolean; meeting: LMeeting | null }>({ open: false, meeting: null })
  const [examForm, setExamForm] = useState<{ open: boolean; exam: LExam | null }>({ open: false, exam: null })

  const meetings = useMemo(
    () => [...(course?.meetings ?? [])].sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time)),
    [course],
  )
  const exams = useMemo(() => [...(course?.exams ?? [])].sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at)), [course])

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

  const s = standingFor(course)

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
            {Number(course.credits)} credits{course.instructor && ` · ${course.instructor}`}
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
              index="03"
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
              <SectionHeader index="04" title="Links" />
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
