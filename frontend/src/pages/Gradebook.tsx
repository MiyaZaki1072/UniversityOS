import { ArrowLeft, Plus, RotateCcw, Trash2 } from 'lucide-react'
import type { InputHTMLAttributes } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { EmptyState, PageHeader, RecordCard, SectionHeader } from '../components/ui/Panels'
import { StatusStamp } from '../components/ui/StatusStamp'
import { formatPercent } from '../lib/format'
import { DEFAULT_SCALE, fromLocalInput, standingFor, toLocalInput, weightTotal, type LCourse } from '../lib/localDb'
import { useAppData, type Recipe } from '../lib/store'
import { GradeStandingTable } from './dashboard/GradeStandingTable'

/** Compact inline input used inside ledger rows. */
function Cell({ invalid, className = '', ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={
        `h-9 px-2 min-w-0 bg-surface border rounded-xs text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent ` +
        `${invalid ? 'border-danger' : 'border-border'} ${className}`
      }
      aria-invalid={invalid || undefined}
      {...rest}
    />
  )
}

/** Numeric cell value → stored decimal string ('' stays as is so typing works). */
const num = (v: string) => v.trim()

export function GradebookPage() {
  const { db, data } = useAppData()
  const courses = new Map((data?.courses ?? []).map((c) => [c.id, c]))
  return (
    <>
      <PageHeader division="Division 04 · Academic Ledger" title="Academic Ledger" subtitle="Pick a course to edit its grading and scores." />
      {db.courses.length === 0 ? (
        <RecordCard>
          <EmptyState title="No courses yet" body="Add a course or Import with AI first." />
        </RecordCard>
      ) : (
        <div className="flex flex-col gap-4 lg:gap-5">
          <GradeStandingTable standings={data?.grade_standing ?? []} courses={courses} />
          <RecordCard>
            <SectionHeader index="02" title="Open a ledger" />
            <ul className="divide-y divide-rule">
              {db.courses.map((c) => (
                <li key={c.id}>
                  <Link to={`/gradebook/${c.id}`} className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-surface-2">
                    <span className="w-[3px] h-8 rounded-[1px]" style={{ background: c.color }} aria-hidden="true" />
                    <span className="tabular text-[12px] text-ink-muted w-20 shrink-0">{c.code}</span>
                    <span className="font-medium text-ink truncate">{c.name}</span>
                    <span className="ml-auto tabular text-[12px] text-ink-muted shrink-0">
                      {c.categories.length} categories · {c.categories.reduce((s, g) => s + g.assessments.length, 0)} items
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </RecordCard>
        </div>
      )}
    </>
  )
}

export function GradebookCoursePage() {
  const { id } = useParams()
  const { db, mutate } = useAppData()
  const course = db.courses.find((c) => c.id === Number(id))

  if (!course) {
    return (
      <RecordCard>
        <EmptyState
          code="RECORD NOT FOUND"
          title="This course doesn't exist"
          action={
            <Link to="/gradebook">
              <Button size="sm">All ledgers</Button>
            </Link>
          }
        />
      </RecordCard>
    )
  }

  const edit = (fn: (c: LCourse, nid: () => number) => void) =>
    mutate(((d, nid) => {
      const c = d.courses.find((x) => x.id === course.id)
      if (c) fn(c, nid)
    }) satisfies Recipe)

  const s = standingFor(course)
  const total = weightTotal(course)
  const ungradedWeight = Math.max(0, total - Number(s.graded_category_weight))
  const letter = s.letter_grade ?? s.projected_letter_grade

  const scaleMins = course.scale.map((b) => Number(b.minimum_percentage))
  const scaleIssue =
    course.scale.length === 0
      ? null
      : !scaleMins.includes(0)
        ? 'Add a band that starts at 0 (e.g. F at 0).'
        : new Set(scaleMins).size !== scaleMins.length
          ? 'Two bands have the same minimum.'
          : null

  return (
    <>
      <Link to="/gradebook" className="inline-flex items-center gap-1.5 mb-4 text-[13px] text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> All ledgers
      </Link>
      <PageHeader division={`Academic Ledger · ${course.code}`} title={course.name} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
        <div className="lg:col-span-8 flex flex-col gap-4 lg:gap-5">
          {course.categories.length === 0 && (
            <RecordCard>
              <EmptyState
                code="NO GRADING STRUCTURE"
                title="No grade categories yet"
                body="Add categories like Homework 20%, Midterm 30%, Final 50%, then the graded items inside each."
              />
            </RecordCard>
          )}

          {course.categories.map((g, gi) => {
            const graded = g.assessments.filter((a) => a.points_earned !== null)
            const earned = graded.reduce((t, a) => t + Number(a.points_earned), 0)
            const possible = graded.reduce((t, a) => t + Number(a.points_possible), 0)
            return (
              <RecordCard key={g.id} indicator={course.color}>
                <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 py-3 border-b border-rule">
                  <span className="tabular text-[11px] font-semibold text-accent-strong">{String(gi + 1).padStart(2, '0')}</span>
                  <Cell
                    aria-label="Category name"
                    value={g.name}
                    onChange={(e) => edit((c) => (c.categories[gi].name = e.target.value))}
                    className="flex-1 min-w-[140px] font-medium"
                  />
                  <div className="flex items-center gap-1">
                    <Cell
                      aria-label={`${g.name} weight percent`}
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={g.weight_percent}
                      invalid={g.weight_percent === '' || Number(g.weight_percent) < 0}
                      onChange={(e) => edit((c) => (c.categories[gi].weight_percent = num(e.target.value)))}
                      className="w-20 tabular text-right"
                    />
                    <span className="text-ink-muted">%</span>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete category "${g.name}" and its ${g.assessments.length} items?`))
                        edit((c) => c.categories.splice(gi, 1))
                    }}
                    className="p-1.5 text-ink-muted hover:text-danger"
                    aria-label={`Delete category ${g.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {g.assessments.length > 0 && (
                  <div className="hidden sm:grid grid-cols-[1fr_88px_88px_170px_32px] gap-2 px-5 pt-2 micro">
                    <span>Item</span>
                    <span className="text-right">Score</span>
                    <span className="text-right">Max</span>
                    <span>Due</span>
                    <span />
                  </div>
                )}
                <ul className="divide-y divide-rule">
                  {g.assessments.map((a, ai) => {
                    const over = a.points_earned !== null && a.points_earned !== '' && Number(a.points_earned) > Number(a.points_possible)
                    const badMax = a.points_possible === '' || Number(a.points_possible) <= 0
                    return (
                      <li key={a.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_88px_88px_170px_32px] gap-2 items-center px-4 sm:px-5 py-2">
                        <Cell
                          aria-label="Item title"
                          value={a.title}
                          onChange={(e) => edit((c) => (c.categories[gi].assessments[ai].title = e.target.value))}
                          className="col-span-2 sm:col-span-1"
                        />
                        <div className="flex items-center gap-2 sm:contents">
                          <Cell
                            aria-label={`${a.title} score`}
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="—"
                            value={a.points_earned ?? ''}
                            invalid={over}
                            title={over ? 'Score is higher than the maximum' : 'Leave empty if not graded yet'}
                            onChange={(e) =>
                              edit((c) => (c.categories[gi].assessments[ai].points_earned = e.target.value.trim() === '' ? null : num(e.target.value)))
                            }
                            className="w-20 sm:w-full tabular text-right"
                          />
                          <span className="sm:hidden text-ink-muted">/</span>
                          <Cell
                            aria-label={`${a.title} maximum`}
                            type="number"
                            min={0}
                            step="0.01"
                            value={a.points_possible}
                            invalid={badMax}
                            onChange={(e) => edit((c) => (c.categories[gi].assessments[ai].points_possible = num(e.target.value)))}
                            className="w-20 sm:w-full tabular text-right"
                          />
                          <Cell
                            aria-label={`${a.title} due`}
                            type="datetime-local"
                            value={toLocalInput(a.due_at)}
                            onChange={(e) => edit((c) => (c.categories[gi].assessments[ai].due_at = fromLocalInput(e.target.value)))}
                            className="hidden sm:block w-full tabular text-[12px]"
                          />
                        </div>
                        <button
                          onClick={() => edit((c) => c.categories[gi].assessments.splice(ai, 1))}
                          className="p-1.5 text-ink-muted hover:text-danger justify-self-end"
                          aria-label={`Delete ${a.title}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </li>
                    )
                  })}
                </ul>
                <div className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-2.5 border-t border-rule bg-surface-sunken">
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Plus size={14} />}
                    onClick={() =>
                      edit((c, nid) =>
                        c.categories[gi].assessments.push({
                          id: nid(),
                          title: `${g.name} ${g.assessments.length + 1}`,
                          points_possible: '100',
                          points_earned: null,
                          due_at: null,
                        }),
                      )
                    }
                  >
                    Add item
                  </Button>
                  <span className="ml-auto tabular text-[12px] text-ink-muted">
                    {graded.length === 0 ? 'Nothing graded' : `${earned} / ${possible} · ${formatPercent(String((earned / possible) * 100))}%`}
                  </span>
                </div>
              </RecordCard>
            )
          })}

          <div>
            <Button
              icon={<Plus size={16} />}
              onClick={() =>
                edit((c, nid) =>
                  c.categories.push({ id: nid(), name: 'New category', weight_percent: String(Math.max(0, 100 - weightTotal(c))), assessments: [] }),
                )
              }
            >
              Add category
            </Button>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-4 lg:gap-5">
          <RecordCard className="p-4 sm:p-5 flex flex-col gap-3 lg:sticky lg:top-20">
            <span className="micro">Standing</span>
            <div className="flex items-baseline gap-3">
              <span className="tabular text-[34px] leading-none text-ink">{s.current_grade === null ? '—' : `${formatPercent(s.current_grade)}%`}</span>
              {letter && <span className={`font-display text-3xl font-semibold ${s.is_final ? 'text-ink' : 'text-mustard-ink'}`}>{letter}</span>}
            </div>
            <div>{s.is_final ? <StatusStamp status="FINALIZED" /> : letter ? <StatusStamp status="PROJECTED" /> : <StatusStamp status="UNGRADED" />}</div>
            <dl className="grid grid-cols-2 gap-y-1.5 text-[13px]">
              <dt className="text-ink-muted">Weights total</dt>
              <dd className={`tabular text-right ${total === 100 ? 'text-ink' : 'text-danger'}`}>{total}%</dd>
              <dt className="text-ink-muted">Graded weight</dt>
              <dd className="tabular text-right text-ink">{Number(s.graded_category_weight)}%</dd>
              <dt className="text-ink-muted">Ungraded items</dt>
              <dd className="tabular text-right text-ink">{s.ungraded_assessments}</dd>
            </dl>
            {total !== 100 && course.categories.length > 0 && (
              <p className="text-[12.5px] text-danger">
                Weights add up to {total}%. Letter grades stay off until they total exactly 100%.
              </p>
            )}
            {total === 100 && ungradedWeight > 0 && (
              <p className="text-[12.5px] text-ink-muted">
                {ungradedWeight}% of the weight is not graded yet; the current grade covers graded work only.
              </p>
            )}
          </RecordCard>

          <RecordCard>
            <SectionHeader
              index="S"
              title="Grade scale"
              action={
                <button
                  onClick={() => edit((c) => (c.scale = DEFAULT_SCALE.map((b) => ({ ...b }))))}
                  className="inline-flex items-center gap-1 text-[13px] text-ink-muted hover:text-ink"
                  title="Reset to the default scale"
                >
                  <RotateCcw size={13} /> Default
                </button>
              }
            />
            <div className="grid grid-cols-[1fr_1fr_1fr_32px] gap-2 px-4 sm:px-5 pt-2 micro">
              <span>Grade</span>
              <span className="text-right">Min %</span>
              <span className="text-right">Points</span>
              <span />
            </div>
            <ul className="px-4 sm:px-5 py-2 flex flex-col gap-1.5">
              {course.scale.map((b, bi) => (
                <li key={bi} className="grid grid-cols-[1fr_1fr_1fr_32px] gap-2 items-center">
                  <Cell aria-label="Grade label" value={b.grade_label} onChange={(e) => edit((c) => (c.scale[bi].grade_label = e.target.value))} />
                  <Cell
                    aria-label={`${b.grade_label} minimum percent`}
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={b.minimum_percentage}
                    onChange={(e) => edit((c) => (c.scale[bi].minimum_percentage = num(e.target.value)))}
                    className="tabular text-right"
                  />
                  <Cell
                    aria-label={`${b.grade_label} grade points`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={b.grade_point}
                    onChange={(e) => edit((c) => (c.scale[bi].grade_point = num(e.target.value)))}
                    className="tabular text-right"
                  />
                  <button onClick={() => edit((c) => c.scale.splice(bi, 1))} className="p-1.5 text-ink-muted hover:text-danger" aria-label={`Delete band ${b.grade_label}`}>
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-3 px-4 sm:px-5 pb-3">
              <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => edit((c) => c.scale.push({ grade_label: '', minimum_percentage: '0', grade_point: '0' }))}>
                Add band
              </Button>
              {scaleIssue && <span className="text-[12px] text-danger">{scaleIssue}</span>}
            </div>
          </RecordCard>
        </div>
      </div>
    </>
  )
}
