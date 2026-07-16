const VISITOR_KEY = 'asure_visitor_id'

/** Stable anonymous visitor id shared with journey / CRM beacons. */
export function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY)
    if (!id) {
      id = `v_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`
      localStorage.setItem(VISITOR_KEY, id)
    }
    return id
  } catch {
    return `v_ephemeral_${Date.now().toString(36)}`
  }
}

/**
 * Client-side guard so React Strict Mode / remounts don't spam the track API.
 * Server still dedupes for 24h; this only reduces duplicate requests in-session.
 */
export function claimSessionTrack(kind: 'partner' | 'product', key: string): boolean {
  const storageKey = `kiterp_track:${kind}:${key}`
  try {
    if (sessionStorage.getItem(storageKey)) return false
    sessionStorage.setItem(storageKey, '1')
    return true
  } catch {
    return true
  }
}
