/** Reminders: derived from planner data, shown in the bell and as browser notifications. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatTime } from './format'
import { addDays, occurrencesBetween, todayKey, type LocalDB } from './localDb'

export interface Reminder {
  id: string
  occurrenceId: string
  kind: 'class' | 'exam' | 'deadline'
  title: string
  courseId: number | null
  /** When the thing starts or is due (ISO). */
  at: string
  /** When the reminder becomes due (ISO). */
  remindAt: string
  location?: string | null
}

const FIRED_KEY = 'university-os:reminded'
const SEEN_KEY = 'university-os:reminders-seen'
const KEEP = 200
const TICK_MS = 30_000

export function upcomingReminders(db: LocalDB, now: Date): Reminder[] {
  const s = db.settings.reminders
  const from = todayKey(now)
  // Look far enough ahead for the longest lead time (at least 1 day).
  const maxLeadHours = Math.max(s.class_minutes_before / 60, s.exam_hours_before, s.deadline_hours_before, 0)
  const occs = occurrencesBetween(db, from, addDays(from, Math.ceil(maxLeadHours / 24) + 1))
  const out: Reminder[] = []
  for (const o of occs) {
    let kind: Reminder['kind']
    let leadMs: number
    if (o.source_type === 'class_meeting') {
      kind = 'class'
      leadMs = s.class_minutes_before * 60_000
    } else if (o.source_type === 'calendar_event') {
      kind = 'exam'
      leadMs = s.exam_hours_before * 3_600_000
    } else {
      kind = 'deadline'
      leadMs = s.deadline_hours_before * 3_600_000
    }
    if (!(leadMs > 0)) continue
    const atMs = Date.parse(o.start_at)
    const remindMs = atMs - leadMs
    if (!(remindMs <= now.getTime() && now.getTime() < atMs)) continue
    const remindAt = new Date(remindMs).toISOString()
    out.push({
      // Stable per occurrence and time, so changing a lead time doesn't notify again.
      id: `${o.id}@${o.start_at}`,
      occurrenceId: o.id,
      kind,
      title: o.title,
      courseId: o.course_id,
      at: o.start_at,
      remindAt,
      location: o.location,
    })
  }
  return out.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
}

function readIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function writeIds(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids.slice(-KEEP)))
  } catch {
    /* storage blocked: reminders still show in the bell */
  }
}

function bodyFor(r: Reminder, now: Date): string {
  if (r.kind === 'class') {
    return `Class starts at ${formatTime(r.at)}${r.location ? ` · ${r.location}` : ''}`
  }
  if (r.kind === 'exam') {
    const hours = Math.max(1, Math.round((Date.parse(r.at) - now.getTime()) / 3_600_000))
    return `Exam in ${hours} h`
  }
  return `Due ${formatTime(r.at)}`
}

function currentPermission(): NotificationPermission | 'unsupported' {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

export function useReminders(db: LocalDB) {
  const [now, setNow] = useState(() => new Date())
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(currentPermission)
  const [seen, setSeen] = useState<string[]>(() => readIds(SEEN_KEY))

  useEffect(() => {
    const tick = () => setNow(new Date())
    const timer = window.setInterval(tick, TICK_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        tick()
        setPermission(currentPermission())
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const enabled = db.settings.reminders.enabled
  // The bell list always works; `enabled` only controls browser notifications.
  const due = useMemo(() => upcomingReminders(db, now), [db, now])

  useEffect(() => {
    if (!enabled || permission !== 'granted' || due.length === 0) return
    const fired = readIds(FIRED_KEY)
    const fresh = due.filter((r) => !fired.includes(r.id))
    if (fresh.length === 0) return
    const shown: string[] = []
    for (const r of fresh) {
      try {
        new Notification(r.title, { body: bodyFor(r, now), tag: r.id })
        shown.push(r.id)
      } catch {
        /* some mobile browsers only allow notifications from a service worker */
      }
    }
    if (shown.length) writeIds(FIRED_KEY, [...fired, ...shown])
  }, [due, enabled, permission, now])

  const unseen = useMemo(() => due.filter((r) => !seen.includes(r.id)).length, [due, seen])

  const markAllSeen = useCallback(() => {
    setSeen((prev) => {
      const next = [...prev, ...due.map((r) => r.id).filter((id) => !prev.includes(id))]
      if (next.length === prev.length) return prev
      writeIds(SEEN_KEY, next)
      return next.slice(-KEEP)
    })
  }, [due])

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return
    try {
      await Notification.requestPermission()
    } catch {
      /* ignore */
    }
    setPermission(currentPermission())
  }, [])

  return { due, unseen, markAllSeen, permission, requestPermission }
}
