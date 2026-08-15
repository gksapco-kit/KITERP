import { type ReactNode, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { VendorContext, type VendorContextType, type VendorData } from '@storefront/contexts/VendorContext'
import { buildDraftPreviewPageUrl, buildDraftPreviewStorePath } from '@/lib/draftPreviewNavigation'
import { parseCatalogStorePath } from '@/lib/catalogStorePaths'

import {
  createAllEnabledProductDisplayFields,
  createAllEnabledServiceDisplayFields,
} from '@/lib/storefrontDisplayFields'

const DEFAULT_PRODUCT_DISPLAY = createAllEnabledProductDisplayFields()
const DEFAULT_SERVICE_DISPLAY = createAllEnabledServiceDisplayFields()

export function PreviewVendorProvider({
  slug,
  siteName,
  previewToken,
  sitePageSlugs,
  openBuilderForPage,
  offeringType,
  socialLinks,
  settings,
  children,
}: {
  slug: string
  siteName?: string
  previewToken: string
  /** Builder page slugs — paths like /products resolve to ?page=, not catalog iframe. */
  sitePageSlugs?: ReadonlySet<string>
  openBuilderForPage?: (pageSlug: string | null) => void
  offeringType?: 'products' | 'services' | 'both'
  socialLinks?: Record<string, string>
  settings?: Record<string, unknown>
  children: ReactNode
}) {
  const [searchParams] = useSearchParams()
  const currentPageSlug = searchParams.get('page')?.trim() || null

  const value = useMemo<VendorContextType>(() => {
    const vendor: VendorData = {
      id: slug,
      business_name: siteName || slug,
      display_name: siteName || slug,
      slug,
      offering_type: offeringType,
      social_links: socialLinks,
      theme_config: {},
      primary_email: '',
      primary_phone: '',
      settings: settings ?? {},
    }
    return {
      vendor,
      vendorSlug: slug,
      isLoading: false,
      error: null,
      storePath: (p: string) => {
        const clean = p.startsWith('/') ? p : `/${p}`
        const pathnameOnly = clean.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/'
        const storePrefix = `/store/${slug}`
        let normalized = clean
        if (pathnameOnly.startsWith(storePrefix)) {
          const rest = pathnameOnly.slice(storePrefix.length).replace(/\/+$/, '') || '/'
          const qs = clean.includes('?') ? clean.slice(clean.indexOf('?')) : ''
          normalized = `${rest}${qs}`
        }
        const pathname = normalized.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/'
        const pageSegment = pathname.replace(/^\/+/, '').toLowerCase()
        const catalog = parseCatalogStorePath(pathname)
        const isWebsitePage =
          sitePageSlugs &&
          pageSegment &&
          !catalog?.slug &&
          pathname.indexOf('/', 1) === -1 &&
          sitePageSlugs.has(pageSegment)

        if (isWebsitePage) {
          return buildDraftPreviewPageUrl(previewToken, pageSegment)
        }

        let href = buildDraftPreviewStorePath(previewToken, normalized)
        if (currentPageSlug && catalog?.slug) {
          try {
            const url = new URL(href, window.location.origin)
            url.searchParams.set('page', currentPageSlug)
            href = `${url.pathname}${url.search}`
          } catch {
            /* keep base href */
          }
        }
        return href
      },
      displayFields: {
        product: DEFAULT_PRODUCT_DISPLAY,
        service: DEFAULT_SERVICE_DISPLAY,
      },
      previewShell: true,
      openBuilderForPage,
    }
  }, [slug, siteName, previewToken, currentPageSlug, sitePageSlugs, openBuilderForPage, offeringType, socialLinks, settings])

  return <VendorContext.Provider value={value}>{children}</VendorContext.Provider>
}
