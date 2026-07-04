import { useLocation, useParams } from 'react-router-dom'
import { useVendor } from '@/contexts/VendorContext'
import { useStorePath } from '@/hooks/useStorePath'
import { buildDraftCatalogEmbedStorePath, parseDraftCatalogEmbedPath } from '@/lib/draftCatalogEmbed'

const CART_DETAIL_PATH = '/cart'

/** Branch-aware URL for the storefront cart "Detail view" page. */
export function useProductCartDetailPath(): string {
  const storePath = useStorePath()
  const { vendorSlug: routeSlug, previewToken: routePreviewToken } = useParams<{
    vendorSlug?: string
    previewToken?: string
  }>()
  const { vendorSlug: ctxSlug } = useVendor()
  const { pathname } = useLocation()

  const slug = (routeSlug || ctxSlug || '').trim()
  const draft = parseDraftCatalogEmbedPath(pathname)
  const token = (draft?.previewToken || routePreviewToken || '').trim()

  if (slug && token) {
    return buildDraftCatalogEmbedStorePath(slug, token, 'cart')
  }

  const built = storePath(CART_DETAIL_PATH)
  const builtPath = built.split('?')[0]
  if (builtPath.includes('/cart') && builtPath.includes('/store/')) {
    return built
  }

  if (slug) {
    const branchQs = built.includes('?') ? built.slice(built.indexOf('?')) : ''
    return `/store/${encodeURIComponent(slug)}${CART_DETAIL_PATH}${branchQs}`
  }

  return built
}

export { CART_DETAIL_PATH }
