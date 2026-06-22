import { resolveStoreFrontTemplateId } from '@/lib/liveStorefrontUrl'
import { sortStoresByCode } from '@/lib/verification'
import type { SiteListItem } from '@/types/websites'

type StoreLike = {
  id: string
  name: string
  settings?: Record<string, unknown> | null
}

type StoresAssignedOptions = {
  /** When a store is linked to a published builder site, catalog template assignment is discontinued. */
  sites?: SiteListItem[]
}

function storeHasActiveLinkedBuilderSite(storeId: string, sites?: SiteListItem[]): boolean {
  if (!sites?.length) return false
  return sites.some(
    site =>
      site.is_published
      && site.website_store_scope === 'store'
      && site.website_store_id === storeId
      && site.storefront_assigned === true,
  )
}

export function storesAssignedToTemplate(
  stores: StoreLike[],
  templateId: string,
  options?: StoresAssignedOptions,
): StoreLike[] {
  return sortStoresByCode(stores.filter(store => {
    if (resolveStoreFrontTemplateId(store.settings) !== templateId) return false
    if (storeHasActiveLinkedBuilderSite(store.id, options?.sites)) return false
    return true
  }))
}

/** @deprecated Use storesEffectivelyAssignedToBuilderSite from builderDraftTemplateSites. */
export function storesUsingBuilderSiteDesign(
  sites: SiteListItem[],
  siteId: string,
  stores: StoreLike[],
  vendorSettings?: Record<string, unknown> | null,
): StoreLike[] {
  // Re-import would cycle; keep minimal mirror for legacy callers without vendorSettings.
  const byId = new Map<string, StoreLike>()
  for (const store of stores) {
    const linked = sites.some(
      s =>
        s.id === siteId
        && s.is_published
        && s.website_store_scope === 'store'
        && s.website_store_id === store.id
        && s.storefront_assigned === true,
    )
    if (linked) {
      byId.set(store.id, store)
      continue
    }
    if (resolveStoreFrontTemplateId(store.settings) === siteId && !storeHasActiveLinkedBuilderSite(store.id, sites)) {
      byId.set(store.id, store)
    }
  }
  return sortStoresByCode([...byId.values()])
}

export function formatAssignedStoresLabel(stores: Pick<StoreLike, 'name'>[], maxVisible = 2): string {
  if (stores.length === 0) return ''
  if (stores.length === 1) return stores[0].name
  if (stores.length <= maxVisible) return stores.map(s => s.name).join(', ')
  const visible = stores.slice(0, maxVisible).map(s => s.name).join(', ')
  return `${visible} +${stores.length - maxVisible}`
}
