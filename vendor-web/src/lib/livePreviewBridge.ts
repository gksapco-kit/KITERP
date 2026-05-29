/** In-memory cache on vendor :3001 — shared with storefront :3002 via window.opener postMessage. */

const STASH_LIVE_PREVIEW_MESSAGE = 'kiterp:stash-live-preview'
const LIVE_PREVIEW_REQUEST_MESSAGE = 'kiterp:live-preview-request'
const LIVE_PREVIEW_RESPONSE_MESSAGE = 'kiterp:live-preview-response'

const TTL_MS = 30 * 60 * 1000

export interface LivePreviewPayload {
  siteName: string
  siteConfig: Record<string, unknown>
  pages: unknown[]
  catalog: { products: unknown[]; services: unknown[] }
}

interface CacheEntry {
  payload: LivePreviewPayload
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()
const MAX_CACHE_ENTRIES = 5

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

function isLoopbackStorefrontOrigin(origin: string): boolean {
  try {
    const u = new URL(origin)
    return isLoopbackHost(u.hostname) && u.port === '3002'
  } catch {
    return false
  }
}

/** Same-origin, or loopback vendor host on the same port (localhost vs 127.0.0.1). */
export function isTrustedWebsiteBuilderMessageOrigin(origin: string): boolean {
  if (origin === window.location.origin) return true
  try {
    const u = new URL(origin)
    const self = new URL(window.location.href)
    return (
      u.protocol === self.protocol &&
      u.port === self.port &&
      isLoopbackHost(u.hostname) &&
      isLoopbackHost(self.hostname)
    )
  } catch {
    return false
  }
}

function readFromLocalStorage(key: string): LivePreviewPayload | null {
  try {
    const raw = localStorage.getItem(`kiterp-wb-live-preview:${key}`)
    if (!raw) return null
    const entry = JSON.parse(raw) as { payload: LivePreviewPayload; expiresAt: number }
    if (!entry?.payload?.pages?.length || !entry.payload.siteConfig) return null
    if (entry.expiresAt < Date.now()) return null
    return entry.payload
  } catch {
    return null
  }
}

function pruneExpiredCache(): void {
  const now = Date.now()
  for (const [k, entry] of cache) {
    if (entry.expiresAt < now) cache.delete(k)
  }
  while (cache.size > MAX_CACHE_ENTRIES) {
    const first = cache.keys().next().value
    if (!first) break
    cache.delete(first)
  }
}

const STORAGE_PREFIX = 'kiterp-wb-live-preview:'
const LOCAL_STORAGE_MAX_BYTES = 4_000_000

function pruneOldLivePreviewStorage(): void {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith(STORAGE_PREFIX)) keys.push(k)
  }
  keys.forEach((k) => localStorage.removeItem(k))
}

function writeToLocalStorage(key: string, payload: LivePreviewPayload): void {
  try {
    const json = JSON.stringify({ payload, expiresAt: Date.now() + TTL_MS })
    if (json.length > LOCAL_STORAGE_MAX_BYTES) return
    pruneOldLivePreviewStorage()
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, json)
  } catch {
    /* quota — in-memory cache still works when opener is available */
  }
}

function stashInCache(key: string, payload: LivePreviewPayload): void {
  pruneExpiredCache()
  cache.set(key, { payload, expiresAt: Date.now() + TTL_MS })
  writeToLocalStorage(key, payload)
}

function peekFromCache(key: string): LivePreviewPayload | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    cache.delete(key)
    return null
  }
  return entry.payload
}

export function handleLivePreviewMessage(event: MessageEvent): boolean {
  const { type, key, payload, url } = event.data ?? {}

  if (
    type === STASH_LIVE_PREVIEW_MESSAGE &&
    typeof key === 'string' &&
    payload &&
    isTrustedWebsiteBuilderMessageOrigin(event.origin)
  ) {
    stashInCache(key, payload as LivePreviewPayload)
    return true
  }

  if (
    type === LIVE_PREVIEW_REQUEST_MESSAGE &&
    typeof key === 'string' &&
    (event.origin === window.location.origin || isLoopbackStorefrontOrigin(event.origin))
  ) {
    const data = peekFromCache(key) ?? readFromLocalStorage(key)
    event.source?.postMessage(
      { type: LIVE_PREVIEW_RESPONSE_MESSAGE, key, payload: data },
      event.origin,
    )
    return true
  }

  return false
}

export { STASH_LIVE_PREVIEW_MESSAGE, LIVE_PREVIEW_REQUEST_MESSAGE, LIVE_PREVIEW_RESPONSE_MESSAGE }
