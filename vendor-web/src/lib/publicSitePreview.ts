/** Public builder snapshot (same JSON shape as storefront GET /public/sites/...). */
export type PublicPreviewBlock = {
  id: string
  block_type: string
  label?: string | null
  props?: Record<string, unknown>
  style_overrides?: Record<string, unknown>
  visible?: boolean
  sort_order?: number
}

export type PublicPreviewPage = {
  id: string
  slug: string
  title?: string
  is_homepage?: boolean
  blocks?: PublicPreviewBlock[]
}

export type PublicPreviewSite = {
  id: string
  name?: string
  /** Catalog slug for /store/:slug (Vendor.slug), not necessarily wb_sites.subdomain. */
  vendor_slug?: string | null
  subdomain?: string | null
  style_config?: Record<string, unknown>
  pages?: PublicPreviewPage[]
}

/** Resolve the slug used by the storefront catalog (/store/:slug). */
export function resolvePreviewVendorSlug(site: PublicPreviewSite | null | undefined): string {
  const catalogSlug = site?.vendor_slug?.trim()
  if (catalogSlug) return catalogSlug
  // wb_sites.subdomain is not always Vendor.slug — avoid using it for catalog embeds.
  return site?.subdomain?.trim() || 'preview'
}

export function findPublicPreviewPage(
  site: PublicPreviewSite,
  pageSlug?: string | null,
): PublicPreviewPage | null {
  const pages = site.pages || []
  if (!pages.length) return null
  const slug = pageSlug?.trim()
  if (!slug || slug.toLowerCase() === 'home') {
    return pages.find(p => p.is_homepage) || pages[0] || null
  }
  const normalised = slug.replace(/^\/+/, '').toLowerCase()
  return (
    pages.find(p => p.slug?.replace(/^\/+/, '').toLowerCase() === normalised)
    || pages.find(p => p.is_homepage)
    || pages[0]
    || null
  )
}

export async function fetchPublicPreviewByToken(token: string): Promise<PublicPreviewSite> {
  const res = await fetch(
    `/api/v1/public/sites/preview/by-token/${encodeURIComponent(token)}`,
    { cache: 'no-store' },
  )
  if (!res.ok) {
    throw new Error(res.status === 404 ? 'Preview expired or not found' : `Preview load failed (${res.status})`)
  }
  return res.json() as Promise<PublicPreviewSite>
}
