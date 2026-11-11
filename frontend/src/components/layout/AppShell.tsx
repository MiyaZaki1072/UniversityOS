import { useMemo, useState } from 'react'
import { Cloud, CloudOff, LoaderCircle, X } from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { DATA_MODE } from '../../lib/api'
import { useAppData } from '../../lib/store'
import { ImportDialog } from '../import/ImportDialog'
import { Drawer } from '../ui/Overlay'
import { useReminders } from '../../lib/reminders'
import { CommandPalette, useCommandPaletteHotkey } from '../search/CommandPalette'
import { AppHeader } from './AppHeader'
import { ReminderPanel } from './ReminderPanel'
import { AppSidebar, SidebarContent } from './AppSidebar'
import { MobileNav } from './MobileNav'
import { findNavItem } from './nav'

/**
 * Application shell: fixed department sidebar (desktop), sticky header,
 * bottom tab bar + drawer (mobile).
 *
 * TODO(api): the user comes from GET /auth/me/.
 */
export function AppShell() {
  const { pathname } = useLocation()
  const { data, db, openImport, me, sync, notice, dismissNotice, syncNow } = useAppData()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const usesPlanner = DATA_MODE === 'local' || DATA_MODE === 'server'
  const reminders = useReminders(db)
  const courseMap = useMemo(() => new Map(db.courses.map((c) => [c.id, { code: c.code, color: c.color }])), [db.courses])
  useCommandPaletteHotkey(() => setSearchOpen(true))
  const toggleBell = () => {
    setBellOpen((o) => !o)
    reminders.markAllSeen()
  }
  const page = findNavItem(pathname)

  const semester = data?.active_semester ?? null
  const today = data?.date ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-surface focus:px-3 focus:py-2 focus:border focus:border-accent"
      >
        Skip to content
      </a>

      <AppSidebar semester={semester} today={today} />

      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title="Navigation" dark>
        <SidebarContent semester={semester} today={today} onNavigate={() => setMenuOpen(false)} />
      </Drawer>

      <div className="lg:pl-[264px] flex flex-col min-h-dvh">
        <AppHeader
          pageTitle={page.title}
          pageCode={page.code}
          semesterName={semester?.name ?? null}
          today={today}
          userInitial={(me?.display_name ?? 'U').charAt(0).toUpperCase()}
          status={DATA_MODE === 'server' ? <SyncChip state={sync} onRetry={syncNow} /> : undefined}
          notifications={usesPlanner ? reminders.unseen : 0}
          onSearch={usesPlanner ? () => setSearchOpen(true) : undefined}
          onBell={usesPlanner ? toggleBell : undefined}
          bellPanel={bellOpen ? <ReminderPanel reminders={reminders.due} courses={courseMap} onClose={() => setBellOpen(false)} /> : undefined}
          onImport={openImport}
          onOpenMenu={() => setMenuOpen(true)}
        />
        <main id="main" key={pathname} className="flex-1 animate-page-in px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-28 lg:pb-12">
          <div className="max-w-[1240px] mx-auto">
            {notice && (
              <div role="status" className="mb-4 flex items-start gap-3 p-3 border-[1.5px] border-mustard bg-mustard-wash rounded-xs text-[13.5px] text-ink">
                <p className="flex-1">{notice}</p>
                <button onClick={dismissNotice} className="p-0.5 text-ink-muted hover:text-ink" aria-label="Dismiss">
                  <X size={16} />
                </button>
              </div>
            )}
            <Outlet />
          </div>
        </main>
      </div>

      <MobileNav onMore={() => setMenuOpen(true)} />
      <ImportDialog />
      {usesPlanner && <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />}
    </div>
  )
}

/** Save state for server mode: saved / saving / offline. */
function SyncChip({ state, onRetry }: { state: 'saved' | 'saving' | 'offline' | 'error'; onRetry: () => void }) {
  const look = {
    saved: { icon: <Cloud size={15} />, label: 'Saved', cls: 'text-ink-muted' },
    saving: { icon: <LoaderCircle size={15} className="animate-spin" />, label: 'Saving…', cls: 'text-ink-muted' },
    offline: { icon: <CloudOff size={15} />, label: 'Offline', cls: 'text-mustard-ink' },
    error: { icon: <CloudOff size={15} />, label: 'Not saved', cls: 'text-danger' },
  }[state]
  const content = (
    <>
      {look.icon}
      <span className="hidden sm:inline micro !text-current">{look.label}</span>
    </>
  )
  const cls = `h-9 px-2 inline-flex items-center gap-1.5 rounded-xs ${look.cls}`
  if (state === 'offline' || state === 'error')
    return (
      <button onClick={onRetry} className={`${cls} hover:bg-surface-2`} title={`${look.label} — changes stay on this device. Tap to retry.`} aria-label={`${look.label}. Retry saving`}>
        {content}
      </button>
    )
  return (
    <Link to="/settings" className={cls} title={look.label} aria-label={look.label}>
      {content}
    </Link>
  )
}
