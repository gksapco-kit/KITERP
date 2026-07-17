/** Resolve /store/:vendorSlug from the current tab URL (tab-local, never localStorage). */
export function vendorSlugFromLocation(pathname?: string): string | null {
  if (typeof window === 'undefined' && !pathname) return null
  const path = pathname ?? window.location.pathname
  const m = path.match(/^\/store\/([^/]+)/)
  if (!m?.[1]) return null
  try {
    return decodeURIComponent(m[1]).trim() || null
  } catch {
    return m[1].trim() || null
  }
}
