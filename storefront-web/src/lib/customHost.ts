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

function hostWithoutWww(hostname: string): string {
  return normalizeBrowserHostname(hostname).replace(/^www\./, '')
}

/** True when two hosts are the same site, ignoring a leading www. */
export function hostsMatchIgnoringWww(a: string, b: string): boolean {
  const left = hostWithoutWww(a)
  const right = hostWithoutWww(b)
  return Boolean(left) && left === right
}

/** `https://shop.example` for a stored custom domain, or null when it is empty. */
export function customDomainOrigin(domain: string | null | undefined): string | null {
  const raw = (domain || '').trim()
  if (!raw) return null
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    return new URL(withScheme).origin
  } catch {
    return null
  }
}

/**
 * Customer-facing origin. Apex domains are stored without www, while DNS points
 * the apex at www. Leave subdomains (shop.example.com) unchanged.
 */
function customerFacingOrigin(domain: string | null | undefined): string | null {
  const origin = customDomainOrigin(domain)
  if (!origin) return null
  const url = new URL(origin)
  const labels = url.hostname.split('.').filter(Boolean)
  if (labels.length === 2) url.hostname = `www.${url.hostname}`
  return url.origin
}

/**
 * Absolute URL on the vendor's own domain for a store-relative path such as
 * `/products?category=Snacks`. Returns null when there is no custom domain,
 * or the browser is already on that domain (keep the current host, including www).
 */
export function customDomainAbsolutePath(
  storeRelativePath: string,
  domain: string | null | undefined,
): string | null {
  const origin = customerFacingOrigin(domain)
  if (!origin || typeof window === 'undefined') return null
  if (!isPlatformHostname(window.location.hostname)) return null
  const targetHost = new URL(origin).hostname
  if (hostsMatchIgnoringWww(window.location.hostname, targetHost)) return null
  const path = storeRelativePath.startsWith('/') ? storeRelativePath : `/${storeRelativePath}`
  return `${origin}${path}`
}
