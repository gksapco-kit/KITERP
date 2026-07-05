import { useMemo, useState, useEffect, useLayoutEffect, useRef, useCallback, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles, Search, Globe, ChevronRight, ChevronDown, Check, Store, Eye, LayoutTemplate, X, AlertTriangle, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSiteList, useWebsiteTemplates, websitesListQueryKey } from '@/hooks/useWebsites'
import { useUpdateVendor, useStores, vendorKeys } from '@/hooks/useVendor'
import type { WebsiteTemplate, SiteListItem } from '@/types/websites'
import { getTemplatePreviewPalette } from '@/lib/templateBlockHighlights'
import { WebsiteTemplatePreviewModal, getStorefrontTemplateBrowserPreviewUrl } from '@/components/websites/WebsiteTemplatePreviewModal'
import { AppliedTemplateViewLiveButton, ViewLiveLinksPickerModal, templateCardIconActionClass } from '@/components/websites/AppliedTemplateViewLiveButton'
import type { AppliedTemplateViewLiveLink } from '@/lib/liveStorefrontUrl'
import { BusinessFrontDefaultTemplateCard } from '@/components/websites/BusinessFrontDefaultTemplateCard'
import { BuilderDraftTemplateCard } from '@/components/websites/BuilderDraftTemplateCard'
import { StoreThemeCustomizerDialog } from '@/components/websites/StoreThemeCustomizerDialog'
import { StorefrontTemplateModeToggle } from '@/components/business-units/StorefrontTemplateModeToggle'
import { openDraftPreviewInBrowser, wrapStorefrontPreviewForVendorBrowser } from '@/lib/storefrontPreviewUrl'
import { openBuilderSiteDraftPreview } from '@/lib/openBuilderSiteDraftPreview'
import { extractApiError } from '@/lib/errorMessages'
import {
  assignBuilderSiteToStores,
  assignCatalogTemplateToStores,
  BuilderSiteAssignmentError,
  isBuilderSiteAssignableForStore,
  isBuilderSiteBuiltForStore,
  isBuilderSiteBuiltForAll,
  isBuilderSiteExternal,
  isBuilderSiteAssignedToStore,
  isBuilderSiteVisibleForStore,
  isBuilderSiteEffectivelyLive,
  isBuilderSiteStorefrontAssigned,
  isStoreSpecificCatalogTemplateAssigned,
  listBuilderDraftTemplateSites,
  resolveBuilderSiteHomeStoreId,
  storesAssignedToBuilderSite,
  storesEligibleForBuilderSiteAssignment,
  resolveBuilderSiteLiveBlockReason,
  resolveBuilderSiteViewLiveLinks,
  resolveStorefrontCoverageTemplate,
  storesEffectivelyAssignedToBuilderSite,
  storesUsingBuilderSiteDesign,
  isBuilderSiteInAssignedTemplatesSection,
} from '@/lib/builderDraftTemplateSites'
import {
  buildCustomerStoreLink,
  collapseViewLiveLinks,
  customerLinkForStore,
  resolveAppliedTemplateViewLiveLinks,
  resolveSingleFrontTemplateId,
  resolveStorefrontLinkMode,
  resolveStorefrontTemplateMode,
  resolveStoreFrontTemplateId,
  storefrontUrlNeedsBranch,
  SINGLE_FRONT_TEMPLATE_KEY,
  STORE_FRONT_TEMPLATE_KEY,
  STOREFRONT_TEMPLATE_MODE_KEY,
  type StorefrontLinkMode,
  type StorefrontTemplateMode,
} from '@/lib/liveStorefrontUrl'
import { WebsiteSiteGlimpse } from '@/components/websites/WebsiteSiteGlimpse'
import { resolveSiteAppliedTemplateLabel, resolveTemplateDisplay, type ResolvedTemplateDisplay } from '@/lib/websiteAppliedTemplate'
import { resolveSiteStaticThumbnail } from '@/lib/websiteSitePreview'
import {
  isLegacyPresetActive,
  resolveBusinessFrontActiveTemplate,
  resolveDefaultSingleFrontTemplateId,
  type ThemePresetSummary,
} from '@/lib/businessFrontActiveTemplate'
import { storesAssignedToTemplate } from '@/lib/websiteTemplateAssignment'
import {
  perStoreGalleryRibbonLabel,
  perStoreTemplateActionLabel,
  templateBadgeEmeraldClass,
  templateCardActionBtnClass,
  templateCardActionClusterClass,
  templateCardActionRowClass,
  templateCardActivePillClass,
  templateCardAssignPillClass,
  templateCardBodyClass,
  templateCardCurrentForStoreRibbonClass,
  templateCardMediaChipClass,
  templateCardMediaHeightClass,
  templateCardPreviewOverlayClass,
  templateCardPrimaryActionClass,
  templateCardSelectedClass,
  coverageStoreSelectedClass,
  templateCardShellClass,
  singleTemplateActionLabel,
  systemTemplateGalleryStatusLabel,
  systemTemplateGalleryStatusTitle,
} from '@/lib/websiteTemplateBadges'
import { vendorApi } from '@/api/vendor'
import { useVendorStore } from '@/stores/vendorStore'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { formatStoreCode, sortStoresByCode } from '@/lib/verification'
import { isTemplateSandboxSite } from '@/lib/websiteSandbox'

const TEMPLATE_GRID_CLASS = 'grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4'

const formatCategoryLabel = (cat: string) => {
  if (cat === 'all') return 'All'
  if (cat === 'website_builder') return 'Business Website Builder'
  return cat.charAt(0).toUpperCase() + cat.slice(1)
}

const categoryChipClass = (active: boolean) =>
  cn(
    'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold transition-colors whitespace-nowrap',
    active
      ? 'bg-primary text-white shadow-sm'
      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-muted dark:text-muted-foreground dark:hover:bg-accent',
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
              <div className="absolute right-0 top-full z-20 mt-1 min-w-[9rem] rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-border dark:bg-card">
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
  code: string
  is_default?: boolean
  currentTemplateName?: string | null
}

function PickerStoreCard({
  store,
  checked,
  onToggle,
  compact = false,
  prominent = false,
}: {
  store: PickerStore
  checked: boolean
  onToggle: () => void
  compact?: boolean
  prominent?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={`${store.code} · ${store.name}`}
      className={cn(
        'flex items-center gap-2 overflow-hidden rounded-xl border text-left transition-colors',
        compact
          ? 'min-w-0 w-full gap-2 px-2 py-1.5'
          : 'w-full min-w-0 gap-3 px-3 py-2.5',
        checked
          ? prominent
            ? 'border-emerald-400 bg-emerald-50/80 ring-2 ring-emerald-200'
            : 'border-emerald-300 bg-emerald-50/70'
          : compact
            ? 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/40'
            : 'border-gray-200 hover:bg-gray-50',
      )}
    >
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-md border',
          compact ? 'h-4 w-4' : 'h-5 w-5',
          checked ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-300 bg-white',
        )}
      >
        {checked ? <Check className={compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'} /> : null}
      </span>
      <span className="min-w-0 flex-1 overflow-hidden">
        <span className="flex min-w-0 items-center gap-1">
          <span
            className={cn(
              'truncate font-mono font-bold tracking-wide text-gray-800',
              compact ? 'text-[11px]' : 'text-xs',
            )}
            title={store.code}
          >
            {store.code}
          </span>
          {store.is_default ? (
            <span className="shrink-0 rounded bg-gray-100 px-0.5 text-[8px] font-bold uppercase leading-none text-gray-500">
              DEF
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            'mt-0.5 block truncate font-medium text-gray-500',
            compact ? 'text-[10px]' : 'text-xs',
          )}
          title={store.name}
        >
          {store.name}
        </span>
        <span
          className={cn(
            'mt-0.5 block truncate',
            store.currentTemplateName
              ? compact
                ? 'text-[11px] font-bold text-emerald-700'
                : 'text-[11px] font-semibold text-emerald-700'
              : compact
                ? 'text-[10px] font-semibold text-amber-700'
                : 'text-[11px] font-medium text-amber-700',
          )}
          title={store.currentTemplateName ?? undefined}
        >
          {store.currentTemplateName ?? 'No template assigned'}
        </span>
      </span>
    </button>
  )
}

function StoreTemplatePicker({
  templateName,
  stores,
  primaryStoreId,
  pending,
  onClose,
  onConfirm,
  onPrimaryStoreChange,
  lockedToStore = false,
}: {
  templateName: string
  stores: PickerStore[]
  primaryStoreId: string | null
  pending?: boolean
  onClose: () => void
  onConfirm: (storeIds: string[]) => void
  onPrimaryStoreChange: (storeId: string) => void
  /** When true, the site/template is scoped to one business unit — no switching allowed. */
  lockedToStore?: boolean
}) {
  const [activePrimaryId, setActivePrimaryId] = useState<string | null>(primaryStoreId)
  const [showOthers, setShowOthers] = useState(!primaryStoreId && !lockedToStore)
  const [pendingOtherStoreId, setPendingOtherStoreId] = useState<string | null>(null)

  useEffect(() => {
    setActivePrimaryId(primaryStoreId)
    setShowOthers(!primaryStoreId && !lockedToStore)
    setPendingOtherStoreId(null)
  }, [primaryStoreId, templateName, lockedToStore])

  const activePrimaryStore = activePrimaryId ? stores.find(s => s.id === activePrimaryId) ?? null : null
  const otherStores = lockedToStore ? [] : activePrimaryStore ? stores.filter(s => s.id !== activePrimaryStore.id) : stores
  const pendingTargetStore = pendingOtherStoreId
    ? stores.find(s => s.id === pendingOtherStoreId) ?? null
    : null

  const replacePrimaryStore = (storeId: string) => {
    setActivePrimaryId(storeId)
    onPrimaryStoreChange(storeId)
    setPendingOtherStoreId(null)
    setShowOthers(false)
  }

  const requestOtherStore = (storeId: string) => {
    if (storeId === activePrimaryId) return
    if (activePrimaryStore) {
      setPendingOtherStoreId(storeId)
      return
    }
    replacePrimaryStore(storeId)
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        onClick={onClose}
        role="presentation"
      >
        <div
          className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
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
                {lockedToStore
                  ? 'This website was built for the business unit below and can only be linked to that storefront.'
                  : activePrimaryStore
                    ? 'Applies to the business unit selected below. Expand to switch to a different company code.'
                    : 'Choose which business unit / store should use this template.'}
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
              {activePrimaryStore
                ? <>Applying to <span className="font-mono font-semibold text-emerald-700">{activePrimaryStore.code}</span></>
                : 'No business unit selected'}
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {activePrimaryStore ? (
              <div className="mb-3">
                <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700">
                  Selected business unit
                </p>
                <PickerStoreCard
                  store={activePrimaryStore}
                  checked
                  onToggle={() => {}}
                  prominent
                />
              </div>
            ) : null}

            {otherStores.length > 0 ? (
              <div>
                <button
                  type="button"
                  onClick={() => setShowOthers(open => !open)}
                  className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2 text-left transition-colors hover:bg-gray-100/80"
                >
                  <span className="text-xs font-semibold text-gray-700">
                    {activePrimaryStore ? 'Switch to another business unit' : 'Business units'}
                    <span className="ml-1.5 font-normal text-gray-500">({otherStores.length})</span>
                  </span>
                  <ChevronDown
                    className={cn('h-4 w-4 shrink-0 text-gray-500 transition-transform', showOthers && 'rotate-180')}
                  />
                </button>

                {showOthers ? (
                  <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {otherStores.map(store => (
                      <PickerStoreCard
                        key={store.id}
                        store={store}
                        checked={false}
                        onToggle={() => requestOtherStore(store.id)}
                        compact
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {!activePrimaryStore && otherStores.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground">No business units available.</p>
            ) : null}
          </div>

          <div className="flex gap-2 border-t border-border px-5 py-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={!activePrimaryId || pending}
              onClick={() => activePrimaryId && onConfirm([activePrimaryId])}
            >
              {pending ? 'Applying…' : 'Apply'}
            </Button>
          </div>
        </div>
      </div>

      {pendingOtherStoreId && activePrimaryStore && pendingTargetStore ? (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setPendingOtherStoreId(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            role="alertdialog"
            aria-labelledby="other-bu-confirm-title"
            aria-modal="true"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 border-b border-border px-5 py-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="other-bu-confirm-title" className="text-base font-semibold text-foreground">
                  Change business unit?
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  You are changing from company code{' '}
                  <span className="font-mono font-semibold text-foreground">{activePrimaryStore.code}</span>
                  {' '}to{' '}
                  <span className="font-mono font-semibold text-foreground">{pendingTargetStore.code}</span>.
                  {' '}“{templateName}” will apply to the new business unit instead, and your selection on the
                  templates screen will update to match.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingOtherStoreId(null)}
                className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-2 px-5 py-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setPendingOtherStoreId(null)}
              >
                Keep {activePrimaryStore.code}
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={() => replacePrimaryStore(pendingOtherStoreId)}
              >
                Use {pendingTargetStore.code}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function UseForAllStoresConfirmModal({
  pending,
  currentTemplateName,
  storeCount,
  applying,
  onClose,
  onConfirm,
}: {
  pending: { id: string; name: string } | null
  currentTemplateName: string | null
  storeCount: number
  applying?: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  if (!pending) return null

  const unitLabel = storeCount === 1 ? 'business unit' : 'business units'

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        role="alertdialog"
        aria-labelledby="use-for-all-confirm-title"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="use-for-all-confirm-title" className="text-base font-semibold text-foreground">
              Apply to all stores?
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {currentTemplateName ? (
                <>
                  Are you sure you want to change the storefront template from{' '}
                  <span className="font-semibold text-foreground">{currentTemplateName}</span>
                  {' '}to{' '}
                  <span className="font-semibold text-foreground">{pending.name}</span>
                  {' '}for all {storeCount} {unitLabel}?
                </>
              ) : (
                <>
                  Apply{' '}
                  <span className="font-semibold text-foreground">{pending.name}</span>
                  {' '}as the shared storefront template for all {storeCount} {unitLabel}?
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-2 px-5 py-4">
          <Button type="button" variant="outline" className="flex-1" disabled={applying} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" className="flex-1" disabled={applying} onClick={onConfirm}>
            {applying ? 'Applying…' : 'Apply to all stores'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function TemplateCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_1px_0_rgba(0,0,0,0.02)]">
      <div className={cn(templateCardMediaHeightClass, 'w-full animate-pulse bg-gradient-to-r from-gray-100 to-gray-200/70')} />
      <div className="space-y-1 p-2 pb-1.5 pt-1">
        <div className="h-3.5 w-1/2 animate-pulse rounded bg-gray-200" />
        <div className="h-2.5 w-full animate-pulse rounded bg-gray-100" />
        <div className="flex justify-end gap-1.5">
          <div className="h-6 w-14 animate-pulse rounded-md bg-gray-100" />
          <div className="h-6 w-6 animate-pulse rounded-md bg-gray-200" />
        </div>
      </div>
    </div>
  )
}

function TemplateGallerySection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="mb-2.5 last:mb-0">
      <div className="mb-1.5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground sm:text-sm">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 max-w-3xl text-xs leading-snug text-muted-foreground/80 sm:text-sm">
            {description}
          </p>
        ) : null}
      </div>
      <div className={TEMPLATE_GRID_CLASS}>{children}</div>
    </section>
  )
}

type CoverageAssignmentStatus = 'live_builder' | 'catalog_assigned' | 'unassigned'

type CoverageStore = {
  id: string
  name: string
  code: string
  is_default?: boolean
  template: ResolvedTemplateDisplay | null
  status: CoverageAssignmentStatus
  siteId: string | null
  livePreviewUrl: string | null
  /** Customer-facing storefront URL when this unit has a template assigned. */
  liveStorefrontUrl: string | null
}

type StoreLike = {
  id: string
  name: string
  settings?: Record<string, unknown> | null
  is_default?: boolean
}

type CoveragePreviewContext = {
  vendorSlug?: string | null
  linkMode?: StorefrontLinkMode
  templateMode?: StorefrontTemplateMode
}

function buildCoveragePreviewMeta(
  store: StoreLike & { code?: string | null },
  template: ResolvedTemplateDisplay | null,
  status: CoverageAssignmentStatus,
  previewContext?: CoveragePreviewContext,
  glimpseSiteId?: string | null,
): { siteId: string | null; livePreviewUrl: string | null } {
  const customerUrl = previewContext?.vendorSlug
    ? customerLinkForStore(
        previewContext.vendorSlug,
        store,
        previewContext.linkMode ?? 'single',
        previewContext.templateMode,
      )
    : null

  if (status === 'live_builder' && glimpseSiteId) {
    return { siteId: glimpseSiteId, livePreviewUrl: customerUrl }
  }

  if (template && status === 'catalog_assigned') {
    return {
      siteId: glimpseSiteId ?? null,
      livePreviewUrl:
        customerUrl
        ?? wrapStorefrontPreviewForVendorBrowser(
          getStorefrontTemplateBrowserPreviewUrl(template.id),
        ),
    }
  }

  return { siteId: glimpseSiteId ?? null, livePreviewUrl: null }
}

function resolveCoverageGlimpseSiteId(
  catalogTemplate: ResolvedTemplateDisplay,
  sites: SiteListItem[],
  templates: WebsiteTemplate[],
  status: CoverageAssignmentStatus,
  linkedSite: SiteListItem | undefined,
): string | null {
  if (status === 'live_builder' && linkedSite?.id) return linkedSite.id
  if (templates.some(t => t.id === catalogTemplate.id)) return null
  return sites.find(s => s.id === catalogTemplate.id)?.id ?? null
}

function resolveStoreCoverageState(
  store: StoreLike & { code?: string | null },
  sites: SiteListItem[],
  templates: WebsiteTemplate[],
  presets: ThemePresetSummary[],
  vendorSettings?: Record<string, unknown> | null,
  previewContext?: CoveragePreviewContext,
): {
  template: ResolvedTemplateDisplay | null
  status: CoverageAssignmentStatus
  siteId: string | null
  livePreviewUrl: string | null
} {
  const linkedSite = sites.find(
    s =>
      s.is_published
      && s.website_store_scope === 'store'
      && s.website_store_id === store.id,
  )
  const linkedSiteIsLive = Boolean(
    linkedSite
    && isBuilderSiteStorefrontAssigned(linkedSite)
    && !isStoreSpecificCatalogTemplateAssigned(store, vendorSettings),
  )

  const catalogTemplate = resolveStorefrontCoverageTemplate(
    store,
    sites,
    templates,
    presets,
    vendorSettings,
    { publishedBuilderOnly: false },
  )

  if (!catalogTemplate) {
    return {
      status: 'unassigned',
      template: null,
      siteId: null,
      livePreviewUrl: null,
    }
  }

  const status: CoverageAssignmentStatus =
    linkedSiteIsLive && linkedSite && catalogTemplate.id === linkedSite.id
      ? 'live_builder'
      : 'catalog_assigned'
  const glimpseSiteId = resolveCoverageGlimpseSiteId(
    catalogTemplate,
    sites,
    templates,
    status,
    linkedSite,
  )

  return {
    status,
    template: catalogTemplate,
    ...buildCoveragePreviewMeta(
      store,
      catalogTemplate,
      status,
      previewContext,
      glimpseSiteId,
    ),
  }
}

function coverageStatusLabel(status: CoverageAssignmentStatus): string {
  if (status === 'live_builder') return 'Live on storefront'
  if (status === 'catalog_assigned') return 'Template assigned'
  return 'Nothing assigned'
}

function coverageStatusBadgeClass(status: CoverageAssignmentStatus): string {
  if (status === 'live_builder') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (status === 'catalog_assigned') return 'border-sky-200 bg-sky-50 text-sky-800'
  return 'border-amber-200 bg-amber-50 text-amber-800'
}

function StoreStatusRibbon({ label }: { label: string }) {
  return (
    <span className={templateCardCurrentForStoreRibbonClass}>
      {label}
    </span>
  )
}

function resolveAssignedTemplateGlimpsePreview(
  template: ResolvedTemplateDisplay | null,
  templates: WebsiteTemplate[],
  options?: {
    liveStorefrontUrl?: string | null
    livePreviewUrl?: string | null
    status?: CoverageAssignmentStatus
  },
): { fallbackImage: string | null; livePreviewUrl: string | null } {
  if (!template) return { fallbackImage: null, livePreviewUrl: null }

  const isCatalogTemplate = templates.some(t => t.id === template.id)
  const thumbnail = template.thumbnail?.trim() || null
  if (thumbnail && isCatalogTemplate) {
    return { fallbackImage: thumbnail, livePreviewUrl: null }
  }

  if (isCatalogTemplate) {
    return {
      fallbackImage: null,
      livePreviewUrl: options?.livePreviewUrl?.trim()
        ?? wrapStorefrontPreviewForVendorBrowser(
          getStorefrontTemplateBrowserPreviewUrl(template.id),
        ),
    }
  }

  if (options?.livePreviewUrl?.trim()) {
    return { fallbackImage: null, livePreviewUrl: options.livePreviewUrl.trim() }
  }

  if (options?.liveStorefrontUrl?.trim()) {
    return { fallbackImage: null, livePreviewUrl: options.liveStorefrontUrl.trim() }
  }

  return { fallbackImage: null, livePreviewUrl: null }
}

function CoverageThumb({
  template,
  vendorSlug = null,
  templates = [],
  storeStatus,
  liveStorefrontUrl = null,
  livePreviewUrl = null,
  siteId = null,
  className,
}: {
  template: ResolvedTemplateDisplay | null
  vendorSlug?: string | null
  templates?: WebsiteTemplate[]
  storeStatus?: CoverageAssignmentStatus
  liveStorefrontUrl?: string | null
  livePreviewUrl?: string | null
  siteId?: string | null
  className?: string
}) {
  const glimpse = resolveAssignedTemplateGlimpsePreview(template, templates, {
    liveStorefrontUrl,
    livePreviewUrl,
    status: storeStatus,
  })
  return (
    <span className={cn('block h-11 w-[4.75rem] shrink-0 overflow-hidden rounded-md border border-black/5 bg-white', className)}>
      <WebsiteSiteGlimpse
        siteId={siteId}
        vendorSlug={vendorSlug}
        fallbackImage={glimpse.fallbackImage}
        fallbackGradient={template?.gradient}
        templates={templates}
        previewMode="assigned"
        variant="card"
        scaleMode="cover"
        className="h-full w-full"
      />
    </span>
  )
}

function CoverageStoreCard({
  store,
  active,
  onSelect,
  vendorSlug,
  templates,
}: {
  store: CoverageStore
  active: boolean
  onSelect: () => void
  vendorSlug?: string | null
  templates?: WebsiteTemplate[]
}) {
  const hasAssignment = store.status !== 'unassigned'
  const isLive = store.status === 'live_builder'
  const showViewLink = Boolean(store.liveStorefrontUrl)
  return (
    <div
      className={cn(
        'group relative flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-md border px-2.5 py-2 transition-colors',
        active
          ? coverageStoreSelectedClass
          : hasAssignment
            ? 'border-gray-200 bg-white hover:border-gray-300'
            : 'border-gray-200 bg-white hover:border-gray-300',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        title={
          hasAssignment
            ? `${store.code} · ${store.name} → ${store.template?.name} (${coverageStatusLabel(store.status)})`
            : `${store.code} · ${store.name} — no template assigned`
        }
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
      >
        <span className="relative block h-11 w-[4.75rem] shrink-0">
          <CoverageThumb
            template={store.template}
            vendorSlug={vendorSlug}
            templates={templates}
            storeStatus={store.status}
            liveStorefrontUrl={store.liveStorefrontUrl}
            livePreviewUrl={store.livePreviewUrl}
            siteId={store.siteId}
            className="h-full w-full border-0"
          />
          {showViewLink ? (
            <a
              href={store.liveStorefrontUrl!}
              target="_blank"
              rel="noopener noreferrer"
              title={`View live storefront for ${store.code} · ${store.name}`}
              aria-label={`View live store for ${store.code}`}
              onClick={e => e.stopPropagation()}
              className={cn(
                'absolute right-0.5 top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-md bg-black/60 text-white shadow-sm transition-opacity',
                active
                  ? 'opacity-100'
                  : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100',
              )}
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1">
            <span
              className={cn(
                'min-w-0 flex-1 truncate font-mono text-xs font-bold tracking-wide',
                active ? 'text-primary' : 'text-gray-800',
              )}
              title={store.code}
            >
              {store.code}
            </span>
            {store.is_default ? (
              <span className="shrink-0 rounded bg-gray-100 px-1 py-0.5 text-[9px] font-bold uppercase leading-none text-gray-500">
                DEF
              </span>
            ) : null}
            {isLive ? (
              <span className={cn('ml-auto shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold leading-none', coverageStatusBadgeClass(store.status))}>
                Live
              </span>
            ) : store.status === 'catalog_assigned' ? (
              <span className={cn('ml-auto shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold leading-none', coverageStatusBadgeClass(store.status))}>
                Assigned
              </span>
            ) : null}
          </span>
          {hasAssignment ? (
            <span
              className="block truncate text-xs font-semibold leading-tight text-gray-700"
              title={store.template?.name}
            >
              {store.template?.name}
            </span>
          ) : (
            <span className="block truncate text-xs font-medium text-gray-500">No template</span>
          )}
        </span>
      </button>
    </div>
  )
}

function SharedTemplateCoverageCard({
  template,
  total,
  coverageStores,
  activeStoreId,
  onSelectStore,
  vendorSlug,
  templates,
  previewStore,
  status,
}: {
  template: ResolvedTemplateDisplay
  total: number
  coverageStores: CoverageStore[]
  activeStoreId: string | null
  onSelectStore: (id: string) => void
  vendorSlug?: string | null
  templates: WebsiteTemplate[]
  previewStore: CoverageStore | null | undefined
  status?: CoverageAssignmentStatus
}) {
  const activeStore = activeStoreId ? coverageStores.find(s => s.id === activeStoreId) : null
  const glimpseStore =
    (activeStore?.status !== 'unassigned' ? activeStore : null)
    ?? previewStore
    ?? coverageStores.find(s => s.status !== 'unassigned')
    ?? null
  const glimpseTemplate = glimpseStore?.template ?? template
  const glimpseDisplay: ResolvedTemplateDisplay = {
    ...template,
    ...glimpseTemplate,
    thumbnail: glimpseTemplate.thumbnail ?? template.thumbnail,
    gradient: glimpseTemplate.gradient ?? template.gradient,
  }
  const glimpseStatus = glimpseStore?.status ?? status
  const isLive = glimpseStatus === 'live_builder'
  const isAssigned = glimpseStatus === 'catalog_assigned'
  const liveUrl = activeStore?.liveStorefrontUrl ?? glimpseStore?.liveStorefrontUrl

  return (
    <div className="mt-3 overflow-hidden rounded-lg border-2 border-primary/20 bg-gradient-to-br from-primary/[0.05] via-white to-white shadow-sm">
      <div className="flex items-center gap-2.5 p-2.5 sm:gap-3 sm:p-3">
        <div className="relative shrink-0">
          <CoverageThumb
            template={glimpseDisplay}
            vendorSlug={vendorSlug}
            templates={templates}
            storeStatus={glimpseStatus}
            liveStorefrontUrl={glimpseStore?.liveStorefrontUrl ?? activeStore?.liveStorefrontUrl}
            livePreviewUrl={glimpseStore?.livePreviewUrl}
            siteId={glimpseStore?.siteId}
            className="h-11 w-[4.75rem] rounded-lg shadow-sm ring-2 ring-white sm:h-[3.75rem] sm:w-[5.75rem]"
          />
          {liveUrl ? (
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open live storefront"
              aria-label="Open live storefront"
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-emerald-200 bg-emerald-500 text-white shadow-md transition-transform hover:scale-105 hover:bg-emerald-600 sm:h-6 sm:w-6"
            >
              <ExternalLink className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            </a>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <h3 className="truncate text-sm font-extrabold tracking-tight text-gray-900">
              {template.name}
            </h3>
            {isLive ? (
              <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold', coverageStatusBadgeClass('live_builder'))}>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                Live
              </span>
            ) : isAssigned ? (
              <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold', coverageStatusBadgeClass('catalog_assigned'))}>
                Assigned
              </span>
            ) : null}
            <span className="hidden text-xs text-gray-500 sm:inline">
              · {total} business unit{total === 1 ? '' : 's'}
            </span>
          </div>
          <p className="truncate text-[11px] text-gray-500 sm:hidden">
            {total} business unit{total === 1 ? '' : 's'}
          </p>
        </div>

        {total > 1 ? (
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-gray-400 sm:inline">
              Preview as
            </span>
            <div className="flex flex-wrap items-center justify-end gap-1">
              {coverageStores.map(store => {
                const selected = store.id === activeStoreId
                return (
                  <button
                    key={store.id}
                    type="button"
                    title={`${store.code} · ${store.name}`}
                    aria-pressed={selected}
                    aria-label={`Preview as ${store.code}`}
                    onClick={() => onSelectStore(store.id)}
                    className={cn(
                      'inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 font-mono text-[10px] font-bold transition-colors sm:gap-1 sm:px-2 sm:text-[11px]',
                      selected
                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50',
                    )}
                  >
                    {store.code}
                    {store.is_default ? (
                      <span className="rounded bg-gray-100 px-0.5 py-px text-[7px] font-bold uppercase leading-none text-gray-500 sm:px-1 sm:text-[8px]">
                        DEF
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SharedTemplateCoverageEmpty() {
  return (
    <div className="mt-3 rounded-lg border-2 border-dashed border-amber-200/90 bg-gradient-to-br from-amber-50/80 to-white p-3.5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 ring-1 ring-amber-200/80">
          <LayoutTemplate className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-amber-950">No template assigned yet</p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-800 sm:text-sm">
            Choose a layout below and click{' '}
            <span className="font-semibold">Assign · all</span>{' '}
            to apply one design to every business unit.
          </p>
        </div>
      </div>
    </div>
  )
}

/** Compact per-store / shared template assignment overview. */
function StorefrontCoverage({
  mode,
  isSingleLinkMode,
  coverageStores,
  singleTemplate,
  activeStoreId,
  onSelectStore,
  highlight,
  innerRef,
  vendorSlug,
  templates,
}: {
  mode: StorefrontTemplateMode
  isSingleLinkMode: boolean
  coverageStores: CoverageStore[]
  singleTemplate: ResolvedTemplateDisplay | null
  activeStoreId: string | null
  onSelectStore: (id: string) => void
  highlight: boolean
  innerRef: React.RefObject<HTMLDivElement>
  vendorSlug?: string | null
  templates: WebsiteTemplate[]
}) {
  const isSingle = mode === 'single'
  const total = coverageStores.length
  const unassignedCount = coverageStores.filter(s => s.status === 'unassigned').length
  const activeStore = activeStoreId ? coverageStores.find(s => s.id === activeStoreId) : null
  const singleGlimpseStore =
    (activeStore?.status !== 'unassigned' ? activeStore : null)
    ?? coverageStores.find(s => s.status !== 'unassigned')
    ?? null
  const singleTemplateStatus = singleGlimpseStore?.status

  return (
    <div
      ref={innerRef}
      className={cn(
        'mb-1.5 rounded-lg border border-gray-200/90 bg-white p-3 shadow-sm dark:border-border dark:bg-card',
        highlight && 'border-l-2 border-l-primary',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <h2 className="inline-flex shrink-0 items-center gap-2 text-sm font-bold text-gray-900">
            <Store className="h-4 w-4 text-primary" />
            Storefront coverage
          </h2>
          {!isSingle && unassignedCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              {unassignedCount} need template
            </span>
          ) : null}
          {isSingle && singleTemplate ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[10px] font-semibold text-primary sm:text-xs">
              <Store className="h-3 w-3 shrink-0" />
              {total} store{total === 1 ? '' : 's'} · one template
            </span>
          ) : null}
          {!isSingle && activeStore ? (
            <>
              <span className="hidden h-4 w-px shrink-0 bg-gray-200 sm:block" aria-hidden />
              <p className="inline-flex min-w-0 flex-1 items-center gap-2 truncate text-xs leading-snug text-gray-700 sm:text-sm">
                <span
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full',
                    activeStore.status === 'live_builder'
                      ? 'bg-emerald-500'
                      : activeStore.status === 'catalog_assigned'
                        ? 'bg-sky-500'
                        : 'bg-gray-400',
                  )}
                  aria-hidden
                />
                <span className="min-w-0 truncate">
                  <span className="font-bold text-gray-900">{activeStore.code}</span>
                  <span className="text-gray-400"> · </span>
                  <span className="font-medium text-gray-800">{activeStore.name}</span>
                  {activeStore.template ? (
                    <>
                      <span className="text-gray-400"> → </span>
                      <span className="font-semibold text-gray-900">{activeStore.template.name}</span>
                      <span className={cn('ml-2 inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold sm:text-xs', coverageStatusBadgeClass(activeStore.status))}>
                        {activeStore.status === 'live_builder' ? 'Live on storefront' : 'Template assigned'}
                      </span>
                    </>
                  ) : (
                    <span className="font-medium text-amber-700"> — no template yet</span>
                  )}
                </span>
              </p>
              {activeStore.liveStorefrontUrl ? (
                <a
                  href={activeStore.liveStorefrontUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 sm:px-2.5 sm:py-1.5 sm:text-xs"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  View live store
                </a>
              ) : null}
            </>
          ) : null}
          {isSingle && activeStore?.liveStorefrontUrl ? (
            <a
              href={activeStore.liveStorefrontUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 sm:px-2.5 sm:py-1.5 sm:text-xs"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              View live store
            </a>
          ) : null}
        </div>
        <Link
          to="/settings"
          className="shrink-0 text-xs font-medium text-blue-600 underline decoration-blue-600/70 underline-offset-2 hover:text-blue-800 hover:decoration-blue-800 visited:text-blue-700"
        >
          {isSingleLinkMode ? 'Shared URL' : 'Per-unit URLs'} · settings
        </Link>
      </div>

      {isSingle ? (
        singleTemplate ? (
          <SharedTemplateCoverageCard
            template={singleTemplate}
            total={total}
            coverageStores={coverageStores}
            activeStoreId={activeStoreId}
            onSelectStore={onSelectStore}
            vendorSlug={vendorSlug}
            templates={templates}
            previewStore={singleGlimpseStore}
            status={singleTemplateStatus}
          />
        ) : (
          <SharedTemplateCoverageEmpty />
        )
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {coverageStores.map(store => (
            <CoverageStoreCard
              key={store.id}
              store={store}
              active={store.id === activeStoreId}
              onSelect={() => onSelectStore(store.id)}
              vendorSlug={vendorSlug}
              templates={templates}
            />
          ))}
        </div>
      )}

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
  const storesQueryParams = useMemo(() => ({ limit: 200 }), [])
  const storesQueryKey = vendorKeys.stores(storesQueryParams)
  const { data: storesData, isLoading: storesLoading } = useStores(storesQueryParams)
  const stores = storesData?.stores ?? []
  const sortedStores = useMemo(() => sortStoresByCode(stores), [stores])
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
  const selectedAssignStoreIdRef = useRef<string | null>(null)

  useEffect(() => {
    selectedAssignStoreIdRef.current = selectedAssignStoreId
  }, [selectedAssignStoreId])

  const storefrontLinkMode = resolveStorefrontLinkMode(vendor?.settings)
  const storefrontTemplateMode = resolveStorefrontTemplateMode(vendor?.settings)
  const isSingleLinkMode = storefrontLinkMode === 'single'
  const isSingleTemplateMode = storefrontTemplateMode === 'single'
  const isPerStoreTemplateMode = storefrontTemplateMode === 'per_unit'
  const singleFrontTemplateId = resolveSingleFrontTemplateId(vendor?.settings)

  const [useForAllConfirm, setUseForAllConfirm] = useState<{ id: string; name: string } | null>(null)

  const requestUseForAllStores = useCallback((templateId: string, templateName: string) => {
    setUseForAllConfirm({ id: templateId, name: templateName })
  }, [])

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
            setUseForAllConfirm(null)
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
  const [assignBuilderSite, setAssignBuilderSite] = useState<{ id: string; name: string } | null>(null)
  const [viewLivePicker, setViewLivePicker] = useState<{
    templateName: string
    links: AppliedTemplateViewLiveLink[]
  } | null>(null)

  const openViewLiveLinks = useCallback(
    (links: AppliedTemplateViewLiveLink[], templateName: string) => {
      const resolved = collapseViewLiveLinks(links)
      if (resolved.length === 0) return
      if (resolved.length === 1) {
        window.open(resolved[0].href, '_blank', 'noopener,noreferrer')
        return
      }
      setViewLivePicker({
        templateName,
        links: resolved,
      })
    },
    [],
  )

  const assignTemplateToStores = useMutation({
    mutationFn: async ({
      templateId,
      storeIds,
    }: {
      templateId: string
      storeIds: string[]
      templateName: string
    }) => {
      const storesData = queryClient.getQueryData(storesQueryKey) as { stores?: typeof stores } | undefined
      const freshStores = storesData?.stores ?? stores
      const freshSites = (queryClient.getQueryData(['websites']) as SiteListItem[] | undefined) ?? (sites as SiteListItem[])
      const liveSites = freshSites.filter(s => !isTemplateSandboxSite(s))
      await assignCatalogTemplateToStores({
        templateId,
        storeIds,
        sites: liveSites,
        stores: freshStores,
      })
    },
    onSuccess: (_data, vars) => {
      queryClient.setQueryData(storesQueryKey, (prev: { stores?: typeof stores } | undefined) => {
        if (!prev?.stores) return prev
        return {
          ...prev,
          stores: prev.stores.map(s =>
            vars.storeIds.includes(s.id)
              ? {
                  ...s,
                  settings: { ...(s.settings ?? {}), [STORE_FRONT_TEMPLATE_KEY]: vars.templateId },
                }
              : s,
          ),
        }
      })
      void queryClient.invalidateQueries({
        queryKey: [...vendorKeys.all, 'stores'],
        refetchType: 'none',
      })
      void queryClient.invalidateQueries({ queryKey: ['websites'] })
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
      window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: [...vendorKeys.all, 'stores'] })
      }, 2500)
    },
    onError: () => toast.error('Could not apply template to business units'),
  })

  const assignBuilderSiteToStore = useMutation({
    mutationFn: async ({
      siteId,
      storeIds,
    }: {
      siteId: string
      storeIds: string[]
      siteName: string
    }) => {
      const storesData = queryClient.getQueryData(storesQueryKey) as { stores?: typeof stores } | undefined
      const freshStores = storesData?.stores ?? stores
      const listKey = websitesListQueryKey(vendor?.id)
      const freshSites =
        (queryClient.getQueryData(listKey) as SiteListItem[] | undefined)
        ?? (queryClient.getQueryData(['websites']) as SiteListItem[] | undefined)
        ?? (sites as SiteListItem[])
      await assignBuilderSiteToStores({ siteId, storeIds, sites: freshSites, stores: freshStores })
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: [...vendorKeys.all, 'stores'],
        refetchType: 'none',
      })
      void queryClient.invalidateQueries({ queryKey: ['websites'] })
      void queryClient.invalidateQueries({ queryKey: vendorKeys.me() })
      toast.success(
        vars.storeIds.length > 1
          ? `Business Website Builder site linked to ${vars.storeIds.length} business units`
          : 'Business Website Builder site linked to business unit',
      )
      setAssignBuilderSite(null)
      setSearchParams(prev => {
        const next = new URLSearchParams(prev)
        next.delete('perStore')
        return next
      }, { replace: true })
      window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: [...vendorKeys.all, 'stores'] })
      }, 2500)
    },
    onError: (error) => {
      toast.error(
        error instanceof BuilderSiteAssignmentError
          ? error.message
          : extractApiError(error, 'Could not link draft site to business units'),
      )
    },
  })

  const openStorePicker = useCallback((
    templateId: string,
    templateName: string,
    opts?: { manage?: boolean },
  ) => {
    if (assignTemplateToStores.isPending) return
    const targetStoreId = selectedAssignStoreIdRef.current ?? sortedStores[0]?.id ?? null
    if (!targetStoreId) {
      toast.error('Select a business unit in Storefront coverage first.')
      return
    }
    if (!opts?.manage) {
      assignTemplateToStores.mutate({
        templateId,
        storeIds: [targetStoreId],
        templateName,
      })
      return
    }
    setAssignTemplate({ id: templateId, name: templateName })
  }, [sortedStores, assignTemplateToStores])

  const openTemplateBrowserPreview = useCallback((templateId: string) => {
    openDraftPreviewInBrowser(
      wrapStorefrontPreviewForVendorBrowser(getStorefrontTemplateBrowserPreviewUrl(templateId)),
    )
  }, [])

  const handleTemplateCardSurfaceClick = useCallback(
    (
      e: React.MouseEvent,
      templateId: string,
      viewLiveLinks: AppliedTemplateViewLiveLink[],
      templateName: string,
    ) => {
      if ((e.target as HTMLElement).closest('[data-template-card-action]')) return
      if (viewLiveLinks.length > 0) {
        openViewLiveLinks(viewLiveLinks, templateName)
        return
      }
      openTemplateBrowserPreview(templateId)
    },
    [openTemplateBrowserPreview, openViewLiveLinks],
  )

  const handleSetTemplateMode = useCallback(
    (mode: StorefrontTemplateMode) => {
      const current = useVendorStore.getState().vendor
      if (!current) return
      if (resolveStorefrontTemplateMode(current.settings) === mode) return
      const nextSettings: Record<string, unknown> = {
        ...(current.settings ?? {}),
        [STOREFRONT_TEMPLATE_MODE_KEY]: mode,
      }
      if (mode === 'single' && !resolveSingleFrontTemplateId(nextSettings)) {
        nextSettings[SINGLE_FRONT_TEMPLATE_KEY] = resolveDefaultSingleFrontTemplateId(
          themeConfig?.template,
        )
      }
      updateVendor.mutate(
        { settings: nextSettings },
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
    [setSearchParams, themeConfig?.template, updateVendor],
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
    if (storesLoading || sortedStores.length === 0) return
    if (storeParam && sortedStores.some(s => s.id === storeParam)) {
      setSelectedAssignStoreId(storeParam)
      return
    }
    setSelectedAssignStoreId(prev =>
      prev && sortedStores.some(s => s.id === prev) ? prev : sortedStores[0].id,
    )
  }, [storesLoading, sortedStores, storeParam])

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

  const mainSites = useMemo(
    () => (sites as SiteListItem[]).filter(s => !isTemplateSandboxSite(s)),
    [sites],
  )

  const builderDraftSites = useMemo(
    () => listBuilderDraftTemplateSites(mainSites),
    [mainSites],
  )

  const categories = useMemo(() => {
    const c = new Set<string>()
    for (const t of templates) {
      if (t.category) c.add(t.category)
    }
    if (builderDraftSites.length > 0) c.add('website_builder')
    return ['all', ...Array.from(c).sort((a, b) => a.localeCompare(b))]
  }, [templates, builderDraftSites.length])

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

  const filteredBuilderDrafts = useMemo(() => {
    if (templateCategory !== 'all' && templateCategory !== 'website_builder') return []
    const q = templateSearch.trim().toLowerCase()
    return builderDraftSites
      .filter(site => {
        if (!q) return true
        const hay = `${site.name || ''} ${site.description || ''} ${site.applied_template_name || ''}`.toLowerCase()
        return hay.includes(q)
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [builderDraftSites, templateCategory, templateSearch])

  const selectedSite = sites.find(s => s.id === selectedSiteId) ?? null
  const busy = sitesLoading || templatesLoading
  const legacyPresetsBusy = themeLoading || presetsLoading || sitesLoading
  const legacyPresets = (presetsData?.presets ?? []) as ThemePresetSummary[]
  const lightPreset = legacyPresets.find(p => p.id === 'light')
  const showDefaultLayoutCard = templateCategory === 'all' && !templateSearch.trim()

  const singleFrontDefaultInitRef = useRef(false)
  useEffect(() => {
    if (!vendor || !isSingleTemplateMode || legacyPresetsBusy) return
    if (resolveSingleFrontTemplateId(vendor.settings)) return
    if (singleFrontDefaultInitRef.current) return
    singleFrontDefaultInitRef.current = true
    const defaultId = resolveDefaultSingleFrontTemplateId(themeConfig?.template)
    updateVendor.mutate(
      {
        settings: {
          ...(vendor.settings ?? {}),
          [SINGLE_FRONT_TEMPLATE_KEY]: defaultId,
        },
      },
      {
        onError: () => {
          singleFrontDefaultInitRef.current = false
        },
      },
    )
  }, [vendor, isSingleTemplateMode, legacyPresetsBusy, themeConfig?.template, updateVendor])

  const activeSingleFrontTemplate = useMemo(
    () => resolveTemplateDisplay(singleFrontTemplateId, templates, legacyPresets, mainSites),
    [legacyPresets, singleFrontTemplateId, templates, mainSites],
  )

  const coveragePreviewContext = useMemo(
    () => ({
      vendorSlug: vendor?.slug,
      linkMode: storefrontLinkMode,
      templateMode: storefrontTemplateMode,
    }),
    [vendor?.slug, storefrontLinkMode, storefrontTemplateMode],
  )

  const coverageStores = useMemo<CoverageStore[]>(
    () =>
      sortStoresByCode(stores).map(store => {
        const { template, status, siteId, livePreviewUrl } = resolveStoreCoverageState(
          { ...store, code: formatStoreCode(store) },
          mainSites,
          templates,
          legacyPresets,
          vendor?.settings,
          coveragePreviewContext,
        )
        return {
          id: store.id,
          name: store.name,
          code: formatStoreCode(store),
          is_default: store.is_default,
          template,
          status,
          siteId,
          livePreviewUrl,
          liveStorefrontUrl:
            status !== 'unassigned' && coveragePreviewContext.vendorSlug
              ? customerLinkForStore(
                  coveragePreviewContext.vendorSlug,
                  store,
                  coveragePreviewContext.linkMode ?? 'single',
                  coveragePreviewContext.templateMode,
                )
              : null,
        }
      }),
    [stores, mainSites, templates, legacyPresets, vendor?.settings, coveragePreviewContext],
  )

  const coverageAssignedTemplateIds = useMemo(() => {
    const ids = new Set<string>()
    for (const store of coverageStores) {
      if (store.template && store.status !== 'unassigned') {
        ids.add(store.template.id)
      }
    }
    return ids
  }, [coverageStores])

  /** Per-store assigned template id (catalog or builder site id) for gallery card state. */
  const assignedTemplateIdByStoreId = useMemo(() => {
    const map = new Map<string, string>()
    for (const store of coverageStores) {
      if (store.template && store.status !== 'unassigned') {
        map.set(store.id, store.template.id)
      }
    }
    return map
  }, [coverageStores])

  const coverageStoreIdsByTemplateId = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const store of coverageStores) {
      if (!store.template || store.status === 'unassigned') continue
      const list = map.get(store.template.id) ?? []
      list.push(store.id)
      map.set(store.template.id, list)
    }
    return map
  }, [coverageStores])

  const pickerStores = useMemo(
    () =>
      sortStoresByCode(stores).map(store => ({
        id: store.id,
        name: store.name,
        code: formatStoreCode(store),
        is_default: store.is_default,
        currentTemplateName:
          resolveStoreCoverageState(
            store,
            mainSites,
            templates,
            legacyPresets,
            vendor?.settings,
          ).template?.name ?? null,
      })),
    [stores, mainSites, templates, legacyPresets, vendor?.settings],
  )

  const selectedAssignStore = useMemo(
    () => (selectedAssignStoreId ? sortedStores.find(s => s.id === selectedAssignStoreId) ?? null : null),
    [selectedAssignStoreId, sortedStores],
  )
  const selectedAssignStoreCode = selectedAssignStore ? formatStoreCode(selectedAssignStore) : null

  useEffect(() => {
    if ((!isPerStoreTemplateMode && !isSingleTemplateMode) || !selectedAssignStoreId) return
    const frame = requestAnimationFrame(() => {
      document
        .querySelector('[data-current-for-selected-store="true"]')
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
    return () => cancelAnimationFrame(frame)
  }, [isPerStoreTemplateMode, isSingleTemplateMode, selectedAssignStoreId])

  const assignBuilderSiteRecord = useMemo(
    () => (assignBuilderSite ? mainSites.find(s => s.id === assignBuilderSite.id) ?? null : null),
    [assignBuilderSite, mainSites],
  )

  const builderSitePickerStores = useMemo(() => {
    if (!assignBuilderSiteRecord) return pickerStores
    const eligibleIds = new Set(
      storesEligibleForBuilderSiteAssignment(assignBuilderSiteRecord, stores).map(s => s.id),
    )
    return pickerStores.filter(store => eligibleIds.has(store.id))
  }, [assignBuilderSiteRecord, pickerStores, stores])

  const builderSitePickerLocked = useMemo(
    () => Boolean(assignBuilderSiteRecord && resolveBuilderSiteHomeStoreId(assignBuilderSiteRecord)),
    [assignBuilderSiteRecord],
  )

  const storeScopedBuilderDrafts = useMemo(() => {
    if (!isPerStoreTemplateMode || !selectedAssignStoreId) return filteredBuilderDrafts
    return filteredBuilderDrafts.filter(site =>
      isBuilderSiteVisibleForStore(site, selectedAssignStoreId),
    )
  }, [filteredBuilderDrafts, isPerStoreTemplateMode, selectedAssignStoreId])

  const openBuilderSiteStorePicker = useCallback((siteId: string, siteName: string, preferStoreId?: string) => {
    const site = mainSites.find(s => s.id === siteId)
    const homeStoreId = site ? resolveBuilderSiteHomeStoreId(site) : null
    const targetStoreId = homeStoreId ?? preferStoreId ?? null
    if (targetStoreId) setSelectedAssignStoreId(targetStoreId)

    const eligible = site ? storesEligibleForBuilderSiteAssignment(site, stores) : stores
    if (
      eligible.length === 1
      && !isBuilderSiteAssignedToStore(mainSites, siteId, stores)
    ) {
      assignBuilderSiteToStore.mutate({
        siteId,
        storeIds: [eligible[0].id],
        siteName,
      })
      return
    }

    setAssignBuilderSite({ id: siteId, name: siteName })
  }, [mainSites, stores, assignBuilderSiteToStore])

  const visibleBuilderDraftCount = isPerStoreTemplateMode && selectedAssignStoreId
    ? storeScopedBuilderDrafts.length
    : filteredBuilderDrafts.length
  const visibleTemplateCount =
    filteredTemplates.length
    + visibleBuilderDraftCount
    + (showDefaultLayoutCard && lightPreset ? 1 : 0)

  const storesUsingTemplate = useCallback(
    (templateId: string) => (coverageStoreIdsByTemplateId.get(templateId) ?? []).length,
    [coverageStoreIdsByTemplateId],
  )

  const {
    draftBuilderDrafts,
    systemWebsiteTemplates,
  } = useMemo(() => {
    const draftBD: SiteListItem[] = []
    const systemTpl: WebsiteTemplate[] = []
    for (const site of storeScopedBuilderDrafts) {
      const inLiveGallery =
        coverageAssignedTemplateIds.has(site.id)
        || isBuilderSiteInAssignedTemplatesSection(site, mainSites, stores, vendor?.settings)
        || isBuilderSiteEffectivelyLive(mainSites, site.id, stores, vendor?.settings)
      if (!inLiveGallery) {
        draftBD.push(site)
      }
    }
    for (const tpl of filteredTemplates) {
      if (!coverageAssignedTemplateIds.has(tpl.id)) {
        systemTpl.push(tpl)
      }
    }
    const sortDraftBuilderByAssignable = (a: SiteListItem, b: SiteListItem) => {
      if (!isPerStoreTemplateMode || !selectedAssignStoreId) {
        return (a.name || '').localeCompare(b.name || '')
      }
      const aAssignable = isBuilderSiteAssignableForStore(a, selectedAssignStoreId)
      const bAssignable = isBuilderSiteAssignableForStore(b, selectedAssignStoreId)
      if (aAssignable !== bAssignable) return aAssignable ? -1 : 1
      return (a.name || '').localeCompare(b.name || '')
    }
    draftBD.sort(sortDraftBuilderByAssignable)
    systemTpl.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    return {
      draftBuilderDrafts: draftBD,
      systemWebsiteTemplates: systemTpl,
    }
  }, [
    storeScopedBuilderDrafts,
    filteredTemplates,
    coverageAssignedTemplateIds,
    isPerStoreTemplateMode,
    selectedAssignStoreId,
    mainSites,
    stores,
    vendor?.settings,
  ])

  const showDefaultInLive = showDefaultLayoutCard && lightPreset != null && coverageAssignedTemplateIds.has(lightPreset.id)
  const showDefaultInSystem = showDefaultLayoutCard && lightPreset != null && !coverageAssignedTemplateIds.has(lightPreset.id)

  const defaultAssignedToSelectedStore = useMemo(() => {
    if (!lightPreset || !selectedAssignStoreId) return false
    return storesAssignedToTemplate(stores, lightPreset.id, { sites: mainSites })
      .some(s => s.id === selectedAssignStoreId)
  }, [lightPreset, selectedAssignStoreId, stores, mainSites])

  type LiveSectionEntry =
    | { type: 'default' }
    | { type: 'builder'; site: SiteListItem }
    | { type: 'catalog'; template: WebsiteTemplate }
    | { type: 'resolved'; display: ResolvedTemplateDisplay }

  const liveSectionEntries = useMemo((): LiveSectionEntry[] => {
    const entries: Array<LiveSectionEntry & { assignedToSelected: boolean; sortKey: string }> = []
    const seenTemplateIds = new Set<string>()
    let defaultAdded = false

    for (const store of coverageStores) {
      if (!store.template || store.status === 'unassigned') continue
      const templateId = store.template.id
      const assignedToSelected = store.id === selectedAssignStoreId

      if (lightPreset && templateId === lightPreset.id) {
        if (!defaultAdded) {
          defaultAdded = true
          entries.push({
            type: 'default',
            assignedToSelected,
            sortKey: store.code,
          })
        } else if (assignedToSelected) {
          const def = entries.find(e => e.type === 'default')
          if (def) def.assignedToSelected = true
        }
        continue
      }

      if (seenTemplateIds.has(templateId)) {
        if (assignedToSelected) {
          const hit = entries.find(e =>
            (e.type === 'catalog' && e.template.id === templateId)
            || (e.type === 'builder' && e.site.id === templateId)
            || (e.type === 'resolved' && e.display.id === templateId),
          )
          if (hit) hit.assignedToSelected = true
        }
        continue
      }
      seenTemplateIds.add(templateId)

      const builderSite = mainSites.find(s => s.id === templateId)
      const catalogTpl = templates.find(t => t.id === templateId)

      if (builderSite) {
        entries.push({
          type: 'builder',
          site: builderSite,
          assignedToSelected,
          sortKey: store.code,
        })
      } else if (catalogTpl) {
        entries.push({
          type: 'catalog',
          template: catalogTpl,
          assignedToSelected,
          sortKey: store.code,
        })
      } else if (store.template) {
        entries.push({
          type: 'resolved',
          display: store.template,
          assignedToSelected,
          sortKey: store.code,
        })
      }
    }

    for (const site of mainSites) {
      if (!site.is_published) continue
      if (!isBuilderSiteInAssignedTemplatesSection(site, mainSites, stores, vendor?.settings)) continue
      if (seenTemplateIds.has(site.id)) continue
      seenTemplateIds.add(site.id)
      const assignedToSelected = isSingleTemplateMode
        ? singleFrontTemplateId === site.id
        : Boolean(
            selectedAssignStoreId
            && storesUsingBuilderSiteDesign(mainSites, site.id, stores, vendor?.settings)
              .some(s => s.id === selectedAssignStoreId),
          )
      entries.push({
        type: 'builder',
        site,
        assignedToSelected,
        sortKey: singleFrontTemplateId === site.id ? '0' : (site.name || site.id),
      })
    }

    if (showDefaultInLive && !defaultAdded) {
      entries.push({
        type: 'default',
        assignedToSelected: defaultAssignedToSelectedStore,
        sortKey: '0',
      })
    }

    entries.sort((a, b) => {
      const isPrimaryAssigned = (entry: typeof a) => {
        if (!isSingleTemplateMode || !singleFrontTemplateId) return false
        if (entry.type === 'builder') return entry.site.id === singleFrontTemplateId
        if (entry.type === 'catalog') return entry.template.id === singleFrontTemplateId
        if (entry.type === 'default') return lightPreset?.id === singleFrontTemplateId
        return false
      }
      const aPrimary = isPrimaryAssigned(a)
      const bPrimary = isPrimaryAssigned(b)
      if (aPrimary !== bPrimary) return aPrimary ? -1 : 1
      if (isPerStoreTemplateMode && selectedAssignStoreId && a.assignedToSelected !== b.assignedToSelected) {
        return a.assignedToSelected ? -1 : 1
      }
      return a.sortKey.localeCompare(b.sortKey)
    })

    return entries.map(({ assignedToSelected: _assignedToSelected, sortKey: _sortKey, ...entry }) => entry)
  }, [
    coverageStores,
    lightPreset,
    mainSites,
    templates,
    selectedAssignStoreId,
    isPerStoreTemplateMode,
    isSingleTemplateMode,
    singleFrontTemplateId,
    stores,
    vendor?.settings,
    showDefaultInLive,
    defaultAssignedToSelectedStore,
  ])

  const hasLiveSection = liveSectionEntries.length > 0
  const hasDraftSection = draftBuilderDrafts.length > 0
  const hasSystemSection = showDefaultInSystem || systemWebsiteTemplates.length > 0

  const renderDefaultLayoutCard = () => {
    if (!lightPreset) return null
    const defaultAssignedStores = storesAssignedToTemplate(stores, lightPreset.id, { sites: mainSites })
    const defaultAssignedToSelected = Boolean(
      selectedAssignStoreId && defaultAssignedStores.some(s => s.id === selectedAssignStoreId),
    )
    return (
      <BusinessFrontDefaultTemplateCard
        preset={lightPreset}
        themeTemplateId={themeConfig?.template}
        sites={sites}
        vendorSlug={vendor?.slug}
        onCustomize={() => setCustomizeOpen(true)}
        singleTemplateMode={isSingleTemplateMode}
        isSingleTemplateSelected={singleFrontTemplateId === lightPreset.id}
        onUseForAllStores={isSingleTemplateMode ? requestUseForAllStores : undefined}
        useForAllStoresPending={updateVendor.isPending}
        perStoreTemplateMode={isPerStoreTemplateMode}
        perStoreUsedCount={storesUsingTemplate(lightPreset.id)}
        assignedStoreNames={defaultAssignedStores.map(s => s.name)}
        assignedStoreCodes={defaultAssignedStores.map(s => formatStoreCode(s))}
        contextStoreCode={selectedAssignStoreCode}
        assignedToContextStore={defaultAssignedToSelected}
        onApplyForStore={
          isPerStoreTemplateMode
            ? templateId =>
                openStorePicker(templateId, lightPreset.name, {
                  manage: defaultAssignedToSelected,
                })
            : undefined
        }
        applyForStorePending={assignTemplateToStores.isPending}
        viewLiveLinks={resolveAppliedTemplateViewLiveLinks(vendor?.slug, storefrontLinkMode, {
          templateId: lightPreset.id,
          templateMode: storefrontTemplateMode,
          singleFrontTemplateId,
          stores,
          builderSites: mainSites,
        })}
        highlightStoreId={selectedAssignStoreId}
      />
    )
  }

  const renderBuilderDraftCard = (site: SiteListItem, opts?: { previewOnly?: boolean }) => {
    const linkedStores = storesAssignedToBuilderSite(mainSites, site.id, stores)
    const allAssignedStores = storesUsingBuilderSiteDesign(mainSites, site.id, stores, vendor?.settings)
    const perStoreAppliedCount = coverageStores.filter(
      s => s.status !== 'unassigned' && s.template?.id === site.id,
    ).length
    const linkedStoreNames = linkedStores.map(s => s.name ?? '')
    const homeStoreId = resolveBuilderSiteHomeStoreId(site)
    const homeStore = homeStoreId ? stores.find(s => s.id === homeStoreId) : null
    const builtForHomeStoreCode = homeStore ? formatStoreCode(homeStore) : null
    const linkedToSelectedStore = isBuilderSiteBuiltForStore(site, selectedAssignStoreId)
    const canAssignForSelectedStore = isBuilderSiteAssignableForStore(site, selectedAssignStoreId)
    const assignedToSelectedStore = Boolean(
      selectedAssignStoreId
      && assignedTemplateIdByStoreId.get(selectedAssignStoreId) === site.id,
    )
    const catalogOnlyOnSelected = Boolean(
      selectedAssignStoreId
      && allAssignedStores.some(s => s.id === selectedAssignStoreId)
      && !linkedStores.some(s => s.id === selectedAssignStoreId),
    )
    const showAssignHighlight = isPerStoreTemplateMode && assignedToSelectedStore
    const isSingleTemplateSelected = singleFrontTemplateId === site.id
    const isLiveOnStorefront = isBuilderSiteEffectivelyLive(
      mainSites,
      site.id,
      stores,
      vendor?.settings,
    )
    const buildStorefrontViewLiveLinks = (storeIds: string[]): AppliedTemplateViewLiveLink[] => {
      const slug = vendor?.slug?.trim()
      if (!slug || storeIds.length === 0) return []

      if (!storefrontUrlNeedsBranch(storefrontLinkMode, storefrontTemplateMode)) {
        const href = buildCustomerStoreLink(slug)
        return href ? [{ href, label: 'All business units' }] : []
      }

      return storeIds
        .map(id => stores.find(s => s.id === id))
        .filter((store): store is NonNullable<typeof store> => Boolean(store))
        .flatMap(store => {
          const href = customerLinkForStore(slug, store, storefrontLinkMode, storefrontTemplateMode)
          return href
            ? [{ href, label: `${formatStoreCode(store)} · ${store.name}`, storeId: store.id }]
            : []
        })
    }
    let viewLiveLinks = isLiveOnStorefront
      ? resolveBuilderSiteViewLiveLinks(
          vendor?.slug,
          storefrontLinkMode,
          mainSites,
          site.id,
          stores,
          vendor?.settings,
        )
      : []
    if (viewLiveLinks.length === 0 && isSingleTemplateMode && isSingleTemplateSelected) {
      viewLiveLinks = buildStorefrontViewLiveLinks(sortStoresByCode(stores).map(s => s.id))
    } else if (
      viewLiveLinks.length === 0
      && isPerStoreTemplateMode
      && assignedToSelectedStore
      && selectedAssignStoreId
    ) {
      viewLiveLinks = buildStorefrontViewLiveLinks([selectedAssignStoreId])
    }
    const liveBlockReason = resolveBuilderSiteLiveBlockReason(
      mainSites,
      site.id,
      stores,
      vendor?.settings,
    )
    const needsActivation = linkedStores.length > 0
      && liveBlockReason === 'catalog_template_override'
      && viewLiveLinks.length === 0
    return (
      <BuilderDraftTemplateCard
        key={`draft-${site.id}`}
        site={site}
        templates={templates}
        vendorSlug={vendor?.slug}
        perStoreAppliedCount={perStoreAppliedCount}
        linkedStoreNames={linkedStoreNames}
        linkedStoreCodes={linkedStores.map(s => formatStoreCode(s))}
        assignedStoreNames={allAssignedStores.map(s => s.name ?? '')}
        liveBlockReason={liveBlockReason}
        viewLiveLinks={viewLiveLinks}
        showAssignHighlight={showAssignHighlight || (isSingleTemplateMode && isSingleTemplateSelected)}
        perStoreTemplateMode={isPerStoreTemplateMode}
        singleTemplateMode={isSingleTemplateMode}
        isSingleTemplateSelected={isSingleTemplateSelected}
        onUseForAllStores={
          isSingleTemplateMode && (isBuilderSiteBuiltForAll(site) || isBuilderSiteExternal(site))
            ? () => requestUseForAllStores(site.id, site.name)
            : undefined
        }
        useForAllStoresPending={updateVendor.isPending}
        onAssign={
          isPerStoreTemplateMode && canAssignForSelectedStore
            ? () => {
                const targetStoreId = selectedAssignStoreIdRef.current ?? sortedStores[0]?.id ?? null
                if (!targetStoreId) {
                  toast.error('Select a business unit in Storefront coverage first.')
                  return
                }

                if (needsActivation && linkedStores.length === 1) {
                  assignBuilderSiteToStore.mutate({
                    siteId: site.id,
                    storeIds: [linkedStores[0].id],
                    siteName: site.name,
                  })
                  return
                }

                // Already using this design on the selected unit — open link/manage picker.
                if (assignedToSelectedStore && linkedToSelectedStore) {
                  openBuilderSiteStorePicker(
                    site.id,
                    site.name,
                    linkedStores[0]?.id ?? homeStoreId ?? undefined,
                  )
                  return
                }

                // Catalog-only on selected unit — re-open assign picker to change or switch.
                if (assignedToSelectedStore && catalogOnlyOnSelected) {
                  openStorePicker(site.id, site.name, { manage: true })
                  return
                }

                const eligible = storesEligibleForBuilderSiteAssignment(site, stores)
                if (eligible.length === 1) {
                  assignBuilderSiteToStore.mutate({
                    siteId: site.id,
                    storeIds: [eligible[0].id],
                    siteName: site.name,
                  })
                  return
                }

                openBuilderSiteStorePicker(site.id, site.name, targetStoreId)
              }
            : undefined
        }
        assignPending={assignBuilderSiteToStore.isPending}
        onPreview={() => void openBuilderSiteDraftPreview(site.id)}
        onViewLivePicker={links => openViewLiveLinks(links, site.name)}
        highlightStoreId={selectedAssignStoreId}
        contextStoreId={selectedAssignStoreId}
        contextStoreCode={selectedAssignStoreCode}
        builtForHomeStoreCode={builtForHomeStoreCode}
        linkedToContextStore={linkedToSelectedStore}
        appliedToContextStore={assignedToSelectedStore}
        previewOnly={opts?.previewOnly}
      />
    )
  }

  const renderWebsiteTemplateCard = (tpl: WebsiteTemplate) => {
    const pageCount = tpl.page_count ?? tpl.pages?.length ?? 0
    const tier = tpl.tier || (pageCount >= 6 ? 'full' : 'lite')
    const palette = getTemplatePreviewPalette(tpl)
    const fallbackGradient =
      palette.length >= 2
        ? `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`
        : null
    const isSingleTemplateSelected = singleFrontTemplateId === tpl.id
    const assignedStores = (coverageStoreIdsByTemplateId.get(tpl.id) ?? [])
      .map(storeId => stores.find(s => s.id === storeId))
      .filter((store): store is NonNullable<typeof store> => store != null)
    const perStoreAppliedCount = assignedStores.length
    const assignedToSelectedStore = Boolean(
      selectedAssignStoreId && assignedStores.some(s => s.id === selectedAssignStoreId),
    )
    const viewLiveLinks = resolveAppliedTemplateViewLiveLinks(vendor?.slug, storefrontLinkMode, {
      templateId: tpl.id,
      templateMode: storefrontTemplateMode,
      singleFrontTemplateId,
      stores,
      builderSites: mainSites,
    })
    const cardViewLiveLinks: AppliedTemplateViewLiveLink[] = viewLiveLinks.length > 0
      ? viewLiveLinks
      : (() => {
          const slug = vendor?.slug?.trim()
          if (!slug || perStoreAppliedCount === 0) return []
          return assignedStores.flatMap(store => {
            const href = customerLinkForStore(slug, store, storefrontLinkMode, storefrontTemplateMode)
            return href
              ? [{ href, label: `${formatStoreCode(store)} · ${store.name}`, storeId: store.id }]
              : []
          })
        })()
    const isLiveForSelectedStore = Boolean(
      assignedToSelectedStore
      && selectedAssignStoreId
      && cardViewLiveLinks.some(link => link.storeId === selectedAssignStoreId),
    )
    const showAssignHighlight = (isSingleTemplateMode && isSingleTemplateSelected)
      || (isPerStoreTemplateMode && assignedToSelectedStore)
    const perStoreStatusLabel = isPerStoreTemplateMode && selectedAssignStoreCode
      ? assignedToSelectedStore
        ? isLiveForSelectedStore
          ? `Live · ${selectedAssignStoreCode}`
          : `Assigned · ${selectedAssignStoreCode}`
        : systemTemplateGalleryStatusLabel
      : perStoreAppliedCount > 0
        ? `${perStoreAppliedCount} live`
        : systemTemplateGalleryStatusLabel
    const perStoreStatusTitle = isPerStoreTemplateMode && selectedAssignStoreCode
      ? assignedToSelectedStore
        ? `Assigned to ${selectedAssignStoreCode}`
        : systemTemplateGalleryStatusTitle(
            selectedAssignStoreCode,
            assignedStores.map(s => s.name ?? formatStoreCode(s)),
          )
      : assignedStores.map(s => `${formatStoreCode(s)} · ${s.name}`).join(', ')
    const perStoreBadgeLabel = isPerStoreTemplateMode && assignedToSelectedStore && selectedAssignStoreCode
      ? selectedAssignStoreCode
      : perStoreAppliedCount === 1
        ? formatStoreCode(assignedStores[0])
        : `${perStoreAppliedCount} BUs / Stores`
    const isLiveOnStorefront = cardViewLiveLinks.length > 0
    const isContextAssigned = (isSingleTemplateMode && isSingleTemplateSelected)
      || (isPerStoreTemplateMode && assignedToSelectedStore)
    const showViewLiveOnCard = isContextAssigned && cardViewLiveLinks.length > 0
    const multipleLiveStores = cardViewLiveLinks.length > 1
    const liveHoverLabel = isLiveForSelectedStore && selectedAssignStoreCode
      ? `View live · ${selectedAssignStoreCode}`
      : multipleLiveStores
        ? `View live (${cardViewLiveLinks.length})`
        : 'View live'
    const showTopAssignmentBadge = !(
      (isSingleTemplateMode && isSingleTemplateSelected)
      || (isPerStoreTemplateMode && assignedToSelectedStore)
    )
    const storeRibbonLabel = perStoreGalleryRibbonLabel(
      selectedAssignStoreCode,
      Boolean(isPerStoreTemplateMode && assignedToSelectedStore),
      isLiveForSelectedStore,
    )
    const hidePerStoreBodyStatus = Boolean(storeRibbonLabel)
    const assignedGlimpse = resolveAssignedTemplateGlimpsePreview(tpl, templates, {
      liveStorefrontUrl: cardViewLiveLinks[0]?.href,
      status: isLiveOnStorefront ? 'live_builder' : 'catalog_assigned',
    })
    return (
      <div
        key={tpl.id}
        title={
          showViewLiveOnCard
            ? multipleLiveStores
              ? `View live — pick from ${cardViewLiveLinks.length} business units`
              : `View live — ${tpl.name}`
            : `Preview ${tpl.name}`
        }
        onClick={e => {
          if ((e.target as HTMLElement).closest('[data-template-card-action]')) return
          if (showViewLiveOnCard) {
            openViewLiveLinks(cardViewLiveLinks, tpl.name)
            return
          }
          openTemplateBrowserPreview(tpl.id)
        }}
        data-current-for-selected-store={assignedToSelectedStore ? 'true' : undefined}
        className={cn(
          templateCardShellClass,
          showAssignHighlight && isSingleTemplateMode && templateCardSelectedClass,
          showAssignHighlight && isPerStoreTemplateMode && templateCardSelectedClass,
        )}
      >
        <div className="relative isolate overflow-hidden rounded-t-xl bg-white">
          {storeRibbonLabel ? <StoreStatusRibbon label={storeRibbonLabel} /> : null}
          <div className={cn(templateCardMediaHeightClass, 'w-full overflow-hidden')}>
            <WebsiteSiteGlimpse
              siteId={null}
              vendorSlug={vendor?.slug}
              fallbackImage={assignedGlimpse.fallbackImage ?? tpl.thumbnail}
              fallbackGradient={fallbackGradient}
              templates={templates}
              previewMode="assigned"
              variant="card"
              className="h-full w-full transform-gpu"
            />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />
          <div className={templateCardPreviewOverlayClass}>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold text-gray-900 shadow-md">
              {showViewLiveOnCard ? (
                <>
                  <ExternalLink className="h-3 w-3" />
                  {liveHoverLabel}
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3" />
                  Preview
                </>
              )}
            </span>
          </div>
          {isSingleTemplateMode && isSingleTemplateSelected && showTopAssignmentBadge ? (
            <span className={cn('absolute right-1.5 top-1.5 max-w-[70%]', templateBadgeEmeraldClass)} title="All stores">
              <Check className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">All stores</span>
            </span>
          ) : null}
          {isPerStoreTemplateMode && perStoreAppliedCount > 0 && showTopAssignmentBadge ? (
            <span
              className={cn('absolute right-1.5 top-1.5 max-w-[70%]', templateBadgeEmeraldClass)}
              title={assignedStores.map(s => `${formatStoreCode(s)} · ${s.name}`).join(', ')}
            >
              <Check className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{perStoreBadgeLabel}</span>
            </span>
          ) : null}
          <div className="absolute bottom-1 left-1.5 right-1.5 flex items-end justify-between gap-1">
            <div className="flex min-w-0 items-center gap-1 overflow-hidden">
              <span className={cn(templateCardMediaChipClass, tier === 'full' && 'bg-primary/90')}>
                {tier === 'full' ? 'Full site' : 'Lite'} · {pageCount} pg
              </span>
            </div>
            <span className="inline-flex shrink-0 -space-x-1">
              {palette.slice(0, 4).map((c, i) => (
                <span key={`${c}-${i}`} className="h-2.5 w-2.5 rounded-full border border-white shadow-sm" style={{ backgroundColor: c }} />
              ))}
            </span>
          </div>
        </div>
        <div className={templateCardBodyClass}>
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0 truncate text-sm font-extrabold leading-tight text-gray-900 transition-colors group-hover/card:text-primary">{tpl.name}</div>
            {(isSingleTemplateMode || (isPerStoreTemplateMode && !hidePerStoreBodyStatus)) ? (
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold',
                  showAssignHighlight
                    ? isSingleTemplateMode
                      ? 'text-primary'
                      : 'text-emerald-700'
                    : 'text-gray-400',
                )}
                title={perStoreStatusTitle}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    showAssignHighlight
                      ? isSingleTemplateMode
                        ? 'bg-primary'
                        : 'bg-emerald-500'
                      : 'bg-gray-300',
                  )}
                />
                {isSingleTemplateMode
                  ? isSingleTemplateSelected
                    ? 'Live all'
                    : 'Unused'
                  : perStoreStatusLabel}
              </span>
            ) : null}
          </div>
          <p className="truncate text-[10px] leading-tight text-gray-500" title={tpl.description}>{tpl.description}</p>
          <div className={templateCardActionRowClass} data-template-card-action>
            {isSingleTemplateMode ? (
              isSingleTemplateSelected ? (
                <span className={templateCardActivePillClass}>
                  <Check className="h-3 w-3 shrink-0" />
                  {singleTemplateActionLabel(true)}
                </span>
              ) : (
                <button
                  type="button"
                  disabled={updateVendor.isPending}
                  onClick={() => requestUseForAllStores(tpl.id, tpl.name)}
                  className={templateCardAssignPillClass}
                >
                  <Store className="h-3 w-3 shrink-0" />
                  {singleTemplateActionLabel(false)}
                </button>
              )
            ) : null}
            {isPerStoreTemplateMode ? (() => {
              const isAppliedToSelected = assignedToSelectedStore
              const isAppliedAnywhere = perStoreAppliedCount > 0
              return (
                <button
                  type="button"
                  disabled={assignTemplateToStores.isPending}
                  onClick={() =>
                    openStorePicker(tpl.id, tpl.name, { manage: isAppliedToSelected })
                  }
                  className={cn(
                    isAppliedToSelected
                      ? templateCardActivePillClass
                      : templateCardAssignPillClass,
                  )}
                >
                  {isAppliedToSelected ? <Check className="h-3 w-3 shrink-0" /> : <Store className="h-3 w-3 shrink-0" />}
                  {perStoreTemplateActionLabel(
                    selectedAssignStoreCode,
                    isAppliedToSelected,
                    isAppliedAnywhere,
                  )}
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
                  templateCardPrimaryActionClass,
                  selectedSiteId
                    ? 'border-transparent bg-primary text-white hover:opacity-90'
                    : 'cursor-not-allowed border-gray-200 bg-gray-200 text-gray-400',
                )}
              >
                <LayoutTemplate className="h-3 w-3 shrink-0" />
                Apply
              </button>
            ) : null}
            <div className={templateCardActionClusterClass}>
              {showViewLiveOnCard ? (
                <AppliedTemplateViewLiveButton
                  links={cardViewLiveLinks}
                  templateName={tpl.name}
                  highlightStoreId={selectedAssignStoreId}
                  showLabel
                  className="inline-flex h-6 min-w-0 shrink items-center justify-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-[10px] font-bold text-emerald-800 transition-colors hover:border-emerald-300 hover:bg-emerald-100"
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderResolvedAssignedCard = (display: ResolvedTemplateDisplay) => {
    const assignedStores = (coverageStoreIdsByTemplateId.get(display.id) ?? [])
      .map(storeId => stores.find(s => s.id === storeId))
      .filter((store): store is NonNullable<typeof store> => store != null)
    const perStoreAppliedCount = assignedStores.length
    const assignedToSelectedStore = Boolean(
      selectedAssignStoreId
      && assignedTemplateIdByStoreId.get(selectedAssignStoreId) === display.id,
    )
    const viewLiveLinks = resolveAppliedTemplateViewLiveLinks(vendor?.slug, storefrontLinkMode, {
      templateId: display.id,
      templateMode: storefrontTemplateMode,
      singleFrontTemplateId,
      stores,
      builderSites: mainSites,
    })
    const cardViewLiveLinks: AppliedTemplateViewLiveLink[] = viewLiveLinks.length > 0
      ? viewLiveLinks
      : (() => {
          const slug = vendor?.slug?.trim()
          if (!slug || perStoreAppliedCount === 0) return []
          return assignedStores.flatMap(store => {
            const href = customerLinkForStore(slug, store, storefrontLinkMode, storefrontTemplateMode)
            return href
              ? [{ href, label: `${formatStoreCode(store)} · ${store.name}`, storeId: store.id }]
              : []
          })
        })()
    const storeRibbonLabel = perStoreGalleryRibbonLabel(
      selectedAssignStoreCode,
      Boolean(isPerStoreTemplateMode && assignedToSelectedStore),
      false,
    )
    const assignedGlimpse = resolveAssignedTemplateGlimpsePreview(display, templates, {
      liveStorefrontUrl: cardViewLiveLinks[0]?.href,
      status: 'catalog_assigned',
    })
    return (
      <div
        key={`resolved-${display.id}`}
        className={cn(
          templateCardShellClass,
          assignedToSelectedStore && 'ring-2 ring-primary/30',
        )}
        data-current-for-selected-store={assignedToSelectedStore ? 'true' : undefined}
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
          {storeRibbonLabel ? <StoreStatusRibbon label={storeRibbonLabel} /> : null}
          <WebsiteSiteGlimpse
            siteId={display.id}
            fallbackImage={assignedGlimpse.fallbackImage}
            fallbackGradient={display.gradient ?? null}
            livePreviewUrl={assignedGlimpse.livePreviewUrl}
            className="h-full w-full"
          />
          <span className={cn('absolute right-2 top-2', templateBadgeEmeraldClass)}>
            Assigned
          </span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1 p-2">
          <p className="truncate text-sm font-bold text-gray-900" title={display.name}>
            {display.name}
          </p>
          <p className="truncate text-[10px] leading-tight text-gray-500">
            {perStoreAppliedCount === 1
              ? `Assigned to ${formatStoreCode(assignedStores[0])}`
              : `Assigned to ${perStoreAppliedCount} business units`}
          </p>
          <div className={templateCardActionRowClass} data-template-card-action>
            {isPerStoreTemplateMode && assignedToSelectedStore && selectedAssignStoreCode ? (
              <span className={templateCardActivePillClass}>
                <Check className="h-3 w-3 shrink-0" />
                Assigned · {selectedAssignStoreCode}
              </span>
            ) : perStoreAppliedCount > 0 ? (
              <span className={templateCardActivePillClass}>
                <Check className="h-3 w-3 shrink-0" />
                {perStoreAppliedCount} assigned
              </span>
            ) : null}
            {cardViewLiveLinks.length > 0 ? (
              <AppliedTemplateViewLiveButton
                links={cardViewLiveLinks}
                templateName={display.name}
                highlightStoreId={selectedAssignStoreId}
                showLabel
                className="inline-flex h-6 min-w-0 shrink items-center justify-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-[10px] font-bold text-emerald-800 transition-colors hover:border-emerald-300 hover:bg-emerald-100"
              />
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  const onAssignStoreChange = (id: string) => {
    setSelectedAssignStoreId(id)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (id) next.set('store', id)
      else next.delete('store')
      return next
    }, { replace: true })
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-extrabold tracking-tight text-gray-900">
                Business Website Templates
              </h1>
              <p className="text-xs text-gray-600 sm:text-sm">
                {stores.length === 0
                  ? 'Browse layouts and builder sites for your storefront.'
                  : isPerStoreTemplateMode
                    ? selectedAssignStoreCode
                      ? `One template per unit · working on ${selectedAssignStoreCode}.`
                      : 'One template per unit. Select a unit above, then pick below.'
                    : isSingleTemplateMode
                      ? selectedAssignStoreCode
                        ? `One template for all units · working on ${selectedAssignStoreCode}.`
                        : 'One template for all units. Select a unit above, then pick below.'
                      : 'Browse and assign templates to your storefronts.'}
              </p>
            </div>
          </div>
          {stores.length > 0 ? (
            <StorefrontTemplateModeToggle
              mode={storefrontTemplateMode}
              pending={updateVendor.isPending}
              onConfirm={handleSetTemplateMode}
            />
          ) : null}
        </div>

        {stores.length > 0 && (isSingleTemplateMode || isPerStoreTemplateMode) ? (
          <StorefrontCoverage
            mode={storefrontTemplateMode}
            isSingleLinkMode={isSingleLinkMode}
            coverageStores={coverageStores}
            singleTemplate={activeSingleFrontTemplate}
            activeStoreId={selectedAssignStoreId}
            onSelectStore={onAssignStoreChange}
            highlight={isSingleTemplateMode ? singleFrontHighlight : perStoreHighlight}
            innerRef={isSingleTemplateMode ? singleFrontBannerRef : perStoreBannerRef}
            vendorSlug={vendor?.slug}
            templates={templates}
          />
        ) : null}

        <div className="mb-2 rounded-lg border border-gray-200/90 bg-white p-2 dark:border-border dark:bg-card">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <Link
              to="/websites"
              className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-primary/30 bg-white px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/5 sm:text-sm"
            >
              <Globe className="h-3.5 w-3.5" />
              Business Website Builder
              <ChevronRight className="h-3.5 w-3.5 opacity-60" />
            </Link>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                value={templateSearch}
                onChange={e => setTemplateSearch(e.target.value)}
                placeholder="Search templates…"
                className="w-full rounded-lg border border-gray-200 bg-background py-1.5 pl-8 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring dark:border-border"
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

        {(busy) && (
          <div className={TEMPLATE_GRID_CLASS}>
            {Array.from({ length: 8 }).map((_, i) => (
              <TemplateCardSkeleton key={i} />
            ))}
          </div>
        )}
        {!busy && (
          <div className="space-y-1.5">
            {hasLiveSection ? (
              <TemplateGallerySection
                title="Assigned template cards"
                description={
                  isPerStoreTemplateMode && stores.length > 0
                    ? selectedAssignStoreCode
                      ? `Templates linked to your business units — highlighted card = assigned to ${selectedAssignStoreCode}.`
                      : `Templates linked to your ${stores.length} business unit${stores.length === 1 ? '' : 's'} — pick one above.`
                    : isSingleTemplateMode
                      ? 'The template customers see — same design for all business units.'
                      : 'Templates and builder sites assigned to your storefronts.'
                }
              >
                {liveSectionEntries.map(entry => {
                  if (entry.type === 'default') return renderDefaultLayoutCard()
                  if (entry.type === 'builder') return renderBuilderDraftCard(entry.site)
                  if (entry.type === 'resolved') return renderResolvedAssignedCard(entry.display)
                  return renderWebsiteTemplateCard(entry.template)
                })}
              </TemplateGallerySection>
            ) : null}
            {hasDraftSection ? (
              <TemplateGallerySection
                title="Ready to assign"
                description={
                  isSingleTemplateMode
                    ? 'Other published builder sites — pick one below to switch your shared storefront template.'
                    : isPerStoreTemplateMode
                      ? selectedAssignStoreCode
                        ? `Other published builder sites — pick one below to assign or replace the template for ${selectedAssignStoreCode}.`
                        : 'Other published builder sites — select a business unit above, then pick one below.'
                      : 'Published builder sites you can put on your storefront.'
                }
              >
                {draftBuilderDrafts.map(site => renderBuilderDraftCard(site, { previewOnly: true }))}
              </TemplateGallerySection>
            ) : null}
            {hasSystemSection ? (
              <TemplateGallerySection
                title="Starter templates"
                description="Pre-built layouts — apply one to any business unit below."
              >
                {showDefaultInSystem ? renderDefaultLayoutCard() : null}
                {systemWebsiteTemplates.map(renderWebsiteTemplateCard)}
              </TemplateGallerySection>
            ) : null}
          </div>
        )}

        {!busy && visibleTemplateCount === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white/60 px-6 py-12 text-center dark:border-border dark:bg-card/60">
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

        {!busy && visibleTemplateCount > 0 ? (
          <p className="mt-3 pb-1 text-center text-xs font-medium text-muted-foreground">
            {visibleTemplateCount} template
            {visibleTemplateCount === 1 ? '' : 's'}
            {templateCategory !== 'all' ? ` in ${formatCategoryLabel(templateCategory)}` : ''}
          </p>
        ) : null}
      </div>

      <StoreThemeCustomizerDialog open={customizeOpen} onClose={() => setCustomizeOpen(false)} />

      {assignBuilderSite ? (
        <StoreTemplatePicker
          templateName={assignBuilderSite.name}
          stores={builderSitePickerStores}
          primaryStoreId={selectedAssignStoreId}
          pending={assignBuilderSiteToStore.isPending}
          lockedToStore={builderSitePickerLocked}
          onClose={() => setAssignBuilderSite(null)}
          onPrimaryStoreChange={onAssignStoreChange}
          onConfirm={storeIds =>
            assignBuilderSiteToStore.mutate({
              siteId: assignBuilderSite.id,
              storeIds,
              siteName: assignBuilderSite.name,
            })
          }
        />
      ) : null}

      {assignTemplate ? (
        <StoreTemplatePicker
          key={`${assignTemplate.id}-${selectedAssignStoreId ?? 'none'}`}
          templateName={assignTemplate.name}
          stores={pickerStores}
          primaryStoreId={selectedAssignStoreId}
          pending={assignTemplateToStores.isPending}
          onClose={() => setAssignTemplate(null)}
          onPrimaryStoreChange={onAssignStoreChange}
          onConfirm={storeIds =>
            assignTemplateToStores.mutate({
              templateId: assignTemplate.id,
              storeIds,
              templateName: assignTemplate.name,
            })
          }
        />
      ) : null}

      {viewLivePicker ? (
        <ViewLiveLinksPickerModal
          open
          templateName={viewLivePicker.templateName}
          links={viewLivePicker.links}
          highlightStoreId={selectedAssignStoreId}
          onClose={() => setViewLivePicker(null)}
        />
      ) : null}

      <UseForAllStoresConfirmModal
        pending={useForAllConfirm}
        currentTemplateName={activeSingleFrontTemplate?.name ?? null}
        storeCount={stores.length}
        applying={updateVendor.isPending}
        onClose={() => setUseForAllConfirm(null)}
        onConfirm={() => {
          if (useForAllConfirm) handleUseForAllStores(useForAllConfirm.id)
        }}
      />

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
