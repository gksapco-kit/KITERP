import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'

import { router } from './routes'
import { ThemeSync } from './components/ThemeSync'
import { RootErrorBoundary } from './components/RootErrorBoundary'
import { useAuthStore } from './stores/authStore'
import { initGlobalEscapeHandler } from './lib/escapeCloseRegistry'
import { normalizeLoopbackInUrl } from './lib/loopbackHost'
import { DRAFT_BROWSER_PREVIEW_PATH } from './lib/storefrontPreviewUrl'
import './styles/globals.css'

initGlobalEscapeHandler()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
  },
})

// Handle token handoff from business front vendor signup (?token= access JWT on non-handoff routes).
// Do not treat /auth/handoff?token= as signup — that query param is a short-lived handoff JWT.
// Do not treat /preview/draft?token= as auth — that query param is a builder snapshot token.
function isDraftPreviewPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/'
  return path === DRAFT_BROWSER_PREVIEW_PATH
    || path.startsWith(`${DRAFT_BROWSER_PREVIEW_PATH}/`)
    || path === '/websites/browser-preview'
}

;(() => {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  // In dev, canonicalize loopback so cross-tab preview sync (localStorage) works on Windows.
  if (import.meta.env.DEV) {
    const host = window.location.hostname
    if (host === 'localhost' || host === '[::1]') {
      const url = new URL(window.location.href)
      url.hostname = '127.0.0.1'
      window.location.replace(url.toString())
      return
    }
  }
  if (path === '/auth/handoff') return
  if (isDraftPreviewPath(path)) return

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
console.log('Open http://localhost:3001 — if it fails on Windows Docker, run scripts\\fix-localhost-docker.ps1 as Admin.')

// Preflight: validate stored token in the background (clears stale auth if /auth/me fails).
async function preflight() {
  if (isDraftPreviewPath(window.location.pathname)) return
  const token = localStorage.getItem('access_token')
  if (!token) return
  const API = normalizeLoopbackInUrl(import.meta.env.VITE_API_URL || '/api/v1')
  const ac = new AbortController()
  const t = window.setTimeout(() => ac.abort(), 5000)
  try {
    const res = await fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ac.signal,
    })
    if (res.status === 401 || res.status === 403) {
      useAuthStore.getState().logout()
    }
  } catch {
    // network error / timeout — clear to be safe (must sync Zustand; localStorage-only breaks /login)
    useAuthStore.getState().logout()
  } finally {
    clearTimeout(t)
  }
}

// Do not chain render behind preflight — a slow or stuck /api proxy would leave a blank tab.
void preflight().catch(() => {
  /* best-effort session hygiene */
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeSync />
        <RouterProvider router={router} />
        <Toaster position="top-right" richColors closeButton />
      </QueryClientProvider>
    </RootErrorBoundary>
  </React.StrictMode>,
)
