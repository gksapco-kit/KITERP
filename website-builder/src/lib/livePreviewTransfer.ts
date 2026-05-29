import type { Block, CatalogProduct, CatalogService, Page, SiteConfig } from '../types/builder'
import { STASH_LIVE_PREVIEW_MESSAGE } from './livePreviewMessages'

const STORAGE_PREFIX = 'kiterp-wb-live-preview:'
/** Only use localStorage for small previews (large sites use parent memory via postMessage). */
const LOCAL_STORAGE_MAX_BYTES = 4_000_000

export interface LivePreviewPayload {
  siteName: string
  siteConfig: SiteConfig
  pages: Page[]
  catalog: { products: CatalogProduct[]; services: CatalogService[] }
}

export function createLivePreviewKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `preview-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function isLargeDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:') && value.length > 2048
}

/** Remove huge base64 blobs from block props so postMessage / memory transfer succeeds. */
function slimBlock(block: Block): Block {
  const props: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(block.props ?? {})) {
    if (isLargeDataUrl(v)) {
      props[k] = ''
      continue
    }
    if (Array.isArray(v)) {
      props[k] = v.map((item) => (isLargeDataUrl(item) ? '' : item))
      continue
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const nested: Record<string, unknown> = {}
      for (const [nk, nv] of Object.entries(v as Record<string, unknown>)) {
        nested[nk] = isLargeDataUrl(nv) ? '' : nv
      }
      props[k] = nested
      continue
    }
    props[k] = v
  }

  const children = block.children?.map(slimBlock)
  return children ? { ...block, props: props as Block['props'], children } : { ...block, props: props as Block['props'] }
}

function slimCatalogProduct(product: CatalogProduct): CatalogProduct {
  return {
    ...product,
    imageUrl: isLargeDataUrl(product.imageUrl) ? '' : product.imageUrl,
  }
}

function slimCatalogService(service: CatalogService): CatalogService {
  return {
    ...service,
    imageUrl: isLargeDataUrl(service.imageUrl) ? '' : service.imageUrl,
  }
}

/**
 * Compact payload for cross-tab transfer (drops embedded images; layout and text remain).
 */
export function compactLivePreviewPayload(payload: LivePreviewPayload): LivePreviewPayload {
  return {
    siteName: payload.siteName,
    siteConfig: payload.siteConfig,
    pages: payload.pages.map((page) => ({
      ...page,
      blocks: page.blocks.map(slimBlock),
    })),
    catalog: {
      products: payload.catalog.products.map(slimCatalogProduct),
      services: payload.catalog.services.map(slimCatalogService),
    },
  }
}

function tryLocalStorageStash(key: string, payload: LivePreviewPayload): void {
  if (typeof localStorage === 'undefined') return
  const json = JSON.stringify({ payload, expiresAt: Date.now() + 30 * 60 * 1000 })
  if (json.length > LOCAL_STORAGE_MAX_BYTES) return

  try {
    pruneOldLivePreviewStorage()
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, json)
  } catch {
    /* quota — parent memory cache is enough */
  }
}

function pruneOldLivePreviewStorage(): void {
  if (typeof localStorage === 'undefined') return
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith(STORAGE_PREFIX)) keys.push(k)
  }
  keys.forEach((k) => localStorage.removeItem(k))
}

/**
 * Stash draft for live preview. Primary path: vendor parent in-memory cache (postMessage).
 * localStorage is optional and only used for small sites.
 */
export function stashLivePreviewPayload(key: string, payload: LivePreviewPayload): boolean {
  const compact = compactLivePreviewPayload(payload)

  if (typeof window !== 'undefined' && window.parent !== window) {
    try {
      window.parent.postMessage({ type: STASH_LIVE_PREVIEW_MESSAGE, key, payload: compact }, '*')
      tryLocalStorageStash(key, compact)
      return true
    } catch (err) {
      console.warn('[website-builder] live preview postMessage failed:', err)
      return false
    }
  }

  tryLocalStorageStash(key, compact)
  return true
}

export function peekLivePreviewPayload(key: string): LivePreviewPayload | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`)
    if (!raw) return null
    const entry = JSON.parse(raw) as { payload: LivePreviewPayload; expiresAt: number }
    if (!entry?.payload?.pages?.length || !entry.payload.siteConfig) return null
    if (entry.expiresAt < Date.now()) return null
    return entry.payload
  } catch {
    return null
  }
}

export function readPreviewKeyFromLocation(loc: Location = window.location): string | null {
  return new URLSearchParams(loc.search).get('previewKey')?.trim() || null
}

export function consumeLivePreviewPayload(key: string): LivePreviewPayload | null {
  const peeked = peekLivePreviewPayload(key)
  if (peeked && typeof localStorage !== 'undefined') {
    localStorage.removeItem(`${STORAGE_PREFIX}${key}`)
  }
  return peeked
}

export function buildLivePreviewState(payload: LivePreviewPayload, pageSlug: string) {
  const pageForUrl =
    payload.pages.find((p) => p.slug === pageSlug) ??
    payload.pages.find((p) => p.kind === 'home') ??
    payload.pages[0]

  return {
    onboardingComplete: true as const,
    siteName: payload.siteName,
    siteConfig: payload.siteConfig,
    pages: payload.pages,
    catalog: payload.catalog,
    activePageId: pageForUrl?.id ?? payload.pages[0]?.id ?? '',
    selectedBlockId: null as string | null,
    mode: 'edit' as const,
  }
}
