import { NavLink } from 'react-router-dom'
import { Emblem } from './Emblem'
import { navGroups, settingsItem, type NavItem } from './nav'

export interface SemesterInfo {
  name: string
  start_date: string
  end_date: string
}

function semesterProgress(s: SemesterInfo, today: string) {
  const start = new Date(s.start_date).getTime()
  const end = new Date(s.end_date).getTime()
  const now = new Date(today).getTime()
  const totalWeeks = Math.ceil((end - start) / (7 * 86_400_000))
  const week = Math.min(totalWeeks, Math.max(1, Math.floor((now - start) / (7 * 86_400_000)) + 1))
  return { week, totalWeeks, ratio: Math.min(1, Math.max(0, (now - start) / (end - start))) }
}

function NavRow({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.path}
      end
      onClick={onNavigate}
      className={({ isActive }) =>
        'group relative flex items-center gap-3 h-10 pl-5 pr-4 text-[14px] transition-colors duration-[var(--dur-fast)] ' +
        (isActive
          ? 'bg-walnut-2 text-on-walnut before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:bg-accent'
          : 'text-on-walnut-muted hover:text-on-walnut hover:bg-walnut-2/60')
      }
    >
      {({ isActive }) => (
        <>
          <span className={`tabular text-[10.5px] w-5 ${isActive ? 'text-mustard' : 'text-on-walnut-muted/70'}`}>
            {item.code}
          </span>
          <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
          <span>{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

interface SidebarContentProps {
  semester: SemesterInfo | null
  today: string
  onNavigate?: () => void
}

/** The department navigation panel. Rendered fixed on desktop, inside a Drawer on mobile. */
export function SidebarContent({ semester, today, onNavigate }: SidebarContentProps) {
  const progress = semester ? semesterProgress(semester, today) : null

  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5 border-b border-walnut-rule">
        <div className="flex items-center gap-3 text-on-walnut">
          <Emblem size={38} />
          <div className="leading-tight">
            <div className="font-display text-[17px] font-semibold tracking-[0.14em]">UNIVERSITY OS</div>
            <div className="font-mono text-[9.5px] tracking-[0.16em] text-on-walnut-muted mt-0.5">
              ACADEMIC RECORDS DIVISION
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav aria-label="Main" className="flex-1 overflow-y-auto py-3">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-3">
            <div className="px-5 pt-2 pb-1.5 font-mono text-[10px] tracking-[0.18em] uppercase text-on-walnut-muted/80">
              {group.label}
            </div>
            {group.items.map((item) => (
              <NavRow key={item.path} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </nav>

      {/* Active semester */}
      {semester && progress && (
        <div className="mx-4 mb-3 p-3.5 border border-walnut-rule rounded-xs bg-walnut-2/50">
          <div className="font-mono text-[10px] tracking-[0.16em] text-on-walnut-muted">CURRENT SEMESTER</div>
          <div className="mt-1 font-display text-[15px] text-on-walnut">{semester.name}</div>
          <div className="mt-2.5 h-1.5 bg-walnut rounded-[1px] overflow-hidden">
            <div className="h-full bg-mustard" style={{ width: `${progress.ratio * 100}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between tabular text-[11px] text-on-walnut-muted">
            <span>
              WEEK {progress.week} / {progress.totalWeeks}
            </span>
            <span>{Math.round(progress.ratio * 100)}%</span>
          </div>
        </div>
      )}

      <div className="border-t border-walnut-rule py-2">
        <NavRow item={settingsItem} onNavigate={onNavigate} />
        <div className="flex items-center gap-2 px-5 pt-2 pb-2 font-mono text-[10px] tracking-[0.14em] text-on-walnut-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-sage" aria-hidden="true" />
          SYSTEM STATUS: OPERATIONAL
        </div>
      </div>
    </div>
  )
}

export function AppSidebar(props: SidebarContentProps) {
  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[264px] bg-walnut border-r border-walnut-rule z-30 flex-col">
      <SidebarContent {...props} />
    </aside>
  )
}
