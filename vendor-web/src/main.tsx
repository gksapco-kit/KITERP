import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'

import { router } from './routes'
import { ThemeSync } from './components/ThemeSync'
import './styles/globals.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
  },
})

// Handle token handoff from storefront vendor signup
;(() => {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token')
  const refresh = params.get('refresh')
  if (token) {
    localStorage.setItem('access_token', token)
    if (refresh) localStorage.setItem('refresh_token', refresh)
    const stored = localStorage.getItem('vendor-auth-storage')
    try {
      const parsed = stored ? JSON.parse(stored) : { state: {} }
      parsed.state = { ...parsed.state, accessToken: token, refreshToken: refresh || parsed.state?.refreshToken, isAuthenticated: true }
      localStorage.setItem('vendor-auth-storage', JSON.stringify(parsed))
    } catch { /* ignore */ }
    window.history.replaceState({}, '', window.location.pathname)
  }
})()

console.log('%c🏪 VENDOR-WEB (Port 3001)', 'color: #10b981; font-size: 16px; font-weight: bold;')
console.log('This is the vendor dashboard application')

// Preflight: validate stored token BEFORE rendering so we never show the
// infinite loading spinner when the session has expired.
async function preflight() {
  const token = localStorage.getItem('access_token')
  if (!token) return
  const API = import.meta.env.VITE_API_URL || '/api/v1'
  try {
    const res = await fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    })
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('vendor-auth-storage')
      localStorage.removeItem('vendor-store-data')
    }
  } catch {
    // network error / timeout — clear to be safe
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('vendor-auth-storage')
    localStorage.removeItem('vendor-store-data')
  }
}

preflight()
  .catch(() => {
    /* Never block boot — preflight is best-effort session hygiene */
  })
  .then(() => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <ThemeSync />
          <RouterProvider router={router} />
          <Toaster position="top-right" richColors />
        </QueryClientProvider>
      </React.StrictMode>,
    )
  })
