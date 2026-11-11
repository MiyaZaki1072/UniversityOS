import { X } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { formatShortDate, formatTime, relativeDue } from '../../lib/format'
import type { Reminder } from '../../lib/reminders'

interface ReminderPanelProps {
  reminders: Reminder[]
  courses: Map<number, { code: string; color: string }>
  onClose: () => void
}

const KIND_LABEL: Record<Reminder['kind'], string> = {
  class: 'Class',
  exam: 'Exam',
  deadline: 'Deadline',
}

export function ReminderPanel({ reminders, courses, onClose }: ReminderPanelProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div role="dialog" aria-label="Reminders" className="w-[min(92vw,360px)] bg-surface border border-border-strong shadow-overlay rounded-sm">
      <div className="flex items-center justify-between px-4 h-11 border-b border-rule">
        <h2 className="font-display text-[14px] font-semibold tracking-[0.08em] text-ink">Reminders</h2>
        <button onClick={onClose} aria-label="Close reminders" className="h-8 w-8 grid place-items-center rounded-xs text-ink-muted hover:text-ink hover:bg-surface-2">
          <X size={16} />
        </button>
      </div>

      {reminders.length === 0 ? (
        <p className="px-4 py-6 text-[13px] text-ink-muted">Nothing coming up in the next hours.</p>
      ) : (
        <ul className="max-h-[60vh] overflow-y-auto divide-y divide-rule">
          {reminders.map((r) => {
            const course = r.courseId !== null ? courses.get(r.courseId) : undefined
            const when =
              r.kind === 'deadline'
                ? `Due ${formatShortDate(r.at)} · ${formatTime(r.at)} · ${relativeDue(r.at)}`
                : `${formatShortDate(r.at)} · ${formatTime(r.at)}`
            return (
              <li key={r.id} className="px-4 py-3 flex flex-col gap-1">
                <div className="flex items-center gap-2 micro">
                  <span className="text-accent-strong">{KIND_LABEL[r.kind]}</span>
                  {course && (
                    <span className="inline-flex items-center gap-1.5 tabular text-ink-muted">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: course.color }} aria-hidden="true" />
                      {course.code}
                    </span>
                  )}
                </div>
                <div className="text-[14px] text-ink break-words">{r.title}</div>
                <div className="tabular text-[12px] text-ink-muted">{when}</div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="px-4 py-3 border-t border-rule">
        <Link to="/settings" onClick={onClose} className="micro text-accent-strong hover:text-ink">
          Reminder settings
        </Link>
      </div>
    </div>
  )
}
