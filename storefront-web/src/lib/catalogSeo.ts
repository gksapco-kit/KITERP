import { absoluteUrl, PLATFORM_SEO, truncateMeta, type JsonLdValue } from '@/lib/documentSeo'
import { imgUrl } from '@/lib/utils'

type JsonLd = Record<string, unknown>

export function seoKeywords(value?: string[] | string | null): string | null {
  if (!value) return null
  if (Array.isArray(value)) {
    const joined = value.map((item) => String(item).trim()).filter(Boolean).join(', ')
    return joined || null
  }
  return value.trim() || null
}

export function seoImageUrl(url?: string | null): string | null {
  if (!url?.trim()) return null
  const resolved = imgUrl(url.trim()) || url.trim()
  return absoluteUrl(resolved)
}

export function stripToText(value?: string | null, max = 160): string | null {
  if (!value?.trim()) return null
  return truncateMeta(value, max)
}

export function organizationJsonLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: PLATFORM_SEO.siteName,
    url: absoluteUrl('/'),
    logo: absoluteUrl('/favicon-192.png'),
    description: PLATFORM_SEO.defaultDescription,
  }
}

export function websiteJsonLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: PLATFORM_SEO.siteName,
    url: absoluteUrl('/'),
    description: PLATFORM_SEO.defaultDescription,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${absoluteUrl('/partners')}?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
}

export function contactPageJsonLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: 'Contact KIT ERP',
    url: absoluteUrl('/contact'),
    description: 'Contact the KIT ERP team for platform support, partnerships, and onboarding help.',
    isPartOf: { '@type': 'WebSite', name: PLATFORM_SEO.siteName, url: absoluteUrl('/') },
  }
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>): JsonLd | null {
  if (items.length < 2) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function localBusinessJsonLd(input: {
  name: string
  description?: string | null
  url: string
  logo?: string | null
  telephone?: string | null
  email?: string | null
  street?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
  latitude?: number | null
  longitude?: number | null
}): JsonLd {
  const image = seoImageUrl(input.logo)
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: input.name,
    description: stripToText(input.description, 300),
    url: absoluteUrl(input.url),
    image: image || undefined,
    logo: image || undefined,
    telephone: input.telephone || undefined,
    email: input.email || undefined,
    address: (input.street || input.city || input.state || input.postalCode)
      ? {
          '@type': 'PostalAddress',
          streetAddress: input.street || undefined,
          addressLocality: input.city || undefined,
          addressRegion: input.state || undefined,
          postalCode: input.postalCode || undefined,
          addressCountry: input.country || undefined,
        }
      : undefined,
    geo: input.latitude != null && input.longitude != null
      ? {
          '@type': 'GeoCoordinates',
          latitude: input.latitude,
          longitude: input.longitude,
        }
      : undefined,
  }
}

export function productJsonLd(input: {
  name: string
  description?: string | null
  image?: string | null
  sku?: string | null
  brand?: string | null
  price?: number | null
  currency?: string | null
  availability?: string | null
  url: string
  rating?: number | null
  reviewCount?: number | null
}): JsonLd {
  const inStock = (input.availability || '').toLowerCase() !== 'out_of_stock'
  const image = seoImageUrl(input.image)
  const ld: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    description: stripToText(input.description, 500),
    image: image || undefined,
    sku: input.sku || undefined,
    brand: input.brand ? { '@type': 'Brand', name: input.brand } : undefined,
    url: absoluteUrl(input.url),
  }
  if (input.price != null && Number.isFinite(Number(input.price))) {
    ld.offers = {
      '@type': 'Offer',
      price: Number(input.price),
      priceCurrency: input.currency || 'INR',
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: absoluteUrl(input.url),
    }
  }
  if (input.rating != null && (input.reviewCount || 0) > 0) {
    ld.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: input.rating,
      reviewCount: input.reviewCount,
      bestRating: 5,
    }
  }
  return ld
}

export function serviceJsonLd(input: {
  name: string
  description?: string | null
  image?: string | null
  serviceType?: string | null
  price?: number | null
  currency?: string | null
  url: string
  providerName?: string | null
}): JsonLd {
  const image = seoImageUrl(input.image)
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: input.name,
    description: stripToText(input.description, 500),
    image: image || undefined,
    serviceType: input.serviceType || undefined,
    url: absoluteUrl(input.url),
    provider: input.providerName
      ? { '@type': 'LocalBusiness', name: input.providerName }
      : undefined,
    offers: input.price != null && Number.isFinite(Number(input.price))
      ? {
          '@type': 'Offer',
          price: Number(input.price),
          priceCurrency: input.currency || 'INR',
          url: absoluteUrl(input.url),
        }
      : undefined,
  }
}

export function articleJsonLd(input: {
  title: string
  description?: string | null
  image?: string | null
  url: string
  datePublished?: string | null
  authorName?: string | null
  publisherName?: string | null
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: stripToText(input.description, 300),
    image: seoImageUrl(input.image) || undefined,
    url: absoluteUrl(input.url),
    datePublished: input.datePublished || undefined,
    author: input.authorName
      ? { '@type': 'Person', name: input.authorName }
      : undefined,
    publisher: {
      '@type': 'Organization',
      name: input.publisherName || PLATFORM_SEO.siteName,
    },
  }
}

export function rentalJsonLd(input: {
  name: string
  description?: string | null
  image?: string | null
  url: string
  dailyRate?: number | null
  currency?: string
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    description: stripToText(input.description, 500),
    image: seoImageUrl(input.image) || undefined,
    url: absoluteUrl(input.url),
    offers: input.dailyRate != null && Number(input.dailyRate) > 0
      ? {
          '@type': 'Offer',
          price: Number(input.dailyRate),
          priceCurrency: input.currency || 'INR',
          url: absoluteUrl(input.url),
        }
      : undefined,
  }
}

export function faqJsonLd(items: Array<{ q: string; a: string }>): JsonLd | null {
  if (!items.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }
}

const JOB_TYPE_MAP: Record<string, string> = {
  full_time: 'FULL_TIME',
  part_time: 'PART_TIME',
  contract: 'CONTRACTOR',
  intern: 'INTERN',
  internship: 'INTERN',
  temporary: 'TEMPORARY',
}

export function jobPostingJsonLd(input: {
  title: string
  description?: string | null
  employmentType?: string | null
  location?: string | null
  datePosted?: string | null
  salaryMin?: number | null
  salaryMax?: number | null
}): JsonLd {
  const remote = /remote|hybrid|wfh|work from home/i.test(input.location || '')
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: input.title,
    description: stripToText(input.description, 5000) || input.title,
    datePosted: input.datePosted || undefined,
    employmentType: JOB_TYPE_MAP[(input.employmentType || '').toLowerCase()] || 'FULL_TIME',
    hiringOrganization: {
      '@type': 'Organization',
      name: PLATFORM_SEO.siteName,
      sameAs: absoluteUrl('/'),
    },
    jobLocation: remote
      ? undefined
      : {
          '@type': 'Place',
          address: {
            '@type': 'PostalAddress',
            addressLocality: input.location || undefined,
            addressCountry: 'IN',
          },
        },
    jobLocationType: remote ? 'TELECOMMUTE' : undefined,
    baseSalary: input.salaryMin != null || input.salaryMax != null
      ? {
          '@type': 'MonetaryAmount',
          currency: 'INR',
          value: {
            '@type': 'QuantitativeValue',
            minValue: input.salaryMin ?? undefined,
            maxValue: input.salaryMax ?? undefined,
            unitText: 'YEAR',
          },
        }
      : undefined,
  }
}

export function compactJsonLd(schemas: Array<JsonLd | null | undefined>): JsonLdValue | null {
  const items = schemas.filter((item): item is JsonLd => Boolean(item))
  if (!items.length) return null
  return items.length === 1 ? items[0] : items
}
