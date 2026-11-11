import {
  BarChart3,
  BookOpenText,
  CalendarDays,
  ClipboardList,
  FolderSearch,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  NotebookPen,
  Settings,
  Timer,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  code: string
  label: string
  /** Page title shown in the header / breadcrumbs. */
  title: string
  path: string
  icon: LucideIcon
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    label: 'Records',
    items: [
      { code: '01', label: 'Dashboard', title: "Today's Briefing", path: '/', icon: LayoutDashboard },
      { code: '02', label: 'Calendar', title: 'Temporal Scheduling', path: '/calendar', icon: CalendarDays },
      { code: '03', label: 'Courses', title: 'Academic Records', path: '/courses', icon: BookOpenText },
      { code: '04', label: 'Gradebook', title: 'Academic Ledger', path: '/gradebook', icon: NotebookPen },
      { code: '10', label: 'Transcript', title: 'Transcript', path: '/semesters', icon: GraduationCap },
    ],
  },
  {
    label: 'Operations',
    items: [
      { code: '05', label: 'Tasks', title: 'Work Queue', path: '/tasks', icon: ClipboardList },
      { code: '06', label: 'Habits', title: 'Daily Protocol', path: '/habits', icon: ListChecks },
      { code: '07', label: 'Study Sessions', title: 'Activity Log', path: '/study', icon: Timer },
    ],
  },
  {
    label: 'Directory',
    items: [
      { code: '08', label: 'Resource Hub', title: 'Internal Directory', path: '/resources', icon: FolderSearch },
      { code: '09', label: 'Analytics', title: 'Semester Report', path: '/analytics', icon: BarChart3 },
    ],
  },
]

export const settingsItem: NavItem = {
  code: '00',
  label: 'Settings',
  title: 'System Settings',
  path: '/settings',
  icon: Settings,
}

export const allNavItems: NavItem[] = [...navGroups.flatMap((g) => g.items), settingsItem]

/** Items shown in the mobile bottom bar; the rest live behind "More". */
export const mobilePrimary = ['/', '/calendar', '/courses', '/tasks']

export function findNavItem(pathname: string): NavItem {
  return (
    allNavItems.find((i) => i.path === pathname) ??
    allNavItems.find((i) => i.path !== '/' && pathname.startsWith(`${i.path}/`)) ??
    allNavItems[0]
  )
}
