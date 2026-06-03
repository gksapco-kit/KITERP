import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { recallDraftPreviewToken } from '@/lib/draftPreviewNavigation'

/** Legacy in-preview paths `/preview/draft/store/:slug/:page` → `?token=…&page=…`. */
export default function PreviewDraftStorePathRedirect() {
  const { '*': rest } = useParams()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')?.trim() || recallDraftPreviewToken()
  const page = (rest ?? '').replace(/^\/+/, '').split('?')[0].trim()

  const next = new URLSearchParams()
  if (token) next.set('token', token)
  if (page && page.toLowerCase() !== 'home') next.set('page', page)

  searchParams.forEach((value, key) => {
    if (key !== 'token' && key !== 'page') next.set(key, value)
  })

  const qs = next.toString()
  return <Navigate to={`/preview/draft${qs ? `?${qs}` : ''}`} replace />
}
