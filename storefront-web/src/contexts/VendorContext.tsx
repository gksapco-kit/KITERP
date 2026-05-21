import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { setVendorContext } from '@/api/client'
import type { DisplayFields } from '@/types'
import { getStorefrontApiBaseUrl } from '@/lib/apiBase'

const API_URL = getStorefrontApiBaseUrl().replace(/\/$/, '')

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

export interface VendorData {
  id: string
  business_name: string
  display_name: string
  slug: string
  description?: string
  logo_url?: string
  banner_url?: string
  theme_config: Record<string, unknown> & { builder_config?: Record<string, unknown> }
  primary_email: string
  primary_phone: string
  support_email?: string
  support_phone?: string
  street_address?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
  /** Optional geo for maps / store locator (when provided by API) */
  latitude?: number
  longitude?: number
  social_links?: Record<string, string>
  business_hours?: Record<string, { open: string; close: string; closed?: boolean }>
  gstin?: string
  is_gst_registered?: boolean
  default_tax_rate?: number
  settings: Record<string, unknown>
}

export interface VendorContextType {
  vendor: VendorData | null
  vendorSlug: string
  isLoading: boolean
  error: string | null
  storePath: (path: string) => string
  displayFields: DisplayFields
}

export const VendorContext = createContext<VendorContextType>({
  vendor: null,
  vendorSlug: '',
  isLoading: true,
  error: null,
  storePath: (p) => p,
  displayFields: { product: DEFAULT_PRODUCT_DISPLAY, service: DEFAULT_SERVICE_DISPLAY },
})

export function VendorProvider({ children }: { children: ReactNode }) {
  const params = useParams<{ vendorSlug: string }>()
  const navigate = useNavigate()
  const [vendor, setVendor] = useState<VendorData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const slug = params?.vendorSlug || ''

  useEffect(() => {
    if (!slug || slug.trim() === '') {
      setError('No vendor specified')
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    axios
      .get(`${API_URL}/catalog/vendor/${encodeURIComponent(slug)}`, { timeout: 15_000 })
      .then((res) => {
        if (!cancelled) {
          setVendor(res.data)
          // Set vendor context in API client (in-memory + localStorage)
          setVendorContext(res.data.slug, res.data.id)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          console.error('Failed to load vendor:', err)
          const ax = err as { response?: { status?: number; data?: { detail?: string } }; code?: string; message?: string }
          const status = ax.response?.status
          if (status === 404) {
            setError(
              'No store with this slug exists yet, or the vendor is not approved/active on the business front. For local dev: from the backend folder run python setup_vendor.py (default slug test), then python seed_dev_hr_employee.py to create an ESS login.',
            )
            return
          }
          if (!ax.response) {
            setError(
              `Cannot reach the API at ${API_URL}. Start the backend (uvicorn on port 8000) and set VITE_API_URL if needed.`,
            )
            return
          }
          const detail = ax.response.data?.detail
          const msg = typeof detail === 'string' ? detail : Array.isArray(detail) ? JSON.stringify(detail) : undefined
          setError(msg ? `Server error (${status}): ${msg}` : `Failed to load store (${status || 'unknown'}). Try again later.`)
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [slug])

  const storePath = (path: string) => {
    const clean = path.startsWith('/') ? path : `/${path}`
    return `/store/${slug}${clean}`
  }

  const displayFields = useMemo<DisplayFields>(() => {
    const df = vendor?.settings?.display_fields as { product?: Record<string, boolean>; service?: Record<string, boolean> } | undefined
    return {
      product: { ...DEFAULT_PRODUCT_DISPLAY, ...(df?.product || {}) },
      service: { ...DEFAULT_SERVICE_DISPLAY, ...(df?.service || {}) },
    }
  }, [vendor?.settings])

  return (
    <VendorContext.Provider value={{ vendor, vendorSlug: slug, isLoading, error, storePath, displayFields }}>
      {children}
    </VendorContext.Provider>
  )
}

export function useVendor() {
  return useContext(VendorContext)
}
