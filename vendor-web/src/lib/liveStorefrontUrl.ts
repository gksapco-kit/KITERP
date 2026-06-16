import { getCustomerStorefrontBaseUrl } from '@/lib/storefrontPreviewUrl'
import { formatStoreCode } from '@/lib/verification'

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
 * In `single` template mode, the chosen template id used for every business unit.
 * Stored on vendor settings as `single_front_template_id`.
 */
export const SINGLE_FRONT_TEMPLATE_KEY = 'single_front_template_id'

/**
 * How storefront templates are assigned:
 * - `single`: one template for all business units (`single_front_template_id`).
 * - `per_unit`: each BU/store can have its own template (`front_template_id` on store settings).
 */
export type StorefrontTemplateMode = 'single' | 'per_unit'

export const STOREFRONT_TEMPLATE_MODE_KEY = 'storefront_template_mode'

/** Per-store template id when template mode is `per_unit`. Stored on store.settings. */
export const STORE_FRONT_TEMPLATE_KEY = 'front_template_id'

/** Read the configured storefront link mode from vendor settings (defaults to per-unit). */
export function resolveStorefrontLinkMode(
  settings?: Record<string, unknown> | null,
): StorefrontLinkMode {
  return settings?.[STOREFRONT_LINK_MODE_KEY] === 'single' ? 'single' : 'per_unit'
}

/** Read the storefront template assignment mode. */
export function resolveStorefrontTemplateMode(
  settings?: Record<string, unknown> | null,
): StorefrontTemplateMode {
  const explicit = settings?.[STOREFRONT_TEMPLATE_MODE_KEY]
  if (explicit === 'per_unit' || explicit === 'single') return explicit
  // Before template mode existed, single link mode implied one shared template.
  return resolveStorefrontLinkMode(settings) === 'single' ? 'single' : 'per_unit'
}

/** Read the single shared business-front template id (used when template mode is `single`). */
export function resolveSingleFrontTemplateId(
  settings?: Record<string, unknown> | null,
): string | null {
  const raw = settings?.[SINGLE_FRONT_TEMPLATE_KEY]
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
}

/** Read a business unit's assigned storefront template id (used when template mode is `per_unit`). */
export function resolveStoreFrontTemplateId(
  storeSettings?: Record<string, unknown> | null,
): string | null {
  const raw = storeSettings?.[STORE_FRONT_TEMPLATE_KEY]
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
}

/** Effective template id for a store given vendor + store settings and template mode. */
export function resolveEffectiveStorefrontTemplateId(
  vendorSettings: Record<string, unknown> | null | undefined,
  storeSettings: Record<string, unknown> | null | undefined,
  templateMode: StorefrontTemplateMode,
): string | null {
  if (templateMode === 'single') {
    return resolveSingleFrontTemplateId(vendorSettings)
  }
  return resolveStoreFrontTemplateId(storeSettings) ?? resolveSingleFrontTemplateId(vendorSettings)
}

/** True when the storefront URL must include `?branch=` for the correct BU template/branding. */
export function storefrontUrlNeedsBranch(
  linkMode: StorefrontLinkMode,
  templateMode?: StorefrontTemplateMode,
): boolean {
  return linkMode === 'per_unit' || templateMode === 'per_unit'
}

/** Customer store link for a store, honoring link + template assignment modes. */
export function customerLinkForStore(
  vendorSlug: string | null | undefined,
  store: { code?: string | null; id: string },
  linkMode: StorefrontLinkMode,
  templateMode?: StorefrontTemplateMode,
): string | null {
  const slug = vendorSlug?.trim()
  if (!slug) return null
  if (storefrontUrlNeedsBranch(linkMode, templateMode)) {
    return buildCustomerStoreLink(slug, branchCodeForStore(store))
  }
  return buildCustomerStoreLink(slug)
}

type StoreLike = { id: string; code?: string | null }

export function resolveSiteStoreLink(
  vendorSlug: string | null | undefined,
  site: LiveStorefrontSite & { website_store_id?: string | null },
  stores: StoreLike[] = [],
  vendorSettings?: Record<string, unknown> | null,
): string | null {
  let branchCode: string | null = null
  if (site.website_store_scope === 'store' && site.website_store_id) {
    const store = stores.find(s => s.id === site.website_store_id)
    if (store) branchCode = branchCodeForStore(store)
  }
  if (branchCode) {
    return buildCustomerStoreLink(vendorSlug, branchCode)
  }
  const linkMode = resolveStorefrontLinkMode(vendorSettings)
  const templateMode = resolveStorefrontTemplateMode(vendorSettings)
  if (storefrontUrlNeedsBranch(linkMode, templateMode)) {
    return null
  }
  return resolveLiveStorefrontUrl({ vendorSlug, site, branchCode })
}

export type AppliedTemplateViewLiveLink = { href: string; label: string; storeId?: string }

type StoreForViewLive = {
  id: string
  name: string
  code?: string | null
  settings?: Record<string, unknown> | null
}

/** Live storefront links for a template that is currently applied (single or per-store mode). */
export function resolveAppliedTemplateViewLiveLinks(
  vendorSlug: string | null | undefined,
  linkMode: StorefrontLinkMode,
  options: {
    templateId: string
    templateMode: StorefrontTemplateMode
    singleFrontTemplateId: string | null
    stores: StoreForViewLive[]
    /** Published builder sites — stores linked to a builder site are excluded from catalog assignment. */
    builderSites?: Array<{ id: string; is_published?: boolean; website_store_scope?: string | null; website_store_id?: string | null }>
  },
): AppliedTemplateViewLiveLink[] {
  const slug = vendorSlug?.trim()
  if (!slug) return []

  const { templateId, templateMode, singleFrontTemplateId, stores, builderSites } = options

  const storeHasLinkedBuilder = (storeId: string) =>
    builderSites?.some(
      site =>
        site.is_published !== false
        && site.website_store_scope === 'store'
        && site.website_store_id === storeId,
    ) ?? false

  const catalogAssignedStores =
    templateMode === 'single'
      ? stores
      : stores.filter(
          s =>
            resolveStoreFrontTemplateId(s.settings) === templateId
            && !storeHasLinkedBuilder(s.id),
        )

  const isApplied =
    templateMode === 'single'
      ? singleFrontTemplateId === templateId
      : catalogAssignedStores.length > 0

  if (!isApplied) return []

  const assignedStores = templateMode === 'single' ? stores : catalogAssignedStores
  const needsBranch = storefrontUrlNeedsBranch(linkMode, templateMode)

  if (!needsBranch) {
    const href = buildCustomerStoreLink(slug)
    return href ? [{ href, label: 'View live BU / Store' }] : []
  }

  if (assignedStores.length === 0) {
    const href = buildCustomerStoreLink(slug)
    return href ? [{ href, label: 'View live BU / Store' }] : []
  }

  if (assignedStores.length === 1) {
    const store = assignedStores[0]
    const href = customerLinkForStore(slug, store, linkMode, templateMode)
    const label = `${formatStoreCode(store)} · ${store.name}`
    return href ? [{ href, label, storeId: store.id }] : []
  }

  return assignedStores
    .map(store => {
      const href = customerLinkForStore(slug, store, linkMode, templateMode)
      return href
        ? { href, label: `${formatStoreCode(store)} · ${store.name}`, storeId: store.id }
        : null
    })
    .filter((link): link is AppliedTemplateViewLiveLink => link != null)
}

type StoreRef = { id: string; name?: string; code?: string | null }

/** Customer storefront links right after assigning specific business units. */
export function resolveStorefrontLinksForStoreIds(
  vendorSlug: string | null | undefined,
  linkMode: StorefrontLinkMode,
  storeIds: string[],
  stores: StoreRef[],
  templateMode?: StorefrontTemplateMode,
): AppliedTemplateViewLiveLink[] {
  const slug = vendorSlug?.trim()
  if (!slug || storeIds.length === 0) return []

  const assigned = storeIds
    .map(id => stores.find(s => s.id === id))
    .filter((s): s is StoreRef => s != null)

  const needsBranch = storefrontUrlNeedsBranch(linkMode, templateMode)

  if (!needsBranch) {
    const href = buildCustomerStoreLink(slug)
    return href ? [{ href, label: 'View live BU / Store' }] : []
  }

  if (assigned.length === 0) {
    const href = buildCustomerStoreLink(slug)
    return href ? [{ href, label: 'View live BU / Store' }] : []
  }

  return assigned
    .map(store => {
      const href = customerLinkForStore(slug, store, linkMode, templateMode)
      return href
        ? { href, label: `${formatStoreCode(store)} · ${store.name ?? 'Store'}`, storeId: store.id }
        : null
    })
    .filter((link): link is AppliedTemplateViewLiveLink => link != null)
}

/** Open each link in a new tab (staggered to reduce popup-blocker issues). */
export function openAllViewLiveLinks(links: AppliedTemplateViewLiveLink[]): void {
  if (links.length === 0) return
  window.open(links[0].href, '_blank', 'noopener,noreferrer')
  for (let i = 1; i < links.length; i++) {
    const href = links[i].href
    window.setTimeout(() => {
      window.open(href, '_blank', 'noopener,noreferrer')
    }, i * 250)
  }
}

/** Open live storefront link(s). Multiple BUs always show the picker — never auto-pick one. */
export function openStorefrontLinks(
  links: AppliedTemplateViewLiveLink[],
  options?: {
    onMultiple?: (links: AppliedTemplateViewLiveLink[]) => void
  },
): void {
  if (links.length === 0) return
  if (links.length === 1) {
    window.open(links[0].href, '_blank', 'noopener,noreferrer')
    return
  }
  if (options?.onMultiple) {
    options.onMultiple(links)
    return
  }
  window.open(links[0].href, '_blank', 'noopener,noreferrer')
}
