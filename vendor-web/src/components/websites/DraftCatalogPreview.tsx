import { ArrowLeft, ShoppingBag, Wrench, User, ShoppingCart } from 'lucide-react'
import { parseCatalogRouteParam, buildStorefrontCatalogEmbedUrl } from '@/lib/catalogStorePaths'
import { buildDraftPreviewStorePath } from '@/lib/draftPreviewNavigation'

function catalogPreviewLabel(catalogRoute: string): { title: string; Icon: typeof ShoppingBag } {
  const base = catalogRoute.split('?')[0].replace(/^\/+|\/+$/g, '')
  if (base === 'cart') return { title: 'Cart', Icon: ShoppingCart }
  if (base === 'login' || base === 'register') return { title: 'Sign in', Icon: User }
  if (base.startsWith('account')) return { title: 'Account', Icon: User }
  if (base === 'products') return { title: 'Products', Icon: ShoppingBag }
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
}: {
  vendorSlug: string
  catalogRoute: string
  previewToken: string
  pageSlug?: string | null
}) {
  const embedSrc = buildStorefrontCatalogEmbedUrl(vendorSlug, catalogRoute)
  const backHref = buildDraftPreviewStorePath(
    previewToken,
    pageSlug ? `/${pageSlug.replace(/^\/+/, '')}` : '/',
  )

  const { title, Icon } = catalogPreviewLabel(catalogRoute)

  return (
    <div className="flex min-h-[70vh] flex-col bg-white">
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2">
        <a
          href={backHref}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-200 hover:text-gray-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to site preview
        </a>
        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 truncate">
          <Icon className="h-3 w-3 shrink-0 opacity-70" />
          {title}
        </span>
      </div>
      <iframe
        src={embedSrc}
        title={`Catalog preview: ${title}`}
        className="min-h-0 flex-1 w-full border-0 bg-white"
        style={{ minHeight: 'calc(100vh - 120px)' }}
      />
    </div>
  )
}
