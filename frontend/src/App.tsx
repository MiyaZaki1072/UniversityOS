import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { DATA_MODE } from './lib/api'
import { AppDataProvider } from './lib/store'
import { allNavItems } from './components/layout/nav'
import { CourseDetailPage, CoursesPage } from './pages/Courses'
import { Dashboard } from './pages/Dashboard'
import { GradebookCoursePage, GradebookPage } from './pages/Gradebook'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { SettingsPage } from './pages/Settings'
import { TasksPage } from './pages/Tasks'
import { TimetablePage } from './pages/Timetable'

// Without a server (design preview, static hosting) there's no history fallback, so use hash URLs.
const Router = DATA_MODE === 'api' ? BrowserRouter : HashRouter

const built = ['/', '/calendar', '/courses', '/gradebook', '/tasks', '/settings']

export default function App() {
  return (
    <AppDataProvider>
      <Router>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="calendar" element={<TimetablePage />} />
            <Route path="courses" element={<CoursesPage />} />
            <Route path="courses/:id" element={<CourseDetailPage />} />
            <Route path="gradebook" element={<GradebookPage />} />
            <Route path="gradebook/:id" element={<GradebookCoursePage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="settings" element={<SettingsPage />} />
            {allNavItems
              .filter((i) => !built.includes(i.path))
              .map((i) => (
                <Route key={i.path} path={i.path} element={<PlaceholderPage />} />
              ))}
            <Route path="*" element={<PlaceholderPage />} />
          </Route>
        </Routes>
      </Router>
    </AppDataProvider>
  )
}
