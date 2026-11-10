import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { AppDataProvider } from './lib/store'
import { allNavItems } from './components/layout/nav'
import { Dashboard } from './pages/Dashboard'
import { PlaceholderPage } from './pages/PlaceholderPage'

// The single-file design preview has no server routing, so it uses hash URLs.
const Router = import.meta.env.MODE === 'preview' ? HashRouter : BrowserRouter

export default function App() {
  return (
    <AppDataProvider>
    <Router>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          {allNavItems
            .filter((i) => i.path !== '/')
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
