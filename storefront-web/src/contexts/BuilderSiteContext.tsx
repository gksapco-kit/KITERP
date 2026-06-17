/**
 * BuilderSiteContext — fetches and provides the published wb_* site data
 * for the storefront BlockRenderer.
 *
 * Strategy:
 *  1. After VendorContext resolves the vendor (slug → vendor.id), we derive
 *     the subdomain from the current hostname.
 *  2. We call GET /public/sites/by-subdomain/{subdomain} to get the full
 *     published site + pages + blocks.
 *  3. If the site returns 404 (no published site), `builderSite` is null and
 *     the storefront falls back to the legacy Home.tsx.
 *
 * This is intentionally separate from VendorContext so the vendor data
 * (used everywhere) is never blocked on the builder site fetch.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Outlet, useParams, useSearchParams } from 'react-router-dom'
import { publicSitesApi } from '@/api/publicSites'
import { useVendor } from '@/contexts/VendorContext'
import type { PublicSite } from '@/blocks/registry'
import { recallDraftEmbedPreviewToken } from '@/lib/draftEmbedPreview'

interface BuilderSiteContextType {
  builderSite: PublicSite | null
  isLoading: boolean
}

const BuilderSiteContext = createContext<BuilderSiteContextType>({
  builderSite: null,
  isLoading: false,
})

export function BuilderSiteProvider({ children }: { children: ReactNode }) {
  const { vendor, vendorSlug } = useVendor()
  const [searchParams] = useSearchParams()
  const branchCode = searchParams.get('branch')?.trim() || null
  const draftEmbed = searchParams.get('draft_embed') === '1'
  const previewToken =
    searchParams.get('preview_token')?.trim() || (draftEmbed ? recallDraftEmbedPreviewToken() : null)
  const [builderSite, setBuilderSite] = useState<PublicSite | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (draftEmbed && previewToken) {
      let cancelled = false
      setIsLoading(true)
      publicSitesApi
        .getPreviewByToken(previewToken)
        .then(site => {
          if (!cancelled) setBuilderSite(site)
        })
        .catch(() => {
          if (!cancelled) setBuilderSite(null)
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false)
        })
      return () => {
        cancelled = true
      }
    }

    if (!vendor && !vendorSlug) return

    // Derive subdomain: use the current hostname if it matches *.kiterp.com,
    // otherwise fall back to the vendorSlug (useful for localhost dev).
    const host = window.location.hostname
    const BASE_DOMAIN = import.meta.env.VITE_BASE_DOMAIN || 'kiterp.com'
    let subdomain: string | null = null

    if (host.endsWith(`.${BASE_DOMAIN}`)) {
      subdomain = host.replace(`.${BASE_DOMAIN}`, '').split('.').pop() || null
    }

    // In dev (localhost/127.0.0.1), fall back to URL slug / vendor catalog slug
    if (!subdomain) {
      subdomain = vendor?.slug || vendorSlug || null
    }

    if (!subdomain) return

    let cancelled = false
    setIsLoading(true)
    // Pass the active business unit so each branch resolves to its own
    // linked storefront site, not the vendor's latest published one.
    publicSitesApi
      .getBySubdomain(subdomain, branchCode)
      .then(site => {
        if (!cancelled) setBuilderSite(site)
      })
      .catch(() => {
        if (!cancelled) setBuilderSite(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [vendor?.slug, vendorSlug, branchCode, draftEmbed, previewToken])

  return (
    <BuilderSiteContext.Provider value={{ builderSite, isLoading }}>
      {children}
    </BuilderSiteContext.Provider>
  )
}

export function useBuilderSite() {
  return useContext(BuilderSiteContext)
}

/**
 * Overrides the parent BuilderSiteProvider for `/store/:slug/preview/:token/...`:
 * loads frozen snapshot JSON instead of the published subdomain payload.
 */
export function BuilderSitePreviewProvider({ children }: { children: ReactNode }) {
  const { previewToken } = useParams<{ previewToken: string }>()
  const [builderSite, setBuilderSite] = useState<PublicSite | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!previewToken) {
      setBuilderSite(null)
      setIsLoading(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    publicSitesApi
      .getPreviewByToken(previewToken)
      .then(site => {
        if (!cancelled) setBuilderSite(site)
      })
      .catch(() => {
        if (!cancelled) setBuilderSite(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [previewToken])

  return (
    <BuilderSiteContext.Provider value={{ builderSite, isLoading }}>
      {children}
    </BuilderSiteContext.Provider>
  )
}

/** Route shell: inner provider wins over the store-wide BuilderSiteProvider. */
export function BuilderSitePreviewShell() {
  return (
    <BuilderSitePreviewProvider>
      <Outlet />
    </BuilderSitePreviewProvider>
  )
}
