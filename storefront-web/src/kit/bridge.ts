/**
 * Bridges the project's business front data types to the ERP UI Kit types.
 * All kit components consume these mapped types; keep API calls in page hooks.
 */
import type { Product as StoreProduct, ServiceItem } from '@/storefront/types'
import type { Customer, Order as AppOrder, CartItem } from '@/types/index'
import type { Product, CartLine, Service, Order, AccountUser, WishlistItem } from './types'
import {
  collectProductGalleryImages,
  resolveProductThumbnailUrl,
} from '@/lib/productImageUtils'

/** Minor units (paise/cents) → major units (rupees/dollars) */
function fromMinor(amount: number): number {
  return amount / 100
}

export function bridgeProduct(p: StoreProduct): Product {
  const variants = p.variants ?? []
  const extendedVariants = variants as Array<
    StoreProduct['variants'][number] & {
      media?: { url: string; media_type?: string; is_primary?: boolean; alt_text?: string }[]
    }
  >
  const firstVariant = variants[0]
  const variantPrices = variants.map((v) => fromMinor(v.price.amount))
  const minPrice = variantPrices.length ? Math.min(...variantPrices) : 0
  const maxPrice = variantPrices.length ? Math.max(...variantPrices) : 0
  const basePrice = firstVariant ? fromMinor(firstVariant.price.amount) : 0
  const showFromPrice = variants.length > 1 && (minPrice !== maxPrice || basePrice === 0)
  const price = showFromPrice ? minPrice : basePrice
  const compareAtPrice = firstVariant?.compareAtPrice ? fromMinor(firstVariant.compareAtPrice.amount) : undefined
  const currency = firstVariant?.price.currency ?? 'INR'
  const galleryImages = collectProductGalleryImages({
    images: (p.images || []).map((img) => ({ url: img.url, alt_text: img.alt })),
    variants: extendedVariants,
  })
  const thumbnail = resolveProductThumbnailUrl({
    images: (p.images || []).map((img) => ({ url: img.url, alt_text: img.alt })),
    variants: extendedVariants,
  })
  return {
    id: p.id,
    slug: p.slug,
    name: p.title,
    price,
    compareAtPrice,
    currency,
    image: thumbnail ?? '',
    images: galleryImages.length
      ? galleryImages.map((img) => ({ url: img.url, alt_text: img.alt_text }))
      : p.images?.map((i) => ({ url: i.url, alt_text: i.alt })),
    rating: p.rating?.value,
    reviewCount: p.rating?.count,
    tags: p.tags,
    inStock: variants.some((v) => v.inStock) || variants.length === 0,
    description: p.description,
    track_inventory: (p as { track_inventory?: boolean }).track_inventory,
    allow_backorders: (p as { allow_backorders?: boolean }).allow_backorders,
    quantity: (p as { quantity?: number }).quantity,
    stock_status: (p as { stock_status?: string }).stock_status,
    showFromPrice,
    variants: extendedVariants.map((v) => ({
      id: v.id,
      label: v.name,
      value: v.id,
      available: v.inStock,
      color: (v as { color?: string }).color,
      attributes: v.options ?? (v as { attributes?: Record<string, string> }).attributes,
      media: v.media,
      price: fromMinor(v.price.amount),
      compareAtPrice: v.compareAtPrice ? fromMinor(v.compareAtPrice.amount) : undefined,
      quantity: (v as { quantity?: number }).quantity,
      track_inventory: (v as { track_inventory?: boolean }).track_inventory,
      allow_backorders: (v as { allow_backorders?: boolean }).allow_backorders,
      stock_status: (v as { stock_status?: string }).stock_status,
    })),
  }
}

export function bridgeCartLine(item: CartItem, index: number): CartLine {
  return {
    id: String(index),
    productId: item.product_id,
    name: item.name,
    image: item.image_url ?? 'https://placehold.co/80x80?text=Item',
    price: item.price,
    qty: item.qty,
    variant: item.variant_id ?? undefined,
  }
}

export function bridgeService(s: ServiceItem): Service {
  const priceAmount = s.price?.amount ?? 0
  const currency = s.price?.currency ?? 'INR'
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    shortDescription: s.description,
    description: s.description,
    image: s.image?.url,
    durationMinutes: s.durationMinutes,
    price: fromMinor(priceAmount),
    currency,
  }
}

export function bridgeOrder(o: AppOrder): Order {
  return {
    id: o.id,
    number: o.order_number ?? o.id,
    placedAt: (o as any).created_at ?? '',
    total: o.total ?? 0,
    status: (o.status ?? 'pending') as Order['status'],
    itemsCount: o.items?.length ?? 0,
  }
}

export function bridgeCustomer(c: Customer): AccountUser {
  return {
    id: c.id,
    name: c.full_name ?? c.email ?? c.id,
    email: c.email ?? '',
    phone: c.phone ?? undefined,
    avatarUrl: c.avatar_url ?? undefined,
  }
}

export function bridgeWishlistItem(p: Product, savedAt: string): WishlistItem {
  return { ...p, savedAt }
}
