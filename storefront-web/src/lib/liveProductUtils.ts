import type { LiveItem } from '@/blocks/registry'
import { imgUrl } from '@/lib/utils'

export function formatLiveProductPrice(price: number | null | undefined, currency = 'INR'): string | null {
  if (price == null || Number.isNaN(Number(price))) return null
  if (Number(price) <= 0) return null
  if (currency === 'INR') return `₹${Number(price).toLocaleString('en-IN')}`
  return `${currency} ${Number(price).toLocaleString('en-IN')}`
}

/** Resolve the price shown on catalog cards from live feed items. */
export function resolveLiveItemDisplayPrice(item: LiveItem): number | null {
  const meta = (item.meta || {}) as Record<string, unknown>
  const direct = item.price
  if (direct != null && Number(direct) > 0) return Number(direct)

  const labeled = normalizeLiveProductPriceLabel(item.price_formatted)
  if (labeled) {
    const amount = labeled.replace(/^₹/, '').replace(/,/g, '')
    const num = Number(amount)
    if (!Number.isNaN(num) && num > 0) return num
  }

  return direct != null && !Number.isNaN(Number(direct)) ? Number(direct) : null
}

/** Storefront path for a live catalog item (/products/{slug} or /services/{slug}). */
export function resolveLiveProductUrl(item: LiveItem): string | null {
  const rawUrl = item.url?.trim()
  if (rawUrl) return rawUrl

  const meta = (item.meta || {}) as Record<string, unknown>
  const slug = String(meta.slug ?? '').trim()
  if (slug) return `/products/${slug}`

  return null
}

/** Branch-aware storefront path for a catalog card link. */
export function resolveLiveCatalogStorePath(
  item: LiveItem,
  storePath: (p: string) => string,
): string | null {
  const rel = resolveLiveProductUrl(item)
  if (!rel) return null
  return storePath(rel)
}

export function normalizeLiveProductPriceLabel(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (/^INR\s+/i.test(trimmed)) {
    const amount = trimmed.replace(/^INR\s+/i, '').replace(/,/g, '')
    const num = Number(amount)
    if (!Number.isNaN(num)) return formatLiveProductPrice(num, 'INR')
  }
  return trimmed
}

export function normalizeLiveProduct(item: LiveItem): LiveItem {
  const meta = (item.meta || {}) as Record<string, unknown>
  const currency = String(meta.currency || 'INR')
  const image =
    item.image_url
    || (item as { image?: string }).image
    || (meta.image_url as string)
    || (meta.thumbnail_url as string)
    || null

  const resolvedPrice = resolveLiveItemDisplayPrice(item)
  const priceFormatted =
    formatLiveProductPrice(resolvedPrice, currency)
    || normalizeLiveProductPriceLabel(item.price_formatted)

  const productUrl = resolveLiveProductUrl(item)

  return {
    ...item,
    url: productUrl,
    image_url: image ? imgUrl(image) : null,
    subtitle: item.subtitle || (meta.brand as string) || null,
    description: item.description || (meta.short_description as string) || null,
    price: resolvedPrice ?? item.price,
    price_formatted: priceFormatted,
  }
}

export function normalizeLiveProducts(items: LiveItem[]): LiveItem[] {
  return items.map(normalizeLiveProduct)
}
