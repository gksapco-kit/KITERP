import { ensureLegalPages } from './legalPageDefaults'
import { StorageQuotaError, storageFlush, storageGet, storageRemove, storageSet } from './largeStorage'
import type { Page, SiteConfig, CatalogProduct, CatalogService } from '../types/builder'

const STORAGE_KEY = 'website-builder-published-site'

export interface PersistedSite {
  siteName: string
  siteConfig: SiteConfig
  pages: Page[]
  catalog: { products: CatalogProduct[]; services: CatalogService[] }
  savedAt: string
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let pendingPayload: PersistedSite | null = null

function writePersistedSite(data: PersistedSite): void {
  storageSet(STORAGE_KEY, JSON.stringify(data))
}

export function persistSite(
  state: {
    siteName: string
    siteConfig: SiteConfig | null
    pages: Page[]
    catalog: { products: CatalogProduct[]; services: CatalogService[] }
  },
  options?: { immediate?: boolean },
): void {
  if (!state.siteConfig || state.pages.length === 0) return

  const data: PersistedSite = {
    siteName: state.siteName,
    siteConfig: state.siteConfig,
    pages: state.pages,
    catalog: state.catalog,
    savedAt: new Date().toISOString(),
  }

  if (options?.immediate) {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    pendingPayload = null
    writePersistedSite(data)
    return
  }

  pendingPayload = data
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    if (!pendingPayload) return
    writePersistedSite(pendingPayload)
    pendingPayload = null
  }, 500)
}

export async function flushPersistedSite(): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (pendingPayload) {
    writePersistedSite(pendingPayload)
    pendingPayload = null
  }
  await storageFlush()
}

export function loadPersistedSite(): PersistedSite | null {
  try {
    const raw = storageGet(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as PersistedSite
    if (!data.pages?.length) return data

    const businessName = data.siteConfig?.businessName ?? data.siteName ?? 'Our Company'
    const pages = ensureLegalPages(data.pages, {
      businessName,
      siteConfig: data.siteConfig,
    })
    if (pages === data.pages) return data
    const migrated = { ...data, pages }
    writePersistedSite(migrated)
    return migrated
  } catch (err) {
    if (err instanceof StorageQuotaError) throw err
    return null
  }
}

export function clearPersistedSite() {
  storageRemove(STORAGE_KEY)
}

export { getLiveSiteUrl } from './liveSiteUrl'
