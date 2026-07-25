import { Outlet } from 'react-router-dom'
import { useDocumentSeo, adminPageTitle } from '@/lib/documentSeo'

/** Minimal chrome for admin pages embedded inside vendor-web (platform HR iframe). */
export default function EmbedLayout() {
  useDocumentSeo({
    title: adminPageTitle('Embedded'),
    noindex: true,
  })

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4">
      <Outlet />
    </div>
  )
}
