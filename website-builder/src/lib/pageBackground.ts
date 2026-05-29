import type { CSSProperties } from 'react'
import type { Page, PageBackground, PageBackgroundMode } from '../types/builder'

export const DEFAULT_PAGE_BACKGROUND: PageBackground = {
  mode: 'solid',
  backgroundColor: '#ffffff',
  gradientFrom: '#4f46e5',
  gradientTo: '#ec4899',
}

export function resolvePageBackground(page?: Page): PageBackground {
  if (!page?.background) return { ...DEFAULT_PAGE_BACKGROUND }
  return {
    ...DEFAULT_PAGE_BACKGROUND,
    ...page.background,
    mode: page.background.mode ?? DEFAULT_PAGE_BACKGROUND.mode,
  }
}

export function pageBackgroundStyle(page?: Page): CSSProperties {
  const bg = resolvePageBackground(page)
  if (bg.mode === 'gradient') {
    const from = bg.gradientFrom ?? DEFAULT_PAGE_BACKGROUND.gradientFrom!
    const to = bg.gradientTo ?? DEFAULT_PAGE_BACKGROUND.gradientTo!
    return {
      backgroundColor: 'transparent',
      backgroundImage: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
      backgroundSize: 'cover',
      backgroundAttachment: 'local',
    }
  }
  return {
    backgroundColor: bg.backgroundColor ?? DEFAULT_PAGE_BACKGROUND.backgroundColor,
    backgroundImage: undefined,
  }
}

/** Per-page dark mode (falls back to editor global toggle when unset). */
export function resolvePageDarkMode(page?: Page, globalDarkMode = false): boolean {
  if (page?.darkMode !== undefined) return page.darkMode
  return globalDarkMode
}

export function pageBackgroundModePatch(mode: PageBackgroundMode, current: PageBackground): PageBackground {
  if (mode === 'gradient') {
    return {
      mode: 'gradient',
      backgroundColor: current.backgroundColor ?? DEFAULT_PAGE_BACKGROUND.backgroundColor,
      gradientFrom: current.gradientFrom ?? DEFAULT_PAGE_BACKGROUND.gradientFrom,
      gradientTo: current.gradientTo ?? DEFAULT_PAGE_BACKGROUND.gradientTo,
    }
  }
  return {
    mode: 'solid',
    backgroundColor: current.backgroundColor ?? DEFAULT_PAGE_BACKGROUND.backgroundColor,
    gradientFrom: current.gradientFrom,
    gradientTo: current.gradientTo,
  }
}
