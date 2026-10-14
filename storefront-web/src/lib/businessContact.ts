import type { LiveItem } from '@/blocks/registry'
import type { VendorData } from '@/contexts/VendorContext'
import { formatPhoneDisplay } from '@/lib/phoneE164'

/** Treat dashes / n/a as empty so placeholder rows are not shown on the contact page. */
function meaningfulContactValue(value: string | null | undefined): string {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) return ''
  if (/^[-–—._\s]+$/.test(trimmed)) return ''
  if (/^(n\/?a|none|null|undefined)$/i.test(trimmed)) return ''
  return trimmed
}

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const trimmed = meaningfulContactValue(value)
    if (trimmed) return trimmed
  }
  return ''
}

function uniqueStrings(values: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const trimmed = meaningfulContactValue(value)
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

function supportEmailsFromVendor(vendor: VendorData | null | undefined): string[] {
  const settings = (vendor?.settings ?? {}) as Record<string, unknown>
  const extra = Array.isArray(settings.support_emails)
    ? (settings.support_emails as string[]).filter((e) => typeof e === 'string' && e.trim())
    : []
  const primary = meaningfulContactValue(vendor?.support_email)
  if (primary) {
    return uniqueStrings([primary, ...extra.filter((e) => e.trim().toLowerCase() !== primary.toLowerCase())])
  }
  return uniqueStrings(extra)
}

function supportPhonesFromVendor(vendor: VendorData | null | undefined): string[] {
  const settings = (vendor?.settings ?? {}) as Record<string, unknown>
  const extra = Array.isArray(settings.support_phones)
    ? (settings.support_phones as string[]).filter((p) => typeof p === 'string' && p.trim())
    : []
  const primary = meaningfulContactValue(vendor?.support_phone)
  if (primary) {
    return uniqueStrings([primary, ...extra.filter((p) => p.trim() !== primary)])
  }
  return uniqueStrings(extra)
}

/**
 * Public-facing support emails from Business Settings / active business unit only.
 * Does not fall back to account primary_email (vendor storefront only).
 */
export function collectBusinessContactEmails(
  profile: LiveItem | undefined,
  vendor: VendorData | null | undefined,
): string[] {
  const meta = profile?.meta as Record<string, unknown> | undefined
  const fromSettings = supportEmailsFromVendor(vendor)
  if (fromSettings.length > 0) return fromSettings

  const fromProfile = firstNonEmpty(meta?.support_email as string, meta?.email as string)
  return fromProfile ? [fromProfile] : []
}

/**
 * Public-facing support phones from Business Settings / active business unit only.
 * Does not fall back to account primary_phone (vendor storefront only).
 */
function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function formatAddressLine(parts: Array<string | null | undefined>): string {
  return parts.map((part) => meaningfulContactValue(part)).filter(Boolean).join(', ')
}

/**
 * Branch location and registered HQ, in that order.
 * Matching lines are returned once.
 */
export function collectBusinessContactAddresses(
  profile: LiveItem | undefined,
  vendor: VendorData | null | undefined,
): string[] {
  const meta = profile?.meta as Record<string, unknown> | undefined
  const hq = vendor?.registered_address
  const lines = [
    formatAddressLine([
      vendor?.street_address,
      vendor?.city,
      vendor?.state,
      vendor?.postal_code,
    ]),
    formatAddressLine([
      hq?.street_address,
      hq?.city,
      hq?.state,
      hq?.postal_code,
    ]),
    ...stringList(meta?.addresses),
  ]
  const unique = uniqueStrings(lines)
  if (unique.length > 0) return unique

  const fromProfile = meaningfulContactValue(typeof meta?.address === 'string' ? meta.address : undefined)
  return fromProfile ? [fromProfile] : []
}

export function collectBusinessContactPhones(
  profile: LiveItem | undefined,
  vendor: VendorData | null | undefined,
): string[] {
  const meta = profile?.meta as Record<string, unknown> | undefined
  const fromSettings = supportPhonesFromVendor(vendor)
  const fromProfile = uniqueStrings([
    ...stringList(meta?.phones),
    firstNonEmpty(meta?.support_phone as string, meta?.phone as string),
    ...stringList(meta?.support_phones),
  ])
  const chosen = fromSettings.length > 0 ? fromSettings : fromProfile
  return uniqueStrings(chosen.map((phone) => formatPhoneDisplay(phone)))
}

/**
 * Public-facing contact email from Business Settings / active BU only.
 * Empty when support email is not configured (row should be hidden).
 */
export function resolveBusinessContactEmail(
  _propsEmail: string | undefined,
  profile: LiveItem | undefined,
  vendor: VendorData | null | undefined,
): string {
  return collectBusinessContactEmails(profile, vendor)[0] ?? ''
}

/**
 * Public-facing contact phone from Business Settings / active BU only.
 * Empty when support phone is not configured (row should be hidden).
 */
export function resolveBusinessContactPhone(
  _propsPhone: string | undefined,
  profile: LiveItem | undefined,
  vendor: VendorData | null | undefined,
): string {
  return collectBusinessContactPhones(profile, vendor)[0] ?? ''
}

/** First public address line (branch, then registered HQ). */
export function resolveBusinessContactAddress(
  propsAddress: string | undefined,
  profile: LiveItem | undefined,
  vendor: VendorData | null | undefined,
): string {
  return collectBusinessContactAddresses(profile, vendor)[0] ?? meaningfulContactValue(propsAddress)
}

export function isFooterContactColumn(title: string): boolean {
  return /contact/i.test(title.trim())
}

export type FooterContactLink = { label: string; href: string; external?: boolean }

/** Live contact lines for a footer "Contact" column (Business Settings first). */
export function buildFooterContactLinks(
  profile: LiveItem | undefined,
  vendor: VendorData | null | undefined,
): FooterContactLink[] {
  const links: FooterContactLink[] = []

  for (const phone of collectBusinessContactPhones(profile, vendor)) {
    links.push({ label: phone, href: `tel:${phone.replace(/\s+/g, '')}`, external: true })
  }
  for (const email of collectBusinessContactEmails(profile, vendor)) {
    links.push({ label: email, href: `mailto:${email}`, external: true })
  }

  for (const address of collectBusinessContactAddresses(profile, vendor)) {
    links.push({ label: address, href: '#', external: false })
  }

  links.push({ label: 'Talk to us', href: '#talk-to-us', external: false })

  return links
}
