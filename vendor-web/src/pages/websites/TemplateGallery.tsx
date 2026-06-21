import { useMemo, useState, useEffect, useLayoutEffect, useRef, useCallback, Fragment, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles, Search, Globe, ChevronRight, ChevronDown, Check, Store, Eye, LayoutTemplate, X, AlertTriangle, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSiteList, useWebsiteTemplates } from '@/hooks/useWebsites'
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
import {
  assignBuilderSiteToStores,
  assignCatalogTemplateToStores,
  isBuilderSiteAssignedToStore,
  isBuilderSiteVisibleForStore,
  isStoreSpecificCatalogTemplateAssigned,
  listBuilderDraftTemplateSites,
  resolveBuilderSiteHomeStoreId,
  storesAssignedToBuilderSite,
  storesEligibleForBuilderSiteAssignment,
  resolveBuilderSiteLiveBlockReason,
  resolveBuilderSiteViewLiveLinks,
  resolveStorefrontCoverageTemplate,
  storesEffectivelyAssignedToBuilderSite,
} from '@/lib/builderDraftTemplateSites'
import {
  customerLinkForStore,
  resolveAppliedTemplateViewLiveLinks,
  resolveSingleFrontTemplateId,
  resolveStorefrontLinkMode,
  resolveStorefrontTemplateMode,
  resolveStoreFrontTemplateId,
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
  type ThemePresetSummary,
} from '@/lib/businessFrontActiveTemplate'
import { storesAssignedToTemplate, storesUsingBuilderSiteDesign } from '@/lib/websiteTemplateAssignment'
import {
  perStoreTemplateActionLabel,
  templateBadgeEmeraldClass,
  templateBadgeVioletClass,
  templateCardActionBtnClass,
  templateCardActionClusterClass,
  templateCardActionRowClass,
  templateCardActivePillClass,
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
  if (cat === 'website_builder') return 'Website Builder'
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
      <div className="space-y-2 p-2.5">
        <div className="h-3.5 w-1/2 animate-pulse rounded bg-gray-200" />
        <div className="h-2.5 w-full animate-pulse rounded bg-gray-100" />
        <div className="flex justify-end gap-1.5 pt-0.5">
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
    <section className="mb-3 last:mb-0">
      <div
        className={cn(
          'mb-1.5',
          description ? 'flex flex-wrap items-baseline gap-x-2 gap-y-0.5' : undefined,
        )}
      >
        <h2 className="shrink-0 text-xs font-bold uppercase tracking-wide text-muted-foreground sm:text-sm">
          {title}
        </h2>
        {description ? (
          <p className="min-w-0 text-xs leading-snug text-muted-foreground/80 sm:text-sm">{description}</p>
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
  linkedSite: SiteListItem | undefined,
  template: ResolvedTemplateDisplay | null,
  status: CoverageAssignmentStatus,
  previewContext?: CoveragePreviewContext,
): { siteId: string | null; livePreviewUrl: string | null } {
  if (linkedSite?.id) {
    const liveUrl = previewContext?.vendorSlug
      ? customerLinkForStore(
          previewContext.vendorSlug,
          store,
          previewContext.linkMode ?? 'single',
          previewContext.templateMode,
        )
      : null
    return { siteId: linkedSite.id, livePreviewUrl: liveUrl }
  }

  if (template && status !== 'unassigned') {
    return {
      siteId: null,
      livePreviewUrl: wrapStorefrontPreviewForVendorBrowser(
        getStorefrontTemplateBrowserPreviewUrl(template.id),
      ),
    }
  }

  return { siteId: null, livePreviewUrl: null }
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

  if (linkedSite && !isStoreSpecificCatalogTemplateAssigned(store, vendorSettings)) {
    const name = resolveSiteAppliedTemplateLabel(linkedSite, templates) ?? linkedSite.name
    const template = {
      id: linkedSite.id,
      name,
      description: linkedSite.description ?? undefined,
      thumbnail: resolveSiteStaticThumbnail(linkedSite, templates),
    }
    return {
      status: 'live_builder',
      template,
      ...buildCoveragePreviewMeta(store, linkedSite, template, 'live_builder', previewContext),
    }
  }

  const catalogTemplate = resolveStorefrontCoverageTemplate(
    store,
    sites,
    templates,
    presets,
    vendorSettings,
    { publishedBuilderOnly: false },
  )
  if (catalogTemplate) {
    const catalogSite = sites.find(s => s.id === catalogTemplate.id)
    return {
      status: 'catalog_assigned',
      template: catalogTemplate,
      siteId: catalogSite?.id ?? null,
      ...buildCoveragePreviewMeta(store, linkedSite ?? catalogSite, catalogTemplate, 'catalog_assigned', previewContext),
    }
  }

  if (linkedSite) {
    const name = resolveSiteAppliedTemplateLabel(linkedSite, templates) ?? linkedSite.name
    const template = {
      id: linkedSite.id,
      name,
      description: linkedSite.description ?? undefined,
      thumbnail: resolveSiteStaticThumbnail(linkedSite, templates),
    }
    return {
      status: 'catalog_assigned',
      template,
      ...buildCoveragePreviewMeta(store, linkedSite, template, 'catalog_assigned', previewContext),
    }
  }

  return {
    status: 'unassigned',
    template: null,
    siteId: null,
    livePreviewUrl: null,
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

function CurrentForStoreRibbon({ storeCode }: { storeCode: string }) {
  return (
    <span className={templateCardCurrentForStoreRibbonClass}>
      Current for {storeCode}
    </span>
  )
}

function resolveActiveTemplateCoveragePreview(
  templateId: string | null | undefined,
  sites: SiteListItem[],
  templates: WebsiteTemplate[],
  presets: ThemePresetSummary[],
): {
  template: ResolvedTemplateDisplay | null
  siteId: string | null
} {
  const base = resolveTemplateDisplay(templateId, templates, presets, sites)
  if (!base) return { template: null, siteId: null }

  const tid = templateId?.trim()
  if (!tid) return { template: null, siteId: null }

  const catalogTpl = templates.find(t => t.id === tid)
  if (catalogTpl) {
    return {
      template: { ...base, thumbnail: catalogTpl.thumbnail ?? base.thumbnail ?? null },
      siteId: null,
    }
  }

  const site = sites.find(s => s.id === tid)
  if (site) {
    return {
      template: {
        ...base,
        thumbnail: resolveSiteStaticThumbnail(site, templates),
      },
      siteId: site.id,
    }
  }

  return { template: base, siteId: null }
}

function CoverageThumb({
  template,
  siteId = null,
  vendorSlug = null,
  templates = [],
  className,
}: {
  template: ResolvedTemplateDisplay | null
  siteId?: string | null
  vendorSlug?: string | null
  templates?: WebsiteTemplate[]
  className?: string
}) {
  return (
    <span className={cn('h-9 w-12 shrink-0 overflow-hidden rounded-md border border-black/5 bg-white', className)}>
      <WebsiteSiteGlimpse
        siteId={siteId}
        vendorSlug={vendorSlug}
        fallbackImage={template?.thumbnail}
        fallbackGradient={template?.gradient}
        templates={templates}
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
  return (
    <button
      type="button"
      onClick={onSelect}
      title={
        hasAssignment
          ? `${store.code} · ${store.name} → ${store.template?.name} (${coverageStatusLabel(store.status)})`
          : `${store.code} · ${store.name} — no template assigned`
      }
      className={cn(
        'relative flex w-full min-w-0 items-center gap-1.5 overflow-hidden rounded-md border px-1.5 py-1 text-left transition-colors',
        active
          ? coverageStoreSelectedClass
          : hasAssignment
            ? 'border-gray-200 bg-white hover:border-gray-300'
            : 'border-gray-200 bg-white hover:border-gray-300',
      )}
    >
      <CoverageThumb
        template={store.template}
        siteId={store.siteId}
        vendorSlug={vendorSlug}
        templates={templates}
      />
      <span className="min-w-0 flex-1 overflow-hidden">
        <span className="flex min-w-0 items-center gap-1">
          <span
            className={cn(
              'truncate font-mono text-[10px] font-bold tracking-wide',
              active ? 'text-primary' : 'text-gray-800',
            )}
            title={store.code}
          >
            {store.code}
          </span>
          {store.is_default ? (
            <span className="shrink-0 rounded bg-gray-100 px-0.5 text-[7px] font-bold uppercase leading-none text-gray-500">
              DEF
            </span>
          ) : null}
        </span>
        {hasAssignment ? (
          <span
            className="block truncate text-[10px] font-semibold leading-tight text-gray-700"
            title={store.template?.name}
          >
            {store.template?.name}
          </span>
        ) : (
          <span className="block truncate text-[10px] font-medium text-gray-500">No template</span>
        )}
      </span>
    </button>
  )
}

/** Inline step hint: Step A → Step B → action */
function CoverageStepHint({
  steps,
  className,
  title,
}: {
  steps: ReactNode[]
  className?: string
  title?: string
}) {
  return (
    <span
      className={cn('inline-flex flex-wrap items-center gap-0.5 text-[10px] leading-snug text-gray-500', className)}
      title={title}
    >
      {steps.map((step, index) => (
        <Fragment key={index}>
          {index > 0 ? (
            <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" aria-hidden />
          ) : null}
          <span>{step}</span>
        </Fragment>
      ))}
    </span>
  )
}

/** Compact per-store / shared template assignment overview. */
function StorefrontCoverage({
  mode,
  isSingleLinkMode,
  coverageStores,
  singleTemplate,
  singleTemplateSiteId = null,
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
  singleTemplateSiteId?: string | null
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

  return (
    <div
      ref={innerRef}
      className={cn(
        'mb-1.5 rounded-lg border border-gray-200/90 bg-white p-1.5 shadow-sm dark:border-border dark:bg-card',
        highlight && 'border-l-2 border-l-primary',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <h2 className="inline-flex items-center gap-1 text-xs font-bold text-gray-900">
            <Store className="h-3 w-3 text-primary" />
            Storefront coverage
          </h2>
          <span className="rounded bg-gray-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-gray-600">
            {isSingle ? 'One for all' : 'Per BU'}
          </span>
          {!isSingle && unassignedCount > 0 ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700">
              <AlertTriangle className="h-2.5 w-2.5" />
              {unassignedCount} need template
            </span>
          ) : null}
        </div>
        <Link
          to="/settings"
          className="shrink-0 text-[10px] font-medium text-blue-600 underline decoration-blue-600/70 underline-offset-2 hover:text-blue-800 hover:decoration-blue-800 visited:text-blue-700"
        >
          {isSingleLinkMode ? 'Shared URL' : 'Per-unit URLs'} · settings
        </Link>
      </div>

      {!isSingle && activeStore ? (
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 rounded-md border-2 border-primary/30 bg-primary/[0.05] px-2 py-1 ring-1 ring-primary/20">
          <p className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate text-[11px] leading-snug text-gray-700">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
            <span className="min-w-0 truncate">
              <span className="font-bold text-gray-900">{activeStore.code}</span>
              <span className="text-gray-400"> · </span>
              <span className="font-medium text-gray-800">{activeStore.name}</span>
              {activeStore.template ? (
                <>
                  <span className="text-gray-400"> → </span>
                  <span className="font-semibold text-gray-900">{activeStore.template.name}</span>
                  <span className={cn('ml-1.5 inline-flex rounded-full px-1.5 py-px text-[9px] font-semibold', coverageStatusBadgeClass(activeStore.status))}>
                    {activeStore.status === 'live_builder' ? 'Live' : 'Assigned'}
                  </span>
                </>
              ) : (
                <span className="font-medium text-amber-700"> — no template yet</span>
              )}
            </span>
          </p>
          <CoverageStepHint
            title="Follow these steps in the template gallery below"
            steps={
              activeStore.template
                ? [
                    'Switch template',
                    'Pick one below',
                    <span key="action" className="font-semibold text-gray-700">Manage · {activeStore.code}</span>,
                  ]
                : [
                    'Assign template',
                    'Pick one below',
                    <span key="action" className="font-semibold text-gray-700">Assign · {activeStore.code}</span>,
                  ]
            }
          />
        </div>
      ) : null}

      {isSingle ? (
        singleTemplate ? (
          <div className="mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5">
              <CoverageThumb
                template={singleTemplate}
                siteId={singleTemplateSiteId}
                vendorSlug={vendorSlug}
                templates={templates}
              />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <span className="truncate text-xs font-bold text-gray-900">{singleTemplate.name}</span>
                  <span className="rounded bg-gray-100 px-1.5 py-px text-[9px] font-semibold text-gray-600">
                    All {total} unit{total === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-gray-500">
                  Shared live template for every business unit
                </p>
              </div>
              <CoverageStepHint
                className="hidden sm:inline-flex"
                steps={[
                  'Shared template',
                  'Pick one below',
                  <span key="action" className="font-semibold text-gray-700">Use for all stores</span>,
                ]}
              />
            </div>
          </div>
        ) : (
          <div className="mt-1 flex items-center gap-2 rounded-md border border-dashed border-gray-300 bg-white px-2 py-1.5">
            <CoverageThumb template={null} vendorSlug={vendorSlug} templates={templates} />
            <p className="min-w-0 flex-1 text-[11px] text-amber-800">
              No template — use <span className="font-semibold">Use for all stores</span> below
            </p>
          </div>
        )
      ) : (
        <div className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
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
      if (links.length === 0) return
      if (links.length === 1) {
        window.open(links[0].href, '_blank', 'noopener,noreferrer')
        return
      }
      setViewLivePicker({
        templateName,
        links,
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
      const freshSites = (queryClient.getQueryData(['websites']) as SiteListItem[] | undefined) ?? (sites as SiteListItem[])
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
          ? `Website Builder site linked to ${vars.storeIds.length} business units`
          : 'Website Builder site linked to business unit',
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
    onError: () => toast.error('Could not link draft site to business units'),
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

  const activeSingleFrontTemplate = useMemo(
    () => resolveTemplateDisplay(singleFrontTemplateId, templates, legacyPresets, mainSites),
    [legacyPresets, singleFrontTemplateId, templates, mainSites],
  )

  const activeSingleFrontCoveragePreview = useMemo(
    () => resolveActiveTemplateCoveragePreview(singleFrontTemplateId, mainSites, templates, legacyPresets),
    [singleFrontTemplateId, mainSites, templates, legacyPresets],
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
        }
      }),
    [stores, mainSites, templates, legacyPresets, vendor?.settings, coveragePreviewContext],
  )

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
    if (!isPerStoreTemplateMode || !selectedAssignStoreId) return
    const frame = requestAnimationFrame(() => {
      document
        .querySelector('[data-current-for-selected-store="true"]')
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
    return () => cancelAnimationFrame(frame)
  }, [isPerStoreTemplateMode, selectedAssignStoreId])

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
    (templateId: string) =>
      storesAssignedToTemplate(stores, templateId, { sites: mainSites }).length,
    [stores, mainSites],
  )

  const isDefaultLayoutLive = useMemo(() => {
    if (!lightPreset) return false
    if (isSingleTemplateMode && singleFrontTemplateId === lightPreset.id) return true
    if (isPerStoreTemplateMode && storesUsingTemplate(lightPreset.id) > 0) return true
    const active = resolveBusinessFrontActiveTemplate(themeConfig?.template, legacyPresets, sites)
    return isLegacyPresetActive(active, lightPreset.id)
  }, [
    lightPreset,
    isSingleTemplateMode,
    singleFrontTemplateId,
    isPerStoreTemplateMode,
    storesUsingTemplate,
    themeConfig?.template,
    legacyPresets,
    sites,
  ])

  const isWebsiteTemplateLive = useCallback(
    (tpl: WebsiteTemplate) => {
      const viewLiveLinks = resolveAppliedTemplateViewLiveLinks(vendor?.slug, storefrontLinkMode, {
        templateId: tpl.id,
        templateMode: storefrontTemplateMode,
        singleFrontTemplateId,
        stores,
        builderSites: mainSites,
      })
      const isSingleTemplateSelected = singleFrontTemplateId === tpl.id
      const perStoreAppliedCount = storesAssignedToTemplate(stores, tpl.id, { sites: mainSites }).length
      return viewLiveLinks.length > 0
        || (isSingleTemplateMode && isSingleTemplateSelected)
        || (isPerStoreTemplateMode && perStoreAppliedCount > 0)
    },
    [
      vendor?.slug,
      storefrontLinkMode,
      storefrontTemplateMode,
      singleFrontTemplateId,
      stores,
      mainSites,
      isSingleTemplateMode,
      isPerStoreTemplateMode,
    ],
  )

  const {
    liveBuilderDrafts,
    draftBuilderDrafts,
    liveWebsiteTemplates,
    systemWebsiteTemplates,
  } = useMemo(() => {
    const liveBD: SiteListItem[] = []
    const draftBD: SiteListItem[] = []
    for (const site of storeScopedBuilderDrafts) {
      const isActiveSingleTemplate = isSingleTemplateMode && singleFrontTemplateId === site.id
      if (isBuilderSiteAssignedToStore(mainSites, site.id, stores) || isActiveSingleTemplate) {
        liveBD.push(site)
      } else {
        draftBD.push(site)
      }
    }
    const liveTpl: WebsiteTemplate[] = []
    const systemTpl: WebsiteTemplate[] = []
    for (const tpl of filteredTemplates) {
      if (isWebsiteTemplateLive(tpl)) liveTpl.push(tpl)
      else systemTpl.push(tpl)
    }
    const sortBySelectedBu = (a: WebsiteTemplate, b: WebsiteTemplate) => {
      if (!isPerStoreTemplateMode || !selectedAssignStoreId) {
        return (a.name || '').localeCompare(b.name || '')
      }
      const aAssigned = storesAssignedToTemplate(stores, a.id, { sites: mainSites })
        .some(s => s.id === selectedAssignStoreId)
      const bAssigned = storesAssignedToTemplate(stores, b.id, { sites: mainSites })
        .some(s => s.id === selectedAssignStoreId)
      if (aAssigned !== bAssigned) return aAssigned ? -1 : 1
      return (a.name || '').localeCompare(b.name || '')
    }
    liveTpl.sort(sortBySelectedBu)
    const sortBuilderBySelectedBu = (a: SiteListItem, b: SiteListItem) => {
      if (!isPerStoreTemplateMode || !selectedAssignStoreId) {
        return (a.name || '').localeCompare(b.name || '')
      }
      const aAssigned = storesEffectivelyAssignedToBuilderSite(mainSites, a.id, stores, vendor?.settings)
        .some(s => s.id === selectedAssignStoreId)
        || storesAssignedToBuilderSite(mainSites, a.id, stores).some(s => s.id === selectedAssignStoreId)
      const bAssigned = storesEffectivelyAssignedToBuilderSite(mainSites, b.id, stores, vendor?.settings)
        .some(s => s.id === selectedAssignStoreId)
        || storesAssignedToBuilderSite(mainSites, b.id, stores).some(s => s.id === selectedAssignStoreId)
      if (aAssigned !== bAssigned) return aAssigned ? -1 : 1
      return (a.name || '').localeCompare(b.name || '')
    }
    liveBD.sort(sortBuilderBySelectedBu)
    return {
      liveBuilderDrafts: liveBD,
      draftBuilderDrafts: draftBD,
      liveWebsiteTemplates: liveTpl,
      systemWebsiteTemplates: systemTpl,
    }
  }, [
    storeScopedBuilderDrafts,
    filteredTemplates,
    mainSites,
    stores,
    vendor?.settings,
    isWebsiteTemplateLive,
    isPerStoreTemplateMode,
    isSingleTemplateMode,
    singleFrontTemplateId,
    selectedAssignStoreId,
  ])

  const showDefaultInLive = showDefaultLayoutCard && Boolean(lightPreset) && isDefaultLayoutLive
  const showDefaultInSystem = showDefaultLayoutCard && Boolean(lightPreset) && !isDefaultLayoutLive

  const defaultAssignedToSelectedStore = useMemo(() => {
    if (!lightPreset || !selectedAssignStoreId) return false
    return storesAssignedToTemplate(stores, lightPreset.id, { sites: mainSites })
      .some(s => s.id === selectedAssignStoreId)
  }, [lightPreset, selectedAssignStoreId, stores, mainSites])

  type LiveSectionEntry =
    | { type: 'default' }
    | { type: 'builder'; site: SiteListItem }
    | { type: 'catalog'; template: WebsiteTemplate }

  const liveSectionEntries = useMemo((): LiveSectionEntry[] => {
    const entries: Array<LiveSectionEntry & { assignedToSelected: boolean; name: string }> = []

    if (showDefaultInLive) {
      entries.push({
        type: 'default',
        assignedToSelected: defaultAssignedToSelectedStore,
        name: lightPreset?.name ?? 'Default layout',
      })
    }

    for (const site of liveBuilderDrafts) {
      const assignedToSelected = Boolean(
        selectedAssignStoreId
        && storesUsingBuilderSiteDesign(mainSites, site.id, stores).some(s => s.id === selectedAssignStoreId),
      )
      entries.push({
        type: 'builder',
        site,
        assignedToSelected,
        name: site.name ?? '',
      })
    }

    for (const tpl of liveWebsiteTemplates) {
      const assignedToSelected = Boolean(
        selectedAssignStoreId
        && storesAssignedToTemplate(stores, tpl.id, { sites: mainSites }).some(s => s.id === selectedAssignStoreId),
      )
      entries.push({
        type: 'catalog',
        template: tpl,
        assignedToSelected,
        name: tpl.name ?? '',
      })
    }

    entries.sort((a, b) => {
      if (isPerStoreTemplateMode && selectedAssignStoreId && a.assignedToSelected !== b.assignedToSelected) {
        return a.assignedToSelected ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })

    return entries.map(({ assignedToSelected: _assignedToSelected, name: _name, ...entry }) => entry)
  }, [
    showDefaultInLive,
    defaultAssignedToSelectedStore,
    lightPreset?.name,
    liveBuilderDrafts,
    liveWebsiteTemplates,
    mainSites,
    stores,
    isPerStoreTemplateMode,
    selectedAssignStoreId,
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

  const renderBuilderDraftCard = (site: SiteListItem) => {
    const linkedStores = storesAssignedToBuilderSite(mainSites, site.id, stores)
    const allAssignedStores = storesUsingBuilderSiteDesign(mainSites, site.id, stores)
    const perStoreAppliedCount = allAssignedStores.length
    const linkedStoreNames = linkedStores.map(s => s.name ?? '')
    const homeStoreId = resolveBuilderSiteHomeStoreId(site)
    const linkedToSelectedStore = Boolean(
      selectedAssignStoreId && linkedStores.some(s => s.id === selectedAssignStoreId),
    )
    const assignedToSelectedStore = Boolean(
      selectedAssignStoreId && allAssignedStores.some(s => s.id === selectedAssignStoreId),
    )
    const catalogOnlyOnSelected = Boolean(
      selectedAssignStoreId
      && allAssignedStores.some(s => s.id === selectedAssignStoreId)
      && !linkedStores.some(s => s.id === selectedAssignStoreId),
    )
    const showAssignHighlight = isPerStoreTemplateMode && (linkedToSelectedStore || assignedToSelectedStore)
    const isSingleTemplateSelected = singleFrontTemplateId === site.id
    const viewLiveLinks = resolveBuilderSiteViewLiveLinks(
      vendor?.slug,
      storefrontLinkMode,
      mainSites,
      site.id,
      stores,
      vendor?.settings,
    )
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
        assignedStoreNames={allAssignedStores.map(s => s.name ?? '')}
        liveBlockReason={liveBlockReason}
        viewLiveLinks={viewLiveLinks}
        showAssignHighlight={showAssignHighlight || (isSingleTemplateMode && isSingleTemplateSelected)}
        perStoreTemplateMode={isPerStoreTemplateMode}
        singleTemplateMode={isSingleTemplateMode}
        isSingleTemplateSelected={isSingleTemplateSelected}
        onUseForAllStores={
          isSingleTemplateMode
            ? () => requestUseForAllStores(site.id, site.name)
            : undefined
        }
        useForAllStoresPending={updateVendor.isPending}
        onAssign={
          isPerStoreTemplateMode
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

                // Built for one BU but apply the same design to another via catalog template id.
                if (homeStoreId && homeStoreId !== targetStoreId) {
                  assignTemplateToStores.mutate({
                    templateId: site.id,
                    storeIds: [targetStoreId],
                    templateName: site.name,
                  })
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
        linkedToContextStore={linkedToSelectedStore}
        appliedToContextStore={assignedToSelectedStore}
      />
    )
  }

  const renderWebsiteTemplateCard = (tpl: WebsiteTemplate) => {
    const pageCount = tpl.page_count ?? tpl.pages?.length ?? 0
    const tier = tpl.tier || (pageCount >= 6 ? 'full' : 'lite')
    const palette = getTemplatePreviewPalette(tpl)
    const isSingleTemplateSelected = singleFrontTemplateId === tpl.id
    const assignedStores = storesAssignedToTemplate(stores, tpl.id, { sites: mainSites })
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
    const isLiveForSelectedStore = Boolean(
      assignedToSelectedStore
      && selectedAssignStoreId
      && viewLiveLinks.some(link => link.storeId === selectedAssignStoreId),
    )
    const showAssignHighlight = (isSingleTemplateMode && isSingleTemplateSelected)
      || (isPerStoreTemplateMode && assignedToSelectedStore)
    const perStoreStatusLabel = isPerStoreTemplateMode && selectedAssignStoreCode
      ? assignedToSelectedStore
        ? isLiveForSelectedStore
          ? `Live · ${selectedAssignStoreCode}`
          : `Assigned · ${selectedAssignStoreCode}`
        : perStoreAppliedCount > 0
          ? `${perStoreAppliedCount} other BU${perStoreAppliedCount === 1 ? '' : 's'}`
          : 'Unused'
      : perStoreAppliedCount > 0
        ? `${perStoreAppliedCount} live`
        : 'Unused'
    const perStoreStatusTitle = isPerStoreTemplateMode && selectedAssignStoreCode
      ? assignedToSelectedStore
        ? `Assigned to ${selectedAssignStoreCode}`
        : perStoreAppliedCount > 0
          ? `Assigned to ${assignedStores.map(s => formatStoreCode(s)).join(', ')}, not ${selectedAssignStoreCode}`
          : `Not assigned to ${selectedAssignStoreCode}`
      : assignedStores.map(s => `${formatStoreCode(s)} · ${s.name}`).join(', ')
    const perStoreBadgeLabel = isPerStoreTemplateMode && assignedToSelectedStore && selectedAssignStoreCode
      ? selectedAssignStoreCode
      : perStoreAppliedCount === 1
        ? formatStoreCode(assignedStores[0])
        : `${perStoreAppliedCount} BUs / Stores`
    const isLiveOnStorefront = viewLiveLinks.length > 0
    const multipleLiveStores = viewLiveLinks.length > 1
    const showTopAssignmentBadge = !(
      (isSingleTemplateMode && isSingleTemplateSelected)
      || (isPerStoreTemplateMode && assignedToSelectedStore)
    )
    return (
      <div
        key={tpl.id}
        title={
          multipleLiveStores
            ? `View live site — pick from ${viewLiveLinks.length} business units`
            : isLiveOnStorefront
              ? `View live site for ${tpl.name}`
              : `Preview ${tpl.name}`
        }
        onClick={e => handleTemplateCardSurfaceClick(e, tpl.id, viewLiveLinks, tpl.name)}
        data-current-for-selected-store={assignedToSelectedStore ? 'true' : undefined}
        className={cn(
          templateCardShellClass,
          showAssignHighlight && isSingleTemplateMode && templateCardSelectedClass,
          showAssignHighlight && isPerStoreTemplateMode && templateCardSelectedClass,
        )}
      >
        <div className="relative overflow-hidden">
          {isPerStoreTemplateMode && assignedToSelectedStore && selectedAssignStoreCode ? (
            <CurrentForStoreRibbon storeCode={selectedAssignStoreCode} />
          ) : null}
          {tpl.thumbnail ? (
            <img src={tpl.thumbnail} className={cn(templateCardMediaHeightClass, 'w-full object-cover transition-transform duration-300 group-hover/card:scale-[1.03]')} alt={tpl.name} loading="lazy" />
          ) : (
            <div className={cn(templateCardMediaHeightClass, 'w-full bg-gradient-to-r from-accent to-primary/20')} />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />
          <div className={templateCardPreviewOverlayClass}>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold text-gray-900 shadow-md">
              {isLiveOnStorefront ? (
                <>
                  <ExternalLink className="h-3 w-3" />
                  {multipleLiveStores ? `View live site (${viewLiveLinks.length})` : 'View live site'}
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
            <span className={cn('absolute right-1.5 top-1.5 max-w-[70%]', templateBadgeVioletClass)} title="All stores">
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
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0 truncate text-sm font-extrabold leading-tight text-gray-900 transition-colors group-hover/card:text-primary">{tpl.name}</div>
            {(isSingleTemplateMode || isPerStoreTemplateMode) ? (
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold',
                  showAssignHighlight
                    ? isSingleTemplateMode
                      ? 'text-violet-700'
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
                        ? 'bg-violet-500'
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
          <p className="line-clamp-2 text-[10px] leading-snug text-gray-500">{tpl.description}</p>
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
                  className={cn(
                    templateCardPrimaryActionClass,
                    'border-violet-200 bg-violet-50/80 text-violet-700 hover:border-violet-300 hover:bg-violet-100',
                  )}
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
                    templateCardPrimaryActionClass,
                    isAppliedToSelected
                      ? 'border-2 border-primary bg-primary/10 text-primary hover:border-primary hover:bg-primary/15'
                      : 'border-emerald-200 bg-emerald-50/80 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100',
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
              {viewLiveLinks.length > 0 ? (
                <AppliedTemplateViewLiveButton
                  links={viewLiveLinks}
                  templateName={tpl.name}
                  highlightStoreId={selectedAssignStoreId}
                />
              ) : null}
              {!isLiveOnStorefront ? (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    openTemplateBrowserPreview(tpl.id)
                  }}
                  className={templateCardIconActionClass}
                  title="Preview template"
                  aria-label="Preview template"
                >
                  <Eye className="h-3 w-3" />
                </button>
              ) : null}
            </div>
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
                Website Templates
              </h1>
              <p className="text-xs text-gray-600 sm:text-sm">
                {stores.length === 0
                  ? 'Browse layouts and builder sites for your storefront.'
                  : isPerStoreTemplateMode
                    ? selectedAssignStoreCode
                      ? `One template per unit · working on ${selectedAssignStoreCode}.`
                      : 'One template per unit. Select a unit above, then pick below.'
                    : isSingleTemplateMode
                      ? 'One template for all units — or pick another below.'
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
            singleTemplate={activeSingleFrontCoveragePreview.template ?? activeSingleFrontTemplate}
            singleTemplateSiteId={activeSingleFrontCoveragePreview.siteId}
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
              Website Builder
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

        {(busy || legacyPresetsBusy) && (
          <div className={TEMPLATE_GRID_CLASS}>
            {Array.from({ length: 8 }).map((_, i) => (
              <TemplateCardSkeleton key={i} />
            ))}
          </div>
        )}
        {!busy && !legacyPresetsBusy && (
          <div className="space-y-1">
            {hasLiveSection ? (
              <TemplateGallerySection
                title="Assigned templates"
                description={
                  isPerStoreTemplateMode && selectedAssignStoreCode
                    ? `Assigned and in use on your live store for ${selectedAssignStoreCode} — bold border = currently active.`
                    : isPerStoreTemplateMode
                      ? 'Templates assigned and in use per business unit — select a unit above to see what is live.'
                      : isSingleTemplateMode
                        ? 'Templates assigned and in use on your live store for all business units.'
                        : 'Templates assigned and in use on your live storefronts.'
                }
              >
                {liveSectionEntries.map(entry => {
                  if (entry.type === 'default') return renderDefaultLayoutCard()
                  if (entry.type === 'builder') return renderBuilderDraftCard(entry.site)
                  return renderWebsiteTemplateCard(entry.template)
                })}
              </TemplateGallerySection>
            ) : null}
            {hasDraftSection ? (
              <TemplateGallerySection
                title="Built websites"
                description={
                  isSingleTemplateMode
                    ? 'Assign your built templates to use for your live store — apply for all units below.'
                    : isPerStoreTemplateMode
                      ? selectedAssignStoreCode
                        ? `Assign your built templates for your live store — pick one for ${selectedAssignStoreCode} below.`
                        : 'Assign your built templates for your live store — select a unit above, then pick below.'
                      : 'Assign your built templates to use for your live store below.'
                }
              >
                {draftBuilderDrafts.map(renderBuilderDraftCard)}
              </TemplateGallerySection>
            ) : null}
            {hasSystemSection ? (
              <TemplateGallerySection
                title="System templates"
                description="Starter layouts and catalog themes — apply below."
              >
                {showDefaultInSystem ? renderDefaultLayoutCard() : null}
                {systemWebsiteTemplates.map(renderWebsiteTemplateCard)}
              </TemplateGallerySection>
            ) : null}
          </div>
        )}

        {!busy && !legacyPresetsBusy && visibleTemplateCount === 0 && (
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

        {!busy && !legacyPresetsBusy && visibleTemplateCount > 0 ? (
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
