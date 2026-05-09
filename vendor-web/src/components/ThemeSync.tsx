import { useEffect } from 'react'
import { useThemeStore } from '@/stores/themeStore'

/** Keeps `document.documentElement` in sync with persisted dashboard dark mode. */
export function ThemeSync() {
  const dark = useThemeStore((s) => s.dark)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  return null
}
