/**
 * Resolve GET /health URL for the FastAPI app (root mount, not under /api/v1).
 * - Dev without VITE_API_URL: use same-origin /health (Vite proxy → backend :8000).
 * - VITE_API_URL=http://localhost:8000/api/v1: call http://127.0.0.1:8000/health on Windows Docker.
 */
import { normalizeLoopbackOrigin } from '@/lib/loopbackHost'

export function getBackendHealthUrl(): string {
  const v = import.meta.env.VITE_API_URL as string | undefined
  if (v && /^https?:\/\//.test(v.trim())) {
    try {
      const u = new URL(v.trim())
      return `${normalizeLoopbackOrigin(u.origin)}/health`
    } catch {
      return '/health'
    }
  }
  return '/health'
}

export async function checkBackendReachable(ms = 8000): Promise<boolean> {
  const url = getBackendHealthUrl()
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), ms)
  try {
    const r = await fetch(url, { method: 'GET', signal: ac.signal, cache: 'no-store' })
    return r.ok
  } catch {
    return false
  } finally {
    clearTimeout(t)
  }
}
