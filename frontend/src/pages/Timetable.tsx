import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { PageHeader, RecordCard } from '../components/ui/Panels'
import { StatusStamp } from '../components/ui/StatusStamp'
import { formatTime } from '../lib/format'
import { addDays, occurrencesBetween, todayKey, weekStart } from '../lib/localDb'
import { useAppData } from '../lib/store'
import type { Occurrence } from '../lib/types'

const dayLabel = (key: string) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' }).format(
    new Date(`${key}T12:00:00+07:00`),
  )

function kind(o: Occurrence) {
  if (o.source_type === 'class_meeting') return 'CLASS'
  if (o.source_type === 'calendar_event') return o.event_type ?? 'EVENT'
  return o.source_type === 'task_deadline' ? 'TASK DUE' : 'GRADED ITEM DUE'
}

/** Week timetable: classes, exams and deadlines, one card per day (works on phones). */
export function TimetablePage() {
  const { db } = useAppData()
  const today = todayKey()
  const [start, setStart] = useState(() => weekStart(today))
  const end = addDays(start, 6)

  const items = useMemo(() => occurrencesBetween(db, start, end), [db, start, end])
  const courses = useMemo(() => new Map(db.courses.map((c) => [c.id, c])), [db.courses])
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))

  const range = `${dayLabel(start).replace(/^\w+ /, '')} – ${dayLabel(end).replace(/^\w+ /, '')}`

  return (
    <>
      <PageHeader
        division="Division 02 · Temporal Scheduling"
        title="Timetable"
        subtitle={<span className="tabular">{range}</span>}
        aside={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setStart(addDays(start, -7))} aria-label="Previous week" icon={<ChevronLeft size={16} />} />
            <Button variant="secondary" size="sm" onClick={() => setStart(weekStart(today))} disabled={start === weekStart(today)}>
              This week
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setStart(addDays(start, 7))} aria-label="Next week" icon={<ChevronRight size={16} />} />
          </div>
        }
      />

      {db.courses.length === 0 && (
        <p className="mb-4 text-[13px] text-ink-muted">
          No courses yet. <Link to="/courses" className="text-accent-strong underline">Add courses</Link> to fill your timetable.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {days.map((d) => {
          const list = items.filter((o) => todayKey(new Date(o.start_at)) === d)
          const isToday = d === today
          const weekend = new Date(`${d}T12:00:00+07:00`).getUTCDay() % 6 === 0
          if (weekend && list.length === 0) return null
          return (
            <RecordCard key={d} className={isToday ? '!border-accent' : ''}>
              <div className="flex items-center gap-2 px-4 h-11 border-b border-rule">
                <h2 className={`font-display font-semibold ${isToday ? 'text-accent-strong' : 'text-ink'}`}>{dayLabel(d)}</h2>
                {isToday && <span className="micro !text-accent-strong">Today</span>}
                <span className="ml-auto tabular text-[12px] text-ink-faint">{list.length || ''}</span>
              </div>
              {list.length === 0 ? (
                <p className="px-4 py-4 text-[13px] text-ink-faint">Free</p>
              ) : (
                <ul className="divide-y divide-rule">
                  {list.map((o) => {
                    const c = o.course_id !== null ? courses.get(o.course_id) : undefined
                    const deadline = o.source_type === 'task_deadline' || o.source_type === 'assessment_deadline'
                    return (
                      <li key={o.id} className="flex gap-3 px-4 py-2.5">
                        <div className="w-[46px] shrink-0 tabular text-[12.5px] leading-tight">
                          <div className="text-ink font-medium">{formatTime(o.start_at)}</div>
                          {!deadline && <div className="text-ink-muted">{formatTime(o.end_at)}</div>}
                        </div>
                        <span className="w-[3px] self-stretch rounded-[1px] shrink-0" style={{ background: c?.color ?? 'var(--color-border-strong)' }} aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <div className="micro">
                            {kind(o)}
                            {c && <span className="text-ink-faint"> · {c.code}</span>}
                          </div>
                          <div className="font-medium text-ink leading-snug">{o.title}</div>
                          {o.location && (
                            <div className="mt-0.5 flex items-center gap-1 text-[12.5px] text-ink-muted">
                              <MapPin size={12} aria-hidden="true" />
                              {o.location}
                            </div>
                          )}
                        </div>
                        {o.event_type === 'EXAM' && <StatusStamp status="EXAM" className="self-center" />}
                        {o.event_type === 'QUIZ' && <StatusStamp status="QUIZ" className="self-center" />}
                      </li>
                    )
                  })}
                </ul>
              )}
            </RecordCard>
          )
        })}
      </div>
    </>
  )
}
