import { type ReactNode, useMemo } from 'react'
import { VendorContext, type VendorContextType, type VendorData } from '@storefront/contexts/VendorContext'
import { buildDraftPreviewStorePath } from '@/lib/draftPreviewNavigation'

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

export function PreviewVendorProvider({
  slug,
  siteName,
  previewToken,
  children,
}: {
  slug: string
  siteName?: string
  previewToken: string
  children: ReactNode
}) {
  const value = useMemo<VendorContextType>(() => {
    const vendor: VendorData = {
      id: slug,
      business_name: siteName || slug,
      display_name: siteName || slug,
      slug,
      theme_config: {},
      primary_email: '',
      primary_phone: '',
      settings: {},
    }
    return {
      vendor,
      vendorSlug: slug,
      isLoading: false,
      error: null,
      storePath: (p: string) => buildDraftPreviewStorePath(previewToken, p),
      displayFields: {
        product: DEFAULT_PRODUCT_DISPLAY,
        service: DEFAULT_SERVICE_DISPLAY,
      },
    }
  }, [slug, siteName, previewToken])

  return <VendorContext.Provider value={value}>{children}</VendorContext.Provider>
}
