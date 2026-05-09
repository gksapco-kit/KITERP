/**
 * Recently-viewed product tracking — backed by localStorage so it works
 * without a customer login.
 *
 * Storage shape: a small JSON array of `{ id, title, url, image_url, price, currency }`
 * trimmed to the most recent N entries (default 12). Newest first.
 *
 * Call `trackView(item)` from any product detail / card render to push an
 * item; call `getRecent(limit)` from `RecentlyViewedBlock` to read it.
 */
import type { LiveItem } from '@/blocks/registry'

const STORAGE_KEY = 'kiterp_recently_viewed'
const MAX_ITEMS = 24

export interface RecentlyViewedItem {
  id: string
  title: string
  url?: string | null
  image_url?: string | null
  price?: number | null
  currency?: string | null
  viewed_at: string
}

function read(): RecentlyViewedItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as RecentlyViewedItem[]) : []
  } catch {
    return []
  }
}

function write(items: RecentlyViewedItem[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
  } catch {
    /* quota / serialization — ignore */
  }
}

/** Push a product onto the recently-viewed list (deduped by id). */
export function trackView(item: { id?: string | null; title: string; url?: string | null; image_url?: string | null; price?: number | null; currency?: string | null }): void {
  if (!item.id || !item.title) return
  const id = String(item.id)
  const existing = read().filter(i => i.id !== id)
  const next: RecentlyViewedItem = {
    id,
    title: item.title,
    url: item.url ?? null,
    image_url: item.image_url ?? null,
    price: item.price ?? null,
    currency: item.currency ?? null,
    viewed_at: new Date().toISOString(),
  }
  write([next, ...existing])
}

export function getRecent(limit = 6): LiveItem[] {
  return read()
    .slice(0, limit)
    .map(i => ({
      id: i.id,
      title: i.title,
      subtitle: null,
      description: null,
      image_url: i.image_url ?? null,
      price: i.price ?? null,
      price_formatted: i.price != null ? `${i.currency || ''} ${i.price.toLocaleString()}`.trim() : null,
      rating: null,
      url: i.url ?? null,
      meta: { viewed_at: i.viewed_at, currency: i.currency },
    }))
}

export function clearRecent(): void {
  write([])
}
