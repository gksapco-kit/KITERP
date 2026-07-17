/**
 * Recently-viewed product tracking — backed by localStorage so it works
 * without a customer login.
 *
 * Keys are per vendor slug so two live tabs on the same origin do not merge lists.
 */
import type { LiveItem } from '@/blocks/registry'
import { vendorSlugFromLocation } from '@/lib/vendorScope'

const STORAGE_PREFIX = 'kiterp_recently_viewed'
const LEGACY_STORAGE_KEY = 'kiterp_recently_viewed'
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

function storageKey(vendorSlug?: string | null): string {
  const slug = (vendorSlug || vendorSlugFromLocation() || 'default').trim() || 'default'
  return `${STORAGE_PREFIX}:${slug}`
}

function read(vendorSlug?: string | null): RecentlyViewedItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(storageKey(vendorSlug))
    if (!raw) {
      // One-time: ignore legacy unscoped list (mixed vendors) rather than migrate.
      if (!vendorSlug && !vendorSlugFromLocation()) {
        const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY)
        if (legacy) {
          const parsed = JSON.parse(legacy)
          return Array.isArray(parsed) ? (parsed as RecentlyViewedItem[]) : []
        }
      }
      return []
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as RecentlyViewedItem[]) : []
  } catch {
    return []
  }
}

function write(items: RecentlyViewedItem[], vendorSlug?: string | null): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(vendorSlug), JSON.stringify(items.slice(0, MAX_ITEMS)))
  } catch {
    /* quota / serialization — ignore */
  }
}

/** Push a product onto the recently-viewed list (deduped by id). */
export function trackView(
  item: {
    id?: string | null
    title: string
    url?: string | null
    image_url?: string | null
    price?: number | null
    currency?: string | null
  },
  vendorSlug?: string | null,
): void {
  if (!item.id || !item.title) return
  const id = String(item.id)
  const existing = read(vendorSlug).filter(i => i.id !== id)
  const next: RecentlyViewedItem = {
    id,
    title: item.title,
    url: item.url ?? null,
    image_url: item.image_url ?? null,
    price: item.price ?? null,
    currency: item.currency ?? null,
    viewed_at: new Date().toISOString(),
  }
  write([next, ...existing], vendorSlug)
}

export function getRecent(limit = 6, vendorSlug?: string | null): LiveItem[] {
  return read(vendorSlug)
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

export function clearRecent(vendorSlug?: string | null): void {
  write([], vendorSlug)
}
