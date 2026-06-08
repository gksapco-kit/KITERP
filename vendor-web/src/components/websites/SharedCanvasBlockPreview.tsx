import { SingleBlock } from '@storefront/components/builder/BlockRenderer'
import type { PublicBlock, PublicSite, StyleConfig } from '@storefront/blocks/registry'
import type { WebsiteBlock } from '@/types/websites'

export function websiteBlockToPublicBlock(block: WebsiteBlock): PublicBlock {
  return {
    id: block.id,
    page_id: block.page_id,
    block_type: block.block_type,
    label: block.label,
    props: (block.props ?? {}) as Record<string, unknown>,
    style_overrides: (block.style_overrides ?? {}) as Record<string, unknown>,
    visible: block.visible !== false,
    visible_on_mobile: block.visible_on_mobile !== false,
    visible_on_tablet: block.visible_on_tablet !== false,
    visible_on_desktop: block.visible_on_desktop !== false,
    animation: block.animation ?? null,
    animation_delay: block.animation_delay ?? 0,
    sort_order: block.sort_order ?? 0,
    visible_branches: ((block.props ?? {}) as { _visible_branches?: string[] })._visible_branches,
  }
}

/** Builder canvas block — same renderer as browser preview and published storefront. */
export function SharedCanvasBlockPreview({
  block,
  style,
  publicSite,
  pageBlocks,
}: {
  block: WebsiteBlock
  style: StyleConfig
  publicSite: PublicSite
  pageBlocks?: WebsiteBlock[]
}) {
  return (
    <SingleBlock
      block={websiteBlockToPublicBlock(block)}
      site={publicSite}
      style={style}
      pageBlocks={pageBlocks?.map(websiteBlockToPublicBlock)}
    />
  )
}
