import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

/** One automatic hard refresh when a lazy chunk 404s after a new deploy. */
export const CHUNK_RELOAD_SESSION_KEY = 'vendor-app-chunk-reload'

/** Bust cached index.html on deploy recovery (stripped after a successful navigation). */
export const DEPLOY_REFRESH_QUERY = '_app_refresh'

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false
  const msg = error instanceof Error ? error.message : String(error)
  return (
    /Failed to fetch dynamically imported module/i.test(msg)
    || /Loading chunk [\d]+ failed/i.test(msg)
    || /Loading CSS chunk [\d]+ failed/i.test(msg)
    || /Importing a module script failed/i.test(msg)
    || /error loading dynamically imported module/i.test(msg)
    || /MIME type.*text\/html/i.test(msg)
  )
}

/** Remove deploy-recovery query param from the address bar without reloading. */
export function stripDeployRefreshFromUrl(): void {
  try {
    const url = new URL(window.location.href)
    if (!url.searchParams.has(DEPLOY_REFRESH_QUERY)) return
    url.searchParams.delete(DEPLOY_REFRESH_QUERY)
    const qs = url.searchParams.toString()
    window.history.replaceState({}, '', qs ? `${url.pathname}?${qs}` : url.pathname)
  } catch {
    /* ignore */
  }
}

/** Full navigation so the browser picks up a fresh index.html (not a soft reload). */
export function reloadForStaleAssets(): void {
  const url = new URL(window.location.href)
  url.searchParams.set(DEPLOY_REFRESH_QUERY, String(Date.now()))
  window.location.replace(url.toString())
}

/** This document already started a chunk-mismatch reload. */
let chunkReloadStarted = false

/**
 * Hard-navigate once so a tab opened before the latest deploy picks up new chunk hashes.
 * Returns true when a reload was started (caller should wait, not render the error).
 * Returns false when this tab already reloaded once and the chunk is still missing.
 */
export function recoverFromChunkLoadError(): boolean {
  if (chunkReloadStarted) return true
  let alreadyReloaded = false
  try {
    alreadyReloaded = sessionStorage.getItem(CHUNK_RELOAD_SESSION_KEY) === '1'
  } catch {
    alreadyReloaded = false
  }
  if (alreadyReloaded) return false
  chunkReloadStarted = true
  try {
    sessionStorage.setItem(CHUNK_RELOAD_SESSION_KEY, '1')
  } catch {
    /* private mode */
  }
  reloadForStaleAssets()
  return true
}

export function clearChunkReloadFlag(): void {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_SESSION_KEY)
  } catch {
    /* private mode */
  }
}

async function importWithChunkRecovery<T>(factory: () => Promise<T>): Promise<T> {
  try {
    return await factory()
  } catch (err) {
    if (!isChunkLoadError(err)) throw err
    if (recoverFromChunkLoadError()) {
      await new Promise<void>(() => { /* wait for navigation */ })
    }
    throw err
  }
}

/** Drop-in replacement for React `lazy()` with stale-chunk recovery. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyRoute<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() => importWithChunkRecovery(factory))
}

export function prefetchRouteModule(factory: () => Promise<unknown>): void {
  void importWithChunkRecovery(factory).catch(() => {
    /* prefetch is best-effort */
  })
}
