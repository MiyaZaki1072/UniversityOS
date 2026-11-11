import { CalendarPlus, Copy, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api'
import { Button } from '../ui/Button'
import { RecordCard, SectionHeader } from '../ui/Panels'

/** Private subscription link for Google / Apple / Outlook calendar (server mode only). */
export function CalendarFeedCard() {
  const [path, setPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    apiFetch<{ path: string | null }>('/planner/calendar-feed/')
      .then((r) => setPath(r.path))
      .catch(() => setMsg({ ok: false, text: "Couldn't load the calendar link." }))
      .finally(() => setLoading(false))
  }, [])

  const url = path ? `${window.location.origin}${path}` : null
  const webcal = url ? url.replace(/^https?:/, 'webcal:') : null

  const run = async (method: 'POST' | 'DELETE', done: string) => {
    if (method === 'DELETE' && !window.confirm('Turn off the calendar link? Calendars subscribed to it stop updating.')) return
    if (method === 'POST' && path && !window.confirm('Make a new link? The old link stops working everywhere it is subscribed.')) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await apiFetch<{ path: string | null } | undefined>('/planner/calendar-feed/', { method })
      setPath(r?.path ?? null)
      setMsg({ ok: true, text: done })
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setMsg({ ok: true, text: 'Link copied.' })
    } catch {
      setMsg({ ok: false, text: 'Copy failed; select the link and copy it.' })
    }
  }

  return (
    <RecordCard className="lg:col-span-2">
      <SectionHeader index="05" title="Calendar subscription" />
      <div className="p-4 sm:p-5 flex flex-col gap-4">
        <p className="text-[13.5px] text-ink-muted leading-relaxed">
          Show your classes, exams and deadlines in Google Calendar, Apple Calendar or Outlook. They refresh the link every
          few hours. <span className="text-ink">Anyone with the link can see your schedule</span>, so keep it private; make
          a new link if it leaks.
        </p>
        {loading ? (
          <p className="text-[13px] text-ink-faint" aria-busy="true">
            Loading…
          </p>
        ) : url ? (
          <>
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="h-10 px-3 w-full min-w-0 bg-surface-sunken border border-border-strong rounded-xs tabular text-[12.5px] text-ink"
              aria-label="Calendar link"
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" icon={<Copy size={16} />} onClick={() => void copy()}>
                Copy link
              </Button>
              {webcal && (
                <a href={webcal}>
                  <Button variant="secondary" icon={<CalendarPlus size={16} />}>
                    Open in calendar app
                  </Button>
                </a>
              )}
              <Button variant="secondary" icon={<RefreshCw size={16} />} disabled={busy} onClick={() => void run('POST', 'New link made. Re-subscribe with it.')}>
                New link
              </Button>
              <Button variant="ghost" icon={<Trash2 size={16} />} disabled={busy} onClick={() => void run('DELETE', 'Calendar link turned off.')}>
                Turn off
              </Button>
            </div>
            <p className="text-[12.5px] text-ink-muted">
              Google Calendar: Other calendars → + → From URL → paste the link. iPhone: tap “Open in calendar app”.
            </p>
          </>
        ) : (
          <div>
            <Button variant="primary" icon={<CalendarPlus size={16} />} disabled={busy} onClick={() => void run('POST', 'Calendar link created.')}>
              Create calendar link
            </Button>
          </div>
        )}
        {msg && <p className={`text-[13px] ${msg.ok ? 'text-sage-ink' : 'text-danger'}`}>{msg.text}</p>}
      </div>
    </RecordCard>
  )
}
