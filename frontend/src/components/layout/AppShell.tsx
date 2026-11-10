import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAppData } from '../../lib/store'
import { ImportDialog } from '../import/ImportDialog'
import { Drawer } from '../ui/Overlay'
import { AppHeader } from './AppHeader'
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
  const { data, openImport } = useAppData()
  const [menuOpen, setMenuOpen] = useState(false)
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
          userInitial="F"
          notifications={2}
          onImport={openImport}
          onOpenMenu={() => setMenuOpen(true)}
        />
        <main id="main" key={pathname} className="flex-1 animate-page-in px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-28 lg:pb-12">
          <div className="max-w-[1240px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <MobileNav onMore={() => setMenuOpen(true)} />
      <ImportDialog />
    </div>
  )
}
