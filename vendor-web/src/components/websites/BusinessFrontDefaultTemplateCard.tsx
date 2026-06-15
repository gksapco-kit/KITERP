import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, ExternalLink, Store } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { templateBadgeEmeraldClass, templateBadgeVioletClass, templateCardActionBtnClass, templateCardBodyClass, templateCardMediaHeightClass, templateCardPreviewOverlayClass, templateCardShellClass } from '@/lib/websiteTemplateBadges'
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
  onUseForAllStores?: (templateId: string, templateName: string) => void
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
      title={storeUrl ? (live ? `Click to view live ${preset.name}` : `Click to open ${preset.name} store`) : undefined}
      onClick={storeUrl ? (e) => {
        if ((e.target as HTMLElement).closest('[data-template-card-action]')) return
        window.open(storeUrl, '_blank', 'noopener,noreferrer')
      } : undefined}
      className={cn(
        templateCardShellClass,
        live && 'border-primary ring-2 ring-primary/20',
      )}
    >
      <div className="relative overflow-hidden">
        <div
          className={cn(templateCardMediaHeightClass, 'w-full transition-transform duration-300 group-hover/card:scale-[1.03]')}
          style={{
            background: palette.length >= 2
              ? `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`
              : 'linear-gradient(135deg, #64C3A0, #13624A)',
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />
        {storeUrl ? (
          <div className={templateCardPreviewOverlayClass}>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold text-gray-900 shadow-md">
              {live ? (
                <>
                  <ExternalLink className="h-3 w-3" />
                  View live site
                </>
              ) : (
                <>
                  <ExternalLink className="h-3 w-3" />
                  View store
                </>
              )}
            </span>
          </div>
        ) : null}
        <div className="absolute left-1.5 top-1.5 flex max-w-[calc(100%-0.75rem)] flex-nowrap items-center gap-1 overflow-hidden">
          <span className="shrink-0 whitespace-nowrap rounded-full bg-white/90 px-1.5 py-0 text-[9px] font-extrabold uppercase tracking-wide text-gray-800">
            Default layout
          </span>
          {live && (
            <span className="flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full bg-primary px-1.5 py-0 text-[9px] font-extrabold uppercase tracking-wide text-white">
              <Check className="h-2.5 w-2.5" /> Live
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
          <div className="absolute bottom-1.5 right-1.5 inline-flex -space-x-1">
            {palette.slice(0, 4).map((c, i) => (
              <span
                key={`${c}-${i}`}
                className="h-3 w-3 rounded-full border border-white shadow-sm"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}
      </div>
      <div className={templateCardBodyClass}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 truncate text-sm font-extrabold text-gray-900 transition-colors group-hover/card:text-primary">{preset.name}</div>
          {(singleTemplateMode || perStoreTemplateMode) ? (() => {
            const applied = singleTemplateMode ? Boolean(isSingleTemplateSelected) : (perStoreUsedCount ?? 0) > 0
            return (
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold',
                  applied || live
                    ? (singleTemplateMode ? 'text-violet-700' : 'text-emerald-700')
                    : 'text-gray-400',
                )}
                title={perStoreTemplateMode && applied ? assignedStoreNames.join(', ') : undefined}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    applied || live
                      ? (singleTemplateMode ? 'bg-violet-500' : 'bg-emerald-500')
                      : 'bg-gray-300',
                  )}
                />
                {singleTemplateMode
                  ? applied ? 'Live all' : live ? 'Default live' : 'Unused'
                  : applied
                    ? `${perStoreUsedCount} live`
                    : live
                      ? 'Default live'
                      : 'Unused'}
              </span>
            )
          })() : live ? (
            <span className="shrink-0 text-[10px] font-semibold text-primary">In use</span>
          ) : null}
        </div>
        <p className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-gray-500">
          {preset.description || 'Section-based home when no Website Builder site is published.'}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center justify-end gap-1.5" data-template-card-action>
          <div className="inline-flex items-center gap-1">
            {singleTemplateMode && onUseForAllStores ? (
              <button
                type="button"
                disabled={isSingleTemplateSelected || useForAllStoresPending}
                onClick={() => onUseForAllStores(preset.id, preset.name)}
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
            {perStoreTemplateMode && onApplyForStore ? (
              <button
                type="button"
                disabled={applyForStorePending}
                onClick={() => onApplyForStore(preset.id)}
                className={cn(
                  templateCardActionBtnClass,
                  (perStoreUsedCount ?? 0) > 0
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:border-emerald-300 hover:bg-emerald-100'
                    : 'border-emerald-200 bg-emerald-50/80 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100',
                )}
              >
                {(perStoreUsedCount ?? 0) > 0 ? <Check className="h-3 w-3" /> : <Store className="h-3 w-3" />}
                {(perStoreUsedCount ?? 0) > 0 ? 'Manage' : 'Assign'}
              </button>
            ) : null}
            {viewLiveLinks.length > 0 ? (
              <AppliedTemplateViewLiveButton links={viewLiveLinks} templateName={preset.name} />
            ) : null}
          </div>
          <button
            type="button"
            onClick={onCustomize}
            className={cn(templateCardActionBtnClass, 'border-gray-200 text-gray-700 hover:border-primary/35 hover:bg-primary/10 hover:text-primary')}
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
              templateCardActionBtnClass,
              live || active.kind === 'website_builder'
                ? 'cursor-not-allowed border-transparent bg-gray-100 text-gray-400'
                : 'border-transparent bg-primary text-white hover:opacity-90',
            )}
          >
            {live ? 'In use' : 'Use theme'}
          </button>
        </div>
      </div>
    </div>
  )
}
