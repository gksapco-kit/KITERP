import type { WebsitePage, WebsiteSite } from '@/types/websites'

export const PAGE_SCHEMA_TYPES = [
  'auto',
  'webpage',
  'organization',
  'local_business',
  'product',
  'service',
  'faq_page',
  'article',
] as const

export type PageSchemaType = (typeof PAGE_SCHEMA_TYPES)[number]

export const SITE_SCHEMA_TYPES = ['auto', 'organization', 'local_business'] as const

export type SiteSchemaType = (typeof SITE_SCHEMA_TYPES)[number]

export const PAGE_SCHEMA_OPTIONS: { value: PageSchemaType; label: string; hint: string }[] = [
  { value: 'auto', label: 'Auto (from page sections)', hint: 'Product, FAQ, reviews, etc. are detected from your blocks.' },
  { value: 'webpage', label: 'WebPage', hint: 'General content page — uses this page’s title, summary, and URL.' },
  { value: 'organization', label: 'Organization', hint: 'Company or brand page — name, logo, site URL.' },
  { value: 'local_business', label: 'Local Business', hint: 'Shop with a physical location — address, phone, hours.' },
  { value: 'product', label: 'Product', hint: 'Single product landing page — uses SEO title, description, image.' },
  { value: 'service', label: 'Service', hint: 'Service offering page — uses SEO title and description.' },
  { value: 'faq_page', label: 'FAQ Page', hint: 'FAQ rich results — works best with an FAQ section on the page.' },
  { value: 'article', label: 'Article / Blog post', hint: 'Blog or news article — headline, summary, publisher.' },
]

export const SITE_SCHEMA_OPTIONS: { value: SiteSchemaType; label: string; hint: string }[] = [
  { value: 'auto', label: 'Auto (from site sections)', hint: 'Organization or Local Business from nav, footer, or contact sections.' },
  { value: 'organization', label: 'Organization', hint: 'Always tell Google your brand is an Organization.' },
  { value: 'local_business', label: 'Local Business', hint: 'Always tell Google you are a local shop or office.' },
]

const SCHEMA_LABELS: Record<string, string> = {
  WebSite: 'WebSite',
  BreadcrumbList: 'BreadcrumbList',
  WebPage: 'WebPage',
  Organization: 'Organization',
  LocalBusiness: 'Local Business',
  Product: 'Product',
  Service: 'Service',
  FAQPage: 'FAQ Page',
  Article: 'Article',
  Review: 'Review',
}

function pageSchemaLabel(type: PageSchemaType): string {
  const map: Record<PageSchemaType, string> = {
    auto: '',
    webpage: 'WebPage',
    organization: 'Organization',
    local_business: 'Local Business',
    product: 'Product',
    service: 'Service',
    faq_page: 'FAQ Page',
    article: 'Article',
  }
  return map[type]
}

function siteSchemaLabel(type: SiteSchemaType): string {
  if (type === 'organization') return 'Organization'
  if (type === 'local_business') return 'Local Business'
  return ''
}

/** Human-readable preview of JSON-LD types Google will receive. */
export function describeStructuredData(
  page: WebsitePage | null,
  site: WebsiteSite,
  pageSchemaType: PageSchemaType = 'auto',
  siteSchemaType: SiteSchemaType = 'auto',
): { types: string[]; note: string } {
  const types: string[] = ['WebSite']

  if (page && !page.is_homepage) {
    types.push('BreadcrumbList')
  }

  const siteLabel = siteSchemaLabel(siteSchemaType)
  if (siteLabel) {
    types.push(siteLabel)
  } else if (siteSchemaType === 'auto') {
    types.push('Organization or Local Business (if contact/nav sections exist)')
  }

  const pageLabel = pageSchemaLabel(pageSchemaType)
  if (page && pageLabel) {
    types.push(pageLabel)
  } else if (page && pageSchemaType === 'auto') {
    types.push('Product, Service, FAQ, Review… (from page sections)')
  }

  const selected = PAGE_SCHEMA_OPTIONS.find(o => o.value === pageSchemaType)
  const siteSelected = SITE_SCHEMA_OPTIONS.find(o => o.value === siteSchemaType)
  const note = page
    ? pageSchemaType === 'auto'
      ? selected?.hint ?? ''
    : pageSchemaType === 'faq_page'
      ? `${selected?.label ?? pageSchemaType} schema reads questions & answers from your FAQ section on this page.`
      : `${selected?.label ?? pageSchemaType} schema uses this page’s SEO title, summary, and share image.`
    : siteSelected?.hint ?? ''

  return {
    types: types.map(t => SCHEMA_LABELS[t] || t),
    note,
  }
}
