import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Globe, Layout, SlidersHorizontal,
  Sparkles, Newspaper, Link2, Search, ChevronRight, Palette,
} from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import { useSiteList, useWebsiteTemplates } from '@/hooks/useWebsites'
import { useStores } from '@/hooks/useVendor'
import { useVendorStore } from '@/stores/vendorStore'
import { resolveBusinessFrontActiveTemplate } from '@/lib/businessFrontActiveTemplate'
import { buildCustomerStoreLink, customerLinkForStore, resolveEffectiveStorefrontTemplateId, resolveStorefrontLinkMode, resolveStorefrontTemplateMode } from '@/lib/liveStorefrontUrl'
import { isTemplateSandboxSite } from '@/lib/websiteSandbox'
import { WebsiteStorefrontCard } from '@/components/websites/WebsiteStorefrontCard'
import { StoreThemeCustomizerDialog } from '@/components/websites/StoreThemeCustomizerDialog'
import {
  resolveMainStorefrontTemplateLabel,
  resolveSiteAppliedTemplateLabel,
  resolveTemplateDisplay,
} from '@/lib/websiteAppliedTemplate'
import { resolveSiteStaticThumbnail } from '@/lib/websiteSitePreview'
import { formatStoreCode } from '@/lib/verification'
import type { SiteListItem } from '@/types/websites'
import { cn, mediaUrl, solidButtonFocusClassName } from '@/lib/utils'

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
  storeCode: string | null
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

function presetPreviewGradient(preset: { colors?: Record<string, string> } | undefined): string | null {
  const colors = preset?.colors
  if (!colors) return null
  const start = colors.primary?.trim() || colors.accent?.trim()
  const end = colors.secondary?.trim() || colors.background?.trim()
  if (start && end && start !== end) return `linear-gradient(135deg, ${start}, ${end})`
  return start || end || null
}

function storefrontDescription(
  store: { description?: string | null; is_default?: boolean },
  isSingleTemplateMode: boolean,
): string {
  if (store.description?.trim()) return store.description.trim()
  if (isSingleTemplateMode) return 'Shared storefront template for all business units.'
  if (store.is_default) return 'Default business unit · customer-facing storefront.'
  return 'Business unit storefront for this outlet.'
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
  const showLegacyThemeCustomizer = activeFront.kind === 'legacy_preset'

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

  const storefrontCards = useMemo(() => {
    const cards: StorefrontCardModel[] = []

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
      cards.push({
        key: 'main-storefront',
        name: 'Main Storefront',
        storeCode: null,
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
        const storeCode = formatStoreCode(store)

        if (assignedTemplate) {
          cards.push({
            key: `bu-${store.id}`,
            name: store.name,
            storeCode,
            description: storefrontDescription(store, isSingleTemplateMode),
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
        cards.push({
          key: `bu-${store.id}`,
          name: store.name,
          storeCode,
          description: storefrontDescription(store, isSingleTemplateMode),
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

    return cards
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
    isSingleTemplateMode,
    vendor?.settings,
    legacyPresets,
  ])

  const liveStorefrontCount = storefrontCards.filter(card => card.live).length

  const websiteToolLinks: HubLink[] = [
    {
      title: 'Business Website Builder',
      shortTitle: 'Builder',
      description: 'Design pages with blocks — hero, categories, products, nav, footer.',
      to: publishedSite ? `/websites/${publishedSite.id}` : '/websites',
      icon: Layout,
      primary: true,
    },
    {
      title: 'Business Website Templates',
      shortTitle: 'Templates',
      description: 'Assign themes and Business Website Builder layouts to each business unit.',
      to: '/websites/templates',
      icon: Sparkles,
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
      title: 'Blog Manager',
      shortTitle: 'Blog',
      description: 'Posts and articles on your public storefront.',
      to: '/blog',
      icon: Newspaper,
    },
    {
      title: 'SEO Management',
      shortTitle: 'SEO',
      description: 'Google titles, meta descriptions, and social share previews.',
      to: '/websites/seo',
      icon: Search,
    },
  ]

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 pb-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Website Management</p>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Dashboard</h1>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
            Manage storefronts, builder sites, and public customer links from one place.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            {storefrontCards.length} storefront{storefrontCards.length === 1 ? '' : 's'}
          </span>
          {liveStorefrontCount > 0 ? (
            <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
              {liveStorefrontCount} live
            </span>
          ) : null}
          {showLegacyThemeCustomizer ? (
            <ButtonLike
              onClick={() => setThemeCustomizerOpen(true)}
              icon={Palette}
              label="Theme colors"
            />
          ) : null}
          <ButtonLike to="/websites/templates" icon={Sparkles} label="Manage templates" primary />
        </div>
      </header>

      <nav
        aria-label="Website tools"
        className="rounded-xl border border-border bg-card p-2 shadow-sm dark:shadow-none dark:ring-1 dark:ring-border/60"
      >
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {websiteToolLinks.map(item => (
            <li key={item.to}>
              <Link
                to={item.to}
                title={item.description}
                className={cn(
                  'group flex min-h-[4.25rem] items-start gap-2.5 rounded-lg border border-transparent px-2.5 py-2.5 transition-all',
                  'hover:border-border hover:bg-accent/50 dark:hover:bg-accent/30',
                  item.primary &&
                    'border-primary/20 bg-primary/[0.06] ring-1 ring-inset ring-primary/15 dark:bg-primary/10',
                )}
              >
                <span
                  className={cn(
                    'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                    item.primary
                      ? 'bg-primary/15 text-primary dark:bg-primary/20'
                      : 'bg-muted text-muted-foreground dark:bg-secondary',
                  )}
                >
                  <item.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 pt-0.5">
                  <span className="flex items-center gap-1">
                    <span className="truncate text-sm font-semibold text-foreground">{item.shortTitle}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                    {item.description}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section
        aria-labelledby="storefronts-heading"
        className="rounded-xl border border-border bg-card p-3 shadow-sm dark:shadow-none dark:ring-1 dark:ring-border/60"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="storefronts-heading" className="text-sm font-bold text-foreground">
              Storefronts
            </h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {isSingleTemplateMode
                ? 'One shared template across all business units.'
                : 'Each business unit can use its own customer-facing template.'}
            </p>
          </div>
          <Link
            to="/websites/templates"
            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted/60"
          >
            Assign templates
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {storefrontCards.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
            <p className="text-sm font-semibold text-foreground">No storefronts yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Add a business unit or publish a website to get started.</p>
            <Link
              to="/websites/templates"
              className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              Open templates
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {storefrontCards.map(card => (
              <WebsiteStorefrontCard
                key={card.key}
                name={card.name}
                storeCode={card.storeCode}
                description={card.description}
                builderTo={card.builderTo}
                liveUrl={card.liveUrl}
                live={card.live}
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
        )}
      </section>

      <StoreThemeCustomizerDialog
        open={themeCustomizerOpen}
        onClose={() => setThemeCustomizerOpen(false)}
      />
    </div>
  )
}

function ButtonLike({
  to,
  onClick,
  icon: Icon,
  label,
  primary,
}: {
  to?: string
  onClick?: () => void
  icon: typeof Globe
  label: string
  primary?: boolean
}) {
  const className = cn(
    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
    primary
      ? cn('bg-primary text-primary-foreground hover:opacity-90', solidButtonFocusClassName)
      : 'border border-border bg-background text-foreground hover:bg-muted/60',
  )

  if (to) {
    return (
      <Link to={to} className={className}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}
