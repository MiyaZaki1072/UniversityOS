import type { ReactNode } from 'react'
import { RecordCard } from '../../components/ui/Panels'

export interface Vital {
  key: string
  label: string
  icon?: ReactNode
  value: ReactNode
  unit?: string
  /** 0–1. Renders a segmented gauge. */
  progress?: number
  tone?: 'accent' | 'mustard' | 'sage'
  detail?: ReactNode
}

const toneFill = { accent: 'bg-accent', mustard: 'bg-mustard', sage: 'bg-sage' }
const SEGMENTS = 12

/**
 * The day's readings in one instrument panel: side by side on phones and wide rows,
 * stacked when it sits beside the exam countdown on desktop.
 */
export function VitalsStrip({ vitals, stackOnDesktop }: { vitals: Vital[]; stackOnDesktop: boolean }) {
  const cols = vitals.length === 1 ? 'grid-cols-1' : vitals.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
  return (
    <RecordCard className="h-full">
      <dl
        className={
          `grid ${cols} h-full divide-x divide-rule ` +
          (stackOnDesktop ? 'lg:grid-cols-1 lg:divide-x-0 lg:divide-y' : '')
        }
      >
        {vitals.map((v) => {
          const filled = v.progress === undefined ? 0 : Math.round(Math.min(1, Math.max(0, v.progress)) * SEGMENTS)
          return (
            <div
              key={v.key}
              className={`min-w-0 p-3.5 sm:p-5 flex flex-col gap-2.5 ${stackOnDesktop ? 'lg:justify-center' : ''}`}
            >
              <dt className="flex items-center justify-between gap-2">
                <span className="micro truncate">{v.label}</span>
                {v.icon && <span className="text-ink-muted hidden sm:inline" aria-hidden="true">{v.icon}</span>}
              </dt>
              <dd className="flex items-baseline gap-1.5 min-w-0">
                <span className="tabular text-[24px] sm:text-[30px] leading-none font-medium text-ink whitespace-nowrap">{v.value}</span>
                {v.unit && <span className="tabular text-sm text-ink-muted whitespace-nowrap">{v.unit}</span>}
              </dd>
              {v.progress !== undefined && (
                <dd
                  className="flex gap-[3px]"
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(Math.min(1, v.progress) * 100)}
                  aria-label={v.label}
                >
                  {Array.from({ length: SEGMENTS }, (_, i) => (
                    <span key={i} className={`h-2 flex-1 rounded-[1px] ${i < filled ? toneFill[v.tone ?? 'mustard'] : 'bg-surface-2'}`} />
                  ))}
                </dd>
              )}
              {v.detail && <dd className="text-[12.5px] sm:text-[13px] text-ink-muted leading-snug">{v.detail}</dd>}
            </div>
          )
        })}
      </dl>
    </RecordCard>
  )
}
