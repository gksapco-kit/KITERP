/**
 * HomeOrBuilder — smart home page that picks between:
 *  - React catalog templates (storefront_* — same as /template-browser/:id)
 *  - The BlockRenderer (published builder site without catalog template id)
 *  - The legacy Home.tsx (when no published builder site exists)
 */
import { useBuilderSite } from '@/contexts/BuilderSiteContext'
import BuilderPage from '@/pages/BuilderPage'
import Home from '@/pages/Home'
import CatalogStorefrontLiveHome from '@/pages/CatalogStorefrontLiveHome'
import { getWbCatalogTemplateId } from '@/storefront/catalogTemplateIds'

export default function HomeOrBuilder() {
  const { builderSite, isLoading } = useBuilderSite()

  if (isLoading) {
    return <BuilderPage isHome />
  }

  if (builderSite) {
    const catalogId = getWbCatalogTemplateId(builderSite.style_config as Record<string, unknown>)
    const homepage = builderSite.pages?.find(p => p.is_homepage) || builderSite.pages?.[0]
    const hasSavedBuilderBlocks = Boolean(homepage?.blocks?.length)

    if (catalogId && !hasSavedBuilderBlocks) {
      return <CatalogStorefrontLiveHome catalogTemplateId={catalogId} />
    }

    // No explicit catalog template but has a builder site with no saved blocks:
    // apply Services template as the default business front layout.
    if (!hasSavedBuilderBlocks) {
      return <CatalogStorefrontLiveHome catalogTemplateId="storefront_services" />
    }

    return <BuilderPage isHome />
  }

  return <Home />
}
