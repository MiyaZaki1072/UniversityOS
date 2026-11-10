/** Formatting helpers. All display uses the user's profile timezone. */

export const USER_TZ = 'Asia/Bangkok'

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: USER_TZ,
})

export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso))
}

export function formatLongDate(isoDate: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: USER_TZ,
  })
    .format(new Date(`${isoDate}T12:00:00+07:00`))
    .replace(',', '')
}

export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    timeZone: USER_TZ,
  }).format(new Date(iso))
}

/** "2h 05m" / "45m" */
export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}m`
  return `${h}h ${String(m).padStart(2, '0')}m`
}

/** Round a decimal string for display only (backend keeps full precision). */
export function formatPercent(value: string | null, digits = 2): string {
  if (value === null) return '—'
  return Number(value).toFixed(digits)
}

/** Whole calendar days between two instants, measured in the user's timezone. */
export function daysUntil(targetIso: string, from: Date = new Date()): number {
  const dayKey = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: USER_TZ }).format(d)
  const a = new Date(`${dayKey(from)}T00:00:00Z`).getTime()
  const b = new Date(`${dayKey(new Date(targetIso))}T00:00:00Z`).getTime()
  return Math.round((b - a) / 86_400_000)
}

export function relativeDue(targetIso: string, from: Date = new Date()): string {
  const d = daysUntil(targetIso, from)
  if (d < 0) return `${Math.abs(d)}d overdue`
  if (d === 0) return 'Today'
  if (d === 1) return 'Tomorrow'
  return `In ${d} days`
}
