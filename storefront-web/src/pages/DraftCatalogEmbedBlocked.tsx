import { Link, useParams } from 'react-router-dom'
import { buildDraftCatalogEmbedStorePath } from '@/lib/draftCatalogEmbed'

/** Shown when draft preview tries to open a non-catalog path (builder page, blog, …). */
export default function DraftCatalogEmbedBlocked() {
  const { vendorSlug, previewToken } = useParams<{ vendorSlug: string; previewToken: string }>()
  const productsHref =
    vendorSlug && previewToken
      ? buildDraftCatalogEmbedStorePath(vendorSlug, previewToken, 'products')
      : '/'

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-lg font-semibold text-foreground">Not available in site preview</p>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Website template pages are not shown in catalog preview. Use the builder preview for marketing pages.
      </p>
      <Link
        to={productsHref}
        className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        Back to products
      </Link>
    </div>
  )
}
