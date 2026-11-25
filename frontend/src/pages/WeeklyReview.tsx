import { Check, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Overlay'
import { EmptyState } from '../components/ui/Panels'
import { TextAreaField } from '../components/ui/SelectField'
import { StatusStamp } from '../components/ui/StatusStamp'
import { formatMinutes, formatShortDate, formatTime, relativeDue } from '../lib/format'
import {
  addDays,
  dueTopics,
  fromLocalInput,
  lastWeekRecap,
  occurrencesBetween,
  reviewDoneThisWeek,
  todayKey,
  toLocalInput,
  reviewWeekStart,
  type LastWeekRecap,
  type LTask,
} from '../lib/localDb'
import { useAppData } from '../lib/store'
import type { Occurrence } from '../lib/types'

interface WeeklyReviewDrawerProps {
  open: boolean
  onClose: () => void
}

const STEP_TITLES = [
  'Weekly review · Look back',
  'Weekly review · Clear the backlog',
  'Weekly review · Look ahead',
  'Weekly review · Set your focus',
] as const

function moveDueToDate(dueAt: string | null, targetDateKey: string): string {
  let time = '23:59'
  if (dueAt && !Number.isNaN(Date.parse(dueAt))) {
    const local = toLocalInput(dueAt)
    const match = /T(\d{2}:\d{2})$/.exec(local)
    if (match) time = match[1]
  }
  return fromLocalInput(`${targetDateKey}T${time}`)!
}

function encouragementFor(r: LastWeekRecap): string {
  if (r.targetMinutes > 0 && r.studyMinutes >= r.targetMinutes) return 'You hit your study target.'
  if (r.habitPercent !== null && r.habitPercent >= 80) return 'Strong consistency on your habits.'
  if (r.tasksDone >= 5) return `Solid progress — ${r.tasksDone} tasks wrapped up.`
  if (r.classesMissed === 0 && (r.studyMinutes > 0 || r.tasksDone > 0)) return 'Steady week with zero classes missed.'
  if (r.studyMinutes === 0 && r.tasksDone === 0) return 'Fresh slate this week — pick one small thing to start.'
  return 'Steady progress counts. Line up the week ahead.'
}

function dayHeader(dateKey: string, today: string): string {
  if (dateKey === today) return 'Today'
  if (dateKey === addDays(today, 1)) return 'Tomorrow'
  return formatShortDate(`${dateKey}T12:00:00+07:00`).replace(',', '')
}

export function WeeklyReviewDrawer({ open, onClose }: WeeklyReviewDrawerProps) {
  const { db, mutate } = useAppData()
  const [step, setStep] = useState(1)
  const [wins, setWins] = useState('')
  const [focus, setFocus] = useState('')
  const wasOpen = useRef(false)

  useEffect(() => {
    if (open && !wasOpen.current) {
      setStep(1)
      const existing = reviewDoneThisWeek(db, todayKey())
      setWins(existing?.wins ?? '')
      setFocus(existing?.focus ?? '')
    }
    wasOpen.current = open
  }, [open, db])

  const now = new Date()
  const today = todayKey(now)
  const thisWeek = reviewWeekStart(today)
  const lastMon = addDays(thisWeek, -7)
  const lastSun = addDays(thisWeek, -1)

  const courses = useMemo(() => new Map(db.courses.map((c) => [c.id, c])), [db.courses])
  const recap = useMemo(() => lastWeekRecap(db, today), [db, today])

  const overdue = db.tasks
    .filter((t) => t.status !== 'COMPLETED' && t.due_at !== null && new Date(t.due_at) < now)
    .sort((a, b) => Date.parse(a.due_at!) - Date.parse(b.due_at!))

  const aheadGroups = useMemo(() => {
    const items = occurrencesBetween(db, today, addDays(today, 6)).filter((o) => o.source_type !== 'class_meeting')
    const out: { date: string; items: Occurrence[] }[] = []
    for (const o of items) {
      const date = todayKey(new Date(o.start_at))
      const last = out[out.length - 1]
      if (last && last.date === date) last.items.push(o)
      else out.push({ date, items: [o] })
    }
    return out
  }, [db, today])

  const topicsDueCount = useMemo(() => dueTopics(db.courses, today).length, [db.courses, today])

  const previousFocus = useMemo(() => {
    const prev = [...(db.weeklyReviews ?? [])]
      .filter((r) => r.week_start < thisWeek && r.focus.trim() !== '')
      .sort((a, b) => b.week_start.localeCompare(a.week_start))[0]
    return prev?.focus.trim() ?? null
  }, [db.weeklyReviews, thisWeek])

  const completeTask = (t: LTask) => {
    mutate((d) => {
      const x = d.tasks.find((y) => y.id === t.id)
      if (!x) return
      x.status = 'COMPLETED'
      x.completed_at = new Date().toISOString()
    })
  }

  const pushTaskTomorrow = (t: LTask) => {
    const tomorrow = addDays(todayKey(), 1)
    mutate((d) => {
      const x = d.tasks.find((y) => y.id === t.id)
      if (x) x.due_at = moveDueToDate(x.due_at, tomorrow)
    })
  }

  const pushAllToTomorrow = () => {
    const ids = new Set(overdue.map((t) => t.id))
    if (ids.size === 0) return
    const tomorrow = addDays(todayKey(), 1)
    mutate((d) => {
      for (const t of d.tasks) {
        if (ids.has(t.id)) t.due_at = moveDueToDate(t.due_at, tomorrow)
      }
    })
  }

  const deleteTask = (t: LTask) => {
    if (!window.confirm(`Delete "${t.title}"?`)) return
    mutate((d) => {
      d.tasks = d.tasks.filter((x) => x.id !== t.id)
    })
  }

  const finishReview = () => {
    const todayStr = todayKey()
    const wk = reviewWeekStart(todayStr)
    mutate((d, nid) => {
      d.weeklyReviews ??= []
      const existing = d.weeklyReviews.find((r) => r.week_start === wk)
      const values = { week_start: wk, done_on: todayStr, wins: wins.trim(), focus: focus.trim() }
      if (existing) Object.assign(existing, values)
      else d.weeklyReviews.push({ id: nid(), ...values })
    })
    onClose()
  }

  const footer = (
    <div className="w-full flex items-center justify-between gap-2">
      <div>
        {step > 1 && (
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {step < 4 ? (
          <Button variant="primary" onClick={() => setStep((s) => s + 1)}>
            Next
          </Button>
        ) : (
          <Button variant="primary" onClick={finishReview}>
            Finish review
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} size="lg" label={`${step}/4`} title={STEP_TITLES[step - 1]} footer={footer}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="tabular text-[12px] text-ink-muted">Step {step} of 4</span>
          <div className="flex flex-1 max-w-[160px] gap-1" aria-hidden="true">
            {[1, 2, 3, 4].map((n) => (
              <span key={n} className={`h-1 flex-1 rounded-[1px] ${n <= step ? 'bg-accent' : 'bg-surface-2'}`} />
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <p className="tabular text-[12.5px] text-ink-muted">
              Last week · {formatShortDate(`${lastMon}T12:00:00+07:00`).replace(',', '')} –{' '}
              {formatShortDate(`${lastSun}T12:00:00+07:00`).replace(',', '')}
            </p>
            <dl className="bg-surface-sunken border border-rule rounded-xs divide-y divide-rule">
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-[13px] text-ink-muted">Study time</dt>
                <dd className="tabular text-[14px] font-medium text-ink">
                  {formatMinutes(recap.studyMinutes)}
                  {recap.targetMinutes > 0 && (
                    <span className="text-ink-muted font-normal"> / {formatMinutes(recap.targetMinutes)}</span>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-[13px] text-ink-muted">Tasks done</dt>
                <dd className="tabular text-[14px] font-medium text-ink">{recap.tasksDone}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-[13px] text-ink-muted">Habits</dt>
                <dd className="tabular text-[14px] font-medium text-ink">
                  {recap.habitPercent === null ? 'No active habits' : `${recap.habitPercent}%`}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-[13px] text-ink-muted">Classes missed</dt>
                <dd className={`tabular text-[14px] font-medium ${recap.classesMissed > 0 ? 'text-danger' : 'text-ink'}`}>
                  {recap.classesMissed}
                </dd>
              </div>
            </dl>
            <p className="text-[14px] text-ink">{encouragementFor(recap)}</p>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            {overdue.length === 0 ? (
              <EmptyState code="BACKLOG CLEAR" title="No overdue tasks. Nice." />
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="tabular text-[12.5px] text-ink-muted">
                    {overdue.length} overdue {overdue.length === 1 ? 'task' : 'tasks'}
                  </span>
                  <Button size="sm" variant="secondary" onClick={pushAllToTomorrow}>
                    Push all to tomorrow
                  </Button>
                </div>
                <ul className="bg-surface-sunken border border-rule rounded-xs divide-y divide-rule">
                  {overdue.map((t) => {
                    const course = t.course_id !== null ? courses.get(t.course_id) : undefined
                    return (
                      <li key={t.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-ink leading-snug break-words">{t.title}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 tabular text-[12px] text-ink-muted">
                            {course && (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-[1px]" style={{ background: course.color }} aria-hidden="true" />
                                {course.code}
                              </span>
                            )}
                            {t.due_at && (
                              <>
                                {course && <span>·</span>}
                                <span className="text-danger">{relativeDue(t.due_at, now)}</span>
                                <span>
                                  · {formatShortDate(t.due_at)} {formatTime(t.due_at)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <Button size="sm" variant="secondary" icon={<Check size={13} />} onClick={() => completeTask(t)}>
                            Done
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => pushTaskTomorrow(t)}>
                            Tomorrow
                          </Button>
                          <button
                            type="button"
                            onClick={() => deleteTask(t)}
                            className="p-1.5 text-ink-muted hover:text-danger cursor-pointer"
                            aria-label={`Delete "${t.title}"`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div className="px-4 py-2.5 bg-surface-sunken border border-rule rounded-xs flex items-center justify-between gap-3">
              <span className="text-[13px] text-ink-muted">Topics due for revision</span>
              <span className="tabular text-[13px] font-medium text-ink">{topicsDueCount}</span>
            </div>

            {aheadGroups.length === 0 ? (
              <EmptyState code="CLEAR WEEK" title="A quiet week ahead." />
            ) : (
              <div className="flex flex-col gap-3">
                {aheadGroups.map((g) => (
                  <div key={g.date} className="bg-surface-sunken border border-rule rounded-xs overflow-hidden">
                    <div className="px-4 py-2 border-b border-rule flex items-center justify-between gap-2">
                      <span className="micro">{dayHeader(g.date, today)}</span>
                      <span className="tabular text-[12px] text-ink-muted">{g.items.length}</span>
                    </div>
                    <ul className="divide-y divide-rule">
                      {g.items.map((o) => {
                        const course = o.course_id !== null ? courses.get(o.course_id) : undefined
                        return (
                          <li key={o.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-ink leading-snug break-words">{o.title}</div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 tabular text-[12px] text-ink-muted">
                                {course && (
                                  <span className="inline-flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-[1px]" style={{ background: course.color }} aria-hidden="true" />
                                    {course.code}
                                  </span>
                                )}
                                {course && <span>·</span>}
                                <span>{formatTime(o.start_at)}</span>
                                {o.source_type === 'assessment_deadline' && <span>· graded</span>}
                                {o.source_type === 'task_deadline' && <span>· task</span>}
                              </div>
                            </div>
                            <div className="shrink-0">
                              {o.event_type === 'EXAM' && <StatusStamp status="EXAM" />}
                              {o.event_type === 'QUIZ' && <StatusStamp status="QUIZ" />}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-4">
            {previousFocus && <p className="text-[13px] text-ink-muted">Last week&apos;s focus: {previousFocus}</p>}
            <TextAreaField
              label="What went well last week?"
              value={wins}
              onChange={(e) => setWins(e.target.value)}
              placeholder="A win, a tough task finished, staying consistent..."
            />
            <TextAreaField
              label="Main focus this week"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="One priority to keep front of mind this week..."
            />
          </div>
        )}
      </div>
    </Modal>
  )
}
