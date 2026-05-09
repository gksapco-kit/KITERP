/**
 * Bridges the project's storefront data types to the ERP UI Kit types.
 * All kit components consume these mapped types; keep API calls in page hooks.
 */
import type { Product as StoreProduct, ServiceItem } from '@/storefront/types'
import type { Customer, Order as AppOrder, CartItem } from '@/types/index'
import type { Product, CartLine, Service, Order, AccountUser, WishlistItem } from './types'

/** Minor units (paise/cents) → major units (rupees/dollars) */
function fromMinor(amount: number): number {
  return amount / 100
}

export function bridgeProduct(p: StoreProduct): Product {
  const firstVariant = p.variants?.[0]
  const price = firstVariant ? fromMinor(firstVariant.price.amount) : 0
  const compareAtPrice = firstVariant?.compareAtPrice ? fromMinor(firstVariant.compareAtPrice.amount) : undefined
  const currency = firstVariant?.price.currency ?? 'INR'
  return {
    id: p.id,
    slug: p.slug,
    name: p.title,
    price,
    compareAtPrice,
    currency,
    image: p.images?.[0]?.url ?? 'https://placehold.co/600x600?text=No+Image',
    images: p.images?.map((i) => i.url),
    rating: p.rating?.value,
    reviewCount: p.rating?.count,
    tags: p.tags,
    inStock: p.variants?.some((v) => v.inStock) ?? true,
    description: p.description,
    variants: p.variants?.map((v) => ({
      id: v.id,
      label: v.name,
      value: v.id,
      available: v.inStock,
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
    avatarUrl: undefined,
  }
}

export function bridgeWishlistItem(p: Product, savedAt: string): WishlistItem {
  return { ...p, savedAt }
}
