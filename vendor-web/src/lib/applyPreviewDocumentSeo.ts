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

/** Tab title is the business name only. "Website" and "— Home" are not added. */
export function businessDocumentTitle(input: {
  siteName?: string | null
  siteSeoTitle?: string | null
  pageSeoTitle?: string | null
  pageTitle?: string | null
  isHomepage?: boolean
}): string {
  const site = input.siteName?.trim() || ''
  const fromSite = site.replace(/\s+website$/i, '').trim() || site || 'Site'
  const seo = input.pageSeoTitle?.trim() || ''
  if (
    seo
    && !/[—|]/.test(seo)
    && fromSite !== 'Site'
    && seo.toLowerCase() === fromSite.toLowerCase()
  ) {
    return seo
  }
  return fromSite
}

export function applyPreviewDocumentSeo(site: SeoSite, page: SeoPage | null): void {
  if (typeof document === 'undefined') return

  const siteName = site.name?.trim() || 'Site'
  const docTitle = businessDocumentTitle({
    siteName,
    siteSeoTitle: site.seo_title,
    pageSeoTitle: page?.seo_title,
    pageTitle: page?.title,
    isHomepage: page?.is_homepage,
  })
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
  const customOg = page?.og_title?.trim() || ''
  const ogTitle = customOg && siteName !== 'Site' && customOg.toLowerCase().includes(siteName.toLowerCase())
    ? customOg
    : docTitle
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
