import { Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { TaskFormModal } from '../components/tasks/TaskForm'
import { Button } from '../components/ui/Button'
import { EmptyState, PageHeader, RecordCard, SectionHeader } from '../components/ui/Panels'
import { StatusStamp, type StampStatus } from '../components/ui/StatusStamp'
import { daysUntil, formatShortDate, formatTime, relativeDue } from '../lib/format'
import type { LTask } from '../lib/localDb'
import { useAppData } from '../lib/store'

const priorityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const

function byDue(a: LTask, b: LTask) {
  if (a.due_at && b.due_at) return Date.parse(a.due_at) - Date.parse(b.due_at)
  if (a.due_at) return -1
  if (b.due_at) return 1
  return priorityRank[a.priority] - priorityRank[b.priority]
}

function stampFor(t: LTask, now: Date): StampStatus {
  if (t.status === 'COMPLETED') return 'COMPLETED'
  if (t.due_at && new Date(t.due_at) < now) return 'OVERDUE'
  if (t.status === 'IN_PROGRESS') return 'IN PROGRESS'
  if (t.due_at && daysUntil(t.due_at, now) === 0) return 'DUE TODAY'
  return 'PENDING'
}

export function TasksPage() {
  const { db, mutate } = useAppData()
  const [editing, setEditing] = useState<LTask | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [justDone, setJustDone] = useState<number | null>(null)
  const [showAllDone, setShowAllDone] = useState(false)
  const now = new Date()

  const courses = useMemo(() => new Map(db.courses.map((c) => [c.id, c])), [db.courses])

  const open = db.tasks.filter((t) => t.status !== 'COMPLETED')
  const overdue = open.filter((t) => t.due_at && new Date(t.due_at) < now).sort(byDue)
  const inProgress = open.filter((t) => t.status === 'IN_PROGRESS' && !overdue.includes(t)).sort(byDue)
  const pending = open.filter((t) => t.status === 'TODO' && !overdue.includes(t)).sort(byDue)
  const done = db.tasks
    .filter((t) => t.status === 'COMPLETED')
    .sort((a, b) => Date.parse(b.completed_at ?? '0') - Date.parse(a.completed_at ?? '0'))

  const toggle = (t: LTask) => {
    const completing = t.status !== 'COMPLETED'
    mutate((d) => {
      const x = d.tasks.find((y) => y.id === t.id)
      if (!x) return
      x.status = completing ? 'COMPLETED' : 'TODO'
      x.completed_at = completing ? new Date().toISOString() : null
    })
    setJustDone(completing ? t.id : null)
  }

  const remove = (t: LTask) => {
    if (!window.confirm(`Delete "${t.title}"?`)) return
    mutate((d) => {
      d.tasks = d.tasks.filter((x) => x.id !== t.id)
    })
  }

  const row = (t: LTask) => {
    const course = t.course_id !== null ? courses.get(t.course_id) : undefined
    const complete = t.status === 'COMPLETED'
    return (
      <li key={t.id} className="flex items-start gap-3 px-4 sm:px-5 py-3">
        <button
          onClick={() => toggle(t)}
          className={`mt-0.5 w-5 h-5 shrink-0 grid place-items-center border-[1.5px] rounded-xs ${
            complete ? 'bg-sage border-sage text-bg' : 'border-border-strong hover:border-accent'
          }`}
          aria-label={complete ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`}
        >
          {complete && <Check size={14} strokeWidth={3} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className={`font-medium leading-snug ${complete ? 'text-ink-muted line-through' : 'text-ink'}`}>{t.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 tabular text-[12px] text-ink-muted">
            {course && (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-[1px]" style={{ background: course.color }} aria-hidden="true" />
                {course.code}
              </span>
            )}
            {t.due_at && (
              <>
                {course && <span>·</span>}
                <span className={!complete && daysUntil(t.due_at, now) <= 1 ? 'text-accent-strong font-medium' : ''}>
                  {relativeDue(t.due_at, now)}
                </span>
                <span>
                  · {formatShortDate(t.due_at)} {formatTime(t.due_at)}
                </span>
              </>
            )}
            {t.priority === 'HIGH' && <span className="text-accent-strong">· high priority</span>}
          </div>
          {t.notes && <p className="mt-1 text-[13px] text-ink-muted whitespace-pre-line">{t.notes}</p>}
        </div>
        <StatusStamp status={stampFor(t, now)} fresh={justDone === t.id} className="mt-0.5 hidden sm:inline-flex" />
        <div className="flex shrink-0">
          <button
            onClick={() => {
              setEditing(t)
              setFormOpen(true)
            }}
            className="p-1.5 text-ink-muted hover:text-ink"
            aria-label={`Edit "${t.title}"`}
          >
            <Pencil size={16} />
          </button>
          <button onClick={() => remove(t)} className="p-1.5 text-ink-muted hover:text-danger" aria-label={`Delete "${t.title}"`}>
            <Trash2 size={16} />
          </button>
        </div>
      </li>
    )
  }

  const section = (index: string, title: string, items: LTask[], meta?: string) =>
    items.length > 0 && (
      <RecordCard>
        <SectionHeader index={index} title={title} meta={meta ?? `${items.length}`} />
        <ul className="divide-y divide-rule">{items.map(row)}</ul>
      </RecordCard>
    )

  return (
    <>
      <PageHeader
        division="Division 05 · Operations"
        title="Work Queue"
        subtitle={`${open.length} open · ${overdue.length} overdue · ${done.length} completed`}
        aside={
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            New task
          </Button>
        }
      />

      {db.tasks.length === 0 ? (
        <RecordCard>
          <EmptyState
            code="QUEUE CLEAR"
            title="No tasks yet"
            body="Add assignments, reading and anything else you need to get done."
            action={
              <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setFormOpen(true)}>
                New task
              </Button>
            }
          />
        </RecordCard>
      ) : (
        <div className="flex flex-col gap-4 lg:gap-5">
          {section('01', 'Overdue', overdue)}
          {section('02', 'In progress', inProgress)}
          {section('03', 'Pending', pending)}
          {open.length === 0 && (
            <RecordCard>
              <EmptyState code="QUEUE CLEAR" title="Everything is done" />
            </RecordCard>
          )}
          {done.length > 0 && (
            <RecordCard>
              <SectionHeader
                index="04"
                title="Completed"
                meta={`${done.length}`}
                action={
                  done.length > 5 && (
                    <button onClick={() => setShowAllDone((v) => !v)} className="text-[13px] font-medium text-accent-strong hover:underline">
                      {showAllDone ? 'Show recent' : 'Show all'}
                    </button>
                  )
                }
              />
              <ul className="divide-y divide-rule">{(showAllDone ? done : done.slice(0, 5)).map(row)}</ul>
            </RecordCard>
          )}
        </div>
      )}

      <TaskFormModal open={formOpen} onClose={() => setFormOpen(false)} task={editing} />
    </>
  )
}
