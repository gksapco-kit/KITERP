/**
 * JSON-LD emitter — generates schema.org structured data per block type.
 *
 * Usage: call toJsonLd(blocks, site) to get a merged JSON-LD array that can
 * be injected into <script type="application/ld+json"> in the document head.
 *
 * Currently emits: Product, Service, LocalBusiness, FAQPage, Review,
 *   BreadcrumbList, Organization, WebSite.
 */
import type { PublicBlock, PublicPage, PublicSite, LiveItem } from './registry'

type JsonLdObject = Record<string, unknown>

/** Build a stable absolute base URL for the site (used by canonical + JSON-LD). */
export function siteBaseUrl(site: PublicSite): string {
  if (site.custom_domain) return `https://${site.custom_domain}`
  if (site.subdomain) return `https://${site.subdomain}.kiterp.com`
  return ''
}

function absoluteUrl(site: PublicSite, path: string | null | undefined): string | undefined {
  if (!path) return undefined
  if (/^https?:\/\//i.test(path)) return path
  const base = siteBaseUrl(site)
  if (!base) return path
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

function productSchema(item: LiveItem, site: PublicSite): JsonLdObject {
  const ld: JsonLdObject = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: item.title,
    description: item.description,
    image: item.image_url,
    sku: item.meta?.sku,
    brand: { '@type': 'Brand', name: item.subtitle },
    offers: {
      '@type': 'Offer',
      price: item.price,
      priceCurrency: (item.meta?.currency as string) || 'USD',
      availability: item.meta?.stock_status === 'out_of_stock'
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock',
      url: item.url ? (site.custom_domain ? `https://${site.custom_domain}${item.url}` : item.url) : undefined,
    },
    aggregateRating: item.rating != null ? {
      '@type': 'AggregateRating',
      ratingValue: item.rating,
      bestRating: 5,
      ratingCount: 1,
    } : undefined,
  }
  return ld
}

function serviceSchema(item: LiveItem): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: item.title,
    description: item.description,
    offers: item.price != null ? {
      '@type': 'Offer',
      price: item.price,
      priceCurrency: (item.meta?.currency as string) || 'USD',
    } : undefined,
    serviceType: item.subtitle || undefined,
  }
}

function localBusinessSchema(site: PublicSite, profileItem?: LiveItem): JsonLdObject {
  const meta = profileItem?.meta || {}
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: (meta.business_name as string) || site.name,
    description: (meta.description as string) || site.description,
    url: site.custom_domain ? `https://${site.custom_domain}` : site.subdomain ? `https://${site.subdomain}.kiterp.com` : undefined,
    logo: (meta.logo_url as string) || site.logo_url || undefined,
    telephone: (meta.phone as string) || undefined,
    email: (meta.email as string) || undefined,
    address: meta.address ? {
      '@type': 'PostalAddress',
      streetAddress: meta.address as string,
      addressLocality: meta.city as string,
      addressRegion: meta.state as string,
      addressCountry: meta.country as string,
    } : undefined,
    geo: meta.latitude && meta.longitude ? {
      '@type': 'GeoCoordinates',
      latitude: meta.latitude,
      longitude: meta.longitude,
    } : undefined,
    openingHoursSpecification: meta.business_hours
      ? Object.entries(meta.business_hours as Record<string, { open: string; close: string; closed?: boolean }>).map(([day, hours]) => ({
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: `https://schema.org/${day.charAt(0).toUpperCase() + day.slice(1)}`,
          opens: hours.open,
          closes: hours.close,
        })).filter(x => x.opens)
      : undefined,
  }
}

function faqSchema(faqs: Array<{ question: string; answer: string }>): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer,
      },
    })),
  }
}

function reviewSchema(item: LiveItem): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'Review',
    reviewRating: {
      '@type': 'Rating',
      ratingValue: item.rating || 5,
      bestRating: 5,
    },
    author: { '@type': 'Person', name: item.title },
    reviewBody: item.description,
  }
}

function organizationSchema(site: PublicSite, profileItem?: LiveItem): JsonLdObject {
  const meta = profileItem?.meta || {}
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: (meta.business_name as string) || site.name,
    url: site.custom_domain ? `https://${site.custom_domain}` : site.subdomain ? `https://${site.subdomain}.kiterp.com` : undefined,
    logo: (meta.logo_url as string) || site.logo_url || undefined,
    sameAs: Object.values((meta.social_links as Record<string, string>) || {}).filter(Boolean),
  }
}

function websiteSchema(site: PublicSite): JsonLdObject {
  const baseUrl = siteBaseUrl(site)
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.name,
    url: baseUrl,
    description: site.description || undefined,
    potentialAction: baseUrl ? {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${baseUrl}/products?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    } : undefined,
  }
}

/**
 * BreadcrumbList for the current page derived from the site's nav-visible
 * pages. Always anchors at the homepage; appends the current page when it
 * isn't the homepage. Returns null on the homepage so we don't emit a
 * single-item breadcrumb that adds no SEO value.
 */
function breadcrumbSchema(site: PublicSite, page: PublicPage): JsonLdObject | null {
  if (page.is_homepage) return null
  const baseUrl = siteBaseUrl(site)
  const items: JsonLdObject[] = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: baseUrl || '/',
    },
  ]

  // If the page slug looks nested ("services/cleaning"), emit intermediate
  // breadcrumbs for each segment using its label-cased version. Falls back
  // gracefully for flat slugs.
  const slug = (page.slug || '').replace(/^\/+|\/+$/g, '')
  const segments = slug ? slug.split('/').filter(Boolean) : []
  let acc = ''
  segments.forEach((seg, i) => {
    acc = acc ? `${acc}/${seg}` : seg
    const isLast = i === segments.length - 1
    items.push({
      '@type': 'ListItem',
      position: i + 2,
      name: isLast ? page.title || seg : seg.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      item: absoluteUrl(site, `/${acc}`),
    })
  })

  if (items.length < 2) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  }
}

/**
 * Generate all JSON-LD for a page's blocks + site.
 *
 * Pass `page` to also emit BreadcrumbList. `liveDataMap` is keyed by
 * `block.id` and supplies the live items needed by Product / Service /
 * Review / LocalBusiness / Organization schemas; pass an empty object to
 * skip those.
 */
export function buildPageJsonLd(
  blocks: PublicBlock[],
  site: PublicSite,
  liveDataMap: Record<string, LiveItem[]>,
  page?: PublicPage,
): JsonLdObject[] {
  const schemas: JsonLdObject[] = []

  schemas.push(websiteSchema(site))

  if (page) {
    const crumb = breadcrumbSchema(site, page)
    if (crumb) schemas.push(crumb)
  }

  let hasLocalBusiness = false
  let hasOrganization = false

  for (const block of blocks) {
    const items = liveDataMap[block.id] || []
    const p = block.props as Record<string, unknown>

    switch (block.block_type) {
      case 'product_grid':
      case 'related_products':
      case 'product_detail':
        for (const item of items) {
          schemas.push(productSchema(item, site))
        }
        break

      case 'services_cards':
      case 'booking_widget':
        for (const item of items) {
          schemas.push(serviceSchema(item))
        }
        break

      case 'contact_form':
      case 'map_embed':
      case 'about_split':
        if (!hasLocalBusiness) {
          schemas.push(localBusinessSchema(site, items[0]))
          hasLocalBusiness = true
        }
        break

      case 'footer':
      case 'nav':
        if (!hasOrganization) {
          schemas.push(organizationSchema(site, items[0]))
          hasOrganization = true
        }
        break

      case 'faq': {
        const faqs = p.faqs as Array<{ question: string; answer: string }> | undefined
        if (faqs?.length) schemas.push(faqSchema(faqs))
        break
      }

      case 'testimonials':
      case 'product_reviews':
        for (const item of items) {
          schemas.push(reviewSchema(item))
        }
        break
    }
  }

  return schemas
}

/** Render the JSON-LD as a <script> tag string. */
export function jsonLdScript(schemas: JsonLdObject[]): string {
  if (!schemas.length) return ''
  return `<script type="application/ld+json">${JSON.stringify(schemas.length === 1 ? schemas[0] : schemas, null, 0)}</script>`
}
