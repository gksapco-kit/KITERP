import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
        const idx = items.findIndex((i) => {
          if (item.service_id && !item.product_id) {
            return i.service_id === item.service_id && !i.product_id
          }
          return i.product_id === item.product_id && i.variant_id === item.variant_id
        })
        if (idx >= 0) {
          items[idx] = { ...items[idx], qty: items[idx].qty + item.qty, price: item.price }
        } else {
          items.push(item)
        }
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
    { name: 'guest-cart-storage' },
  ),
)
