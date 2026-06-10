import type { StyleConfig } from '@/blocks/registry'
import { primaryForegroundHslForHex, hexToHslChannels } from '@/lib/themeColors'
import type { BlockColorProps } from '@/lib/blockColorOverrides'

function hslOr(hex: string | null | undefined, fallback: string): string {
  if (!hex || typeof hex !== 'string') return fallback
  const trimmed = hex.trim()
  if (trimmed.startsWith('hsl')) return trimmed
  return hexToHslChannels(trimmed) || fallback
}

/** Map site + block color overrides to shadcn tokens used by commerce-blocks. */
export function buildCommerceBlockCssVars(
  style: StyleConfig,
  props: Record<string, unknown>,
): Record<string, string> {
  const colorProps = props as BlockColorProps
  const bgHex = colorProps.bg_color_override || style.bg_color || '#ffffff'
  const cardHex = colorProps.tile_bg || style.surface_color || style.bg_color || '#f9fafb'
  const textHex = colorProps.text_color_override || style.text_color || '#182E20'
  const primaryHex = style.primary_color || '#274832'

  const background = hslOr(bgHex, '0 0% 100%')
  const card = hslOr(cardHex, background)
  const foreground = hslOr(textHex, '222 20% 12%')
  const primary = hslOr(primaryHex, '222 47% 20%')
  const primaryForeground = primaryForegroundHslForHex(primaryHex)
  const border = colorProps.tile_border && !colorProps.tile_border.includes('33')
    ? hslOr(colorProps.tile_border, '214 22% 90%')
    : '214 22% 90%'

  return {
    '--background': background,
    '--foreground': foreground,
    '--card': card,
    '--card-foreground': foreground,
    '--muted': card,
    '--muted-foreground': foreground,
    '--primary': primary,
    '--primary-foreground': primaryForeground,
    '--secondary': card,
    '--secondary-foreground': foreground,
    '--accent': card,
    '--accent-foreground': foreground,
    '--destructive': '0 75% 55%',
    '--destructive-foreground': '0 0% 100%',
    '--success': '142 65% 38%',
    '--success-foreground': '0 0% 100%',
    '--warning': '38 92% 50%',
    '--warning-foreground': '26 60% 12%',
    '--border': border,
    '--input': border,
    '--ring': primary,
    '--radius': '0.625rem',
  }
}
