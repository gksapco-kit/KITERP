import type { StorefrontConfig } from './theming'

/** Hex #RRGGBB → "H S% L%" for StorefrontConfig.brand */
export function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
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
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

function pickHex(style: Record<string, unknown>, key: string, fallback: string): string {
  const v = style[key]
  return typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/i.test(v) ? v : fallback
}

/**
 * Map wb_sites.style_config (builder hex + fonts) to StorefrontConfig for React catalog templates.
 */
export function buildStorefrontConfigFromSiteStyle(
  templateIdShort: string,
  storeName: string,
  style: Record<string, unknown> | undefined | null,
): StorefrontConfig {
  const s = style || {}
  const primary = pickHex(s, 'primary_color', '#221D1A')
  const accent = pickHex(s, 'accent_color', '#E45E25')
  const bg = pickHex(s, 'bg_color', '#F9F7F5')
  const fg = pickHex(s, 'text_color', primary)
  const display = typeof s.font_heading === 'string' && s.font_heading ? s.font_heading : 'Fraunces'
  const body = typeof s.font_body === 'string' && s.font_body ? s.font_body : 'Inter'

  return {
    templateId: templateIdShort,
    preset: 'classic',
    storeName,
    brand: {
      primary: hexToHsl(primary),
      accent: hexToHsl(accent),
      bg: hexToHsl(bg),
      fg: hexToHsl(fg),
      display,
      body,
    },
  }
}
