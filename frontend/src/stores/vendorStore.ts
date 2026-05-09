import { create } from 'zustand'
import type { Vendor } from '@/types/vendor'

interface VendorState {
  vendor: Vendor | null
  setVendor: (vendor: Vendor | null) => void
  updateVendor: (updates: Partial<Vendor>) => void
}

export const useVendorStore = create<VendorState>((set) => ({
  vendor: null,
  setVendor: (vendor) => set({ vendor }),
  updateVendor: (updates) =>
    set((state) => ({
      vendor: state.vendor ? { ...state.vendor, ...updates } : null,
    })),
}))
