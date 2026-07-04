import { normalizeLoopbackInUrl, normalizeLoopbackOrigin } from '@/lib/loopbackHost'

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

/**
 * Base URL for storefront → FastAPI (`/api/v1/...`).
 * In Vite dev, default to same-origin `/api/v1` so requests use the dev-server proxy
 * (avoids CORS when the UI is on localhost:3002 and the API is on :8000).
 * On a public host, never call localhost/127.0.0.1 even if the Docker build baked in dev defaults.
 */
export function getStorefrontApiBaseUrl(): string {
  if (import.meta.env.DEV) {
    return '/api/v1'
  }

  const fallback = '/api/v1'
  const raw = import.meta.env.VITE_API_URL
  const candidate = normalizeLoopbackInUrl(
    raw != null && String(raw).trim() !== ''
      ? String(raw).replace(/\/$/, '')
      : fallback,
  )

  if (typeof window === 'undefined') return candidate

  if (isLoopbackHostname(window.location.hostname)) return candidate
  if (candidate.startsWith('/')) return candidate

  try {
    if (isLoopbackHostname(new URL(candidate).hostname)) return fallback
  } catch {
    return fallback
  }
  return candidate
}

/**
 * Origin for `/uploads/...` and other backend-served static paths.
 * On production (e.g. kiterp.com), nginx proxies `/uploads/` on the same host — never use localhost.
 */
export function getBackendOrigin(): string {
  if (import.meta.env.DEV) {
    const fromEnv = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim()
    if (fromEnv) return normalizeLoopbackOrigin(fromEnv.replace(/\/$/, ''))
    const api = (import.meta.env.VITE_API_URL as string | undefined)?.trim()
    if (api) {
      return normalizeLoopbackOrigin(api.replace(/\/api\/v1\/?$/, '').replace(/\/$/, ''))
    }
    return 'http://127.0.0.1:8000'
  }

  const api = getStorefrontApiBaseUrl()
  if (api.startsWith('/')) {
    if (typeof window !== 'undefined') return window.location.origin
    return ''
  }

  try {
    const origin = normalizeLoopbackOrigin(new URL(api).origin)
    if (
      typeof window !== 'undefined'
      && !isLoopbackHostname(window.location.hostname)
      && isLoopbackHostname(new URL(origin).hostname)
    ) {
      return window.location.origin
    }
    return origin
  } catch {
    if (typeof window !== 'undefined') return window.location.origin
    return ''
  }
}
