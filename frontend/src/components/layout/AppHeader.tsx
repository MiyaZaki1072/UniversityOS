import { Bell, FileInput, Menu } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatLongDate } from '../../lib/format'
import { Emblem } from './Emblem'

interface AppHeaderProps {
  pageTitle: string
  pageCode: string
  semesterName: string | null
  today: string
  userInitial: string
  notifications: number
  onImport: () => void
  onOpenMenu: () => void
  /** Small status shown before the actions (e.g. save state). */
  status?: ReactNode
}

export function AppHeader({
  pageTitle,
  pageCode,
  semesterName,
  today,
  userInitial,
  notifications,
  onImport,
  onOpenMenu,
  status,
}: AppHeaderProps) {
  const longDate = formatLongDate(today)

  return (
    <header className="sticky top-0 z-20 bg-bg/95 backdrop-blur-[2px] border-b border-border">
      <div className="flex items-center gap-3 h-14 px-4 sm:px-6 lg:px-8">
        {/* Mobile: menu + brand */}
        <button
          onClick={onOpenMenu}
          className="lg:hidden -ml-1 p-2 text-ink-muted hover:text-ink"
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <div className="lg:hidden flex items-center gap-2 text-ink">
          <Emblem size={24} />
          <span className="font-display text-[14px] font-semibold tracking-[0.14em]">UNIVERSITY OS</span>
        </div>

        {/* Desktop: breadcrumbs */}
        <nav aria-label="Breadcrumb" className="hidden lg:block min-w-0">
          <ol className="flex items-center gap-2 micro">
            <li>Academic Records Division</li>
            <li aria-hidden="true" className="text-ink-faint">/</li>
            <li className="text-ink truncate" aria-current="page">
              <span className="text-accent-strong mr-1.5">{pageCode}</span>
              {pageTitle}
            </li>
          </ol>
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <div className="hidden md:flex items-center gap-4 mr-3 micro">
            {semesterName && <span>{semesterName}</span>}
            <span className="w-px h-4 bg-border" aria-hidden="true" />
            <time dateTime={today} className="text-ink">
              {longDate}
            </time>
          </div>

          {status}
          <button
            onClick={onImport}
            className="h-9 px-2.5 inline-flex items-center gap-2 rounded-xs text-ink-muted hover:text-ink hover:bg-surface-2"
            aria-label="Import courses with AI"
            title="Import courses with AI"
          >
            <FileInput size={18} />
            <span className="hidden xl:inline micro">Import</span>
          </button>

          <button
            className="relative h-9 w-9 grid place-items-center rounded-xs text-ink-muted hover:text-ink hover:bg-surface-2"
            aria-label={`Notifications (${notifications} unread)`}
          >
            <Bell size={18} />
            {notifications > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-[2px] bg-accent text-accent-fg tabular text-[10px] leading-4 text-center">
                {notifications}
              </span>
            )}
          </button>

          <button
            className="ml-1 h-9 w-9 grid place-items-center rounded-xs border border-border-strong bg-surface font-display font-semibold text-ink"
            aria-label="Account"
          >
            {userInitial}
          </button>
        </div>
      </div>
    </header>
  )
}
