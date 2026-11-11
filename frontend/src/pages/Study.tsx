import { Pencil, Play, Plus, Square, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Button } from '../components/ui/Button'
import { FormField } from '../components/ui/FormField'
import { Modal } from '../components/ui/Overlay'
import { EmptyState, PageHeader, RecordCard, SectionHeader, StatCard } from '../components/ui/Panels'
import { SelectField, TextAreaField } from '../components/ui/SelectField'
import { formatMinutes, formatShortDate, formatTime } from '../lib/format'
import {
  activeSession,
  fromLocalInput,
  sessionMinutes,
  studySummary,
  todayKey,
  toLocalInput,
  weekdayOf,
  weekStart,
  type LStudySession,
} from '../lib/localDb'
import { useAppData } from '../lib/store'
import { WeeklyActivity } from './dashboard/WeeklyActivity'

const LOG_LIMIT = 30

const pad = (n: number) => String(n).padStart(2, '0')

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}

/* ------------------------------------------------------------------ */
/* Add / edit a finished session                                       */
/* ------------------------------------------------------------------ */

const blank = { course: '', start: '', end: '', note: '' }

interface SessionFormProps {
  open: boolean
  onClose: () => void
  session: LStudySession | null
}

function SessionFormModal({ open, onClose, session }: SessionFormProps) {
  const { db, mutate } = useAppData()
  const [f, setF] = useState(blank)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setF(
      session
        ? {
            course: session.course_id === null ? '' : String(session.course_id),
            start: toLocalInput(session.started_at),
            end: toLocalInput(session.ended_at),
            note: session.note,
          }
        : blank,
    )
  }, [open, session])

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  const save = (e?: FormEvent) => {
    e?.preventDefault()
    const start = fromLocalInput(f.start)
    const end = fromLocalInput(f.end)
    if (!start || !end) return setError('Set both a start and an end time.')
    if (Date.parse(end) <= Date.parse(start)) return setError('End must be after start.')
    if (Date.parse(end) > Date.now() + 60_000) return setError('End cannot be in the future.')
    mutate((d, nid) => {
      const values = {
        course_id: f.course ? Number(f.course) : null,
        started_at: new Date(start).toISOString(),
        ended_at: new Date(end).toISOString(),
        note: f.note.trim(),
      }
      if (session) {
        const s = d.studySessions.find((x) => x.id === session.id)
        if (s) Object.assign(s, values)
      } else {
        d.studySessions.push({ id: nid(), ...values })
      }
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      label="FORM S-1"
      title={session ? 'Edit session' : 'Add past session'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => save()}>
            {session ? 'Save' : 'File session'}
          </Button>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={save}>
        <SelectField
          label="Course"
          value={f.course}
          onChange={(e) => set('course', e.target.value)}
          options={[{ value: '', label: 'No course' }, ...db.courses.map((c) => ({ value: String(c.id), label: `${c.code} · ${c.name}` }))]}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Start" type="datetime-local" mono value={f.start} onChange={(e) => set('start', e.target.value)} />
          <FormField label="End" type="datetime-local" mono value={f.end} onChange={(e) => set('end', e.target.value)} error={error ?? undefined} />
        </div>
        <TextAreaField label="Note" value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="Optional" />
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function StudyPage() {
  const { db, mutate } = useAppData()
  const [now, setNow] = useState(() => new Date())
  const [courseSel, setCourseSel] = useState('')
  const [noteSel, setNoteSel] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<LStudySession | null>(null)

  const running = activeSession(db)
  const runningId = running?.id ?? null

  useEffect(() => {
    if (runningId === null) return
    setNow(new Date())
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [runningId])

  const courses = useMemo(() => new Map(db.courses.map((c) => [c.id, c])), [db.courses])
  const summary = studySummary(db, now)
  const target = db.settings.weekly_study_target_minutes
  const todayIndex = weekdayOf(todayKey(now))

  const [targetText, setTargetText] = useState(String(target / 60))
  useEffect(() => {
    setTargetText(String(Math.round((target / 60) * 100) / 100))
  }, [target])

  const finished = useMemo(
    () => db.studySessions.filter((s) => s.ended_at !== null).sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at)),
    [db.studySessions],
  )
  const visible = showAll ? finished : finished.slice(0, LOG_LIMIT)

  const groups = useMemo(() => {
    const out: { key: string; iso: string; items: LStudySession[] }[] = []
    for (const s of visible) {
      const key = todayKey(new Date(s.started_at))
      const last = out[out.length - 1]
      if (last && last.key === key) last.items.push(s)
      else out.push({ key, iso: s.started_at, items: [s] })
    }
    return out
  }, [visible])

  const monday = weekStart(todayKey(now))
  const weekSessions = db.studySessions.filter((s) => todayKey(new Date(s.started_at)) >= monday).length

  const start = () => {
    if (running) return
    mutate((d, nid) => {
      if (activeSession(d)) return
      d.studySessions.push({
        id: nid(),
        course_id: courseSel ? Number(courseSel) : null,
        started_at: new Date().toISOString(),
        ended_at: null,
        note: noteSel.trim(),
      })
    })
    setNoteSel('')
  }

  const stop = () => {
    if (!running) return
    mutate((d) => {
      const s = d.studySessions.find((x) => x.id === running.id)
      if (s && s.ended_at === null) s.ended_at = new Date().toISOString()
    })
  }

  const remove = (s: LStudySession) => {
    if (!window.confirm('Delete this study session?')) return
    mutate((d) => {
      d.studySessions = d.studySessions.filter((x) => x.id !== s.id)
    })
  }

  const changeTarget = (text: string) => {
    setTargetText(text)
    const hours = Number(text)
    if (text.trim() === '' || !Number.isFinite(hours) || hours <= 0 || hours > 168) return
    const minutes = Math.round(hours * 60)
    mutate((d) => {
      d.settings.weekly_study_target_minutes = minutes
    })
  }

  const openAdd = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const runningCourse = running && running.course_id !== null ? courses.get(running.course_id) : undefined
  const pct = target > 0 ? summary.week_minutes / target : 0

  return (
    <>
      <PageHeader
        division="Division 07 · Operations"
        title="Activity Log"
        subtitle={`${formatMinutes(summary.today_minutes)} today · ${formatMinutes(summary.week_minutes)} this week`}
        aside={
          <Button variant="secondary" icon={<Plus size={16} />} onClick={openAdd}>
            Add past session
          </Button>
        }
      />

      <div className="flex flex-col gap-4 lg:gap-5">
        <RecordCard indicator={runningCourse?.color}>
          <SectionHeader index="01" title="Session Timer" meta={running ? 'Recording' : 'Idle'} />
          {running ? (
            <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8">
              <div className="min-w-0 flex-1">
                <div className="micro mb-2">Now studying</div>
                <div className="tabular text-[44px] sm:text-[64px] leading-none font-medium text-ink" aria-live="off">
                  {clock(now.getTime() - Date.parse(running.started_at))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-2 tabular text-[13px] text-ink-muted">
                  {runningCourse ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-[1px]" style={{ background: runningCourse.color }} aria-hidden="true" />
                      {runningCourse.code}
                    </span>
                  ) : (
                    <span>No course</span>
                  )}
                  <span>· since {formatTime(running.started_at)}</span>
                </div>
                {running.note && <p className="mt-1 text-[13px] text-ink-muted break-words">{running.note}</p>}
              </div>
              <Button variant="primary" className="h-14 px-8 text-base w-full sm:w-auto" icon={<Square size={18} />} onClick={stop}>
                Stop
              </Button>
            </div>
          ) : (
            <div className="p-4 sm:p-6 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
              <SelectField
                label="Course"
                value={courseSel}
                onChange={(e) => setCourseSel(e.target.value)}
                options={[{ value: '', label: 'No course' }, ...db.courses.map((c) => ({ value: String(c.id), label: `${c.code} · ${c.name}` }))]}
              />
              <FormField
                label="Note"
                placeholder="Optional, e.g. Chapter 4 review"
                value={noteSel}
                onChange={(e) => setNoteSel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') start()
                }}
              />
              <Button variant="primary" className="h-14 px-8 text-base w-full sm:w-auto" icon={<Play size={18} />} onClick={start}>
                Start
              </Button>
            </div>
          )}
        </RecordCard>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-5">
          <StatCard label="Today" value={formatMinutes(summary.today_minutes)} detail={`Day ${todayIndex + 1} of the week`} tone="accent" />
          <StatCard
            label="This week"
            value={formatMinutes(summary.week_minutes)}
            progress={Math.min(1, pct)}
            tone="sage"
            detail={`${Math.round(pct * 100)}% of ${formatMinutes(target)} target`}
          />
          <StatCard label="Sessions this week" value={weekSessions} detail="Including the one running" />
        </div>

        <WeeklyActivity byDay={summary.week_by_day} weekTarget={target} todayIndex={todayIndex} />

        <RecordCard>
          <SectionHeader index="07" title="Weekly Target" />
          <div className="p-4 sm:p-5 flex flex-wrap items-end gap-4">
            <FormField
              label="Hours per week"
              type="number"
              inputMode="decimal"
              mono
              min={0.5}
              max={168}
              step={0.5}
              className="w-40"
              value={targetText}
              onChange={(e) => changeTarget(e.target.value)}
            />
            <p className="text-[13px] text-ink-muted pb-2.5">Currently {formatMinutes(target)} per week.</p>
          </div>
        </RecordCard>

        <RecordCard>
          <SectionHeader
            index="08"
            title="Session Log"
            meta={`${finished.length}`}
            action={
              finished.length > LOG_LIMIT && (
                <button onClick={() => setShowAll((v) => !v)} className="text-[13px] font-medium text-accent-strong hover:underline">
                  {showAll ? 'Show recent' : 'Show all'}
                </button>
              )
            }
          />
          {finished.length === 0 ? (
            <EmptyState
              code="LOG EMPTY"
              title="No study sessions yet"
              body="Start the timer above, or add a session you already finished."
              action={
                <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={openAdd}>
                  Add past session
                </Button>
              }
            />
          ) : (
            <div>
              {groups.map((g) => (
                <div key={g.key}>
                  <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-2 bg-surface-sunken border-b border-rule">
                    <span className="micro">{formatShortDate(g.iso)}</span>
                    <span className="tabular text-[12px] text-ink-muted">{formatMinutes(g.items.reduce((t, s) => t + sessionMinutes(s, now), 0))}</span>
                  </div>
                  <ul className="divide-y divide-rule border-b border-rule last:border-b-0">
                    {g.items.map((s) => {
                      const course = s.course_id !== null ? courses.get(s.course_id) : undefined
                      return (
                        <li key={s.id} className="flex items-start gap-3 px-4 sm:px-5 py-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 tabular text-[13px]">
                              <span className="text-ink">
                                {formatTime(s.started_at)}–{s.ended_at ? formatTime(s.ended_at) : ''}
                              </span>
                              <span className="text-accent-strong font-medium">{formatMinutes(sessionMinutes(s, now))}</span>
                              <span className="inline-flex items-center gap-1.5 text-ink-muted">
                                {course && <span className="w-2 h-2 rounded-[1px]" style={{ background: course.color }} aria-hidden="true" />}
                                {course ? course.code : 'No course'}
                              </span>
                            </div>
                            {s.note && <p className="mt-1 text-[13px] text-ink-muted break-words whitespace-pre-line">{s.note}</p>}
                          </div>
                          <div className="flex shrink-0">
                            <button
                              onClick={() => {
                                setEditing(s)
                                setFormOpen(true)
                              }}
                              className="p-1.5 text-ink-muted hover:text-ink"
                              aria-label={`Edit session at ${formatTime(s.started_at)}`}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => remove(s)}
                              className="p-1.5 text-ink-muted hover:text-danger"
                              aria-label={`Delete session at ${formatTime(s.started_at)}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </RecordCard>
      </div>

      <SessionFormModal open={formOpen} onClose={() => setFormOpen(false)} session={editing} />
    </>
  )
}
