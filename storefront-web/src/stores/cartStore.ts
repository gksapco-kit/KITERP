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
