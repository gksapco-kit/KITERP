import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { isServiceCartItem } from '@/lib/serviceCart'
import { safeLocalStateStorage } from '@/lib/safeStorage'

export type GuestCartItem = {
  product_id?: string
  service_id?: string
  item_type?: 'product' | 'service'
  variant_id?: string
  variant_label?: string
  slug?: string
  name: string
  qty: number
  price: number
  image_url?: string
}

type GuestCartState = {
  byVendor: Record<string, GuestCartItem[]>
  getItems: (vendorSlug: string) => GuestCartItem[]
  addItem: (vendorSlug: string, item: GuestCartItem) => void
  setItems: (vendorSlug: string, items: GuestCartItem[]) => void
  updateQty: (vendorSlug: string, index: number, qty: number) => void
  removeItem: (vendorSlug: string, index: number) => void
  clear: (vendorSlug: string) => void
}

export const useGuestCartStore = create<GuestCartState>()(
  persist(
    (set, get) => ({
      byVendor: {},
      getItems: (vendorSlug) => get().byVendor[vendorSlug] ?? [],
      addItem: (vendorSlug, item) => {
        const items = [...(get().byVendor[vendorSlug] ?? [])]
        if (isServiceCartItem(item)) {
          const products = items.filter((i) => !isServiceCartItem(i))
          products.push({ ...item, qty: 1 })
          set({ byVendor: { ...get().byVendor, [vendorSlug]: products } })
          return
        }
        const idx = items.findIndex((i) =>
          i.product_id === item.product_id && i.variant_id === item.variant_id,
        )
        if (idx >= 0) {
          items[idx] = { ...items[idx], qty: items[idx].qty + item.qty, price: item.price }
        } else {
          items.push(item)
        }
        set({ byVendor: { ...get().byVendor, [vendorSlug]: items } })
      },
      setItems: (vendorSlug, items) => {
        set({ byVendor: { ...get().byVendor, [vendorSlug]: items } })
      },
      updateQty: (vendorSlug, index, qty) => {
        const items = [...(get().byVendor[vendorSlug] ?? [])]
        if (index < 0 || index >= items.length) return
        if (qty <= 0) items.splice(index, 1)
        else items[index] = { ...items[index], qty }
        set({ byVendor: { ...get().byVendor, [vendorSlug]: items } })
      },
      removeItem: (vendorSlug, index) => {
        get().updateQty(vendorSlug, index, 0)
      },
      clear: (vendorSlug) => {
        const next = { ...get().byVendor }
        delete next[vendorSlug]
        set({ byVendor: next })
      },
    }),
    {
      name: 'guest-cart-storage',
      storage: createJSONStorage(() => safeLocalStateStorage),
    },
  ),
)
