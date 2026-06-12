/**
 * Helpers for the External Domain feature.
 *
 * Two independent choices a vendor makes:
 *  - SCOPE: one domain shared by all business units (`all`) or a unique domain
 *    per business unit / store front (`per_unit`).
 *  - DNS MODE: the vendor configures the DNS records themselves (`self_managed`)
 *    or grants KIT ERP delegated registrar access so our team configures it
 *    (`kit_assisted`).
 */

export type ExternalDomainScope = 'all' | 'per_unit'
export type ExternalDomainDnsMode = 'kit_assisted' | 'self_managed'

/** Hostname customer storefronts are served from on the KIT ERP platform. */
export const KIT_STOREFRONT_ROOT = 'kiterp.com'

/** A single DNS record the vendor needs to create at their registrar. */
export interface DnsRecord {
  type: 'CNAME' | 'A' | 'TXT'
  /** Host / name field as entered at most registrars. */
  host: string
  /** Value / points-to / target field. */
  value: string
  /** Short human explanation of what the record does. */
  note: string
}

/** Strip protocol, path and leading `www.` to get a bare hostname. */
export function normalizeDomainInput(raw: string): string {
  let d = (raw ?? '').trim().toLowerCase()
  d = d.replace(/^https?:\/\//, '')
  d = d.replace(/\/.*$/, '')
  d = d.replace(/^www\./, '')
  return d
}

/** True when the domain is a bare apex (e.g. `acme.com`) rather than a sub-domain. */
export function isApexDomain(domain: string): boolean {
  const d = normalizeDomainInput(domain)
  if (!d) return false
  return d.split('.').filter(Boolean).length <= 2
}

/**
 * Deterministic, stable verification token derived from the vendor id.
 * Shown in a TXT record so the platform can confirm the vendor controls the domain.
 */
export function domainVerificationToken(vendorId: string | null | undefined): string {
  const id = (vendorId ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase()
  return `kit-domain-verify=${id.slice(0, 24) || 'pending'}`
}

/** CNAME target a custom domain should point to for this vendor. */
export function storefrontCnameTarget(vendorSlug: string | null | undefined): string {
  const slug = (vendorSlug ?? '').trim().toLowerCase()
  return slug ? `${slug}.${KIT_STOREFRONT_ROOT}` : KIT_STOREFRONT_ROOT
}

/**
 * DNS records the vendor must add at their registrar for `self_managed` setup.
 * Apex domains get an ALIAS/A-style note (registrars vary); sub-domains use a CNAME.
 */
export function buildSelfManagedDnsRecords(
  domainName: string,
  vendorSlug: string | null | undefined,
  vendorId: string | null | undefined,
): DnsRecord[] {
  const domain = normalizeDomainInput(domainName)
  const target = storefrontCnameTarget(vendorSlug)
  const apex = isApexDomain(domain)

  const records: DnsRecord[] = []

  if (apex) {
    records.push({
      type: 'CNAME',
      host: 'www',
      value: target,
      note: `Points www.${domain || 'yourdomain.com'} to your KIT ERP storefront.`,
    })
    records.push({
      type: 'A',
      host: '@',
      value: target,
      note: 'Root domain — use an ALIAS/ANAME record if your registrar supports it, otherwise forward the root to www.',
    })
  } else {
    const sub = domain.split('.')[0] || 'www'
    records.push({
      type: 'CNAME',
      host: sub,
      value: target,
      note: `Points ${domain || 'sub.yourdomain.com'} to your KIT ERP storefront.`,
    })
  }

  records.push({
    type: 'TXT',
    host: `_kit-verify${apex ? '' : `.${(domain.split('.')[0] || 'www')}`}`,
    value: domainVerificationToken(vendorId),
    note: 'Proves you control this domain. KIT ERP checks this before going live.',
  })

  return records
}
