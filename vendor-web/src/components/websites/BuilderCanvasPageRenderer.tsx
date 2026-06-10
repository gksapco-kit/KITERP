import BlockRenderer, { mergePageStyle } from '@storefront/components/builder/BlockRenderer'
import type { PublicSite } from '@storefront/blocks/registry'
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
}: {
  publicSite: PublicSite
  blocks: WebsiteBlock[]
  pageId: string | null
  /** @deprecated Canvas reconciles via `blocks` — do not use as React key (causes remount jank). */
  revision?: string
}) {
  const publicBlocks = blocks.map(websiteBlockToPublicBlock)

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
