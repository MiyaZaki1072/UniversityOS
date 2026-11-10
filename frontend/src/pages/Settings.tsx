import { Download, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Button } from '../components/ui/Button'
import { FormField } from '../components/ui/FormField'
import { PageHeader, RecordCard, SectionHeader } from '../components/ui/Panels'
import { emptyDb, isLocalDb, todayKey } from '../lib/localDb'
import { useAppData } from '../lib/store'

export function SettingsPage() {
  const { db, mutate, replaceDb, saveFailed } = useAppData()
  const [sem, setSem] = useState({ name: '', start: '', end: '' })
  const [semMsg, setSemMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [backupMsg, setBackupMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSem({ name: db.semester?.name ?? '', start: db.semester?.start_date ?? '', end: db.semester?.end_date ?? '' })
  }, [db.semester])

  const saveSemester = (e: FormEvent) => {
    e.preventDefault()
    if (!sem.name.trim() || !sem.start || !sem.end) return setSemMsg({ ok: false, text: 'Fill in the name and both dates.' })
    if (sem.end < sem.start) return setSemMsg({ ok: false, text: 'The end date must be on or after the start date.' })
    mutate((d) => {
      d.semester = { name: sem.name.trim(), start_date: sem.start, end_date: sem.end }
    })
    setSemMsg({ ok: true, text: 'Saved. Weekly classes now run between these dates.' })
  }

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `university-os-backup-${todayKey()}.json`
    a.click()
    URL.revokeObjectURL(url)
    setBackupMsg({ ok: true, text: 'Backup downloaded.' })
  }

  const importBackup = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!isLocalDb(parsed)) throw new Error('This is not a University OS backup file.')
      if (!window.confirm(`Replace everything on this device with the backup (${parsed.courses.length} courses, ${parsed.tasks.length} tasks)?`)) return
      replaceDb(parsed)
      setBackupMsg({ ok: true, text: 'Backup restored.' })
    } catch (err) {
      setBackupMsg({ ok: false, text: (err as Error).message })
    }
  }

  const reset = () => {
    if (!window.confirm('Delete all courses, grades and tasks on this device? Download a backup first if you might need them.')) return
    replaceDb(emptyDb())
  }

  const msg = (m: { ok: boolean; text: string } | null) =>
    m && <p className={`text-[13px] ${m.ok ? 'text-sage-ink' : 'text-danger'}`}>{m.text}</p>

  return (
    <>
      <PageHeader division="Division 00 · System" title="System Settings" />

      {saveFailed && (
        <div role="alert" className="mb-4 p-4 border-[1.5px] border-danger bg-danger-wash rounded-xs text-sm text-ink">
          This browser is blocking storage (private mode?). Changes will be lost when the page closes.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
        <RecordCard>
          <SectionHeader index="01" title="Current semester" />
          <form onSubmit={saveSemester} className="p-4 sm:p-5 grid gap-4">
            <FormField label="Name" placeholder="Semester 1 / 2026" value={sem.name} onChange={(e) => setSem({ ...sem, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Starts" type="date" mono value={sem.start} onChange={(e) => setSem({ ...sem, start: e.target.value })} />
              <FormField label="Ends" type="date" mono value={sem.end} onChange={(e) => setSem({ ...sem, end: e.target.value })} />
            </div>
            {msg(semMsg)}
            <div>
              <Button type="submit" variant="primary">
                Save semester
              </Button>
            </div>
          </form>
        </RecordCard>

        <RecordCard>
          <SectionHeader index="02" title="Backup & devices" />
          <div className="p-4 sm:p-5 flex flex-col gap-4">
            <p className="text-[13.5px] text-ink-muted leading-relaxed">
              Your data is saved in this browser only. To move it to your phone (or keep a copy), download a backup here and
              restore it on the other device. Restoring replaces what is on that device.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" icon={<Download size={16} />} onClick={exportBackup}>
                Download backup
              </Button>
              <Button variant="secondary" icon={<Upload size={16} />} onClick={() => fileRef.current?.click()}>
                Restore backup
              </Button>
              <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={importBackup} />
            </div>
            {msg(backupMsg)}
            <p className="tabular text-[12px] text-ink-faint">
              On this device: {db.courses.length} courses · {db.tasks.length} tasks
            </p>
          </div>
        </RecordCard>

        <RecordCard className="lg:col-span-2">
          <SectionHeader index="03" title="Danger zone" />
          <div className="p-4 sm:p-5 flex flex-wrap items-center gap-4">
            <p className="text-[13.5px] text-ink-muted flex-1 min-w-[220px]">Erase every course, grade and task stored on this device.</p>
            <Button variant="secondary" icon={<Trash2 size={16} />} onClick={reset} className="!text-danger !border-danger">
              Erase all data
            </Button>
          </div>
        </RecordCard>
      </div>
    </>
  )
}
