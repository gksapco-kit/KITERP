/**
 * RentalsBuilderPage
 *
 * Combines the CMS website-builder layer (editable blocks) with the live
 * Rentals catalog.
 *
 * Visibility rules:
 *  - If a `rentals` page exists and is published, render its builder blocks above the catalog.
 *  - If the page is unpublished (or was never created), still show the live rentals catalog.
 *    Unpublishing only hides custom CMS blocks — not the marketplace itself.
 */
import { useMemo } from 'react'
import { useBuilderSite } from '@/contexts/BuilderSiteContext'
import BlockRenderer from '@/components/builder/BlockRenderer'
import { stripSharedShellBlocksFromPage } from '@/lib/storefrontLayoutChrome'
import RentalsPage from './RentalsPage'
import type { PublicBlock } from '@/blocks/registry'

export default function RentalsBuilderPage() {
  const { builderSite, isLoading } = useBuilderSite()

  const { rentalsPage, contentBlocks } = useMemo(() => {
    const pages = builderSite?.pages || []
    const anyRentalsPage =
      pages.find(p => String(p.slug || '').toLowerCase() === 'rentals')
      ?? pages.find(p => String(p.slug || '').toLowerCase() === 'rental')
      ?? null
    const page = anyRentalsPage?.is_published !== false ? anyRentalsPage : null
    if (!page?.blocks?.length) {
      return { rentalsPage: null, contentBlocks: [] as PublicBlock[] }
    }
    // Keep marketing/rental blocks; drop other catalog grids so a mis-built
    // "rentals" CMS page does not show products/services as if they were rentals.
    const OTHER_CATALOG_BLOCKS = new Set([
      'product_grid', 'product_list', 'product_carousel', 'featured_products',
      'service_grid', 'service_list', 'service_carousel', 'featured_services',
      'category_grid', 'menu_grid',
    ])
    const blocks = stripSharedShellBlocksFromPage(page.blocks as PublicBlock[])
      .filter(b => !OTHER_CATALOG_BLOCKS.has(b.block_type))
    return { rentalsPage: page, contentBlocks: blocks }
  }, [builderSite])

  return (
    <>
      {!isLoading && contentBlocks.length > 0 && rentalsPage && builderSite && (
        <BlockRenderer
          blocks={contentBlocks}
          site={builderSite}
          pageId={rentalsPage.id}
        />
      )}
      {/* Always show the live catalog — never blank the page while CMS shell loads */}
      <RentalsPage />
    </>
  )
}
