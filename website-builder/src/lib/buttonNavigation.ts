import type { Page } from '../types/builder'

/** Maps button link values to a page slug for in-app navigation. */
export function parseLinkToSlug(link: string | undefined, pages: Pick<Page, 'slug'>[]): string {
  const href = link?.trim() ?? ''

  if (!href || href === '#') {
    const products = pages.find((p) => p.slug === 'products')
    if (products) return 'products'
    const services = pages.find((p) => p.slug === 'services')
    if (services) return 'services'
    return pages.find((p) => p.slug === 'contact')?.slug ?? 'home'
  }

  if (href.startsWith('/site/')) return href.replace(/^\/site\/?/, '').split('/')[0] || 'home'
  if (href.startsWith('#')) {
    const slug = href.slice(1) || 'home'
    if (slug === 'login' || slug === 'signup') return slug
    return slug
  }
  if (href.startsWith('http://') || href.startsWith('https://')) return href

  return href.replace(/^\//, '')
}

export function isExternalLink(link: string | undefined): boolean {
  const href = link?.trim() ?? ''
  return href.startsWith('http://') || href.startsWith('https://')
}

export function createLinkClickHandler(options: {
  interactive: boolean
  link?: string
  pages: Pick<Page, 'slug'>[]
  onNavigate?: (slug: string) => void
}) {
  const { interactive, link, pages, onNavigate } = options

  return (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!interactive) {
      e.preventDefault()
      e.stopPropagation()
      return
    }

    e.preventDefault()
    e.stopPropagation()

    const href = link?.trim() ?? ''

    if (isExternalLink(href)) {
      window.open(href, '_blank', 'noopener,noreferrer')
      return
    }

    const slug = parseLinkToSlug(href, pages)

    if (onNavigate) {
      onNavigate(slug)
      return
    }

    window.location.assign(`/site/${slug}`)
  }
}
