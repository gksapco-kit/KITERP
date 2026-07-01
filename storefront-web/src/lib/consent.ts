/**
 * Cookie / tracking consent helper.
 *
 * Single source of truth used by:
 *  - `CookieConsentBlock` to set the user's choice and display the banner.
 *  - `AnalyticsInjector` to gate GA4 / Meta Pixel / GTM / custom scripts.
 *
 * Consent model:
 *  - "granted"  — user clicked Accept. Tracking allowed.
 *  - "denied"   — user clicked Decline. Tracking forbidden.
 *  - "unknown"  — user has not chosen. Tracking forbidden by default
 *                 (GDPR/EEA/UK and most modern privacy regimes require
 *                 explicit opt-in before non-essential cookies fire).
 *
 * Storage (browser localStorage):
 *  - Key: `cookie_consent`
 *  - Value: JSON `{ status, updated_at, site_id? }` or legacy plain strings
 *    (`granted` / `denied` / `accepted` / `declined`).
 *
 * Changes broadcast through `kiterp:consent-change` so analytics can react
 * without a full page reload.
 */

export type ConsentState = 'granted' | 'denied' | 'unknown'

export type ConsentRecord = {
  status: 'granted' | 'denied'
  updated_at: string
  site_id?: string
}

/** localStorage key — same origin as the storefront (per vendor site domain/path). */
export const CONSENT_STORAGE_KEY = 'cookie_consent'

const STORAGE_KEY = CONSENT_STORAGE_KEY
const EVENT_NAME = 'kiterp:consent-change'

function parseStoredConsent(raw: string | null): ConsentState {
  if (!raw) return 'unknown'
  if (raw === 'accepted' || raw === 'granted') return 'granted'
  if (raw === 'declined' || raw === 'denied') return 'denied'
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentRecord>
    if (parsed.status === 'granted' || parsed.status === 'denied') return parsed.status
  } catch {
    /* legacy plain string handled above */
  }
  return 'unknown'
}

/** Read the current consent without subscribing to changes. */
export function getConsent(): ConsentState {
  if (typeof window === 'undefined') return 'unknown'
  return parseStoredConsent(window.localStorage.getItem(STORAGE_KEY))
}

/** Full stored record when present (for debugging / admin). */
export function getConsentRecord(): ConsentRecord | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  if (raw === 'granted' || raw === 'accepted') {
    return { status: 'granted', updated_at: '' }
  }
  if (raw === 'denied' || raw === 'declined') {
    return { status: 'denied', updated_at: '' }
  }
  try {
    const parsed = JSON.parse(raw) as ConsentRecord
    if (parsed.status === 'granted' || parsed.status === 'denied') return parsed
  } catch {
    return null
  }
  return null
}

/** True when the user has explicitly opted in. */
export function hasGrantedConsent(): boolean {
  return getConsent() === 'granted'
}

/** Persist a new consent choice and broadcast it. */
export function setConsent(next: 'granted' | 'denied', opts?: { siteId?: string }): void {
  if (typeof window === 'undefined') return
  const record: ConsentRecord = {
    status: next,
    updated_at: new Date().toISOString(),
    ...(opts?.siteId ? { site_id: opts.siteId } : {}),
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  window.dispatchEvent(new CustomEvent<ConsentState>(EVENT_NAME, { detail: next }))
}

/** Subscribe to consent changes. Returns an unsubscribe function. */
export function onConsentChange(handler: (state: ConsentState) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const wrapped = (e: Event) => {
    const ce = e as CustomEvent<ConsentState>
    handler(ce.detail ?? getConsent())
  }
  window.addEventListener(EVENT_NAME, wrapped)
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) handler(getConsent())
  }
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT_NAME, wrapped)
    window.removeEventListener('storage', onStorage)
  }
}
