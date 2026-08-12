import { create } from 'zustand'
import { storeApi } from '../api/store'
import type { Product } from '../types'
import { productImageUrl } from '../lib/mediaUrl'
import { getProductPricing } from '../lib/productPricing'

export type WishlistItem = {
  product_id: string
  variant_id?: string
  name: string
  price: number
  image_url?: string
  slug?: string
}

function keyOf(productId: string, variantId?: string | null) {
  return `${productId}::${variantId || ''}`
}

interface WishlistState {
  items: WishlistItem[]
  loading: boolean
  has: (productId: string, variantId?: string | null) => boolean
  load: (authenticated: boolean) => Promise<void>
  toggleProduct: (product: Product, authenticated: boolean) => Promise<void>
  removeProduct: (productId: string, authenticated: boolean) => Promise<void>
  clear: () => void
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  items: [],
  loading: false,

  has: (productId, _variantId) =>
    get().items.some((i) => i.product_id === productId),

  clear: () => set({ items: [] }),

  load: async (authenticated) => {
    if (!authenticated) return
    set({ loading: true })
    try {
      const data = await storeApi.getWishlist()
      set({ items: (data.items || []) as WishlistItem[] })
    } catch (e) {
      console.warn('[wishlist] load failed', e)
    } finally {
      set({ loading: false })
    }
  },

  toggleProduct: async (product, authenticated) => {
    const pricing = getProductPricing(product)
    const item: WishlistItem = {
      product_id: product.id,
      variant_id: pricing.variant?.id,
      name: product.name,
      price: pricing.price || Number(product.price) || 0,
      image_url: productImageUrl(product) || undefined,
      slug: product.slug,
    }

    if (authenticated) {
      try {
        const data = await storeApi.toggleWishlistItem(item)
        set({ items: (data.items || []) as WishlistItem[] })
        return
      } catch (e) {
        console.warn('[wishlist] toggle failed', e)
        throw e
      }
    }

    // Guest: local toggle
    const exists = get().items.some((i) => i.product_id === product.id)
    set({
      items: exists
        ? get().items.filter((i) => i.product_id !== product.id)
        : [...get().items, item],
    })
  },

  removeProduct: async (productId, authenticated) => {
    if (authenticated) {
      try {
        const data = await storeApi.removeWishlistItem(productId)
        if (Array.isArray((data as any)?.items)) {
          set({ items: (data as any).items as WishlistItem[] })
        } else {
          set({ items: get().items.filter((i) => i.product_id !== productId) })
        }
        return
      } catch (e) {
        console.warn('[wishlist] remove failed', e)
        throw e
      }
    }
    set({ items: get().items.filter((i) => i.product_id !== productId) })
  },
}))

export { keyOf as wishlistKey }
