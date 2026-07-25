/** Platform admin app (frontend) origin for nested embeds inside vendor-web. */
export function adminAppOrigin(): string {
  const fromEnv = (import.meta.env.VITE_ADMIN_URL as string | undefined)?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  try {
    const ref = document.referrer
    if (ref) {
      const u = new URL(ref)
      if (u.pathname.startsWith('/dashboard')) {
        return u.origin
      }
    }
  } catch {
    /* ignore */
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    const normalized = host === 'localhost' || host === '[::1]' ? '127.0.0.1' : host
    return `${window.location.protocol}//${normalized}:3000`
  }

  return 'http://127.0.0.1:3000'
}
