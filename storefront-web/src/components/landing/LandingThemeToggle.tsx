import { useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'
import { applyLandingThemeAttr, useLandingTheme } from '@/lib/landingTheme'

export function LandingThemeToggle() {
  const [theme, setTheme] = useLandingTheme()
  const isDark = theme === 'dark'

  useEffect(() => {
    applyLandingThemeAttr(theme)
  }, [theme])

  const nextTheme = isDark ? 'light' : 'dark'
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme'
  const Icon = isDark ? Moon : Sun

  return (
    <button
      type="button"
      className="kiterp-theme-toggle shrink-0"
      aria-label={label}
      title={label}
      aria-pressed={isDark}
      onClick={() => setTheme(nextTheme)}
    >
      <Icon className="kiterp-theme-toggle-icon" strokeWidth={2} aria-hidden />
    </button>
  )
}
