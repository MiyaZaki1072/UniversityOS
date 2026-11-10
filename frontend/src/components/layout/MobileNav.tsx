import { MoreHorizontal } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { allNavItems, mobilePrimary } from './nav'

/** Bottom tab bar for phones. Secondary destinations open the full drawer via "More". */
export function MobileNav({ onMore }: { onMore: () => void }) {
  const items = allNavItems.filter((i) => mobilePrimary.includes(i.path))
  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-walnut border-t border-walnut-rule pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end
                className={({ isActive }) =>
                  'relative flex flex-col items-center justify-center gap-1 h-[60px] text-[11px] ' +
                  (isActive
                    ? 'text-on-walnut before:absolute before:top-0 before:left-4 before:right-4 before:h-[3px] before:bg-accent'
                    : 'text-on-walnut-muted')
                }
              >
                <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                {item.label === 'Dashboard' ? 'Briefing' : item.label}
              </NavLink>
            </li>
          )
        })}
        <li>
          <button
            onClick={onMore}
            className="w-full flex flex-col items-center justify-center gap-1 h-[60px] text-[11px] text-on-walnut-muted"
          >
            <MoreHorizontal size={20} aria-hidden="true" />
            More
          </button>
        </li>
      </ul>
    </nav>
  )
}
