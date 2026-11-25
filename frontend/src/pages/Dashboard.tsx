import { CalendarCheck, CalendarClock, FileInput, ListChecks, Plus, Timer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DATA_MODE } from '../lib/api'
import { useAppData } from '../lib/store'
import { formatLongDate, formatMinutes, USER_TZ } from '../lib/format'
import { reviewDoneThisWeek } from '../lib/localDb'
import type { CourseRef } from '../lib/types'
import { Button } from '../components/ui/Button'
import { CountdownPanel } from '../components/ui/CountdownPanel'
import { TaskFormModal } from '../components/tasks/TaskForm'
import { EmptyState, ErrorNotice, PageHeader, RecordCard, SkeletonRows } from '../components/ui/Panels'
import { DailyProtocol } from './dashboard/DailyProtocol'
import { GradeStandingTable } from './dashboard/GradeStandingTable'
import { TodayDocket } from './dashboard/TodayDocket'
import { VitalsStrip, type Vital } from './dashboard/VitalsStrip'
import { WeeklyActivity } from './dashboard/WeeklyActivity'
import { WorkQueue } from './dashboard/WorkQueue'
import { QuickCapture } from './Tasks'
import { WeeklyReviewDrawer } from './WeeklyReview'

/** One clock for the whole page, so the countdown, docket and queue agree on "now". */
function usePageClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

function localDateKey(d: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: USER_TZ }).format(d)
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

/** "2 classes, 1 event and 1 deadline today." — only the parts that aren't zero. */
function docketSummary(classes: number, events: number, deadlines: number) {
  const parts = [
    classes > 0 && plural(classes, 'class', 'classes'),
    events > 0 && plural(events, 'event', 'events'),
    deadlines > 0 && plural(deadlines, 'deadline', 'deadlines'),
  ].filter((p): p is string => Boolean(p))
  if (parts.length === 0) return 'Nothing scheduled today.'
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
  return `${list} today.`
}

/** "N" opens a new task, unless the user is typing or a dialog is already open. */
function useNewTaskShortcut(setOpen: (open: boolean) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'n' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
      const t = e.target
      if (t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return
      if (document.querySelector('[role="dialog"]')) return
      e.preventDefault()
      setOpen(true)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [setOpen])
}

const canEdit = DATA_MODE === 'local' || DATA_MODE === 'server'

export function Dashboard() {
  const { data, error, loading, reload, openImport, db, mutate } = useAppData()
  const now = usePageClock()
  const [taskFormOpen, setTaskFormOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  useNewTaskShortcut(setTaskFormOpen)

  const toggleHabit = (id: number, done: boolean) =>
    mutate((d) => {
      const date = localDateKey(new Date())
      d.habitLogs = d.habitLogs.filter((l) => !(l.habit_id === id && l.date === date))
      if (done) d.habitLogs.push({ habit_id: id, date })
    })

  const completeTask = (id: number, done: boolean) =>
    mutate((d) => {
      const t = d.tasks.find((x) => x.id === id)
      if (!t) return
      t.status = done ? 'COMPLETED' : 'TODO'
      t.completed_at = done ? new Date().toISOString() : null
    })

  const courses = useMemo(
    () => new Map<number, CourseRef>((data?.courses ?? []).map((c) => [c.id, c])),
    [data],
  )

  if (loading) {
    return (
      <RecordCard>
        <SkeletonRows rows={5} />
      </RecordCard>
    )
  }
  if (error || !data) {
    return <ErrorNotice message={error ?? 'Briefing unavailable.'} onRetry={reload} />
  }

  const isNew = data.courses.length === 0
  const isToday = localDateKey(now) === data.date
  const todayIndex = (new Date(`${data.date}T12:00:00+07:00`).getUTCDay() + 6) % 7
  const docket = [...data.today.classes, ...data.today.events]
  const [nextExam, ...laterExams] = data.upcoming_exams
  const dueToday = data.upcoming_deadlines.filter((d) => localDateKey(new Date(d.end_at)) === data.date).length
  const { study, habits } = data

  // Show a panel only when it has something to say. A new planner gets setup + today, nothing else.
  const showStudy = study.week_minutes > 0 || (!isNew && study.weekly_target_minutes > 0)
  const showHabits = habits.total > 0
  const showGrades = !isNew

  const vitals: Vital[] = []
  if (!nextExam && !isNew) {
    vitals.push({
      key: 'exam',
      label: 'Next exam',
      icon: <CalendarClock size={16} />,
      value: '—',
      detail: (
        <>
          None on file.{' '}
          <Link to="/courses" className="text-accent-strong underline underline-offset-2">
            Add one
          </Link>
        </>
      ),
    })
  }
  if (showStudy) {
    const target = study.weekly_target_minutes
    vitals.push({
      key: 'study',
      label: 'Study today',
      icon: <Timer size={16} />,
      value: formatMinutes(study.today_minutes),
      tone: 'mustard',
      progress: target > 0 ? study.week_minutes / target : undefined,
      detail: (
        <>
          <span className="tabular text-ink">{formatMinutes(study.week_minutes)}</span>
          {target > 0 && (
            <>
              {' '}
              of <span className="tabular">{formatMinutes(target)}</span>
            </>
          )}{' '}
          this week
        </>
      ),
    })
  }
  if (showHabits) {
    const left = habits.total - habits.completed
    vitals.push({
      key: 'habits',
      label: 'Habits today',
      icon: <ListChecks size={16} />,
      value: habits.completed,
      unit: `/ ${habits.total}`,
      tone: 'sage',
      progress: habits.completed / habits.total,
      detail: left === 0 ? 'All done today' : `${plural(left, 'habit', 'habits')} left`,
    })
  }

  // Section numbers follow what is actually on the page, so the sequence never skips.
  const sections = [
    nextExam && 'exam',
    'docket',
    'queue',
    showGrades && 'grades',
    showHabits && 'protocol',
    showStudy && 'weekly',
  ].filter((s): s is string => Boolean(s))
  const idx = Object.fromEntries(sections.map((s, i) => [s, String(i + 1).padStart(2, '0')])) as Record<string, string | undefined>

  const dateLabel = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short', timeZone: USER_TZ })
    .format(new Date(`${data.date}T12:00:00+07:00`))
    .toUpperCase()

  const thisWeekReview = canEdit ? reviewDoneThisWeek(db, data.date) : null
  const isResetDay = todayIndex === 5 || todayIndex === 6 || todayIndex === 0
  const showReviewNudge = canEdit && isResetDay && thisWeekReview === null
  const weekFocus = thisWeekReview?.focus.trim() ?? ''
  const liveClass = data.today.classes.find((o) => {
    const t = now.getTime()
    return o.course_id !== null && t >= Date.parse(o.start_at) && t < Date.parse(o.end_at)
  })
  const inboxCount = db.inbox?.length ?? 0

  return (
    <>
      <PageHeader
        division="Division 01 · Daily Briefing"
        title="Today's Briefing"
        subtitle={
          <div className="flex flex-col gap-1">
            <span>
              <span className="tabular text-ink">{formatLongDate(data.date)}</span>
              <span className="mx-2 text-ink-muted" aria-hidden="true">
                —
              </span>
              {docketSummary(data.today.classes.length, data.today.events.length, dueToday)}
            </span>
            {weekFocus && (
              <span className="text-[13px] text-ink-muted">
                This week&apos;s focus: <span className="text-ink">{weekFocus}</span>
              </span>
            )}
          </div>
        }
        aside={
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button variant="secondary" icon={<CalendarCheck size={16} />} onClick={() => setReviewOpen(true)}>
                Weekly review
              </Button>
            )}
            {!isNew && (
              <Button variant="secondary" icon={<FileInput size={16} />} onClick={openImport}>
                Import with AI
              </Button>
            )}
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => setTaskFormOpen(true)}
              aria-keyshortcuts="N"
              title="New task (N)"
            >
              New task
              <kbd className="hidden md:inline tabular text-[11px] font-medium px-1 border border-accent-fg/30 rounded-xs leading-4">
                N
              </kbd>
            </Button>
          </div>
        }
      />

      {showReviewNudge && (
        <RecordCard className="mb-4 lg:mb-5 px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <CalendarCheck size={16} className="text-accent-strong shrink-0" aria-hidden="true" />
            <span className="text-[14px] text-ink">Take 5 minutes to plan your week.</span>
          </div>
          <Button variant="primary" size="sm" onClick={() => setReviewOpen(true)}>
            Start
          </Button>
        </RecordCard>
      )}

      {canEdit && (
        <QuickCapture
          defaultCourseId={liveClass?.course_id ?? null}
          trailing={
            inboxCount > 0 ? (
              <Link
                to="/tasks"
                className="tabular text-[12.5px] font-medium text-accent-strong hover:underline whitespace-nowrap ml-auto sm:ml-1"
              >
                Inbox: {inboxCount}
              </Link>
            ) : undefined
          }
        />
      )}

      {isNew && (
        <RecordCard className="mb-4 lg:mb-5">
          <EmptyState
            code="NEW FILE"
            title="Set up your semester"
            body="Give any AI chat your timetable or syllabus with the prompt from Import with AI, then paste its reply. Or add courses by hand."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" size="sm" icon={<FileInput size={14} />} onClick={openImport}>
                  Import with AI
                </Button>
                <Link to="/courses">
                  <Button variant="secondary" size="sm">
                    Add courses by hand
                  </Button>
                </Link>
              </div>
            }
          />
        </RecordCard>
      )}

      {/* Phones read top-down by urgency (order-*); desktop keeps the two-column briefing (lg:order-none). */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
        {nextExam && (
          <div className={`order-1 lg:order-none ${vitals.length ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
            <CountdownPanel
              exam={nextExam}
              now={now}
              index={idx.exam}
              course={nextExam.course_id ? courses.get(nextExam.course_id) : undefined}
              following={laterExams.map((e) => ({ exam: e, course: e.course_id ? courses.get(e.course_id) : undefined }))}
            />
          </div>
        )}
        {vitals.length > 0 && (
          <div className={`order-4 lg:order-none ${nextExam ? 'lg:col-span-5' : 'lg:col-span-12'}`}>
            <VitalsStrip vitals={vitals} stackOnDesktop={Boolean(nextExam)} />
          </div>
        )}

        <div className="order-2 lg:order-none lg:col-span-7">
          <TodayDocket
            items={docket}
            courses={courses}
            now={now}
            showNow={isToday}
            dueToday={dueToday}
            dateLabel={dateLabel}
            index={idx.docket}
          />
        </div>
        <div className="order-3 lg:order-none lg:col-span-5">
          <WorkQueue
            items={data.upcoming_deadlines}
            courses={courses}
            now={now}
            index={idx.queue}
            // Sample data is fixed, so the preview build only shows the check-off locally (like the habit punch card).
            onCompleteTask={canEdit ? completeTask : DATA_MODE === 'sample' ? () => {} : undefined}
          />
        </div>

        {showGrades && (
          <div className={`order-5 lg:order-none ${showHabits ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
            <GradeStandingTable standings={data.grade_standing} courses={courses} index={idx.grades} />
          </div>
        )}
        {showHabits && (
          <div className={`order-6 lg:order-none ${showGrades ? 'lg:col-span-5' : 'lg:col-span-12'}`}>
            <DailyProtocol habits={habits.items} onToggle={canEdit ? toggleHabit : undefined} index={idx.protocol} />
          </div>
        )}
        {showStudy && (
          <div className="order-7 lg:order-none lg:col-span-12">
            <WeeklyActivity
              byDay={study.week_by_day}
              weekTarget={study.weekly_target_minutes}
              todayIndex={todayIndex}
              index={idx.weekly}
            />
          </div>
        )}
      </div>

      <TaskFormModal open={taskFormOpen} onClose={() => setTaskFormOpen(false)} />
      {canEdit && <WeeklyReviewDrawer open={reviewOpen} onClose={() => setReviewOpen(false)} />}
    </>
  )
}
