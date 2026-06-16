import { resolveStoreFrontTemplateId } from '@/lib/liveStorefrontUrl'
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
  return stores.filter(store => {
    if (resolveStoreFrontTemplateId(store.settings) !== templateId) return false
    if (storeHasLinkedBuilderSite(store.id, options?.sites)) return false
    return true
  })
}

export function formatAssignedStoresLabel(stores: Pick<StoreLike, 'name'>[], maxVisible = 2): string {
  if (stores.length === 0) return ''
  if (stores.length === 1) return stores[0].name
  if (stores.length <= maxVisible) return stores.map(s => s.name).join(', ')
  const visible = stores.slice(0, maxVisible).map(s => s.name).join(', ')
  return `${visible} +${stores.length - maxVisible}`
}
