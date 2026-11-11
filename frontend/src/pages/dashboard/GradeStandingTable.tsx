import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { CourseRef, GradeStanding } from '../../lib/types'
import { formatPercent } from '../../lib/format'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { EmptyState, RecordCard, SectionHeader } from '../../components/ui/Panels'
import { StatusStamp } from '../../components/ui/StatusStamp'

interface Row extends GradeStanding {
  course: CourseRef
}

function GradedWeightBar({ value }: { value: string }) {
  const pct = Number(value)
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="hidden md:block w-16 h-1.5 bg-surface-2 rounded-[1px] overflow-hidden" aria-hidden="true">
        <span className="block h-full bg-olive" style={{ width: `${pct}%` }} />
      </span>
      <span>{pct.toFixed(0)}%</span>
    </div>
  )
}

const columns: Column<Row>[] = [
  {
    key: 'course',
    header: 'Course',
    cell: (r) => (
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-[3px] h-8 rounded-[1px] shrink-0" style={{ background: r.course.color }} aria-hidden="true" />
        <div className="min-w-0 max-w-[32vw] sm:max-w-none">
          <div className="tabular text-[12px] text-ink-muted">{r.course.code}</div>
          <div className="font-medium text-ink truncate">{r.course.name}</div>
        </div>
      </div>
    ),
  },
  {
    key: 'graded',
    header: 'Graded',
    align: 'right',
    mono: true,
    hideOnMobile: true,
    cell: (r) => <GradedWeightBar value={r.graded_category_weight} />,
  },
  {
    key: 'current',
    header: 'Current',
    align: 'right',
    mono: true,
    cell: (r) =>
      r.current_grade === null ? (
        <span className="text-ink-muted" aria-label="No grade yet">—</span>
      ) : (
        <span className="text-[15px] text-ink">{formatPercent(r.current_grade)}%</span>
      ),
  },
  {
    key: 'standing',
    header: 'Standing',
    align: 'right',
    cell: (r) => {
      if (r.is_final && r.letter_grade) {
        return (
          <span className="inline-flex items-center gap-2">
            <StatusStamp status="FINALIZED" />
            <span className="font-display text-lg font-semibold">{r.letter_grade}</span>
          </span>
        )
      }
      if (r.projected_letter_grade) {
        return (
          <span className="inline-flex items-center gap-2" aria-label={`Projected ${r.projected_letter_grade}`}>
            <span className="hidden sm:inline">
              <StatusStamp status="PROJECTED" />
            </span>
            <span className="font-display text-lg font-semibold text-mustard-ink w-6 text-left">
              {r.projected_letter_grade}
            </span>
          </span>
        )
      }
      return <StatusStamp status="UNGRADED" />
    },
  },
]

/** Compact ledger of every course's provisional standing (from /courses/{id}/grade-summary/). */
export function GradeStandingTable({
  standings,
  courses,
  index,
}: {
  standings: GradeStanding[]
  courses: Map<number, CourseRef>
  index?: string
}) {
  const rows: Row[] = standings.flatMap((s) => {
    const course = courses.get(s.course_id)
    return course ? [{ ...s, course }] : []
  })
  const first = rows.find((r) => r.current_grade !== null && Number(r.graded_category_weight) < 100)

  return (
    <RecordCard className="h-full">
      <SectionHeader
        index={index}
        title="Grade Standing"
        meta="Provisional"
        action={
          <Link to="/gradebook" className="inline-flex items-center gap-1 text-[13px] font-medium text-accent-strong hover:underline underline-offset-2">
            Ledger <ArrowRight size={14} />
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState code="LEDGER EMPTY" title="No courses on file" body="Add a course to start tracking its standing." />
      ) : (
        <DataTable
          caption="Current grade standing by course"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.course_id}
          footer={
            first && (
              <p className="text-[12.5px] text-ink-muted leading-relaxed">
                <span className="micro !text-ink mr-2">Note</span>
                Current grades cover graded weight only — {first.course.code} has{' '}
                <span className="tabular text-ink">{(100 - Number(first.graded_category_weight)).toFixed(0)}%</span> of its
                weight still ungraded. Letters stay projected until every assessment is in.
              </p>
            )
          }
        />
      )}
    </RecordCard>
  )
}
