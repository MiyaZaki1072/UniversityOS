import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { DATA_MODE } from './lib/api'
import { AppDataProvider, useAppData } from './lib/store'
import { AnalyticsPage } from './pages/Analytics'
import { CourseDetailPage, CoursesPage } from './pages/Courses'
import { Dashboard } from './pages/Dashboard'
import { GradebookCoursePage, GradebookPage } from './pages/Gradebook'
import { HabitsPage } from './pages/Habits'
import { LoginPage } from './pages/Login'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { ResourcesPage } from './pages/Resources'
import { SettingsPage } from './pages/Settings'
import { StudyPage } from './pages/Study'
import { TasksPage } from './pages/Tasks'
import { TimetablePage } from './pages/Timetable'

// Without a server (design preview, static hosting) there's no history fallback, so use hash URLs.
const Router = DATA_MODE === 'api' ? BrowserRouter : HashRouter

export default function App() {
  return (
    <AppDataProvider>
      <Gate />
    </AppDataProvider>
  )
}

/** Server mode needs a signed-in user before the app opens. */
function Gate() {
  const { auth } = useAppData()
  if (auth !== 'ready') return <LoginPage />
  return (
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
          <Route path="habits" element={<HabitsPage />} />
          <Route path="study" element={<StudyPage />} />
          <Route path="resources" element={<ResourcesPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<PlaceholderPage />} />
        </Route>
      </Routes>
    </Router>
  )
}
