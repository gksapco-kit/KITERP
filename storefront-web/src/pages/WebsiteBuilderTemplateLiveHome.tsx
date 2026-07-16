/**
 * Live storefront pages for website-builder catalog templates (portfolio, verde, …).
 * Loads the same PublicSite JSON as /template-browser/:id and renders via BlockRenderer.
 *
 * Live product/category feeds use the browsing vendor's published builder site id
 * (not the synthetic template-preview UUID) so assigned stores show their own catalog.
 */
import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import BlockRenderer from '@/components/builder/BlockRenderer'
import AnalyticsInjector from '@/components/builder/AnalyticsInjector'
import { useBranch } from '@/contexts/BranchContext'
import { useBuilderSite } from '@/contexts/BuilderSiteContext'
import { publicSitesApi } from '@/api/publicSites'
import type { PublicPage, PublicSite } from '@/blocks/registry'

function pickPage(site: PublicSite, pageSlug?: string | null): PublicPage | null {
  const pages = site.pages || []
  if (!pageSlug || pageSlug === '/' || pageSlug === 'home') {
    return pages.find(p => p.is_homepage) || pages[0] || null
  }
  const normalised = pageSlug.replace(/^\/+/, '')
  return pages.find(p => p.slug === normalised) || null
}

type Props = {
  templateId: string
  /** When omitted or home, renders the homepage. Otherwise matches template page slug. */
  pageSlug?: string | null
}

export default function WebsiteBuilderTemplateLiveHome({ templateId, pageSlug }: Props) {
  const { branchCode } = useBranch()
  const { builderSite } = useBuilderSite()
  const [site, setSite] = useState<PublicSite | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFailed(false)
    publicSitesApi
      .getWebsiteTemplatePreview(templateId)
      .then(data => {
        if (!cancelled) setSite(data)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [templateId])

  const effectiveSite = useMemo((): PublicSite | null => {
    if (!site) return null
    const vendorLiveId = builderSite?.id?.trim()
    if (!vendorLiveId) return site
    return {
      ...site,
      // Prefer the browsing vendor's published site for catalog live feeds.
      live_site_id: vendorLiveId,
      vendor_id: builderSite.vendor_id || site.vendor_id,
      vendor_slug: builderSite.vendor_slug ?? site.vendor_slug,
      // Template preview JSON clears tracking IDs — use the vendor site's IDs.
      google_analytics_id: builderSite.google_analytics_id ?? site.google_analytics_id,
      meta_pixel_id: builderSite.meta_pixel_id ?? site.meta_pixel_id,
      custom_head_code: builderSite.custom_head_code ?? site.custom_head_code,
      custom_body_code: builderSite.custom_body_code ?? site.custom_body_code,
    }
  }, [site, builderSite])

  const pageBg = (effectiveSite?.style_config as { bg_color?: string } | undefined)?.bg_color

  useEffect(() => {
    if (!pageBg) return
    const prevBg = document.body.style.backgroundColor
    document.body.style.backgroundColor = pageBg
    return () => {
      document.body.style.backgroundColor = prevBg
    }
  }, [pageBg])

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (failed || !effectiveSite) return null

  const page = pickPage(effectiveSite, pageSlug)
  if (!page) return null

  return (
    <>
      <AnalyticsInjector site={effectiveSite} />
      <BlockRenderer
        blocks={page.blocks || []}
        site={effectiveSite}
        pageId={page.id}
        branchCode={branchCode}
      />
    </>
  )
}
