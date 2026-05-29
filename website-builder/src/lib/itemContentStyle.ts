import type { CSSProperties } from 'react'
import type { ItemContentStyle } from '../types/builder'

export function itemTitleStyle(style?: ItemContentStyle): CSSProperties | undefined {
  if (!style?.titleColor && !style?.fontSize && !style?.fontWeight && !style?.lineHeight && !style?.letterSpacing) {
    return style?.titleColor ? { color: style.titleColor } : undefined
  }
  return {
    color: style.titleColor,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
  }
}

export function itemDescriptionStyle(style?: ItemContentStyle): CSSProperties | undefined {
  const color = style?.descriptionColor ?? style?.textColor
  if (!color && !style?.fontSize) return undefined
  return {
    color,
    fontSize: style?.fontSize,
    lineHeight: style?.lineHeight,
    letterSpacing: style?.letterSpacing,
  }
}

export function hasItemTitleStyle(style?: ItemContentStyle): boolean {
  return !!(style?.titleColor || style?.fontSize || style?.fontWeight || style?.lineHeight || style?.letterSpacing)
}

export function hasItemDescriptionStyle(style?: ItemContentStyle): boolean {
  return !!(
    style?.descriptionColor ||
    style?.textColor ||
    style?.fontSize ||
    style?.fontWeight ||
    style?.lineHeight ||
    style?.letterSpacing
  )
}
