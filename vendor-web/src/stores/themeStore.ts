import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ThemeState {
  dark: boolean
  setDark: (dark: boolean) => void
  toggleDark: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      dark: false,
      setDark: (dark) => set({ dark }),
      toggleDark: () => set({ dark: !get().dark }),
    }),
    { name: 'vendor-ui-theme' },
  ),
)
