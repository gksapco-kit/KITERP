import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_KIT_ERP_THEME_ID, type KitErpThemeId } from '@/lib/kitErpThemes'

/** Dashboard layout/visual template. 'default' = classic, 'template2' = soft-canvas look. */
export type KitErpLayoutTemplate = 'default' | 'template2'

export const DEFAULT_KIT_ERP_LAYOUT: KitErpLayoutTemplate = 'default'

interface ThemeState {
  dark: boolean
  colorTheme: KitErpThemeId
  layoutTemplate: KitErpLayoutTemplate
  setDark: (dark: boolean) => void
  toggleDark: () => void
  setColorTheme: (theme: KitErpThemeId) => void
  setLayoutTemplate: (template: KitErpLayoutTemplate) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      dark: false,
      colorTheme: DEFAULT_KIT_ERP_THEME_ID,
      layoutTemplate: DEFAULT_KIT_ERP_LAYOUT,
      setDark: (dark) => set({ dark }),
      toggleDark: () => set({ dark: !get().dark }),
      setColorTheme: (colorTheme) => set({ colorTheme }),
      setLayoutTemplate: (layoutTemplate) => set({ layoutTemplate }),
    }),
    { name: 'vendor-ui-theme' },
  ),
)
