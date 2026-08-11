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
    const anyRentalsPage = builderSite?.pages?.find(p => p.slug === 'rentals') ?? null
    const page = anyRentalsPage?.is_published !== false ? anyRentalsPage : null
    if (!page?.blocks?.length) {
      return { rentalsPage: null, contentBlocks: [] as PublicBlock[] }
    }
    const blocks = stripSharedShellBlocksFromPage(page.blocks as PublicBlock[])
    return { rentalsPage: page, contentBlocks: blocks }
  }, [builderSite])

  // Still fetching site shell — avoid a content flash
  if (isLoading) return null

  return (
    <>
      {contentBlocks.length > 0 && rentalsPage && builderSite && (
        <BlockRenderer
          blocks={contentBlocks}
          site={builderSite}
          pageId={rentalsPage.id}
        />
      )}
      <RentalsPage />
    </>
  )
}
