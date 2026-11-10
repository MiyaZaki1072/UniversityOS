import { useEffect, useState, type FormEvent } from 'react'
import { fromLocalInput, toLocalInput, type LTask, type TaskPriority, type TaskStatus } from '../../lib/localDb'
import { useAppData } from '../../lib/store'
import { Button } from '../ui/Button'
import { FormField } from '../ui/FormField'
import { Modal } from '../ui/Overlay'
import { SelectField, TextAreaField } from '../ui/SelectField'

interface TaskFormProps {
  open: boolean
  onClose: () => void
  /** Edit this task; omit to create a new one. */
  task?: LTask | null
  /** Pre-select a course for new tasks. */
  courseId?: number | null
}

const blank = { title: '', course: '', due: '', priority: 'MEDIUM' as TaskPriority, status: 'TODO' as TaskStatus, notes: '' }

/** Create or edit a task in the local database. */
export function TaskFormModal({ open, onClose, task, courseId }: TaskFormProps) {
  const { db, mutate } = useAppData()
  const [f, setF] = useState(blank)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setF(
      task
        ? {
            title: task.title,
            course: task.course_id === null ? '' : String(task.course_id),
            due: toLocalInput(task.due_at),
            priority: task.priority,
            status: task.status,
            notes: task.notes,
          }
        : { ...blank, course: courseId ? String(courseId) : '' },
    )
  }, [open, task, courseId])

  const save = (e?: FormEvent) => {
    e?.preventDefault()
    if (!f.title.trim()) return setError('Give the task a title.')
    mutate((d, nid) => {
      const values = {
        title: f.title.trim(),
        course_id: f.course ? Number(f.course) : null,
        due_at: fromLocalInput(f.due),
        priority: f.priority,
        status: f.status,
        notes: f.notes.trim(),
      }
      if (task) {
        const t = d.tasks.find((x) => x.id === task.id)
        if (t) {
          const completedNow = values.status === 'COMPLETED' && t.status !== 'COMPLETED'
          Object.assign(t, values, {
            completed_at: values.status === 'COMPLETED' ? (completedNow ? new Date().toISOString() : t.completed_at) : null,
          })
        }
      } else {
        d.tasks.push({
          id: nid(),
          ...values,
          completed_at: values.status === 'COMPLETED' ? new Date().toISOString() : null,
        })
      }
    })
    onClose()
  }

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      label="FORM T-1"
      title={task ? 'Edit task' : 'New task'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => save()}>
            {task ? 'Save' : 'File task'}
          </Button>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={save}>
        <FormField
          label="Title"
          placeholder="e.g. Problem Set 5"
          autoFocus
          value={f.title}
          onChange={(e) => set('title', e.target.value)}
          error={error ?? undefined}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField
            label="Course"
            value={f.course}
            onChange={(e) => set('course', e.target.value)}
            options={[{ value: '', label: 'No course' }, ...db.courses.map((c) => ({ value: String(c.id), label: `${c.code} · ${c.name}` }))]}
          />
          <FormField label="Due" type="datetime-local" mono value={f.due} onChange={(e) => set('due', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Priority"
            value={f.priority}
            onChange={(e) => set('priority', e.target.value as TaskPriority)}
            options={[
              { value: 'LOW', label: 'Low' },
              { value: 'MEDIUM', label: 'Medium' },
              { value: 'HIGH', label: 'High' },
            ]}
          />
          <SelectField
            label="Status"
            value={f.status}
            onChange={(e) => set('status', e.target.value as TaskStatus)}
            options={[
              { value: 'TODO', label: 'To do' },
              { value: 'IN_PROGRESS', label: 'In progress' },
              { value: 'COMPLETED', label: 'Completed' },
            ]}
          />
        </div>
        <TextAreaField label="Notes" value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optional" />
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}
