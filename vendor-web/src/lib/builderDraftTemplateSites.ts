import { websiteApi } from '@/api/websites'
import { vendorApi } from '@/api/vendor'
import { formatStoreCode, sortStoresByCode } from '@/lib/verification'
import { isTemplateSandboxSite } from '@/lib/websiteSandbox'
import {
  buildCustomerStoreLink,
  customerLinkForStore,
  isBuilderSiteTemplateId,
  isCatalogStorefrontTemplateId,
  resolveEffectiveStorefrontTemplateId,
  resolveSingleFrontTemplateId,
  resolveStoreFrontTemplateId,
  resolveStorefrontLinkMode,
  resolveStorefrontTemplateMode,
  storefrontUrlNeedsBranch,
  STORE_FRONT_TEMPLATE_KEY,
  type AppliedTemplateViewLiveLink,
  type StorefrontLinkMode,
} from '@/lib/liveStorefrontUrl'

type ExternalSiteUrlFields = {
  subdomain?: string | null
  custom_domain?: string | null
  domain_verified?: boolean | null
}

function normalizePublicHttpsUrl(domain: string): string {
  const trimmed = domain.trim()
  if (!trimmed) return trimmed
  return trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? trimmed
    : `https://${trimmed}`
}

/** Primary public URL for an Other Use / external builder site. */
export function resolveExternalSitePublicUrl(site: ExternalSiteUrlFields): string | null {
  const customDomain = site.custom_domain?.trim()
  if (customDomain) return normalizePublicHttpsUrl(customDomain)

  const subdomain = site.subdomain?.trim()
  if (!subdomain) return null
  return `https://${subdomain}.kiterp.com`
}

/** Live links for a published Other Use site (custom domain + KIT subdomain). */
export function resolveExternalSiteLiveLinks(
  site: ExternalSiteUrlFields & { is_published?: boolean },
): AppliedTemplateViewLiveLink[] {
  if (site.is_published === false) return []

  const links: AppliedTemplateViewLiveLink[] = []
  const customDomain = site.custom_domain?.trim()
  if (customDomain) {
    links.push({
      href: normalizePublicHttpsUrl(customDomain),
      label: customDomain.replace(/^https?:\/\//, ''),
    })
  }

  const subdomain = site.subdomain?.trim()
  if (subdomain) {
    links.push({
      href: `https://${subdomain}.kiterp.com`,
      label: `${subdomain}.kiterp.com`,
    })
  }

  return links
}
import {
  resolveSiteAppliedTemplateLabel,
  resolveTemplateDisplay,
  type ResolvedTemplateDisplay,
} from '@/lib/websiteAppliedTemplate'
import { storesAssignedToTemplate } from '@/lib/websiteTemplateAssignment'
import { resolveSiteStaticThumbnail } from '@/lib/websiteSitePreview'
import type { ThemePresetSummary } from '@/lib/businessFrontActiveTemplate'
import type { SiteListItem, WebsiteSite, WebsiteTemplate } from '@/types/websites'
import { resolveSiteWebsiteScope } from '@/lib/websiteCreateWizardPresets'

type StoreLike = {
  id: string
  name?: string
  code?: string | null
  settings?: Record<string, unknown> | null
}

/** Why a linked builder site is not in the Live row yet. */
export type BuilderSiteLiveBlockReason =
  | 'not_linked'
  | 'catalog_template_override'
  | 'single_front_template'

export function resolveBuilderSiteLiveBlockReason(
  sites: SiteListItem[],
  siteId: string,
  stores: StoreLike[],
  vendorSettings?: Record<string, unknown> | null,
): BuilderSiteLiveBlockReason | null {
  if (isBuilderSiteEffectivelyLive(sites, siteId, stores, vendorSettings)) return null

  const linked = storesAssignedToBuilderSite(sites, siteId, stores)
  if (linked.length === 0) return 'not_linked'

  const templateMode = resolveStorefrontTemplateMode(vendorSettings)
  if (templateMode === 'single' && isCatalogStorefrontTemplateId(resolveSingleFrontTemplateId(vendorSettings))) {
    return 'single_front_template'
  }

  if (linked.some(store => isStoreSpecificCatalogTemplateAssigned(store, vendorSettings))) {
    return 'catalog_template_override'
  }

  return 'not_linked'
}

/** Customer storefront URLs when a builder site is effectively live on assigned stores. */
export function resolveBuilderSiteViewLiveLinks(
  vendorSlug: string | null | undefined,
  linkMode: StorefrontLinkMode,
  sites: SiteListItem[],
  siteId: string,
  stores: StoreLike[],
  vendorSettings?: Record<string, unknown> | null,
): AppliedTemplateViewLiveLink[] {
  const slug = vendorSlug?.trim()
  if (!slug) return []

  const linkedLive = sortStoresByCode(
    storesEffectivelyAssignedToBuilderSite(
      sites,
      siteId,
      stores,
      vendorSettings,
    ),
  )
  if (linkedLive.length === 0) return []

  const templateMode = resolveStorefrontTemplateMode(vendorSettings)
  const linkModeResolved = linkMode

  if (!storefrontUrlNeedsBranch(linkModeResolved, templateMode)) {
    const href = buildCustomerStoreLink(slug)
    return href ? [{ href, label: 'All business units' }] : []
  }

  if (linkedLive.length === 1) {
    const store = linkedLive[0]
    const href = customerLinkForStore(slug, store, linkModeResolved, templateMode)
    const label = `${formatStoreCode(store)} · ${store.name ?? 'Store'}`
    return href ? [{ href, label, storeId: store.id }] : []
  }

  return linkedLive
    .map(store => {
      const href = customerLinkForStore(slug, store, linkModeResolved, templateMode)
      return href
        ? { href, label: `${formatStoreCode(store)} · ${store.name ?? 'Store'}`, storeId: store.id }
        : null
    })
    .filter((link): link is AppliedTemplateViewLiveLink => link != null)
}

/** After publish/assign: link site to its store and clear catalog templates that would override it. */
export async function ensureBuilderSiteStorefrontActive({
  siteId,
  sites,
  stores,
  vendorSettings,
}: {
  siteId: string
  sites: SiteListItem[]
  stores: StoreLike[]
  vendorSettings?: Record<string, unknown> | null
}): Promise<boolean> {
  const site = sites.find(s => s.id === siteId)
  const storeId = site?.website_store_id?.trim()
  if (!site || site.website_store_scope !== 'store' || !storeId) return false
  if (!stores.some(s => s.id === storeId)) return false

  if (isBuilderSiteEffectivelyLive(sites, siteId, stores, vendorSettings)) return false

  await assignBuilderSiteToStores({ siteId, storeIds: [storeId], sites, stores })
  return true
}

/** Published Website Builder sites eligible for the templates gallery (excludes sandboxes and drafts). */
export function listBuilderDraftTemplateSites(sites: SiteListItem[]): SiteListItem[] {
  return sites.filter(site => {
    if (isTemplateSandboxSite(site)) return false
    if (isBuilderSiteExternal(site)) return false
    return site.is_published
  })
}

/** Business unit a builder site was created for (when scoped to one store). */
export function resolveBuilderSiteHomeStoreId(
  site: Pick<SiteListItem, 'website_store_scope' | 'website_store_id' | 'website_home_store_id'>,
): string | null {
  const explicitHome = site.website_home_store_id?.trim()
  if (explicitHome) return explicitHome
  // Legacy sites: store scope at creation used website_store_id as the home unit.
  if (site.website_store_scope === 'store') {
    const legacyHome = site.website_store_id?.trim()
    return legacyHome || null
  }
  return null
}

/** True when the site was built as an external / marketing site (not a store BU). */
export function isBuilderSiteExternal(
  site: Pick<
    SiteListItem,
    'website_store_scope' | 'website_store_id' | 'website_home_store_id' | 'business_type' | 'selling_mode'
  >,
  storeCount?: number,
): boolean {
  if (resolveBuilderSiteHomeStoreId(site)) return false
  if (site.website_store_scope?.trim().toLowerCase() !== 'external') return false
  if (storeCount != null) {
    return resolveSiteWebsiteScope(site, storeCount) === 'external'
  }
  return resolveSiteWebsiteScope(site, 1) === 'external'
}

/** True when the site was built for all business units (not locked to one BU or external). */
export function isBuilderSiteBuiltForAll(
  site: Pick<SiteListItem, 'website_store_scope' | 'website_store_id' | 'website_home_store_id'>,
): boolean {
  if (isBuilderSiteExternal(site)) return false
  const scope = site.website_store_scope?.trim().toLowerCase()
  if (scope === 'all') return true
  if (isBuilderSiteBuSpecific(site)) return false
  return !scope
}

/** True when the site was built for one business unit only (not assignable elsewhere). */
export function isBuilderSiteBuSpecific(
  site: Pick<SiteListItem, 'website_store_scope' | 'website_store_id' | 'website_home_store_id'>,
): boolean {
  return resolveBuilderSiteHomeStoreId(site) != null
}

/** Business unit this site was built for (home unit), for scope badges and labels. */
export function resolveSiteBuiltForStore(
  site: Pick<SiteListItem, 'website_store_scope' | 'website_store_id' | 'website_store_name' | 'website_home_store_id'>,
  stores: StoreLike[],
): StoreLike | null {
  const homeStoreId = resolveBuilderSiteHomeStoreId(site)
  if (!homeStoreId) return null

  const matched = stores.find(s => s.id === homeStoreId)
  if (matched) return matched

  const fallbackName = site.website_store_name?.trim()
  return fallbackName ? { id: homeStoreId, name: fallbackName } : { id: homeStoreId }
}

/** Props for WebsiteScopeBadge — single source for cards, gallery, and lists. */
export function resolveSiteScopeBadgeProps(
  site: Pick<
    SiteListItem,
    | 'website_store_scope'
    | 'website_store_id'
    | 'website_store_name'
    | 'website_home_store_id'
    | 'business_type'
    | 'selling_mode'
  >,
  stores: StoreLike[],
): {
  scope: 'all' | 'store' | 'external'
  storeId?: string | null
  storeName?: string | null
  storeCode?: string | null
} {
  const builtForStore = resolveSiteBuiltForStore(site, stores)
  if (builtForStore) {
    return {
      scope: 'store',
      storeId: builtForStore.id,
      storeName: builtForStore.name ?? site.website_store_name,
      storeCode: formatStoreCode(builtForStore),
    }
  }

  const resolvedScope = resolveSiteWebsiteScope(site, stores.length)

  if (resolvedScope === 'store') {
    const store = stores.length === 1
      ? stores[0]
      : stores.find(s => s.id === site.website_store_id)
    if (store) {
      return {
        scope: 'store',
        storeId: store.id,
        storeName: store.name ?? site.website_store_name,
        storeCode: formatStoreCode(store),
      }
    }
  }

  return {
    scope: resolvedScope,
    storeId: site.website_store_id,
    storeName: site.website_store_name,
    storeCode: null,
  }
}

export class BuilderSiteAssignmentError extends Error {
  constructor(message = 'This website was built for a specific business unit and can only be assigned to that unit.') {
    super(message)
    this.name = 'BuilderSiteAssignmentError'
  }
}

/** Throws when a BU-specific site is assigned to the wrong store. */
export function assertBuilderSiteAssignableToStore(
  site: Pick<SiteListItem, 'website_store_scope' | 'website_store_id' | 'website_home_store_id'>,
  storeId: string | null | undefined,
): void {
  const homeStoreId = resolveBuilderSiteHomeStoreId(site)
  const targetId = storeId?.trim()
  if (homeStoreId && targetId && homeStoreId !== targetId) {
    throw new BuilderSiteAssignmentError()
  }
}

/** Stores that may receive this builder site — locked to its home unit when set. */
export function storesEligibleForBuilderSiteAssignment(
  site: SiteListItem,
  stores: StoreLike[],
): StoreLike[] {
  if (isBuilderSiteExternal(site)) return []
  const homeStoreId = resolveBuilderSiteHomeStoreId(site)
  if (!homeStoreId) return stores
  const store = stores.find(s => s.id === homeStoreId)
  return store ? [store] : []
}

/** True when a builder site belongs to the given business unit (or has no home unit yet). */
export function isBuilderSiteVisibleForStore(site: SiteListItem, storeId: string): boolean {
  if (isBuilderSiteExternal(site)) return false
  const homeStoreId = resolveBuilderSiteHomeStoreId(site)
  if (!homeStoreId) return true
  return homeStoreId === storeId
}

/** True when this site's build scope includes the given business unit. */
export function isBuilderSiteBuiltForStore(
  site: SiteListItem,
  storeId: string | null | undefined,
): boolean {
  if (!storeId) return false
  const homeStoreId = resolveBuilderSiteHomeStoreId(site)
  if (!homeStoreId) return true
  return homeStoreId === storeId
}

/** Assign only to the home business unit, or any unit when built for all. */
export function isBuilderSiteAssignableForStore(
  site: SiteListItem,
  storeId: string | null | undefined,
): boolean {
  return isBuilderSiteBuiltForStore(site, storeId)
}

export function resolvePublishedBuilderSiteForStore(
  storeId: string,
  sites: SiteListItem[],
): SiteListItem | null {
  return (
    sites.find(
      s =>
        s.is_published
        && s.website_store_scope === 'store'
        && s.website_store_id === storeId,
    ) ?? null
  )
}

export function storesAssignedToBuilderSite(
  sites: SiteListItem[],
  siteId: string,
  stores: StoreLike[],
): StoreLike[] {
  const site = sites.find(s => s.id === siteId)
  if (!site || site.website_store_scope !== 'store' || !site.website_store_id) return []
  const store = stores.find(s => s.id === site.website_store_id)
  return store ? [store] : []
}

/** True when a catalog template on this store would override the linked builder site. */
export function isStoreSpecificCatalogTemplateAssigned(
  store: StoreLike,
  vendorSettings?: Record<string, unknown> | null,
): boolean {
  const templateMode = resolveStorefrontTemplateMode(vendorSettings)
  const raw =
    templateMode === 'single'
      ? resolveSingleFrontTemplateId(vendorSettings)
      : resolveStoreFrontTemplateId(store.settings)
  return isCatalogStorefrontTemplateId(raw)
}

/** True after explicit Template Gallery assignment (not merely "built for" a business unit). */
export function isBuilderSiteStorefrontAssigned(
  site: Pick<SiteListItem, 'storefront_assigned'>,
): boolean {
  return site.storefront_assigned === true
}

/** True when a linked builder site is what customers actually see (not overridden by a catalog template). */
export function isBuilderSiteEffectivelyLiveForStore(
  store: StoreLike,
  siteId: string,
  sites: SiteListItem[],
  vendorSettings?: Record<string, unknown> | null,
): boolean {
  const site = sites.find(s => s.id === siteId)
  if (!site?.is_published) return false

  // A store-scoped builder site directly linked to this BU is the single source of
  // truth for what customers see (see resolveStorefrontCoverageTemplate). When such a
  // link exists, suppress the resolved-template fallback so a vendor-wide
  // single_front_template (or a stale per-store template id) can't mark a *different*
  // site as also live for the same unit.
  const linkedSite = sites.find(
    s =>
      s.is_published
      && s.website_store_scope === 'store'
      && s.website_store_id === store.id,
  )
  if (linkedSite && linkedSite.id !== siteId) return false

  const templateMode = resolveStorefrontTemplateMode(vendorSettings)
  const assignedTemplateId = resolveEffectiveStorefrontTemplateId(
    vendorSettings,
    store.settings,
    templateMode,
  )
  if (assignedTemplateId === siteId) return true

  if (site.website_store_scope !== 'store' || site.website_store_id !== store.id) {
    return false
  }
  if (isStoreSpecificCatalogTemplateAssigned(store, vendorSettings)) {
    return false
  }
  return isBuilderSiteStorefrontAssigned(site)
}

export function storesEffectivelyAssignedToBuilderSite(
  sites: SiteListItem[],
  siteId: string,
  stores: StoreLike[],
  vendorSettings?: Record<string, unknown> | null,
): StoreLike[] {
  return sortStoresByCode(
    stores.filter(store =>
      isBuilderSiteEffectivelyLiveForStore(store, siteId, sites, vendorSettings),
    ),
  )
}

/** Published builder site id actively serving a business unit's storefront, if any. */
export function resolveActiveBuilderSiteIdForStore(
  sites: SiteListItem[],
  storeId: string,
  stores: StoreLike[],
  vendorSettings?: Record<string, unknown> | null,
): string | null {
  const store = stores.find(s => s.id === storeId)
  if (!store) return null
  for (const site of sites) {
    if (!site.is_published) continue
    if (isBuilderSiteEffectivelyLiveForStore(store, site.id, sites, vendorSettings)) {
      return site.id
    }
  }
  return null
}

export function isBuilderSiteEffectivelyLive(
  sites: SiteListItem[],
  siteId: string,
  stores: StoreLike[],
  vendorSettings?: Record<string, unknown> | null,
): boolean {
  return storesEffectivelyAssignedToBuilderSite(sites, siteId, stores, vendorSettings).length > 0
}

/** True when a published builder site is linked to a business unit (gallery "Assign"). */
export function isBuilderSiteAssignedToStore(
  sites: SiteListItem[],
  siteId: string,
  stores: StoreLike[],
): boolean {
  return storesAssignedToBuilderSite(sites, siteId, stores).length > 0
}

/**
 * True when this builder site is assigned to at least one business unit —
 * direct store link, per-store template id, or single shared template for all units.
 */
export function isBuilderSiteAssignedToAnyStore(
  site: Pick<SiteListItem, 'id' | 'website_store_scope' | 'website_store_id'>,
  stores: StoreLike[],
  vendorSettings?: Record<string, unknown> | null,
): boolean {
  const siteId = site.id.trim()
  if (!siteId) return false

  const templateMode = resolveStorefrontTemplateMode(vendorSettings)
  if (templateMode === 'single' && resolveSingleFrontTemplateId(vendorSettings) === siteId) {
    return stores.length > 0
  }

  if (site.website_store_scope === 'store' && site.website_store_id) {
    return stores.some(s => s.id === site.website_store_id)
  }

  return stores.some(s => resolveStoreFrontTemplateId(s.settings) === siteId)
}

/**
 * True when a published builder site belongs in the gallery "Assigned templates" section.
 * In single-template mode only the active `single_front_template_id` counts — a stale
 * store link on a replaced design does not keep it in Assigned.
 */
export function isBuilderSiteInAssignedTemplatesSection(
  site: SiteListItem,
  sites: SiteListItem[],
  stores: StoreLike[],
  vendorSettings?: Record<string, unknown> | null,
): boolean {
  const templateMode = resolveStorefrontTemplateMode(vendorSettings)
  if (templateMode === 'single') {
    return resolveSingleFrontTemplateId(vendorSettings) === site.id
  }
  return storesEffectivelyAssignedToBuilderSite(sites, site.id, stores, vendorSettings).length > 0
}

/** Stores where this builder site is live on the storefront (not merely built for). */
export function storesUsingBuilderSiteDesign(
  sites: SiteListItem[],
  siteId: string,
  stores: StoreLike[],
  vendorSettings?: Record<string, unknown> | null,
): StoreLike[] {
  return storesEffectivelyAssignedToBuilderSite(sites, siteId, stores, vendorSettings)
}

/** Resolve the template/site shown for a store in storefront coverage. */
export function resolveStorefrontCoverageTemplate(
  store: StoreLike,
  sites: SiteListItem[],
  templates: WebsiteTemplate[],
  presets: ThemePresetSummary[],
  vendorSettings?: Record<string, unknown> | null,
  opts?: { publishedBuilderOnly?: boolean },
): ResolvedTemplateDisplay | null {
  const publishedBuilderOnly = opts?.publishedBuilderOnly ?? false

  const linkedSite = sites.find(
    s =>
      s.is_published
      && s.website_store_scope === 'store'
      && s.website_store_id === store.id,
  )
  const linkedSiteIsLive = Boolean(
    linkedSite
    && isBuilderSiteStorefrontAssigned(linkedSite)
    && !isStoreSpecificCatalogTemplateAssigned(store, vendorSettings),
  )

  if (linkedSiteIsLive && linkedSite) {
    const name = resolveSiteAppliedTemplateLabel(linkedSite, templates) ?? linkedSite.name
    return {
      id: linkedSite.id,
      name,
      description: linkedSite.description ?? undefined,
      thumbnail: resolveSiteStaticThumbnail(linkedSite, templates),
    }
  }

  const templateMode = resolveStorefrontTemplateMode(vendorSettings)
  const storeSpecificId =
    templateMode === 'single'
      ? resolveSingleFrontTemplateId(vendorSettings)
      : resolveStoreFrontTemplateId(store.settings)

  const enrichTemplateDisplay = (display: ResolvedTemplateDisplay): ResolvedTemplateDisplay => {
    const catalogTpl = templates.find(t => t.id === display.id)
    const builderSite = sites.find(s => s.id === display.id && s.is_published)
    return {
      ...display,
      thumbnail:
        display.thumbnail
        ?? catalogTpl?.thumbnail
        ?? (builderSite ? resolveSiteStaticThumbnail(builderSite, templates) : null),
    }
  }

  if (storeSpecificId) {
    const display = resolveTemplateDisplay(storeSpecificId, templates, presets, sites)
    if (display) return enrichTemplateDisplay(display)
  }

  if (publishedBuilderOnly) return null

  const fallbackId = resolveEffectiveStorefrontTemplateId(vendorSettings, store.settings, templateMode)
  if (fallbackId) {
    const display = resolveTemplateDisplay(fallbackId, templates, presets, sites)
    if (display) return enrichTemplateDisplay(display)
  }

  return null
}

async function unlinkSiteFromStore(siteId: string): Promise<void> {
  const fullSite = await websiteApi.getSite(siteId)
  const styleConfig = { ...(fullSite.style_config ?? {}) } as Record<string, unknown>
  await websiteApi.updateSite(siteId, {
    style_config: {
      ...styleConfig,
      website_store_scope: null,
      website_store_id: null,
      website_store_name: null,
      storefront_assigned: false,
    } as WebsiteSite['style_config'],
  })
}

function resolveBuilderSiteScopeMeta(
  styleConfig: Record<string, unknown>,
  siteRecord?: SiteListItem | null,
): Pick<SiteListItem, 'website_store_scope' | 'website_store_id' | 'website_home_store_id'> {
  return {
    website_store_scope: String(
      styleConfig.website_store_scope ?? siteRecord?.website_store_scope ?? '',
    ),
    website_store_id: (styleConfig.website_store_id ?? siteRecord?.website_store_id ?? null) as
      | string
      | null
      | undefined,
    website_home_store_id: (styleConfig.website_home_store_id ?? siteRecord?.website_home_store_id ?? null) as
      | string
      | null
      | undefined,
  }
}

/** Link a published builder site to one or more business units. */
export async function assignBuilderSiteToStores({
  siteId,
  storeIds,
  sites,
  stores,
}: {
  siteId: string
  storeIds: string[]
  sites: SiteListItem[]
  stores: StoreLike[]
}): Promise<void> {
  const normalizedStoreIds = storeIds.map(id => id.trim()).filter(Boolean)
  if (normalizedStoreIds.length === 0) return

  const siteRecord = sites.find(s => s.id === siteId)
  const site = await websiteApi.getSite(siteId)
  const styleConfig = { ...(site.style_config ?? {}) } as Record<string, unknown>
  const scopeMeta = resolveBuilderSiteScopeMeta(styleConfig, siteRecord)

  for (const sid of normalizedStoreIds) {
    assertBuilderSiteAssignableToStore(scopeMeta, sid)
  }

  if (isBuilderSiteBuiltForAll(scopeMeta)) {
    await assignCatalogTemplateToStores({
      templateId: siteId,
      storeIds: normalizedStoreIds,
      sites,
      stores,
    })

    await websiteApi.updateSite(siteId, {
      style_config: {
        ...styleConfig,
        storefront_assigned: true,
        website_store_scope: String(styleConfig.website_store_scope ?? 'all') || 'all',
        website_store_id: null,
        website_store_name: null,
      } as WebsiteSite['style_config'],
    })
    return
  }

  const storeId = normalizedStoreIds[0]
  const targetStore = stores.find(s => s.id === storeId)
  if (!targetStore) return

  const conflictingSite = sites.find(
    s => s.id !== siteId && s.website_store_scope === 'store' && s.website_store_id === storeId,
  )
  if (conflictingSite) {
    await unlinkSiteFromStore(conflictingSite.id)
  }

  const homeStoreId = resolveBuilderSiteHomeStoreId(scopeMeta)
  if (homeStoreId && homeStoreId !== storeId) {
    throw new BuilderSiteAssignmentError()
  }

  await websiteApi.updateSite(siteId, {
    style_config: {
      ...styleConfig,
      website_store_scope: 'store',
      website_store_id: storeId,
      website_store_name: targetStore.name ?? null,
      storefront_assigned: true,
      ...(homeStoreId ? { website_home_store_id: homeStoreId } : {}),
    } as WebsiteSite['style_config'],
  })

  await vendorApi.updateStore(storeId, {
    settings: {
      ...(targetStore.settings ?? {}),
      [STORE_FRONT_TEMPLATE_KEY]: null,
    },
  })
}

/** Assign a catalog template to stores and clear any stale builder-site links for those stores. */
export async function assignCatalogTemplateToStores({
  templateId,
  storeIds,
  sites,
  stores,
}: {
  templateId: string
  storeIds: string[]
  sites: SiteListItem[]
  stores: StoreLike[]
}): Promise<void> {
  await Promise.all(
    storeIds.map(async storeId => {
      const store = stores.find(s => s.id === storeId)
      if (!store) return

      const linkedSite = sites.find(
        s => s.website_store_scope === 'store' && s.website_store_id === storeId,
      )
      if (linkedSite) {
        await unlinkSiteFromStore(linkedSite.id)
      }

      await vendorApi.updateStore(storeId, {
        settings: { ...(store.settings ?? {}), [STORE_FRONT_TEMPLATE_KEY]: templateId },
      })
    }),
  )
}
