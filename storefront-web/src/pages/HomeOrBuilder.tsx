/**
 * HomeOrBuilder — smart home page that picks between:
 *  - Default layouts (light/dark — legacy Home.tsx)
 *  - React catalog templates (storefront_* — same as /template-browser/:id)
 *  - Website builder block templates (portfolio, verde, …)
 *  - The BlockRenderer (published builder site without catalog template id)
 *  - The legacy Home.tsx (when no published builder site exists)
 */
import { Loader2 } from 'lucide-react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useBuilderSite } from '@/contexts/BuilderSiteContext'
import { useVendor } from '@/contexts/VendorContext'
import BuilderPage from '@/pages/BuilderPage'
import Home from '@/pages/Home'
import CatalogStorefrontLiveHome from '@/pages/CatalogStorefrontLiveHome'
import WebsiteBuilderTemplateLiveHome from '@/pages/WebsiteBuilderTemplateLiveHome'
import { recallDraftEmbedPreviewToken } from '@/lib/draftEmbedPreview'
import { buildDraftCatalogEmbedStorePath } from '@/lib/draftCatalogEmbed'
import { getWbCatalogTemplateId } from '@/storefront/catalogTemplateIds'
import { useAssignedStorefrontTemplateId, useAssignedStorefrontTemplatePending } from '@/hooks/useAssignedStorefrontTemplateId'
import {
  isDefaultLayoutTemplateId,
  isStorefrontCatalogTemplateId,
  isWebsiteBuilderBlockTemplateId,
  resolveLiveCatalogTemplateId,
  resolveSingleFrontTemplateId,
} from '@/lib/storefrontTemplateAssignment'

function renderBlockTemplateHome(templateId: string) {
  return <WebsiteBuilderTemplateLiveHome key={templateId} templateId={templateId} />
}

function renderAssignedTemplateHome(assignedTemplateId: string) {
  if (isDefaultLayoutTemplateId(assignedTemplateId)) {
    return <Home />
  }
  if (isStorefrontCatalogTemplateId(assignedTemplateId)) {
    return <CatalogStorefrontLiveHome catalogTemplateId={assignedTemplateId} />
  }
  if (isWebsiteBuilderBlockTemplateId(assignedTemplateId)) {
    return renderBlockTemplateHome(assignedTemplateId)
  }
  return null
}

export default function HomeOrBuilder() {
  const { builderSite, isLoading: builderSiteLoading } = useBuilderSite()
  const { vendor } = useVendor()
  const { vendorSlug } = useParams<{ vendorSlug: string }>()
  const [searchParams] = useSearchParams()
  const assignedTemplateId = useAssignedStorefrontTemplateId()
  const templatePending = useAssignedStorefrontTemplatePending()

  const draftEmbed = searchParams.get('draft_embed') === '1'
  const draftPreviewToken = searchParams.get('preview_token')?.trim() || recallDraftEmbedPreviewToken()
  if (draftEmbed && draftPreviewToken && vendorSlug) {
    return <Navigate to={buildDraftCatalogEmbedStorePath(vendorSlug, draftPreviewToken, 'products')} replace />
  }

  if (templatePending) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (assignedTemplateId) {
    const assignedHome = renderAssignedTemplateHome(assignedTemplateId)
    if (assignedHome) {
      return assignedHome
    }
  }

  if (builderSiteLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (builderSite) {
    const homepage = builderSite.pages?.find(p => p.is_homepage) || builderSite.pages?.[0]
    const hasSavedBuilderBlocks = Boolean(homepage?.blocks?.length)

    if (hasSavedBuilderBlocks) {
      return <BuilderPage isHome />
    }

    const catalogId = resolveLiveCatalogTemplateId(
      assignedTemplateId,
      getWbCatalogTemplateId(builderSite.style_config as Record<string, unknown>),
    )
    if (isWebsiteBuilderBlockTemplateId(catalogId)) {
      return renderBlockTemplateHome(catalogId)
    }
    return <CatalogStorefrontLiveHome catalogTemplateId={catalogId} />
  }

  // Only show legacy Home when no template is assigned anywhere.
  const vendorTemplateId = resolveSingleFrontTemplateId(vendor?.settings as Record<string, unknown> | undefined)
  if (vendorTemplateId) {
    const vendorHome = renderAssignedTemplateHome(vendorTemplateId)
    if (vendorHome) return vendorHome
  }

  return <Home />
}
