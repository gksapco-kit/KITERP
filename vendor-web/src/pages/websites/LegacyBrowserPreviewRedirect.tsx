import { Navigate, useSearchParams } from 'react-router-dom'

function parseTokenFromTarget(target: string): string | null {
  try {
    const m = new URL(target).pathname.match(/\/preview\/([^/]+)/)
    return m?.[1] ?? null
  } catch {
    return null
  }
}

/** Legacy paths → /preview/draft?token=… (vendor-web only). */
export default function LegacyBrowserPreviewRedirect() {
  const [params] = useSearchParams()
  const target = params.get('target')?.trim() ?? ''
  const token = params.get('token')?.trim()
    || (target ? parseTokenFromTarget(target) : null)
    || ''
  const page = params.get('page')?.trim()

  const next = new URLSearchParams()
  if (token) next.set('token', token)
  if (page) next.set('page', page)
  if (!token && target) next.set('target', target)

  const qs = next.toString()
  return <Navigate to={`/preview/draft${qs ? `?${qs}` : ''}`} replace />
}
