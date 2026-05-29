import type { CSSProperties } from 'react'
import type { BlockStyles } from '../types/builder'

export function titleColorStyle(styles: BlockStyles): CSSProperties | undefined {
  const color = styles.titleColor ?? styles.textColor
  return color ? { color } : undefined
}

export function subtitleColorStyle(styles: BlockStyles): CSSProperties | undefined {
  const color = styles.subtitleColor ?? styles.textColor
  return color ? { color } : undefined
}

export function subtitleWidthStyle(styles: BlockStyles, centered = true): CSSProperties | undefined {
  const width = styles.subtitleWidth?.trim()
  if (!width) return undefined
  return {
    maxWidth: width,
    width: '100%',
    ...(centered ? { marginLeft: 'auto', marginRight: 'auto' } : {}),
  }
}

export function hasCustomTitleColor(styles: BlockStyles): boolean {
  return !!(styles.titleColor ?? styles.textColor)
}

export function hasCustomSubtitleColor(styles: BlockStyles): boolean {
  return !!(styles.subtitleColor ?? styles.textColor)
}

export const DEFAULT_TITLE_CLASS = 'text-gray-900 dark:text-white'
export const DEFAULT_SUBTITLE_CLASS = 'text-gray-600 dark:text-gray-400'
