/**
 * Silk Atelier header on /products when the store layout does not inject the homepage shell
 * (draft-catalog embed, legacy paths). Renders announcement + maroon nav + white category row
 * and pins them while scrolling. Other templates are unaffected.
 */
import BlockRenderer from '@/components/builder/BlockRenderer'
import { useBuilderSite } from '@/contexts/BuilderSiteContext'
import { useBranch } from '@/contexts/BranchContext'
import { useLayoutOwnsShell } from '@/contexts/LayoutOwnsShellContext'
import {
  builderSiteHomePage,
  siteShellBlocks,
  siteUsesSilkAtelierCatalog,
} from '@/lib/storefrontLayoutChrome'

export function CatalogMegaNavBar() {
  const { builderSite } = useBuilderSite()
  const { branchCode } = useBranch()
  const layoutOwnsShell = useLayoutOwnsShell()

  if (!builderSite || !siteUsesSilkAtelierCatalog(builderSite) || layoutOwnsShell) {
    return null
  }

  const { blocks } = siteShellBlocks(builderSite)
  if (!blocks.length) return null

  const homePage = builderSiteHomePage(builderSite)

  return (
    <div className="w-full shrink-0 border-b border-black/[0.06] bg-white shadow-sm">
      <BlockRenderer
        blocks={blocks}
        site={builderSite}
        pageId={homePage?.id ?? null}
        branchCode={branchCode}
        suppressShellSticky
      />
    </div>
  )
}
