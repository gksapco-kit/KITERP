import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
import { storefrontPath } from '@/lib/storefrontPaths'
import { resolveAssignedStorefrontTemplateId } from '@/lib/storefrontTemplateAssignment'
import { resolveTemplateDisplayFieldsFromSettings } from '@/lib/storefrontDisplayFields'
import { useCustomHost } from '@/contexts/CustomHostContext'

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

export type VendorLoadErrorKind = 'not_found' | 'unavailable'

export interface VendorContextType {
  vendor: VendorData | null
  vendorSlug: string
  isLoading: boolean
  error: string | null
  /** not_found = this slug does not exist. unavailable = the API was slow or unreachable. */
  errorKind: VendorLoadErrorKind | null
  storePath: (path: string) => string
  displayFields: DisplayFields
  /** True on vendor-web /preview/draft — show nav links at all breakpoints. */
  previewShell?: boolean
  /** Switch builder page in /preview/draft without opening catalog iframe. */
  openBuilderForPage?: (pageSlug: string | null) => void
  /** True when serving on a vendor custom domain (paths omit /{slug}). */
  isCustomDomain?: boolean
}

export const VendorContext = createContext<VendorContextType>({
  vendor: null,
  vendorSlug: '',
  isLoading: true,
  error: null,
  errorKind: null,
  storePath: (p) => p,
  displayFields: resolveTemplateDisplayFieldsFromSettings(null, null),
  isCustomDomain: false,
})

export function VendorProvider({
  children,
  slugOverride,
}: {
  children: ReactNode
  /** Forced slug for custom-domain root routes (no :vendorSlug param). */
  slugOverride?: string | null
}) {
  const params = useParams<{ vendorSlug: string; previewToken?: string }>()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const customHost = useCustomHost()
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
  const [errorKind, setErrorKind] = useState<VendorLoadErrorKind | null>(null)
  const vendorRef = useRef(vendor)
  vendorRef.current = vendor

  const slug = (slugOverride?.trim() || params?.vendorSlug || customHost.vendorSlug || '').trim()
  const omitSlug = Boolean(slugOverride) || (customHost.isCustomHost && Boolean(customHost.vendorSlug))

  // Pin this tab's URL slug immediately so catalog calls never use another live tab's vendor.
  useEffect(() => {
    if (slug.trim()) setVendorSlugHint(slug)
  }, [slug])

  useEffect(() => {
    if (!slug || slug.trim() === '') {
      setErrorKind('not_found')
      setError('No vendor specified')
      setIsLoading(false)
      return
    }

    let cancelled = false
    const keepVisible = vendorRef.current?.slug === slug
    if (!keepVisible) {
      setVendor(null)
      setIsLoading(true)
    }
    setError(null)
    setErrorKind(null)

    const loadVendor = async () => {
      const attempts = 3
      let lastError: unknown
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        if (cancelled) return
        try {
          const res = await axios.get(`${API_URL}/catalog/vendor/${encodeURIComponent(slug)}`, { timeout: 20_000 })
          if (cancelled) return
          setVendor(res.data)
          setVendorContext(res.data.slug, res.data.id)
          return
        } catch (err: unknown) {
          lastError = err
          const status = axios.isAxiosError(err) ? err.response?.status : undefined
          const transient = !axios.isAxiosError(err) || !err.response || status === 408 || status === 429 || (status != null && status >= 500)
          if (!transient || attempt === attempts - 1) break
          await new Promise((resolve) => window.setTimeout(resolve, 700 * (attempt + 1)))
        }
      }
      if (cancelled) return
      console.error('Failed to load vendor:', lastError)
      if (vendorRef.current?.slug === slug) return
      const ax = axios.isAxiosError(lastError) ? lastError : null
      const status = ax?.response?.status
      if (status === 404) {
        setErrorKind('not_found')
        setError('This store is not available. Check the address, or ask the store to confirm it is published.')
        return
      }
      setErrorKind('unavailable')
      setError('The store is taking longer than usual to open. Wait a moment and try again.')
    }

    void loadVendor().finally(() => {
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
    if (draftEmbed && draftPreviewToken) {
      const routeQs = clean.includes('?') ? clean.slice(clean.indexOf('?') + 1) : ''
      const routePath = clean.split('?')[0].replace(/^\//, '')
      return buildDraftCatalogEmbedStorePath(slug, draftPreviewToken, routePath + (routeQs ? `?${routeQs}` : ''))
    }
    return storefrontPath(slug, clean, { omitSlug })
  }

  const displayFields = useMemo<DisplayFields>(() => {
    const templateId = resolveAssignedStorefrontTemplateId(vendor?.settings, [], null)
    return resolveTemplateDisplayFieldsFromSettings(vendor?.settings, templateId)
  }, [vendor?.settings])

  return (
    <VendorContext.Provider
      value={{
        vendor,
        vendorSlug: slug,
        isLoading,
        error,
        errorKind,
        storePath,
        displayFields,
        isCustomDomain: omitSlug,
      }}
    >
      {children}
    </VendorContext.Provider>
  )
}

export function useVendor() {
  return useContext(VendorContext)
}
