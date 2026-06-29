import type { LiveItem } from '@/blocks/registry'
import type { VendorData } from '@/contexts/VendorContext'

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const trimmed = typeof value === 'string' ? value.trim() : ''
    if (trimmed) return trimmed
  }
  return ''
}

function uniqueStrings(values: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const trimmed = value.trim()
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
  const primary = vendor?.support_email?.trim() || ''
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
  const primary = vendor?.support_phone?.trim() || ''
  if (primary) {
    return uniqueStrings([primary, ...extra.filter((p) => p.trim() !== primary)])
  }
  return uniqueStrings(extra)
}

/** All public-facing support emails (Business Settings), with account primary as fallback. */
export function collectBusinessContactEmails(
  profile: LiveItem | undefined,
  vendor: VendorData | null | undefined,
): string[] {
  const meta = profile?.meta as Record<string, unknown> | undefined
  const fromSettings = supportEmailsFromVendor(vendor)
  if (fromSettings.length > 0) return fromSettings

  const fromProfile = firstNonEmpty(meta?.support_email as string, meta?.email as string)
  if (fromProfile) return [fromProfile]

  const fallback = vendor?.primary_email?.trim()
  return fallback ? [fallback] : []
}

/** All public-facing support phones (Business Settings), with account primary as fallback. */
export function collectBusinessContactPhones(
  profile: LiveItem | undefined,
  vendor: VendorData | null | undefined,
): string[] {
  const meta = profile?.meta as Record<string, unknown> | undefined
  const fromSettings = supportPhonesFromVendor(vendor)
  if (fromSettings.length > 0) return fromSettings

  const fromProfile = firstNonEmpty(meta?.support_phone as string, meta?.phone as string)
  if (fromProfile) return [fromProfile]

  const fallback = vendor?.primary_phone?.trim()
  return fallback ? [fallback] : []
}

/** Public-facing contact email: Business Settings support email, then account primary. */
export function resolveBusinessContactEmail(
  propsEmail: string | undefined,
  profile: LiveItem | undefined,
  vendor: VendorData | null | undefined,
): string {
  const fromProps = propsEmail?.trim()
  if (fromProps) return fromProps
  return collectBusinessContactEmails(profile, vendor)[0] ?? ''
}

/** Public-facing contact phone: Business Settings support phone, then account primary. */
export function resolveBusinessContactPhone(
  propsPhone: string | undefined,
  profile: LiveItem | undefined,
  vendor: VendorData | null | undefined,
): string {
  const fromProps = propsPhone?.trim()
  if (fromProps) return fromProps
  return collectBusinessContactPhones(profile, vendor)[0] ?? ''
}

/** HQ / registered address for public contact blocks. */
export function resolveBusinessContactAddress(
  propsAddress: string | undefined,
  profile: LiveItem | undefined,
  vendor: VendorData | null | undefined,
): string {
  const fromProps = propsAddress?.trim()
  if (fromProps) return fromProps

  const fromVendor = [vendor?.street_address, vendor?.city, vendor?.state, vendor?.postal_code]
    .filter((part) => typeof part === 'string' && part.trim())
    .join(', ')
  if (fromVendor) return fromVendor

  const meta = profile?.meta as Record<string, unknown> | undefined
  return typeof meta?.address === 'string' ? meta.address.trim() : ''
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

  const address = resolveBusinessContactAddress(undefined, profile, vendor)
  if (address) {
    links.push({ label: address, href: '#', external: false })
  }

  return links
}
