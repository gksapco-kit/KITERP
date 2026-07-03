/** Resolve a public/ asset against Vite base (e.g. /vendor/ in production). */
export function publicAsset(path: string): string {
  const base = import.meta.env.BASE_URL || '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  const rel = path.replace(/^\//, '')
  return `${normalizedBase}${rel}`
}
