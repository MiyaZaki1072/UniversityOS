import { Bell, FileInput, Menu, Search } from 'lucide-react'
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
  onSearch?: () => void
  onBell?: () => void
  /** Rendered under the bell when open (reminder list). */
  bellPanel?: ReactNode
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
  onSearch,
  onBell,
  bellPanel,
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
        <div className="lg:hidden flex shrink-0 items-center gap-2 text-ink">
          <Emblem size={24} />
          <span className="font-display text-[14px] font-semibold tracking-[0.14em] whitespace-nowrap">UNIVERSITY OS</span>
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
          {/* Tablet widths only have room for the date; the semester joins it once the sidebar layout starts. */}
          <div className="hidden md:flex items-center gap-4 mr-3 micro whitespace-nowrap">
            {semesterName && <span className="hidden lg:inline">{semesterName}</span>}
            {semesterName && <span className="hidden lg:block w-px h-4 bg-border" aria-hidden="true" />}
            <time dateTime={today} className="text-ink">
              {longDate}
            </time>
          </div>

          {status}
          {onSearch && (
            <button
              onClick={onSearch}
              className="h-9 px-2.5 inline-flex items-center gap-2 rounded-xs text-ink-muted hover:text-ink hover:bg-surface-2"
              aria-label="Search (Ctrl+K)"
              title="Search (Ctrl+K)"
            >
              <Search size={18} />
              <span className="hidden xl:inline micro">Ctrl K</span>
            </button>
          )}
          <button
            onClick={onImport}
            className="h-9 px-2.5 hidden sm:inline-flex items-center gap-2 rounded-xs text-ink-muted hover:text-ink hover:bg-surface-2"
            aria-label="Import courses with AI"
            title="Import courses with AI"
          >
            <FileInput size={18} />
            <span className="hidden xl:inline micro">Import</span>
          </button>

          <div className="relative">
          <button
            onClick={onBell}
            className="relative h-9 w-9 grid place-items-center rounded-xs text-ink-muted hover:text-ink hover:bg-surface-2"
            aria-label={`Reminders (${notifications} new)`}
            aria-expanded={bellPanel ? true : false}
          >
            <Bell size={18} />
            {notifications > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-[2px] bg-accent text-accent-fg tabular text-[10px] leading-4 text-center">
                {notifications}
              </span>
            )}
          </button>
          {bellPanel && (
            <>
              {/* Click outside closes the panel. */}
              <button className="fixed inset-0 z-20 cursor-default" aria-hidden="true" tabIndex={-1} onClick={onBell} />
              <div className="fixed inset-x-2 top-14 z-30 flex justify-end sm:absolute sm:inset-x-auto sm:right-0 sm:top-11">{bellPanel}</div>
            </>
          )}
          </div>

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
