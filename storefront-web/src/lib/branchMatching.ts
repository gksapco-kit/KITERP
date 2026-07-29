import type { StoreLocation } from '@/api/store'

export function branchKey(v: string | null | undefined): string {
  return String(v ?? '').trim().toLowerCase()
}

export function matchBranch(stores: StoreLocation[], code: string | null): StoreLocation | null {
  const key = branchKey(code)
  if (!key) return null
  // Prefer UUID match — codes can collide across business units.
  const byId = stores.find((s) => branchKey(s.id) === key)
  if (byId) return byId
  return stores.find((s) => branchKey(s.code) === key) ?? null
}

export function openBranches(stores: StoreLocation[]): StoreLocation[] {
  return stores.filter((s) => s.is_open !== false)
}

/** Default shoppable unit when ?branch= is missing or stale. */
export function pickDefaultOpenBranch(stores: StoreLocation[]): StoreLocation | null {
  const open = openBranches(stores)
  return open.find((s) => s.is_default) ?? open[0] ?? null
}

/**
 * Value for ?branch= / catalog API.
 * Prefer short code when unique; otherwise use store id so duplicate codes
 * (e.g. two units both coded "1000") do not break /catalog/products.
 */
export function branchCodeForStore(
  store: Pick<StoreLocation, 'code' | 'id'>,
  stores?: Array<Pick<StoreLocation, 'code' | 'id'>>,
): string {
  const code = store.code?.trim()
  if (!code) return store.id.trim()
  if (stores) {
    const key = branchKey(code)
    const dupes = stores.filter((s) => branchKey(s.code) === key)
    if (dupes.length > 1) return store.id.trim()
  }
  return code
}
