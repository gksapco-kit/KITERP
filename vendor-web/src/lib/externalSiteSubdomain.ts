const MIN_SUBDOMAIN_LENGTH = 3
const MAX_SUBDOMAIN_LENGTH = 50

/** Normalize user input into a valid wb_sites subdomain slug. */
export function normalizeSiteSubdomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SUBDOMAIN_LENGTH)
    .replace(/-+$/g, '')
}

/** Suggest a KIT subdomain from the site name (Other Use / external sites). */
export function suggestExternalSiteSubdomain(
  siteName: string,
  opts?: { siteId?: string; attempt?: number },
): string {
  const normalizedName = normalizeSiteSubdomain(siteName)
  let base = normalizedName || 'site'
  if (base.length < MIN_SUBDOMAIN_LENGTH) {
    base = normalizeSiteSubdomain(`${base}-site`) || 'my-site'
  }

  const attempt = opts?.attempt ?? 0
  if (attempt <= 0) return base

  const siteIdSuffix = opts?.siteId?.replace(/-/g, '').slice(0, 6).toLowerCase()
  const suffix = attempt === 1 && siteIdSuffix
    ? siteIdSuffix
    : String(attempt + 1)

  const trimmedBase = base
    .slice(0, Math.max(MIN_SUBDOMAIN_LENGTH, MAX_SUBDOMAIN_LENGTH - suffix.length - 1))
    .replace(/-$/, '')

  return normalizeSiteSubdomain(`${trimmedBase}-${suffix}`) || `site-${suffix}`
}

export function externalSitePublicUrl(subdomain: string): string {
  return `https://${normalizeSiteSubdomain(subdomain)}.kiterp.com`
}

/** True when an Other Use site still needs a public URL before going live. */
export function externalSiteNeedsLiveUrl(site: {
  subdomain?: string | null
  custom_domain?: string | null
}): boolean {
  return !site.subdomain?.trim() && !site.custom_domain?.trim()
}

/**
 * Persist a unique subdomain for an Other Use site, retrying with suffixes on collision.
 * Returns the subdomain that was saved.
 */
export async function assignExternalSiteSubdomainWithRetry(
  updateSubdomain: (subdomain: string) => Promise<unknown>,
  siteName: string,
  siteId: string,
  maxAttempts = 8,
): Promise<string> {
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = suggestExternalSiteSubdomain(siteName, { siteId, attempt })
    try {
      await updateSubdomain(candidate)
      return candidate
    } catch (err) {
      lastError = err
    }
  }
  throw lastError ?? new Error('Could not assign a unique subdomain')
}
