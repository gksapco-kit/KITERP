import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WishlistItem } from '@/kit/types'

interface WishlistState {
  items: WishlistItem[]
  add: (item: WishlistItem) => void
  remove: (id: string) => void
  has: (id: string) => boolean
  toggle: (item: WishlistItem) => void
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) =>
        set((s) => ({
          items: s.items.some((i) => i.id === item.id) ? s.items : [...s.items, item],
        })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      has: (id) => get().items.some((i) => i.id === id),
      toggle: (item) => {
        if (get().has(item.id)) get().remove(item.id)
        else get().add(item)
      },
    }),
    { name: 'kiterp-wishlist' },
  ),
)
