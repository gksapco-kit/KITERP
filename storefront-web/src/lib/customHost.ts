/**
 * Custom domain host detection for storefront routing.
 * Platform hosts (kiterp.com / *.kiterp.com / localhost) keep /{slug}/… URLs.
 * Custom hosts (vedikaraksha.com) serve the vendor store at /contact, /about, …
 */

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

export function normalizeBrowserHostname(hostname?: string): string {
  const raw = (hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '')).trim().toLowerCase()
  return raw.replace(/\.$/, '')
}

export function getBaseDomain(): string {
  return (import.meta.env.VITE_BASE_DOMAIN || 'kiterp.com').trim().toLowerCase().replace(/\.$/, '')
}

/** True when this browser host is the KIT ERP platform (not a vendor custom domain). */
export function isPlatformHostname(hostname?: string): boolean {
  const host = normalizeBrowserHostname(hostname)
  const base = getBaseDomain()
  if (!host || LOOPBACK.has(host)) return true
  if (host === base || host === `www.${base}`) return true
  if (host.endsWith(`.${base}`)) return true
  return false
}

export function isCustomDomainHostname(hostname?: string): boolean {
  return !isPlatformHostname(hostname)
}

/** Current host when on a custom domain; otherwise null. */
export function currentCustomDomainHost(): string | null {
  if (typeof window === 'undefined') return null
  const host = normalizeBrowserHostname()
  return isCustomDomainHostname(host) ? host : null
}
