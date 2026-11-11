import { useMemo } from 'react'
import { CheckCircle2, Clock, Flame, Target } from 'lucide-react'
import { EmptyState, PageHeader, RecordCard, SectionHeader, StatCard } from '../components/ui/Panels'
import { formatMinutes } from '../lib/format'
import { addDays, habitStreak, sessionMinutes, standingFor, todayKey, weekStart, type LocalDB } from '../lib/localDb'
import { useAppData } from '../lib/store'
import { GradeStandingTable } from './dashboard/GradeStandingTable'

const MAX_WEEKS = 16

const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000)

const shortDate = (key: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`))

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : null)

interface Report {
  start: string
  end: string
  totalMinutes: number
  avgPerWeek: number
  byCourse: { key: string; code: string; name: string; color: string | null; minutes: number }[]
  weeks: { start: string; minutes: number }[]
  tasks: { completed: number; open: number; overdue: number; onTime: number; late: number; doneRate: number | null }
  habits: { overall: number | null; rows: { id: number; name: string; pct: number | null; streak: number }[] }
  weightedAvg: number | null
  empty: boolean
}

function buildReport(db: LocalDB, now: Date): Report {
  const today = todayKey(now)
  const nowMs = now.getTime()
  let start = addDays(weekStart(today), -77)
  let end = today
  if (db.semester && db.semester.start_date <= today) {
    start = db.semester.start_date
    end = db.semester.end_date < today ? db.semester.end_date : today
  }
  if (end < start) end = start

  // Study sessions inside the period (a session belongs to the day it started).
  const inPeriod = db.studySessions
    .map((s) => ({ s, day: todayKey(new Date(s.started_at)), minutes: sessionMinutes(s, now) }))
    .filter((x) => x.day >= start && x.day <= end)
  const totalMinutes = inPeriod.reduce((t, x) => t + x.minutes, 0)
  const days = dayDiff(start, end) + 1
  const avgPerWeek = Math.round(totalMinutes / (days / 7))

  const courseById = new Map(db.courses.map((c) => [c.id, c]))
  const perCourse = new Map<string, number>()
  for (const x of inPeriod) {
    const k = x.s.course_id !== null && courseById.has(x.s.course_id) ? String(x.s.course_id) : 'none'
    perCourse.set(k, (perCourse.get(k) ?? 0) + x.minutes)
  }
  const byCourse = [...perCourse.entries()]
    .map(([key, minutes]) => {
      const c = key === 'none' ? undefined : courseById.get(Number(key))
      return { key, code: c ? c.code : 'No course', name: c ? c.name : '', color: c ? c.color : null, minutes }
    })
    .sort((a, b) => b.minutes - a.minutes)

  // Monday-start weeks, newest MAX_WEEKS only.
  const weekKeys: string[] = []
  for (let w = weekStart(start); w <= weekStart(end); w = addDays(w, 7)) weekKeys.push(w)
  const weeks = weekKeys.slice(-MAX_WEEKS).map((w) => ({
    start: w,
    minutes: inPeriod.filter((x) => x.day >= w && x.day <= addDays(w, 6)).reduce((t, x) => t + x.minutes, 0),
  }))

  // Tasks.
  const completedTasks = db.tasks.filter((t) => t.status === 'COMPLETED')
  const open = db.tasks.filter((t) => t.status !== 'COMPLETED')
  const overdue = open.filter((t) => t.due_at !== null && Date.parse(t.due_at) < nowMs).length
  const withBoth = completedTasks.filter((t) => t.due_at && t.completed_at)
  const onTime = withBoth.filter((t) => Date.parse(t.completed_at!) <= Date.parse(t.due_at!)).length
  const dueOrDone = completedTasks.length + overdue

  // Habits.
  let doneAll = 0
  let possibleAll = 0
  const habitRows = db.habits
    .filter((h) => !h.archived)
    .map((h) => {
      const from = h.created_on > start ? h.created_on : start
      let done = 0
      let possible = 0
      if (from <= end) {
        if (h.frequency === 'DAILY') {
          possible = dayDiff(from, end) + 1
          done = new Set(db.habitLogs.filter((l) => l.habit_id === h.id && l.date >= from && l.date <= end).map((l) => l.date)).size
        } else {
          const target = Math.max(1, h.target_per_week)
          for (let w = weekStart(from); w <= weekStart(end); w = addDays(w, 7)) {
            possible++
            const n = db.habitLogs.filter((l) => l.habit_id === h.id && l.date >= w && l.date <= addDays(w, 6)).length
            if (n >= target) done++
          }
        }
      }
      doneAll += done
      possibleAll += possible
      return { id: h.id, name: h.name, pct: pct(done, possible), streak: habitStreak(db, h, today) }
    })

  // Credit-weighted average of current percentages.
  let sum = 0
  let credits = 0
  for (const c of db.courses) {
    if (c.grading === 'SU') continue // pass/fail courses aren't part of the grade average
    const cr = Number(c.credits)
    const cur = standingFor(c).current_grade
    if (cur !== null && cr > 0) {
      sum += Number(cur) * cr
      credits += cr
    }
  }

  return {
    start,
    end,
    totalMinutes,
    avgPerWeek,
    byCourse,
    weeks,
    tasks: {
      completed: completedTasks.length,
      open: open.length,
      overdue,
      onTime,
      late: withBoth.length - onTime,
      doneRate: pct(completedTasks.length, dueOrDone),
    },
    habits: { overall: pct(doneAll, possibleAll), rows: habitRows },
    weightedAvg: credits > 0 ? sum / credits : null,
    empty: db.courses.length === 0 && db.studySessions.length === 0 && db.habits.length === 0 && db.tasks.length === 0,
  }
}

export function AnalyticsPage() {
  const { db, data } = useAppData()
  const r = useMemo(() => buildReport(db, new Date()), [db])
  const courses = useMemo(() => new Map((data?.courses ?? []).map((c) => [c.id, c])), [data])

  const target = db.settings.weekly_study_target_minutes
  const period = `${shortDate(r.start)} – ${shortDate(r.end)}`
  const subtitle = db.semester ? `${db.semester.name} · ${period}` : `Last 12 weeks · ${period}`

  const header = <PageHeader division="Division 09 · Directory" title="Semester Report" subtitle={subtitle} />

  if (r.empty) {
    return (
      <>
        {header}
        <RecordCard>
          <EmptyState
            title="Nothing to report yet"
            body="This report fills in as you use the planner: add courses, log study sessions, track habits and complete tasks."
          />
        </RecordCard>
      </>
    )
  }

  const t = r.tasks
  const maxCourse = Math.max(1, ...r.byCourse.map((c) => c.minutes))
  const maxWeek = Math.max(target * 1.25, ...r.weeks.map((w) => w.minutes), 1)
  const targetPct = (target / maxWeek) * 100
  const taskTotal = t.completed + t.open
  const seg = (n: number) => (taskTotal > 0 ? (n / taskTotal) * 100 : 0)
  const overdueOnly = t.overdue
  const openOnTrack = t.open - overdueOnly

  return (
    <>
      {header}
      <div className="flex flex-col gap-4 lg:gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5">
          <StatCard label="Study time" value={formatMinutes(r.totalMinutes)} tone="accent" icon={<Clock size={16} />} detail="Total in this period" />
          <StatCard
            label="Average per week"
            value={formatMinutes(r.avgPerWeek)}
            progress={target > 0 ? r.avgPerWeek / target : undefined}
            tone="mustard"
            icon={<Target size={16} />}
            detail={`Weekly target ${formatMinutes(target)}${target > 0 ? ` · ${Math.round((r.avgPerWeek / target) * 100)}%` : ''}`}
          />
          <StatCard
            label="Tasks completed"
            value={t.completed}
            unit={t.doneRate === null ? undefined : `· ${t.doneRate}%`}
            progress={t.doneRate === null ? undefined : t.doneRate / 100}
            tone="sage"
            icon={<CheckCircle2 size={16} />}
            detail="Of tasks completed or past due"
          />
          <StatCard
            label="Habit consistency"
            value={r.habits.overall === null ? '—' : r.habits.overall}
            unit={r.habits.overall === null ? undefined : '%'}
            progress={r.habits.overall === null ? undefined : r.habits.overall / 100}
            tone="sage"
            icon={<Flame size={16} />}
            detail="All active habits combined"
          />
        </div>

        <RecordCard>
          <SectionHeader index="01" title="Study time by course" meta="Share of total" />
          {r.byCourse.length === 0 ? (
            <EmptyState title="No study sessions in this period" body="Start the study timer to see where your time goes." />
          ) : (
            <ul className="divide-y divide-rule">
              {r.byCourse.map((c) => (
                <li key={c.key} className="px-4 sm:px-5 py-3">
                  <div className="flex items-baseline gap-3 min-w-0">
                    <span className="tabular text-[12px] text-ink-muted shrink-0">{c.code}</span>
                    {c.name && <span className="text-ink truncate min-w-0">{c.name}</span>}
                    <span className="ml-auto tabular text-[12px] text-ink shrink-0">
                      {formatMinutes(c.minutes)}
                      <span className="text-ink-muted ml-2">{pct(c.minutes, r.totalMinutes)}%</span>
                    </span>
                  </div>
                  <div className="mt-2 h-2 bg-surface-2 rounded-[1px] overflow-hidden" aria-hidden="true">
                    <div
                      className={`h-full ${c.color ? '' : 'bg-olive'}`}
                      style={{ width: `${(c.minutes / maxCourse) * 100}%`, ...(c.color ? { background: c.color } : {}) }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </RecordCard>

        <RecordCard>
          <SectionHeader index="02" title="Study per week" meta={`Target ${formatMinutes(target)}`} />
          {r.weeks.length === 0 ? (
            <EmptyState title="No weeks to show" />
          ) : (
            <div className="overflow-x-auto">
              <div className="px-4 sm:px-5 pt-8 pb-4" style={{ minWidth: `${Math.max(r.weeks.length * 36, 0)}px` }}>
                <div className="relative h-[170px]">
                  <div className="absolute inset-x-0 border-t border-dashed border-mustard" style={{ bottom: `${targetPct}%` }} aria-hidden="true">
                    <span className="absolute right-0 -top-5 tabular text-[10.5px] text-mustard-ink">TARGET {formatMinutes(target)}</span>
                  </div>
                  <ol className="absolute inset-0 flex items-end gap-1.5">
                    {r.weeks.map((w) => (
                      <li
                        key={w.start}
                        className="flex-1 min-w-0 h-full flex flex-col justify-end items-center"
                        aria-label={`Week of ${shortDate(w.start)}: ${formatMinutes(w.minutes)}`}
                      >
                        <div
                          className={`w-full max-w-[32px] rounded-t-[2px] ${w.minutes >= target && target > 0 ? 'bg-sage' : 'bg-olive'}`}
                          style={{ height: `${Math.max((w.minutes / maxWeek) * 100, w.minutes > 0 ? 2 : 0)}%` }}
                        />
                      </li>
                    ))}
                  </ol>
                </div>
                <ol className="flex gap-1.5 mt-2 border-t border-border-strong pt-2">
                  {r.weeks.map((w, i) => (
                    <li key={w.start} className="flex-1 min-w-0 text-center">
                      <span
                        className={`tabular text-[10.5px] text-ink-muted inline-block whitespace-nowrap ${i % 2 === 1 ? 'invisible sm:visible' : ''}`}
                      >
                        {shortDate(w.start)}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </RecordCard>

        <RecordCard>
          <SectionHeader index="03" title="Habit consistency" meta="Active habits" />
          {r.habits.rows.length === 0 ? (
            <EmptyState title="No habits tracked" body="Add a habit to see how consistent you are." />
          ) : (
            <ul className="divide-y divide-rule">
              {r.habits.rows.map((h) => (
                <li key={h.id} className="px-4 sm:px-5 py-3">
                  <div className="flex items-baseline gap-3 min-w-0">
                    <span className="text-ink truncate min-w-0">{h.name}</span>
                    <span className="ml-auto tabular text-[12px] text-ink shrink-0">
                      {h.pct === null ? '—' : `${h.pct}%`}
                      <span className="text-ink-muted ml-2">{h.streak > 0 ? `${h.streak}d streak` : 'no streak'}</span>
                    </span>
                  </div>
                  <div className="mt-2 h-2 bg-surface-2 rounded-[1px] overflow-hidden" aria-hidden="true">
                    <div className="h-full bg-sage" style={{ width: `${h.pct ?? 0}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </RecordCard>

        <RecordCard>
          <SectionHeader index="04" title="Tasks" meta="All tasks" />
          {taskTotal === 0 ? (
            <EmptyState title="No tasks yet" />
          ) : (
            <div className="px-4 sm:px-5 py-4 flex flex-col gap-4">
              <div className="flex h-3 w-full bg-surface-2 rounded-[1px] overflow-hidden" role="img" aria-label={`${t.completed} completed, ${openOnTrack} open, ${overdueOnly} overdue`}>
                <div className="bg-sage h-full" style={{ width: `${seg(t.completed)}%` }} />
                <div className="bg-olive h-full" style={{ width: `${seg(openOnTrack)}%` }} />
                <div className="bg-danger h-full" style={{ width: `${seg(overdueOnly)}%` }} />
              </div>
              <dl className="grid grid-cols-3 gap-3">
                <div>
                  <dt className="micro text-sage-ink">Completed</dt>
                  <dd className="tabular text-xl text-ink mt-1">{t.completed}</dd>
                </div>
                <div>
                  <dt className="micro">Open</dt>
                  <dd className="tabular text-xl text-ink mt-1">{t.open}</dd>
                </div>
                <div>
                  <dt className="micro text-danger">Overdue</dt>
                  <dd className="tabular text-xl text-ink mt-1">{t.overdue}</dd>
                </div>
              </dl>
              <p className="text-[13px] text-ink-muted">
                {t.onTime + t.late === 0 ? (
                  'No completed tasks with both a due date and a completion time yet.'
                ) : (
                  <>
                    Completed on time <span className="tabular text-ink">{t.onTime}</span> · late <span className="tabular text-ink">{t.late}</span>
                  </>
                )}
              </p>
            </div>
          )}
        </RecordCard>

        <GradeStandingTable standings={data?.grade_standing ?? []} courses={courses} />
        <RecordCard>
          <div className="px-4 sm:px-5 py-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="micro">Credit-weighted average</span>
            <span className="tabular text-xl text-ink">{r.weightedAvg === null ? '—' : `${r.weightedAvg.toFixed(2)}%`}</span>
            <span className="text-[12.5px] text-ink-muted">Average of current course percentages weighted by credits. Not a GPA.</span>
          </div>
        </RecordCard>
      </div>
    </>
  )
}
