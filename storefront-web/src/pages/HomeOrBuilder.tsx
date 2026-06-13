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
import { useAssignedStorefrontTemplateId } from '@/hooks/useAssignedStorefrontTemplateId'
import {
  isLegacyHomeTemplateId,
  isStorefrontCatalogTemplateId,
  resolveLiveCatalogTemplateId,
} from '@/lib/storefrontTemplateAssignment'

export default function HomeOrBuilder() {
  const { builderSite, isLoading } = useBuilderSite()
  const assignedTemplateId = useAssignedStorefrontTemplateId()

  if (isLoading) {
    return <BuilderPage isHome />
  }

  if (builderSite) {
    const homepage = builderSite.pages?.find(p => p.is_homepage) || builderSite.pages?.[0]
    const hasSavedBuilderBlocks = Boolean(homepage?.blocks?.length)

    if (hasSavedBuilderBlocks) {
      return <BuilderPage isHome />
    }

    if (assignedTemplateId && isLegacyHomeTemplateId(assignedTemplateId)) {
      return <Home />
    }

    const catalogId = resolveLiveCatalogTemplateId(
      assignedTemplateId,
      getWbCatalogTemplateId(builderSite.style_config as Record<string, unknown>),
    )
    return <CatalogStorefrontLiveHome catalogTemplateId={catalogId} />
  }

  if (assignedTemplateId && isStorefrontCatalogTemplateId(assignedTemplateId)) {
    return <CatalogStorefrontLiveHome catalogTemplateId={assignedTemplateId} />
  }

  return <Home />
}
