import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-sm font-medium select-none ' +
  'transition-[background-color,border-color,transform,box-shadow] duration-[var(--dur-fast)] ' +
  'active:translate-y-px disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap'

const variants: Record<Variant, string> = {
  // Mechanical feel: a 1px bottom "key edge" that collapses on press.
  primary:
    'bg-accent-fill text-accent-fg border border-accent-fill font-semibold shadow-[inset_0_-2px_0_rgb(0_0_0/0.25)] ' +
    'hover:brightness-[1.06] active:shadow-none',
  secondary:
    'bg-surface text-ink border border-border-strong shadow-[inset_0_-2px_0_var(--color-rule)] ' +
    'hover:bg-surface-2 active:shadow-none',
  ghost: 'text-ink-muted hover:text-ink hover:bg-surface-2 border border-transparent',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest}>
      {icon}
      {children}
    </button>
  )
}
