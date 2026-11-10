import { ArrowUpRight, Star } from 'lucide-react'
import type { ReactNode } from 'react'

interface ResourceCardProps {
  index: string
  title: string
  url: string
  description?: string
  category?: string
  courseCode?: string
  icon?: ReactNode
  favorite?: boolean
  onToggleFavorite?: () => void
}

/** Indexed file card for the Resource Hub. */
export function ResourceCard({
  index,
  title,
  url,
  description,
  category,
  courseCode,
  icon,
  favorite = false,
  onToggleFavorite,
}: ResourceCardProps) {
  const host = (() => {
    try {
      return new URL(url).host
    } catch {
      return url
    }
  })()

  return (
    <article className="group relative bg-surface border border-border rounded-sm flex flex-col">
      {/* File tab */}
      <div className="flex items-center gap-2 h-8 px-4 border-b border-rule bg-surface-sunken">
        <span className="tabular text-[11px] text-accent-strong font-semibold">{index}</span>
        {category && <span className="micro truncate">{category}</span>}
        {courseCode && <span className="micro ml-auto text-olive">{courseCode}</span>}
      </div>
      <div className="p-4 flex gap-3 flex-1">
        {icon && (
          <span className="shrink-0 w-9 h-9 grid place-items-center border border-border rounded-xs text-ink-muted">
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[16px] font-medium text-ink truncate">{title}</h3>
          <p className="tabular text-[12px] text-ink-muted truncate">{host}</p>
          {description && <p className="mt-2 text-[13px] text-ink-muted line-clamp-2">{description}</p>}
        </div>
      </div>
      <div className="flex items-center border-t border-rule">
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-pressed={favorite}
          aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
          className="h-9 px-4 text-ink-muted hover:text-mustard-ink"
        >
          <Star size={16} className={favorite ? 'fill-mustard text-mustard' : ''} />
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto h-9 px-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent-strong hover:underline underline-offset-2"
        >
          Open <ArrowUpRight size={15} />
        </a>
      </div>
    </article>
  )
}
