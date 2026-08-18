import { resolveSocialLinkHref } from '@/lib/socialLinkHref'

export type PartnerVendor = {
  slug: string
  display_name: string
  business_name: string
  logo_url?: string | null
  street_address?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
  latitude?: number | null
  longitude?: number | null
  store_name?: string | null
  social_links?: {
    whatsapp?: string
    website?: string
  } | null
  business_hours?: Record<string, { open?: string; close?: string; closed?: boolean }> | null
  visit_count?: number
  description?: string | null
}

const DAY_ORDER = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

function formatClock(raw?: string): string {
  if (!raw) return ''
  const cleaned = raw.trim()
  if (!cleaned) return ''
  // Already human-readable (e.g. 10:00AM)
  if (/[ap]m/i.test(cleaned)) return cleaned.replace(/\s+/g, '')
  const m = cleaned.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return cleaned
  let h = Number(m[1])
  const min = m[2]
  const suffix = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${min}${suffix}`
}

/** Prefer today's hours; otherwise first open day in the week. */
export function formatPartnerTimings(
  hours?: PartnerVendor['business_hours'] | null,
): string | null {
  if (!hours || typeof hours !== 'object') return null
  const todayKey = DAY_ORDER[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]
  const candidates = [todayKey, ...DAY_ORDER.filter((d) => d !== todayKey)]
  for (const day of candidates) {
    const entry = hours[day] || hours[day.charAt(0).toUpperCase() + day.slice(1)]
    if (!entry || entry.closed) continue
    const open = formatClock(entry.open)
    const close = formatClock(entry.close)
    if (open && close) return `Timings: ${open} - ${close}`
  }
  return null
}

const PLACEHOLDER_LOCATION = /^(?:[-–—._\s]+|n\/?a|null|undefined|none|unknown|0+)$/i

export function cleanLocationPart(value?: string | null): string {
  const part = (value || '').trim()
  if (!part || PLACEHOLDER_LOCATION.test(part)) return ''
  return part
}

export function formatPartnerLocation(v: PartnerVendor): string {
  const parts = [v.street_address, v.city, v.state, v.postal_code]
    .map(cleanLocationPart)
    .filter(Boolean)
  return parts.join(', ')
}

export function partnerWhatsAppHref(v: PartnerVendor): string | null {
  const raw = v.social_links?.whatsapp?.trim()
  if (!raw) return null
  return resolveSocialLinkHref('whatsapp', raw) || null
}

export function partnerWebsiteHref(v: PartnerVendor): string | null {
  const raw = v.social_links?.website?.trim()
  if (!raw) return null
  return resolveSocialLinkHref('website', raw) || null
}

/** External website if set; otherwise the partner storefront on this platform. */
export function partnerSiteHref(v: PartnerVendor): { href: string; external: boolean } {
  const website = partnerWebsiteHref(v)
  if (website) return { href: website, external: true }
  return { href: `/${v.slug}`, external: false }
}

export function partnerMapsHref(v: PartnerVendor): string | null {
  if (v.latitude != null && v.longitude != null) {
    return `https://www.google.com/maps?q=${v.latitude},${v.longitude}`
  }
  const location = formatPartnerLocation(v)
  if (!location) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
}

export function partnerDisplayName(v: PartnerVendor): string {
  return v.display_name || v.business_name || v.slug
}
