import type { CourseRef, Occurrence } from '../../lib/types'
import { daysUntil, formatShortDate, formatTime } from '../../lib/format'

interface CountdownPanelProps {
  exam: Occurrence
  course?: CourseRef
  /** Further exams listed under the main countdown. */
  following?: { exam: Occurrence; course?: CourseRef }[]
  /** The page clock, so every panel agrees on the time. */
  now: Date
  /** Section number shown in the header band. */
  index?: string
}

/** T−N counts calendar days, so name the near ones instead of "0 DAYS" / "1 DAY". */
function dayUnit(days: number) {
  if (days <= 0) return 'TODAY'
  if (days === 1) return 'TOMORROW'
  return 'DAYS'
}

function remaining(targetIso: string, now: Date) {
  const ms = Math.max(0, new Date(targetIso).getTime() - now.getTime())
  const mins = Math.floor(ms / 60_000)
  return { d: Math.floor(mins / 1440), h: Math.floor((mins % 1440) / 60), m: mins % 60 }
}

/** Concentric-ring motif drawn in the panel's corner. Original artwork. */
function Rings() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 320 320"
      className="absolute -right-24 -top-24 w-[340px] h-[340px] text-on-walnut opacity-[0.09] pointer-events-none"
    >
      {[150, 128, 106, 84, 62, 40].map((r, i) => (
        <circle
          key={r}
          cx="160"
          cy="160"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={i === 0 ? 2 : 1}
          strokeDasharray={i % 2 ? '3 5' : undefined}
        />
      ))}
      {Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2
        return (
          <line
            key={i}
            x1={160 + Math.cos(a) * 150}
            y1={160 + Math.sin(a) * 150}
            x2={160 + Math.cos(a) * (i % 6 === 0 ? 128 : 140)}
            y2={160 + Math.sin(a) * (i % 6 === 0 ? 128 : 140)}
            stroke="currentColor"
            strokeWidth="1.5"
          />
        )
      })}
    </svg>
  )
}

function Readout({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-start">
      <span className="tabular text-[22px] sm:text-[26px] leading-none text-on-walnut bg-walnut-2 border border-walnut-rule rounded-xs px-2 py-1.5 min-w-[3ch] text-center">
        {String(value).padStart(2, '0')}
      </span>
      <span className="mt-1.5 font-mono text-[10px] tracking-[0.14em] text-on-walnut-muted">{label}</span>
    </div>
  )
}

type Urgency = 'distant' | 'near' | 'imminent'

/** Drama scales with the stakes: calm a fortnight out, full volume in the last days. */
function urgencyOf(days: number): Urgency {
  if (days <= 2) return 'imminent'
  if (days <= 7) return 'near'
  return 'distant'
}

const figureClass: Record<Urgency, string> = {
  distant: 'text-[60px] sm:text-[72px] text-on-walnut',
  near: 'text-[84px] sm:text-[104px] text-mustard',
  imminent: 'text-[84px] sm:text-[104px] text-accent-strong',
}

export function CountdownPanel({ exam, course, following = [], now, index }: CountdownPanelProps) {
  const days = daysUntil(exam.start_at, now)
  const left = remaining(exam.start_at, now)
  const urgency = urgencyOf(days)

  return (
    <section
      aria-label="Upcoming examination"
      className="relative overflow-hidden rounded-sm bg-walnut text-on-walnut border border-border h-full flex flex-col"
    >
      <Rings />

      {/* Header band */}
      <div className="relative flex items-center gap-3 px-5 sm:px-6 h-11 border-b border-walnut-rule">
        {index ? (
          <span className="tabular text-[11px] font-semibold text-accent-strong tracking-wider">{index}</span>
        ) : (
          <span className="inline-block w-2 h-2 rounded-full bg-accent" aria-hidden="true" />
        )}
        <span
          className={`font-mono text-[11px] font-medium tracking-[0.14em] uppercase ${
            urgency === 'imminent' ? 'text-accent-strong' : 'text-on-walnut-muted'
          }`}
        >
          {urgency === 'imminent' ? 'Examination imminent' : 'Upcoming examination'}
        </span>
        <span className="ml-auto font-mono text-[11px] tracking-[0.1em] text-on-walnut-muted">
          FILE {exam.id.replace(/\D/g, '').padStart(4, '0')}
        </span>
      </div>

      <div className="relative px-5 sm:px-6 pt-5 pb-6 flex-1 flex flex-col">
        {course && (
          <div className="font-mono text-[12px] tracking-[0.12em] text-mustard">{course.code}</div>
        )}
        <h2 className="mt-1 font-display text-[22px] sm:text-[26px] leading-tight font-medium uppercase tracking-[0.04em] max-w-[22ch]">
          {exam.title}
        </h2>

        <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-5">
          <div
            className="flex items-baseline gap-3"
            aria-label={days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} calendar days`}
          >
            <span
              className={`tabular leading-none font-medium ${
                urgency === 'distant' ? 'text-[24px] sm:text-[28px] text-on-walnut-muted' : 'text-[28px] sm:text-[34px] text-accent'
              }`}
            >
              T−
            </span>
            <span className={`tabular leading-[0.85] font-medium tracking-[-0.04em] ${figureClass[urgency]}`}>{days}</span>
            <span className="tabular text-[18px] sm:text-[20px] tracking-[0.12em] text-on-walnut">
              {dayUnit(days)}
            </span>
          </div>

          {/* Hours and minutes only matter in the final week. */}
          {urgency !== 'distant' && (
            <div aria-label={`Exactly ${left.d} days ${left.h} hours ${left.m} minutes until start`}>
              <div className="mb-1.5 font-mono text-[10px] tracking-[0.14em] text-on-walnut-muted">UNTIL START</div>
              <div className="flex gap-2" aria-hidden="true">
                <Readout value={left.d} label="D" />
                <Readout value={left.h} label="HRS" />
                <Readout value={left.m} label="MIN" />
              </div>
            </div>
          )}
        </div>

        <dl className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-[13px]">
          <div>
            <dt className="font-mono text-[10px] tracking-[0.14em] text-on-walnut-muted">DATE</dt>
            <dd className="tabular mt-0.5">{formatShortDate(exam.start_at)}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] tracking-[0.14em] text-on-walnut-muted">TIME</dt>
            <dd className="tabular mt-0.5">
              {formatTime(exam.start_at)}–{formatTime(exam.end_at)}
            </dd>
          </div>
          {exam.location && (
            <div className="col-span-2 sm:col-span-1">
              <dt className="font-mono text-[10px] tracking-[0.14em] text-on-walnut-muted">LOCATION</dt>
              <dd className="mt-0.5">{exam.location}</dd>
            </div>
          )}
        </dl>
      </div>

      {following.length > 0 && (
        <ul className="relative border-t border-walnut-rule">
          {following.map(({ exam: e, course: c }) => (
            <li
              key={e.id}
              className="flex items-center gap-3 px-5 sm:px-6 py-2.5 border-b last:border-b-0 border-walnut-rule text-[13px]"
            >
              <span className="tabular w-14 shrink-0 text-mustard">T−{daysUntil(e.start_at, now)}</span>
              <span className="tabular w-[72px] shrink-0 text-on-walnut-muted hidden sm:inline">{c?.code}</span>
              <span className="truncate">{e.title}</span>
              <span className="tabular ml-auto shrink-0 text-on-walnut-muted">{formatShortDate(e.start_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
