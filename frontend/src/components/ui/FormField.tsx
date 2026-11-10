import { useId, type InputHTMLAttributes } from 'react'

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string
  /** Use for numbers, codes and dates. */
  mono?: boolean
}

/** Form-style labelled input: label sits on the rule, like a printed form box. */
export function FormField({ label, hint, error, mono = false, className = '', ...input }: FormFieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="micro !text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={
          'h-10 px-3 bg-surface border rounded-xs text-ink placeholder:text-ink-faint ' +
          'focus:outline-none focus:border-accent focus:shadow-[0_0_0_1px_var(--color-accent)] ' +
          `${error ? 'border-danger' : 'border-border-strong'} ${mono ? 'tabular' : ''}`
        }
        {...input}
      />
      {error ? (
        <p id={`${id}-err`} className="text-[12px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[12px] text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
