import { ArrowRight, MapPin } from 'lucide-react'
import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import type { CourseRef, Occurrence } from '../../lib/types'
import { formatTime } from '../../lib/format'
import { RecordCard, SectionHeader, EmptyState } from '../../components/ui/Panels'
import { StatusStamp } from '../../components/ui/StatusStamp'

interface TodayDocketProps {
  /** Classes and events for the day. Deadlines live in the work queue. */
  items: Occurrence[]
  courses: Map<number, CourseRef>
  now: Date
  dateLabel: string
  showNow: boolean
  /** Open deadlines due on this date, summarised in the footer. */
  dueToday: number
  index?: string
}

type Phase = 'past' | 'live' | 'upcoming'

function phaseOf(o: Occurrence, now: Date): Phase {
  const s = new Date(o.start_at).getTime()
  const e = new Date(o.end_at).getTime()
  const t = now.getTime()
  if (t >= e) return 'past'
  if (t >= s) return 'live'
  return 'upcoming'
}

function kindLabel(o: Occurrence) {
  if (o.source_type === 'class_meeting') return 'CLASS'
  return o.event_type ?? 'EVENT'
}

function Row({ o, course, phase }: { o: Occurrence; course?: CourseRef; phase: Phase }) {
  const past = phase === 'past'

  return (
    <li className="relative flex gap-4 px-4 sm:px-5 py-3.5">
      {/* Time column */}
      <div className="w-[52px] shrink-0 tabular text-[13px] leading-tight pt-0.5">
        <div className={past ? 'text-ink-muted' : 'text-ink font-medium'}>{formatTime(o.start_at)}</div>
        <div className="text-ink-muted">{formatTime(o.end_at)}</div>
      </div>

      {/* Course tab — fades once the item is over */}
      <span
        className={`w-[3px] self-stretch rounded-[1px] shrink-0 ${past ? 'opacity-35' : ''}`}
        style={{ background: course?.color ?? 'var(--color-border-strong)' }}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 micro">
          <span>{kindLabel(o)}</span>
          {course && <span>· {course.code}</span>}
          {phase === 'live' && (
            <span className="inline-flex items-center gap-1.5 text-accent-strong">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" aria-hidden="true" />
              In session
            </span>
          )}
          {past && <span className="sr-only">(finished)</span>}
        </div>
        <div className={`mt-0.5 leading-snug ${past ? 'text-ink-muted' : 'font-medium text-ink'}`}>
          {course ? (
            <Link
              to={`/courses/${course.id}`}
              className="inline-block py-[3px] -my-[3px] hover:underline underline-offset-2 decoration-ink-muted"
            >
              {o.title}
            </Link>
          ) : (
            o.title
          )}
        </div>
        {o.location && (
          <div className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-muted">
            <MapPin size={13} aria-hidden="true" />
            {o.location}
          </div>
        )}
      </div>

      <div className="shrink-0 self-center">
        {o.event_type === 'QUIZ' && <StatusStamp status="QUIZ" />}
        {o.event_type === 'EXAM' && <StatusStamp status="EXAM" />}
      </div>
    </li>
  )
}

function NowRule({ now }: { now: Date }) {
  return (
    <li aria-label={`Current time ${formatTime(now.toISOString())}`} className="relative flex items-center gap-3 px-4 sm:px-5 py-1">
      <span className="tabular text-[11px] font-semibold text-accent-strong w-[52px]">
        {formatTime(now.toISOString())}
      </span>
      <span className="h-px flex-1 bg-accent" />
      <span className="micro !text-accent-strong">Now</span>
    </li>
  )
}

/** Today's classes and events as one chronological schedule record. */
export function TodayDocket({ items, courses, now, dateLabel, showNow, dueToday, index }: TodayDocketProps) {
  const sorted = [...items].sort((a, b) => a.start_at.localeCompare(b.start_at))
  // The "now" rule sits after everything that has already started (an in-session class stays above it).
  const nowIdx = sorted.findIndex((o) => new Date(o.start_at).getTime() > now.getTime())
  // Only draw the "now" rule when the docket is for today.
  const insertAt = !showNow ? -1 : nowIdx === -1 ? sorted.length : nowIdx

  return (
    <RecordCard className="h-full flex flex-col">
      <SectionHeader index={index} title="Today's Docket" meta={dateLabel} />
      {sorted.length === 0 ? (
        <div className="flex-1">
          <EmptyState title="No classes today" body="Nothing on the timetable or calendar for this date." />
        </div>
      ) : (
        <ol className="divide-y divide-rule flex-1">
          {sorted.map((o, i) => (
            <Fragment key={o.id}>
              {i === insertAt && <NowRule now={now} />}
              <Row o={o} course={o.course_id ? courses.get(o.course_id) : undefined} phase={phaseOf(o, now)} />
            </Fragment>
          ))}
          {insertAt === sorted.length && <NowRule now={now} />}
        </ol>
      )}
      {dueToday > 0 && (
        <button
          type="button"
          onClick={() => document.getElementById('work-queue')?.scrollIntoView({ block: 'start' })}
          className="flex items-center justify-between gap-3 px-4 sm:px-5 h-11 border-t border-rule bg-surface-sunken text-[13px] text-left hover:bg-surface-2 cursor-pointer"
        >
          <span>
            <span className="tabular font-semibold text-accent-strong">{dueToday}</span>{' '}
            <span className="text-ink">{dueToday === 1 ? 'deadline' : 'deadlines'} due today</span>
          </span>
          <span className="inline-flex items-center gap-1 text-ink-muted">
            Work queue <ArrowRight size={14} aria-hidden="true" />
          </span>
        </button>
      )}
    </RecordCard>
  )
}
