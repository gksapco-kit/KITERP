import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useParams, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { setVendorContext, setVendorSlugHint } from '@/api/client'
import type { DisplayFields } from '@/types'
import { getStorefrontApiBaseUrl } from '@/lib/apiBase'
import {
  buildDraftCatalogEmbedStorePath,
  parseDraftCatalogEmbedPath,
  rememberDraftCatalogPreviewTokenFromPath,
} from '@/lib/draftCatalogEmbed'
import { recallDraftEmbedPreviewToken } from '@/lib/draftEmbedPreview'
import { resolveAssignedStorefrontTemplateId } from '@/lib/storefrontTemplateAssignment'
import { resolveTemplateDisplayFieldsFromSettings } from '@/lib/storefrontDisplayFields'

const API_URL = getStorefrontApiBaseUrl().replace(/\/$/, '')

export interface VendorData {
  id: string
  business_name: string
  display_name: string
  slug: string
  description?: string
  offering_type?: 'products' | 'services' | 'both'
  logo_url?: string
  banner_url?: string
  theme_config: Record<string, unknown>
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
  /** True on vendor-web /preview/draft — show nav links at all breakpoints. */
  previewShell?: boolean
  /** Switch builder page in /preview/draft without opening catalog iframe. */
  openBuilderForPage?: (pageSlug: string | null) => void
}

export const VendorContext = createContext<VendorContextType>({
  vendor: null,
  vendorSlug: '',
  isLoading: true,
  error: null,
  storePath: (p) => p,
  displayFields: resolveTemplateDisplayFieldsFromSettings(null, null),
})

export function VendorProvider({ children }: { children: ReactNode }) {
  const params = useParams<{ vendorSlug: string; previewToken?: string }>()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const draftCatalogFromPath = parseDraftCatalogEmbedPath(pathname)
  const isDraftCatalogEmbed = Boolean(draftCatalogFromPath)
  const draftCatalogToken =
    draftCatalogFromPath?.previewToken?.trim()
    || params.previewToken?.trim()
    || ''
  const draftEmbed = isDraftCatalogEmbed || searchParams.get('draft_embed') === '1'
  const draftPreviewToken =
    draftCatalogToken
    || searchParams.get('preview_token')?.trim()
    || recallDraftEmbedPreviewToken()

  useEffect(() => {
    if (isDraftCatalogEmbed) rememberDraftCatalogPreviewTokenFromPath(pathname)
  }, [isDraftCatalogEmbed, pathname])
  const [vendor, setVendor] = useState<VendorData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const slug = params?.vendorSlug || ''

  // Pin this tab's URL slug immediately so catalog calls never use another live tab's vendor.
  useEffect(() => {
    if (slug.trim()) setVendorSlugHint(slug)
  }, [slug])

  useEffect(() => {
    if (!slug || slug.trim() === '') {
      setError('No vendor specified')
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)
    setVendor(null)

    axios
      .get(`${API_URL}/catalog/vendor/${encodeURIComponent(slug)}`, { timeout: 15_000 })
      .then((res) => {
        if (!cancelled) {
          setVendor(res.data)
          // Tab-local sessionStorage + in-memory (never shared localStorage)
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

  // Re-pin after focus so this tab cannot silently pick up another site's headers.
  useEffect(() => {
    if (!vendor?.slug || !vendor?.id) return
    const pin = () => setVendorContext(vendor.slug, vendor.id)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') pin()
    }
    window.addEventListener('focus', pin)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', pin)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [vendor?.slug, vendor?.id])

  const storePath = (path: string) => {
    const clean = path.startsWith('/') ? path : `/${path}`
    if (isDraftCatalogEmbed && draftCatalogToken) {
      return buildDraftCatalogEmbedStorePath(slug, draftCatalogToken, clean.replace(/^\//, ''))
    }
    let href = `/store/${slug}${clean}`
    if (draftEmbed && draftPreviewToken) {
      const routeQs = clean.includes('?') ? clean.slice(clean.indexOf('?') + 1) : ''
      const routePath = clean.split('?')[0].replace(/^\//, '')
      return buildDraftCatalogEmbedStorePath(slug, draftPreviewToken, routePath + (routeQs ? `?${routeQs}` : ''))
    }
    return href
  }

  const displayFields = useMemo<DisplayFields>(() => {
    const templateId = resolveAssignedStorefrontTemplateId(vendor?.settings, [], null)
    return resolveTemplateDisplayFieldsFromSettings(vendor?.settings, templateId)
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
