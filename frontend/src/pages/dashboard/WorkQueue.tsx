import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { CourseRef, Occurrence } from '../../lib/types'
import { daysUntil, formatShortDate, formatTime, relativeDue } from '../../lib/format'
import { RecordCard, SectionHeader, EmptyState } from '../../components/ui/Panels'
import { StatusStamp, type StampStatus } from '../../components/ui/StatusStamp'

function stampFor(o: Occurrence, now: Date): StampStatus {
  const d = daysUntil(o.end_at, now)
  if (new Date(o.end_at) < now) return 'OVERDUE'
  if (o.status === 'IN_PROGRESS') return 'IN PROGRESS'
  if (d === 0) return 'DUE TODAY'
  return 'PENDING'
}

const priorityLevel = { LOW: 1, MEDIUM: 2, HIGH: 3 } as const

function PriorityMark({ priority }: { priority?: Occurrence['priority'] }) {
  if (!priority) return <span className="w-[22px]" aria-hidden="true" />
  const level = priorityLevel[priority]
  return (
    <span className="flex gap-[2px] w-[22px]" role="img" aria-label={`${priority.toLowerCase()} priority`}>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`w-1.5 h-3 rounded-[1px] ${n <= level ? (level === 3 ? 'bg-accent' : 'bg-ink-muted') : 'bg-surface-2'}`}
        />
      ))}
    </span>
  )
}

interface WorkQueueProps {
  items: Occurrence[]
  courses: Map<number, CourseRef>
  now: Date
}

/** Upcoming task and assessment deadlines. */
export function WorkQueue({ items, courses, now }: WorkQueueProps) {
  return (
    <RecordCard className="h-full flex flex-col">
      <SectionHeader
        index="03"
        title="Work Queue"
        meta="Next 7 days"
        action={
          <Link to="/tasks" className="inline-flex items-center gap-1 text-[13px] font-medium text-accent-strong hover:underline underline-offset-2">
            All tasks <ArrowRight size={14} />
          </Link>
        }
      />
      {items.length === 0 ? (
        <EmptyState code="QUEUE CLEAR" title="No deadlines this week" />
      ) : (
        <ul className="divide-y divide-rule flex-1">
          {items.map((o) => {
            const course = o.course_id ? courses.get(o.course_id) : undefined
            const due = relativeDue(o.end_at, now)
            const urgent = daysUntil(o.end_at, now) <= 1
            return (
              <li key={o.id} className="flex items-start gap-3 px-4 sm:px-5 py-3">
                <div className="pt-1">
                  <PriorityMark priority={o.priority} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink leading-snug">{o.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 tabular text-[12px] text-ink-muted">
                    {course && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-[1px]" style={{ background: course.color }} aria-hidden="true" />
                        {course.code}
                      </span>
                    )}
                    <span>·</span>
                    <span className={urgent ? 'text-accent-strong font-medium' : ''}>{due}</span>
                    <span className="hidden sm:inline">
                      · {formatShortDate(o.end_at)} {formatTime(o.end_at)}
                    </span>
                    {o.source_type === 'assessment_deadline' && <span>· graded item</span>}
                  </div>
                </div>
                <StatusStamp status={stampFor(o, now)} className="mt-0.5" />
              </li>
            )
          })}
        </ul>
      )}
    </RecordCard>
  )
}
