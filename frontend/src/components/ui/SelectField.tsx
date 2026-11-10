import { useId, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

const control =
  'px-3 bg-surface border border-border-strong rounded-xs text-ink ' +
  'focus:outline-none focus:border-accent focus:shadow-[0_0_0_1px_var(--color-accent)]'

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  options: { value: string; label: string }[]
  hint?: string
}

/** Labelled select styled like FormField. */
export function SelectField({ label, options, hint, className = '', ...select }: SelectFieldProps) {
  const id = useId()
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="micro !text-ink">
        {label}
      </label>
      <select id={id} className={`h-10 ${control}`} {...select}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <p className="text-[12px] text-ink-muted">{hint}</p>}
    </div>
  )
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
}

/** Labelled multi-line input styled like FormField. */
export function TextAreaField({ label, className = '', ...area }: TextAreaFieldProps) {
  const id = useId()
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="micro !text-ink">
        {label}
      </label>
      <textarea id={id} rows={3} className={`py-2 ${control}`} {...area} />
    </div>
  )
}
