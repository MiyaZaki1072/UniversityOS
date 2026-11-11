import { ArrowRight, CornerDownLeft, ExternalLink, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { formatShortDate } from '../../lib/format'
import { useAppData } from '../../lib/store'
import { allNavItems } from '../layout/nav'

const MAX_PER_GROUP = 8
const LIST_ID = 'command-palette-list'

type GroupName = 'Pages' | 'Courses' | 'Tasks' | 'Links' | 'Habits'

interface Entry {
  key: string
  group: GroupName
  label: string
  /** Secondary text shown after the label. */
  detail?: string
  /** Mono text on the right (code, due date). */
  meta?: string
  /** Everything the query is matched against. */
  haystack: string
  icon?: ComponentType<{ size?: number; className?: string }>
  /** Course color from data, shown as a small swatch. */
  swatch?: string
  external?: boolean
  run: (go: (path: string) => void) => void
}

function terms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean)
}

/** null = no match; lower is better. */
function score(entry: Entry, ts: string[]): number | null {
  const hay = entry.haystack.toLowerCase()
  if (!ts.every((t) => hay.includes(t))) return null
  const label = entry.label.toLowerCase()
  if (label.startsWith(ts[0])) return 0
  if (label.split(/[\s\-_/]+/).some((w) => w.startsWith(ts[0]))) return 1
  if (label.includes(ts[0])) return 2
  return 3
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function isWebUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim())
}

function shortDue(iso: string | null): string | undefined {
  return iso ? formatShortDate(iso) : undefined
}

function PaletteInner({ onClose }: { onClose: () => void }) {
  const { db } = useAppData()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Focus the input, lock scroll, restore focus on close.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    inputRef.current?.focus()
    return () => {
      document.body.style.overflow = prevOverflow
      prev?.focus?.()
    }
  }, [])

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = []
    const courseCode = new Map(db.courses.map((c) => [c.id, c.code]))

    for (const n of allNavItems) {
      out.push({
        key: `page:${n.path}`,
        group: 'Pages',
        label: n.label,
        detail: n.title,
        haystack: `${n.label} ${n.title} ${n.path}`,
        icon: n.icon,
        run: (go) => go(n.path),
      })
    }
    out.push({
      key: 'page:/semesters',
      group: 'Pages',
      label: 'Transcript',
      detail: 'Past semesters',
      haystack: `Transcript past semesters archive ${db.pastSemesters.map((s) => s.name).join(' ')}`,
      icon: ArrowRight,
      run: (go) => go('/semesters'),
    })

    for (const c of db.courses) {
      out.push({
        key: `course:${c.id}`,
        group: 'Courses',
        label: c.code,
        detail: c.name,
        haystack: `${c.code} ${c.name} ${c.instructor}`,
        swatch: c.color,
        run: (go) => go(`/courses/${c.id}`),
      })
      out.push({
        key: `ledger:${c.id}`,
        group: 'Courses',
        label: `Ledger ${c.code}`,
        detail: c.name,
        meta: 'Ledger',
        haystack: `ledger gradebook grades ${c.code} ${c.name}`,
        swatch: c.color,
        run: (go) => go(`/gradebook/${c.id}`),
      })
    }

    for (const t of db.tasks) {
      const code = t.course_id !== null ? courseCode.get(t.course_id) : undefined
      out.push({
        key: `task:${t.id}`,
        group: 'Tasks',
        label: t.title,
        detail: code,
        meta: shortDue(t.due_at),
        haystack: `${t.title} ${code ?? ''} ${t.notes}`,
        run: (go) => go('/tasks'),
      })
    }

    for (const l of db.links) {
      if (!isWebUrl(l.url)) continue
      out.push({
        key: `link:${l.id}`,
        group: 'Links',
        label: l.title,
        detail: hostOf(l.url.trim()),
        haystack: `${l.title} ${l.url} ${l.description} ${l.category}`,
        icon: ExternalLink,
        external: true,
        run: () => {
          window.open(l.url.trim(), '_blank', 'noopener,noreferrer')
        },
      })
    }

    for (const h of db.habits) {
      if (h.archived) continue
      out.push({
        key: `habit:${h.id}`,
        group: 'Habits',
        label: h.name,
        haystack: h.name,
        run: (go) => go('/habits'),
      })
    }
    return out
  }, [db])

  const results = useMemo<Entry[]>(() => {
    const ts = terms(query)
    const order: GroupName[] = ['Pages', 'Courses', 'Tasks', 'Links', 'Habits']

    if (ts.length === 0) {
      const pages = entries.filter((e) => e.group === 'Pages').slice(0, MAX_PER_GROUP)
      const soonest = db.tasks
        .filter((t) => t.status !== 'COMPLETED' && t.due_at)
        .sort((a, b) => new Date(a.due_at as string).getTime() - new Date(b.due_at as string).getTime())
        .slice(0, 5)
      const taskEntries = soonest
        .map((t) => entries.find((e) => e.key === `task:${t.id}`))
        .filter((e): e is Entry => Boolean(e))
      return [...pages, ...taskEntries]
    }

    const out: Entry[] = []
    for (const g of order) {
      const scored: { e: Entry; s: number }[] = []
      for (const e of entries) {
        if (e.group !== g) continue
        const s = score(e, ts)
        if (s !== null) scored.push({ e, s })
      }
      scored.sort((a, b) => a.s - b.s) // stable: keeps source order within a rank
      out.push(...scored.slice(0, MAX_PER_GROUP).map((x) => x.e))
    }
    return out
  }, [entries, query, db.tasks])

  const current = results.length === 0 ? -1 : Math.min(active, results.length - 1)

  useEffect(() => {
    if (current < 0) return
    listRef.current?.querySelector(`[data-index="${current}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [current])

  const activate = (e: Entry | undefined) => {
    if (!e) return
    e.run((path) => navigate(path))
    onClose()
  }

  const onKeyDown = (ev: React.KeyboardEvent) => {
    if (ev.key === 'Escape') {
      ev.preventDefault()
      onClose()
    } else if (ev.key === 'ArrowDown') {
      ev.preventDefault()
      if (results.length) setActive((current + 1) % results.length)
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault()
      if (results.length) setActive((current - 1 + results.length) % results.length)
    } else if (ev.key === 'Enter') {
      ev.preventDefault()
      activate(results[current])
    }
  }

  // Build rows with group headings; option indices run across all groups.
  const rows: React.ReactNode[] = []
  let lastGroup: GroupName | null = null
  results.forEach((e, i) => {
    if (e.group !== lastGroup) {
      lastGroup = e.group
      const heading =
        query.trim() === '' && e.group === 'Tasks' ? 'Tasks due soon' : e.group
      rows.push(
        <div key={`h:${e.group}`} role="presentation" className="micro text-ink-faint px-4 pt-3 pb-1">
          {heading}
        </div>,
      )
    }
    const selected = i === current
    const Icon = e.icon
    rows.push(
      <div
        key={e.key}
        id={`cp-opt-${i}`}
        data-index={i}
        role="option"
        aria-selected={selected}
        onMouseMove={() => i !== active && setActive(i)}
        onClick={() => activate(e)}
        className={`flex items-center gap-3 px-4 py-2 cursor-pointer border-l-2 ${
          selected ? 'bg-surface-2 border-accent-strong text-ink' : 'border-transparent text-ink-muted'
        }`}
      >
        {e.swatch ? (
          <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: e.swatch }} aria-hidden="true" />
        ) : Icon ? (
          <Icon size={16} className="shrink-0 text-ink-faint" />
        ) : (
          <span className="size-2.5 shrink-0 rounded-sm border border-border-strong" aria-hidden="true" />
        )}
        <span className={`min-w-0 truncate ${e.group === 'Courses' || e.group === 'Tasks' ? '' : 'font-display'} text-ink`}>
          {e.label}
        </span>
        {e.detail && <span className="min-w-0 flex-1 truncate text-sm text-ink-faint">{e.detail}</span>}
        {!e.detail && <span className="flex-1" />}
        {e.meta && <span className="tabular text-xs text-ink-faint shrink-0">{e.meta}</span>}
        {selected && <CornerDownLeft size={14} className="shrink-0 text-accent-strong" aria-hidden="true" />}
      </div>,
    )
  })

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-scrim" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick search"
        onKeyDown={onKeyDown}
        className="relative mt-[10vh] w-[min(94vw,560px)] max-h-[80dvh] flex flex-col bg-surface border border-border-strong rounded-sm shadow-overlay animate-page-in"
      >
        <div className="flex items-center gap-3 px-4 h-12 shrink-0 border-b-2 border-border-strong">
          <Search size={18} className="shrink-0 text-ink-faint" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls={LIST_ID}
            aria-activedescendant={current >= 0 ? `cp-opt-${current}` : undefined}
            aria-autocomplete="list"
            aria-label="Search pages, courses, tasks, links and habits"
            placeholder="Search pages, courses, tasks…"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <span className="micro text-ink-faint hidden sm:inline">Esc</span>
        </div>

        <div ref={listRef} id={LIST_ID} role="listbox" aria-label="Results" className="overflow-y-auto min-h-0 py-1">
          {results.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-muted" role="presentation">
              Nothing matches “{query.trim()}”.
            </p>
          ) : (
            rows
          )}
        </div>

        <div className="hidden sm:flex items-center px-4 py-2 shrink-0 border-t border-rule bg-surface-sunken text-xs text-ink-faint">
          ↑↓ to move · Enter to open · Esc to close
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Quick search over pages, courses, tasks, links and habits. Reads the planner, never writes. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  // Mounted only while open, so the query and selection reset each time.
  return <PaletteInner onClose={onClose} />
}

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/** Ctrl+K / Cmd+K anywhere, or "/" when no field has focus. */
export function useCommandPaletteHotkey(onOpen: () => void) {
  const ref = useRef(onOpen)
  useEffect(() => {
    ref.current = onOpen
  })
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isK = (e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k'
      const isSlash = e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !isEditable(e.target)
      if (!isK && !isSlash) return
      e.preventDefault()
      ref.current()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])
}
