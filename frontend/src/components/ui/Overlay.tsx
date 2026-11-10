import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

function useOverlay(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus()
    }
  }, [open, onClose])
  return ref
}

interface OverlayProps {
  open: boolean
  onClose: () => void
  title: string
  label?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'md' | 'lg'
}

/** Centered dialog styled as an official form. */
export function Modal({ open, onClose, title, label = 'FORM', children, footer, size = 'md' }: OverlayProps) {
  const ref = useOverlay(open, onClose)
  if (!open) return null
  // Portal to <body> so page transforms/stacking contexts can't trap the overlay.
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative w-full ${size === 'lg' ? 'max-w-3xl' : 'max-w-lg'} max-h-[calc(100dvh-2rem)] flex flex-col bg-surface border border-border-strong rounded-sm shadow-overlay animate-page-in focus:outline-none`}
      >
        <div className="flex items-center gap-3 px-5 h-12 shrink-0 border-b-2 border-border-strong">
          <span className="micro text-accent-strong">{label}</span>
          <h2 className="font-display font-medium text-ink">{title}</h2>
          <button onClick={onClose} className="ml-auto p-1 text-ink-muted hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto min-h-0">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 px-5 py-3 shrink-0 border-t border-rule bg-surface-sunken">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/** Side drawer (mobile navigation, quick record view). */
export function Drawer({
  open,
  onClose,
  title,
  children,
  side = 'left',
  dark = false,
}: OverlayProps & { side?: 'left' | 'right'; dark?: boolean }) {
  const ref = useOverlay(open, onClose)
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={
          `absolute top-0 bottom-0 ${side === 'left' ? 'left-0' : 'right-0'} w-[86%] max-w-[320px] ` +
          `${dark ? 'bg-walnut text-on-walnut' : 'bg-surface text-ink'} shadow-overlay flex flex-col focus:outline-none`
        }
      >
        <button
          onClick={onClose}
          className={`absolute top-3 right-3 p-1.5 ${dark ? 'text-on-walnut-muted hover:text-on-walnut' : 'text-ink-muted'}`}
          aria-label="Close"
        >
          <X size={20} />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  )
}
