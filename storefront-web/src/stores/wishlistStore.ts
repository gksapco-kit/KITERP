import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import type { WishlistItem } from '@/kit/types'
import { vendorSlugFromLocation } from '@/lib/vendorScope'

interface WishlistState {
  items: WishlistItem[]
  add: (item: WishlistItem) => void
  remove: (id: string) => void
  has: (id: string) => boolean
  toggle: (item: WishlistItem) => void
}

/** Persist each vendor's wishlist under its own key so live tabs do not merge. */
const vendorScopedStorage: StateStorage = {
  getItem: (name) => {
    const slug = vendorSlugFromLocation() || 'default'
    return localStorage.getItem(`${name}:${slug}`)
  },
  setItem: (name, value) => {
    const slug = vendorSlugFromLocation() || 'default'
    localStorage.setItem(`${name}:${slug}`, value)
  },
  removeItem: (name) => {
    const slug = vendorSlugFromLocation() || 'default'
    localStorage.removeItem(`${name}:${slug}`)
  },
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
    {
      name: 'kiterp-wishlist',
      storage: createJSONStorage(() => vendorScopedStorage),
    },
  ),
)
