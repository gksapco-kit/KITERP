import { useEffect } from 'react'

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
  ogSiteName?: string | null
  twitterCard?: 'summary' | 'summary_large_image' | null
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

function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://kiterp.com'
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return `${origin}${path}`
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
    ? 'noindex, nofollow'
    : (input.robots?.trim() || null)
  setMetaTag('name', 'robots', robots)

  const canonical =
    input.canonicalUrl?.trim()
    || (input.canonicalPath != null ? absoluteUrl(input.canonicalPath) : null)
  setLinkTag('canonical', canonical)

  const ogImage = input.ogImage?.trim()
    ? absoluteUrl(input.ogImage.trim())
    : null
  const siteName = input.ogSiteName?.trim() || PLATFORM_SEO.siteName
  const ogType = input.ogType?.trim() || 'website'

  setMetaTag('property', 'og:type', ogType)
  setMetaTag('property', 'og:site_name', siteName)
  setMetaTag('property', 'og:title', title)
  setMetaTag('property', 'og:description', description)
  setMetaTag('property', 'og:url', canonical)
  setMetaTag('property', 'og:image', ogImage)
  setMetaTag('property', 'og:locale', 'en_US')

  const twitterCard = input.twitterCard || (ogImage ? 'summary_large_image' : 'summary')
  setMetaTag('name', 'twitter:card', twitterCard)
  setMetaTag('name', 'twitter:title', title)
  setMetaTag('name', 'twitter:description', description)
  setMetaTag('name', 'twitter:image', ogImage)
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
    ogSiteName,
    twitterCard,
  } = input

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
      ogSiteName,
      twitterCard,
    })
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
    ogSiteName,
    twitterCard,
  ])
}

export function vendorPageTitle(pageLabel: string, vendorName?: string | null): string {
  const name = vendorName?.trim()
  if (!name) return `${pageLabel} | ${PLATFORM_SEO.siteName}`
  return `${pageLabel} | ${name}`
}
