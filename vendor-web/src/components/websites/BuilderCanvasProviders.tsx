import { type ReactNode, useMemo } from 'react'
import { VendorContext, type VendorContextType, type VendorData } from '@storefront/contexts/VendorContext'
import { LiveDataFetchProvider, type LiveDataFetcher } from '@storefront/contexts/LiveDataFetchContext'
import { BuilderCanvasContextProvider } from '@storefront/contexts/BuilderCanvasContext'
import type { ActiveCanvasImageTarget } from '@storefront/lib/canvasImageTarget'
import type { LiveResource } from '@storefront/blocks/registry'
import { websiteApi } from '@/api/websites'

const DEFAULT_PRODUCT_DISPLAY: Record<string, boolean> = {
  brand: true, short_description: true, specifications: true, warranty: true,
  return_policy: true, shipping_info: true, offer_label: true, sku: true,
  stock_status: true, tags: true,
}

const DEFAULT_SERVICE_DISPLAY: Record<string, boolean> = {
  brand: true, short_description: true, whats_included: true, whats_not_included: true,
  prerequisites: true, service_areas: true, cancellation_policy: true, offer_label: true,
  service_mode: true, tags: true,
}

/**
 * VendorContext + authenticated live-data fetch for the builder canvas.
 * Matches DraftPreviewRenderer / BlockRenderer on the storefront.
 */
export function BuilderCanvasProviders({
  siteId,
  vendorSlug,
  siteName,
  activeBlockId = null,
  activeTextField = null,
  activeTextFields = [],
  activeCanvasImageTarget = null,
  blockPropsForImage = null,
  canvasScale = 1,
  onSectionImageActivate,
  onTextFieldActivate,
  onTextFieldCommit,
  onTextFieldStylePatch,
  onTextFieldBatchStylePatch,
  onNavigate,
  onPropLinkEdit,
  children,
}: {
  siteId: string
  vendorSlug: string
  siteName?: string
  activeBlockId?: string | null
  activeTextField?: string | null
  activeTextFields?: string[]
  activeCanvasImageTarget?: ActiveCanvasImageTarget | null
  blockPropsForImage?: Record<string, unknown> | null
  canvasScale?: number
  onSectionImageActivate?: (
    blockId: string,
    field: string,
    opts?: { arrayKey?: string; index?: number; itemField?: string; additive?: boolean },
  ) => void
  onTextFieldActivate?: (
    blockId: string,
    fieldKey: string,
    opts?: { additive?: boolean; clientX?: number; clientY?: number },
  ) => void
  onTextFieldCommit?: (blockId: string, fieldKey: string, value: string) => void
  onTextFieldStylePatch?: (blockId: string, fieldKey: string, patch: Record<string, unknown>) => void
  onTextFieldBatchStylePatch?: (
    blockId: string,
    patchesByField: Record<string, Record<string, unknown>>,
  ) => void
  onNavigate?: (url: string) => void
  onPropLinkEdit?: (
    blockId: string,
    propKey: string,
    anchor: { x: number; y: number },
  ) => void
  children: ReactNode
}) {
  const vendorValue = useMemo<VendorContextType>(() => {
    const vendor: VendorData = {
      id: vendorSlug,
      business_name: siteName || vendorSlug,
      display_name: siteName || vendorSlug,
      slug: vendorSlug,
      theme_config: {},
      primary_email: '',
      primary_phone: '',
      settings: {},
    }
    return {
      vendor,
      vendorSlug,
      isLoading: false,
      error: null,
      storePath: (p: string) => (p.startsWith('/') ? p : `/${p}`),
      displayFields: {
        product: DEFAULT_PRODUCT_DISPLAY,
        service: DEFAULT_SERVICE_DISPLAY,
      },
    }
  }, [vendorSlug, siteName])

  const liveFetcher = useMemo<LiveDataFetcher>(() => {
    return async (sid: string, resource: LiveResource, limit: number) => {
      const r = await websiteApi.getLive(sid, resource, { limit })
      return r.items ?? []
    }
  }, [])

  // siteId is kept for future scoped fetch overrides; live fetcher uses sid from SingleBlock.
  void siteId

  const builderCanvasValue = useMemo(() => ({
    isEditorCanvas: true,
    activeBlockId,
    activeTextField,
    activeTextFields,
    activeCanvasImageTarget,
    blockPropsForImage,
    canvasScale,
    onSectionImageActivate,
    onTextFieldActivate,
    onTextFieldCommit,
    onTextFieldStylePatch,
    onTextFieldBatchStylePatch,
    onNavigate,
    onPropLinkEdit,
  }), [
    activeBlockId,
    activeTextField,
    activeTextFields,
    activeCanvasImageTarget,
    blockPropsForImage,
    canvasScale,
    onSectionImageActivate,
    onTextFieldActivate,
    onTextFieldCommit,
    onTextFieldStylePatch,
    onTextFieldBatchStylePatch,
    onNavigate,
    onPropLinkEdit,
  ])

  return (
    <VendorContext.Provider value={vendorValue}>
      <LiveDataFetchProvider fetcher={liveFetcher}>
        <BuilderCanvasContextProvider value={builderCanvasValue}>
          {children}
        </BuilderCanvasContextProvider>
      </LiveDataFetchProvider>
    </VendorContext.Provider>
  )
}
