import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Globe, Layout, SlidersHorizontal,
  Sparkles, Newspaper, Link2,
} from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import { useSiteList, useWebsiteTemplates } from '@/hooks/useWebsites'
import { useStores } from '@/hooks/useVendor'
import { useVendorStore } from '@/stores/vendorStore'
import { resolveBusinessFrontActiveTemplate } from '@/lib/businessFrontActiveTemplate'
import { buildCustomerStoreLink, customerLinkForStore, resolveEffectiveStorefrontTemplateId, resolveStorefrontLinkMode, resolveStorefrontTemplateMode } from '@/lib/liveStorefrontUrl'
import { openBuilderSiteDraftPreview } from '@/lib/openBuilderSiteDraftPreview'
import { isTemplateSandboxSite } from '@/lib/websiteSandbox'
import { WebsiteStorefrontCard } from '@/components/websites/WebsiteStorefrontCard'
import { StoreThemeCustomizerDialog } from '@/components/websites/StoreThemeCustomizerDialog'
import {
  resolveMainStorefrontTemplateLabel,
  resolveSiteAppliedTemplateLabel,
  resolveTemplateDisplay,
} from '@/lib/websiteAppliedTemplate'
import { resolveSiteStaticThumbnail } from '@/lib/websiteSitePreview'
import type { SiteListItem } from '@/types/websites'
import { cn, mediaUrl } from '@/lib/utils'

type HubLink = {
  title: string
  shortTitle: string
  description: string
  to: string
  icon: typeof Globe
  primary?: boolean
}

type StorefrontCardModel = {
  key: string
  name: string
  description: string
  builderTo: string
  liveUrl: string | null
  live: boolean
  templateName: string
  templateThumbnail: string | null
  thumbnailSiteId: string | null
  livePreviewUrl: string | null
  fallbackGradient: string | null
}

type BuilderDraftCardModel = {
  key: string
  siteId: string
  name: string
  description: string
  builderTo: string
  templateName: string
  templateThumbnail: string | null
  thumbnailSiteId: string
  fallbackGradient: string | null
}

function presetPreviewGradient(preset: { colors?: Record<string, string> } | undefined): string | null {
  const colors = preset?.colors
  if (!colors) return null
  const start = colors.primary?.trim() || colors.accent?.trim()
  const end = colors.secondary?.trim() || colors.background?.trim()
  if (start && end && start !== end) return `linear-gradient(135deg, ${start}, ${end})`
  return start || end || null
}

export default function BusinessFrontHubPage() {
  const [themeCustomizerOpen, setThemeCustomizerOpen] = useState(false)
  const vendor = useVendorStore(s => s.vendor)
  const { data: sites = [] } = useSiteList()
  const { data: websiteTemplates = [] } = useWebsiteTemplates()
  const { data: storesData } = useStores({ limit: 200 })
  const stores = storesData?.stores ?? []
  const { data: config } = useQuery({
    queryKey: ['template-config'],
    queryFn: () => vendorApi.getTemplateConfig(),
  })
  const { data: presetsData } = useQuery({
    queryKey: ['template-presets'],
    queryFn: () => vendorApi.getTemplatePresets(),
  })

  const activeFront = resolveBusinessFrontActiveTemplate(
    config?.template,
    presetsData?.presets ?? [],
    sites,
  )
  const publishedSite = sites.find(s => s.is_published)
  const mainSites = (sites as SiteListItem[]).filter(s => !isTemplateSandboxSite(s))

  const commonLiveUrl = buildCustomerStoreLink(vendor?.slug)
  const linkMode = resolveStorefrontLinkMode(vendor?.settings)
  const templateMode = resolveStorefrontTemplateMode(vendor?.settings)
  const isSingleTemplateMode = templateMode === 'single'

  const legacyPresets = presetsData?.presets ?? []
  const mainStorefrontTemplate = resolveMainStorefrontTemplateLabel(config?.template, legacyPresets)

  const resolveAssignedTemplateForStore = (store: typeof stores[number]) => {
    const assignedId = resolveEffectiveStorefrontTemplateId(
      vendor?.settings,
      store.settings,
      templateMode,
    )
    if (!assignedId) return null
    return resolveTemplateDisplay(assignedId, websiteTemplates, legacyPresets)
  }

  const { storefrontCards, builderDraftCards } = useMemo(() => {
    const storefrontCards: StorefrontCardModel[] = []
    const builderDraftCards: BuilderDraftCardModel[] = []

    const sitesByStoreId = new Map<string, SiteListItem>()
    for (const site of mainSites) {
      if (site.website_store_scope === 'store' && site.website_store_id) {
        sitesByStoreId.set(site.website_store_id, site)
      }
    }

    const legacyHeroThumb = config?.hero_image_url?.trim()
      ? mediaUrl(String(config.hero_image_url))
      : null
    const legacyPreset = legacyPresets.find(p => p.id === (config?.template === 'dark' ? 'dark' : 'light'))
      ?? legacyPresets.find(p => p.id === 'light')
    const legacyGradient = presetPreviewGradient(legacyPreset)

    if (stores.length === 0) {
      const thumbSite = publishedSite as SiteListItem | undefined
      storefrontCards.push({
        key: 'main-storefront',
        name: 'Main Storefront',
        description: 'The primary storefront for your business.',
        builderTo: publishedSite ? `/websites/${publishedSite.id}` : '/websites/templates',
        liveUrl: commonLiveUrl,
        live: activeFront.kind === 'legacy_preset',
        templateName: mainStorefrontTemplate,
        templateThumbnail: thumbSite
          ? resolveSiteStaticThumbnail(thumbSite, websiteTemplates)
          : legacyHeroThumb,
        thumbnailSiteId: thumbSite?.id ?? null,
        livePreviewUrl: thumbSite ? null : commonLiveUrl,
        fallbackGradient: thumbSite ? null : legacyGradient,
      })
    } else {
      for (const store of stores) {
        const assignedTemplate = resolveAssignedTemplateForStore(store)
        const storeLiveUrl = customerLinkForStore(vendor?.slug, store, linkMode, templateMode)

        if (assignedTemplate) {
          storefrontCards.push({
            key: `bu-${store.id}`,
            name: store.name,
            description:
              store.description?.trim()
              || (isSingleTemplateMode
                ? (linkMode === 'single'
                  ? 'Default business unit · shared template for all units.'
                  : 'Uses the shared template assigned for all business units.')
                : (store.is_default
                  ? 'Default business unit · customer-facing storefront.'
                  : 'Business unit storefront for this outlet.')),
            builderTo: '/websites/templates',
            liveUrl: storeLiveUrl,
            live: store.is_default && activeFront.kind === 'legacy_preset',
            templateName: assignedTemplate.name,
            templateThumbnail: assignedTemplate.thumbnail || legacyHeroThumb,
            thumbnailSiteId: null,
            livePreviewUrl: storeLiveUrl,
            fallbackGradient: assignedTemplate.gradient ?? legacyGradient,
          })
          continue
        }

        const linkedSite = sitesByStoreId.get(store.id)
        const templateName = linkedSite
          ? (resolveSiteAppliedTemplateLabel(linkedSite, websiteTemplates) ?? 'Custom website')
          : store.is_default
            ? mainStorefrontTemplate
            : 'Default storefront'
        const defaultPublishedThumb = store.is_default ? (publishedSite as SiteListItem | undefined) : undefined
        const thumbSite = linkedSite ?? defaultPublishedThumb
        const useLiveIframe = !linkedSite && !(store.is_default && publishedSite)
        storefrontCards.push({
          key: `bu-${store.id}`,
          name: store.name,
          description:
            store.description?.trim() ||
            (store.is_default
              ? 'Default business unit · customer-facing storefront.'
              : 'Business unit storefront for this outlet.'),
          builderTo: linkedSite
            ? `/websites/${linkedSite.id}`
            : publishedSite
              ? `/websites/${publishedSite.id}`
              : '/websites/templates',
          liveUrl: storeLiveUrl,
          live: Boolean(
            (store.is_default && activeFront.kind === 'legacy_preset') ||
              (linkedSite?.is_published &&
                activeFront.kind === 'website_builder' &&
                activeFront.siteId === linkedSite.id),
          ),
          templateName,
          templateThumbnail: thumbSite
            ? resolveSiteStaticThumbnail(thumbSite, websiteTemplates)
            : legacyHeroThumb,
          thumbnailSiteId: linkedSite?.id ?? (store.is_default && publishedSite ? publishedSite.id : null),
          livePreviewUrl: useLiveIframe ? storeLiveUrl : null,
          fallbackGradient: thumbSite ? null : legacyGradient,
        })
      }
    }

    for (const site of mainSites) {
      if (site.website_store_scope === 'store' && site.website_store_id && sitesByStoreId.has(site.website_store_id)) {
        continue
      }
      const templateName = resolveSiteAppliedTemplateLabel(site, websiteTemplates) ?? 'Custom website'
      builderDraftCards.push({
        key: site.id,
        siteId: site.id,
        name: site.name,
        description: site.description?.trim() || 'Website Builder draft — preview before publishing.',
        builderTo: `/websites/${site.id}`,
        templateName,
        templateThumbnail: resolveSiteStaticThumbnail(site, websiteTemplates),
        thumbnailSiteId: site.id,
        fallbackGradient: null,
      })
    }

    return { storefrontCards, builderDraftCards }
  }, [
    activeFront,
    commonLiveUrl,
    config?.hero_image_url,
    mainSites,
    mainStorefrontTemplate,
    publishedSite,
    vendor,
    websiteTemplates,
    stores,
    linkMode,
    templateMode,
    vendor?.settings,
  ])

  const websiteToolLinks: HubLink[] = [
    {
      title: 'Website Builder',
      shortTitle: 'Builder',
      description: 'Design pages with blocks — hero, categories, products, nav, footer.',
      to: publishedSite ? `/websites/${publishedSite.id}` : '/websites',
      icon: Layout,
      primary: true,
    },
    {
      title: 'Blog Manager',
      shortTitle: 'Blog',
      description: 'Posts and articles on your public storefront.',
      to: '/blog',
      icon: Newspaper,
    },
    {
      title: 'Business Front Display',
      shortTitle: 'Display',
      description: 'Product and service fields on cards and detail pages.',
      to: '/system/storefront-display',
      icon: SlidersHorizontal,
    },
    {
      title: 'Social & Web Links',
      shortTitle: 'Social links',
      description: 'Social profiles and footer links on your storefront.',
      to: '/system/social-links',
      icon: Link2,
    },
    {
      title: 'Website Templates',
      shortTitle: 'Templates',
      description: 'Default store themes, colors & layout, and full-site layouts.',
      to: '/websites/templates',
      icon: Sparkles,
    },
  ]

  const storefrontColCount = Math.min(Math.max(storefrontCards.length, 1), 5)
  const storefrontGridClass = {
    1: 'lg:grid-cols-1',
    2: 'lg:grid-cols-2',
    3: 'lg:grid-cols-3',
    4: 'lg:grid-cols-4',
    5: 'lg:grid-cols-5',
  }[storefrontColCount as 1 | 2 | 3 | 4 | 5]

  const builderColCount = Math.min(Math.max(builderDraftCards.length, 1), 5)
  const builderGridClass = {
    1: 'lg:grid-cols-1',
    2: 'lg:grid-cols-2',
    3: 'lg:grid-cols-3',
    4: 'lg:grid-cols-4',
    5: 'lg:grid-cols-5',
  }[builderColCount as 1 | 2 | 3 | 4 | 5]

  return (
    <div className="mx-auto max-w-[1600px] space-y-3 pb-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Website Management</p>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">Dashboard</h1>
        </div>
        <p className="text-xs text-gray-500 sm:max-w-sm sm:text-right">
          Manage storefronts, builder sites, and public links from one place.
        </p>
      </div>

      <nav
        aria-label="Website tools"
        className="rounded-xl border border-gray-200/80 bg-white px-2 py-2 shadow-sm"
      >
        <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
          {websiteToolLinks.map(item => (
            <li key={item.to}>
              <Link
                to={item.to}
                title={item.description}
                className={cn(
                  'flex min-h-[3.25rem] items-center gap-2 rounded-lg px-2.5 py-2 transition-colors hover:bg-accent/60',
                  item.primary && 'bg-primary/5 ring-1 ring-inset ring-primary/15',
                )}
              >
                <span
                  className={cn(
                    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    item.primary ? 'bg-primary/15 text-primary' : 'bg-gray-100 text-gray-600',
                  )}
                >
                  <item.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 text-left">
                  <span className="block truncate text-xs font-semibold text-gray-900">{item.shortTitle}</span>
                  <span className="hidden truncate text-[10px] text-gray-500 xl:block">{item.title}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-labelledby="storefronts-heading">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 id="storefronts-heading" className="text-sm font-bold text-gray-900">
            Storefronts
          </h2>
          <p className="text-[11px] font-medium text-gray-500">
            {storefrontCards.length} live
          </p>
        </div>
        <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', storefrontGridClass)}>
          {storefrontCards.map(card => (
            <WebsiteStorefrontCard
              key={card.key}
              name={card.name}
              description={card.description}
              builderTo={card.builderTo}
              liveUrl={card.liveUrl}
              live={card.live}
              onChangeTheme={() => setThemeCustomizerOpen(true)}
              templateName={card.templateName}
              templateThumbnail={card.templateThumbnail}
              thumbnailSiteId={card.thumbnailSiteId}
              livePreviewUrl={card.livePreviewUrl}
              vendorSlug={vendor?.slug}
              previewTemplates={websiteTemplates}
              fallbackGradient={card.fallbackGradient}
            />
          ))}
        </div>
      </section>

      {builderDraftCards.length > 0 ? (
        <>
          <div className="border-t border-gray-200/90 pt-1" role="separator" aria-hidden="true" />
          <section aria-labelledby="builder-drafts-heading">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <h2 id="builder-drafts-heading" className="text-sm font-bold text-gray-900">
                  Website Builder
                </h2>
                <p className="text-[11px] text-gray-500">Draft sites — preview before going live</p>
              </div>
              <p className="shrink-0 text-[11px] font-medium text-gray-500">
                {builderDraftCards.length} draft{builderDraftCards.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', builderGridClass)}>
              {builderDraftCards.map(card => (
                <WebsiteStorefrontCard
                  key={card.key}
                  name={card.name}
                  description={card.description}
                  builderTo={card.builderTo}
                  draft
                  previewSiteId={card.siteId}
                  onPreview={openBuilderSiteDraftPreview}
                  templateName={card.templateName}
                  templateThumbnail={card.templateThumbnail}
                  thumbnailSiteId={card.thumbnailSiteId}
                  vendorSlug={vendor?.slug}
                  previewTemplates={websiteTemplates}
                  fallbackGradient={card.fallbackGradient}
                />
              ))}
            </div>
          </section>
        </>
      ) : null}

      <StoreThemeCustomizerDialog
        open={themeCustomizerOpen}
        onClose={() => setThemeCustomizerOpen(false)}
      />
    </div>
  )
}
