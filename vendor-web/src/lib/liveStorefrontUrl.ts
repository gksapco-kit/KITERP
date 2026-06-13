import { getCustomerStorefrontBaseUrl } from '@/lib/storefrontPreviewUrl'

export type LiveStorefrontSite = {
  custom_domain?: string | null
  website_store_scope?: string | null
  website_store_id?: string | null
} | null | undefined

export type ResolveLiveStorefrontUrlInput = {
  vendorSlug?: string | null
  site?: LiveStorefrontSite
  /** Business unit / store code — appended as `?branch=` when set (same as BU / Store Settings). */
  branchCode?: string | null
}

function normalizeHttpsUrl(domain: string): string {
  const trimmed = domain.trim()
  if (!trimmed) return trimmed
  return trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? trimmed
    : `https://${trimmed}`
}

/**
 * Customer store URL shown in BU / Store Settings (Public links → Customer store).
 */
export function buildCustomerStoreLink(
  vendorSlug: string | null | undefined,
  branchCode?: string | null,
): string | null {
  const slug = vendorSlug?.trim()
  if (!slug) return null
  const base = getCustomerStorefrontBaseUrl(slug)
  const branch = (branchCode ?? '').trim()
  if (!branch) return base
  const url = new URL(base)
  url.searchParams.set('branch', branch)
  return url.toString()
}

/**
 * Resolve the public customer store link for a storefront card.
 * Matches BU / Store Settings: vendor catalog URL with optional `?branch=` for a business unit.
 */
export function resolveLiveStorefrontUrl({
  vendorSlug,
  site,
  branchCode,
}: ResolveLiveStorefrontUrlInput): string | null {
  const scope = site?.website_store_scope?.trim()
  const customDomain = site?.custom_domain?.trim()

  if (customDomain) return normalizeHttpsUrl(customDomain)
  if (scope === 'external') return null

  return buildCustomerStoreLink(vendorSlug, branchCode)
}

/** Branch query value for a store record — same as Business Units list. */
export function branchCodeForStore(store: { code?: string | null; id: string }): string {
  return (store.code ?? store.id).trim()
}

/**
 * How customer store links are generated across the app:
 * - `single`: one shared link for the whole business (no `?branch=`).
 * - `per_unit`: a unique link per business unit (`?branch={code}`).
 */
export type StorefrontLinkMode = 'single' | 'per_unit'

export const STOREFRONT_LINK_MODE_KEY = 'storefront_link_mode'

/**
 * In `single` mode, the chosen Website Builder template id used for the one shared
 * business front — overrides any per-store template assignments. Stored on vendor settings.
 */
export const SINGLE_FRONT_TEMPLATE_KEY = 'single_front_template_id'

/** Read the configured storefront link mode from vendor settings (defaults to per-unit). */
export function resolveStorefrontLinkMode(
  settings?: Record<string, unknown> | null,
): StorefrontLinkMode {
  return settings?.[STOREFRONT_LINK_MODE_KEY] === 'single' ? 'single' : 'per_unit'
}

/** Read the single shared business-front template id (only meaningful in `single` mode). */
export function resolveSingleFrontTemplateId(
  settings?: Record<string, unknown> | null,
): string | null {
  const raw = settings?.[SINGLE_FRONT_TEMPLATE_KEY]
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
}

/** Customer store link for a store, honoring the vendor-wide link mode. */
export function customerLinkForStore(
  vendorSlug: string | null | undefined,
  store: { code?: string | null; id: string },
  mode: StorefrontLinkMode,
): string | null {
  if (mode === 'single') return buildCustomerStoreLink(vendorSlug)
  return buildCustomerStoreLink(vendorSlug, branchCodeForStore(store))
}

type StoreLike = { id: string; code?: string | null }

export function resolveSiteStoreLink(
  vendorSlug: string | null | undefined,
  site: LiveStorefrontSite & { website_store_id?: string | null },
  stores: StoreLike[] = [],
): string | null {
  let branchCode: string | null = null
  if (site.website_store_scope === 'store' && site.website_store_id) {
    const store = stores.find(s => s.id === site.website_store_id)
    if (store) branchCode = branchCodeForStore(store)
  }
  return resolveLiveStorefrontUrl({ vendorSlug, site, branchCode })
}
