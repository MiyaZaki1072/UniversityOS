import type { ReactNode } from 'react'

/* ------------------------------------------------------------------ */
/* SectionHeader — numbered section title inside a panel or page.      */
/* ------------------------------------------------------------------ */

interface SectionHeaderProps {
  index?: string
  title: string
  meta?: ReactNode
  action?: ReactNode
}

export function SectionHeader({ index, title, meta, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-3 px-4 sm:px-5 h-12 border-b border-rule">
      {index && (
        <span className="tabular text-[11px] font-semibold text-accent-strong tracking-wider">
          {index}
        </span>
      )}
      <h2 className="font-display text-[15px] font-semibold uppercase tracking-[0.08em] text-ink">
        {title}
      </h2>
      {meta && <span className="micro hidden sm:inline">{meta}</span>}
      <div className="ml-auto flex items-center gap-2">{action}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* RecordCard — the base panel. Flat, thin border, optional side tab.  */
/* ------------------------------------------------------------------ */

interface RecordCardProps {
  children: ReactNode
  /** Colored indicator on the left edge (e.g. a course color). */
  indicator?: string
  className?: string
  as?: 'section' | 'article' | 'div'
}

export function RecordCard({ children, indicator, className = '', as = 'section' }: RecordCardProps) {
  const Tag = as
  return (
    <Tag
      className={`relative bg-surface border border-border rounded-sm overflow-hidden ${className}`}
      style={indicator ? { boxShadow: `inset 4px 0 0 ${indicator}` } : undefined}
    >
      {children}
    </Tag>
  )
}

/* ------------------------------------------------------------------ */
/* StatCard — one figure with a label, optional meter.                 */
/* ------------------------------------------------------------------ */

interface StatCardProps {
  label: string
  value: ReactNode
  unit?: string
  detail?: ReactNode
  /** 0–1. Renders a segmented gauge. */
  progress?: number
  tone?: 'accent' | 'mustard' | 'sage'
  icon?: ReactNode
}

const toneFill = { accent: 'bg-accent', mustard: 'bg-mustard', sage: 'bg-sage' }

export function StatCard({ label, value, unit, detail, progress, tone = 'mustard', icon }: StatCardProps) {
  const segments = 20
  const filled = progress === undefined ? 0 : Math.round(Math.min(1, Math.max(0, progress)) * segments)
  return (
    <RecordCard className="p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="micro">{label}</span>
        {icon && <span className="text-ink-faint">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="tabular text-[30px] leading-none font-medium text-ink">{value}</span>
        {unit && <span className="tabular text-sm text-ink-muted">{unit}</span>}
      </div>
      {progress !== undefined && (
        <div className="flex gap-[3px]" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label={label}>
          {Array.from({ length: segments }, (_, i) => (
            <span
              key={i}
              className={`h-2 flex-1 rounded-[1px] ${i < filled ? toneFill[tone] : 'bg-surface-2'}`}
            />
          ))}
        </div>
      )}
      {detail && <div className="text-[13px] text-ink-muted">{detail}</div>}
    </RecordCard>
  )
}

/* ------------------------------------------------------------------ */
/* PageHeader — editorial page title with division label.              */
/* ------------------------------------------------------------------ */

interface PageHeaderProps {
  division: string
  title: string
  subtitle?: ReactNode
  aside?: ReactNode
}

export function PageHeader({ division, title, subtitle, aside }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between pb-5 mb-6 border-b-2 border-border-strong">
      <div className="min-w-0">
        <div className="micro text-accent-strong mb-2">{division}</div>
        <h1 className="font-display text-[34px] sm:text-[42px] leading-[1.02] font-medium text-ink">
          {title}
        </h1>
        {subtitle && <div className="mt-2 text-ink-muted">{subtitle}</div>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </header>
  )
}

/* ------------------------------------------------------------------ */
/* EmptyState                                                         */
/* ------------------------------------------------------------------ */

interface EmptyStateProps {
  title: string
  body?: ReactNode
  action?: ReactNode
  code?: string
}

export function EmptyState({ title, body, action, code = 'NO RECORDS ON FILE' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-10 gap-3">
      <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true" className="text-border-strong">
        <circle cx="28" cy="28" r="26" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="28" cy="28" r="17" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
        <line x1="10" y1="28" x2="46" y2="28" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <span className="micro">{code}</span>
      <p className="font-display text-lg text-ink">{title}</p>
      {body && <p className="text-sm text-ink-muted max-w-sm">{body}</p>}
      {action}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Loading / error placeholders                                        */
/* ------------------------------------------------------------------ */

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="p-5 flex flex-col gap-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-4 bg-surface-2 rounded-xs animate-pulse" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  )
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="m-4 p-4 border-[1.5px] border-danger bg-danger-wash rounded-xs flex items-start gap-3">
      <span className="micro text-danger">Transmission error</span>
      <p className="text-sm text-ink flex-1">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-sm font-medium text-danger underline underline-offset-2">
          Retry
        </button>
      )}
    </div>
  )
}
