/** Keep in sync with frontend `lib/adminEmbedAuth.ts`. */
export const ADMIN_EMBED_NAVIGATE = 'kiterp:admin:embed-navigate'
export const ADMIN_EMBED_READY = 'kiterp:admin:embed-ready'
export const ADMIN_EMBED_NAVIGATED = 'kiterp:admin:embed-navigated'

export type AdminEmbedNavigateMessage = {
  type: typeof ADMIN_EMBED_NAVIGATE
  path: string
}

function normalizeHost(hostname: string): string {
  if (hostname === 'localhost' || hostname === '[::1]') return '127.0.0.1'
  return hostname
}

function isLoopbackHost(hostname: string): boolean {
  const h = normalizeHost(hostname)
  return h === '127.0.0.1'
}

function originsMatch(a: string, b: string): boolean {
  try {
    const ua = new URL(a)
    const ub = new URL(b)
    return normalizeHost(ua.hostname) === normalizeHost(ub.hostname) && ua.protocol === ub.protocol
  } catch {
    return false
  }
}

/** Accept admin parent origins (env, referrer, same-host gateway, local :3000). */
export function isTrustedAdminEmbedOrigin(origin: string): boolean {
  const candidates: string[] = []
  const fromEnv = (import.meta.env.VITE_ADMIN_URL as string | undefined)?.trim()
  if (fromEnv) {
    try {
      candidates.push(new URL(fromEnv).origin)
    } catch {
      /* ignore */
    }
  }
  try {
    if (document.referrer) candidates.push(new URL(document.referrer).origin)
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    const host = normalizeHost(window.location.hostname)
    const proto = window.location.protocol
    // Path-based prod: admin /admin and vendor /vendor share this origin.
    candidates.push(window.location.origin)
    if (isLoopbackHost(host)) {
      candidates.push(`${proto}//${host}:3000`)
      candidates.push(`${proto}//localhost:3000`)
      candidates.push(`${proto}//127.0.0.1:3000`)
    }
  }

  return candidates.some((c) => originsMatch(origin, c))
}

/** Only allow in-app relative paths (HR / vendor dashboard routes). */
export function sanitizeEmbedNavigatePath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const path = raw.trim()
  if (!path.startsWith('/') || path.startsWith('//')) return null
  if (path.includes('://')) return null
  // Strip accidental basename prefix if parent sends a full browser path.
  const basename = (import.meta.env.VITE_ROUTER_BASENAME || '').replace(/\/$/, '')
  if (basename && (path === basename || path.startsWith(`${basename}/`))) {
    const stripped = path.slice(basename.length) || '/'
    return stripped.split('#')[0] || null
  }
  return path.split('#')[0] || null
}
