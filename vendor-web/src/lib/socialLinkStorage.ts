/** Resolve a stored social link value into a clickable href. */
export function resolveSocialLinkHref(platform: string, raw: string): string {
  const value = raw.trim()
  if (!value) return ''

  const key = platform.toLowerCase()

  if (key === 'whatsapp') {
    if (/^https?:\/\//i.test(value) || value.startsWith('//')) return value
    if (value.startsWith('wa.me/')) return `https://${value}`
    const digits = value.replace(/^whatsapp:/i, '').replace(/\D/g, '')
    return digits ? `https://wa.me/${digits}` : ''
  }

  if (key === 'email' || value.startsWith('mailto:')) {
    return value.startsWith('mailto:') ? value : `mailto:${value}`
  }

  if (value.startsWith('tel:')) return value

  if (/^https?:\/\//i.test(value) || value.startsWith('//')) return value

  if (/^[\w.-]+\.[a-z]{2,}/i.test(value) || value.startsWith('www.')) {
    return `https://${value.replace(/^\/\//, '')}`
  }

  return value
}

/** Convert stored WhatsApp link back to a phone-friendly input value. */
export function socialLinkValueForInput(platform: string, stored: string): string {
  const value = stored.trim()
  if (!value) return ''
  if (platform.toLowerCase() !== 'whatsapp') return value

  if (/wa\.me\//i.test(value) || /^https?:\/\//i.test(value)) {
    const digits = value.replace(/\D/g, '')
    return digits ? `+${digits}` : value
  }

  return value
}

function normalizeUrlForStorage(raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value) || value.startsWith('//')) return value
  if (/^[\w.-]+\.[a-z]{2,}/i.test(value) || value.startsWith('www.')) {
    return `https://${value.replace(/^\/\//, '')}`
  }
  return value
}

/** Normalize social links before persisting to vendor / store settings. */
export function normalizeSocialLinksForSave(links: Record<string, string>): Record<string, string> {
  const cleaned: Record<string, string> = {}
  for (const [key, raw] of Object.entries(links)) {
    const value = raw.trim()
    if (!value) continue
    if (key.toLowerCase() === 'whatsapp') {
      const href = resolveSocialLinkHref('whatsapp', value)
      cleaned[key] = href || value
      continue
    }
    cleaned[key] = normalizeUrlForStorage(value)
  }
  return cleaned
}
