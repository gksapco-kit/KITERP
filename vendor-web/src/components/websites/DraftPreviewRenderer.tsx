import { useMemo } from 'react'
import BlockRenderer from '@storefront/components/builder/BlockRenderer'
import type { PublicSite } from '@storefront/blocks/registry'
import { LiveDataFetchProvider, type LiveDataFetcher } from '@storefront/contexts/LiveDataFetchContext'
import { DraftCatalogPreview } from '@/components/websites/DraftCatalogPreview'
import { PreviewVendorProvider } from '@/components/websites/PreviewVendorProvider'
import type { PublicPreviewSite } from '@/lib/publicSitePreview'
import { findPublicPreviewPage } from '@/lib/publicSitePreview'
import { websiteApi } from '@/api/websites'
import type { LiveResource } from '@/types/websites'

export function DraftPreviewRenderer({
  site,
  pageSlug,
  catalogRoute,
  vendorSlug,
  previewToken,
}: {
  site: PublicPreviewSite
  pageSlug?: string | null
  catalogRoute?: string | null
  vendorSlug: string
  previewToken: string
}) {
  const page = useMemo(() => findPublicPreviewPage(site, pageSlug), [site, pageSlug])

  /** Draft sites are not published — public /live/* returns 404; use vendor auth like the builder canvas. */
  const liveFetcher = useMemo<LiveDataFetcher>(() => {
    return async (siteId, resource, limit) => {
      const r = await websiteApi.getLive(siteId, resource as LiveResource, { limit })
      return r.items ?? []
    }
  }, [])

  if (catalogRoute?.trim()) {
    return (
      <DraftCatalogPreview
        vendorSlug={vendorSlug}
        catalogRoute={catalogRoute.trim()}
        previewToken={previewToken}
        pageSlug={pageSlug}
      />
    )
  }

  if (!page) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-6 text-center text-gray-600">
        No page found for this preview.
      </div>
    )
  }

  const blocks = (page.blocks || []).filter(b => b.visible !== false)

  return (
    <PreviewVendorProvider slug={vendorSlug} siteName={site.name} previewToken={previewToken}>
      <LiveDataFetchProvider fetcher={liveFetcher}>
        <BlockRenderer
          blocks={blocks as PublicSite['pages'][0]['blocks']}
          site={site as PublicSite}
          pageId={page.id}
        />
      </LiveDataFetchProvider>
    </PreviewVendorProvider>
  )
}
