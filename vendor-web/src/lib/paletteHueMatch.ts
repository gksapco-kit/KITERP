import {
  WEBSITE_COLOR_PALETTES,
  type WebsiteColorPalette,
} from '@/lib/websiteColorPalettes'

export type HslColor = { h: number; s: number; l: number }

export function hexToHsl(hex: string): HslColor {
  const normalized = hex.replace('#', '').trim()
  if (normalized.length !== 6) return { h: 0, s: 0, l: 0 }

  const r = parseInt(normalized.slice(0, 2), 16) / 255
  const g = parseInt(normalized.slice(2, 4), 16) / 255
  const b = parseInt(normalized.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      default:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 }
}

export function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360
  const sat = Math.max(0, Math.min(100, s)) / 100
  const lit = Math.max(0, Math.min(100, l)) / 100

  const c = (1 - Math.abs(2 * lit - 1)) * sat
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = lit - c / 2

  let r = 0
  let g = 0
  let b = 0

  if (hue < 60) {
    r = c; g = x
  } else if (hue < 120) {
    r = x; g = c
  } else if (hue < 180) {
    g = c; b = x
  } else if (hue < 240) {
    g = x; b = c
  } else if (hue < 300) {
    r = x; b = c
  } else {
    r = c; b = x
  }

  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function hueFromHex(hex: string): number {
  return hexToHsl(hex).h
}

export function circularHueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

/** 0–1 position along a hue spectrum bar. */
export function hueFromBarRatio(ratio: number): number {
  return Math.max(0, Math.min(1, ratio)) * 360
}

export function barRatioFromHue(hue: number): number {
  return Math.max(0, Math.min(1, hue / 360))
}

function paletteHueDistance(palette: WebsiteColorPalette, targetHue: number): number {
  const primary = hexToHsl(palette.colors.primary_color)
  const accent = hexToHsl(palette.colors.accent_color)
  const primaryDist = circularHueDistance(targetHue, primary.h) * (0.35 + (primary.s / 100) * 0.65)
  const accentDist = circularHueDistance(targetHue, accent.h) * (0.35 + (accent.s / 100) * 0.65)
  return Math.min(primaryDist, accentDist)
}

export function sortPalettesByHue(
  palettes: WebsiteColorPalette[],
  targetHue: number,
): WebsiteColorPalette[] {
  return [...palettes].sort(
    (a, b) => paletteHueDistance(a, targetHue) - paletteHueDistance(b, targetHue),
  )
}

export function getDefaultPaletteHue(stylePrimary?: string): number {
  return hueFromHex(stylePrimary || WEBSITE_COLOR_PALETTES[0].colors.primary_color)
}

export const HUE_SPECTRUM_GRADIENT =
  'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
