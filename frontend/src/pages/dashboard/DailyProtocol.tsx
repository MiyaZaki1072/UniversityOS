import { Check } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { HabitToday } from '../../lib/types'
import { RecordCard, SectionHeader } from '../../components/ui/Panels'
import { StatusStamp } from '../../components/ui/StatusStamp'

interface DailyProtocolProps {
  habits: HabitToday[]
  /** Called when a habit is punched or un-punched. Without it the card keeps its own state (sample data). */
  onToggle?: (id: number, done: boolean) => void
  index?: string
}

/** Today's habits as a punch card. */
export function DailyProtocol({ habits, onToggle, index }: DailyProtocolProps) {
  const [local, setLocal] = useState(() => new Set(habits.filter((h) => h.completed).map((h) => h.id)))
  const [justPunched, setJustPunched] = useState<number | null>(null)
  const done = onToggle ? new Set(habits.filter((h) => h.completed).map((h) => h.id)) : local

  const toggle = (id: number) => {
    const nowDone = !done.has(id)
    if (nowDone) setJustPunched(id)
    if (onToggle) return onToggle(id, nowDone)
    setLocal((prev) => {
      const next = new Set(prev)
      if (nowDone) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const complete = habits.length > 0 && done.size === habits.length

  return (
    <RecordCard className="h-full flex flex-col">
      <SectionHeader
        index={index}
        title="Daily Protocol"
        meta="Habits"
        action={
          <span className="tabular text-[13px] text-ink">
            <span className="text-sage-ink font-semibold">{done.size}</span>
            <span className="text-ink-muted"> / {habits.length}</span>
          </span>
        }
      />
      {habits.length === 0 && (
        <p className="flex-1 px-4 sm:px-5 py-6 text-[13.5px] text-ink-muted">
          No habits yet.{' '}
          <Link to="/habits" className="text-accent-strong underline underline-offset-2">
            Add your first habit
          </Link>
          .
        </p>
      )}
      <ul className={`divide-y divide-dashed divide-rule ${habits.length ? 'flex-1' : ''}`}>
        {habits.map((h, i) => {
          const checked = done.has(h.id)
          return (
            <li key={h.id}>
              <label className="flex items-center gap-3 px-4 sm:px-5 py-3 cursor-pointer hover:bg-surface-sunken/70">
                <input type="checkbox" className="sr-only peer" checked={checked} onChange={() => toggle(h.id)} />
                <span className="tabular text-[11px] text-ink-muted w-5" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                {/* Punch box */}
                <span
                  className={
                    'w-6 h-6 shrink-0 grid place-items-center border-[1.5px] rounded-xs peer-focus-visible:outline-2 peer-focus-visible:outline-accent ' +
                    (checked ? 'border-sage bg-sage-wash text-sage-ink' : 'border-border-strong bg-surface')
                  }
                >
                  {checked && (
                    <Check size={15} strokeWidth={3} className={justPunched === h.id ? 'animate-stamp' : ''} />
                  )}
                </span>
                <span className={`flex-1 min-w-0 ${checked ? 'text-ink-muted line-through decoration-ink-muted' : 'text-ink'}`}>
                  {h.name}
                </span>
                {h.target_minutes && <span className="tabular text-[12px] text-ink-muted hidden sm:inline">{h.target_minutes}m</span>}
                <span
                  className={`tabular text-[12px] w-10 text-right ${h.streak_days >= 7 ? 'text-mustard-ink font-medium' : 'text-ink-muted'}`}
                  title="Current streak"
                >
                  {h.streak_days > 0 ? `${h.streak_days}d` : '—'}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      <div className="flex items-center justify-between px-4 sm:px-5 h-11 border-t border-rule bg-surface-sunken">
        <span className="text-[12.5px] text-ink-muted">Streaks count days in a row</span>
        {complete ? <StatusStamp status="FILED" fresh /> : <span className="tabular text-[12.5px] text-ink-muted">{habits.length - done.size} to go</span>}
      </div>
    </RecordCard>
  )
}
