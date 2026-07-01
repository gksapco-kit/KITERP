import { useMemo } from 'react'
import BlockRenderer, { mergePageStyle, splitLeadingShellBlocks } from '@storefront/components/builder/BlockRenderer'
import type { PublicBlock, PublicSite } from '@storefront/blocks/registry'
import { withSharedShellBlocks } from '@storefront/lib/storefrontLayoutChrome'
import { websiteBlockToPublicBlock } from '@/components/websites/SharedCanvasBlockPreview'
import type { WebsiteBlock } from '@/types/websites'

export type BuilderCanvasShellLayout = 'default' | 'shell-only' | 'content-only'

function resolveBuilderPublicBlocks(
  publicSite: PublicSite,
  blocks: WebsiteBlock[],
  pageId: string | null,
  isHomepage: boolean,
): PublicBlock[] {
  const pageBlocks = blocks.map(websiteBlockToPublicBlock)
  if (!pageId) return pageBlocks

  const page = publicSite.pages?.find(p => p.id === pageId)
  if (!page) return pageBlocks

  return withSharedShellBlocks(publicSite, {
    id: page.id,
    is_homepage: isHomepage || page.is_homepage,
    blocks: pageBlocks,
  }).map(b => {
    if (b.visible !== false) return b
    return {
      ...b,
      visible: true,
      props: {
        ...(b.props as Record<string, unknown>),
        __builder_hidden_section: true,
      },
    }
  })
}

export function builderCanvasHasLeadingShell(
  publicSite: PublicSite,
  blocks: WebsiteBlock[],
  pageId: string | null,
  isHomepage = false,
): boolean {
  const publicBlocks = resolveBuilderPublicBlocks(publicSite, blocks, pageId, isHomepage)
  return splitLeadingShellBlocks(publicBlocks).shellBlocks.length > 0
}

export function BuilderCanvasPageRenderer({
  publicSite,
  blocks,
  pageId,
  isHomepage = false,
  shellLayout = 'default',
}: {
  publicSite: PublicSite
  blocks: WebsiteBlock[]
  pageId: string | null
  isHomepage?: boolean
  revision?: string
  shellLayout?: BuilderCanvasShellLayout
}) {
  const publicBlocks = useMemo(
    () => resolveBuilderPublicBlocks(publicSite, blocks, pageId, isHomepage),
    [publicSite, blocks, pageId, isHomepage],
  )

  const { shellBlocks, contentBlocks } = useMemo(
    () => splitLeadingShellBlocks(publicBlocks),
    [publicBlocks],
  )

  const blocksToRender = useMemo(() => {
    if (shellLayout === 'shell-only') return shellBlocks
    if (shellLayout === 'content-only') return contentBlocks
    return publicBlocks
  }, [shellLayout, shellBlocks, contentBlocks, publicBlocks])

  return (
    <BlockRenderer
      key={`${pageId || publicSite.id}:${shellLayout}`}
      blocks={blocksToRender}
      site={publicSite}
      pageId={pageId}
      suppressShellSticky={shellLayout !== 'default'}
    />
  )
}

export { mergePageStyle }
