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
 * The default is **deny** to be safe out of the box. Vendors who operate
 * exclusively in opt-out jurisdictions can override this by setting
 * `consent_mode: 'opt-out'` on the site's `feature_flags` and reading it
 * here (left as a future hook).
 *
 * State is persisted in `localStorage.cookie_consent` so the choice
 * survives reloads, and changes are broadcast through the
 * `kiterp:consent-change` `CustomEvent` so listeners (analytics) can
 * react without a full page reload.
 */

export type ConsentState = 'granted' | 'denied' | 'unknown'

const STORAGE_KEY = 'cookie_consent'
const EVENT_NAME = 'kiterp:consent-change'

/** Read the current consent without subscribing to changes. */
export function getConsent(): ConsentState {
  if (typeof window === 'undefined') return 'unknown'
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === 'accepted' || raw === 'granted') return 'granted'
  if (raw === 'declined' || raw === 'denied') return 'denied'
  return 'unknown'
}

/** True when the user has explicitly opted in. */
export function hasGrantedConsent(): boolean {
  return getConsent() === 'granted'
}

/** Persist a new consent choice and broadcast it. */
export function setConsent(next: 'granted' | 'denied'): void {
  if (typeof window === 'undefined') return
  // Keep accepting the legacy values too so existing localStorage entries
  // stay usable across deploys.
  window.localStorage.setItem(STORAGE_KEY, next)
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
  // Also listen to cross-tab storage changes so consent stays consistent
  // when the same user has the site open in multiple tabs.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) handler(getConsent())
  }
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT_NAME, wrapped)
    window.removeEventListener('storage', onStorage)
  }
}
