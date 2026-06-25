import { hexToHsl, hslToHex, hueFromHex } from '@/lib/paletteHueMatch'

export type HsvColor = { h: number; s: number; v: number }

export function normalizeHex(hex: string, fallback = '#1a56db'): string {
  const v = hex.trim()
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v.toLowerCase()
  if (/^[0-9A-Fa-f]{6}$/.test(v)) return `#${v.toLowerCase()}`
  return fallback
}

export function hexToHsv(hex: string): HsvColor {
  const normalized = normalizeHex(hex).replace('#', '')
  const r = parseInt(normalized.slice(0, 2), 16) / 255
  const g = parseInt(normalized.slice(2, 4), 16) / 255
  const b = parseInt(normalized.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  const s = max === 0 ? 0 : (d / max) * 100
  const v = max * 100

  if (d !== 0) {
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

  return { h: h * 360, s, v }
}

export function hsvToHex(h: number, s: number, v: number): string {
  const hue = ((h % 360) + 360) % 360
  const sat = Math.max(0, Math.min(100, s)) / 100
  const val = Math.max(0, Math.min(100, v)) / 100

  const i = Math.floor(hue / 60)
  const f = hue / 60 - i
  const p = val * (1 - sat)
  const q = val * (1 - sat * f)
  const t = val * (1 - sat * (1 - f))

  let r = 0
  let g = 0
  let b = 0

  switch (i % 6) {
    case 0: r = val; g = t; b = p; break
    case 1: r = q; g = val; b = p; break
    case 2: r = p; g = val; b = t; break
    case 3: r = p; g = q; b = val; break
    case 4: r = t; g = p; b = val; break
    default: r = val; g = p; b = q; break
  }

  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

const SHADE_SAT_STOPS = [22, 32, 48, 62, 78, 92, 90, 84, 72, 48, 0]
const SHADE_LIGHT_STOPS = [96, 91, 85, 77, 68, 58, 50, 42, 32, 18, 6]

/** 11-step shade strip for a fixed hue (light tint → vivid → dark → black). */
export function generateHueShades(hue: number, count = 11): string[] {
  const steps = Math.min(count, SHADE_SAT_STOPS.length)
  return Array.from({ length: steps }, (_, i) => {
    const idx = Math.round((i / Math.max(steps - 1, 1)) * (SHADE_SAT_STOPS.length - 1))
    return hslToHex(hue, SHADE_SAT_STOPS[idx], SHADE_LIGHT_STOPS[idx])
  })
}

export function closestShadeIndex(shades: string[], hex: string): number {
  const target = hexToHsv(normalizeHex(hex))
  let best = 0
  let bestDist = Infinity
  shades.forEach((shade, i) => {
    const hsv = hexToHsv(shade)
    const dist = Math.abs(hsv.s - target.s) * 1.2 + Math.abs(hsv.v - target.v) + circularHueDist(hsv.h, target.h) * 0.15
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  })
  return best
}

function circularHueDist(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

export { hexToHsl, hslToHex, hueFromHex }

export function hueFromBarRatio(ratio: number): number {
  return Math.max(0, Math.min(1, ratio)) * 360
}

export function barRatioFromHue(hue: number): number {
  return Math.max(0, Math.min(1, hue / 360))
}

export const HUE_SPECTRUM_GRADIENT =
  'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
