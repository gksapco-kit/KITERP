import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Store } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { templateBadgeEmeraldClass, templateBadgeVioletClass } from '@/lib/websiteTemplateBadges'
import { formatAssignedStoresLabel } from '@/lib/websiteTemplateAssignment'
import type { AppliedTemplateViewLiveLink } from '@/lib/liveStorefrontUrl'
import { AppliedTemplateViewLiveButton } from '@/components/websites/AppliedTemplateViewLiveButton'
import { vendorApi } from '@/api/vendor'
import { getCustomerStorefrontBaseUrl } from '@/lib/storefrontPreviewUrl'
import {
  isLegacyPresetActive,
  resolveBusinessFrontActiveTemplate,
  type ThemePresetSummary,
} from '@/lib/businessFrontActiveTemplate'

type Props = {
  preset: ThemePresetSummary
  themeTemplateId: string | undefined
  sites: { id: string; name: string; is_published: boolean }[]
  vendorSlug: string | undefined
  onCustomize: () => void
  /** When single template mode: show "Use for all stores". */
  singleTemplateMode?: boolean
  isSingleTemplateSelected?: boolean
  onUseForAllStores?: (templateId: string) => void
  useForAllStoresPending?: boolean
  /** When per-store template mode: show "Apply for Single BU / Store". */
  perStoreTemplateMode?: boolean
  perStoreUsedCount?: number
  assignedStoreNames?: string[]
  onApplyForStore?: (templateId: string) => void
  applyForStorePending?: boolean
  viewLiveLinks?: AppliedTemplateViewLiveLink[]
}

export function BusinessFrontDefaultTemplateCard({
  preset,
  themeTemplateId,
  sites,
  vendorSlug,
  onCustomize,
  singleTemplateMode,
  isSingleTemplateSelected,
  onUseForAllStores,
  useForAllStoresPending,
  perStoreTemplateMode,
  perStoreUsedCount,
  assignedStoreNames = [],
  onApplyForStore,
  applyForStorePending,
  viewLiveLinks = [],
}: Props) {
  const qc = useQueryClient()
  const active = resolveBusinessFrontActiveTemplate(themeTemplateId, [preset], sites)
  const live = isLegacyPresetActive(active, preset.id)
  const storeUrl = vendorSlug ? getCustomerStorefrontBaseUrl(vendorSlug) : null

  const palette = preset.colors
    ? [preset.colors.primary, preset.colors.secondary, preset.colors.accent, preset.colors.background].filter(Boolean)
    : []

  const applyPreset = useMutation({
    mutationFn: (presetId: string) => vendorApi.applyTemplatePreset(presetId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['template-config'] })
      toast.success('Business front theme updated')
    },
    onError: () => toast.error('Could not apply theme preset'),
  })

  return (
    <div
      className={cn(
        'text-left border rounded-2xl overflow-hidden transition-colors group bg-white',
        'shadow-[0_1px_0_rgba(0,0,0,0.02)] hover:shadow-[0_8px_24px_rgba(100,195,160,0.15)]',
        live ? 'border-primary ring-2 ring-primary/20' : 'border-gray-100 hover:border-primary/30',
      )}
    >
      <div className="relative">
        <div
          className="w-full h-36 sm:h-40"
          style={{
            background: palette.length >= 2
              ? `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`
              : 'linear-gradient(135deg, #64C3A0, #13624A)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent pointer-events-none" />
        <div className="absolute top-2 left-2 flex max-w-[calc(100%-1rem)] flex-nowrap items-center gap-1.5 overflow-hidden">
          <span className="shrink-0 text-[10px] uppercase tracking-wide font-extrabold bg-white/90 text-gray-800 rounded-full px-2 py-0.5 whitespace-nowrap">
            Default layout
          </span>
          {live && (
            <span className="shrink-0 text-[10px] uppercase tracking-wide font-extrabold bg-primary text-white rounded-full px-2 py-0.5 flex items-center gap-0.5 whitespace-nowrap">
              <Check className="w-3 h-3" /> Live
            </span>
          )}
          {singleTemplateMode && isSingleTemplateSelected && (
            <span className={cn('shrink min-w-0', templateBadgeVioletClass)} title="All stores">
              <span className="truncate">All stores</span>
            </span>
          )}
          {perStoreTemplateMode && (perStoreUsedCount ?? 0) > 0 && (
            <span
              className={cn('shrink min-w-0', templateBadgeEmeraldClass)}
              title={assignedStoreNames.join(', ')}
            >
              <span className="truncate">
                {(perStoreUsedCount ?? 0) === 1 ? assignedStoreNames[0] : `${perStoreUsedCount} BUs / Stores`}
              </span>
            </span>
          )}
        </div>
        {palette.length > 0 && (
          <div className="absolute bottom-2 right-2 inline-flex -space-x-1">
            {palette.slice(0, 4).map((c, i) => (
              <span
                key={`${c}-${i}`}
                className="w-3.5 h-3.5 rounded-full border border-white shadow-sm"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}
      </div>
      <div className="p-3.5">
        <div className="font-extrabold text-gray-900 group-hover:text-primary transition-colors">{preset.name}</div>
        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
          {preset.description || 'Section-based home used when no Website Builder site is published.'}
        </p>
        {singleTemplateMode && isSingleTemplateSelected ? (
          <p className="mt-1 truncate text-[10px] font-semibold text-violet-700">Used by: All BUs / Stores</p>
        ) : null}
        {perStoreTemplateMode && (perStoreUsedCount ?? 0) > 0 ? (
          <p
            className="mt-1 truncate text-[10px] font-semibold text-emerald-700"
            title={assignedStoreNames.join(', ')}
          >
            Used by: {formatAssignedStoresLabel(assignedStoreNames.map(name => ({ name })))}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-2 mt-3">
          <div className="inline-flex items-center gap-1.5">
            {singleTemplateMode && onUseForAllStores ? (
              <button
                type="button"
                disabled={isSingleTemplateSelected || useForAllStoresPending}
                onClick={() => onUseForAllStores(preset.id)}
                className={cn(
                  'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-extrabold transition-colors',
                  isSingleTemplateSelected
                    ? 'cursor-default border-violet-200 bg-violet-50 text-violet-600'
                    : 'border-violet-200 bg-violet-50/80 text-violet-700 hover:border-violet-300 hover:bg-violet-100',
                )}
              >
                {isSingleTemplateSelected ? <Check className="h-3.5 w-3.5" /> : <Store className="h-3.5 w-3.5" />}
                {isSingleTemplateSelected ? 'Applied — all BU / Store' : 'Apply for all BU / Store'}
              </button>
            ) : null}
            {perStoreTemplateMode && onApplyForStore ? (
              <button
                type="button"
                disabled={applyForStorePending}
                onClick={() => onApplyForStore(preset.id)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-extrabold transition-colors',
                  (perStoreUsedCount ?? 0) > 0
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:border-emerald-300 hover:bg-emerald-100'
                    : 'border-emerald-200 bg-emerald-50/80 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100',
                )}
              >
                {(perStoreUsedCount ?? 0) > 0 ? <Check className="h-3.5 w-3.5" /> : <Store className="h-3.5 w-3.5" />}
                {(perStoreUsedCount ?? 0) > 0
                  ? `Applied — BU / Store · ${perStoreUsedCount}`
                  : 'Apply for Single BU / Store'}
              </button>
            ) : null}
            {viewLiveLinks.length > 0 ? (
              <AppliedTemplateViewLiveButton links={viewLiveLinks} />
            ) : null}
          </div>
          {storeUrl && (
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-xs font-extrabold border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Preview store
            </a>
          )}
          <button
            type="button"
            onClick={onCustomize}
            className="px-3 py-1.5 rounded-lg text-xs font-extrabold border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Customize
          </button>
          <button
            type="button"
            disabled={live || applyPreset.isPending || active.kind === 'website_builder'}
            title={
              active.kind === 'website_builder'
                ? 'Unpublish your Website Builder site to switch default themes'
                : live
                  ? 'Already active on your store'
                  : undefined
            }
            onClick={() => applyPreset.mutate(preset.id)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors',
              live || active.kind === 'website_builder'
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-primary text-white hover:opacity-90',
            )}
          >
            {live ? 'In use' : 'Use this theme'}
          </button>
        </div>
      </div>
    </div>
  )
}
