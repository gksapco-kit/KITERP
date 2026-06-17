import type { StyleConfig } from '@/blocks/registry'
import type { ThemeConfig } from '@/contexts/ThemeContext'

function pickHex(style: Record<string, unknown>, key: string): string | null {
  const v = style[key]
  return typeof v === 'string' && /^#[0-9A-Fa-f]{3,6}$/i.test(v) ? v : null
}

/** Apply website builder style_config colors/fonts onto the storefront ThemeConfig. */
export function mergeSiteStyleIntoTheme(
  base: ThemeConfig,
  style: Partial<StyleConfig> & Record<string, unknown> | undefined | null,
): ThemeConfig {
  if (!style || typeof style !== 'object') return base

  const primary = pickHex(style, 'primary_color')
  const secondary = pickHex(style, 'secondary_color')
  const accent = pickHex(style, 'accent_color')
  const bg = pickHex(style, 'bg_color')
  const text = pickHex(style, 'text_color')
  const fontHeading =
    typeof style.font_heading === 'string' && style.font_heading.trim()
      ? style.font_heading.trim()
      : null
  const fontBody =
    typeof style.font_body === 'string' && style.font_body.trim()
      ? style.font_body.trim()
      : null

  return {
    ...base,
    colors: {
      ...base.colors,
      ...(primary ? { primary } : {}),
      ...(accent ? { accent } : {}),
      ...(bg ? { background: bg } : {}),
      ...(text ? { secondary: text } : secondary ? { secondary } : {}),
    },
    ...(fontHeading ? { font: fontHeading } : {}),
    ...(fontBody ? { font_body: fontBody } : {}),
  }
}
