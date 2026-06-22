/**
 * BuilderPage — the catch-all page renderer for published builder sites.
 *
 * When a visitor navigates to any path under a vendor storefront:
 *  - If there's a published builder site with a page matching the slug → render BlockRenderer
 *  - If the path is "/" and no builder site → fall back to the legacy Home
 *  - If no matching builder page → render a 404 block or redirect
 *
 * Side responsibilities:
 *  - Manages document metadata: <title>, description, Open Graph,
 *    Twitter Card, canonical, and hreflang alternates.
 *  - Loads live data per content block (products / services / testimonials /
 *    profile) and feeds it into JSON-LD so Google sees real items, not just
 *    a bare WebSite schema.
 *
 * The `BuilderSiteContext` does the heavy lifting of fetching the site once.
 */
import { useSearchParams, useParams, useNavigate, Navigate, Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useBuilderSite } from '@/contexts/BuilderSiteContext'
import BlockRenderer from '@/components/builder/BlockRenderer'
import CatalogStorefrontLiveHome from '@/pages/CatalogStorefrontLiveHome'
import Home from '@/pages/Home'
import WebsiteBuilderTemplateLiveHome from '@/pages/WebsiteBuilderTemplateLiveHome'
import DraftCatalogEmbedBlocked from '@/pages/DraftCatalogEmbedBlocked'
import { recallDraftEmbedPreviewToken } from '@/lib/draftEmbedPreview'
import { buildDraftCatalogEmbedStorePath } from '@/lib/draftCatalogEmbed'
import { useVendor } from '@/contexts/VendorContext'
import type { LiveItem, PublicBlock, PublicPage, PublicSite } from '@/blocks/registry'
import { buildPageJsonLd, siteBaseUrl } from '@/blocks/jsonLd'
import { publicSitesApi } from '@/api/publicSites'
import AnalyticsInjector from '@/components/builder/AnalyticsInjector'
import { getWbCatalogTemplateId } from '@/storefront/catalogTemplateIds'
import { useAssignedStorefrontTemplateId } from '@/hooks/useAssignedStorefrontTemplateId'
import { useStorePath } from '@/hooks/useStorePath'
import { withSharedShellBlocks, stripSharedShellBlocksFromPage } from '@/lib/storefrontLayoutChrome'
import { useLayoutOwnsShell } from '@/contexts/LayoutOwnsShellContext'
import {
  isBlockBasedStorefrontTemplateId,
  isDefaultLayoutTemplateId,
  isWebsiteBuilderBlockTemplateId,
  resolveLiveCatalogTemplateId,
} from '@/lib/storefrontTemplateAssignment'

interface BuilderPageProps {
  /** Force a specific slug (for shell routes like /home). Otherwise reads from URL. */
  slug?: string
  /** If true, use the homepage regardless of slug. */
  isHome?: boolean
}

function findPage(site: PublicSite, slug: string, isHome?: boolean): PublicPage | null {
  const pages = site.pages || []
  if (isHome || slug === '' || slug === '/') {
    return pages.find(p => p.is_homepage) || pages[0] || null
  }
  const normalised = slug.replace(/^\/+/, '')
  return pages.find(p => p.slug === normalised) || null
}

// ── Document head helpers ─────────────────────────────────────────────────────

/**
 * Idempotently set a `<meta name|property=...>` tag. Removes the tag when
 * `content` is empty so we don't ship stale or empty metadata between pages.
 */
function setMetaTag(attr: 'name' | 'property', key: string, content: string | null | undefined): void {
  const selector = `meta[${attr}="${key}"]`
  const existing = document.head.querySelector(selector)
  if (!content) {
    if (existing) existing.remove()
    return
  }
  if (existing) {
    existing.setAttribute('content', content)
    return
  }
  const el = document.createElement('meta')
  el.setAttribute(attr, key)
  el.setAttribute('content', content)
  document.head.appendChild(el)
}

/** Idempotently set a `<link rel=canonical|alternate hreflang=...>` tag. */
function setLinkTag(rel: string, href: string | null | undefined, hreflang?: string): void {
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`
  const existing = document.head.querySelector(selector)
  if (!href) {
    if (existing) existing.remove()
    return
  }
  if (existing) {
    existing.setAttribute('href', href)
    return
  }
  const el = document.createElement('link')
  el.setAttribute('rel', rel)
  if (hreflang) el.setAttribute('hreflang', hreflang)
  el.setAttribute('href', href)
  document.head.appendChild(el)
}

/** Remove every `<link rel='alternate' hreflang>` tag we previously added. */
function clearAllHreflangs(): void {
  document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach(el => el.remove())
}

/**
 * Push the active language onto `<html lang>`. Falls back to "en" so we
 * never leave the document without a lang attribute.
 */
function setHtmlLang(lang: string | null | undefined): void {
  document.documentElement.setAttribute('lang', (lang || 'en').toLowerCase())
}

// ── Live data loader ──────────────────────────────────────────────────────────

/** Block types that need live data for their JSON-LD schema. */
const SCHEMA_LIVE_RESOURCE: Record<string, string> = {
  product_grid: 'products',
  related_products: 'products',
  product_detail: 'products',
  services_cards: 'services',
  booking_widget: 'services',
  contact_form: 'profile',
  map_embed: 'profile',
  about_split: 'profile',
  footer: 'profile',
  nav: 'profile',
  testimonials: 'testimonials',
  product_reviews: 'testimonials',
}

/**
 * Fetch live items for every block on the page that contributes to JSON-LD
 * and return a `{ blockId → LiveItem[] }` map. Each unique resource is only
 * fetched once per render. Failures resolve to an empty array so a missing
 * feed never blocks the JSON-LD emit.
 */
function useLiveDataMap(blocks: PublicBlock[], siteId: string | undefined): Record<string, LiveItem[]> {
  const [map, setMap] = useState<Record<string, LiveItem[]>>({})

  useEffect(() => {
    if (!siteId || !blocks.length) {
      setMap({})
      return
    }
    let cancelled = false
    const needed = new Map<string, string>() // blockId → resource
    const resourceCache: Record<string, Promise<LiveItem[]>> = {}

    for (const b of blocks) {
      const r = SCHEMA_LIVE_RESOURCE[b.block_type]
      if (r) needed.set(b.id, r)
    }
    if (!needed.size) {
      setMap({})
      return
    }

    const fetchResource = (resource: string): Promise<LiveItem[]> => {
      if (!resourceCache[resource]) {
        resourceCache[resource] = publicSitesApi
          .getLiveResource(siteId, resource, 12)
          .then(r => r.items)
          .catch(() => [] as LiveItem[])
      }
      return resourceCache[resource]
    }

    const next: Record<string, LiveItem[]> = {}
    Promise.all(
      Array.from(needed.entries()).map(async ([blockId, resource]) => {
        const items = await fetchResource(resource)
        next[blockId] = items
      }),
    ).then(() => {
      if (!cancelled) setMap(next)
    })

    return () => {
      cancelled = true
    }
  }, [siteId, blocks])

  return map
}

// ── Component ────────────────────────────────────────────────────────────────

export default function BuilderPage({ slug: forcedSlug, isHome }: BuilderPageProps) {
  const { builderSite, isLoading } = useBuilderSite()
  const assignedTemplateId = useAssignedStorefrontTemplateId()
  const [searchParams] = useSearchParams()
  const params = useParams<{ '*': string; vendorSlug?: string }>()
  const navigate = useNavigate()
  const storePath = useStorePath()

  const draftEmbed = searchParams.get('draft_embed') === '1'
  const draftPreviewToken = searchParams.get('preview_token')?.trim() || recallDraftEmbedPreviewToken()

  const branchCode = searchParams.get('branch')
  const slug = forcedSlug ?? params['*'] ?? ''
  const normalizedSlug = slug.replace(/^\/+|\/+$/g, '')
  const isHomePath = isHome || normalizedSlug === '' || normalizedSlug === 'home'
  const layoutOwnsShell = useLayoutOwnsShell()
  const page = builderSite ? findPage(builderSite, slug, isHome) : null

  const renderedBlocks = useMemo(
    () => {
      if (!page) return []
      if (layoutOwnsShell) {
        return stripSharedShellBlocksFromPage(page.blocks ?? [])
      }
      return withSharedShellBlocks(builderSite, page)
    },
    [builderSite, page, layoutOwnsShell],
  )
  const blocksForSchema = useMemo(() => page?.blocks || [], [page?.id, page?.blocks])
  const liveDataMap = useLiveDataMap(blocksForSchema, builderSite?.id)

  // Manage the document head whenever page or site changes.
  useEffect(() => {
    if (!page || !builderSite) return

    const baseUrl = siteBaseUrl(builderSite)
    const pagePath = page.is_homepage
      ? '/'
      : `/${(page.slug || '').replace(/^\/+/, '')}`
    const canonical = baseUrl ? `${baseUrl}${pagePath}` : undefined

    // Title & description
    const titleParts = [page.seo_title || page.title, builderSite.seo_title || builderSite.name].filter(Boolean) as string[]
    const docTitle = page.is_homepage
      ? builderSite.seo_title || builderSite.name
      : titleParts.length > 1 && titleParts[0] !== titleParts[1]
        ? `${titleParts[0]} | ${titleParts[1]}`
        : titleParts[0] || builderSite.name
    document.title = docTitle

    const description = page.seo_description || builderSite.seo_description || builderSite.description || null
    setMetaTag('name', 'description', description)

    if (builderSite.seo_keywords) {
      setMetaTag('name', 'keywords', builderSite.seo_keywords)
    } else {
      setMetaTag('name', 'keywords', null)
    }

    // Canonical
    setLinkTag('canonical', canonical)

    // Open Graph
    const ogImage = page.og_image_url || builderSite.og_image_url || builderSite.logo_url || null
    setMetaTag('property', 'og:type', page.is_homepage ? 'website' : 'article')
    setMetaTag('property', 'og:site_name', builderSite.name)
    setMetaTag('property', 'og:title', page.seo_title || page.title || builderSite.name)
    setMetaTag('property', 'og:description', description)
    setMetaTag('property', 'og:url', canonical || null)
    setMetaTag('property', 'og:image', ogImage)
    setMetaTag('property', 'og:locale', (builderSite.language || 'en').replace('-', '_'))

    // Twitter Card
    setMetaTag('name', 'twitter:card', ogImage ? 'summary_large_image' : 'summary')
    setMetaTag('name', 'twitter:title', page.seo_title || page.title || builderSite.name)
    setMetaTag('name', 'twitter:description', description)
    setMetaTag('name', 'twitter:image', ogImage)

    // Favicon (use the site's favicon if set; otherwise leave the host shell's icon).
    if (builderSite.favicon_url) {
      let icon = document.head.querySelector('link[rel="icon"]') as HTMLLinkElement | null
      if (!icon) {
        icon = document.createElement('link')
        icon.rel = 'icon'
        document.head.appendChild(icon)
      }
      icon.href = builderSite.favicon_url
    }

    // hreflang alternates — only meaningful when the site exposes more than one locale.
    clearAllHreflangs()
    const enabled = (builderSite.languages_enabled || []).filter(Boolean)
    if (enabled.length > 1 && canonical) {
      enabled.forEach(lang => setLinkTag('alternate', `${canonical}?lang=${lang}`, lang))
      setLinkTag('alternate', canonical, 'x-default')
    }

    setHtmlLang(builderSite.language)
  }, [page?.id, builderSite?.id, builderSite?.updated_at])

  // Inject JSON-LD whenever the live-data map changes (so we don't ship the
  // schema before live items load).
  useEffect(() => {
    if (!page || !builderSite) return
    const schemas = buildPageJsonLd(page.blocks, builderSite, liveDataMap, page)
    const existing = document.getElementById('builder-jsonld')
    if (existing) existing.remove()
    if (!schemas.length) return
    const script = document.createElement('script')
    script.id = 'builder-jsonld'
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify(schemas.length === 1 ? schemas[0] : schemas)
    document.head.appendChild(script)
  }, [page?.id, builderSite?.id, liveDataMap])

  // Cleanup on unmount: drop any tags we own so they don't leak across routes
  // when the user navigates back to a non-builder page.
  useEffect(() => {
    return () => {
      document.getElementById('builder-jsonld')?.remove()
    }
  }, [])

  if (draftEmbed && draftPreviewToken && params.vendorSlug) {
    return <Navigate to={buildDraftCatalogEmbedStorePath(params.vendorSlug, draftPreviewToken, 'products')} replace />
  }
  if (draftEmbed) {
    return <DraftCatalogEmbedBlocked />
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!builderSite) {
    return null
  }

  const wbCatalogTemplateId = getWbCatalogTemplateId(builderSite.style_config as Record<string, unknown>)
  const catalogTemplateId =
    assignedTemplateId && (isDefaultLayoutTemplateId(assignedTemplateId) || isWebsiteBuilderBlockTemplateId(assignedTemplateId))
      ? null
      : resolveLiveCatalogTemplateId(assignedTemplateId, wbCatalogTemplateId)
  const blockTemplateId =
    (assignedTemplateId && isWebsiteBuilderBlockTemplateId(assignedTemplateId) ? assignedTemplateId : null)
    || (wbCatalogTemplateId && isBlockBasedStorefrontTemplateId(wbCatalogTemplateId) ? wbCatalogTemplateId : null)
  // Only fall back to the hardcoded catalog-template React shell when the
  // vendor has NOT yet added any blocks in the builder. Once they save real
  // pages/blocks, the block renderer takes over so custom content is shown.
  const hasSavedBuilderBlocks = Boolean(
    builderSite.pages?.some(p => p.blocks?.length > 0),
  )
  if (blockTemplateId && !hasSavedBuilderBlocks && isHomePath) {
    return <WebsiteBuilderTemplateLiveHome templateId={blockTemplateId} />
  }

  if (catalogTemplateId && !isBlockBasedStorefrontTemplateId(catalogTemplateId) && !hasSavedBuilderBlocks && isHomePath) {
    return <CatalogStorefrontLiveHome catalogTemplateId={catalogTemplateId} />
  }

  if (assignedTemplateId && isDefaultLayoutTemplateId(assignedTemplateId) && !hasSavedBuilderBlocks && isHomePath) {
    return <Home />
  }

  if (!page) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-4">
        <div>
          <h1 className="text-6xl font-bold text-gray-200 mb-4">404</h1>
          <p className="text-gray-500 mb-6">Page not found</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to={storePath('/')}
              className="px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90"
            >
              Go to homepage
            </Link>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-3 border border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50"
            >
              Go back
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <AnalyticsInjector site={builderSite} />
      <BlockRenderer blocks={renderedBlocks} site={builderSite} pageId={page.id} branchCode={branchCode} />
    </>
  )
}
