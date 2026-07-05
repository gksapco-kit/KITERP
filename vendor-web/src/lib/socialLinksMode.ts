import { resolveStorefrontLinkMode } from '@/lib/liveStorefrontUrl'

/**
 * Controls where social & web links come from on the storefront.
 * - `shared`: every unit uses vendor-level Social & Web Links.
 * - `per_unit`: each business unit keeps its own links (vendor links are the fallback).
 */
export type SocialLinksMode = 'shared' | 'per_unit'

export const SOCIAL_LINKS_MODE_KEY = 'social_links_mode'

/** Read configured social links mode from vendor settings. */
export function resolveSocialLinksMode(
  settings?: Record<string, unknown> | null,
): SocialLinksMode {
  const explicit = settings?.[SOCIAL_LINKS_MODE_KEY]
  if (explicit === 'shared' || explicit === 'per_unit') return explicit
  return resolveStorefrontLinkMode(settings) === 'single' ? 'shared' : 'per_unit'
}

export { SOCIAL_LINK_FIELDS } from '@/lib/socialLinkFields'
export type { SocialLinkFieldDef } from '@/lib/socialLinkFields'

export function storeSocialLinks(settings?: Record<string, unknown> | null): Record<string, string> {
  const raw = settings?.social_links
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string' && v.trim()) out[k] = v.trim()
  }
  return out
}

/** How social icons render on the customer storefront. */
export type SocialLinksIconStyle =
  | 'outline'
  | 'filled'
  | 'brand'
  | 'mono'
  | 'emoji'
  | 'rounded'
  | 'circle'
  | 'brand_badge'

export const SOCIAL_LINKS_ICON_STYLE_KEY = 'social_links_icon_style'

export const DEFAULT_SOCIAL_LINKS_ICON_STYLE: SocialLinksIconStyle = 'brand'

export const SOCIAL_LINKS_ICON_STYLE_OPTIONS: Array<{
  value: SocialLinksIconStyle
  label: string
  description: string
}> = [
  { value: 'outline', label: 'Outline', description: 'Line icons in your theme color' },
  { value: 'filled', label: 'Filled', description: 'Solid icons in your theme color' },
  { value: 'brand', label: 'Brand', description: 'Official platform brand colors' },
  { value: 'mono', label: 'Mono', description: 'Muted single-tone icons' },
  { value: 'emoji', label: 'Emoji', description: 'Playful emoji badges per platform' },
  { value: 'rounded', label: 'Rounded', description: 'Solid icons in rounded squares' },
  { value: 'circle', label: 'Circle', description: 'Solid icons in circular badges' },
  { value: 'brand_badge', label: 'Brand badge', description: 'White icons on brand-colored circles' },
]

export const SOCIAL_LINKS_ICON_STYLE_VALUES = SOCIAL_LINKS_ICON_STYLE_OPTIONS.map(o => o.value)

export function isSocialLinksIconStyle(value: unknown): value is SocialLinksIconStyle {
  return typeof value === 'string' && (SOCIAL_LINKS_ICON_STYLE_VALUES as string[]).includes(value)
}

export function vendorSocialLinksIconStyle(
  settings?: Record<string, unknown> | null,
): SocialLinksIconStyle {
  const raw = settings?.[SOCIAL_LINKS_ICON_STYLE_KEY]
  return isSocialLinksIconStyle(raw) ? raw : DEFAULT_SOCIAL_LINKS_ICON_STYLE
}

export function storeSocialLinksIconStyle(
  settings?: Record<string, unknown> | null,
): SocialLinksIconStyle | undefined {
  const raw = settings?.[SOCIAL_LINKS_ICON_STYLE_KEY]
  return isSocialLinksIconStyle(raw) ? raw : undefined
}

/** Shared vendor default, or per-unit override when in per_unit mode. */
export function resolveSocialLinksIconStyle(
  vendorSettings?: Record<string, unknown> | null,
  branchSettings?: Record<string, unknown> | null,
  mode?: SocialLinksMode,
): SocialLinksIconStyle {
  const resolvedMode = mode ?? resolveSocialLinksMode(vendorSettings)
  if (resolvedMode === 'per_unit' && branchSettings) {
    const unitStyle = storeSocialLinksIconStyle(branchSettings)
    if (unitStyle) return unitStyle
  }
  return vendorSocialLinksIconStyle(vendorSettings)
}
