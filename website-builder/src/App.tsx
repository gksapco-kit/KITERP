import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { BuilderPage } from './pages/BuilderPage'
import { LiveSiteLayout } from './pages/LiveSitePage'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { TemplatesManagerPage } from './pages/TemplatesManagerPage'

const routerBasename = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || undefined

function App() {
  return (
    <BrowserRouter basename={routerBasename}>
      <div className="flex h-full min-h-0 w-full flex-col">
        <Routes>
          <Route path="/index.html" element={<Navigate to="/" replace />} />
          <Route path="/site/*" element={<LiveSiteLayout />} />
          <Route path="/login" element={<LoginPage homePath="/" signupPath="/signup" />} />
          <Route path="/signup" element={<SignupPage homePath="/" loginPath="/login" />} />
          <Route path="/templates" element={<TemplatesManagerPage />} />
          <Route path="/*" element={<BuilderPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
