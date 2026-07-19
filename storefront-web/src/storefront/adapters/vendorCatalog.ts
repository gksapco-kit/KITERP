/**
 * Bridges store catalog + cart APIs to StorefrontDataAdapter for live
 * /store/:slug catalog-template home pages.
 */
import { storeApi } from '@/api/store'
import type { Product as StoreProduct, Cart as StoreCart, CartItem, Service as StoreService } from '@/types'
import { resolveServicePrice, resolveServiceDuration } from '@/lib/servicePricing'
import { resolveServiceThumbnailUrl } from '@/lib/productImageUtils'
import type {
  Cart,
  CartLine,
  Category,
  ListProductsParams,
  ListProductsResult,
  Money,
  Product,
  ServiceItem,
  ServiceProvider,
  StorefrontDataAdapter,
} from '../types'
import type { AddToCartInput } from '../types'

function toMinor(amountMajor: number, currency: string): Money {
  const amt = Number.isFinite(amountMajor) ? Math.round(amountMajor * 100) : 0
  return { amount: amt, currency: currency || 'INR' }
}

function fromMinor(m: Money): number {
  return m.amount / 100
}

function mapStoreProduct(p: StoreProduct): Product {
  const currency = p.currency || 'INR'
  const imgs = (p.images?.length ? p.images : []).map((im) => ({
    url: im.url,
    alt: im.alt_text || p.name,
  }))
  if (imgs.length === 0) {
    imgs.push({
      url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=600&q=60',
      alt: p.name,
    })
  }

  const activeVars = (p.variants || []).filter((v) => v.is_active !== false)
  const variants =
    activeVars.length > 0
      ? activeVars.map((v) => ({
          id: v.id,
          name: v.name,
          options: v.attributes || {},
          price: toMinor(v.price ?? 0, v.currency || currency),
          compareAtPrice:
            v.compare_at_price != null ? toMinor(v.compare_at_price, v.currency || currency) : undefined,
          inStock: (v.stock_status ?? 'in_stock') !== 'out_of_stock',
        }))
      : [
          {
            id: `${p.id}-default`,
            name: 'Default',
            options: {},
            price: toMinor(p.price ?? 0, currency),
            inStock: (p.stock_status ?? 'in_stock') !== 'out_of_stock',
          },
        ]

  const badges: string[] = []
  if (p.is_new_arrival) badges.push('New')
  if (p.offer_label) badges.push(p.offer_label)

  return {
    id: p.id,
    slug: p.slug,
    title: p.name,
    subtitle: p.short_description || p.category || undefined,
    description: p.description || p.short_description || '',
    brand: p.brand,
    categoryIds: [],
    images: imgs,
    variants,
    rating:
      p.avg_rating != null
        ? { value: p.avg_rating, count: p.review_count ?? 0 }
        : undefined,
    badges: badges.length ? badges : undefined,
  }
}

function mapCartLine(item: CartItem, index: number, currency: string): CartLine {
  return {
    id: String(index),
    productId: item.product_id,
    variantId: item.variant_id || item.product_id,
    quantity: item.qty,
    name: item.name,
    imageUrl: item.image_url,
    unitPrice: toMinor(item.price, currency),
    inStock: true,
  }
}

function mapStoreCart(c: StoreCart): Cart {
  const currency = 'INR'
  const lines = (c.items || []).map((it, i) => mapCartLine(it, i, currency))
  const sub = toMinor(c.subtotal ?? 0, currency)
  return {
    id: c.id || 'cart',
    lines,
    subtotal: sub,
    total: sub,
  }
}

export const vendorCatalogAdapter: StorefrontDataAdapter = {
  async listCategories(): Promise<Category[]> {
    const res = await storeApi.listCategories()
    return (res.categories || []).map((c) => ({
      id: c.id,
      slug: c.slug || c.id,
      name: c.name,
      description: c.description,
    }))
  },

  async listProducts(params?: ListProductsParams): Promise<ListProductsResult> {
    const q: Record<string, unknown> = { limit: params?.limit ?? 48 }
    if (params?.query) q.search = params.query
    if (params?.categorySlug) q.category = params.categorySlug
    const res = await storeApi.listProducts(q)
    const items = (res.items || []).map(mapStoreProduct)
    return { items, total: res.total ?? items.length }
  },

  async getProduct(slug: string): Promise<Product | null> {
    try {
      const p = await storeApi.getProduct(slug)
      return mapStoreProduct(p)
    } catch {
      return null
    }
  },

  async getCart(): Promise<Cart> {
    try {
      const c = await storeApi.getCart()
      return mapStoreCart(c)
    } catch {
      return {
        id: 'local',
        lines: [],
        subtotal: { amount: 0, currency: 'INR' },
        total: { amount: 0, currency: 'INR' },
      }
    }
  },

  async addToCart(input: AddToCartInput & { cartId?: string }): Promise<Cart> {
    const c = await storeApi.addToCart({
      product_id: input.productId,
      name: input.variantLabel ? `${input.name} — ${input.variantLabel}` : input.name,
      qty: input.quantity,
      price: fromMinor(input.unitPrice),
      image_url: input.imageUrl,
    })
    return mapStoreCart(c)
  },

  async updateCartLine(input: { cartId: string; lineId: string; quantity: number }): Promise<Cart> {
    const idx = Number.parseInt(input.lineId, 10)
    if (!Number.isFinite(idx) || idx < 0) {
      return vendorCatalogAdapter.getCart()
    }
    const c = await storeApi.updateCartItem(idx, input.quantity)
    return mapStoreCart(c)
  },

  async removeCartLine(input: { cartId: string; lineId: string }): Promise<Cart> {
    const idx = Number.parseInt(input.lineId, 10)
    if (!Number.isFinite(idx) || idx < 0) {
      return vendorCatalogAdapter.getCart()
    }
    const c = await storeApi.removeCartItem(idx)
    return mapStoreCart(c)
  },

  async listServices(): Promise<ServiceItem[]> {
    try {
      const res = await storeApi.listServices({ limit: 48 })
      return (res.items || []).map((s: StoreService) => {
        const thumb = resolveServiceThumbnailUrl({
          image_url: s.image_url,
          media: s.media,
          gallery: s.gallery,
        })
        return {
          id: s.id,
          slug: s.slug,
          name: s.name,
          description: s.short_description || s.description || '',
          durationMinutes: resolveServiceDuration(s),
          price: toMinor(resolveServicePrice(s), s.currency || 'INR'),
          image: thumb ? { url: thumb, alt: s.name } : undefined,
          providerIds: [],
        }
      })
    } catch {
      return []
    }
  },

  async listProviders(): Promise<ServiceProvider[]> {
    return []
  },
}
