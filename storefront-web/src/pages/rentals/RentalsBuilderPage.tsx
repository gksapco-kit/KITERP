/**
 * RentalsBuilderPage
 *
 * Combines the CMS website-builder layer (editable blocks) with the live
 * Rentals catalog.
 *
 * Visibility rules:
 *  - If a `rentals` page exists and is explicitly unpublished, redirect to home.
 *  - If a `rentals` page exists and is published, render its builder blocks above the catalog.
 *  - If no `rentals` page was ever created (or no builder site at all), render the plain catalog.
 */
import { useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { useBuilderSite } from '@/contexts/BuilderSiteContext'
import { useStorePath } from '@/hooks/useStorePath'
import BlockRenderer from '@/components/builder/BlockRenderer'
import { stripSharedShellBlocksFromPage } from '@/lib/storefrontLayoutChrome'
import RentalsPage from './RentalsPage'
import type { PublicBlock } from '@/blocks/registry'

export default function RentalsBuilderPage() {
  const { builderSite, isLoading } = useBuilderSite()
  const storePath = useStorePath()

  const { rentalsPage, contentBlocks, rentalsPageExplicitlyUnpublished } = useMemo(() => {
    // Find any rentals page (published or not) so we can detect explicit unpublish.
    const anyRentalsPage = builderSite?.pages?.find(p => p.slug === 'rentals') ?? null
    const page = anyRentalsPage?.is_published !== false ? anyRentalsPage : null
    // If a rentals page exists in the builder but is explicitly set to unpublished,
    // honour that and redirect to home. If it was never created, show the catalog.
    const explicitlyUnpublished = Boolean(anyRentalsPage && anyRentalsPage.is_published === false)
    if (!page?.blocks?.length) return { rentalsPage: null, contentBlocks: [] as PublicBlock[], rentalsPageExplicitlyUnpublished: explicitlyUnpublished }
    const blocks = stripSharedShellBlocksFromPage(page.blocks as PublicBlock[])
    return { rentalsPage: page, contentBlocks: blocks, rentalsPageExplicitlyUnpublished: explicitlyUnpublished }
  }, [builderSite])

  // Still fetching — don't flash a redirect
  if (isLoading) return null

  // Only redirect when the vendor explicitly unpublished the rentals page.
  // If no rentals page was ever created in the builder, fall through to the catalog.
  if (rentalsPageExplicitlyUnpublished) {
    return <Navigate to={storePath('/')} replace />
  }

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
