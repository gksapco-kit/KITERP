import type { StoreLocation } from '@/api/store'

export function branchKey(v: string | null | undefined): string {
  return String(v ?? '').trim().toLowerCase()
}

export function matchBranch(stores: StoreLocation[], code: string | null): StoreLocation | null {
  const key = branchKey(code)
  if (!key) return null
  return stores.find((s) => branchKey(s.code) === key || branchKey(s.id) === key) ?? null
}

export function openBranches(stores: StoreLocation[]): StoreLocation[] {
  return stores.filter((s) => s.is_open !== false)
}

/** Default shoppable unit when ?branch= is missing or stale. */
export function pickDefaultOpenBranch(stores: StoreLocation[]): StoreLocation | null {
  const open = openBranches(stores)
  return open.find((s) => s.is_default) ?? open[0] ?? null
}

export function branchCodeForStore(store: Pick<StoreLocation, 'code' | 'id'>): string {
  return (store.code ?? store.id).trim()
}
