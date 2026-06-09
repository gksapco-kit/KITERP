import { normalizeLoopbackInUrl, normalizeLoopbackOrigin } from '@/lib/loopbackHost'

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

/**
 * Resolve the browser-facing API base URL (`/api/v1` or absolute URL).
 * In production on a public host, never call localhost/127.0.0.1 even if the
 * Docker build baked in dev defaults.
 */
export function resolveApiBaseUrl(): string {
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
