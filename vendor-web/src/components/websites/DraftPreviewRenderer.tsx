import { useMemo } from 'react'
import BlockRenderer from '@storefront/components/builder/BlockRenderer'
import type { PublicSite } from '@storefront/blocks/registry'
import { LiveDataFetchProvider, type LiveDataFetcher } from '@storefront/contexts/LiveDataFetchContext'
import { DraftCatalogPreview } from '@/components/websites/DraftCatalogPreview'
import { PreviewVendorProvider } from '@/components/websites/PreviewVendorProvider'
import type { PublicPreviewSite } from '@/lib/publicSitePreview'
import { findPublicPreviewPage } from '@/lib/publicSitePreview'
import { websiteApi } from '@/api/websites'
import { useVendorStore } from '@/stores/vendorStore'
import type { LiveResource } from '@/types/websites'

export function DraftPreviewRenderer({
  site,
  pageSlug,
  catalogRoute,
  vendorSlug,
  previewToken,
  onOpenBuilderPage,
}: {
  site: PublicPreviewSite
  pageSlug?: string | null
  catalogRoute?: string | null
  vendorSlug: string
  previewToken: string
  onOpenBuilderPage?: (pageSlug: string | null) => void
}) {
  const vendor = useVendorStore(s => s.vendor)
  const page = useMemo(() => findPublicPreviewPage(site, pageSlug), [site, pageSlug])

  const sitePageSlugs = useMemo(
    () =>
      new Set(
        (site.pages || [])
          .map(p => p.slug?.trim().toLowerCase())
          .filter((s): s is string => Boolean(s)),
      ),
    [site.pages],
  )

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

  const offeringType = useMemo(() => {
    const vendorOffering = vendor?.offering_type
    if (vendorOffering === 'products' || vendorOffering === 'services' || vendorOffering === 'both') {
      return vendorOffering
    }
    const style = (site.style_config || {}) as Record<string, unknown>
    const sellingMode = String(style.selling_mode || '').trim().toLowerCase()
    if (sellingMode === 'products' || sellingMode === 'services' || sellingMode === 'both') {
      return sellingMode as 'products' | 'services' | 'both'
    }
    return undefined
  }, [vendor?.offering_type, site.style_config])

  return (
    <PreviewVendorProvider
      slug={vendorSlug}
      siteName={site.name}
      previewToken={previewToken}
      sitePageSlugs={sitePageSlugs}
      openBuilderForPage={onOpenBuilderPage}
      offeringType={offeringType}
      socialLinks={vendor?.social_links}
    >
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
