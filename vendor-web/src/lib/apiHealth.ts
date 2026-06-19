import { getBackendHealthUrl } from '@/lib/apiBase'

export { getBackendHealthUrl } from '@/lib/apiBase'

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
