import type { CSSProperties } from 'react'
import type { TemplateMeta, PresetId } from './templates'

export interface BrandConfig {
  primary?: string // hsl triplet
  accent?: string
  bg?: string
  fg?: string
  display?: string
  body?: string
}

export const buildSurfaceStyle = (template: TemplateMeta, brand?: BrandConfig): CSSProperties => {
  const b = { ...template.defaultBrand, ...brand }
  const style: Record<string, string> = {
    '--sf-primary': b.primary,
    '--sf-primary-foreground': b.bg,
    '--sf-accent': b.accent,
    '--sf-bg': b.bg,
    '--sf-fg': b.fg,
    '--sf-muted': shiftLightness(b.bg, -4),
    '--sf-muted-fg': shiftLightness(b.fg, 28),
    '--sf-border': shiftLightness(b.bg, -10),
    '--sf-display': `'${b.display}', Georgia, serif`,
    '--sf-body': `'${b.body}', system-ui, sans-serif`,
  }
  return style as CSSProperties
}

function shiftLightness(hsl: string, delta: number): string {
  const m = hsl.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/)
  if (!m) return hsl
  const [, h, s, l] = m
  const newL = Math.min(100, Math.max(0, parseFloat(l) + delta))
  return `${h} ${s}% ${newL}%`
}

export interface StorefrontConfig {
  templateId: string
  preset: PresetId
  brand?: BrandConfig
  storeName: string
  tagline?: string
}
