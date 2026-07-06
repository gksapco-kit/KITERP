import { getBackendHealthUrl } from '@/lib/apiBase'

export { getBackendHealthUrl }

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function pingHealth(timeoutMs: number): Promise<boolean> {
  const url = getBackendHealthUrl()
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const r = await fetch(url, { method: 'GET', signal: ac.signal, cache: 'no-store' })
    return r.ok
  } catch {
    return false
  } finally {
    clearTimeout(t)
  }
}

/** Wait until FastAPI /health responds (retries while Docker/uvicorn reloads in dev). */
export async function checkBackendReachable(options?: {
  timeoutMs?: number
  retries?: number
  retryDelayMs?: number
}): Promise<boolean> {
  const timeoutMs = options?.timeoutMs ?? 5000
  const retries = options?.retries ?? (import.meta.env.DEV ? 4 : 2)
  const retryDelayMs = options?.retryDelayMs ?? 1500

  for (let attempt = 0; attempt < retries; attempt += 1) {
    if (await pingHealth(timeoutMs)) return true
    if (attempt < retries - 1) {
      await sleep(retryDelayMs)
    }
  }
  return false
}
