import { useMemo, useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles, Search, Globe, ChevronRight, ChevronDown, Check, Store, Eye, LayoutTemplate, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSiteList, useWebsiteTemplates } from '@/hooks/useWebsites'
import { useUpdateVendor, useStores, vendorKeys } from '@/hooks/useVendor'
import type { WebsiteTemplate } from '@/types/websites'
import { getTemplatePreviewPalette } from '@/lib/templateBlockHighlights'
import { WebsiteTemplatePreviewModal, getStorefrontTemplateBrowserPreviewUrl } from '@/components/websites/WebsiteTemplatePreviewModal'
import { AppliedTemplateViewLiveButton, templateCardIconActionClass } from '@/components/websites/AppliedTemplateViewLiveButton'
import { BusinessFrontDefaultTemplateCard } from '@/components/websites/BusinessFrontDefaultTemplateCard'
import { StoreThemeCustomizerDialog } from '@/components/websites/StoreThemeCustomizerDialog'
import { StorefrontTemplateModeToggle } from '@/components/business-units/StorefrontTemplateModeToggle'
import { openDraftPreviewInBrowser, wrapStorefrontPreviewForVendorBrowser } from '@/lib/storefrontPreviewUrl'
import {
  resolveAppliedTemplateViewLiveLinks,
  resolveSingleFrontTemplateId,
  resolveStorefrontLinkMode,
  resolveStorefrontTemplateMode,
  resolveStoreFrontTemplateId,
  SINGLE_FRONT_TEMPLATE_KEY,
  STORE_FRONT_TEMPLATE_KEY,
  STOREFRONT_TEMPLATE_MODE_KEY,
  type StorefrontTemplateMode,
} from '@/lib/liveStorefrontUrl'
import { resolveTemplateDisplay } from '@/lib/websiteAppliedTemplate'
import { formatAssignedStoresLabel, storesAssignedToTemplate } from '@/lib/websiteTemplateAssignment'
import { templateBadgeEmeraldClass, templateBadgeVioletClass } from '@/lib/websiteTemplateBadges'
import { vendorApi } from '@/api/vendor'
import { useVendorStore } from '@/stores/vendorStore'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const formatCategoryLabel = (cat: string) =>
  cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)

const categoryChipClass = (active: boolean) =>
  cn(
    'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold transition-colors whitespace-nowrap',
    active ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
  )

function TemplateCategoryFilters({
  categories,
  value,
  onChange,
}: {
  categories: string[]
  value: string
  onChange: (cat: string) => void
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(categories.length)
  const [moreOpen, setMoreOpen] = useState(false)

  const recalcVisible = useCallback(() => {
    const row = rowRef.current
    const measure = measureRef.current
    if (!row || !measure) return
    const chips = measure.querySelectorAll('[data-cat-measure]')
    if (!chips.length) {
      setVisibleCount(categories.length)
      return
    }
    const moreReserve = categories.length > 1 ? 92 : 0
    const available = row.clientWidth - moreReserve
    let used = 0
    let count = 0
    for (const chip of chips) {
      const w = (chip as HTMLElement).offsetWidth + 6
      if (used + w > available && count > 0) break
      used += w
      count++
    }
    setVisibleCount(count >= categories.length ? categories.length : Math.max(1, count))
  }, [categories])

  useLayoutEffect(() => {
    recalcVisible()
    const row = rowRef.current
    if (!row) return
    const ro = new ResizeObserver(() => recalcVisible())
    ro.observe(row)
    return () => ro.disconnect()
  }, [recalcVisible])

  useEffect(() => {
    if (!moreOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [moreOpen])

  const overflow = categories.slice(visibleCount)
  const visible = categories.slice(0, visibleCount)
  const selectedInOverflow = overflow.includes(value)

  return (
    <div className="relative min-w-0 flex-1">
      <div ref={measureRef} className="pointer-events-none invisible absolute flex gap-1.5" aria-hidden>
        {categories.map(cat => (
          <span key={cat} data-cat-measure className={categoryChipClass(false)}>
            {formatCategoryLabel(cat)}
          </span>
        ))}
      </div>
      <div ref={rowRef} className="flex min-w-0 items-center gap-1.5">
        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-hidden">
          {visible.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => onChange(cat)}
              className={categoryChipClass(value === cat)}
            >
              {formatCategoryLabel(cat)}
            </button>
          ))}
        </div>
        {overflow.length > 0 ? (
          <div ref={moreRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMoreOpen(open => !open)}
              className={cn(categoryChipClass(selectedInOverflow), 'inline-flex items-center gap-0.5')}
            >
              {selectedInOverflow ? formatCategoryLabel(value) : `+${overflow.length} more`}
              <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', moreOpen && 'rotate-180')} />
            </button>
            {moreOpen ? (
              <div className="absolute right-0 top-full z-20 mt-1 min-w-[9rem] rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                {overflow.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      onChange(cat)
                      setMoreOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-1.5 text-left text-xs font-semibold hover:bg-gray-50',
                      value === cat ? 'text-primary' : 'text-gray-700',
                    )}
                  >
                    {formatCategoryLabel(cat)}
                    {value === cat ? <Check className="h-3.5 w-3.5" /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

type PickerStore = {
  id: string
  name: string
  is_default?: boolean
  currentTemplateName?: string | null
}

function StoreTemplatePicker({
  templateName,
  stores,
  initialSelected,
  pending,
  onClose,
  onConfirm,
}: {
  templateName: string
  stores: PickerStore[]
  initialSelected: string[]
  pending?: boolean
  onClose: () => void
  onConfirm: (storeIds: string[]) => void
}) {
  const [selected, setSelected] = useState<string[]>(initialSelected)

  const toggle = (id: string) =>
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))

  const allSelected = stores.length > 0 && selected.length === stores.length
  const toggleAll = () => setSelected(allSelected ? [] : stores.map(s => s.id))

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="store-template-picker-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id="store-template-picker-title" className="text-base font-semibold text-foreground">
              Apply “{templateName}”
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose which business units / stores should use this template.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between border-b border-border px-5 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            {selected.length} of {stores.length} selected
          </span>
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs font-semibold text-emerald-700 hover:underline"
          >
            {allSelected ? 'Clear all' : 'Select all'}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {stores.map(store => {
            const checked = selected.includes(store.id)
            return (
              <button
                key={store.id}
                type="button"
                onClick={() => toggle(store.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                  checked ? 'bg-emerald-50' : 'hover:bg-gray-50',
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                    checked ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-300 bg-white',
                  )}
                >
                  {checked ? <Check className="h-3.5 w-3.5" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-gray-900">{store.name}</span>
                    {store.is_default ? (
                      <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gray-500">
                        Default
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-gray-500">
                    {store.currentTemplateName
                      ? `Currently: ${store.currentTemplateName}`
                      : 'No template assigned'}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex gap-2 border-t border-border px-5 py-4">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={selected.length === 0 || pending}
            onClick={() => onConfirm(selected)}
          >
            {pending
              ? 'Applying…'
              : selected.length > 1
                ? `Apply to ${selected.length} stores`
                : 'Apply'}
          </Button>
        </div>
      </div>
    </div>
  )
}

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
  const queryClient = useQueryClient()
  const vendor = useVendorStore(s => s.vendor)
  const updateVendor = useUpdateVendor()
  const singleFrontBannerRef = useRef<HTMLDivElement>(null)
  const perStoreBannerRef = useRef<HTMLDivElement>(null)
  const { data: sites = [], isLoading: sitesLoading } = useSiteList()
  const { data: storesData, isLoading: storesLoading } = useStores({ limit: 200 })
  const stores = storesData?.stores ?? []
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
  const storeParam = searchParams.get('store')
  const singleFrontHighlight = searchParams.get('singleFront') === '1'
  const perStoreHighlight = searchParams.get('perStore') === '1'
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)
  const [selectedAssignStoreId, setSelectedAssignStoreId] = useState<string | null>(null)

  const storefrontLinkMode = resolveStorefrontLinkMode(vendor?.settings)
  const storefrontTemplateMode = resolveStorefrontTemplateMode(vendor?.settings)
  const isSingleLinkMode = storefrontLinkMode === 'single'
  const isSingleTemplateMode = storefrontTemplateMode === 'single'
  const isPerStoreTemplateMode = storefrontTemplateMode === 'per_unit'
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

  const [assignTemplate, setAssignTemplate] = useState<{ id: string; name: string } | null>(null)

  const assignTemplateToStores = useMutation({
    mutationFn: async ({ templateId, storeIds }: { templateId: string; storeIds: string[] }) => {
      for (const storeId of storeIds) {
        const store = stores.find(s => s.id === storeId)
        if (!store) continue
        await vendorApi.updateStore(storeId, {
          settings: { ...(store.settings ?? {}), [STORE_FRONT_TEMPLATE_KEY]: templateId },
        })
      }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.stores() })
      toast.success(
        vars.storeIds.length > 1
          ? `Template applied to ${vars.storeIds.length} business units`
          : 'Template applied to business unit',
      )
      setAssignTemplate(null)
      setSearchParams(prev => {
        const next = new URLSearchParams(prev)
        next.delete('perStore')
        return next
      }, { replace: true })
    },
    onError: () => toast.error('Could not apply template to business units'),
  })

  const openStorePicker = useCallback((templateId: string, templateName: string) => {
    setAssignTemplate({ id: templateId, name: templateName })
  }, [])

  const handleSetTemplateMode = useCallback(
    (mode: StorefrontTemplateMode) => {
      const current = useVendorStore.getState().vendor
      if (!current) return
      if (resolveStorefrontTemplateMode(current.settings) === mode) return
      updateVendor.mutate(
        {
          settings: { ...(current.settings ?? {}), [STOREFRONT_TEMPLATE_MODE_KEY]: mode },
        },
        {
          onSuccess: () => {
            toast.success(
              mode === 'single'
                ? 'Switched to one template for all stores'
                : 'Switched to individual template per business unit',
            )
            setSearchParams(prev => {
              const next = new URLSearchParams(prev)
              next.delete('singleFront')
              next.delete('perStore')
              next.set(mode === 'single' ? 'singleFront' : 'perStore', '1')
              return next
            }, { replace: true })
          },
        },
      )
    },
    [setSearchParams, updateVendor],
  )

  useEffect(() => {
    if (!singleFrontHighlight || !isSingleTemplateMode) return
    singleFrontBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [singleFrontHighlight, isSingleTemplateMode])

  useEffect(() => {
    if (!perStoreHighlight || !isPerStoreTemplateMode) return
    perStoreBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [perStoreHighlight, isPerStoreTemplateMode])

  useEffect(() => {
    if (storesLoading || stores.length === 0) return
    const firstId = stores[0].id
    if (storeParam && stores.some(s => s.id === storeParam)) {
      setSelectedAssignStoreId(storeParam)
    } else {
      setSelectedAssignStoreId(firstId)
    }
  }, [storesLoading, stores, storeParam])

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
  const selectedAssignStore = stores.find(s => s.id === selectedAssignStoreId) ?? null
  const perStoreTemplateId = selectedAssignStore
    ? resolveStoreFrontTemplateId(selectedAssignStore.settings)
    : null
  const busy = sitesLoading || templatesLoading
  const legacyPresetsBusy = themeLoading || presetsLoading || sitesLoading
  const legacyPresets = presetsData?.presets ?? []
  const lightPreset = legacyPresets.find(p => p.id === 'light')
  const showDefaultLayoutCard = templateCategory === 'all' && !templateSearch.trim()

  const activeSingleFrontTemplate = useMemo(
    () => resolveTemplateDisplay(singleFrontTemplateId, templates, legacyPresets),
    [legacyPresets, singleFrontTemplateId, templates],
  )

  const activePerStoreTemplate = useMemo(
    () => resolveTemplateDisplay(perStoreTemplateId, templates, legacyPresets),
    [legacyPresets, perStoreTemplateId, templates],
  )

  const pickerStores = useMemo(
    () =>
      stores.map(store => {
        const tid = resolveStoreFrontTemplateId(store.settings)
        return {
          id: store.id,
          name: store.name,
          is_default: store.is_default,
          currentTemplateName: tid
            ? resolveTemplateDisplay(tid, templates, legacyPresets)?.name ?? null
            : null,
        }
      }),
    [stores, templates, legacyPresets],
  )

  const storesUsingTemplate = useCallback(
    (templateId: string) =>
      stores.filter(s => resolveStoreFrontTemplateId(s.settings) === templateId).length,
    [stores],
  )

  const onAssignStoreChange = (id: string) => {
    setSelectedAssignStoreId(id)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (id) next.set('store', id)
      else next.delete('store')
      return next
    }, { replace: true })
  }

  const renderTemplatePreviewCard = (
    template: NonNullable<ReturnType<typeof resolveTemplateDisplay>>,
    badgeLabel: string,
    tone: 'violet' | 'emerald' = 'violet',
  ) => (
    <div
      className={cn(
        'w-full max-w-[14rem] overflow-hidden rounded-xl border bg-white shadow-sm sm:w-60',
        tone === 'emerald' ? 'border-emerald-200/80' : 'border-violet-200/80',
      )}
      title={template.name}
    >
      <div className="relative h-14 w-full overflow-hidden">
        {template.thumbnail ? (
          <img src={template.thumbnail} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: template.gradient ?? 'linear-gradient(135deg, #64C3A0, #13624A)',
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
        <span
          className={cn(
            'absolute left-1.5 top-1.5 right-1.5 max-w-[calc(100%-0.75rem)]',
            tone === 'emerald' ? templateBadgeEmeraldClass : templateBadgeVioletClass,
          )}
          title={badgeLabel}
        >
          <Check className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{badgeLabel}</span>
        </span>
      </div>
      <div className="px-2.5 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-xs font-bold text-gray-900">{template.name}</p>
          <p
            className={cn(
              'shrink-0 text-[10px] font-semibold uppercase tracking-wide',
              tone === 'emerald' ? 'text-emerald-700' : 'text-violet-700',
            )}
          >
            In use
          </p>
        </div>
        {template.description ? (
          <p className="mt-0.5 truncate text-[10px] leading-tight text-gray-500">
            {template.description}
          </p>
        ) : null}
      </div>
    </div>
  )

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
          {stores.length > 0 ? (
            <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end">
              <StorefrontTemplateModeToggle
                mode={storefrontTemplateMode}
                pending={updateVendor.isPending}
                onConfirm={handleSetTemplateMode}
              />
            </div>
          ) : null}
        </div>

        {isSingleTemplateMode ? (
          <div
            ref={singleFrontBannerRef}
            className={cn(
              'mb-4 rounded-xl border px-3 py-2.5 sm:px-4',
              singleFrontHighlight
                ? 'border-violet-300 bg-violet-50/80 ring-2 ring-violet-200'
                : 'border-violet-200/80 bg-violet-50/50',
            )}
          >
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-violet-800">
                  <Store className="h-3 w-3" />
                  One template for all stores
                </p>
                <h2 className="mt-0.5 text-sm font-bold text-gray-900">
                  Choose the template every business unit will use
                </h2>
                <p className="mt-0.5 max-w-2xl text-xs text-gray-600">
                  {isSingleLinkMode
                    ? 'Your account uses one shared customer website URL. Pick a template below with '
                    : 'Each business unit has its own storefront URL, but they all share one template. Pick a template below with '}
                  <span className="font-semibold">Use for all stores</span>.
                </p>
                {!activeSingleFrontTemplate ? (
                  <p className="mt-1 text-[11px] font-medium text-amber-800">
                    No template selected yet — choose one below.
                  </p>
                ) : null}
                <Link
                  to="/settings"
                  className="mt-1.5 inline-flex text-[11px] font-semibold text-violet-700 hover:underline"
                >
                  Change website link mode in settings
                </Link>
              </div>
              <div className="flex shrink-0 flex-col items-stretch sm:items-end">
                {activeSingleFrontTemplate
                  ? renderTemplatePreviewCard(activeSingleFrontTemplate, 'All stores')
                  : (
                    <div className="flex h-16 w-full max-w-[14rem] flex-col items-center justify-center rounded-xl border border-dashed border-violet-300/80 bg-white/60 px-3 text-center sm:w-60">
                      <Sparkles className="mb-1 h-4 w-4 text-violet-400" />
                      <p className="text-[10px] font-medium text-violet-700">Pick a template below</p>
                    </div>
                  )}
              </div>
            </div>
          </div>
        ) : null}

        {isPerStoreTemplateMode && stores.length > 0 ? (
          <div
            ref={perStoreBannerRef}
            className={cn(
              'mb-4 rounded-xl border px-3 py-2.5 sm:px-4',
              perStoreHighlight
                ? 'border-emerald-300 bg-emerald-50/80 ring-2 ring-emerald-200'
                : 'border-emerald-200/80 bg-emerald-50/50',
            )}
          >
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-800">
                  <Store className="h-3 w-3" />
                  Individual template per business unit
                </p>
                <h2 className="mt-0.5 text-sm font-bold text-gray-900">
                  Assign a template to each store
                </h2>
                <p className="mt-0.5 max-w-2xl text-xs text-gray-600">
                  Choose a business unit, then pick a template with{' '}
                  <span className="font-semibold">Use for this store</span>.
                  {isSingleLinkMode
                    ? ' All units share one customer URL but can look different.'
                    : ' Each unit can have its own URL and its own template.'}
                </p>
                <div className="mt-2 max-w-xs">
                  <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                    Assign template to
                  </label>
                  <select
                    className="w-full rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    value={selectedAssignStoreId || ''}
                    onChange={e => onAssignStoreChange(e.target.value)}
                  >
                    {stores.map(store => (
                      <option key={store.id} value={store.id}>
                        {store.name}{store.is_default ? ' · default' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <Link
                  to="/settings"
                  className="mt-1.5 inline-flex text-[11px] font-semibold text-emerald-700 hover:underline"
                >
                  Change website link mode in settings
                </Link>
              </div>
              <div className="flex shrink-0 flex-col items-stretch sm:items-end">
                {activePerStoreTemplate && selectedAssignStore
                  ? renderTemplatePreviewCard(activePerStoreTemplate, selectedAssignStore.name, 'emerald')
                  : (
                    <div className="flex h-16 w-full max-w-[14rem] flex-col items-center justify-center rounded-xl border border-dashed border-emerald-300/80 bg-white/60 px-3 text-center sm:w-60">
                      <Sparkles className="mb-1 h-4 w-4 text-emerald-400" />
                      <p className="text-[10px] font-medium text-emerald-700">
                        {selectedAssignStore ? `No template for ${selectedAssignStore.name}` : 'Pick a store'}
                      </p>
                    </div>
                  )}
              </div>
            </div>
          </div>
        ) : null}

        <div className="mb-4 rounded-2xl border border-gray-200/80 bg-white p-3 shadow-sm sm:p-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to="/websites"
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-white px-3.5 py-2 text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-primary/5"
            >
              <Globe className="h-4 w-4" />
              Open Website Builder
              <ChevronRight className="h-4 w-4 opacity-60" />
            </Link>
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
            <TemplateCategoryFilters
              categories={categories}
              value={templateCategory}
              onChange={setTemplateCategory}
            />
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
                singleTemplateMode={isSingleTemplateMode}
                isSingleTemplateSelected={singleFrontTemplateId === lightPreset.id}
                onUseForAllStores={isSingleTemplateMode ? handleUseForAllStores : undefined}
                useForAllStoresPending={updateVendor.isPending}
                perStoreTemplateMode={isPerStoreTemplateMode}
                perStoreUsedCount={storesUsingTemplate(lightPreset.id)}
                assignedStoreNames={storesAssignedToTemplate(stores, lightPreset.id).map(s => s.name)}
                onApplyForStore={isPerStoreTemplateMode ? id => openStorePicker(id, lightPreset.name) : undefined}
                applyForStorePending={assignTemplateToStores.isPending}
                viewLiveLinks={resolveAppliedTemplateViewLiveLinks(vendor?.slug, storefrontLinkMode, {
                  templateId: lightPreset.id,
                  templateMode: storefrontTemplateMode,
                  singleFrontTemplateId,
                  stores,
                })}
              />
            )}
            {filteredTemplates.map((tpl: WebsiteTemplate) => {
              const pageCount = tpl.page_count ?? tpl.pages?.length ?? 0
              const tier = tpl.tier || (pageCount >= 6 ? 'full' : 'lite')
              const palette = getTemplatePreviewPalette(tpl)
              const isSingleTemplateSelected = singleFrontTemplateId === tpl.id
              const assignedStores = storesAssignedToTemplate(stores, tpl.id)
              const perStoreAppliedCount = assignedStores.length
              const showAssignHighlight = (isSingleTemplateMode && isSingleTemplateSelected)
                || (isPerStoreTemplateMode && perStoreAppliedCount > 0)
              const assignedStoresLabel = formatAssignedStoresLabel(assignedStores)
              const viewLiveLinks = resolveAppliedTemplateViewLiveLinks(vendor?.slug, storefrontLinkMode, {
                templateId: tpl.id,
                templateMode: storefrontTemplateMode,
                singleFrontTemplateId,
                stores,
              })
              return (
                <div
                  key={tpl.id}
                  className={cn(
                    'flex flex-col text-left border border-gray-100 rounded-2xl overflow-hidden hover:border-primary/30 transition-all group bg-white',
                    'shadow-[0_1px_0_rgba(0,0,0,0.02)] hover:shadow-[0_8px_24px_rgba(100,195,160,0.15)] hover:-translate-y-0.5',
                    showAssignHighlight && isSingleTemplateMode && 'border-violet-400 ring-2 ring-violet-200',
                    showAssignHighlight && isPerStoreTemplateMode && 'border-emerald-400 ring-2 ring-emerald-200',
                  )}
                >
                  <div className="relative overflow-hidden">
                    {tpl.thumbnail ? (
                      <img src={tpl.thumbnail} className="w-full h-36 sm:h-40 object-cover transition-transform duration-300 group-hover:scale-105" alt={tpl.name} loading="lazy" />
                    ) : (
                      <div className="w-full h-36 sm:h-40 bg-gradient-to-r from-accent to-primary/20" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent pointer-events-none" />
                    {isSingleTemplateMode && isSingleTemplateSelected ? (
                      <span className={cn('absolute right-2 top-2 max-w-[70%]', templateBadgeVioletClass)} title="All stores">
                        <Check className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">All stores</span>
                      </span>
                    ) : null}
                    {isPerStoreTemplateMode && perStoreAppliedCount > 0 ? (
                      <span
                        className={cn('absolute right-2 top-2 max-w-[70%]', templateBadgeEmeraldClass)}
                        title={assignedStores.map(s => s.name).join(', ')}
                      >
                        <Check className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">
                          {perStoreAppliedCount === 1 ? assignedStores[0].name : `${perStoreAppliedCount} BUs / Stores`}
                        </span>
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
                    {isSingleTemplateMode && isSingleTemplateSelected ? (
                      <p className="mt-1 truncate text-[10px] font-semibold text-violet-700">
                        Used by: All BUs / Stores
                      </p>
                    ) : null}
                    {isPerStoreTemplateMode && perStoreAppliedCount > 0 ? (
                      <p
                        className="mt-1 truncate text-[10px] font-semibold text-emerald-700"
                        title={assignedStores.map(s => s.name).join(', ')}
                      >
                        Used by: {assignedStoresLabel}
                      </p>
                    ) : null}
                    <div className="mt-auto flex flex-wrap items-center justify-end gap-2 pt-3">
                      <div className="inline-flex items-center gap-1.5">
                        {isSingleTemplateMode ? (
                          <button
                            type="button"
                            disabled={isSingleTemplateSelected || updateVendor.isPending}
                            onClick={() => handleUseForAllStores(tpl.id)}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-extrabold transition-colors',
                              isSingleTemplateSelected
                                ? 'cursor-default border-violet-200 bg-violet-50 text-violet-600'
                                : 'border-violet-200 bg-violet-50/80 text-violet-700 hover:border-violet-300 hover:bg-violet-100',
                            )}
                          >
                            {isSingleTemplateSelected ? <Check className="h-3.5 w-3.5" /> : <Store className="h-3.5 w-3.5" />}
                            {isSingleTemplateSelected ? 'Applied — all BU / Store' : 'Apply for all BU / Store'}
                          </button>
                        ) : null}
                        {isPerStoreTemplateMode ? (() => {
                          const isApplied = perStoreAppliedCount > 0
                          return (
                            <button
                              type="button"
                              disabled={assignTemplateToStores.isPending}
                              onClick={() => openStorePicker(tpl.id, tpl.name)}
                              className={cn(
                                'inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-extrabold transition-colors',
                                isApplied
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:border-emerald-300 hover:bg-emerald-100'
                                  : 'border-emerald-200 bg-emerald-50/80 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100',
                              )}
                            >
                              {isApplied ? <Check className="h-3.5 w-3.5" /> : <Store className="h-3.5 w-3.5" />}
                              {isApplied
                                ? `Applied — BU / Store · ${perStoreAppliedCount}`
                                : 'Apply for Single BU / Store'}
                            </button>
                          )
                        })() : null}
                        {!isSingleTemplateMode && !isPerStoreTemplateMode ? (
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
                            Apply to site
                          </button>
                        ) : null}
                        {viewLiveLinks.length > 0 ? (
                          <AppliedTemplateViewLiveButton links={viewLiveLinks} />
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            openDraftPreviewInBrowser(
                              wrapStorefrontPreviewForVendorBrowser(getStorefrontTemplateBrowserPreviewUrl(tpl.id)),
                            )
                          }}
                          className={templateCardIconActionClass}
                          title="Preview"
                          aria-label="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
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

      {assignTemplate ? (
        <StoreTemplatePicker
          templateName={assignTemplate.name}
          stores={pickerStores}
          initialSelected={selectedAssignStoreId ? [selectedAssignStoreId] : []}
          pending={assignTemplateToStores.isPending}
          onClose={() => setAssignTemplate(null)}
          onConfirm={storeIds =>
            assignTemplateToStores.mutate({ templateId: assignTemplate.id, storeIds })
          }
        />
      ) : null}

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
