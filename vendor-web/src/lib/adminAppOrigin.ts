/** Platform admin app base URL for nested embeds inside vendor-web. */
export function adminAppOrigin(): string {
  const fromEnv = (import.meta.env.VITE_ADMIN_URL as string | undefined)?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  if (typeof window !== 'undefined') {
    const { protocol, hostname, port, pathname, origin } = window.location
    const hostPort = port ? `${hostname}:${port}` : hostname

    // Prod path gateway: vendor at /vendor → admin SPA at /admin (same host).
    // Without this, Careers iframe falls back to :3000 and existing records never load.
    if (pathname.startsWith('/vendor')) {
      return `${protocol}//${hostPort}/admin`
    }

    try {
      const ref = document.referrer
      if (ref) {
        const u = new URL(ref)
        if (u.pathname.startsWith('/admin')) {
          return `${u.origin}/admin`
        }
        if (u.pathname.startsWith('/dashboard')) {
          return u.origin
        }
      }
    } catch {
      /* ignore */
    }

    // Local admin vite (port 3000)
    const normalized = hostname === 'localhost' || hostname === '[::1]' ? '127.0.0.1' : hostname
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
      return `${protocol}//${normalized}:3000`
    }

    return origin
  }

  return 'http://127.0.0.1:3000'
}
