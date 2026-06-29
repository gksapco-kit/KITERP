import { useMemo, type ReactNode } from 'react'
import BlockRenderer from '@storefront/components/builder/BlockRenderer'
import type { PublicSite } from '@storefront/blocks/registry'
import { siteShellBlocks, siteCookieConsentShellBlock, withSharedShellBlocks } from '@storefront/lib/storefrontLayoutChrome'
import { BuilderCanvasContextProvider } from '@storefront/contexts/BuilderCanvasContext'
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

  /** Draft sites are unpublished — contact forms use the authenticated vendor API like the builder canvas. */
  const draftPreviewCanvas = useMemo(
    () => ({
      isEditorCanvas: false,
      isDraftPreview: true,
      activeBlockId: null,
      activeTextField: null,
      activeTextFields: [] as string[],
      submitContactForm: (siteId: string, body: Record<string, unknown>) =>
        websiteApi.submitLiveContact(siteId, body),
    }),
    [],
  )

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

  const { homePage, blocks: shellBlocks } = useMemo(() => siteShellBlocks(site as PublicSite), [site])
  const cookieShellBlock = useMemo(() => siteCookieConsentShellBlock(site as PublicSite), [site])
  const hasNavShell = shellBlocks.some(b => b.block_type === 'nav')

  const catalogRouteTrimmed = catalogRoute?.trim() || null

  let pageContent: ReactNode

  if (catalogRouteTrimmed) {
    pageContent = (
      <DraftCatalogPreview
        vendorSlug={vendorSlug}
        catalogRoute={catalogRouteTrimmed}
        previewToken={previewToken}
        pageSlug={pageSlug}
        hideBreadcrumb={hasNavShell}
      />
    )
  } else if (!page) {
    pageContent = (
      <div className="flex min-h-[50vh] items-center justify-center px-6 text-center text-gray-600">
        No page found for this preview.
      </div>
    )
  } else {
    const blocks = withSharedShellBlocks(site as PublicSite, page).filter(b => b.visible !== false)
    pageContent = (
      <BlockRenderer
        blocks={blocks as PublicSite['pages'][0]['blocks']}
        site={site as PublicSite}
        pageId={page.id}
      />
    )
  }

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
        <BuilderCanvasContextProvider value={draftPreviewCanvas}>
          {catalogRouteTrimmed && shellBlocks.length > 0 && (
            <BlockRenderer
              blocks={shellBlocks as PublicSite['pages'][0]['blocks']}
              site={site as PublicSite}
              pageId={homePage?.id}
            />
          )}
          {pageContent}
          {catalogRouteTrimmed && cookieShellBlock && (
            <BlockRenderer
              blocks={[cookieShellBlock] as PublicSite['pages'][0]['blocks']}
              site={site as PublicSite}
              pageId={homePage?.id}
            />
          )}
        </BuilderCanvasContextProvider>
      </LiveDataFetchProvider>
    </PreviewVendorProvider>
  )
}
