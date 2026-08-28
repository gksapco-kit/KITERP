import { create } from 'zustand'
import type { Cart } from '@/types'

interface CartState {
  cart: Cart | null
  setCart: (cart: Cart | null) => void
  itemCount: () => number
}

export const useCartStore = create<CartState>((set, get) => ({
  cart: null,
  setCart: (cart) => set({ cart }),
  itemCount: () => get().cart?.items?.reduce((sum, i) => sum + i.qty, 0) || 0,
}))

/** Qty used by the header badge — ignore ghost lines with no qty / no item ref. */
export function countCartItems(cart: Cart | null | undefined): number {
  if (!cart?.items?.length) return 0
  return cart.items.reduce((sum, item) => {
    const qty = Number(item.qty)
    if (!Number.isFinite(qty) || qty <= 0) return sum
    const hasRef = Boolean(
      item.product_id || item.service_id || (typeof item.name === 'string' && item.name.trim()),
    )
    if (!hasRef) return sum
    return sum + qty
  }, 0)
}

export function selectCartItemCount(state: CartState): number {
  return countCartItems(state.cart)
}
