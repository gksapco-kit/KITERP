import { useEffect } from 'react'
import { DEFAULT_KIT_ERP_THEME_ID } from '@/lib/kitErpThemes'
import { DEFAULT_KIT_ERP_LAYOUT, useThemeStore } from '@/stores/themeStore'

/** Keeps `document.documentElement` in sync with persisted dashboard theme. */
export function ThemeSync() {
  const dark = useThemeStore((s) => s.dark)
  const colorTheme = useThemeStore((s) => s.colorTheme)
  const layoutTemplate = useThemeStore((s) => s.layoutTemplate)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', dark)
    root.dataset.kitTheme = colorTheme || DEFAULT_KIT_ERP_THEME_ID
    root.dataset.kitTemplate = layoutTemplate || DEFAULT_KIT_ERP_LAYOUT
  }, [dark, colorTheme, layoutTemplate])

  // Sync theme across browser tabs when changed in another tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'vendor-ui-theme') {
        void useThemeStore.persist.rehydrate()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return null
}
