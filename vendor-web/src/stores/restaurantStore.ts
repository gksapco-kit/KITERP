import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RestaurantOutlet } from '@/types'

interface RestaurantState {
  /** The restaurant outlet currently selected (scopes Floor, Kitchen, Setup, Reservations, Reports). */
  selectedRestaurant: RestaurantOutlet | null
  setSelectedRestaurant: (r: RestaurantOutlet | null) => void
}

export const useRestaurantStore = create<RestaurantState>()(
  persist(
    (set) => ({
      selectedRestaurant: null,
      setSelectedRestaurant: (r) => set({ selectedRestaurant: r }),
    }),
    {
      name: 'restaurant-store-data',
      partialize: (state) => ({ selectedRestaurant: state.selectedRestaurant }),
    }
  )
)
