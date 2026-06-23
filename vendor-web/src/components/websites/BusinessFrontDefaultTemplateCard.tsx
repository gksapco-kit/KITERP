import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, ExternalLink, Eye, Pencil, Store } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { templateBadgeEmeraldClass, templateCardActionBtnClass, templateCardActionClusterClass, templateCardActionRowClass, templateCardActivePillClass, templateCardAssignPillClass, templateCardBodyClass, templateCardCurrentForStoreRibbonClass, templateCardMediaHeightClass, templateCardPreviewOverlayClass, templateCardPrimaryActionClass, templateCardSelectedClass, templateCardShellClass, perStoreGalleryRibbonLabel, perStoreTemplateActionLabel, singleTemplateActionLabel, systemTemplateGalleryStatusLabel, systemTemplateGalleryStatusTitle } from '@/lib/websiteTemplateBadges'
import type { AppliedTemplateViewLiveLink } from '@/lib/liveStorefrontUrl'
import { AppliedTemplateViewLiveButton, templateCardIconActionClass } from '@/components/websites/AppliedTemplateViewLiveButton'
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
  /** When single template mode: show "Assign · all". */
  singleTemplateMode?: boolean
  isSingleTemplateSelected?: boolean
  onUseForAllStores?: (templateId: string, templateName: string) => void
  useForAllStoresPending?: boolean
  /** When per-store template mode: show "Apply for Single BU / Store". */
  perStoreTemplateMode?: boolean
  perStoreUsedCount?: number
  assignedStoreNames?: string[]
  assignedStoreCodes?: string[]
  contextStoreCode?: string | null
  assignedToContextStore?: boolean
  onApplyForStore?: (templateId: string) => void
  applyForStorePending?: boolean
  viewLiveLinks?: AppliedTemplateViewLiveLink[]
  highlightStoreId?: string | null
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
  assignedStoreCodes = [],
  contextStoreCode,
  assignedToContextStore = false,
  onApplyForStore,
  applyForStorePending,
  viewLiveLinks = [],
  highlightStoreId,
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

  const perStoreHighlight = perStoreTemplateMode && contextStoreCode
    ? assignedToContextStore
    : (perStoreUsedCount ?? 0) > 0

  const storeRibbonLabel = perStoreGalleryRibbonLabel(
    contextStoreCode,
    Boolean(perStoreTemplateMode && assignedToContextStore),
    live || (viewLiveLinks.length > 0),
  )
  const hidePerStoreBodyStatus = Boolean(storeRibbonLabel)

  return (
    <div
      title={
        live && storeUrl
          ? `Click to view live ${preset.name}`
          : `Preview ${preset.name}`
      }
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-template-card-action]')) return
        if (live && storeUrl) {
          window.open(storeUrl, '_blank', 'noopener,noreferrer')
        } else if (perStoreTemplateMode && storeUrl) {
          window.open(storeUrl, '_blank', 'noopener,noreferrer')
        } else {
          onCustomize()
        }
      }}
      className={cn(
        templateCardShellClass,
        live && 'border-primary/70',
        perStoreTemplateMode && perStoreHighlight && templateCardSelectedClass,
      )}
      data-current-for-selected-store={perStoreTemplateMode && assignedToContextStore ? 'true' : undefined}
    >
      <div className="relative isolate overflow-hidden rounded-t-xl bg-white">
        {storeRibbonLabel ? (
          <span className={templateCardCurrentForStoreRibbonClass}>
            {storeRibbonLabel}
          </span>
        ) : null}
        <div
          className={cn(templateCardMediaHeightClass, 'w-full overflow-hidden')}
          style={{
            background: palette.length >= 2
              ? `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`
              : 'linear-gradient(135deg, #64C3A0, #13624A)',
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />
        <div className={templateCardPreviewOverlayClass}>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold text-gray-900 shadow-md">
            {live ? (
              <>
                <ExternalLink className="h-3 w-3" />
                View live site
              </>
            ) : (
              <>
                <Eye className="h-3 w-3" />
                Preview
              </>
            )}
          </span>
        </div>
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
            <span className={cn('shrink min-w-0', templateBadgeEmeraldClass)} title="All stores">
              <span className="truncate">All stores</span>
            </span>
          )}
          {perStoreTemplateMode && (perStoreUsedCount ?? 0) > 0 && (
            <span
              className={cn('shrink min-w-0', templateBadgeEmeraldClass)}
              title={assignedStoreCodes.length
                ? assignedStoreCodes.join(', ')
                : assignedStoreNames.join(', ')}
            >
              <span className="truncate">
                {assignedToContextStore && contextStoreCode
                  ? contextStoreCode
                  : (perStoreUsedCount ?? 0) === 1
                    ? (assignedStoreCodes[0] ?? assignedStoreNames[0])
                    : `${perStoreUsedCount} BUs / Stores`}
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
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 truncate text-sm font-extrabold leading-tight text-gray-900 transition-colors group-hover/card:text-primary">{preset.name}</div>
          {(singleTemplateMode || (perStoreTemplateMode && !hidePerStoreBodyStatus)) ? (() => {
            const applied = singleTemplateMode
              ? Boolean(isSingleTemplateSelected)
              : contextStoreCode
                ? assignedToContextStore
                : (perStoreUsedCount ?? 0) > 0
            const perStoreLabel = contextStoreCode
              ? assignedToContextStore
                ? `Live · ${contextStoreCode}`
                : systemTemplateGalleryStatusLabel
              : (perStoreUsedCount ?? 0) > 0
                ? `${perStoreUsedCount} live`
                : live
                  ? 'Default live'
                  : 'Unused'
            return (
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold',
                  applied || live
                    ? (singleTemplateMode ? 'text-primary' : 'text-emerald-700')
                    : 'text-gray-400',
                )}
                title={perStoreTemplateMode && applied
                  ? (assignedStoreCodes.length ? assignedStoreCodes.join(', ') : assignedStoreNames.join(', '))
                  : perStoreTemplateMode && contextStoreCode && !assignedToContextStore
                    ? systemTemplateGalleryStatusTitle(contextStoreCode, assignedStoreNames)
                    : undefined}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    applied || live
                      ? (singleTemplateMode ? 'bg-primary' : 'bg-emerald-500')
                      : 'bg-gray-300',
                  )}
                />
                {singleTemplateMode
                  ? applied ? 'Live all' : live ? 'Default live' : 'Unused'
                  : perStoreLabel}
              </span>
            )
          })() : live ? (
            <span className="shrink-0 text-[10px] font-semibold text-primary">In use</span>
          ) : null}
        </div>
        <p className="truncate text-[10px] leading-tight text-gray-500" title={preset.description || undefined}>
          {preset.description || 'Section-based home when no Website Builder site is published.'}
        </p>
        <div className={templateCardActionRowClass} data-template-card-action>
          {singleTemplateMode && onUseForAllStores ? (
            isSingleTemplateSelected ? (
              <span className={templateCardActivePillClass}>
                <Check className="h-3 w-3 shrink-0" />
                {singleTemplateActionLabel(true)}
              </span>
            ) : (
              <button
                type="button"
                disabled={useForAllStoresPending}
                onClick={() => onUseForAllStores(preset.id, preset.name)}
                className={templateCardAssignPillClass}
              >
                <Store className="h-3 w-3 shrink-0" />
                {singleTemplateActionLabel(false)}
              </button>
            )
          ) : null}
          {perStoreTemplateMode && onApplyForStore ? (
            assignedToContextStore ? (
              <button
                type="button"
                disabled={applyForStorePending}
                onClick={() => onApplyForStore(preset.id)}
                className={templateCardActivePillClass}
              >
                <Check className="h-3 w-3 shrink-0" />
                {perStoreTemplateActionLabel(
                  contextStoreCode,
                  true,
                  (perStoreUsedCount ?? 0) > 0,
                )}
              </button>
            ) : (
              <button
                type="button"
                disabled={applyForStorePending}
                onClick={e => {
                  e.stopPropagation()
                  onApplyForStore(preset.id)
                }}
                className={templateCardAssignPillClass}
              >
                <Store className="h-3 w-3 shrink-0" />
                {perStoreTemplateActionLabel(
                  contextStoreCode,
                  false,
                  (perStoreUsedCount ?? 0) > 0,
                )}
              </button>
            )
          ) : null}
          <div className={templateCardActionClusterClass}>
            {viewLiveLinks.length > 0 ? (
              <AppliedTemplateViewLiveButton
                links={viewLiveLinks}
                templateName={preset.name}
                highlightStoreId={highlightStoreId}
              />
            ) : null}
            <button
              type="button"
              onClick={onCustomize}
              className={templateCardActionBtnClass}
              title="Customize theme"
            >
              Customize
            </button>
            {!live && active.kind !== 'website_builder' ? (
              <button
                type="button"
                disabled={applyPreset.isPending}
                onClick={() => applyPreset.mutate(preset.id)}
                className={cn(templateCardActionBtnClass, 'border-transparent bg-primary text-white hover:opacity-90')}
              >
                Apply
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
