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
import { hexToHslChannels, readableTextOnBackground, textOnSolid } from '@/lib/themeColors'

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
  const pageBg     = pickHex(style, 'bg_color',       '#ffffff')
  const surface    = pickHex(style, 'surface_color',  '#ffffff')
  const text       = readableTextOnBackground(surface, pickHex(style, 'text_color', primary))
  const primaryFg  = textOnSolid(primary)
  const fontHead   = typeof style.font_heading === 'string' && style.font_heading ? style.font_heading : null
  const fontBody   = typeof style.font_body    === 'string' && style.font_body    ? style.font_body    : null
  const borderRad  = typeof style.border_radius === 'string' ? style.border_radius : 'rounded'

  const derived: Record<string, string> = {
    '--brand-primary':             hexToHslChannels(primary) ?? '222 47% 11%',
    '--brand-primary-foreground':  hexToHslChannels(primaryFg) ?? '0 0% 100%',
    '--brand-accent':              hexToHslChannels(accent) ?? '16 76% 56%',
    '--surface':                   hexToHslChannels(surface) ?? '0 0% 100%',
    '--surface-muted':             hexToHslChannels(pageBg) ?? '220 14% 97%',
    '--text':                      hexToHslChannels(text) ?? '222 47% 11%',
    ...radiusVars(borderRad),
    ...(fontHead ? { '--font-heading': `'${fontHead}', ui-sans-serif, system-ui, sans-serif` } : {}),
    ...(fontBody ? { '--font-body':    `'${fontBody}', ui-sans-serif, system-ui, sans-serif` } : {}),
  }

  // Explicit overrides from vendor Style panel trump derived values
  const overrides: Record<string, string> =
    (style.checkout_token_overrides as Record<string, string> | undefined) ?? {}

  return { ...derived, ...overrides } as React.CSSProperties
}
