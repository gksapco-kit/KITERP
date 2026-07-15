/**
 * In `npm run dev`, always use same-origin `/api/v1` so Vite proxies to the backend.
 * Mirrors frontend/src/api/client.ts — kept separate to avoid circular imports with authSession.
 */
function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

export function resolveApiBaseUrl(): string {
  if (import.meta.env.DEV) {
    return '/api/v1'
  }
  const fallback = '/api/v1'
  const fromEnv = import.meta.env.VITE_API_URL
  const candidate =
    typeof fromEnv === 'string' && fromEnv.trim()
      ? fromEnv.trim().replace(/\/$/, '')
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
