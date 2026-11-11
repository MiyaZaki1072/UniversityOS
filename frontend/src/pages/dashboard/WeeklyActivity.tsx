import { formatMinutes } from '../../lib/format'
import { RecordCard, SectionHeader } from '../../components/ui/Panels'

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

interface WeeklyActivityProps {
  byDay: number[]
  weekTarget: number
  /** 0 = Monday. */
  todayIndex: number
  index?: string
}

/** Study minutes per day against the daily share of the weekly target. */
export function WeeklyActivity({ byDay, weekTarget, todayIndex, index }: WeeklyActivityProps) {
  const hasTarget = weekTarget > 0
  const dailyTarget = weekTarget / 7
  // Floor of 1 keeps bar heights finite when there is no target and no study yet.
  const max = Math.max(1, dailyTarget * 1.5, ...byDay)
  const total = byDay.reduce((a, b) => a + b, 0)
  const elapsed = todayIndex + 1
  const avg = Math.round(total / elapsed)
  const targetPct = (dailyTarget / max) * 100

  return (
    <RecordCard>
      <SectionHeader index={index} title="Weekly Activity Log" meta="Study minutes" />
      <div className="grid md:grid-cols-[1fr_220px]">
        <div className="px-4 sm:px-5 pt-5 pb-4">
          <div className="relative h-[150px]">
            {/* Target line */}
            {hasTarget && (
              <div className="absolute inset-x-0 border-t border-dashed border-mustard" style={{ bottom: `${targetPct}%` }} aria-hidden="true">
                <span className="absolute right-0 -top-5 tabular text-[10.5px] text-mustard-ink">
                  TARGET {formatMinutes(Math.round(dailyTarget))}
                </span>
              </div>
            )}
            <ol className="absolute inset-0 grid grid-cols-7 gap-2 sm:gap-4 items-end">
              {byDay.map((m, i) => {
                const future = i > todayIndex
                const isToday = i === todayIndex
                const h = (m / max) * 100
                return (
                  <li key={DAYS[i]} className="h-full flex flex-col justify-end items-center" aria-label={`${DAYS[i]}: ${future ? 'not yet' : formatMinutes(m)}`}>
                    {!future && m > 0 && (
                      <span className="hidden sm:block tabular text-[11px] text-ink-muted mb-1">{formatMinutes(m)}</span>
                    )}
                    <div
                      className={
                        'w-full max-w-[44px] rounded-t-[2px] ' +
                        (future
                          ? 'h-full border border-dashed border-rule/70'
                          : isToday
                            ? 'bg-accent'
                            : 'bg-olive')
                      }
                      style={future ? undefined : { height: `${Math.max(h, m > 0 ? 2 : 0)}%` }}
                    />
                  </li>
                )
              })}
            </ol>
          </div>
          <ol className="grid grid-cols-7 gap-2 sm:gap-4 mt-2 border-t border-border-strong pt-2">
            {DAYS.map((d, i) => (
              <li key={d} className={`text-center tabular text-[11px] ${i === todayIndex ? 'text-accent-strong font-semibold' : 'text-ink-muted'}`}>
                {d}
              </li>
            ))}
          </ol>
        </div>

        <dl className="grid grid-cols-3 md:grid-cols-1 border-t md:border-t-0 md:border-l border-rule divide-x md:divide-x-0 md:divide-y divide-rule">
          <div className="p-4">
            <dt className="text-[12.5px] text-ink-muted">Week to date</dt>
            <dd className="tabular text-xl text-ink mt-1">{formatMinutes(total)}</dd>
            {hasTarget && (
              <dd className="tabular text-[12px] text-ink-muted mt-1">{Math.round((total / weekTarget) * 100)}% of target</dd>
            )}
          </div>
          <div className="p-4">
            <dt className="text-[12.5px] text-ink-muted">Weekly target</dt>
            <dd className="tabular text-xl text-ink mt-1">{hasTarget ? formatMinutes(weekTarget) : '—'}</dd>
          </div>
          <div className="p-4">
            <dt className="text-[12.5px] text-ink-muted">Daily average</dt>
            <dd className="tabular text-xl text-ink mt-1">{formatMinutes(avg)}</dd>
          </div>
        </dl>
      </div>
    </RecordCard>
  )
}
