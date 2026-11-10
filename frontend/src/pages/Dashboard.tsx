import { CalendarClock, FileInput, ListChecks, Plus, Timer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAppData } from '../lib/store'
import { formatLongDate, formatMinutes, USER_TZ } from '../lib/format'
import type { CourseRef } from '../lib/types'
import { Button } from '../components/ui/Button'
import { CountdownPanel } from '../components/ui/CountdownPanel'
import { FormField } from '../components/ui/FormField'
import { Modal } from '../components/ui/Overlay'
import { EmptyState, ErrorNotice, PageHeader, RecordCard, SkeletonRows, StatCard } from '../components/ui/Panels'
import { DailyProtocol } from './dashboard/DailyProtocol'
import { GradeStandingTable } from './dashboard/GradeStandingTable'
import { TodayDocket } from './dashboard/TodayDocket'
import { WeeklyActivity } from './dashboard/WeeklyActivity'
import { WorkQueue } from './dashboard/WorkQueue'

function useMinuteClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

function localDateKey(d: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: USER_TZ }).format(d)
}

export function Dashboard() {
  const { data, error, loading, reload, openImport } = useAppData()
  const now = useMinuteClock()
  const [taskFormOpen, setTaskFormOpen] = useState(false)

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

  const isToday = localDateKey(now) === data.date
  const todayIndex = (new Date(`${data.date}T12:00:00+07:00`).getUTCDay() + 6) % 7
  const docket = [...data.today.classes, ...data.today.events, ...data.today.tasks]
  const [nextExam, ...laterExams] = data.upcoming_exams
  const dueToday = data.upcoming_deadlines.filter((d) => d.end_at.startsWith(data.date)).length
  const counts = {
    classes: data.today.classes.length,
    events: data.today.events.length,
    tasks: data.today.tasks.length,
  }

  return (
    <>
      <PageHeader
        division="Division 01 · Daily Briefing"
        title="Today's Briefing"
        subtitle={
          <span>
            <span className="tabular text-ink">{formatLongDate(data.date)}</span>
            <span className="mx-2 text-ink-faint">—</span>
            {counts.classes} classes, {counts.events} {counts.events === 1 ? 'quiz' : 'events'} and {counts.tasks}{' '}
            {counts.tasks === 1 ? 'deadline' : 'deadlines'} on today's docket.
          </span>
        }
        aside={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<FileInput size={16} />} onClick={openImport}>
              Import with AI
            </Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setTaskFormOpen(true)}>
              New task
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
        {/* Row 1 — countdown + vitals */}
        <div className="lg:col-span-7">
          {nextExam ? (
            <CountdownPanel
              exam={nextExam}
              course={nextExam.course_id ? courses.get(nextExam.course_id) : undefined}
              following={laterExams.map((e) => ({ exam: e, course: e.course_id ? courses.get(e.course_id) : undefined }))}
            />
          ) : (
            <RecordCard className="h-full">
              <EmptyState code="NO EXAMINATIONS SCHEDULED" title="No upcoming exams" body="Add an exam event to start a countdown." />
            </RecordCard>
          )}
        </div>

        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4 lg:gap-5">
          <StatCard
            label="Study today"
            icon={<Timer size={16} />}
            value={formatMinutes(data.study.today_minutes)}
            progress={data.study.week_minutes / data.study.weekly_target_minutes}
            tone="mustard"
            detail={
              <>
                <span className="tabular text-ink">{formatMinutes(data.study.week_minutes)}</span> of{' '}
                <span className="tabular">{formatMinutes(data.study.weekly_target_minutes)}</span> weekly target
              </>
            }
          />
          <StatCard
            label="Daily protocol"
            icon={<ListChecks size={16} />}
            value={data.habits.completed}
            unit={`/ ${data.habits.total}`}
            progress={data.habits.completed / data.habits.total}
            tone="sage"
            detail={`${data.habits.total - data.habits.completed} habits left today`}
          />
          <StatCard
            label="Deadlines · 7 days"
            icon={<CalendarClock size={16} />}
            value={data.upcoming_deadlines.length}
            unit="open"
            detail={
              dueToday > 0 ? (
                <span className="text-accent-strong font-medium">{dueToday} due before midnight</span>
              ) : (
                'Nothing due today'
              )
            }
          />
        </div>

        {/* Row 2 — schedule + work queue */}
        <div className="lg:col-span-7">
          <TodayDocket
            items={docket}
            courses={courses}
            now={now}
            showNow={isToday}
            dateLabel={new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short', timeZone: USER_TZ })
              .format(new Date(`${data.date}T12:00:00+07:00`))
              .toUpperCase()}
          />
        </div>
        <div className="lg:col-span-5">
          <WorkQueue items={data.upcoming_deadlines} courses={courses} now={now} />
        </div>

        {/* Row 3 — grades + habits */}
        <div className="lg:col-span-7">
          <GradeStandingTable standings={data.grade_standing} courses={courses} />
        </div>
        <div className="lg:col-span-5">
          <DailyProtocol habits={data.habits.items} />
        </div>

        {/* Row 4 — weekly study */}
        <div className="lg:col-span-12">
          <WeeklyActivity byDay={data.study.week_by_day} weekTarget={data.study.weekly_target_minutes} todayIndex={todayIndex} />
        </div>
      </div>

      <Modal
        open={taskFormOpen}
        onClose={() => setTaskFormOpen(false)}
        label="FORM T-1"
        title="New task"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTaskFormOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setTaskFormOpen(false)}>
              File task
            </Button>
          </>
        }
      >
        <form className="grid gap-4" onSubmit={(e) => e.preventDefault()}>
          <FormField label="Title" placeholder="e.g. Problem Set 5" autoFocus />
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Course code" placeholder="MATH101" mono />
            <FormField label="Due" type="datetime-local" mono />
          </div>
          <FormField label="Estimated minutes" type="number" min={0} placeholder="90" mono hint="Optional. Used for weekly workload estimates." />
        </form>
      </Modal>
    </>
  )
}
