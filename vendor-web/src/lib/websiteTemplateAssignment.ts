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

function storeHasLinkedBuilderSite(storeId: string, sites?: SiteListItem[]): boolean {
  if (!sites?.length) return false
  return sites.some(
    site =>
      site.is_published
      && site.website_store_scope === 'store'
      && site.website_store_id === storeId,
  )
}

export function storesAssignedToTemplate(
  stores: StoreLike[],
  templateId: string,
  options?: StoresAssignedOptions,
): StoreLike[] {
  return sortStoresByCode(stores.filter(store => {
    if (resolveStoreFrontTemplateId(store.settings) !== templateId) return false
    if (storeHasLinkedBuilderSite(store.id, options?.sites)) return false
    return true
  }))
}

/** Stores using a builder site design — direct link and/or catalog template id on the store. */
export function storesUsingBuilderSiteDesign(
  sites: SiteListItem[],
  siteId: string,
  stores: StoreLike[],
): StoreLike[] {
  const byId = new Map<string, StoreLike>()
  for (const store of stores) {
    const linked = sites.some(
      s =>
        s.id === siteId
        && s.is_published
        && s.website_store_scope === 'store'
        && s.website_store_id === store.id,
    )
    if (linked) {
      byId.set(store.id, store)
      continue
    }
    if (resolveStoreFrontTemplateId(store.settings) === siteId && !storeHasLinkedBuilderSite(store.id, sites)) {
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
