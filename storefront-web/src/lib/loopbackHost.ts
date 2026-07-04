/** Windows + Docker: prefer 127.0.0.1 over localhost / ::1 for browser → host API calls. */
export function normalizeLoopbackHostname(hostname: string): string {
  if (hostname === 'localhost' || hostname === '[::1]') return '127.0.0.1'
  return hostname
}

export function normalizeLoopbackInUrl(url: string): string {
  if (!url || url.startsWith('/')) return url
  try {
    const u = new URL(url)
    u.hostname = normalizeLoopbackHostname(u.hostname)
    return u.toString().replace(/\/$/, '')
  } catch {
    return url
  }
}

export function normalizeLoopbackOrigin(origin: string): string {
  try {
    const u = new URL(origin)
    u.hostname = normalizeLoopbackHostname(u.hostname)
    return u.origin
  } catch {
    return origin
  }
}
