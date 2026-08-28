import type { LiveItem } from '@/blocks/registry'
import type { Product, ProductVariant, Service } from '@/types'
import { formatLiveProductPrice } from '@/lib/liveProductUtils'
import { resolveServicePrice } from '@/lib/servicePricing'
import { resolveProductThumbnailUrl, resolveServiceThumbnailUrl } from '@/lib/productImageUtils'

function isLiveCatalogId(id: string | null | undefined): boolean {
  const value = String(id ?? '')
  return Boolean(value) && !value.startsWith('ph-') && !value.startsWith('wl-showcase-')
}

export function catalogProductToLiveItem(product: Product): LiveItem {
  const currency = product.currency || 'INR'
  const variants = (product.variants || []).filter(v => v.is_active !== false)
  const variantPrices = variants.map(v => v.price).filter(p => p > 0)
  const effectivePrice =
    product.price > 0
      ? product.price
      : variantPrices.length > 0
        ? Math.min(...variantPrices)
        : product.price
  const variantComparePrices = variants
    .map(v => v.compare_at_price)
    .filter((p): p is number => p != null && p > 0)
  const effectiveCompareAt =
    product.compare_at_price ??
    (variantComparePrices.length > 0 ? Math.min(...variantComparePrices) : undefined)

  return {
    id: product.id,
    title: product.name,
    subtitle: product.brand || product.short_description || null,
    description: product.description || null,
    image_url: resolveProductThumbnailUrl({ images: product.images, variants: product.variants }),
    price: effectivePrice,
    price_formatted: formatLiveProductPrice(effectivePrice, currency),
    url: `/products/${product.slug}`,
    meta: {
      slug: product.slug,
      category: product.category,
      stock_status: product.stock_status,
      quantity: product.quantity,
      track_inventory: product.track_inventory,
      allow_backorders: product.allow_backorders,
      currency,
      compare_at_price: effectiveCompareAt,
      is_on_sale: product.is_on_sale,
      is_featured: product.is_featured,
      view_count: product.view_count ?? 0,
      tags: product.tags || [],
      brand: product.brand,
      uom: product.uom,
      variants,
      images: product.images || [],
    },
  }
}

/** Rebuild a catalog Product from a live feed item so homepage cards can reuse ProductCard. */
export function liveItemToCatalogProduct(item: LiveItem): Product | null {
  if (!isLiveCatalogId(item.id)) return null
  if ((item.meta as Record<string, unknown> | undefined)?.is_category_showcase) return null

  const meta = (item.meta || {}) as Record<string, unknown>
  const slugFromUrl = String(item.url || '').match(/\/products\/([^/?#]+)/)?.[1]
  const slug = String(meta.slug ?? '').trim() || slugFromUrl || ''
  if (!slug) return null

  const variants = Array.isArray(meta.variants)
    ? (meta.variants as ProductVariant[]).filter((v) => v && v.is_active !== false)
    : []
  const images = Array.isArray(meta.images)
    ? (meta.images as Product['images'])
    : item.image_url
      ? [{ id: `${item.id}-img`, url: item.image_url, alt_text: item.title, is_primary: true }]
      : []

  return {
    id: String(item.id),
    name: item.title,
    slug,
    description: item.description || undefined,
    short_description: item.subtitle || undefined,
    brand: (meta.brand as string) || item.subtitle || undefined,
    category: (meta.category as string) || undefined,
    tags: Array.isArray(meta.tags) ? (meta.tags as string[]) : [],
    uom: (meta.uom as string) || undefined,
    price: Number(item.price ?? 0),
    compare_at_price: meta.compare_at_price != null ? Number(meta.compare_at_price) : undefined,
    currency: String(meta.currency || 'INR'),
    stock_status: String(meta.stock_status || 'in_stock'),
    quantity: meta.quantity != null ? Number(meta.quantity) : undefined,
    track_inventory: meta.track_inventory as boolean | undefined,
    allow_backorders: meta.allow_backorders as boolean | undefined,
    is_featured: Boolean(meta.is_featured),
    is_on_sale: Boolean(meta.is_on_sale),
    view_count: meta.view_count != null ? Number(meta.view_count) : 0,
    images,
    variants,
    status: 'active',
  }
}

export function catalogServiceToLiveItem(service: Service): LiveItem {
  const currency = service.currency || 'INR'
  const price = resolveServicePrice(service)
  const imageUrl = resolveServiceThumbnailUrl({
    image_url: service.image_url,
    media: service.media,
    gallery: service.gallery,
  })
  return {
    id: service.id,
    title: service.name,
    subtitle: service.short_description || service.category || null,
    description: service.description || null,
    image_url: imageUrl,
    price,
    price_formatted: formatLiveProductPrice(price, currency),
    url: `/services/${service.slug}`,
    meta: {
      slug: service.slug,
      category: service.category,
      currency,
      allow_quote_request: service.allow_quote_request,
      requires_booking: service.requires_booking,
      duration_minutes: service.duration_minutes,
    },
  }
}
