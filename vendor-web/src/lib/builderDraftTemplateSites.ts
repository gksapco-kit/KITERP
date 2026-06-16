import { websiteApi } from '@/api/websites'
import { vendorApi } from '@/api/vendor'
import { formatStoreCode } from '@/lib/verification'
import { isTemplateSandboxSite } from '@/lib/websiteSandbox'
import {
  customerLinkForStore,
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
  if (templateMode === 'single' && resolveSingleFrontTemplateId(vendorSettings)) {
    return 'single_front_template'
  }

  if (linked.some(store => resolveStoreFrontTemplateId(store.settings))) {
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

  const assignedStores = storesEffectivelyAssignedToBuilderSite(
    sites,
    siteId,
    stores,
    vendorSettings,
  )
  if (assignedStores.length === 0) return []

  if (linkMode === 'single') {
    const href = customerLinkForStore(slug, assignedStores[0], linkMode)
    return href ? [{ href, label: 'View live BU / Store' }] : []
  }

  if (assignedStores.length === 1) {
    const store = assignedStores[0]
    const href = customerLinkForStore(slug, store, linkMode)
    const label = `${formatStoreCode(store)} · ${store.name ?? 'Store'}`
    return href ? [{ href, label }] : []
  }

  return assignedStores
    .map(store => {
      const href = customerLinkForStore(slug, store, linkMode)
      return href
        ? { href, label: `${formatStoreCode(store)} · ${store.name ?? 'Store'}` }
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

/** True when a linked builder site is what customers actually see (not overridden by a catalog template). */
export function isBuilderSiteEffectivelyLiveForStore(
  store: StoreLike,
  siteId: string,
  sites: SiteListItem[],
  vendorSettings?: Record<string, unknown> | null,
): boolean {
  const site = sites.find(s => s.id === siteId)
  if (!site || site.website_store_scope !== 'store' || site.website_store_id !== store.id) {
    return false
  }
  const templateMode = resolveStorefrontTemplateMode(vendorSettings)
  if (templateMode === 'single' && resolveSingleFrontTemplateId(vendorSettings)) {
    return false
  }
  return !resolveStoreFrontTemplateId(store.settings)
}

export function storesEffectivelyAssignedToBuilderSite(
  sites: SiteListItem[],
  siteId: string,
  stores: StoreLike[],
  vendorSettings?: Record<string, unknown> | null,
): StoreLike[] {
  return storesAssignedToBuilderSite(sites, siteId, stores).filter(store =>
    isBuilderSiteEffectivelyLiveForStore(store, siteId, sites, vendorSettings),
  )
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

/** Resolve the template/site shown for a store in storefront coverage. */
export function resolveStorefrontCoverageTemplate(
  store: StoreLike,
  sites: SiteListItem[],
  templates: WebsiteTemplate[],
  presets: ThemePresetSummary[],
  vendorSettings?: Record<string, unknown> | null,
): ResolvedTemplateDisplay | null {
  const templateMode = resolveStorefrontTemplateMode(vendorSettings)

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

  // An explicit per-store (or single-mode shared) catalog template.
  const storeSpecificId =
    templateMode === 'single'
      ? resolveSingleFrontTemplateId(vendorSettings)
      : resolveStoreFrontTemplateId(store.settings)
  if (storeSpecificId) {
    return resolveTemplateDisplay(storeSpecificId, templates, presets)
  }

  // Finally, the vendor-wide single fallback (per_unit mode) if configured.
  const fallbackId = resolveEffectiveStorefrontTemplateId(vendorSettings, store.settings, templateMode)
  if (fallbackId) {
    return resolveTemplateDisplay(fallbackId, templates, presets)
  }

  return null
}

async function unlinkSiteFromStore(siteId: string): Promise<void> {
  const fullSite = await websiteApi.getSite(siteId)
  const styleConfig = { ...(fullSite.style_config ?? {}) } as Record<string, unknown>
  delete styleConfig.website_store_scope
  delete styleConfig.website_store_id
  delete styleConfig.website_store_name
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
  for (const storeId of storeIds) {
    const store = stores.find(s => s.id === storeId)
    if (!store) continue

    const linkedSite = sites.find(
      s => s.website_store_scope === 'store' && s.website_store_id === storeId,
    )
    if (linkedSite) {
      await unlinkSiteFromStore(linkedSite.id)
    }

    await vendorApi.updateStore(storeId, {
      settings: { ...(store.settings ?? {}), [STORE_FRONT_TEMPLATE_KEY]: templateId },
    })
  }
}
