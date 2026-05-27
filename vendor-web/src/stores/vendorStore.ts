import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Vendor } from '@/types'

export interface SelectedStore {
  id: string
  name: string
  code?: string
  description?: string
}

interface VendorState {
  vendor: Vendor | null
  setVendor: (vendor: Vendor | null) => void
  clearVendor: () => void
  selectedStore: SelectedStore | null
  setSelectedStore: (store: SelectedStore | null) => void
  /** ID of the store the user has starred as their favourite — auto-selected on every login. */
  favouriteStoreId: string | null
  setFavouriteStoreId: (id: string | null) => void
}

export const useVendorStore = create<VendorState>()(
  persist(
    (set) => ({
      vendor: null,
      setVendor: (vendor) => set({ vendor }),
      clearVendor: () => set({ vendor: null, selectedStore: null, favouriteStoreId: null }),
      selectedStore: null,
      setSelectedStore: (store) => set({ selectedStore: store }),
      favouriteStoreId: null,
      setFavouriteStoreId: (id) => set({ favouriteStoreId: id }),
    }),
    {
      name: 'vendor-store-data',
      partialize: (state) => ({
        vendor: state.vendor,
        selectedStore: state.selectedStore,
        favouriteStoreId: state.favouriteStoreId,
      }),
    }
  )
)
