import { create } from 'zustand'
import { storeApi } from '../api/store'
import type { Cart, CartItem } from '../types'

export type CartLineInput = {
  product_id: string
  variant_id?: string
  name: string
  qty: number
  price: number
  image_url?: string
}

function lineKey(productId: string, variantId?: string | null) {
  return `${productId}::${variantId || ''}`
}

function qtyMapFromItems(items: CartItem[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const item of items) {
    if (!item.product_id) continue
    const key = lineKey(item.product_id, item.variant_id)
    map[key] = (map[key] || 0) + (item.qty || 0)
  }
  return map
}

function itemCountOf(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + (i.qty || 0), 0)
}

function applyCart(cart: Cart | null) {
  const items = cart?.items || []
  return {
    items,
    qtyByKey: qtyMapFromItems(items),
    itemCount: cart?.item_count || itemCountOf(items),
    mode: 'server' as const,
  }
}

function applyLocal(items: CartItem[]) {
  return {
    items,
    qtyByKey: qtyMapFromItems(items),
    itemCount: itemCountOf(items),
    mode: 'guest' as const,
  }
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
  /** guest = local cart (no login); server = API cart */
  mode: 'guest' | 'server'
  items: CartItem[]
  qtyByKey: Record<string, number>
  itemCount: number
  loading: boolean
  getQty: (productId: string, variantId?: string | null) => number
  loadCart: (authenticated: boolean) => Promise<void>
  clearLocal: () => void
  /** Add without requiring login (guest local cart or server cart). */
  addProduct: (item: CartLineInput, authenticated: boolean) => Promise<void>
  setProductQty: (
    productId: string,
    variantId: string | undefined,
    qty: number,
    authenticated: boolean,
    addItem?: CartLineInput,
  ) => Promise<void>
  updateLineQty: (index: number, qty: number, authenticated: boolean) => Promise<void>
  removeLine: (index: number, authenticated: boolean) => Promise<void>
  /** After login: push guest lines to server cart, then load server cart. */
  mergeGuestIntoServer: () => Promise<void>
}

export const useCartStore = create<CartState>((set, get) => ({
  mode: 'guest',
  items: [],
  qtyByKey: {},
  itemCount: 0,
  loading: false,

  getQty: (productId, variantId) =>
    get().qtyByKey[lineKey(productId, variantId)] || 0,

  clearLocal: () => set({ ...applyLocal([]), mode: 'guest' }),

  loadCart: async (authenticated) => {
    if (!authenticated) {
      // Keep existing guest lines; just ensure mode is guest
      const { items, mode } = get()
      if (mode !== 'guest') set(applyLocal(items))
      return
    }
    set({ loading: true })
    try {
      const cart = await storeApi.getCart()
      set(applyCart(cart))
    } catch {
      // Keep guest lines if server cart fails
      const { items } = get()
      set({ ...applyLocal(items), loading: false })
      return
    }
    set({ loading: false })
  },

  addProduct: async (item, authenticated) => {
    if (!authenticated) {
      const items = [...get().items]
      const idx = findLineIndex(items, item.product_id, item.variant_id)
      if (idx >= 0) {
        items[idx] = {
          ...items[idx],
          qty: items[idx].qty + item.qty,
          price: item.price,
          image_url: item.image_url || items[idx].image_url,
        }
      } else {
        items.push({ ...item })
      }
      set(applyLocal(items))
      return
    }

    const cart = await storeApi.addToCart(item)
    set(applyCart(cart))
  },

  setProductQty: async (productId, variantId, qty, authenticated, addItem) => {
    if (!authenticated) {
      const items = [...get().items]
      const index = findLineIndex(items, productId, variantId)
      if (qty <= 0) {
        if (index >= 0) items.splice(index, 1)
        set(applyLocal(items))
        return
      }
      if (index < 0) {
        if (!addItem) return
        items.push({ ...addItem, qty })
      } else {
        items[index] = { ...items[index], qty }
      }
      set(applyLocal(items))
      return
    }

    const { items } = get()
    const index = findLineIndex(items, productId, variantId)

    if (qty <= 0) {
      if (index < 0) return
      const cart = await storeApi.removeCartItem(index)
      set(applyCart(cart))
      return
    }

    if (index < 0) {
      if (!addItem) return
      const cart = await storeApi.addToCart({ ...addItem, qty })
      set(applyCart(cart))
      return
    }

    const cart = await storeApi.updateCartItem(index, qty)
    set(applyCart(cart))
  },

  updateLineQty: async (index, qty, authenticated) => {
    if (!authenticated) {
      const items = [...get().items]
      if (index < 0 || index >= items.length) return
      if (qty <= 0) items.splice(index, 1)
      else items[index] = { ...items[index], qty }
      set(applyLocal(items))
      return
    }
    const cart = await storeApi.updateCartItem(index, qty)
    set(applyCart(cart))
  },

  removeLine: async (index, authenticated) => {
    if (!authenticated) {
      const items = [...get().items]
      if (index < 0 || index >= items.length) return
      items.splice(index, 1)
      set(applyLocal(items))
      return
    }
    const cart = await storeApi.removeCartItem(index)
    set(applyCart(cart))
  },

  mergeGuestIntoServer: async () => {
    const guestItems = get().mode === 'guest' ? [...get().items] : []
    for (const item of guestItems) {
      if (!item.product_id) continue
      try {
        await storeApi.addToCart({
          product_id: item.product_id,
          variant_id: item.variant_id,
          name: item.name,
          qty: item.qty,
          price: item.price,
          image_url: item.image_url,
        })
      } catch (e) {
        console.error('merge guest cart line failed', e)
      }
    }
    const cart = await storeApi.getCart()
    set(applyCart(cart))
  },
}))
