import { safeLocalGet, safeLocalSet, safeSessionGet, safeSessionSet } from '@/lib/safeStorage'

const VISITOR_KEY = 'asure_visitor_id'

/** Stable anonymous visitor id shared with journey / CRM beacons. */
export function getVisitorId(): string {
  let id = safeLocalGet(VISITOR_KEY)
  if (!id) {
    id = `v_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`
    safeLocalSet(VISITOR_KEY, id)
  }
  return id
}

/**
 * Client-side guard so React Strict Mode / remounts don't spam the track API.
 * Server still dedupes for 24h; this only reduces duplicate requests in-session.
 */
export function claimSessionTrack(kind: 'partner' | 'product' | 'service', key: string): boolean {
  const storageKey = `kiterp_track:${kind}:${key}`
  if (safeSessionGet(storageKey)) return false
  safeSessionSet(storageKey, '1')
  return true
}
