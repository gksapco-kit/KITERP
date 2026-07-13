/** Apply page/site SEO to the current document head (draft preview on vendor-web). */

type SeoPage = {
  title?: string | null
  slug?: string | null
  is_homepage?: boolean
  seo_title?: string | null
  seo_description?: string | null
  seo_keywords?: string | null
  og_title?: string | null
  og_description?: string | null
  og_image_url?: string | null
  noindex?: boolean
  canonical_url?: string | null
}

type SeoSite = {
  name?: string | null
  description?: string | null
  seo_title?: string | null
  seo_description?: string | null
  seo_keywords?: string | null
  og_image_url?: string | null
  logo_url?: string | null
  subdomain?: string | null
  custom_domain?: string | null
}

function setMetaTag(attr: 'name' | 'property', key: string, content: string | null | undefined): void {
  const selector = `meta[${attr}="${key}"]`
  const existing = document.head.querySelector(selector)
  if (!content) {
    existing?.remove()
    return
  }
  if (existing) {
    existing.setAttribute('content', content)
    return
  }
  const el = document.createElement('meta')
  el.setAttribute(attr, key)
  el.setAttribute('content', content)
  document.head.appendChild(el)
}

function setLinkTag(rel: string, href: string | null | undefined): void {
  const selector = `link[rel="${rel}"]:not([hreflang])`
  const existing = document.head.querySelector(selector)
  if (!href) {
    existing?.remove()
    return
  }
  if (existing) {
    existing.setAttribute('href', href)
    return
  }
  const el = document.createElement('link')
  el.setAttribute('rel', rel)
  el.setAttribute('href', href)
  document.head.appendChild(el)
}

function siteHost(site: SeoSite): string {
  const custom = site.custom_domain?.trim()
  if (custom) return custom.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
  const sub = site.subdomain?.trim()
  if (sub) return `${sub}.site`
  return `${(site.name || 'site').toLowerCase().replace(/\s+/g, '')}.site`
}

export function applyPreviewDocumentSeo(site: SeoSite, page: SeoPage | null): void {
  if (typeof document === 'undefined') return

  const pageSeoTitle = page?.seo_title?.trim() || ''
  const siteSeoTitle = site.seo_title?.trim() || ''
  const siteName = site.name?.trim() || 'Site'

  let docTitle: string
  if (pageSeoTitle) {
    docTitle = page?.is_homepage || !siteSeoTitle || pageSeoTitle === siteSeoTitle
      ? pageSeoTitle
      : `${pageSeoTitle} | ${siteSeoTitle}`
  } else if (page?.is_homepage) {
    docTitle = siteSeoTitle || siteName
  } else {
    const pageLabel = page?.title?.trim() || siteName
    docTitle = siteSeoTitle && siteSeoTitle !== pageLabel
      ? `${pageLabel} | ${siteSeoTitle}`
      : pageLabel
  }
  document.title = docTitle

  const description =
    page?.seo_description?.trim()
    || site.seo_description?.trim()
    || site.description?.trim()
    || null
  setMetaTag('name', 'description', description)

  const keywords = page?.seo_keywords?.trim() || site.seo_keywords?.trim() || null
  setMetaTag('name', 'keywords', keywords)

  setMetaTag('name', 'robots', page?.noindex ? 'noindex, nofollow' : null)

  const host = siteHost(site)
  const pagePath = page?.is_homepage
    ? '/'
    : `/${(page?.slug || '').replace(/^\/+/, '')}`
  const canonical = page?.canonical_url?.trim() || `https://${host}${pagePath}`
  setLinkTag('canonical', canonical)

  const ogImage = page?.og_image_url || site.og_image_url || site.logo_url || null
  const ogTitle = page?.og_title || page?.seo_title || page?.title || site.name || null
  const ogDescription = page?.og_description || description
  setMetaTag('property', 'og:type', page?.is_homepage ? 'website' : 'article')
  setMetaTag('property', 'og:site_name', site.name || null)
  setMetaTag('property', 'og:title', ogTitle)
  setMetaTag('property', 'og:description', ogDescription)
  setMetaTag('property', 'og:url', canonical)
  setMetaTag('property', 'og:image', ogImage)
  setMetaTag('name', 'twitter:card', ogImage ? 'summary_large_image' : 'summary')
  setMetaTag('name', 'twitter:title', ogTitle)
  setMetaTag('name', 'twitter:description', ogDescription)
  setMetaTag('name', 'twitter:image', ogImage)
}
