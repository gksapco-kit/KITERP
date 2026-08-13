import { useEffect } from 'react'

export type JsonLdValue = Record<string, unknown> | Array<Record<string, unknown>>

export type DocumentSeoInput = {
  title: string
  description?: string | null
  keywords?: string | null
  canonicalPath?: string | null
  canonicalUrl?: string | null
  robots?: string | null
  noindex?: boolean
  ogType?: string | null
  ogImage?: string | null
  ogImageAlt?: string | null
  ogSiteName?: string | null
  twitterCard?: 'summary' | 'summary_large_image' | null
  jsonLd?: JsonLdValue | null
  jsonLdId?: string | null
}

export const PLATFORM_SEO = {
  siteName: 'KITERP',
  defaultTitle: 'KITERP — Business Front & Multi-Vendor Commerce Platform',
  defaultDescription:
    'KITERP powers branded business fronts, online stores, bookings, and multi-vendor commerce from one platform. Discover partners, create your business, and sell online.',
  defaultKeywords:
    'KITERP, KIT ERP, business front, multi-vendor, ecommerce, online store, bookings, SaaS',
  themeColor: '#0f172a',
} as const

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

export const PUBLIC_ROBOTS =
  'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
export const PRIVATE_ROBOTS = 'noindex, nofollow'
export const PAGE_JSON_LD_ID = 'kiterp-jsonld'

export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://kiterp.com'
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return `${origin}${path}`
}

export function setJsonLd(id: string, data: JsonLdValue | null | undefined): void {
  if (typeof document === 'undefined') return
  const existing = document.getElementById(id)
  if (!data) {
    existing?.remove()
    return
  }
  let el = existing instanceof HTMLScriptElement ? existing : null
  if (!el) {
    existing?.remove()
    el = document.createElement('script')
    el.id = id
    el.type = 'application/ld+json'
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function truncateMeta(value: string, max: number): string {
  const clean = stripHtml(value)
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 1).trimEnd()}…`
}

/** Idempotently apply title, description, robots, canonical, and Open Graph / Twitter tags. */
export function applyDocumentSeo(input: DocumentSeoInput): void {
  if (typeof document === 'undefined') return

  const title = (input.title ?? '').trim() || PLATFORM_SEO.defaultTitle
  document.title = title

  const description = input.description?.trim()
    ? truncateMeta(input.description, 160)
    : null
  setMetaTag('name', 'description', description)

  const keywords = input.keywords?.trim() || null
  setMetaTag('name', 'keywords', keywords)

  const robots = input.noindex
    ? PRIVATE_ROBOTS
    : (input.robots?.trim() || PUBLIC_ROBOTS)
  setMetaTag('name', 'robots', robots)
  setMetaTag('name', 'googlebot', input.noindex ? PRIVATE_ROBOTS : 'index, follow')

  const canonical =
    input.canonicalUrl?.trim()
    || (input.canonicalPath != null ? absoluteUrl(input.canonicalPath) : null)
  setLinkTag('canonical', canonical)

  const ogImage = input.ogImage?.trim()
    ? absoluteUrl(input.ogImage.trim())
    : null
  const siteName = input.ogSiteName?.trim() || PLATFORM_SEO.siteName
  const ogType = input.ogType?.trim() || 'website'
  const ogImageAlt = input.ogImageAlt?.trim() || siteName

  setMetaTag('property', 'og:type', ogType)
  setMetaTag('property', 'og:site_name', siteName)
  setMetaTag('property', 'og:title', title)
  setMetaTag('property', 'og:description', description)
  setMetaTag('property', 'og:url', canonical)
  setMetaTag('property', 'og:image', ogImage)
  setMetaTag('property', 'og:image:alt', ogImage ? ogImageAlt : null)
  setMetaTag('property', 'og:locale', 'en_US')

  const twitterCard = input.twitterCard || (ogImage ? 'summary_large_image' : 'summary')
  setMetaTag('name', 'twitter:card', twitterCard)
  setMetaTag('name', 'twitter:title', title)
  setMetaTag('name', 'twitter:description', description)
  setMetaTag('name', 'twitter:image', ogImage)

  setJsonLd(input.jsonLdId?.trim() || PAGE_JSON_LD_ID, input.jsonLd)
}

/** React helper — re-applies document SEO whenever inputs change. */
export function useDocumentSeo(input: DocumentSeoInput): void {
  const {
    title,
    description,
    keywords,
    canonicalPath,
    canonicalUrl,
    robots,
    noindex,
    ogType,
    ogImage,
    ogImageAlt,
    ogSiteName,
    twitterCard,
    jsonLd,
    jsonLdId,
  } = input
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : ''

  useEffect(() => {
    applyDocumentSeo({
      title,
      description,
      keywords,
      canonicalPath,
      canonicalUrl,
      robots,
      noindex,
      ogType,
      ogImage,
      ogImageAlt,
      ogSiteName,
      twitterCard,
      jsonLd,
      jsonLdId,
    })
    const ldId = jsonLdId?.trim() || PAGE_JSON_LD_ID
    return () => {
      if (typeof document !== 'undefined') document.getElementById(ldId)?.remove()
    }
  }, [
    title,
    description,
    keywords,
    canonicalPath,
    canonicalUrl,
    robots,
    noindex,
    ogType,
    ogImage,
    ogImageAlt,
    ogSiteName,
    twitterCard,
    jsonLdId,
    jsonLdKey,
  ])
}

export function vendorPageTitle(pageLabel: string, vendorName?: string | null): string {
  const name = vendorName?.trim()
  if (!name) return `${pageLabel} | ${PLATFORM_SEO.siteName}`
  return `${pageLabel} | ${name}`
}
