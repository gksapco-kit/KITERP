/**
 * Renders the homepage nav/footer shell on catalog routes (products, services, …)
 * so the header matches builder pages instead of the legacy UnifiedNav.
 */
import { useSearchParams } from 'react-router-dom'
import BlockRenderer from '@/components/builder/BlockRenderer'
import { useBuilderSite } from '@/contexts/BuilderSiteContext'
import {
  builderSiteHomePage,
  siteFooterShellBlock,
  siteShellBlocks,
} from '@/lib/storefrontLayoutChrome'

export function BuilderSiteShellChrome({ part }: { part: 'header' | 'footer' }) {
  const { builderSite } = useBuilderSite()
  const [searchParams] = useSearchParams()
  const branchCode = searchParams.get('branch')

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
    return (
      <div className="sticky top-0 z-50 w-full">
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
