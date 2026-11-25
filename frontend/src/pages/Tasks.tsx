import { ArrowLeft, ArrowRight, Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { TaskFormModal } from '../components/tasks/TaskForm'
import { Button } from '../components/ui/Button'
import { EmptyState, PageHeader, RecordCard, SectionHeader } from '../components/ui/Panels'
import { StatusStamp, type StampStatus } from '../components/ui/StatusStamp'
import { daysUntil, formatShortDate, formatTime, relativeDue } from '../lib/format'
import {
  addDays,
  fromLocalInput,
  todayKey,
  toLocalInput,
  weekdayOf,
  type LInboxItem,
  type LTask,
  type TaskStatus,
} from '../lib/localDb'
import { useAppData } from '../lib/store'

interface QuickCaptureProps {
  /** Pre-selected course id when the user has not chosen one manually. */
  defaultCourseId?: number | null
  /** Optional trailing element (e.g. an Inbox count link). */
  trailing?: ReactNode
}

/** Compact one-line capture input shared between Dashboard and Tasks. */
export function QuickCapture({ defaultCourseId = null, trailing }: QuickCaptureProps) {
  const { db, mutate } = useAppData()
  const [text, setText] = useState('')
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const effectiveCourse =
    selectedCourse !== null
      ? selectedCourse
      : defaultCourseId !== null && db.courses.some((c) => c.id === defaultCourseId)
        ? String(defaultCourseId)
        : ''

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim().slice(0, 500)
    if (!trimmed) return
    const courseId = effectiveCourse ? Number(effectiveCourse) : null
    mutate((d, nid) => {
      d.inbox ??= []
      d.inbox.unshift({
        id: nid(),
        text: trimmed,
        created_at: new Date().toISOString(),
        course_id: courseId !== null && d.courses.some((c) => c.id === courseId) ? courseId : null,
      })
    })
    setText('')
    inputRef.current?.focus()
  }

  return (
    <RecordCard className="mb-4 lg:mb-5 px-3 sm:px-4 py-2.5">
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          maxLength={500}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Jot something down… (Enter to save)"
          aria-label="Quick capture note"
          className="h-9 flex-1 min-w-[180px] px-2.5 bg-surface-sunken border border-border-strong rounded-xs text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent"
        />
        <select
          value={effectiveCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
          aria-label="Course for note"
          className="h-9 max-w-[140px] px-2 bg-surface-sunken border border-border-strong rounded-xs text-[13px] text-ink focus:outline-none focus:border-accent"
        >
          <option value="">No course</option>
          {db.courses.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.code}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="secondary" disabled={!text.trim()}>
          Save
        </Button>
        {trailing}
      </form>
    </RecordCard>
  )
}

const URL_RE = /https?:\/\/[^\s<>()]+/i

function extractUrl(text: string): { url: string; title: string } | null {
  const match = URL_RE.exec(text)
  if (!match) return null
  const url = match[0].replace(/[.,;:!?]+$/, '')
  const rest = text.replace(match[0], '').replace(/\s+/g, ' ').trim()
  let host = url
  try {
    host = new URL(url).host || url
  } catch {
    /* keep raw url */
  }
  return { url, title: rest || host }
}

function timeAgo(iso: string, now: Date): string {
  const diffMs = Math.max(0, now.getTime() - Date.parse(iso))
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

type TasksView = 'list' | 'week' | 'course' | 'board'

const VIEW_KEY = 'university-os:tasks-view'
const VIEWS: { id: TasksView; label: string }[] = [
  { id: 'list', label: 'List' },
  { id: 'week', label: 'Next 7 days' },
  { id: 'course', label: 'By course' },
  { id: 'board', label: 'Board' },
]

function loadView(): TasksView {
  try {
    const v = window.localStorage.getItem(VIEW_KEY)
    if (v === 'list' || v === 'week' || v === 'course' || v === 'board') return v
  } catch {
    /* storage unavailable */
  }
  return 'list'
}

/** Move a due timestamp to `targetDateKey` while preserving its local time of day (fallback 23:59). */
function moveDueToDate(dueAt: string | null, targetDateKey: string): string {
  let time = '23:59'
  if (dueAt && !Number.isNaN(Date.parse(dueAt))) {
    const local = toLocalInput(dueAt)
    const match = /T(\d{2}:\d{2})$/.exec(local)
    if (match) time = match[1]
  }
  return fromLocalInput(`${targetDateKey}T${time}`)!
}

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

interface RowOptions {
  hideStamp?: boolean
  moveLeft?: { status: TaskStatus; label: string }
  moveRight?: { status: TaskStatus; label: string }
}

export function TasksPage() {
  const { db, mutate } = useAppData()
  const [view, setView] = useState<TasksView>(loadView)
  const [editing, setEditing] = useState<LTask | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [justDone, setJustDone] = useState<number | null>(null)
  const [showAllDone, setShowAllDone] = useState(false)
  const [showNoDue, setShowNoDue] = useState(false)
  const [inboxOpen, setInboxOpen] = useState(true)
  const [pushMenuOpen, setPushMenuOpen] = useState(false)
  const [notice, setNotice] = useState<{ text: string; undo?: () => void } | null>(null)
  const noticeTimer = useRef<number | undefined>(undefined)
  const now = new Date()
  const today = todayKey(now)

  useEffect(() => () => window.clearTimeout(noticeTimer.current), [])

  const showNotice = (text: string, opts?: { undo?: () => void; ms?: number }) => {
    setNotice({ text, undo: opts?.undo })
    window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(null), opts?.ms ?? 4500)
  }

  const changeView = (next: TasksView) => {
    setView(next)
    setPushMenuOpen(false)
    try {
      window.localStorage.setItem(VIEW_KEY, next)
    } catch {
      /* storage unavailable */
    }
  }

  const courses = useMemo(() => new Map(db.courses.map((c) => [c.id, c])), [db.courses])

  const open = db.tasks.filter((t) => t.status !== 'COMPLETED')
  const overdue = open.filter((t) => t.due_at && new Date(t.due_at) < now).sort(byDue)
  const overdueIds = new Set(overdue.map((t) => t.id))
  const inProgress = open.filter((t) => t.status === 'IN_PROGRESS' && !overdueIds.has(t.id)).sort(byDue)
  const pending = open.filter((t) => t.status === 'TODO' && !overdueIds.has(t.id)).sort(byDue)
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

  const moveTask = (t: LTask, nextStatus: TaskStatus) => {
    const completing = nextStatus === 'COMPLETED' && t.status !== 'COMPLETED'
    mutate((d) => {
      const x = d.tasks.find((y) => y.id === t.id)
      if (!x) return
      x.status = nextStatus
      x.completed_at = nextStatus === 'COMPLETED' ? (completing ? new Date().toISOString() : x.completed_at) : null
    })
    setJustDone(completing ? t.id : null)
  }

  const pushOverdue = (targetDateKey: string, label: string) => {
    const count = overdueIds.size
    if (count === 0) return
    mutate((d) => {
      for (const t of d.tasks) {
        if (overdueIds.has(t.id)) {
          t.due_at = moveDueToDate(t.due_at, targetDateKey)
        }
      }
    })
    setPushMenuOpen(false)
    showNotice(`Moved ${count} ${count === 1 ? 'task' : 'tasks'} to ${label}.`)
  }

  const pushOneTomorrow = (t: LTask) => {
    const tomorrow = addDays(todayKey(), 1)
    mutate((d) => {
      const x = d.tasks.find((y) => y.id === t.id)
      if (x) x.due_at = moveDueToDate(x.due_at, tomorrow)
    })
    showNotice(`Moved "${t.title}" to tomorrow.`)
  }

  const remove = (t: LTask) => {
    if (!window.confirm(`Delete "${t.title}"?`)) return
    mutate((d) => {
      d.tasks = d.tasks.filter((x) => x.id !== t.id)
    })
  }

  const inboxItems = db.inbox ?? []

  const setInboxCourse = (itemId: number, courseId: number | null) => {
    mutate((d) => {
      const item = (d.inbox ?? []).find((x) => x.id === itemId)
      if (item) item.course_id = courseId
    })
  }

  const triageToTask = (item: LInboxItem) => {
    let created: LTask | null = null
    mutate((d, nid) => {
      const task: LTask = {
        id: nid(),
        title: item.text,
        course_id: item.course_id !== null && d.courses.some((c) => c.id === item.course_id) ? item.course_id : null,
        due_at: null,
        status: 'TODO',
        priority: 'MEDIUM',
        notes: '',
        completed_at: null,
      }
      d.tasks.push(task)
      d.inbox = (d.inbox ?? []).filter((x) => x.id !== item.id)
      created = task
    })
    if (created) {
      setEditing(created)
      setFormOpen(true)
    }
  }

  const triageToTopic = (item: LInboxItem) => {
    const course = item.course_id !== null ? courses.get(item.course_id) : undefined
    if (!course) return
    mutate((d, nid) => {
      const c = d.courses.find((x) => x.id === course.id)
      if (!c) return
      c.topics ??= []
      c.topics.push({
        id: nid(),
        title: item.text,
        confidence: null,
        last_reviewed: null,
        review_count: 0,
      })
      d.inbox = (d.inbox ?? []).filter((x) => x.id !== item.id)
    })
    showNotice(`Added topic to ${course.code}.`)
  }

  const triageToLink = (item: LInboxItem, link: { url: string; title: string }) => {
    mutate((d, nid) => {
      d.links.push({
        id: nid(),
        title: link.title,
        url: link.url,
        description: '',
        course_id: item.course_id !== null && d.courses.some((c) => c.id === item.course_id) ? item.course_id : null,
        category: '',
        favorite: false,
      })
      d.inbox = (d.inbox ?? []).filter((x) => x.id !== item.id)
    })
    showNotice(`Saved link "${link.title}".`)
  }

  const deleteInboxItem = (item: LInboxItem) => {
    const snapshot = { ...item }
    mutate((d) => {
      d.inbox = (d.inbox ?? []).filter((x) => x.id !== item.id)
    })
    showNotice('Note deleted.', {
      ms: 5000,
      undo: () => {
        mutate((d) => {
          d.inbox ??= []
          if (!d.inbox.some((x) => x.id === snapshot.id)) {
            d.inbox.unshift(snapshot)
          }
        })
        setNotice(null)
      },
    })
  }

  const row = (t: LTask, opts?: RowOptions) => {
    const course = t.course_id !== null ? courses.get(t.course_id) : undefined
    const complete = t.status === 'COMPLETED'
    const isOverdue = !complete && overdueIds.has(t.id)
    return (
      <li key={t.id} className="flex items-start gap-3 px-4 sm:px-5 py-3">
        <button
          type="button"
          onClick={() => toggle(t)}
          className={`mt-0.5 w-5 h-5 shrink-0 grid place-items-center border-[1.5px] rounded-xs cursor-pointer ${
            complete ? 'bg-sage border-sage text-bg' : 'border-border-strong hover:border-accent'
          }`}
          aria-label={complete ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`}
        >
          {complete && <Check size={14} strokeWidth={3} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className={`font-medium leading-snug break-words ${complete ? 'text-ink-muted line-through' : 'text-ink'}`}>{t.title}</div>
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
          {t.notes && <p className="mt-1 text-[13px] text-ink-muted whitespace-pre-line break-words">{t.notes}</p>}
          {(isOverdue || opts?.moveLeft || opts?.moveRight) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {isOverdue && (
                <button
                  type="button"
                  onClick={() => pushOneTomorrow(t)}
                  className="h-7 px-2 rounded-xs border border-border-strong bg-surface-sunken text-[12px] font-medium text-ink-muted hover:text-ink hover:border-accent cursor-pointer transition-colors"
                >
                  Tomorrow
                </button>
              )}
              {opts?.moveLeft && (
                <button
                  type="button"
                  onClick={() => moveTask(t, opts.moveLeft!.status)}
                  aria-label={`Move to ${opts.moveLeft.label}`}
                  className="inline-flex items-center gap-1 h-7 px-2 rounded-xs border border-border bg-surface-sunken text-[12px] text-ink-muted hover:text-ink hover:border-border-strong cursor-pointer transition-colors"
                >
                  <ArrowLeft size={12} aria-hidden="true" />
                  {opts.moveLeft.label}
                </button>
              )}
              {opts?.moveRight && (
                <button
                  type="button"
                  onClick={() => moveTask(t, opts.moveRight!.status)}
                  aria-label={`Move to ${opts.moveRight.label}`}
                  className="inline-flex items-center gap-1 h-7 px-2 rounded-xs border border-border bg-surface-sunken text-[12px] text-ink-muted hover:text-ink hover:border-border-strong cursor-pointer transition-colors"
                >
                  {opts.moveRight.label}
                  <ArrowRight size={12} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>
        {!opts?.hideStamp && <StatusStamp status={stampFor(t, now)} fresh={justDone === t.id} className="mt-0.5 hidden sm:inline-flex" />}
        <div className="flex shrink-0">
          <button
            type="button"
            onClick={() => {
              setEditing(t)
              setFormOpen(true)
            }}
            className="p-1.5 text-ink-muted hover:text-ink cursor-pointer"
            aria-label={`Edit "${t.title}"`}
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={() => remove(t)}
            className="p-1.5 text-ink-muted hover:text-danger cursor-pointer"
            aria-label={`Delete "${t.title}"`}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </li>
    )
  }

  const overdueSection = (index: string) =>
    overdue.length > 0 && (
      <RecordCard>
        <SectionHeader
          index={index}
          title="Overdue"
          meta={`${overdue.length}`}
          action={
            <Button size="sm" variant="secondary" onClick={() => setPushMenuOpen((v) => !v)} aria-expanded={pushMenuOpen}>
              Push all…
            </Button>
          }
        />
        {pushMenuOpen && (
          <div className="px-4 sm:px-5 py-2.5 bg-surface-sunken border-b border-rule flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-ink-muted mr-1">Move all {overdue.length} overdue to:</span>
            <Button size="sm" variant="secondary" onClick={() => pushOverdue(addDays(today, 1), 'tomorrow')}>
              Tomorrow
            </Button>
            <Button size="sm" variant="secondary" onClick={() => pushOverdue(addDays(today, 3), 'in 3 days')}>
              In 3 days
            </Button>
            <Button size="sm" variant="secondary" onClick={() => pushOverdue(addDays(today, 7 - weekdayOf(today)), 'next Monday')}>
              Next Monday
            </Button>
          </div>
        )}
        <ul className="divide-y divide-rule">{overdue.map((t) => row(t))}</ul>
      </RecordCard>
    )

  const section = (index: string, title: string, items: LTask[], meta?: string) =>
    items.length > 0 && (
      <RecordCard>
        <SectionHeader index={index} title={title} meta={meta ?? `${items.length}`} />
        <ul className="divide-y divide-rule">{items.map((t) => row(t))}</ul>
      </RecordCard>
    )

  /* ---- Next 7 days data ---- */
  const weekDays = Array.from({ length: 7 }, (_, offset) => {
    const key = addDays(today, offset)
    const label =
      offset === 0
        ? 'Today'
        : offset === 1
          ? 'Tomorrow'
          : formatShortDate(`${key}T12:00:00+07:00`).replace(',', '')
    const items = open
      .filter((t) => !overdueIds.has(t.id) && t.due_at && todayKey(new Date(t.due_at)) === key)
      .sort(byDue)
    return { key, label, items }
  }).filter((g) => g.items.length > 0)
  const noDue = open.filter((t) => !t.due_at).sort(byDue)

  /* ---- By course data ---- */
  const courseGroups = db.courses
    .map((c) => ({ course: c, items: open.filter((t) => t.course_id === c.id).sort(byDue) }))
    .filter((g) => g.items.length > 0)
  const unlinkedOpen = open.filter((t) => t.course_id === null || !courses.has(t.course_id)).sort(byDue)

  /* ---- Board data ---- */
  const weekAgoMs = now.getTime() - 7 * 86_400_000
  const boardTodo = db.tasks.filter((t) => t.status === 'TODO').sort(byDue)
  const boardInProgress = db.tasks.filter((t) => t.status === 'IN_PROGRESS').sort(byDue)
  const boardDone = done.filter((t) => t.completed_at !== null && Date.parse(t.completed_at) >= weekAgoMs)
  const boardColumns: {
    id: TaskStatus
    index: string
    title: string
    meta?: string
    items: LTask[]
    moveLeft?: { status: TaskStatus; label: string }
    moveRight?: { status: TaskStatus; label: string }
  }[] = [
    {
      id: 'TODO',
      index: '01',
      title: 'To do',
      items: boardTodo,
      moveRight: { status: 'IN_PROGRESS', label: 'In progress' },
    },
    {
      id: 'IN_PROGRESS',
      index: '02',
      title: 'In progress',
      items: boardInProgress,
      moveLeft: { status: 'TODO', label: 'To do' },
      moveRight: { status: 'COMPLETED', label: 'Done' },
    },
    {
      id: 'COMPLETED',
      index: '03',
      title: 'Done',
      meta: 'Last 7 days',
      items: boardDone,
      moveLeft: { status: 'IN_PROGRESS', label: 'In progress' },
    },
  ]

  let weekIdx = 1
  const nextWeekIdx = () => String(weekIdx++).padStart(2, '0')
  let courseIdx = 1
  const nextCourseIdx = () => String(courseIdx++).padStart(2, '0')

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

      <QuickCapture />

      {db.tasks.length > 0 && (
        <div className="mb-4 lg:mb-5 flex flex-wrap gap-1.5" role="tablist" aria-label="Task view">
          {VIEWS.map((v) => {
            const active = view === v.id
            return (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => changeView(v.id)}
                className={`micro px-3 py-1.5 border rounded-xs cursor-pointer transition-colors ${
                  active
                    ? 'border-accent-strong bg-accent-wash text-accent-strong'
                    : 'border-rule bg-surface text-ink-muted hover:text-ink hover:border-border-strong'
                }`}
              >
                {v.label}
              </button>
            )
          })}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="mb-4 px-4 py-2.5 bg-surface border border-border-strong rounded-sm text-[13px] text-ink flex items-center justify-between gap-3"
        >
          <span>{notice.text}</span>
          <div className="flex items-center gap-3 shrink-0">
            {notice.undo && (
              <button
                type="button"
                onClick={notice.undo}
                className="text-[12.5px] font-medium text-accent-strong hover:underline cursor-pointer"
              >
                Undo
              </button>
            )}
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-[12px] text-ink-muted hover:text-ink cursor-pointer"
              aria-label="Dismiss notice"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {inboxItems.length > 0 && (
        <RecordCard className="mb-4 lg:mb-5">
          <SectionHeader
            title="Inbox"
            meta={`${inboxItems.length}`}
            action={
              <button
                type="button"
                onClick={() => setInboxOpen((v) => !v)}
                aria-expanded={inboxOpen}
                className="text-[13px] font-medium text-accent-strong hover:underline cursor-pointer"
              >
                {inboxOpen ? 'Hide' : `Show (${inboxItems.length})`}
              </button>
            }
          />
          {inboxOpen && (
            <ul className="divide-y divide-rule">
              {inboxItems.map((item) => {
                const course = item.course_id !== null ? courses.get(item.course_id) : undefined
                const link = extractUrl(item.text)
                return (
                  <li key={item.id} className="px-4 sm:px-5 py-3 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] text-ink leading-snug break-words">{item.text}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 tabular text-[12px] text-ink-muted">
                          {course && (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-[1px]" style={{ background: course.color }} aria-hidden="true" />
                              {course.code}
                            </span>
                          )}
                          {course && <span>·</span>}
                          <span>{timeAgo(item.created_at, now)}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteInboxItem(item)}
                        className="p-1.5 text-ink-muted hover:text-danger shrink-0 cursor-pointer"
                        aria-label="Delete note"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <select
                        value={course ? String(course.id) : ''}
                        onChange={(e) => setInboxCourse(item.id, e.target.value ? Number(e.target.value) : null)}
                        aria-label="Course for note"
                        className="h-7 max-w-[130px] px-1.5 bg-surface-sunken border border-border rounded-xs text-[12px] text-ink focus:outline-none focus:border-accent"
                      >
                        <option value="">No course</option>
                        {db.courses.map((c) => (
                          <option key={c.id} value={String(c.id)}>
                            {c.code}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => triageToTask(item)}
                        className="h-7 px-2 rounded-xs border border-border bg-surface-sunken text-[12px] font-medium text-ink-muted hover:text-ink hover:border-border-strong cursor-pointer transition-colors"
                      >
                        Task
                      </button>
                      <button
                        type="button"
                        disabled={!course}
                        title={!course ? 'Pick a course first' : `Add topic to ${course.code}`}
                        onClick={() => triageToTopic(item)}
                        className="h-7 px-2 rounded-xs border border-border bg-surface-sunken text-[12px] font-medium text-ink-muted hover:text-ink hover:border-border-strong disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        Topic
                      </button>
                      {link && (
                        <button
                          type="button"
                          onClick={() => triageToLink(item, link)}
                          className="h-7 px-2 rounded-xs border border-border bg-surface-sunken text-[12px] font-medium text-ink-muted hover:text-ink hover:border-border-strong cursor-pointer transition-colors"
                        >
                          Link
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </RecordCard>
      )}

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
      ) : view === 'list' ? (
        <div className="flex flex-col gap-4 lg:gap-5">
          {overdueSection('01')}
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
              <ul className="divide-y divide-rule">{(showAllDone ? done : done.slice(0, 5)).map((t) => row(t))}</ul>
            </RecordCard>
          )}
        </div>
      ) : view === 'week' ? (
        <div className="flex flex-col gap-4 lg:gap-5">
          {overdue.length > 0 && overdueSection(nextWeekIdx())}
          {weekDays.map((g) => (
            <RecordCard key={g.key}>
              <SectionHeader index={nextWeekIdx()} title={g.label} meta={`${g.items.length}`} />
              <ul className="divide-y divide-rule">{g.items.map((t) => row(t))}</ul>
            </RecordCard>
          ))}
          {overdue.length === 0 && weekDays.length === 0 && (
            <RecordCard>
              <EmptyState code="CLEAR WEEK" title="Nothing due in the next 7 days" body="Open tasks due this week will show up here." />
            </RecordCard>
          )}
          {noDue.length > 0 && (
            <RecordCard>
              <SectionHeader
                index={nextWeekIdx()}
                title="No due date"
                meta={`${noDue.length}`}
                action={
                  <button
                    type="button"
                    onClick={() => setShowNoDue((v) => !v)}
                    aria-expanded={showNoDue}
                    className="text-[13px] font-medium text-accent-strong hover:underline cursor-pointer"
                  >
                    {showNoDue ? 'Hide' : `Show (${noDue.length})`}
                  </button>
                }
              />
              {showNoDue && <ul className="divide-y divide-rule">{noDue.map((t) => row(t))}</ul>}
            </RecordCard>
          )}
        </div>
      ) : view === 'course' ? (
        open.length === 0 ? (
          <RecordCard>
            <EmptyState code="QUEUE CLEAR" title="No open tasks" body="Everything is done." />
          </RecordCard>
        ) : (
          <div className="flex flex-col gap-4 lg:gap-5">
            {courseGroups.map(({ course, items }) => (
              <RecordCard key={course.id} indicator={course.color}>
                <SectionHeader
                  index={nextCourseIdx()}
                  title={course.code}
                  meta={course.name}
                  action={<span className="tabular text-[12px] text-ink-muted">{items.length}</span>}
                />
                <div className="sm:hidden px-4 py-1.5 border-b border-rule text-[12.5px] text-ink-muted truncate">{course.name}</div>
                <ul className="divide-y divide-rule">{items.map((t) => row(t))}</ul>
              </RecordCard>
            ))}
            {unlinkedOpen.length > 0 && (
              <RecordCard>
                <SectionHeader
                  index={nextCourseIdx()}
                  title="No course"
                  action={<span className="tabular text-[12px] text-ink-muted">{unlinkedOpen.length}</span>}
                />
                <ul className="divide-y divide-rule">{unlinkedOpen.map((t) => row(t))}</ul>
              </RecordCard>
            )}
          </div>
        )
      ) : boardTodo.length + boardInProgress.length + boardDone.length === 0 ? (
        <RecordCard>
          <EmptyState code="BOARD CLEAR" title="No active tasks" body="Add a task or switch to List to see older completed tasks." />
        </RecordCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5 items-start">
          {boardColumns.map((col) => (
            <RecordCard key={col.id}>
              <SectionHeader
                index={col.index}
                title={col.title}
                meta={col.meta}
                action={<span className="tabular text-[12px] text-ink-muted">{col.items.length}</span>}
              />
              {col.items.length === 0 ? (
                <p className="px-4 sm:px-5 py-6 text-[13px] text-ink-muted text-center">No tasks here.</p>
              ) : (
                <ul className="divide-y divide-rule">
                  {col.items.map((t) =>
                    row(t, {
                      hideStamp: true,
                      moveLeft: col.moveLeft,
                      moveRight: col.moveRight,
                    }),
                  )}
                </ul>
              )}
            </RecordCard>
          ))}
        </div>
      )}

      <TaskFormModal open={formOpen} onClose={() => setFormOpen(false)} task={editing} />
    </>
  )
}
