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

function dedupePush(list: string[], url: string | undefined): void {
  const trimmed = url?.trim()
  if (!trimmed || list.includes(trimmed)) return
  list.push(trimmed)
}

/**
 * Hero background URLs: builder/theme image first, then store banners from settings.
 * Duplicates are removed; store banners keep settings order after explicit sources.
 */
export function resolveHeroBackgroundUrls(opts: {
  explicitUrl?: string
  themeHeroUrl?: string
  vendor: (HomeSectionVendor & { theme_config?: Record<string, unknown> }) | null
}): string[] {
  const list: string[] = []
  dedupePush(list, opts.explicitUrl)
  dedupePush(list, opts.themeHeroUrl)
  for (const url of orderedVendorBannerUrls(opts.vendor)) {
    dedupePush(list, url)
  }
  return list
}

/** Rotate hero banners when multiple URLs exist. Off when explicitly disabled. */
export function heroUsesBannerCarousel(
  urlCount: number,
  bannerCarousel?: boolean | null,
): boolean {
  if (urlCount <= 1) return false
  return bannerCarousel !== false
}
