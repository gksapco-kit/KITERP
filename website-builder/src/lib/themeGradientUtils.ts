import type { CSSProperties } from 'react'
import type { BlockStyles } from '../types/builder'
import { gradientStyle } from './blockUtils'

export const DEFAULT_THEME_GRADIENT_FROM = '#4f46e5'
export const DEFAULT_THEME_GRADIENT_TO = '#7c3aed'

/** Themes that use customizable gradient colors from block styles */
export const GRADIENT_THEME_VALUES = ['premium', 'brand', 'dark', 'bold'] as const

export function themeUsesGradient(theme?: string): boolean {
  return GRADIENT_THEME_VALUES.includes(theme as (typeof GRADIENT_THEME_VALUES)[number])
}

export function resolveGradientFrom(styles: Pick<BlockStyles, 'gradientFrom'>): string {
  return styles.gradientFrom?.trim() || DEFAULT_THEME_GRADIENT_FROM
}

export function resolveGradientTo(styles: Pick<BlockStyles, 'gradientTo'>): string {
  return styles.gradientTo?.trim() || DEFAULT_THEME_GRADIENT_TO
}

export function blockThemeGradientStyle(styles: Pick<BlockStyles, 'gradientFrom' | 'gradientTo'>): CSSProperties {
  return gradientStyle(resolveGradientFrom(styles), resolveGradientTo(styles))
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.replace('#', '').trim()
  if (raw.length === 3) {
    return {
      r: parseInt(raw[0] + raw[0], 16),
      g: parseInt(raw[1] + raw[1], 16),
      b: parseInt(raw[2] + raw[2], 16),
    }
  }
  if (raw.length === 6) {
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16),
    }
  }
  return null
}

export function colorWithAlpha(color: string, alpha: number): string {
  if (color.startsWith('#')) {
    const rgb = hexToRgb(color)
    if (rgb) return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
  }
  return color
}

/** Subtle gradient border / shell (premium cards) */
export function softThemeGradientShellStyle(
  styles: Pick<BlockStyles, 'gradientFrom' | 'gradientTo'>,
  alpha = 0.12,
): CSSProperties {
  const from = resolveGradientFrom(styles)
  const to = resolveGradientTo(styles)
  return {
    backgroundImage: `linear-gradient(135deg, ${colorWithAlpha(from, alpha)} 0%, transparent 42%, ${colorWithAlpha(to, alpha)} 100%)`,
  }
}

/** Text gradient using theme colors */
export function themeGradientTextStyle(styles: Pick<BlockStyles, 'gradientFrom' | 'gradientTo'>): CSSProperties {
  const from = resolveGradientFrom(styles)
  const to = resolveGradientTo(styles)
  return {
    backgroundImage: `linear-gradient(135deg, ${from}, ${to})`,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  }
}
