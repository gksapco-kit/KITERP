import type { StyleConfig } from '@/blocks/registry'

export const SITE_RADIUS_PILL = 9999

export type SiteRadiusMode = 'sharp' | 'rounded' | 'pill'

/** Normalize style_config.border_radius to the three site-wide corner modes. */
export function normalizeSiteBorderRadius(br?: string | null): SiteRadiusMode {
  if (br === 'sharp' || br === 'none') return 'sharp'
  if (br === 'pill' || br === 'rounded-full') return 'pill'
  return 'rounded'
}

/** Pixel radius for inline styles (buttons, images, nav). */
export function siteRadiusPx(
  br: string | undefined | null,
  size: 'sm' | 'md' | 'lg' = 'md',
): number {
  const mode = normalizeSiteBorderRadius(br)
  if (mode === 'sharp') return 0
  if (mode === 'pill') return SITE_RADIUS_PILL
  if (size === 'sm') return 4
  if (size === 'lg') return 16
  return 8
}

/** shadcn --radius token for commerce blocks. */
export function siteRadiusRem(br?: string | null): string {
  const mode = normalizeSiteBorderRadius(br)
  if (mode === 'sharp') return '0'
  if (mode === 'pill') return '9999px'
  return '0.625rem'
}

export function isSharpSiteRadius(br?: string | null): boolean {
  return normalizeSiteBorderRadius(br) === 'sharp'
}
