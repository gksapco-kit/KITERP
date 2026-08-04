/**
 * RentalsBuilderPage
 *
 * Combines the CMS website-builder layer (editable blocks) with the live
 * Rentals catalog.
 *
 * Visibility rules:
 *  - If the builder site has CMS pages and NONE of them is `rentals`
 *    (meaning the vendor deleted the page), redirect to home — the page
 *    should not be accessible at all.
 *  - If a `rentals` page exists, render its builder blocks above the catalog.
 *  - If no builder site at all (legacy/no builder), render the plain catalog.
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

  const { rentalsPage, contentBlocks, siteHasManagedPages } = useMemo(() => {
    const hasManagedPages = Boolean(builderSite?.pages?.length)
    const page = builderSite?.pages?.find(p => p.slug === 'rentals' && p.is_published !== false) ?? null
    if (!page?.blocks?.length) return { rentalsPage: null, contentBlocks: [] as PublicBlock[], siteHasManagedPages: hasManagedPages }
    const blocks = stripSharedShellBlocksFromPage(page.blocks as PublicBlock[])
    return { rentalsPage: page, contentBlocks: blocks, siteHasManagedPages: hasManagedPages }
  }, [builderSite])

  // Still fetching — don't flash a redirect
  if (isLoading) return null

  // The vendor has a builder site with CMS pages but deliberately deleted the
  // rentals page — honour that decision by sending the visitor to home.
  if (siteHasManagedPages && !rentalsPage) {
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
