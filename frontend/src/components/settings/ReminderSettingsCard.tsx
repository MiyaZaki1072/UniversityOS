import { RecordCard, SectionHeader } from '../ui/Panels'
import { FormField } from '../ui/FormField'
import { useReminders } from '../../lib/reminders'
import { useAppData } from '../../lib/store'
import type { LReminderSettings } from '../../lib/localDb'

type NumKey = 'class_minutes_before' | 'exam_hours_before' | 'deadline_hours_before'

const clamp = (raw: string, max: number) => {
  const n = Math.floor(Number(raw))
  return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0
}

export function ReminderSettingsCard() {
  const { db, mutate } = useAppData()
  const { permission, requestPermission } = useReminders(db)
  const s: LReminderSettings = db.settings.reminders

  const permissionText = {
    granted: 'Allowed',
    denied: 'Blocked in browser settings — allow notifications for this site',
    default: 'Not asked yet. Turn reminders on to allow notifications.',
    unsupported: 'Not supported on this browser; reminders show in the bell only',
  }[permission]

  const toggle = (on: boolean) => {
    mutate((d) => {
      d.settings.reminders.enabled = on
    })
    if (on && permission === 'default') void requestPermission()
  }

  const setNum = (key: NumKey, value: number) =>
    mutate((d) => {
      d.settings.reminders[key] = value
    })

  return (
    <RecordCard>
      <SectionHeader index="04" title="Reminders" />
      <div className="p-4 sm:p-5 flex flex-col gap-4">
        <label className="flex items-center gap-3 text-ink cursor-pointer">
          <input type="checkbox" checked={s.enabled} onChange={(e) => toggle(e.target.checked)} className="h-4 w-4 accent-accent" />
          <span>Notify me</span>
        </label>
        <p className={`text-[13px] ${permission === 'granted' ? 'text-sage-ink' : permission === 'denied' ? 'text-danger' : 'text-ink-muted'}`}>{permissionText}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label="Class, minutes before" type="number" mono min={0} max={120} value={s.class_minutes_before} onChange={(e) => setNum('class_minutes_before', clamp(e.target.value, 120))} />
          <FormField label="Exam, hours before" type="number" mono min={0} max={168} value={s.exam_hours_before} onChange={(e) => setNum('exam_hours_before', clamp(e.target.value, 168))} />
          <FormField label="Deadline, hours before" type="number" mono min={0} max={168} value={s.deadline_hours_before} onChange={(e) => setNum('deadline_hours_before', clamp(e.target.value, 168))} />
        </div>
        <p className="text-[12px] text-ink-faint">0 turns that kind off. Notifications only fire while the app is open in a tab or on the home screen.</p>
      </div>
    </RecordCard>
  )
}
