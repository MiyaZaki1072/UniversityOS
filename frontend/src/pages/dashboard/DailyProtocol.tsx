import { Check } from 'lucide-react'
import { useState } from 'react'
import type { HabitToday } from '../../lib/types'
import { RecordCard, SectionHeader } from '../../components/ui/Panels'
import { StatusStamp } from '../../components/ui/StatusStamp'

/**
 * Today's habits as a punch card.
 * TODO(api): toggling should POST/DELETE /habits/{id}/logs/ for today's date.
 */
export function DailyProtocol({ habits }: { habits: HabitToday[] }) {
  const [done, setDone] = useState(() => new Set(habits.filter((h) => h.completed).map((h) => h.id)))
  const [justPunched, setJustPunched] = useState<number | null>(null)

  const toggle = (id: number) => {
    setDone((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else {
        next.add(id)
        setJustPunched(id)
      }
      return next
    })
  }

  const complete = done.size === habits.length

  return (
    <RecordCard className="h-full flex flex-col">
      <SectionHeader
        index="05"
        title="Daily Protocol"
        action={
          <span className="tabular text-[13px] text-ink">
            <span className="text-sage-ink font-semibold">{done.size}</span>
            <span className="text-ink-muted"> / {habits.length}</span>
          </span>
        }
      />
      <ul className="flex-1 divide-y divide-dashed divide-rule">
        {habits.map((h, i) => {
          const checked = done.has(h.id)
          return (
            <li key={h.id}>
              <label className="flex items-center gap-3 px-4 sm:px-5 py-3 cursor-pointer hover:bg-surface-sunken/70">
                <input type="checkbox" className="sr-only peer" checked={checked} onChange={() => toggle(h.id)} />
                <span className="tabular text-[11px] text-ink-faint w-5">{String(i + 1).padStart(2, '0')}</span>
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
                <span className={`flex-1 min-w-0 ${checked ? 'text-ink-muted line-through decoration-ink-faint' : 'text-ink'}`}>
                  {h.name}
                </span>
                {h.target_minutes && <span className="tabular text-[12px] text-ink-muted hidden sm:inline">{h.target_minutes}m</span>}
                <span
                  className={`tabular text-[12px] w-10 text-right ${h.streak_days >= 7 ? 'text-mustard-ink font-medium' : 'text-ink-faint'}`}
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
        <span className="micro">Streak in days</span>
        {complete ? <StatusStamp status="FILED" fresh /> : <span className="micro">{habits.length - done.size} remaining</span>}
      </div>
    </RecordCard>
  )
}
