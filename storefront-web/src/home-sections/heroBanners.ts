import type { HomeSectionVendor } from './types'

function extraBannerUrls(themeConfig: Record<string, unknown> | null | undefined): string[] {
  const raw = themeConfig?.extra_banners
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((s) => s.trim())
}

/** Primary banner plus extras, deduplicated — matches vendor settings ordering. */
export function orderedVendorBannerUrls(
  vendor: (HomeSectionVendor & { theme_config?: Record<string, unknown> }) | null,
): string[] {
  const list: string[] = []
  const primary = vendor?.banner_url?.trim()
  if (primary) list.push(primary)
  for (const url of extraBannerUrls(vendor?.theme_config)) {
    if (!list.includes(url)) list.push(url)
  }
  return list
}

/**
 * Hero background URLs: explicit prop/theme image wins as a single slide;
 * otherwise all uploaded store banners rotate in settings order.
 */
export function resolveHeroBackgroundUrls(opts: {
  explicitUrl?: string
  themeHeroUrl?: string
  vendor: (HomeSectionVendor & { theme_config?: Record<string, unknown> }) | null
}): string[] {
  const explicit = opts.explicitUrl?.trim()
  if (explicit) return [explicit]
  const themeUrl = opts.themeHeroUrl?.trim()
  if (themeUrl) return [themeUrl]
  return orderedVendorBannerUrls(opts.vendor)
}
