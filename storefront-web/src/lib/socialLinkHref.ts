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

  // Bare host/path without scheme — treat as https.
  if (/^[\w.-]+\.[a-z]{2,}/i.test(value) || value.startsWith('www.')) {
    return `https://${value.replace(/^\/\//, '')}`
  }

  return value
}
