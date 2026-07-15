/**
 * Open the vendor dashboard (port 3001 in local dev; same origin in production).
 */
export function vendorDashboardOrigin(): string {
  if (import.meta.env.DEV) {
    return `${window.location.protocol}//${window.location.hostname}:3001`
  }
  return window.location.origin
}

/** Absolute URL into vendor-web (e.g. `/products/new`). */
export function vendorDashboardUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  return `${vendorDashboardOrigin()}${clean}`
}
