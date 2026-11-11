import { Archive, Check, ChevronDown, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../components/ui/Button'
import { FormField } from '../components/ui/FormField'
import { Modal } from '../components/ui/Overlay'
import { EmptyState, PageHeader, RecordCard, SectionHeader } from '../components/ui/Panels'
import { SelectField } from '../components/ui/SelectField'
import {
  addDays,
  habitDoneOn,
  habitStreak,
  habitWeekCount,
  todayKey,
  weekStart,
  type LHabit,
  type LocalDB,
} from '../lib/localDb'
import { useAppData } from '../lib/store'

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000)

interface Consistency {
  percent: number | null
  label: string
  /** 12 entries, oldest first. 0 = nothing, 1 = some, 2 = target met. */
  weeks: (0 | 1 | 2 | null)[]
}

/** Consistency over the last 12 weeks (84 days). */
function consistency(db: LocalDB, h: LHabit, today: string): Consistency {
  const thisWeek = weekStart(today)
  const first = addDays(thisWeek, -77)
  const target = h.frequency === 'DAILY' ? 7 : Math.max(1, h.target_per_week)
  const weeks: Consistency['weeks'] = []
  let metWeeks = 0
  let countedWeeks = 0
  for (let i = 0; i < 12; i++) {
    const start = addDays(first, i * 7)
    const end = addDays(start, 6)
    if (end < h.created_on) {
      weeks.push(null)
      continue
    }
    const n = habitWeekCount(db, h.id, start)
    countedWeeks++
    if (n >= target) metWeeks++
    weeks.push(n >= target ? 2 : n > 0 ? 1 : 0)
  }

  if (h.frequency === 'WEEKLY') {
    return {
      percent: countedWeeks ? Math.round((metWeeks / countedWeeks) * 100) : null,
      label: countedWeeks ? `${metWeeks} of ${countedWeeks} weeks on target` : 'Not started',
      weeks,
    }
  }
  const windowStart = h.created_on > addDays(today, -83) ? h.created_on : addDays(today, -83)
  const total = daysBetween(windowStart, today) + 1
  if (total < 1) return { percent: null, label: 'Not started', weeks }
  const done = db.habitLogs.filter((l) => l.habit_id === h.id && l.date >= windowStart && l.date <= today).length
  return { percent: Math.round((done / total) * 100), label: `${done} of ${total} days`, weeks }
}

const blank = { name: '', frequency: 'DAILY' as LHabit['frequency'], perWeek: '3', minutes: '' }

function HabitFormModal({ open, onClose, habit }: { open: boolean; onClose: () => void; habit: LHabit | null }) {
  const { mutate } = useAppData()
  const [f, setF] = useState(blank)
  const [errors, setErrors] = useState<{ name?: string; perWeek?: string; minutes?: string }>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    setF(
      habit
        ? {
            name: habit.name,
            frequency: habit.frequency,
            perWeek: String(habit.frequency === 'WEEKLY' ? habit.target_per_week : 3),
            minutes: habit.target_minutes === null ? '' : String(habit.target_minutes),
          }
        : blank,
    )
  }, [open, habit])

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  const save = (e?: FormEvent) => {
    e?.preventDefault()
    const next: typeof errors = {}
    const name = f.name.trim()
    if (!name) next.name = 'Give the habit a name.'
    const perWeek = Number(f.perWeek)
    if (f.frequency === 'WEEKLY' && (!Number.isInteger(perWeek) || perWeek < 1 || perWeek > 7)) next.perWeek = 'Enter a whole number from 1 to 7.'
    const minutes = f.minutes.trim() === '' ? null : Number(f.minutes)
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1)) next.minutes = 'Enter whole minutes, or leave empty.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const values = {
      name,
      frequency: f.frequency,
      target_per_week: f.frequency === 'DAILY' ? 7 : perWeek,
      target_minutes: minutes,
    }
    mutate((d, nid) => {
      if (habit) {
        const x = d.habits.find((y) => y.id === habit.id)
        if (x) Object.assign(x, values)
      } else {
        d.habits.push({ id: nid(), ...values, archived: false, created_on: todayKey() })
      }
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      label="FORM H-1"
      title={habit ? 'Edit habit' : 'New habit'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => save()}>
            {habit ? 'Save' : 'Add habit'}
          </Button>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={save}>
        <FormField
          label="Name"
          placeholder="e.g. Read 20 pages"
          autoFocus
          value={f.name}
          onChange={(e) => set('name', e.target.value)}
          error={errors.name}
        />
        <SelectField
          label="Frequency"
          value={f.frequency}
          onChange={(e) => set('frequency', e.target.value as LHabit['frequency'])}
          options={[
            { value: 'DAILY', label: 'Every day' },
            { value: 'WEEKLY', label: 'Times per week' },
          ]}
        />
        {f.frequency === 'WEEKLY' && (
          <FormField
            label="Times per week"
            type="number"
            min={1}
            max={7}
            mono
            value={f.perWeek}
            onChange={(e) => set('perWeek', e.target.value)}
            error={errors.perWeek}
          />
        )}
        <FormField
          label="Target minutes"
          type="number"
          min={1}
          mono
          placeholder="Optional"
          value={f.minutes}
          onChange={(e) => set('minutes', e.target.value)}
          error={errors.minutes}
        />
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}

export function HabitsPage() {
  const { db, mutate } = useAppData()
  const [editing, setEditing] = useState<LHabit | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const today = todayKey()
  const monday = weekStart(today)
  const active = db.habits.filter((h) => !h.archived)
  const archived = db.habits.filter((h) => h.archived)
  const doneToday = active.filter((h) => habitDoneOn(db, h.id, today)).length

  const openForm = (h: LHabit | null) => {
    setEditing(h)
    setFormOpen(true)
  }

  const toggle = (habitId: number, date: string) => {
    mutate((d) => {
      const idx = d.habitLogs.findIndex((l) => l.habit_id === habitId && l.date === date)
      if (idx >= 0) d.habitLogs.splice(idx, 1)
      else d.habitLogs.push({ habit_id: habitId, date })
    })
  }

  const setArchived = (id: number, value: boolean) => {
    mutate((d) => {
      const h = d.habits.find((x) => x.id === id)
      if (h) h.archived = value
    })
  }

  const remove = (h: LHabit) => {
    if (!window.confirm(`Delete "${h.name}" and all of its history?`)) return
    mutate((d) => {
      d.habits = d.habits.filter((x) => x.id !== h.id)
      d.habitLogs = d.habitLogs.filter((l) => l.habit_id !== h.id)
    })
  }

  const iconBtn = 'p-1.5 text-ink-muted hover:text-ink'

  return (
    <>
      <PageHeader
        division="Division 06 · Operations"
        title="Daily Protocol"
        subtitle={`${doneToday} of ${active.length} done today`}
        aside={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => openForm(null)}>
            New habit
          </Button>
        }
      />

      {db.habits.length === 0 ? (
        <RecordCard>
          <EmptyState
            code="PROTOCOL EMPTY"
            title="No habits yet"
            body="Add the small things you want to do every day or every week."
            action={
              <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => openForm(null)}>
                New habit
              </Button>
            }
          />
        </RecordCard>
      ) : (
        <div className="flex flex-col gap-4 lg:gap-5">
          <RecordCard>
            <SectionHeader index="01" title="Today" meta={`${doneToday} / ${active.length}`} />
            {active.length === 0 ? (
              <EmptyState code="ALL ARCHIVED" title="No active habits" body="Restore one from the archive below, or add a new habit." />
            ) : (
              <ul className="divide-y divide-dashed divide-rule">
                {active.map((h) => {
                  const checked = habitDoneOn(db, h.id, today)
                  const streak = habitStreak(db, h, today)
                  return (
                    <li key={h.id} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                      <button
                        onClick={() => toggle(h.id, today)}
                        className={`w-6 h-6 shrink-0 grid place-items-center border-[1.5px] rounded-xs focus-visible:outline-2 focus-visible:outline-accent ${
                          checked ? 'border-sage bg-sage-wash text-sage-ink' : 'border-border-strong bg-surface hover:border-accent'
                        }`}
                        aria-pressed={checked}
                        aria-label={checked ? `Mark "${h.name}" not done today` : `Mark "${h.name}" done today`}
                      >
                        {checked && <Check size={15} strokeWidth={3} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className={`leading-snug break-words ${checked ? 'text-ink-muted line-through decoration-ink-faint' : 'text-ink'}`}>
                          {h.name}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 tabular text-[12px] text-ink-muted">
                          {h.frequency === 'WEEKLY' && (
                            <span>
                              {habitWeekCount(db, h.id, today)} / {h.target_per_week} this week
                            </span>
                          )}
                          {h.target_minutes !== null && <span>{h.target_minutes}m</span>}
                        </div>
                      </div>
                      <span
                        className={`tabular text-[12px] w-9 text-right shrink-0 ${streak >= 7 ? 'text-mustard-ink font-medium' : 'text-ink-faint'}`}
                        title="Current streak"
                      >
                        {streak > 0 ? `${streak}d` : '—'}
                      </span>
                      <div className="flex shrink-0">
                        <button onClick={() => openForm(h)} className={iconBtn} aria-label={`Edit "${h.name}"`}>
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => setArchived(h.id, true)} className={iconBtn} aria-label={`Archive "${h.name}"`}>
                          <Archive size={16} />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </RecordCard>

          {active.length > 0 && (
            <RecordCard>
              <SectionHeader index="02" title="This week" meta={<span className="tabular">{monday}</span>} />
              <div className="px-4 sm:px-5 py-3">
                <div className="flex items-center gap-2 mb-1 sm:pl-[40%]">
                  <div className="grid grid-cols-7 gap-1 flex-1 sm:max-w-[320px]">
                    {DAY_NAMES.map((n, i) => (
                      <span
                        key={n}
                        className={`micro text-center ${addDays(monday, i) === today ? 'text-accent-strong' : ''}`}
                        title={n}
                      >
                        {DAY_LABELS[i]}
                      </span>
                    ))}
                  </div>
                </div>
                <ul className="divide-y divide-dashed divide-rule">
                  {active.map((h) => (
                    <li key={h.id} className="py-2 sm:flex sm:items-center sm:gap-2">
                      <div className="text-[14px] text-ink truncate mb-1.5 sm:mb-0 sm:w-[40%] sm:pr-3">{h.name}</div>
                      <div className="grid grid-cols-7 gap-1 sm:flex-1 sm:max-w-[320px]">
                        {DAY_NAMES.map((n, i) => {
                          const date = addDays(monday, i)
                          const future = date > today
                          const done = habitDoneOn(db, h.id, date)
                          const isToday = date === today
                          return (
                            <button
                              key={date}
                              disabled={future}
                              onClick={() => toggle(h.id, date)}
                              aria-pressed={done}
                              aria-label={`${h.name}, ${n} ${date}: ${done ? 'done' : 'not done'}`}
                              className={`h-8 grid place-items-center rounded-xs border-[1.5px] disabled:opacity-40 disabled:cursor-not-allowed ${
                                done ? 'bg-sage border-sage text-bg' : 'bg-surface-sunken'
                              } ${
                                isToday && !done
                                  ? 'border-accent'
                                  : !done
                                    ? 'border-border' + (future ? '' : ' hover:border-border-strong')
                                    : ''
                              }`}
                            >
                              {done && <Check size={13} strokeWidth={3} />}
                            </button>
                          )
                        })}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </RecordCard>
          )}

          {active.length > 0 && (
            <RecordCard>
              <SectionHeader index="03" title="Last 12 weeks" meta="Consistency" />
              <ul className="divide-y divide-dashed divide-rule">
                {active.map((h) => {
                  const c = consistency(db, h, today)
                  return (
                    <li key={h.id} className="px-4 sm:px-5 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                      <div className="min-w-0 sm:w-[40%]">
                        <div className="text-[14px] text-ink truncate">{h.name}</div>
                        <div className="tabular text-[12px] text-ink-muted">{c.label}</div>
                      </div>
                      <div className="flex items-center gap-3 sm:flex-1">
                        <div className="grid grid-cols-12 gap-0.5 flex-1 max-w-[260px]" aria-hidden="true">
                          {c.weeks.map((w, i) => (
                            <span
                              key={i}
                              className={`h-4 rounded-[1px] border ${
                                w === 2
                                  ? 'bg-sage border-sage'
                                  : w === 1
                                    ? 'bg-sage-wash border-sage'
                                    : w === 0
                                      ? 'bg-surface-sunken border-border'
                                      : 'border-rule'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="tabular text-[13px] text-ink w-12 text-right shrink-0">
                          {c.percent === null ? '—' : `${c.percent}%`}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </RecordCard>
          )}

          {archived.length > 0 && (
            <RecordCard>
              <SectionHeader
                index="04"
                title="Archived"
                meta={`${archived.length}`}
                action={
                  <button
                    onClick={() => setShowArchived((v) => !v)}
                    className="inline-flex items-center gap-1 text-[13px] font-medium text-accent-strong hover:underline"
                    aria-expanded={showArchived}
                  >
                    {showArchived ? 'Hide' : 'Show'}
                    <ChevronDown size={14} className={showArchived ? 'rotate-180' : ''} />
                  </button>
                }
              />
              {showArchived && (
                <ul className="divide-y divide-dashed divide-rule">
                  {archived.map((h) => (
                    <li key={h.id} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                      <span className="min-w-0 flex-1 truncate text-ink-muted">{h.name}</span>
                      <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} onClick={() => setArchived(h.id, false)}>
                        Restore
                      </Button>
                      <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => remove(h)}>
                        Delete
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </RecordCard>
          )}
        </div>
      )}

      <HabitFormModal open={formOpen} onClose={() => setFormOpen(false)} habit={editing} />
    </>
  )
}
