import type { LiveItem } from '@/blocks/registry'
import type { Product, Service } from '@/types'
import { formatLiveProductPrice } from '@/lib/liveProductUtils'
import { resolveProductThumbnailUrl } from '@/lib/productImageUtils'

function primaryImageUrl(images: { url: string; is_primary?: boolean }[] | undefined): string | null {
  if (!images?.length) return null
  const primary = images.find(img => img.is_primary) || images[0]
  return primary?.url || null
}

export function catalogProductToLiveItem(product: Product): LiveItem {
  const currency = product.currency || 'INR'
  return {
    id: product.id,
    title: product.name,
    subtitle: product.brand || product.short_description || null,
    description: product.description || null,
    image_url: resolveProductThumbnailUrl({ images: product.images, variants: product.variants }),
    price: product.price,
    price_formatted: formatLiveProductPrice(product.price, currency),
    url: `/products/${product.slug}`,
    meta: {
      slug: product.slug,
      category: product.category,
      stock_status: product.stock_status,
      currency,
      compare_at_price: product.compare_at_price,
      is_on_sale: product.is_on_sale,
      is_featured: product.is_featured,
    },
  }
}

export function catalogServiceToLiveItem(service: Service): LiveItem {
  const currency = service.currency || 'INR'
  const price = service.price ?? service.price_min ?? 0
  const imageUrl = service.image_url
    || primaryImageUrl(service.media)
    || service.gallery?.[0]
    || null
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
    },
  }
}
