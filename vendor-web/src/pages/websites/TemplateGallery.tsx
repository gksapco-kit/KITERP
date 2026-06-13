import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Sparkles, Search, Globe, ChevronRight, Check, Store, Eye, LayoutTemplate, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSiteList, useWebsiteTemplates } from '@/hooks/useWebsites'
import { useUpdateVendor } from '@/hooks/useVendor'
import type { WebsiteTemplate } from '@/types/websites'
import { getTemplatePreviewPalette } from '@/lib/templateBlockHighlights'
import { WebsiteTemplatePreviewModal, getStorefrontTemplateBrowserPreviewUrl } from '@/components/websites/WebsiteTemplatePreviewModal'
import { BusinessFrontDefaultTemplateCard } from '@/components/websites/BusinessFrontDefaultTemplateCard'
import { StoreThemeCustomizerDialog } from '@/components/websites/StoreThemeCustomizerDialog'
import { openDraftPreviewInBrowser, wrapStorefrontPreviewForVendorBrowser } from '@/lib/storefrontPreviewUrl'
import {
  resolveSingleFrontTemplateId,
  resolveStorefrontLinkMode,
  SINGLE_FRONT_TEMPLATE_KEY,
} from '@/lib/liveStorefrontUrl'
import { vendorApi } from '@/api/vendor'
import { useVendorStore } from '@/stores/vendorStore'
import { toast } from 'sonner'

const formatCategoryLabel = (cat: string) =>
  cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)

function TemplateCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_1px_0_rgba(0,0,0,0.02)]">
      <div className="h-36 w-full animate-pulse bg-gradient-to-r from-gray-100 to-gray-200/70 sm:h-40" />
      <div className="space-y-2.5 p-3.5">
        <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-gray-100" />
        <div className="flex justify-end gap-2 pt-1">
          <div className="h-7 w-16 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-7 w-16 animate-pulse rounded-lg bg-gray-200" />
        </div>
      </div>
    </div>
  )
}

export default function WebsiteTemplateGalleryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const vendor = useVendorStore(s => s.vendor)
  const updateVendor = useUpdateVendor()
  const singleFrontBannerRef = useRef<HTMLDivElement>(null)
  const { data: sites = [], isLoading: sitesLoading } = useSiteList()
  const { data: templates = [], isLoading: templatesLoading } = useWebsiteTemplates()
  const { data: themeConfig, isLoading: themeLoading } = useQuery({
    queryKey: ['template-config'],
    queryFn: () => vendorApi.getTemplateConfig(),
  })
  const { data: presetsData, isLoading: presetsLoading } = useQuery({
    queryKey: ['template-presets'],
    queryFn: () => vendorApi.getTemplatePresets(),
  })

  const [templateSearch, setTemplateSearch] = useState('')
  const [templateCategory, setTemplateCategory] = useState<string>('all')
  const [applyTemplate, setApplyTemplate] = useState<WebsiteTemplate | null>(null)
  const [customizeOpen, setCustomizeOpen] = useState(false)

  const siteParam = searchParams.get('site')
  const singleFrontHighlight = searchParams.get('singleFront') === '1'
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)

  const storefrontLinkMode = resolveStorefrontLinkMode(vendor?.settings)
  const isSingleFrontMode = storefrontLinkMode === 'single'
  const singleFrontTemplateId = resolveSingleFrontTemplateId(vendor?.settings)

  const handleUseForAllStores = useCallback(
    (templateId: string) => {
      const current = useVendorStore.getState().vendor
      if (!current) return
      updateVendor.mutate(
        {
          settings: { ...(current.settings ?? {}), [SINGLE_FRONT_TEMPLATE_KEY]: templateId },
        },
        {
          onSuccess: () => {
            toast.success('Template set for all business units')
            setSearchParams(prev => {
              const next = new URLSearchParams(prev)
              next.delete('singleFront')
              return next
            }, { replace: true })
          },
        },
      )
    },
    [setSearchParams, updateVendor],
  )

  useEffect(() => {
    if (!singleFrontHighlight || !isSingleFrontMode) return
    singleFrontBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [singleFrontHighlight, isSingleFrontMode])

  useEffect(() => {
    if (sitesLoading || sites.length === 0) return
    const firstId = sites[0].id
    if (siteParam && sites.some(s => s.id === siteParam)) {
      setSelectedSiteId(siteParam)
    } else {
      setSelectedSiteId(firstId)
      if (siteParam !== firstId) {
        setSearchParams({ site: firstId }, { replace: true })
      }
    }
  }, [sitesLoading, sites, siteParam, setSearchParams])

  useEffect(() => {
    if (searchParams.get('customize') !== '1') return
    setCustomizeOpen(true)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('customize')
      return next
    }, { replace: true })
  }, [searchParams, setSearchParams])

  const categories = useMemo(() => {
    const c = new Set<string>()
    for (const t of templates) {
      if (t.category) c.add(t.category)
    }
    return ['all', ...Array.from(c).sort((a, b) => a.localeCompare(b))]
  }, [templates])

  const filteredTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase()
    return templates
      .filter(t => (templateCategory === 'all' ? true : t.category === templateCategory))
      .filter(t => {
        if (!q) return true
        const hay = `${t.name || ''} ${t.description || ''}`.toLowerCase()
        return hay.includes(q)
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [templates, templateSearch, templateCategory])

  const selectedSite = sites.find(s => s.id === selectedSiteId) ?? null
  const busy = sitesLoading || templatesLoading
  const legacyPresetsBusy = themeLoading || presetsLoading || sitesLoading
  const legacyPresets = presetsData?.presets ?? []
  const lightPreset = legacyPresets.find(p => p.id === 'light')
  const showDefaultLayoutCard = templateCategory === 'all' && !templateSearch.trim()

  const activeSingleFrontTemplate = useMemo((): {
    id: string
    name: string
    description?: string
    thumbnail?: string | null
    gradient?: string
  } | null => {
    if (!singleFrontTemplateId) return null
    const tpl = templates.find(t => t.id === singleFrontTemplateId)
    if (tpl) {
      return {
        id: tpl.id,
        name: tpl.name,
        description: tpl.description,
        thumbnail: tpl.thumbnail,
      }
    }
    const preset = legacyPresets.find(p => p.id === singleFrontTemplateId)
    if (preset) {
      const colors = preset.colors
      const palette = colors
        ? [colors.primary, colors.secondary, colors.accent, colors.background].filter(Boolean) as string[]
        : []
      const gradient =
        palette.length >= 2
          ? `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`
          : 'linear-gradient(135deg, #64C3A0, #13624A)'
      return {
        id: preset.id,
        name: preset.name,
        description: preset.description ?? 'Default storefront theme',
        gradient,
      }
    }
    return {
      id: singleFrontTemplateId,
      name: singleFrontTemplateId,
      description: 'Shared template for all stores',
    }
  }, [legacyPresets, singleFrontTemplateId, templates])

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-accent/70 to-gray-50/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-extrabold tracking-tight text-gray-900 sm:text-xl">
                Website Templates
              </h1>
              <p className="mt-0.5 max-w-xl text-sm text-gray-600">
                Choose a default store layout or apply full-site Website Builder templates.
              </p>
            </div>
          </div>
          <Link
            to="/websites"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-primary/30 bg-white px-3.5 py-2 text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-primary/5"
          >
            <Globe className="h-4 w-4" />
            Open Website Builder
            <ChevronRight className="h-4 w-4 opacity-60" />
          </Link>
        </div>

        {isSingleFrontMode ? (
          <div
            ref={singleFrontBannerRef}
            className={cn(
              'mb-6 rounded-2xl border px-4 py-4 sm:px-5',
              singleFrontHighlight
                ? 'border-violet-300 bg-violet-50/80 ring-2 ring-violet-200'
                : 'border-violet-200/80 bg-violet-50/50',
            )}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-violet-800">
                  <Store className="h-3.5 w-3.5" />
                  Single website for all stores
                </p>
                <h2 className="mt-1 text-base font-bold text-gray-900">
                  Choose the template for every business unit
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-gray-600">
                  Your account uses one shared customer website. Pick a template below with{' '}
                  <span className="font-semibold">Use for all stores</span> — any template assigned to
                  individual business units is ignored.
                </p>
                {!activeSingleFrontTemplate ? (
                  <p className="mt-2 text-xs font-medium text-amber-800">
                    No template selected yet — choose one below.
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                <Link
                  to="/settings"
                  className="text-right text-xs font-semibold text-violet-700 hover:underline"
                >
                  Change link mode in settings
                </Link>
                {activeSingleFrontTemplate ? (
                  <div
                    className="w-full max-w-[11rem] overflow-hidden rounded-xl border border-violet-200/80 bg-white shadow-sm sm:w-44"
                    title={activeSingleFrontTemplate.name}
                  >
                    <div className="relative h-16 w-full overflow-hidden">
                      {activeSingleFrontTemplate.thumbnail ? (
                        <img
                          src={activeSingleFrontTemplate.thumbnail}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="h-full w-full"
                          style={{
                            background:
                              activeSingleFrontTemplate.gradient
                              ?? 'linear-gradient(135deg, #64C3A0, #13624A)',
                          }}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
                      <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-violet-600 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white">
                        <Check className="h-2.5 w-2.5" />
                        All stores
                      </span>
                    </div>
                    <div className="px-2.5 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                        In use
                      </p>
                      <p className="truncate text-xs font-bold text-gray-900">
                        {activeSingleFrontTemplate.name}
                      </p>
                      {activeSingleFrontTemplate.description ? (
                        <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-gray-500">
                          {activeSingleFrontTemplate.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-24 w-full max-w-[11rem] flex-col items-center justify-center rounded-xl border border-dashed border-violet-300/80 bg-white/60 px-3 text-center sm:w-44">
                    <Sparkles className="mb-1 h-4 w-4 text-violet-400" />
                    <p className="text-[10px] font-medium text-violet-700">Pick a template below</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <div className="mb-4 rounded-2xl border border-gray-200/80 bg-white p-3 shadow-sm sm:p-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={templateSearch}
                onChange={e => setTemplateSearch(e.target.value)}
                placeholder="Search templates…"
                className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {templateSearch ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setTemplateSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <div className="flex flex-1 flex-wrap gap-1.5">
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setTemplateCategory(cat)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-bold transition-colors',
                    templateCategory === cat
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                  )}
                >
                  {formatCategoryLabel(cat)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!busy && !legacyPresetsBusy ? (
          <p className="mb-3 text-xs font-medium text-gray-500">
            {filteredTemplates.length + (showDefaultLayoutCard && lightPreset ? 1 : 0)} template
            {filteredTemplates.length + (showDefaultLayoutCard && lightPreset ? 1 : 0) === 1 ? '' : 's'}
            {templateCategory !== 'all' ? ` in ${formatCategoryLabel(templateCategory)}` : ''}
          </p>
        ) : null}

        {(busy || legacyPresetsBusy) && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <TemplateCardSkeleton key={i} />
            ))}
          </div>
        )}
        {!busy && !legacyPresetsBusy && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {showDefaultLayoutCard && lightPreset && (
              <BusinessFrontDefaultTemplateCard
                preset={lightPreset}
                themeTemplateId={themeConfig?.template}
                sites={sites}
                vendorSlug={vendor?.slug}
                onCustomize={() => setCustomizeOpen(true)}
                singleFrontMode={isSingleFrontMode}
                isSingleFrontSelected={singleFrontTemplateId === lightPreset.id}
                onUseForAllStores={handleUseForAllStores}
                useForAllStoresPending={updateVendor.isPending}
              />
            )}
            {filteredTemplates.map((tpl: WebsiteTemplate) => {
              const pageCount = tpl.page_count ?? tpl.pages?.length ?? 0
              const tier = tpl.tier || (pageCount >= 6 ? 'full' : 'lite')
              const palette = getTemplatePreviewPalette(tpl)
              const isSingleFrontSelected = singleFrontTemplateId === tpl.id
              return (
                <div
                  key={tpl.id}
                  className={cn(
                    'flex flex-col text-left border border-gray-100 rounded-2xl overflow-hidden hover:border-primary/30 transition-all group bg-white',
                    'shadow-[0_1px_0_rgba(0,0,0,0.02)] hover:shadow-[0_8px_24px_rgba(100,195,160,0.15)] hover:-translate-y-0.5',
                    isSingleFrontMode && isSingleFrontSelected && 'border-violet-400 ring-2 ring-violet-200',
                  )}
                >
                  <div className="relative overflow-hidden">
                    {tpl.thumbnail ? (
                      <img src={tpl.thumbnail} className="w-full h-36 sm:h-40 object-cover transition-transform duration-300 group-hover:scale-105" alt={tpl.name} loading="lazy" />
                    ) : (
                      <div className="w-full h-36 sm:h-40 bg-gradient-to-r from-accent to-primary/20" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent pointer-events-none" />
                    {isSingleFrontMode && isSingleFrontSelected ? (
                      <span className="absolute top-2 right-2 text-[10px] uppercase tracking-wide font-extrabold bg-violet-600 text-white rounded-full px-2 py-0.5">
                        All stores
                      </span>
                    ) : null}
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wide',
                          tier === 'full' ? 'bg-accent text-primary' : 'bg-white/80 text-gray-700',
                        )}>
                          {tier === 'full' ? 'Full site' : 'Lite'}
                        </span>
                        {tpl.id.startsWith('storefront_') && (
                          <span className="text-xs bg-primary/90 text-white rounded-full px-2 py-0.5 font-semibold">
                            Storefront
                          </span>
                        )}
                        {(tpl.id === 'atelier' || tpl.id === 'verde' || tpl.id === 'solace') && (
                          <span className="text-xs bg-amber-600/90 text-white rounded-full px-2 py-0.5 font-semibold">
                            Editorial
                          </span>
                        )}
                        <span className="text-xs bg-white/80 text-gray-700 rounded-full px-2 py-0.5 font-semibold">
                          {pageCount} pg
                        </span>
                      </div>
                      <span className="inline-flex -space-x-1">
                        {palette.slice(0, 5).map((c, i) => (
                          <span key={`${c}-${i}`} className="w-3.5 h-3.5 rounded-full border border-white shadow-sm" style={{ backgroundColor: c }} />
                        ))}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-3.5">
                    <div className="font-extrabold text-gray-900 group-hover:text-primary transition-colors">{tpl.name}</div>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{tpl.description}</p>
                    <div className="mt-auto flex flex-wrap items-center justify-end gap-2 pt-3">
                      {isSingleFrontMode ? (
                        <button
                          type="button"
                          disabled={isSingleFrontSelected || updateVendor.isPending}
                          onClick={() => handleUseForAllStores(tpl.id)}
                          className={cn(
                            'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors',
                            isSingleFrontSelected
                              ? 'bg-violet-100 text-violet-800 cursor-default'
                              : 'bg-violet-600 text-white hover:bg-violet-700',
                          )}
                        >
                          {isSingleFrontSelected ? <Check className="h-3.5 w-3.5" /> : null}
                          {isSingleFrontSelected ? 'In use for all stores' : 'Use for all stores'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          openDraftPreviewInBrowser(
                            wrapStorefrontPreviewForVendorBrowser(getStorefrontTemplateBrowserPreviewUrl(tpl.id)),
                          )
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-extrabold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Preview
                      </button>
                      <button
                        type="button"
                        disabled={!selectedSiteId}
                        onClick={() => {
                          if (!selectedSiteId) {
                            toast.error('Choose a site first.')
                            return
                          }
                          setApplyTemplate(tpl)
                        }}
                        className={cn(
                          'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors',
                          selectedSiteId
                            ? 'bg-primary text-white hover:opacity-90'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed',
                        )}
                      >
                        <LayoutTemplate className="h-3.5 w-3.5" />
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!busy && !legacyPresetsBusy && filteredTemplates.length === 0 && !showDefaultLayoutCard && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white/60 px-6 py-12 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <Search className="h-5 w-5" />
            </span>
            <p className="text-sm font-semibold text-gray-700">No templates match your filters</p>
            <p className="mt-1 text-xs text-gray-500">Try a different search or category.</p>
            <button
              type="button"
              onClick={() => {
                setTemplateSearch('')
                setTemplateCategory('all')
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-extrabold text-gray-700 hover:bg-gray-50"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </button>
          </div>
        )}
      </div>

      <StoreThemeCustomizerDialog open={customizeOpen} onClose={() => setCustomizeOpen(false)} />

      <WebsiteTemplatePreviewModal
        template={applyTemplate}
        siteId={selectedSiteId}
        siteLabel={selectedSite?.name}
        initialApplyArmed
        onClose={() => setApplyTemplate(null)}
        zIndexClass="z-[300]"
      />
    </div>
  )
}
