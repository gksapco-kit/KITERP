import { normalizeLoopbackInUrl, normalizeLoopbackOrigin } from '@/lib/loopbackHost'

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

/** True when the UI is opened on localhost / 127.0.0.1 (local Vite dev). */
function isBrowserOnLoopback(): boolean {
  if (typeof window === 'undefined') return false
  return isLoopbackHostname(window.location.hostname)
}

/**
 * Local dev: call FastAPI on :8000 directly instead of the Vite proxy.
 * The proxy can hang for 30s+ while Vite is busy with HMR (Windows + Docker),
 * which falsely triggers "API not reachable" on login even when the backend is healthy.
 * CORS is configured for 127.0.0.1:3001 → :8000 in backend/app/main.py.
 */
function shouldBypassViteProxy(): boolean {
  return import.meta.env.DEV && isBrowserOnLoopback()
}

/** Direct FastAPI origin in local dev (e.g. http://127.0.0.1:8000). */
export function getDevBackendOrigin(): string {
  const fromEnv = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim()
  if (fromEnv) return normalizeLoopbackOrigin(fromEnv.replace(/\/$/, ''))
  const api = (import.meta.env.VITE_API_URL as string | undefined)?.trim()
  if (api && !api.startsWith('/')) {
    try {
      return normalizeLoopbackOrigin(new URL(api).origin)
    } catch {
      /* fall through */
    }
  }
  return 'http://127.0.0.1:8000'
}

/**
 * Resolve the browser-facing API base URL (`/api/v1` or absolute URL).
 * In production on a public host, never call localhost/127.0.0.1 even if the
 * Docker build baked in dev defaults.
 */
export function resolveApiBaseUrl(): string {
  if (shouldBypassViteProxy()) {
    return `${getDevBackendOrigin()}/api/v1`
  }
  if (import.meta.env.DEV) {
    return '/api/v1'
  }

  const fallback = '/api/v1'
  const configured = (import.meta.env.VITE_API_URL as string | undefined)?.trim()
  const candidate = normalizeLoopbackInUrl(configured || fallback)

  if (typeof window === 'undefined') {
    return candidate.startsWith('/') ? candidate : fallback
  }

  if (isLoopbackHostname(window.location.hostname)) {
    return candidate
  }

  if (candidate.startsWith('/')) {
    return candidate
  }

  try {
    if (isLoopbackHostname(new URL(candidate).hostname)) {
      return fallback
    }
  } catch {
    return fallback
  }

  return candidate
}

/** FastAPI root health check (not under /api/v1). */
export function getBackendHealthUrl(): string {
  if (shouldBypassViteProxy()) {
    return `${getDevBackendOrigin()}/health`
  }
  const api = resolveApiBaseUrl()
  if (api.startsWith('/')) {
    return '/health'
  }
  try {
    const u = new URL(api)
    return `${normalizeLoopbackOrigin(u.origin)}/health`
  } catch {
    return '/health'
  }
}
