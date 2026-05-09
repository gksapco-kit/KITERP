/**
 * Maps wb_sites.style_config (builder colors + fonts) to inline CSS custom
 * properties for .checkout-root so the live /checkout page always tracks the
 * vendor's Style panel without any extra per-block configuration.
 *
 * Precedence (later wins):
 *   1. checkout/theme.css defaults (static CSS file, always applied)
 *   2. Derived values from primary_color / accent_color / bg_color / etc.
 *   3. style_config.checkout_token_overrides (explicit per-vendor overrides)
 */

import type { StyleConfig } from '@/blocks/registry'

/** Hex #RRGGBB (or #RGB) → "H S% L%" HSL triplet for CSS var() usage. */
function hexToHsl(hex: string): string {
  // Normalise short form #RGB → #RRGGBB
  const full = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex
  const r = parseInt(full.slice(1, 3), 16) / 255
  const g = parseInt(full.slice(3, 5), 16) / 255
  const b = parseInt(full.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

function pickHex(style: Record<string, unknown>, key: string, fallback: string): string {
  const v = style[key]
  return typeof v === 'string' && /^#[0-9A-Fa-f]{3,6}$/i.test(v) ? v : fallback
}

/** border_radius enum → px approximations for each radius token */
function radiusVars(borderRadius: string): Record<string, string> {
  switch (borderRadius) {
    case 'sharp': return { '--radius-sm': '2px', '--radius-md': '4px', '--radius-lg': '6px' }
    case 'pill':  return { '--radius-sm': '999px', '--radius-md': '999px', '--radius-lg': '999px' }
    default:      return {} // 'rounded' — leave theme.css defaults (6px / 10px / 16px)
  }
}

/**
 * Returns an object suitable for React inline `style={}` on `.checkout-root`.
 * Only sets variables that differ from theme.css defaults to keep the diff minimal.
 */
export function buildCheckoutThemeFromSiteStyle(
  style: Partial<StyleConfig> & Record<string, unknown>,
): React.CSSProperties {
  const primary    = pickHex(style, 'primary_color',  '#221D1A')
  const accent     = pickHex(style, 'accent_color',   '#E45E25')
  const bg         = pickHex(style, 'bg_color',       '#ffffff')
  const surface    = pickHex(style, 'surface_color',  '#f9fafb')
  const text       = pickHex(style, 'text_color',     primary)
  const fontHead   = typeof style.font_heading === 'string' && style.font_heading ? style.font_heading : null
  const fontBody   = typeof style.font_body    === 'string' && style.font_body    ? style.font_body    : null
  const borderRad  = typeof style.border_radius === 'string' ? style.border_radius : 'rounded'

  const derived: Record<string, string> = {
    '--brand-primary':             hexToHsl(primary),
    '--brand-accent':              hexToHsl(accent),
    '--surface':                   hexToHsl(bg),
    '--surface-muted':             hexToHsl(surface),
    '--text':                      hexToHsl(text),
    ...radiusVars(borderRad),
    ...(fontHead ? { '--font-heading': `'${fontHead}', ui-sans-serif, system-ui, sans-serif` } : {}),
    ...(fontBody ? { '--font-body':    `'${fontBody}', ui-sans-serif, system-ui, sans-serif` } : {}),
  }

  // Explicit overrides from vendor Style panel trump derived values
  const overrides: Record<string, string> =
    (style.checkout_token_overrides as Record<string, string> | undefined) ?? {}

  return { ...derived, ...overrides } as React.CSSProperties
}
