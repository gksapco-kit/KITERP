import { useMemo, useState, useEffect, useLayoutEffect, useRef, useCallback, type ReactNode } from 'react'
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
  listBuilderDraftTemplateSites,
  storesAssignedToBuilderSite,
  resolveBuilderSiteLiveBlockReason,
  resolveBuilderSiteViewLiveLinks,
  resolveStorefrontCoverageTemplate,
  storesEffectivelyAssignedToBuilderSite,
} from '@/lib/builderDraftTemplateSites'
import {
  resolveAppliedTemplateViewLiveLinks,
  resolveSingleFrontTemplateId,
  resolveStorefrontLinkMode,
  resolveStorefrontLinksForStoreIds,
  openStorefrontLinks,
  resolveStorefrontTemplateMode,
  resolveStoreFrontTemplateId,
  SINGLE_FRONT_TEMPLATE_KEY,
  STOREFRONT_TEMPLATE_MODE_KEY,
  type StorefrontTemplateMode,
} from '@/lib/liveStorefrontUrl'
import { resolveTemplateDisplay, type ResolvedTemplateDisplay } from '@/lib/websiteAppliedTemplate'
import {
  isLegacyPresetActive,
  resolveBusinessFrontActiveTemplate,
  type ThemePresetSummary,
} from '@/lib/businessFrontActiveTemplate'
import { storesAssignedToTemplate } from '@/lib/websiteTemplateAssignment'
import { templateBadgeEmeraldClass, templateBadgeVioletClass, templateCardActionBtnClass, templateCardBodyClass, templateCardMediaHeightClass, templateCardPreviewOverlayClass, templateCardShellClass } from '@/lib/websiteTemplateBadges'
import { vendorApi } from '@/api/vendor'
import { useVendorStore } from '@/stores/vendorStore'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { formatStoreCode } from '@/lib/verification'
import { isTemplateSandboxSite } from '@/lib/websiteSandbox'

const TEMPLATE_GRID_CLASS = 'grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4'

const formatCategoryLabel = (cat: string) => {
  if (cat === 'all') return 'All'
  if (cat === 'website_builder') return 'Website Builder'
  return cat.charAt(0).toUpperCase() + cat.slice(1)
}

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
}: {
  templateName: string
  stores: PickerStore[]
  primaryStoreId: string | null
  pending?: boolean
  onClose: () => void
  onConfirm: (storeIds: string[]) => void
  onPrimaryStoreChange: (storeId: string) => void
}) {
  const [activePrimaryId, setActivePrimaryId] = useState<string | null>(primaryStoreId)
  const [showOthers, setShowOthers] = useState(!primaryStoreId)
  const [pendingOtherStoreId, setPendingOtherStoreId] = useState<string | null>(null)

  useEffect(() => {
    setActivePrimaryId(primaryStoreId)
    setShowOthers(!primaryStoreId)
    setPendingOtherStoreId(null)
  }, [primaryStoreId, templateName])

  const activePrimaryStore = activePrimaryId ? stores.find(s => s.id === activePrimaryId) ?? null : null
  const otherStores = activePrimaryStore ? stores.filter(s => s.id !== activePrimaryStore.id) : stores
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
                {activePrimaryStore
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
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="mb-5 last:mb-0">
      <h2 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">{title}</h2>
      <div className={TEMPLATE_GRID_CLASS}>{children}</div>
    </section>
  )
}

type CoverageStore = {
  id: string
  name: string
  code: string
  is_default?: boolean
  template: ResolvedTemplateDisplay | null
}

function CoverageThumb({ template }: { template: ResolvedTemplateDisplay | null }) {
  return (
    <span className="h-9 w-12 shrink-0 overflow-hidden rounded-md border border-black/5">
      {template?.thumbnail ? (
        <img src={template.thumbnail} alt="" className="h-full w-full object-cover" />
      ) : (
        <span
          className="block h-full w-full"
          style={{ background: template?.gradient ?? 'linear-gradient(135deg, #e5e7eb, #cbd5e1)' }}
        />
      )}
    </span>
  )
}

function CoverageStoreCard({
  store,
  active,
  onSelect,
}: {
  store: CoverageStore
  active: boolean
  onSelect: () => void
}) {
  const assigned = Boolean(store.template)
  return (
    <button
      type="button"
      onClick={onSelect}
      title={
        assigned
          ? `${store.code} · ${store.name} → ${store.template?.name}`
          : `${store.code} · ${store.name} has no template`
      }
      className={cn(
        'flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-lg border px-2 py-1.5 text-left transition-colors',
        active
          ? 'border-emerald-400 bg-emerald-50/50 ring-1 ring-emerald-200'
          : assigned
            ? 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/40'
            : 'border-amber-200 bg-amber-50/40 hover:border-amber-300',
      )}
    >
      <CoverageThumb template={store.template} />
      <span className="min-w-0 flex-1 overflow-hidden">
        <span className="flex min-w-0 items-center gap-1">
          <span
            className="truncate font-mono text-[11px] font-bold tracking-wide text-gray-800"
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
        <span className="block truncate text-[10px] font-medium text-gray-500" title={store.name}>
          {store.name}
        </span>
        {assigned ? (
          <span
            className="block truncate text-[11px] font-bold leading-tight text-emerald-700"
            title={store.template?.name}
          >
            {store.template?.name}
          </span>
        ) : (
          <span className="inline-flex max-w-full items-center gap-0.5 truncate text-[10px] font-semibold text-amber-700">
            <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
            Not assigned
          </span>
        )}
      </span>
      {assigned ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> : null}
    </button>
  )
}

/** Always-visible "what is each store using right now" panel for both template modes. */
function StorefrontCoverage({
  mode,
  isSingleLinkMode,
  coverageStores,
  singleTemplate,
  activeStoreId,
  onSelectStore,
  highlight,
  innerRef,
}: {
  mode: StorefrontTemplateMode
  isSingleLinkMode: boolean
  coverageStores: CoverageStore[]
  singleTemplate: ResolvedTemplateDisplay | null
  activeStoreId: string | null
  onSelectStore: (id: string) => void
  highlight: boolean
  innerRef: React.RefObject<HTMLDivElement>
}) {
  const isSingle = mode === 'single'
  const total = coverageStores.length
  const unassignedCount = coverageStores.filter(s => !s.template).length

  const alert = isSingle
    ? (!singleTemplate ? 'No template chosen yet' : null)
    : (unassignedCount > 0
        ? `${unassignedCount} ${unassignedCount === 1 ? 'store has' : 'stores have'} no template`
        : null)

  const activeStore = activeStoreId ? coverageStores.find(s => s.id === activeStoreId) : null

  return (
    <div
      ref={innerRef}
      className={cn(
        'mb-3 rounded-xl border bg-white p-2.5 shadow-sm sm:p-3',
        isSingle ? 'border-violet-200/70' : 'border-emerald-200/70',
        highlight && (isSingle ? 'ring-2 ring-violet-200' : 'ring-2 ring-emerald-200'),
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <h2 className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-900">
            <Store className={cn('h-3.5 w-3.5', isSingle ? 'text-violet-600' : 'text-emerald-600')} />
            Storefront coverage
          </h2>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
              isSingle ? 'bg-violet-50 text-violet-700' : 'bg-emerald-50 text-emerald-700',
            )}
          >
            {isSingle ? 'One for all' : 'Per BU'}
          </span>
          {!isSingle && activeStore ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50/80 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
              Target: <span className="font-mono">{activeStore.code}</span>
            </span>
          ) : null}
        </div>
        {alert ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
            <AlertTriangle className="h-3 w-3" />
            {alert}
          </span>
        ) : null}
      </div>

      {isSingle ? (
        <div className="mt-2">
          <div
            className={cn(
              'flex items-center gap-2 rounded-lg border px-2.5 py-1.5',
              singleTemplate ? 'border-violet-200 bg-violet-50/50' : 'border-dashed border-amber-300 bg-amber-50/40',
            )}
          >
            <CoverageThumb template={singleTemplate} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-gray-900">
                {singleTemplate ? singleTemplate.name : 'No template chosen'}
              </p>
              <p className="truncate text-[11px] text-gray-500">
                {singleTemplate
                  ? `Shared by all ${total} business unit${total === 1 ? '' : 's'}`
                  : 'Pick a template below with “Use for all stores”'}
              </p>
            </div>
            {singleTemplate ? <Check className="h-4 w-4 shrink-0 text-violet-600" /> : null}
          </div>
        </div>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {coverageStores.map(store => (
            <CoverageStoreCard
              key={store.id}
              store={store}
              active={store.id === activeStoreId}
              onSelect={() => onSelectStore(store.id)}
            />
          ))}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 border-t border-gray-100 pt-2 text-[10px]">
        <Link
          to="/settings"
          className={cn(
            'font-semibold hover:underline',
            isSingle ? 'text-violet-700' : 'text-emerald-700',
          )}
        >
          Change website link mode
        </Link>
        <span className="text-gray-400">
          {isSingleLinkMode ? 'All units share one customer URL.' : 'Each unit has its own customer URL.'}
        </span>
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

  const openLiveAfterStoreAssign = useCallback(
    (storeIds: string[], templateName: string) => {
      const links = resolveStorefrontLinksForStoreIds(
        vendor?.slug,
        storefrontLinkMode,
        storeIds,
        stores,
      )
      openStorefrontLinks(links, {
        onMultiple: picked => setViewLivePicker({ templateName, links: picked }),
      })
    },
    [vendor?.slug, storefrontLinkMode, stores],
  )

  const assignTemplateToStores = useMutation({
    mutationFn: async ({
      templateId,
      storeIds,
      templateName,
    }: {
      templateId: string
      storeIds: string[]
      templateName: string
    }) => {
      await assignCatalogTemplateToStores({
        templateId,
        storeIds,
        sites: mainSites,
        stores,
      })
      return { templateName }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.stores() })
      queryClient.invalidateQueries({ queryKey: ['websites'] })
      toast.success(
        vars.storeIds.length > 1
          ? `Template applied to ${vars.storeIds.length} business units`
          : 'Template applied — opening live storefront',
      )
      openLiveAfterStoreAssign(vars.storeIds, vars.templateName)
      setAssignTemplate(null)
      setSearchParams(prev => {
        const next = new URLSearchParams(prev)
        next.delete('perStore')
        return next
      }, { replace: true })
    },
    onError: () => toast.error('Could not apply template to business units'),
  })

  const assignBuilderSiteToStore = useMutation({
    mutationFn: async ({
      siteId,
      storeIds,
      siteName,
    }: {
      siteId: string
      storeIds: string[]
      siteName: string
    }) => {
      await assignBuilderSiteToStores({ siteId, storeIds, sites: sites as SiteListItem[], stores })
      return { siteName }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.stores() })
      queryClient.invalidateQueries({ queryKey: ['websites'] })
      queryClient.invalidateQueries({ queryKey: vendorKeys.me() })
      toast.success(
        vars.storeIds.length > 1
          ? `Website Builder site linked to ${vars.storeIds.length} business units`
          : 'Live on storefront — opening your store',
      )
      openLiveAfterStoreAssign(vars.storeIds, vars.siteName)
      setAssignBuilderSite(null)
      setSearchParams(prev => {
        const next = new URLSearchParams(prev)
        next.delete('perStore')
        return next
      }, { replace: true })
    },
    onError: () => toast.error('Could not link draft site to business units'),
  })

  const openStorePicker = useCallback((templateId: string, templateName: string) => {
    setAssignTemplate({ id: templateId, name: templateName })
  }, [])

  const openBuilderSiteStorePicker = useCallback((siteId: string, siteName: string, preferStoreId?: string) => {
    if (preferStoreId) setSelectedAssignStoreId(preferStoreId)
    setAssignBuilderSite({ id: siteId, name: siteName })
  }, [])

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
      if (viewLiveLinks.length > 1) {
        setViewLivePicker({ templateName, links: viewLiveLinks })
        return
      }
      if (viewLiveLinks.length === 1) {
        window.open(viewLiveLinks[0].href, '_blank', 'noopener,noreferrer')
        return
      }
      openTemplateBrowserPreview(templateId)
    },
    [openTemplateBrowserPreview],
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
  const visibleTemplateCount =
    filteredTemplates.length
    + filteredBuilderDrafts.length
    + (showDefaultLayoutCard && lightPreset ? 1 : 0)

  const activeSingleFrontTemplate = useMemo(
    () => resolveTemplateDisplay(singleFrontTemplateId, templates, legacyPresets),
    [legacyPresets, singleFrontTemplateId, templates],
  )

  const coverageStores = useMemo<CoverageStore[]>(
    () =>
      stores.map(store => {
        const template = resolveStorefrontCoverageTemplate(store, mainSites, templates, legacyPresets, vendor?.settings)
        return {
          id: store.id,
          name: store.name,
          code: formatStoreCode(store),
          is_default: store.is_default,
          template,
        }
      }),
    [stores, mainSites, templates, legacyPresets, vendor?.settings],
  )

  const pickerStores = useMemo(
    () =>
      stores.map(store => ({
        id: store.id,
        name: store.name,
        code: formatStoreCode(store),
        is_default: store.is_default,
        currentTemplateName:
          resolveStorefrontCoverageTemplate(store, mainSites, templates, legacyPresets, vendor?.settings)?.name ?? null,
      })),
    [stores, mainSites, templates, legacyPresets, vendor?.settings],
  )

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
    for (const site of filteredBuilderDrafts) {
      if (isBuilderSiteAssignedToStore(mainSites, site.id, stores)) {
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
    return {
      liveBuilderDrafts: liveBD,
      draftBuilderDrafts: draftBD,
      liveWebsiteTemplates: liveTpl,
      systemWebsiteTemplates: systemTpl,
    }
  }, [filteredBuilderDrafts, filteredTemplates, mainSites, stores, isWebsiteTemplateLive])

  const showDefaultInLive = showDefaultLayoutCard && Boolean(lightPreset) && isDefaultLayoutLive
  const showDefaultInSystem = showDefaultLayoutCard && Boolean(lightPreset) && !isDefaultLayoutLive

  const hasLiveSection = showDefaultInLive || liveBuilderDrafts.length > 0 || liveWebsiteTemplates.length > 0
  const hasDraftSection = draftBuilderDrafts.length > 0
  const hasSystemSection = showDefaultInSystem || systemWebsiteTemplates.length > 0

  const renderDefaultLayoutCard = () =>
    lightPreset ? (
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
        assignedStoreNames={storesAssignedToTemplate(stores, lightPreset.id, { sites: mainSites }).map(s => s.name)}
        onApplyForStore={isPerStoreTemplateMode ? id => openStorePicker(id, lightPreset.name) : undefined}
        applyForStorePending={assignTemplateToStores.isPending}
        viewLiveLinks={resolveAppliedTemplateViewLiveLinks(vendor?.slug, storefrontLinkMode, {
          templateId: lightPreset.id,
          templateMode: storefrontTemplateMode,
          singleFrontTemplateId,
          stores,
          builderSites: mainSites,
        })}
      />
    ) : null

  const renderBuilderDraftCard = (site: SiteListItem) => {
    const linkedStores = storesAssignedToBuilderSite(mainSites, site.id, stores)
    const assignedStores = storesEffectivelyAssignedToBuilderSite(
      mainSites,
      site.id,
      stores,
      vendor?.settings,
    )
    const perStoreAppliedCount = assignedStores.length
    const linkedStoreNames = linkedStores.map(s => s.name ?? '')
    const showAssignHighlight = isPerStoreTemplateMode && linkedStores.length > 0
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
      && perStoreAppliedCount === 0
      && liveBlockReason === 'catalog_template_override'
    return (
      <BuilderDraftTemplateCard
        key={`draft-${site.id}`}
        site={site}
        templates={templates}
        vendorSlug={vendor?.slug}
        perStoreAppliedCount={perStoreAppliedCount}
        linkedStoreNames={linkedStoreNames}
        assignedStoreNames={assignedStores.map(s => s.name ?? '')}
        liveBlockReason={liveBlockReason}
        viewLiveLinks={viewLiveLinks}
        showAssignHighlight={showAssignHighlight}
        perStoreTemplateMode={isPerStoreTemplateMode}
        onAssign={
          isPerStoreTemplateMode
            ? () => {
                if (needsActivation && linkedStores.length === 1) {
                  assignBuilderSiteToStore.mutate({
                    siteId: site.id,
                    storeIds: [linkedStores[0].id],
                    siteName: site.name,
                  })
                  return
                }
                openBuilderSiteStorePicker(
                  site.id,
                  site.name,
                  linkedStores.length === 1 ? linkedStores[0].id : undefined,
                )
              }
            : undefined
        }
        assignPending={assignBuilderSiteToStore.isPending}
        onPreview={() => void openBuilderSiteDraftPreview(site.id)}
        onViewLivePicker={links => setViewLivePicker({ templateName: site.name, links })}
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
    const showAssignHighlight = (isSingleTemplateMode && isSingleTemplateSelected)
      || (isPerStoreTemplateMode && perStoreAppliedCount > 0)
    const viewLiveLinks = resolveAppliedTemplateViewLiveLinks(vendor?.slug, storefrontLinkMode, {
      templateId: tpl.id,
      templateMode: storefrontTemplateMode,
      singleFrontTemplateId,
      stores,
      builderSites: mainSites,
    })
    const isLiveOnStorefront = viewLiveLinks.length > 0
    const multipleLiveStores = viewLiveLinks.length > 1
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
        className={cn(
          templateCardShellClass,
          showAssignHighlight && isSingleTemplateMode && 'border-violet-400 ring-2 ring-violet-200',
          showAssignHighlight && isPerStoreTemplateMode && 'border-emerald-400 ring-2 ring-emerald-200',
        )}
      >
        <div className="relative overflow-hidden">
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
          <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1.5">
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
              <span className={cn(
                'shrink-0 rounded-full px-1.5 py-0 text-[9px] font-extrabold uppercase tracking-wide',
                tier === 'full' ? 'bg-accent text-primary' : 'bg-white/80 text-gray-700',
              )}>
                {tier === 'full' ? 'Full site' : 'Lite'}
              </span>
              {tpl.id.startsWith('storefront_') && (
                <span className="shrink-0 rounded-full bg-primary/90 px-1.5 py-0 text-[9px] font-semibold text-white">
                  Storefront
                </span>
              )}
              {(tpl.id === 'atelier' || tpl.id === 'verde' || tpl.id === 'solace') && (
                <span className="shrink-0 rounded-full bg-amber-600/90 px-1.5 py-0 text-[9px] font-semibold text-white">
                  Editorial
                </span>
              )}
              <span className="shrink-0 rounded-full bg-white/80 px-1.5 py-0 text-[9px] font-semibold text-gray-700">
                {pageCount} pg
              </span>
            </div>
            <span className="inline-flex shrink-0 -space-x-1">
              {palette.slice(0, 5).map((c, i) => (
                <span key={`${c}-${i}`} className="h-3 w-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: c }} />
              ))}
            </span>
          </div>
        </div>
        <div className={templateCardBodyClass}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 truncate text-sm font-extrabold text-gray-900 transition-colors group-hover/card:text-primary">{tpl.name}</div>
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
                title={isPerStoreTemplateMode && perStoreAppliedCount > 0 ? assignedStores.map(s => s.name).join(', ') : undefined}
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
                  : perStoreAppliedCount > 0
                    ? `${perStoreAppliedCount} live`
                    : 'Unused'}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-gray-500">{tpl.description}</p>
          <div className="mt-1.5 flex flex-wrap items-center justify-end gap-1.5" data-template-card-action>
            <div className="inline-flex items-center gap-1">
              {isSingleTemplateMode ? (
                <button
                  type="button"
                  disabled={isSingleTemplateSelected || updateVendor.isPending}
                  onClick={() => requestUseForAllStores(tpl.id, tpl.name)}
                  className={cn(
                    templateCardActionBtnClass,
                    isSingleTemplateSelected
                      ? 'cursor-default border-violet-200 bg-violet-50 text-violet-600'
                      : 'border-violet-200 bg-violet-50/80 text-violet-700 hover:border-violet-300 hover:bg-violet-100',
                  )}
                >
                  {isSingleTemplateSelected ? <Check className="h-3 w-3" /> : <Store className="h-3 w-3" />}
                  {isSingleTemplateSelected ? 'Applied' : 'All stores'}
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
                      templateCardActionBtnClass,
                      isApplied
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:border-emerald-300 hover:bg-emerald-100'
                        : 'border-emerald-200 bg-emerald-50/80 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100',
                    )}
                  >
                    {isApplied ? <Check className="h-3 w-3" /> : <Store className="h-3 w-3" />}
                    {isApplied ? 'Manage' : 'Assign'}
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
                    templateCardActionBtnClass,
                    selectedSiteId
                      ? 'border-transparent bg-primary text-white hover:opacity-90'
                      : 'cursor-not-allowed border-gray-200 bg-gray-200 text-gray-400',
                  )}
                >
                  <LayoutTemplate className="h-3 w-3" />
                  Apply
                </button>
              ) : null}
              {viewLiveLinks.length > 0 ? (
                <AppliedTemplateViewLiveButton links={viewLiveLinks} templateName={tpl.name} />
              ) : null}
              {!isLiveOnStorefront ? (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    openTemplateBrowserPreview(tpl.id)
                  }}
                  className={templateCardIconActionClass}
                  title="Preview draft template"
                  aria-label="Preview draft template"
                >
                  <Eye className="h-3.5 w-3.5" />
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
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-accent/70 to-gray-50/80">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-extrabold tracking-tight text-gray-900">
                Website Templates
              </h1>
              <p className="text-xs text-gray-600 sm:text-sm">
                Choose a layout or apply full-site Website Builder templates.
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
          />
        ) : null}

        <div className="mb-3 rounded-xl border border-gray-200/80 bg-white p-2.5 shadow-sm sm:p-3">
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
                className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
          <p className="mb-2 text-xs font-medium text-gray-500">
            {visibleTemplateCount} template
            {visibleTemplateCount === 1 ? '' : 's'}
            {templateCategory !== 'all' ? ` in ${formatCategoryLabel(templateCategory)}` : ''}
          </p>
        ) : null}

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
              <TemplateGallerySection title="Live on storefront">
                {showDefaultInLive ? renderDefaultLayoutCard() : null}
                {liveBuilderDrafts.map(renderBuilderDraftCard)}
                {liveWebsiteTemplates.map(renderWebsiteTemplateCard)}
              </TemplateGallerySection>
            ) : null}
            {hasDraftSection ? (
              <TemplateGallerySection title="Drafts">
                {draftBuilderDrafts.map(renderBuilderDraftCard)}
              </TemplateGallerySection>
            ) : null}
            {hasSystemSection ? (
              <TemplateGallerySection title="System templates">
                {showDefaultInSystem ? renderDefaultLayoutCard() : null}
                {systemWebsiteTemplates.map(renderWebsiteTemplateCard)}
              </TemplateGallerySection>
            ) : null}
          </div>
        )}

        {!busy && !legacyPresetsBusy && visibleTemplateCount === 0 && (
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

      {assignBuilderSite ? (
        <StoreTemplatePicker
          templateName={assignBuilderSite.name}
          stores={pickerStores}
          primaryStoreId={selectedAssignStoreId}
          pending={assignBuilderSiteToStore.isPending}
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
