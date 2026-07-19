import type { LiveItem } from '@/blocks/registry'
import type { Product, Service } from '@/types'
import { formatLiveProductPrice } from '@/lib/liveProductUtils'
import { resolveProductThumbnailUrl, resolveServiceThumbnailUrl } from '@/lib/productImageUtils'

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
      currency,
      compare_at_price: effectiveCompareAt,
      is_on_sale: product.is_on_sale,
      is_featured: product.is_featured,
    },
  }
}

export function catalogServiceToLiveItem(service: Service): LiveItem {
  const currency = service.currency || 'INR'
  const price = service.price ?? service.price_min ?? 0
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
