import { ChevronDown, ChevronRight, Flag, RotateCcw, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '../components/ui/Button'
import { FormField } from '../components/ui/FormField'
import { Modal } from '../components/ui/Overlay'
import { EmptyState, PageHeader, RecordCard, SectionHeader, StatCard } from '../components/ui/Panels'
import {
  archiveCurrentSemester,
  courseGrade,
  DEFAULT_SCALE,
  expectedGpaOf,
  gpaOf,
  isSU,
  requiredSemesterGpa,
  whatIfGpa,
  type LArchivedSemester,
  type LCourse,
} from '../lib/localDb'
import { useAppData } from '../lib/store'

const fmtGpa = (g: number | null) => (g === null ? '—' : g.toFixed(2))

function nearestDefaultLetter(point: number): string | null {
  const asc = [...DEFAULT_SCALE]
    .filter((b) => b.grade_point !== '' && Number.isFinite(Number(b.grade_point)))
    .sort((a, b) => Number(a.grade_point) - Number(b.grade_point))
  return asc.find((b) => Number(b.grade_point) >= point - 1e-9)?.grade_label ?? null
}

function formatDelta(simVal: number | null, realVal: number | null): { text: string; tone: string } | null {
  if (simVal === null || realVal === null) return null
  const diff = Math.round((simVal - realVal) * 100) / 100
  if (diff === 0) return null
  return {
    text: `${diff > 0 ? '+' : ''}${diff.toFixed(2)}`,
    tone: diff > 0 ? 'text-sage-ink' : 'text-danger',
  }
}

/** Courses of one semester with an editable official grade each. */
function CourseRows({ courses, onGrade }: { courses: LCourse[]; onGrade: (courseId: number, value: string | null) => void }) {
  if (courses.length === 0) return <p className="px-4 sm:px-5 py-4 text-sm text-ink-muted">No courses in this semester.</p>
  return (
    <ul className="divide-y divide-rule">
      {courses.map((c) => {
        const g = courseGrade(c)
        const bands = c.scale.length ? c.scale : DEFAULT_SCALE
        const labels = bands.map((b) => b.grade_label)
        const current = c.official_grade?.trim() || ''
        // Keep a stored grade selectable even if it is no longer on the scale.
        const options = current && !labels.includes(current) ? [current, ...labels] : labels
        return (
          <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-5 py-3">
            <span className="w-[3px] h-8 rounded-[1px] shrink-0" style={{ background: c.color }} aria-hidden="true" />
            <div className="min-w-0 flex-1 basis-40">
              <div className="tabular text-[12px] text-ink-muted">{c.code}</div>
              <div className="font-medium text-ink truncate">{c.name}</div>
            </div>
            <div className="tabular text-[12px] text-ink-muted shrink-0">{c.credits} cr</div>
            <div className="shrink-0 min-w-16">
              <div className="tabular text-ink">
                {g.letter ?? '—'}
                {g.point !== null && <span className="text-ink-muted text-[12px]"> · {g.point.toFixed(2)}</span>}
              </div>
              <div className="micro text-ink-faint">{g.su ? `S/U · not in GPA${g.source ? ` · ${g.source}` : ''}` : g.source ?? 'no grade'}</div>
              {g.point === 0 && g.letter && g.letter.trim().toUpperCase() !== 'F' && (
                <div className="text-[11.5px] text-danger">{g.letter} is worth 0 points on this course&apos;s scale. Fix it in the Gradebook.</div>
              )}
            </div>
            <label className="flex items-center gap-2 shrink-0">
              <span className="micro">Official grade</span>
              <select
                value={current}
                onChange={(e) => onGrade(c.id, e.target.value || null)}
                className="h-9 px-2 bg-surface border border-border rounded-xs text-ink tabular focus:outline-none focus:border-accent"
              >
                <option value="">—</option>
                {options.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </li>
        )
      })}
    </ul>
  )
}

function PastSemester({
  sem,
  onGrade,
  onDelete,
}: {
  sem: LArchivedSemester
  onGrade: (courseId: number, value: string | null) => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const { gpa, credits } = gpaOf(sem.courses)
  const range = sem.start_date || sem.end_date ? `${sem.start_date || '?'} → ${sem.end_date || '?'}` : `archived ${sem.archived_on}`
  return (
    <RecordCard>
      <div className="flex items-center gap-2 px-4 sm:px-5 py-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex flex-1 min-w-0 items-center gap-3 text-left"
        >
          {open ? <ChevronDown size={16} className="text-ink-muted shrink-0" /> : <ChevronRight size={16} className="text-ink-muted shrink-0" />}
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[15px] font-semibold text-ink truncate">{sem.name}</span>
            <span className="block tabular text-[12px] text-ink-muted">{range}</span>
          </span>
          <span className="text-right shrink-0">
            <span className="block tabular text-ink">GPA {fmtGpa(gpa)}</span>
            <span className="block tabular text-[12px] text-ink-muted">{credits} cr</span>
          </span>
        </button>
        <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={onDelete} aria-label={`Delete ${sem.name}`}>
          Delete
        </Button>
      </div>
      {open && (
        <div className="border-t border-rule">
          <CourseRows courses={sem.courses} onGrade={onGrade} />
        </div>
      )}
    </RecordCard>
  )
}

export function SemestersPage() {
  const { db, mutate } = useAppData()
  const [finishing, setFinishing] = useState(false)
  const [picks, setPicks] = useState<Record<number, string | null>>({})
  const [targetText, setTargetText] = useState('')

  const pastCourses = useMemo(() => db.pastSemesters.flatMap((s) => s.courses), [db.pastSemesters])
  const current = gpaOf(db.courses)
  const expected = expectedGpaOf(db.courses)
  const all = gpaOf([...pastCourses, ...db.courses])
  const past = [...db.pastSemesters].sort(
    (a, b) => b.end_date.localeCompare(a.end_date) || b.archived_on.localeCompare(a.archived_on) || b.id - a.id,
  )

  const simCourses = useMemo(() => db.courses.filter((c) => !isSU(c)), [db.courses])
  const sim = useMemo(() => whatIfGpa(pastCourses, db.courses, picks), [pastCourses, db.courses, picks])
  const hasPicks = Object.values(picks).some((v) => v !== null && v !== '')
  const semDelta = formatDelta(sim.semester, current.gpa)
  const cumDelta = formatDelta(sim.cumulative, all.gpa)

  const targetNum = targetText.trim() !== '' ? Number(targetText) : NaN
  const targetValid = Number.isFinite(targetNum) && targetNum >= 0 && targetNum <= 4
  const req = useMemo(
    () => (targetValid ? requiredSemesterGpa(pastCourses, db.courses, targetNum) : null),
    [targetValid, pastCourses, db.courses, targetNum],
  )
  const maxCumulative = useMemo(() => {
    const bestPicks: Record<number, string | null> = {}
    for (const c of simCourses) {
      const bands = (c.scale.length ? c.scale : DEFAULT_SCALE).filter(
        (b) => b.grade_point !== '' && Number.isFinite(Number(b.grade_point)),
      )
      const top = [...bands].sort((a, b) => Number(b.grade_point) - Number(a.grade_point))[0]
      if (top) bestPicks[c.id] = top.grade_label
    }
    return whatIfGpa(pastCourses, db.courses, bestPicks).cumulative
  }, [pastCourses, db.courses, simCourses])

  const gradeCurrent = (id: number, value: string | null) =>
    mutate((d) => {
      const c = d.courses.find((x) => x.id === id)
      if (c) c.official_grade = value
    })
  const gradePast = (semId: number) => (id: number, value: string | null) =>
    mutate((d) => {
      const c = d.pastSemesters.find((s) => s.id === semId)?.courses.find((x) => x.id === id)
      if (c) c.official_grade = value
    })
  const removePast = (sem: LArchivedSemester) => {
    if (!window.confirm(`Delete "${sem.name}" from the transcript? Its grades will no longer count toward your GPA.`)) return
    mutate((d) => {
      d.pastSemesters = d.pastSemesters.filter((s) => s.id !== sem.id)
    })
  }

  const canFinish = db.semester !== null || db.courses.length > 0
  const isEmpty = db.courses.length === 0 && db.pastSemesters.length === 0

  return (
    <>
      <PageHeader
        division="Division 04 · Academic Ledger"
        title="Transcript"
        subtitle={
          <span className="tabular">
            Cumulative GPA {fmtGpa(all.gpa)} · {all.credits} credits
          </span>
        }
      />

      <div className="flex flex-col gap-4 lg:gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Current semester GPA" value={fmtGpa(current.gpa)} detail="Projected" tone="accent" />
          <StatCard label="Expected semester GPA" value={fmtGpa(expected.gpa)} detail="If your expectations come true" tone="mustard" />
          <StatCard label="Cumulative GPA" value={fmtGpa(all.gpa)} detail="Past semesters and current" tone="mustard" />
          <StatCard label="Credits counted" value={all.credits} unit="cr" detail={`${all.counted} courses`} tone="sage" />
        </div>
        <p className="text-[13px] text-ink-muted">Uses the official grade when entered, otherwise the final or projected letter from the gradebook.</p>

        {isEmpty ? (
          <RecordCard>
            <EmptyState title="Nothing on the transcript yet" body="Add courses or Import with AI, then finish a semester to keep it here." />
          </RecordCard>
        ) : (
          <>
            <RecordCard>
              <SectionHeader
                index="01"
                title="Current semester"
                meta={db.semester?.name ?? 'No current semester'}
                action={
                  canFinish ? (
                    <Button size="sm" variant="secondary" icon={<Flag size={14} />} onClick={() => setFinishing(true)}>
                      Finish semester
                    </Button>
                  ) : undefined
                }
              />
              {!db.semester && <p className="px-4 sm:px-5 pt-3 text-sm text-ink-muted sm:hidden">No current semester</p>}
              {db.semester && <p className="px-4 sm:px-5 pt-3 text-sm text-ink-muted sm:hidden">{db.semester.name}</p>}
              <CourseRows courses={db.courses} onGrade={gradeCurrent} />
              <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-rule bg-surface-sunken">
                <span className="micro">Semester GPA</span>
                <span className="tabular text-ink">
                  {fmtGpa(current.gpa)} <span className="text-ink-muted text-[12px]">· {current.credits} cr</span>
                </span>
              </div>
            </RecordCard>

            <RecordCard>
              <SectionHeader
                index="02"
                title="What if…"
                meta="Sandbox · not saved"
                action={
                  simCourses.length > 0 ? (
                    <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} disabled={!hasPicks} onClick={() => setPicks({})}>
                      Reset
                    </Button>
                  ) : undefined
                }
              />
              {db.courses.length === 0 ? (
                <EmptyState code="NO CURRENT COURSES" title="No courses this semester" body="Add courses to simulate your GPA." />
              ) : simCourses.length === 0 ? (
                <EmptyState code="S/U ONLY" title="No GPA-counted courses" body="S/U courses do not count toward your GPA." />
              ) : (
                <>
                  <ul className="divide-y divide-rule">
                    {simCourses.map((c) => {
                      const g = courseGrade(c)
                      const bands = c.scale.length ? c.scale : DEFAULT_SCALE
                      const pick = picks[c.id] ?? ''
                      return (
                        <li key={c.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 sm:px-5 py-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className="w-[3px] h-8 rounded-[1px] shrink-0" style={{ background: c.color }} aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                              <div className="tabular text-[12px] text-ink-muted">
                                {c.code} · {c.credits} cr
                              </div>
                              <div className="font-medium text-ink truncate">{c.name}</div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-4 sm:pl-0">
                            <span className="tabular text-[12px] text-ink-muted">now {g.letter ?? '—'}</span>
                            <select
                              aria-label={`What-if grade for ${c.code}`}
                              value={pick}
                              onChange={(e) => {
                                const val = e.target.value || null
                                setPicks((prev) => ({ ...prev, [c.id]: val }))
                              }}
                              className="h-9 px-2 bg-surface border border-border rounded-xs text-ink tabular focus:outline-none focus:border-accent"
                            >
                              <option value="">—</option>
                              {bands.map((b) => (
                                <option key={b.grade_label} value={b.grade_label}>
                                  {b.grade_label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </li>
                      )
                    })}
                  </ul>

                  <div className="px-4 sm:px-5 py-3 border-t border-rule bg-surface-sunken flex flex-wrap items-baseline gap-x-4 gap-y-1 tabular text-[14px]">
                    <span className="text-ink-muted">
                      Semester GPA <strong className="font-semibold text-ink">{fmtGpa(sim.semester)}</strong>
                      {semDelta && <span className={`ml-1.5 text-[12.5px] font-medium ${semDelta.tone}`}>({semDelta.text})</span>}
                    </span>
                    <span className="text-ink-muted" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-ink-muted">
                      Cumulative <strong className="font-semibold text-ink">{fmtGpa(sim.cumulative)}</strong>
                      {cumDelta && <span className={`ml-1.5 text-[12.5px] font-medium ${cumDelta.tone}`}>({cumDelta.text})</span>}
                    </span>
                  </div>

                  <div className="px-4 sm:px-5 py-4 border-t border-rule flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
                    <FormField
                      label="Target cumulative GPA"
                      type="number"
                      inputMode="decimal"
                      mono
                      min={0}
                      max={4}
                      step="0.01"
                      placeholder="3.25"
                      className="w-full sm:w-44"
                      value={targetText}
                      onChange={(e) => setTargetText(e.target.value)}
                    />
                    <div className="text-[13.5px] text-ink-muted sm:pb-2.5 min-w-0">
                      {!targetText.trim() ? (
                        'Enter a target GPA to see what average you need this semester.'
                      ) : !targetValid ? (
                        <span className="text-danger">Enter a number from 0 to 4.</span>
                      ) : req?.status === 'secured' ? (
                        <span className="text-sage-ink">Already secured.</span>
                      ) : req?.status === 'impossible' ? (
                        <span className="text-danger">
                          Out of reach this semester{maxCumulative !== null ? ` (max ${maxCumulative.toFixed(2)})` : ''}.
                        </span>
                      ) : req && req.needed !== null ? (
                        <>
                          You need an average of <strong className="tabular font-semibold text-ink">{req.needed.toFixed(2)}</strong> this
                          semester
                          {(() => {
                            const letter = nearestDefaultLetter(req.needed)
                            return letter ? ` (about ${letter}).` : '.'
                          })()}
                        </>
                      ) : (
                        'Add GPA-counted courses with credits to calculate.'
                      )}
                    </div>
                  </div>
                </>
              )}
            </RecordCard>

            <RecordCard>
              <SectionHeader index="03" title="Past semesters" />
              {past.length === 0 ? (
                <EmptyState code="NOTHING ARCHIVED" title="No past semesters" body="Finish a semester to keep its grades here." />
              ) : (
                <div className="flex flex-col gap-3 p-3 sm:p-4">
                  {past.map((s) => (
                    <PastSemester key={s.id} sem={s} onGrade={gradePast(s.id)} onDelete={() => removePast(s)} />
                  ))}
                </div>
              )}
            </RecordCard>
          </>
        )}
      </div>

      <Modal
        open={finishing}
        onClose={() => setFinishing(false)}
        title="Finish semester"
        label="CONFIRM"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFinishing(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                mutate((d, nid) => archiveCurrentSemester(d, nid))
                setFinishing(false)
              }}
            >
              Finish semester
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-sm text-ink-muted">
          <p>The current semester and its courses move to the transcript and keep counting toward your cumulative GPA.</p>
          <p>Tasks, links and study sessions stay, but they lose their course link.</p>
          <p className="text-ink">Enter the official grades first if you have them.</p>
        </div>
      </Modal>
    </>
  )
}
