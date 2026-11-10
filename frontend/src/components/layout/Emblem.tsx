/** Original University OS emblem: a seal with a horizon line and quarter-hour ticks. */
export function Emblem({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className={className}>
      <circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="20" cy="20" r="13" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M7 20h26" stroke="var(--color-accent)" strokeWidth="2.5" />
      <path d="M20 7v4M20 29v4M7 20h0M33 20h0" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 15.5h12M15.5 24.5h9" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}
