function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

/**
 * Base URL for storefront → FastAPI (`/api/v1/...`).
 * In Vite dev, default to same-origin `/api/v1` so requests use the dev-server proxy
 * (avoids CORS when the UI is on localhost:3002 and the API is on :8000).
 */
export function getStorefrontApiBaseUrl(): string {
  if (import.meta.env.DEV) {
    return '/api/v1'
  }

  const fallback = '/api/v1'
  const raw = import.meta.env.VITE_API_URL
  const candidate =
    raw != null && String(raw).trim() !== ''
      ? String(raw).replace(/\/$/, '')
      : fallback

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
