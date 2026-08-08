import { create } from 'zustand'
import { storeApi } from '../api/store'
import type { Cart, CartItem } from '../types'

function lineKey(productId: string, variantId?: string | null) {
  return `${productId}::${variantId || ''}`
}

function qtyMapFromCart(cart: Cart | null): Record<string, number> {
  const map: Record<string, number> = {}
  for (const item of cart?.items || []) {
    if (!item.product_id) continue
    const key = lineKey(item.product_id, item.variant_id)
    map[key] = (map[key] || 0) + (item.qty || 0)
  }
  return map
}

function findLineIndex(
  items: CartItem[],
  productId: string,
  variantId?: string | null,
): number {
  return items.findIndex(
    (i) =>
      i.product_id === productId &&
      (i.variant_id || '') === (variantId || ''),
  )
}

interface CartState {
  items: CartItem[]
  qtyByKey: Record<string, number>
  itemCount: number
  loading: boolean
  getQty: (productId: string, variantId?: string | null) => number
  loadCart: () => Promise<void>
  clearLocal: () => void
  addProduct: (item: {
    product_id: string
    variant_id?: string
    name: string
    qty: number
    price: number
    image_url?: string
  }) => Promise<void>
  setProductQty: (
    productId: string,
    variantId: string | undefined,
    qty: number,
    addItem?: {
      product_id: string
      variant_id?: string
      name: string
      qty: number
      price: number
      image_url?: string
    },
  ) => Promise<void>
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  qtyByKey: {},
  itemCount: 0,
  loading: false,

  getQty: (productId, variantId) =>
    get().qtyByKey[lineKey(productId, variantId)] || 0,

  clearLocal: () => set({ items: [], qtyByKey: {}, itemCount: 0 }),

  loadCart: async () => {
    set({ loading: true })
    try {
      const cart = await storeApi.getCart()
      set({
        items: cart.items || [],
        qtyByKey: qtyMapFromCart(cart),
        itemCount: cart.item_count || cart.items?.length || 0,
      })
    } catch {
      set({ items: [], qtyByKey: {}, itemCount: 0 })
    } finally {
      set({ loading: false })
    }
  },

  addProduct: async (item) => {
    const cart = await storeApi.addToCart(item)
    set({
      items: cart.items || [],
      qtyByKey: qtyMapFromCart(cart),
      itemCount: cart.item_count || cart.items?.length || 0,
    })
  },

  setProductQty: async (productId, variantId, qty, addItem) => {
    const { items } = get()
    const index = findLineIndex(items, productId, variantId)

    if (qty <= 0) {
      if (index < 0) return
      const cart = await storeApi.removeCartItem(index)
      set({
        items: cart.items || [],
        qtyByKey: qtyMapFromCart(cart),
        itemCount: cart.item_count || cart.items?.length || 0,
      })
      return
    }

    if (index < 0) {
      if (!addItem) return
      const cart = await storeApi.addToCart({ ...addItem, qty })
      set({
        items: cart.items || [],
        qtyByKey: qtyMapFromCart(cart),
        itemCount: cart.item_count || cart.items?.length || 0,
      })
      return
    }

    const cart = await storeApi.updateCartItem(index, qty)
    set({
      items: cart.items || [],
      qtyByKey: qtyMapFromCart(cart),
      itemCount: cart.item_count || cart.items?.length || 0,
    })
  },
}))
