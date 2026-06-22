import { websiteApi } from '@/api/websites'
import { vendorApi } from '@/api/vendor'
import { formatStoreCode, sortStoresByCode } from '@/lib/verification'
import { isTemplateSandboxSite } from '@/lib/websiteSandbox'
import {
  customerLinkForStore,
  isBuilderSiteTemplateId,
  isCatalogStorefrontTemplateId,
  resolveEffectiveStorefrontTemplateId,
  resolveSingleFrontTemplateId,
  resolveStoreFrontTemplateId,
  resolveStorefrontLinkMode,
  resolveStorefrontTemplateMode,
  STORE_FRONT_TEMPLATE_KEY,
  type AppliedTemplateViewLiveLink,
  type StorefrontLinkMode,
} from '@/lib/liveStorefrontUrl'
import {
  resolveSiteAppliedTemplateLabel,
  resolveTemplateDisplay,
  type ResolvedTemplateDisplay,
} from '@/lib/websiteAppliedTemplate'
import { storesAssignedToTemplate } from '@/lib/websiteTemplateAssignment'
import { resolveSiteStaticThumbnail } from '@/lib/websiteSitePreview'
import type { ThemePresetSummary } from '@/lib/businessFrontActiveTemplate'
import type { SiteListItem, WebsiteSite, WebsiteTemplate } from '@/types/websites'

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
    return site.is_published
  })
}

/** Business unit a builder site was created for (when scoped to one store). */
export function resolveBuilderSiteHomeStoreId(site: SiteListItem): string | null {
  if (site.website_store_scope !== 'store') return null
  const storeId = site.website_store_id?.trim()
  return storeId || null
}

/** Stores that may receive this builder site — locked to its home unit when set. */
export function storesEligibleForBuilderSiteAssignment(
  site: SiteListItem,
  stores: StoreLike[],
): StoreLike[] {
  const homeStoreId = resolveBuilderSiteHomeStoreId(site)
  if (!homeStoreId) return stores
  const store = stores.find(s => s.id === homeStoreId)
  return store ? [store] : []
}

/** True when a builder site belongs to the given business unit (or has no home unit yet). */
export function isBuilderSiteVisibleForStore(site: SiteListItem, storeId: string): boolean {
  const homeStoreId = resolveBuilderSiteHomeStoreId(site)
  if (!homeStoreId) return true
  if (homeStoreId === storeId) return true
  // Published store-scoped sites stay visible so other BUs can adopt the same design.
  return site.is_published
}

/** Assign actions only for the home business unit (or any unit when not store-scoped). */
export function isBuilderSiteAssignableForStore(
  site: SiteListItem,
  storeId: string | null | undefined,
): boolean {
  if (!storeId) return false
  const homeStoreId = resolveBuilderSiteHomeStoreId(site)
  if (!homeStoreId) return true
  return homeStoreId === storeId
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

  // A published builder site linked to this store wins (catalog assignment discontinued).
  const linkedSite = sites.find(
    s =>
      s.is_published
      && s.website_store_scope === 'store'
      && s.website_store_id === store.id,
  )
  if (linkedSite) {
    const name = resolveSiteAppliedTemplateLabel(linkedSite, templates) ?? linkedSite.name
    return {
      id: linkedSite.id,
      name,
      description: linkedSite.description ?? undefined,
      thumbnail: resolveSiteStaticThumbnail(linkedSite, templates),
    }
  }

  if (publishedBuilderOnly) return null

  // An explicit per-store (or single-mode shared) catalog template.
  const templateMode = resolveStorefrontTemplateMode(vendorSettings)
  const storeSpecificId =
    templateMode === 'single'
      ? resolveSingleFrontTemplateId(vendorSettings)
      : resolveStoreFrontTemplateId(store.settings)
  if (storeSpecificId) {
    return resolveTemplateDisplay(storeSpecificId, templates, presets, sites)
  }

  // Finally, the vendor-wide single fallback (per_unit mode) if configured.
  const fallbackId = resolveEffectiveStorefrontTemplateId(vendorSettings, store.settings, templateMode)
  if (fallbackId) {
    return resolveTemplateDisplay(fallbackId, templates, presets, sites)
  }

  return null
}

async function unlinkSiteFromStore(siteId: string): Promise<void> {
  const fullSite = await websiteApi.getSite(siteId)
  const styleConfig = { ...(fullSite.style_config ?? {}) } as Record<string, unknown>
  delete styleConfig.website_store_scope
  delete styleConfig.website_store_id
  delete styleConfig.website_store_name
  delete styleConfig.storefront_assigned
  await websiteApi.updateSite(siteId, { style_config: styleConfig as WebsiteSite['style_config'] })
}

/** Link a published builder site to one or more business units (one site → one store). */
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
  const storeId = storeIds[0]?.trim()
  if (!storeId) return

  const targetStore = stores.find(s => s.id === storeId)
  if (!targetStore) return

  const conflictingSite = sites.find(
    s => s.id !== siteId && s.website_store_scope === 'store' && s.website_store_id === storeId,
  )
  if (conflictingSite) {
    await unlinkSiteFromStore(conflictingSite.id)
  }

  const site = await websiteApi.getSite(siteId)
  const styleConfig = { ...(site.style_config ?? {}) } as Record<string, unknown>
  styleConfig.website_store_scope = 'store'
  styleConfig.website_store_id = storeId
  styleConfig.website_store_name = targetStore.name ?? null
  styleConfig.storefront_assigned = true
  await websiteApi.updateSite(siteId, {
    style_config: styleConfig as WebsiteSite['style_config'],
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
