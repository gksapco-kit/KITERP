import { useMemo } from 'react'
import BlockRenderer, { mergePageStyle } from '@storefront/components/builder/BlockRenderer'
import type { PublicSite } from '@storefront/blocks/registry'
import { withSharedShellBlocks } from '@storefront/lib/storefrontLayoutChrome'
import { websiteBlockToPublicBlock } from '@/components/websites/SharedCanvasBlockPreview'
import type { WebsiteBlock } from '@/types/websites'

/**
 * Renders the full builder page exactly like DraftPreviewRenderer / live storefront.
 * Style merging and block layout match browser preview pixel-for-pixel.
 */
export function BuilderCanvasPageRenderer({
  publicSite,
  blocks,
  pageId,
  isHomepage = false,
}: {
  publicSite: PublicSite
  blocks: WebsiteBlock[]
  pageId: string | null
  isHomepage?: boolean
  /** @deprecated Canvas reconciles via `blocks` — do not use as React key (causes remount jank). */
  revision?: string
}) {
  const publicBlocks = useMemo(() => {
    const pageBlocks = blocks.map(websiteBlockToPublicBlock)
    if (!pageId) return pageBlocks

    const page = publicSite.pages?.find(p => p.id === pageId)
    if (!page) return pageBlocks

    return withSharedShellBlocks(publicSite, {
      id: page.id,
      is_homepage: isHomepage || page.is_homepage,
      blocks: pageBlocks,
    }).filter(b => b.visible !== false)
  }, [publicSite, blocks, pageId, isHomepage])

  return (
    <BlockRenderer
      key={pageId || publicSite.id}
      blocks={publicBlocks}
      site={publicSite}
      pageId={pageId}
    />
  )
}

export { mergePageStyle }
