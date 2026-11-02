/**
 * Renders the homepage nav/footer shell on catalog routes (products, services, …)
 * so the header matches builder pages instead of the legacy UnifiedNav.
 */
import BlockRenderer from '@/components/builder/BlockRenderer'
import { useBuilderSite } from '@/contexts/BuilderSiteContext'
import { useBranch } from '@/contexts/BranchContext'
import {
  builderSiteHomePage,
  siteFooterShellBlock,
  siteShellBlocks,
  siteUsesSilkAtelierStickyHeader,
} from '@/lib/storefrontLayoutChrome'
import { cn } from '@/lib/utils'

export function BuilderSiteShellChrome({ part }: { part: 'header' | 'footer' }) {
  const { builderSite } = useBuilderSite()
  const { branchCode } = useBranch()

  if (!builderSite) return null

  const homePage = builderSiteHomePage(builderSite)
  const pageId = homePage?.id ?? null

  if (part === 'header') {
    const { blocks } = siteShellBlocks(builderSite)
    if (!blocks.length) return null
    // The layout owns the shell here, so BlockRenderer's own sticky wrapper would
    // be confined to this short header-only .builder-page and scroll away. Pin the
    // header from this outer wrapper (whose parent is the full-height layout column)
    // and suppress the inner sticky to avoid a nested, ineffective sticky context.
    const silkScrollAway = siteUsesSilkAtelierStickyHeader(builderSite)
    return (
      <div className={cn('w-full', !silkScrollAway && 'sticky top-0 z-50')}>
        <BlockRenderer
          blocks={blocks}
          site={builderSite}
          pageId={pageId}
          branchCode={branchCode}
          suppressShellSticky
        />
      </div>
    )
  }

  const footer = siteFooterShellBlock(builderSite)
  if (!footer) return null
  return (
    <BlockRenderer
      blocks={[footer]}
      site={builderSite}
      pageId={pageId}
      branchCode={branchCode}
    />
  )
}
