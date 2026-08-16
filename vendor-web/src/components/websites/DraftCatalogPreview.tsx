import { ShoppingBag, Wrench, User, ShoppingCart, Home, Newspaper, Mail, Package } from 'lucide-react'
import { parseCatalogRouteParam, buildStorefrontCatalogEmbedUrl } from '@/lib/catalogStorePaths'
import { buildDraftPreviewPageUrl } from '@/lib/draftPreviewNavigation'
import { getDraftBrowserPreviewAbsolutePath, getVendorPreviewOrigin } from '@/lib/storefrontPreviewUrl'

function catalogPreviewLabel(catalogRoute: string): { title: string; Icon: typeof ShoppingBag } {
  const base = catalogRoute.split('?')[0].replace(/^\/+|\/+$/g, '')
  if (base === 'cart') return { title: 'Cart', Icon: ShoppingCart }
  if (base === 'checkout') return { title: 'Checkout', Icon: ShoppingCart }
  if (base.startsWith('order/') && base.includes('/confirmation')) return { title: 'Order confirmation', Icon: ShoppingBag }
  if (base === 'login' || base === 'register') return { title: 'Sign in', Icon: User }
  if (base.startsWith('account')) return { title: 'Account', Icon: User }
  if (base === 'products') return { title: 'Products', Icon: ShoppingBag }
  if (base === 'blog' || base.startsWith('blog/')) return { title: 'Blog', Icon: Newspaper }
  if (base === 'contact') return { title: 'Contact', Icon: Mail }
  if (base === 'rentals' || base.startsWith('rentals/')) return { title: 'Rentals', Icon: Package }
  const parsed = parseCatalogRouteParam(catalogRoute)
  if (!parsed) return { title: catalogRoute, Icon: ShoppingBag }
  if (parsed.kind === 'services') {
    const name = parsed.slug?.replace(/\/book$/i, '') || 'Service'
    return {
      title: parsed.slug?.endsWith('/book') ? `Book · ${name}` : name,
      Icon: Wrench,
    }
  }
  if (parsed.kind === 'categories') {
    return { title: parsed.slug || 'Category', Icon: ShoppingBag }
  }
  return { title: parsed.slug || 'Product', Icon: ShoppingBag }
}

/**
 * Catalog pages (product detail, service detail) live on the storefront app.
 * Embed them in an iframe so the browser stays on vendor-web /preview/draft (3001).
 */
export function DraftCatalogPreview({
  vendorSlug,
  catalogRoute,
  previewToken,
  pageSlug,
  hideBreadcrumb = false,
}: {
  vendorSlug: string
  catalogRoute: string
  previewToken: string
  pageSlug?: string | null
  /** When the builder nav block is rendered above the iframe, hide the minimal breadcrumb bar. */
  hideBreadcrumb?: boolean
}) {
  const embedSrc = buildStorefrontCatalogEmbedUrl(vendorSlug, catalogRoute, previewToken)
  const backHref = (() => {
    const relative = buildDraftPreviewPageUrl(previewToken, pageSlug)
    const qs = relative.includes('?') ? relative.slice(relative.indexOf('?')) : ''
    return `${getVendorPreviewOrigin()}${getDraftBrowserPreviewAbsolutePath()}${qs}`
  })()

  const { title, Icon } = catalogPreviewLabel(catalogRoute)

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      {!hideBreadcrumb && (
        <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2">
          <a
            href={backHref}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-200 hover:text-gray-900"
          >
            <Home className="h-3.5 w-3.5" aria-hidden />
            Home
          </a>
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 truncate">
            <Icon className="h-3 w-3 shrink-0 opacity-70" />
            {title}
          </span>
        </div>
      )}
      <iframe
        src={embedSrc}
        title={`Catalog preview: ${title}`}
        className="min-h-0 w-full flex-1 border-0 bg-white"
        style={{ minHeight: hideBreadcrumb ? 'calc(100vh - 180px)' : 'calc(100vh - 120px)' }}
      />
    </div>
  )
}
