import { useEffect } from 'react'

export type DocumentSeoInput = {
  title: string
  description?: string | null
  keywords?: string | null
  robots?: string | null
  noindex?: boolean
  ogType?: string | null
  ogImage?: string | null
  ogSiteName?: string | null
}

export const ADMIN_SEO = {
  siteName: 'KIT ERP',
  defaultTitle: 'KIT ERP — Business Management Platform',
  defaultDescription:
    'KIT ERP admin console for platform operations, business accounts, plans, templates, and website analytics.',
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

/** Admin / private surfaces — keep titles useful, discourage indexing. */
export function applyDocumentSeo(input: DocumentSeoInput): void {
  if (typeof document === 'undefined') return

  const title = input.title.trim() || ADMIN_SEO.defaultTitle
  document.title = title

  const description = input.description?.trim() || ADMIN_SEO.defaultDescription
  setMetaTag('name', 'description', description)
  setMetaTag('name', 'keywords', input.keywords?.trim() || null)

  const robots = input.noindex === false
    ? (input.robots?.trim() || 'index, follow')
    : (input.robots?.trim() || 'noindex, nofollow')
  setMetaTag('name', 'robots', robots)
  setMetaTag('name', 'googlebot', robots)

  const siteName = input.ogSiteName?.trim() || ADMIN_SEO.siteName
  setMetaTag('property', 'og:type', input.ogType?.trim() || 'website')
  setMetaTag('property', 'og:site_name', siteName)
  setMetaTag('property', 'og:title', title)
  setMetaTag('property', 'og:description', description)
  setMetaTag('property', 'og:image', input.ogImage?.trim() || null)
  setMetaTag('name', 'twitter:card', 'summary')
  setMetaTag('name', 'twitter:title', title)
  setMetaTag('name', 'twitter:description', description)
}

export function useDocumentSeo(input: DocumentSeoInput): void {
  const { title, description, keywords, robots, noindex, ogType, ogImage, ogSiteName } = input

  useEffect(() => {
    applyDocumentSeo({
      title,
      description,
      keywords,
      robots,
      noindex,
      ogType,
      ogImage,
      ogSiteName,
    })
  }, [title, description, keywords, robots, noindex, ogType, ogImage, ogSiteName])
}

export function adminPageTitle(pageLabel: string): string {
  if (!pageLabel || pageLabel === 'Dashboard') return ADMIN_SEO.defaultTitle
  return `${pageLabel} — ${ADMIN_SEO.siteName}`
}
