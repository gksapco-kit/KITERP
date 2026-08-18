import { useLocation, useParams } from 'react-router-dom'
import { useVendor } from '@/contexts/VendorContext'
import { useStorePath } from '@/hooks/useStorePath'
import { buildDraftCatalogEmbedStorePath, parseDraftCatalogEmbedPath } from '@/lib/draftCatalogEmbed'
import { storefrontPath } from '@/lib/storefrontPaths'

const CART_DETAIL_PATH = '/cart'

/** Branch-aware URL for the storefront cart page. */
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
  const expectedCart = slug ? storefrontPath(slug, CART_DETAIL_PATH) : ''
  if (builtPath.includes('/cart') && (builtPath === expectedCart || builtPath.includes('/store/'))) {
    return built
  }

  if (slug) {
    const branchQs = built.includes('?') ? built.slice(built.indexOf('?')) : ''
    return `${storefrontPath(slug, CART_DETAIL_PATH)}${branchQs}`
  }

  return built
}

export { CART_DETAIL_PATH }
