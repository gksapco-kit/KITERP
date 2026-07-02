/** Resolve a public/ asset against Vite base (e.g. /vendor/ in production). */
export function publicAsset(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/')
  const rel = path.replace(/^\//, '')
  return `${base}${rel}`
}
