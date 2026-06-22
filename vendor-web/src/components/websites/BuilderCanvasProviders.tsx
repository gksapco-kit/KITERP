import { type ReactNode, useMemo } from 'react'
import type { StoreLocation } from '@storefront/api/store'
import { VendorContext, type VendorContextType, type VendorData } from '@storefront/contexts/VendorContext'
import { LiveDataFetchProvider, type LiveDataFetcher } from '@storefront/contexts/LiveDataFetchContext'
import { BuilderCanvasContextProvider } from '@storefront/contexts/BuilderCanvasContext'
import { BranchPreviewProvider } from '@storefront/contexts/BranchContext'
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

export type BuilderBusinessProfile = {
  id: string
  business_name: string
  display_name: string
  slug: string
  description?: string
  offering_type?: 'products' | 'services' | 'both'
  logo_url?: string
  banner_url?: string
  theme_config?: Record<string, unknown>
  primary_email?: string
  primary_phone?: string
  support_email?: string
  support_phone?: string
  social_links?: Record<string, string>
  settings?: Record<string, unknown>
}

function toStorefrontVendor(profile: BuilderBusinessProfile): VendorData {
  return {
    id: profile.id,
    business_name: profile.business_name,
    display_name: profile.display_name,
    slug: profile.slug,
    description: profile.description,
    offering_type: profile.offering_type,
    logo_url: profile.logo_url,
    banner_url: profile.banner_url,
    theme_config: profile.theme_config ?? {},
    primary_email: profile.primary_email ?? '',
    primary_phone: profile.primary_phone ?? '',
    support_email: profile.support_email,
    support_phone: profile.support_phone,
    social_links: profile.social_links,
    settings: profile.settings ?? {},
  }
}

function toStoreLocation(store: {
  id: string
  name: string
  code?: string
  description?: string
  settings?: Record<string, unknown>
}): StoreLocation {
  const settings: Record<string, string> = {}
  for (const [key, value] of Object.entries(store.settings ?? {})) {
    if (typeof value === 'string') settings[key] = value
  }
  return {
    id: store.id,
    name: store.name,
    code: store.code,
    description: store.description,
    address: {},
    is_default: false,
    settings,
  }
}

/**
 * VendorContext + authenticated live-data fetch for the builder canvas.
 * Matches DraftPreviewRenderer / BlockRenderer on the storefront.
 */
export function BuilderCanvasProviders({
  siteId,
  vendorSlug,
  siteName,
  businessProfile,
  previewStore,
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
  activePageSlug = null,
  activePageIsHomepage = false,
  children,
}: {
  siteId: string
  vendorSlug: string
  siteName?: string
  /** Business Profile from vendor settings — logo, banners, and brand name resolve from here. */
  businessProfile?: BuilderBusinessProfile | null
  /** Active BU for unique-per-unit branding preview in the builder canvas. */
  previewStore?: {
    id: string
    name: string
    code?: string
    description?: string
    settings?: Record<string, unknown>
  } | null
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
  activePageSlug?: string | null
  activePageIsHomepage?: boolean
  children: ReactNode
}) {
  const previewBranch = useMemo(
    () => (previewStore ? toStoreLocation(previewStore) : null),
    [previewStore],
  )

  const vendorValue = useMemo<VendorContextType>(() => {
    const baseVendor = businessProfile
      ? toStorefrontVendor(businessProfile)
      : {
          id: vendorSlug,
          business_name: siteName || vendorSlug,
          display_name: siteName || vendorSlug,
          slug: vendorSlug,
          theme_config: {},
          primary_email: '',
          primary_phone: '',
          settings: {},
        } satisfies VendorData

    const vendor = baseVendor

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
  }, [businessProfile, vendorSlug, siteName])

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
    activePageSlug,
    activePageIsHomepage,
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
    activePageSlug,
    activePageIsHomepage,
  ])

  const branchPreviewValue = useMemo(() => {
    if (!previewBranch) return null
    const code = previewBranch.code?.trim() || previewBranch.id
    return {
      branches: [previewBranch],
      branchCode: code,
      selectedBranch: previewBranch,
      isBranchClosed: false,
      setBranchCode: () => {},
      storePath: (path: string) => {
        const clean = path.startsWith('/') ? path : `/${path}`
        const sep = clean.includes('?') ? '&' : '?'
        return `${clean}${sep}branch=${encodeURIComponent(code)}`
      },
      loading: false,
    }
  }, [previewBranch])

  const inner = (
    <VendorContext.Provider value={vendorValue}>
      <LiveDataFetchProvider fetcher={liveFetcher}>
        <BuilderCanvasContextProvider value={builderCanvasValue}>
          {children}
        </BuilderCanvasContextProvider>
      </LiveDataFetchProvider>
    </VendorContext.Provider>
  )

  if (!branchPreviewValue) return inner

  return (
    <BranchPreviewProvider value={branchPreviewValue}>
      {inner}
    </BranchPreviewProvider>
  )
}
