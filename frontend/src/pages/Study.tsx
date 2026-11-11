import { ChevronDown, Pause, Pencil, Play, Plus, SkipForward, Square, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
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
/* Pomodoro helpers                                                    */
/* ------------------------------------------------------------------ */

type PomoPhase = 'focus' | 'short' | 'long'

interface PomoState {
  mode: 'timer' | 'pomodoro'
  phase: PomoPhase
  /** 1-based focus round. */
  round: number
  /** Epoch ms when the running phase ends; null when idle or paused. */
  endsAt: number | null
  /** Remaining ms while paused; null otherwise. */
  pausedMs: number | null
}

const POMO_KEY = 'university-os:pomodoro'
const POMO_IDLE: PomoState = { mode: 'timer', phase: 'focus', round: 1, endsAt: null, pausedMs: null }
const POMO_LABEL: Record<PomoPhase, string> = { focus: 'Focus', short: 'Short break', long: 'Long break' }

function loadPomo(): PomoState {
  try {
    const raw = window.localStorage.getItem(POMO_KEY)
    if (!raw) return POMO_IDLE
    const p = JSON.parse(raw) as Partial<PomoState>
    const phaseOk = p.phase === 'focus' || p.phase === 'short' || p.phase === 'long'
    if (!phaseOk || (p.mode !== 'timer' && p.mode !== 'pomodoro')) return POMO_IDLE
    return {
      mode: p.mode,
      phase: p.phase as PomoPhase,
      round: typeof p.round === 'number' && p.round >= 1 ? Math.floor(p.round) : 1,
      endsAt: typeof p.endsAt === 'number' ? p.endsAt : null,
      pausedMs: typeof p.pausedMs === 'number' && p.endsAt == null ? p.pausedMs : null,
    }
  } catch {
    return POMO_IDLE
  }
}

function savePomo(p: PomoState) {
  try {
    window.localStorage.setItem(POMO_KEY, JSON.stringify(p))
  } catch {
    /* storage unavailable */
  }
}

function nextPhase(p: PomoState, every: number): PomoState {
  const idle = { endsAt: null, pausedMs: null }
  if (p.phase === 'focus') return { ...p, ...idle, phase: p.round % every === 0 ? 'long' : 'short' }
  if (p.phase === 'short') return { ...p, ...idle, phase: 'focus', round: p.round + 1 }
  return { ...p, ...idle, phase: 'focus', round: 1 }
}

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.value = 0.15
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.2)
    osc.onended = () => void ctx.close()
  } catch {
    /* audio unavailable */
  }
}

function notify(text: string) {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(text)
  } catch {
    /* notifications unavailable */
  }
}

const POMO_FIELDS = [
  { key: 'focus_minutes', label: 'Focus (min)', min: 5, max: 90 },
  { key: 'short_break_minutes', label: 'Short break (min)', min: 1, max: 30 },
  { key: 'long_break_minutes', label: 'Long break (min)', min: 5, max: 60 },
  { key: 'long_break_every', label: 'Long break every', min: 2, max: 8 },
] as const

function PomodoroSettings() {
  const { db, mutate } = useAppData()
  const cfg = db.settings.pomodoro
  const [open, setOpen] = useState(false)
  const [text, setText] = useState<Record<string, string>>({})

  const change = (key: (typeof POMO_FIELDS)[number]['key'], min: number, max: number, value: string) => {
    setText((t) => ({ ...t, [key]: value }))
    const n = Number(value)
    if (value.trim() === '' || !Number.isInteger(n) || n < min || n > max) return
    mutate((d) => {
      d.settings.pomodoro[key] = n
    })
  }

  return (
    <div className="border-t border-rule">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 sm:px-6 py-3 text-[13px] text-ink-muted hover:text-ink"
      >
        <span className="micro">Pomodoro settings</span>
        <ChevronDown size={16} className={open ? 'rotate-180' : ''} aria-hidden="true" />
      </button>
      {open && (
        <div className="px-4 sm:px-6 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {POMO_FIELDS.map((f) => (
            <FormField
              key={f.key}
              label={f.label}
              type="number"
              inputMode="numeric"
              mono
              min={f.min}
              max={f.max}
              step={1}
              value={text[f.key] ?? String(cfg[f.key])}
              onChange={(e) => change(f.key, f.min, f.max, e.target.value)}
              onBlur={() => setText((t) => ({ ...t, [f.key]: String(cfg[f.key]) }))}
            />
          ))}
        </div>
      )}
    </div>
  )
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

  /* ---- Pomodoro ---- */
  const cfg = db.settings.pomodoro
  const [pomo, setPomo] = useState<PomoState>(loadPomo)
  const pomoRef = useRef(pomo)
  const [pomoNow, setPomoNow] = useState(() => Date.now())
  const [pomoMsg, setPomoMsg] = useState<string | null>(null)

  const updatePomo = (p: PomoState) => {
    pomoRef.current = p
    setPomo(p)
    savePomo(p)
  }

  const phaseMs = (phase: PomoPhase) =>
    (phase === 'focus' ? cfg.focus_minutes : phase === 'short' ? cfg.short_break_minutes : cfg.long_break_minutes) * 60_000

  const endFocusSession = (endedAt: number) => {
    mutate((d) => {
      const s = activeSession(d)
      if (s) s.ended_at = new Date(endedAt).toISOString()
    })
  }

  const setMode = (mode: PomoState['mode']) => {
    setPomoMsg(null)
    updatePomo({ ...pomoRef.current, mode })
  }

  const pomoStart = () => {
    const p = pomoRef.current
    if (p.endsAt !== null) return
    if (p.phase === 'focus') {
      if (activeSession(db)) {
        setPomoMsg('A study session is already running. Stop it first.')
        return
      }
      mutate((d, nid) => {
        if (activeSession(d)) return
        d.studySessions.push({
          id: nid(),
          course_id: courseSel ? Number(courseSel) : null,
          started_at: new Date().toISOString(),
          ended_at: null,
          note: noteSel.trim(),
          ends_by: new Date(Date.now() + (p.pausedMs ?? phaseMs(p.phase))).toISOString(),
        })
      })
    }
    setPomoMsg(null)
    updatePomo({ ...p, endsAt: Date.now() + (p.pausedMs ?? phaseMs(p.phase)), pausedMs: null })
    setPomoNow(Date.now())
  }

  const pomoPause = () => {
    const p = pomoRef.current
    if (p.endsAt === null) return
    if (p.phase === 'focus') endFocusSession(Date.now())
    updatePomo({ ...p, endsAt: null, pausedMs: Math.max(0, p.endsAt - Date.now()) })
  }

  const pomoFinish = (natural: boolean) => {
    const p = pomoRef.current
    if (natural && p.endsAt === null) return
    if (p.phase === 'focus' && p.endsAt !== null) endFocusSession(natural ? Math.min(Date.now(), p.endsAt) : Date.now())
    if (natural) {
      beep()
      notify(p.phase === 'focus' ? 'Focus done — take a break' : 'Break over — back to focus')
    }
    setPomoMsg(null)
    updatePomo(nextPhase(p, cfg.long_break_every))
  }

  const pomoStop = () => {
    const p = pomoRef.current
    if (p.phase === 'focus' && p.endsAt !== null) endFocusSession(Date.now())
    setPomoMsg(null)
    updatePomo({ ...p, phase: 'focus', round: 1, endsAt: null, pausedMs: null })
  }

  const finishRef = useRef(pomoFinish)
  useEffect(() => {
    finishRef.current = pomoFinish
  })

  const pomoEndsAt = pomo.endsAt
  useEffect(() => {
    if (pomoEndsAt === null) return
    const t = window.setInterval(() => {
      const now = Date.now()
      setPomoNow(now)
      if (now >= pomoEndsAt) finishRef.current(true)
    }, 250)
    return () => window.clearInterval(t)
  }, [pomoEndsAt])

  const pomoActive = pomo.endsAt !== null
  const pomoPaused = pomo.pausedMs !== null
  const pomoTotal = phaseMs(pomo.phase)
  const pomoRemaining = pomo.endsAt !== null ? Math.max(0, pomo.endsAt - pomoNow) : (pomo.pausedMs ?? pomoTotal)
  const pomoSeconds = Math.ceil(pomoRemaining / 1000)
  const pomoClock = `${pad(Math.floor(pomoSeconds / 60))}:${pad(pomoSeconds % 60)}`
  const pomoProgress = pomoTotal > 0 ? Math.min(1, Math.max(0, 1 - pomoRemaining / pomoTotal)) : 0

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
          <SectionHeader
            index="01"
            title="Session Timer"
            meta={pomo.mode === 'pomodoro' ? (pomoActive ? POMO_LABEL[pomo.phase] : pomoPaused ? 'Paused' : 'Idle') : running ? 'Recording' : 'Idle'}
          />
          <div className="px-4 sm:px-6 pt-4 flex gap-2" role="group" aria-label="Timer mode">
            {(['timer', 'pomodoro'] as const).map((m) => {
              const on = pomo.mode === m
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  disabled={!on && (running !== null || pomoActive)}
                  onClick={() => setMode(m)}
                  className={`micro px-3 py-1.5 border disabled:opacity-40 ${on ? 'border-accent-strong text-accent-strong' : 'border-rule text-ink-muted hover:text-ink'}`}
                >
                  {m === 'timer' ? 'Timer' : 'Pomodoro'}
                </button>
              )
            })}
          </div>
          {pomo.mode === 'pomodoro' ? (
            <>
              <div className="p-4 sm:p-6 grid gap-5">
                <div>
                  <div className="micro mb-2 flex items-center gap-2">
                    {pomoActive && <span className="w-2 h-2 rounded-full bg-accent-fill motion-safe:animate-pulse" aria-hidden="true" />}
                    <span>{POMO_LABEL[pomo.phase]}</span>
                    <span className="tabular text-ink-muted">· Round {pomo.round} of {cfg.long_break_every}</span>
                  </div>
                  <div className="tabular text-[56px] sm:text-[72px] leading-none font-medium text-ink" aria-live="off">
                    {pomoClock}
                  </div>
                  <div
                    className="mt-3 h-1 w-full bg-surface-sunken"
                    role="progressbar"
                    aria-label="Phase progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(pomoProgress * 100)}
                  >
                    <div className="h-full bg-accent-fill" style={{ width: `${pomoProgress * 100}%` }} />
                  </div>
                  {pomoMsg && (
                    <p className="mt-3 text-[13px] text-danger" role="alert">
                      {pomoMsg}
                    </p>
                  )}
                </div>
                {pomo.phase === 'focus' && !pomoActive && !pomoPaused && (
                  <div className="grid gap-4 sm:grid-cols-2">
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
                    />
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {pomoActive ? (
                    <Button variant="primary" className="h-12 px-6 flex-1 sm:flex-none" icon={<Pause size={18} />} onClick={pomoPause}>
                      Pause
                    </Button>
                  ) : (
                    <Button variant="primary" className="h-12 px-6 flex-1 sm:flex-none" icon={<Play size={18} />} onClick={pomoStart}>
                      {pomoPaused ? 'Resume' : 'Start'}
                    </Button>
                  )}
                  <Button variant="secondary" className="h-12 px-6 flex-1 sm:flex-none" icon={<SkipForward size={18} />} onClick={() => pomoFinish(false)}>
                    Skip
                  </Button>
                  <Button variant="secondary" className="h-12 px-6 flex-1 sm:flex-none" icon={<Square size={18} />} onClick={pomoStop}>
                    Stop
                  </Button>
                </div>
              </div>
              <PomodoroSettings />
            </>
          ) : running ? (
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
