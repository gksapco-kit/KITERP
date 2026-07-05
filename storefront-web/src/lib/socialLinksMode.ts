import { resolveStorefrontLinkMode } from '@/lib/storefrontTemplateAssignment'

export type SocialLinksMode = 'shared' | 'per_unit'

export const SOCIAL_LINKS_MODE_KEY = 'social_links_mode'

export function resolveSocialLinksMode(
  settings?: Record<string, unknown> | null,
): SocialLinksMode {
  const explicit = settings?.[SOCIAL_LINKS_MODE_KEY]
  if (explicit === 'shared' || explicit === 'per_unit') return explicit
  return resolveStorefrontLinkMode(settings) === 'single' ? 'shared' : 'per_unit'
}

export function storeSocialLinks(settings?: Record<string, unknown> | null): Record<string, string> {
  const raw = settings?.social_links
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string' && v.trim()) out[k] = v.trim()
  }
  return out
}

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

export const SOCIAL_LINKS_ICON_STYLE_VALUES: SocialLinksIconStyle[] = [
  'outline',
  'filled',
  'brand',
  'mono',
  'emoji',
  'rounded',
  'circle',
  'brand_badge',
]

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
