import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

/** One automatic full reload when a lazy chunk 404s after a new deploy. */
export const CHUNK_RELOAD_SESSION_KEY = 'vendor-app-chunk-reload'

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false
  const msg = error instanceof Error ? error.message : String(error)
  return (
    /Failed to fetch dynamically imported module/i.test(msg)
    || /Loading chunk [\d]+ failed/i.test(msg)
    || /Importing a module script failed/i.test(msg)
    || /error loading dynamically imported module/i.test(msg)
  )
}

async function importWithChunkRecovery<T>(factory: () => Promise<T>): Promise<T> {
  try {
    return await factory()
  } catch (err) {
    if (!isChunkLoadError(err)) throw err
    const alreadyReloaded = sessionStorage.getItem(CHUNK_RELOAD_SESSION_KEY)
    if (!alreadyReloaded) {
      sessionStorage.setItem(CHUNK_RELOAD_SESSION_KEY, '1')
      window.location.reload()
      await new Promise<void>(() => { /* wait for reload */ })
    }
    sessionStorage.removeItem(CHUNK_RELOAD_SESSION_KEY)
    throw err
  }
}

/** Drop-in replacement for React `lazy()` with stale-chunk recovery. */
export function lazyRoute<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() => importWithChunkRecovery(factory))
}

export function prefetchRouteModule(factory: () => Promise<unknown>): void {
  void importWithChunkRecovery(factory).catch(() => {
    /* prefetch is best-effort */
  })
}
