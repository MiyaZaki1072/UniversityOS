export type StampStatus =
  | 'PENDING'
  | 'IN PROGRESS'
  | 'COMPLETED'
  | 'FILED'
  | 'OVERDUE'
  | 'UNGRADED'
  | 'FINALIZED'
  | 'PROJECTED'
  | 'DUE TODAY'
  | 'EXAM'
  | 'QUIZ'

const tone: Record<StampStatus, string> = {
  PENDING: 'text-ink-muted border-border-strong',
  'IN PROGRESS': 'text-mustard-ink border-mustard',
  COMPLETED: 'text-sage-ink border-sage',
  FILED: 'text-sage-ink border-sage',
  FINALIZED: 'text-sage-ink border-sage',
  OVERDUE: 'text-danger border-danger',
  'DUE TODAY': 'text-accent-strong border-accent',
  UNGRADED: 'text-ink-muted border-border-strong border-dashed',
  PROJECTED: 'text-mustard-ink border-mustard border-dashed',
  EXAM: 'text-accent-strong border-accent',
  QUIZ: 'text-mustard-ink border-mustard',
}

interface StatusStampProps {
  status: StampStatus
  /** Plays the stamp animation — use when the status was just changed by the user. */
  fresh?: boolean
  className?: string
}

/** Small printed/stamped status label. Use for state, not for decoration. */
export function StatusStamp({ status, fresh = false, className = '' }: StatusStampProps) {
  return (
    <span
      className={
        'inline-flex items-center h-[22px] px-1.5 border-[1.5px] rounded-xs font-mono text-[10.5px] ' +
        'font-semibold tracking-[0.1em] uppercase leading-none whitespace-nowrap ' +
        `${tone[status]} ${fresh ? 'animate-stamp' : ''} ${className}`
      }
    >
      {status}
    </span>
  )
}
