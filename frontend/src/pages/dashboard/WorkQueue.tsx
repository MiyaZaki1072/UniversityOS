import { ArrowRight, Check, GraduationCap } from 'lucide-react'
import { useState } from 'react'
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
  if (!priority) return null
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

/** Task id behind a task-deadline occurrence ("task-12" → 12). */
function taskIdOf(o: Occurrence): number | null {
  if (o.source_type !== 'task_deadline') return null
  const id = Number(o.id.replace(/^task-/, ''))
  return Number.isFinite(id) ? id : null
}

function hrefFor(o: Occurrence): string {
  if (o.source_type === 'assessment_deadline' && o.course_id) return `/gradebook/${o.course_id}`
  return '/tasks'
}

interface WorkQueueProps {
  items: Occurrence[]
  courses: Map<number, CourseRef>
  now: Date
  index?: string
  /** Marks a task done or open again. Without it the queue is read-only. */
  onCompleteTask?: (taskId: number, done: boolean) => void
}

/** Upcoming task and assessment deadlines. Tasks can be checked off in place. */
export function WorkQueue({ items, courses, now, index, onCompleteTask }: WorkQueueProps) {
  // Tasks checked off here stay listed (struck through) until the page is left, so a misclick can be undone.
  const [filed, setFiled] = useState<Map<string, Occurrence>>(() => new Map())

  const rows = [...items.filter((o) => !filed.has(o.id)), ...filed.values()].sort((a, b) =>
    a.end_at.localeCompare(b.end_at),
  )

  const toggle = (o: Occurrence) => {
    const id = taskIdOf(o)
    if (id === null || !onCompleteTask) return
    const done = !filed.has(o.id)
    setFiled((prev) => {
      const next = new Map(prev)
      if (done) next.set(o.id, o)
      else next.delete(o.id)
      return next
    })
    onCompleteTask(id, done)
  }

  return (
    <RecordCard className="h-full flex flex-col">
      <div id="work-queue" className="scroll-mt-20" />
      <SectionHeader
        index={index}
        title="Work Queue"
        action={
          <>
            <span className="tabular text-[12px] text-ink-muted">{items.length} open</span>
            <Link
              to="/tasks"
              className="inline-flex items-center gap-1 py-2 text-[13px] font-medium text-accent-strong hover:underline underline-offset-2"
            >
              All <span className="lg:sr-only xl:not-sr-only">tasks</span> <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </>
        }
      />
      {rows.length === 0 ? (
        <div className="flex-1">
          <EmptyState code="QUEUE CLEAR" title="No deadlines this week" />
        </div>
      ) : (
        <ul className="divide-y divide-rule flex-1">
          {rows.map((o) => {
            const course = o.course_id ? courses.get(o.course_id) : undefined
            const due = relativeDue(o.end_at, now)
            const urgent = daysUntil(o.end_at, now) <= 1
            const isDone = filed.has(o.id)
            const canComplete = onCompleteTask !== undefined && taskIdOf(o) !== null
            return (
              <li key={o.id} className="flex items-start gap-3 px-4 sm:px-5 py-3">
                {canComplete ? (
                  <label className="-m-2 p-2 pt-2.5 cursor-pointer" title={isDone ? 'Mark as not done' : 'Mark as done'}>
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={isDone}
                      onChange={() => toggle(o)}
                      aria-label={`${isDone ? 'Reopen' : 'Complete'} ${o.title}`}
                    />
                    <span
                      className={
                        'w-5 h-5 grid place-items-center border-[1.5px] rounded-xs peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent hover:border-sage ' +
                        (isDone ? 'border-sage bg-sage-wash text-sage-ink' : 'border-border-strong bg-surface')
                      }
                    >
                      {isDone && <Check size={13} strokeWidth={3} className="animate-stamp" />}
                    </span>
                  </label>
                ) : o.source_type === 'assessment_deadline' ? (
                  <span className="w-5 shrink-0 grid place-items-center pt-1 text-ink-muted" title="Graded item">
                    <GraduationCap size={15} aria-hidden="true" />
                  </span>
                ) : (
                  <div className="w-5 shrink-0 pt-1">
                    <PriorityMark priority={o.priority} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className={`leading-snug ${isDone ? 'text-ink-muted line-through decoration-ink-muted' : 'font-medium text-ink'}`}>
                    <Link to={hrefFor(o)} className="inline-block py-[3px] -my-[3px] hover:underline underline-offset-2 decoration-ink-muted">
                      {o.title}
                    </Link>
                  </div>
                  {/* Spaced facts rather than "·"-joined text, so a wrap never starts a line with a separator. */}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 tabular text-[12px] text-ink-muted">
                    {canComplete && o.priority && <PriorityMark priority={o.priority} />}
                    {course && (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <span className="w-2 h-2 rounded-[1px]" style={{ background: course.color }} aria-hidden="true" />
                        {course.code}
                      </span>
                    )}
                    <span className={`whitespace-nowrap ${urgent && !isDone ? 'text-accent-strong font-medium' : ''}`}>{due}</span>
                    <time dateTime={o.end_at} className="hidden sm:inline whitespace-nowrap">
                      {formatShortDate(o.end_at)} {formatTime(o.end_at)}
                    </time>
                    {o.source_type === 'assessment_deadline' && <span className="whitespace-nowrap">Graded</span>}
                  </div>
                </div>
                <StatusStamp status={isDone ? 'COMPLETED' : stampFor(o, now)} fresh={isDone} className="mt-0.5" />
              </li>
            )
          })}
        </ul>
      )}
    </RecordCard>
  )
}
