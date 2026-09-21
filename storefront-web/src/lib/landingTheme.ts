import { useCallback, useSyncExternalStore } from 'react'
import { safeLocalGet, safeLocalSet } from '@/lib/safeStorage'

export const LANDING_THEME_KEY = 'kiterp-landing-theme'
export type LandingTheme = 'light' | 'dark'

const listeners = new Set<() => void>()

function readStored(): LandingTheme {
  return safeLocalGet(LANDING_THEME_KEY) === 'dark' ? 'dark' : 'light'
}

let current: LandingTheme = typeof window === 'undefined' ? 'light' : readStored()

function emit() {
  listeners.forEach((listener) => listener())
}

export function applyLandingThemeAttr(theme: LandingTheme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-kiterp-landing-theme', theme)
  document.querySelectorAll('.kiterp-landing').forEach((el) => {
    el.setAttribute('data-kiterp-theme', theme)
  })
}

export function getLandingTheme() {
  return current
}

export function setLandingTheme(theme: LandingTheme) {
  if (theme !== 'light' && theme !== 'dark') return
  current = theme
  safeLocalSet(LANDING_THEME_KEY, theme)
  applyLandingThemeAttr(theme)
  emit()
}

if (typeof window !== 'undefined') {
  current = readStored()
  applyLandingThemeAttr(current)
}

export function useLandingTheme() {
  const theme = useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange)
      return () => listeners.delete(onStoreChange)
    },
    () => current,
    () => 'light' as LandingTheme,
  )

  const setTheme = useCallback((next: LandingTheme) => {
    setLandingTheme(next)
  }, [])

  return [theme, setTheme] as const
}
