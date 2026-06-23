import { Check, ExternalLink, Eye, Globe, Pencil, Store } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { WebsiteSiteGlimpse } from '@/components/websites/WebsiteSiteGlimpse'
import { AppliedTemplateViewLiveButton, templateCardIconActionClass } from '@/components/websites/AppliedTemplateViewLiveButton'
import { resolveSiteStaticThumbnail } from '@/lib/websiteSitePreview'
import {
  isBuilderSiteBuSpecific,
  isBuilderSiteBuiltForStore,
  isBuilderSiteBuiltForAll,
  isBuilderSiteExternal,
  type BuilderSiteLiveBlockReason,
} from '@/lib/builderDraftTemplateSites'
import { resolveSiteCardDisplayStatus, SITE_CARD_STATUS_DISPLAY } from '@/lib/siteCardDisplayStatus'
import type { AppliedTemplateViewLiveLink } from '@/lib/liveStorefrontUrl'
import { collapseViewLiveLinks } from '@/lib/liveStorefrontUrl'
import {
  templateBadgeEmeraldClass,
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
  templateCardShellClass,
  perStoreGalleryRibbonLabel,
  perStoreTemplateActionLabel,
  singleTemplateActionLabel,
  systemTemplateGalleryStatusTitle,
} from '@/lib/websiteTemplateBadges'
import type { SiteListItem, WebsiteTemplate } from '@/types/websites'

type Props = {
  site: SiteListItem
  templates: WebsiteTemplate[]
  vendorSlug?: string
  perStoreAppliedCount: number
  linkedStoreNames?: string[]
  linkedStoreCodes?: string[]
  assignedStoreNames: string[]
  liveBlockReason?: BuilderSiteLiveBlockReason | null
  viewLiveLinks?: AppliedTemplateViewLiveLink[]
  showAssignHighlight: boolean
  perStoreTemplateMode?: boolean
  singleTemplateMode?: boolean
  isSingleTemplateSelected?: boolean
  onUseForAllStores?: () => void
  useForAllStoresPending?: boolean
  onAssign?: () => void
  assignPending?: boolean
  onPreview: () => void
  onViewLivePicker?: (links: AppliedTemplateViewLiveLink[]) => void
  highlightStoreId?: string | null
  contextStoreId?: string | null
  contextStoreCode?: string | null
  builtForHomeStoreCode?: string | null
  linkedToContextStore?: boolean
  appliedToContextStore?: boolean
  /** Gallery "Ready to assign" row — preview only; assign from elsewhere. */
  previewOnly?: boolean
}

export function BuilderDraftTemplateCard({
  site,
  templates,
  vendorSlug,
  perStoreAppliedCount,
  linkedStoreNames = [],
  linkedStoreCodes = [],
  assignedStoreNames,
  liveBlockReason = null,
  viewLiveLinks = [],
  showAssignHighlight,
  perStoreTemplateMode,
  singleTemplateMode,
  isSingleTemplateSelected = false,
  onUseForAllStores,
  useForAllStoresPending,
  onAssign,
  assignPending,
  onPreview,
  onViewLivePicker,
  highlightStoreId,
  contextStoreId,
  contextStoreCode,
  builtForHomeStoreCode,
  linkedToContextStore = false,
  appliedToContextStore = false,
  previewOnly = false,
}: Props) {
  const navigate = useNavigate()
  const staticThumb = resolveSiteStaticThumbnail(site, templates)
  const pageCount = site.page_count ?? 0
  const isApplied = perStoreAppliedCount > 0
  const isLinkedToStore = linkedStoreNames.length > 0
  const isAssigned = isSingleTemplateSelected || isApplied
  const isLiveOnStorefront = viewLiveLinks.length > 0
  const resolvedViewLiveLinks = collapseViewLiveLinks(viewLiveLinks)
  const linkedToContextStoreResolved = linkedToContextStore
  const appliedToContextStoreResolved = appliedToContextStore
  const isGalleryAssigned = site.storefront_assigned === true
  const needsActivation = isGalleryAssigned
    && isLinkedToStore
    && !isLiveOnStorefront
    && liveBlockReason === 'catalog_template_override'
  const isAssignedNotLive = isAssigned && !isLiveOnStorefront && !needsActivation
  const baseDisplayStatus = resolveSiteCardDisplayStatus({
    site,
    viewLiveLinksCount: viewLiveLinks.length,
    liveBlockReason,
    isAssignedToStore: isAssigned || isGalleryAssigned,
  })
  const isContextAssigned = singleTemplateMode
    ? isSingleTemplateSelected
    : perStoreTemplateMode
      ? appliedToContextStoreResolved
      : isAssigned
  const displayStatus = (() => {
    if (previewOnly && site.is_published && baseDisplayStatus.id !== 'live') {
      return {
        id: 'ready_for_assign' as const,
        ...SITE_CARD_STATUS_DISPLAY.ready_for_assign,
        shortLabel: 'In ready templates',
        label: 'Published and moved to Ready to assign — pick a business unit below to go live',
      }
    }
    if (
      baseDisplayStatus.id === 'live'
      && !isContextAssigned
      && (singleTemplateMode || perStoreTemplateMode)
    ) {
      return {
        id: 'assigned_not_active' as const,
        ...SITE_CARD_STATUS_DISPLAY.assigned_not_active,
      }
    }
    return baseDisplayStatus
  })()
  const StatusIcon = displayStatus.icon
  const showViewLive = isContextAssigned && resolvedViewLiveLinks.length > 0
  const multipleLiveStores = resolvedViewLiveLinks.length > 1
  const isExternalSite = isBuilderSiteExternal(site)
  const isBuiltForAll = isBuilderSiteBuiltForAll(site)
  const builtForScopeLabel = isExternalSite
    ? 'Built for External'
    : isBuiltForAll
      ? 'Built for all'
      : builtForHomeStoreCode
        ? `Built for · ${builtForHomeStoreCode}`
        : null
  const builtForContextStore = Boolean(
    contextStoreId && isBuilderSiteBuiltForStore(site, contextStoreId),
  )
  /** Ready-to-assign row: preview-only unless built for all units or the selected BU. */
  const effectivePreviewOnly = previewOnly && !isBuiltForAll && !builtForContextStore
  const canAssignToContext = Boolean(
    !effectivePreviewOnly
    && perStoreTemplateMode
    && onAssign
    && contextStoreCode
    && !appliedToContextStore
    && !needsActivation
  )
  const showPerStoreAssignAction = Boolean(
    perStoreTemplateMode
    && onAssign
    && (
      appliedToContextStore
      || (!effectivePreviewOnly && (needsActivation || canAssignToContext))
    ),
  )

  const handleCardClick = () => {
    if (!effectivePreviewOnly && needsActivation && onAssign) {
      onAssign()
      return
    }
    if (showViewLive && resolvedViewLiveLinks.length > 1 && onViewLivePicker) {
      onViewLivePicker(resolvedViewLiveLinks)
      return
    }
    if (showViewLive && resolvedViewLiveLinks.length === 1) {
      window.open(resolvedViewLiveLinks[0].href, '_blank', 'noopener,noreferrer')
      return
    }
    if (isAssignedNotLive) {
      navigate(`/websites/${site.id}`)
      return
    }
    onPreview()
  }

  const statusLabel = contextStoreCode
    ? appliedToContextStoreResolved
      ? `Live · ${contextStoreCode}`
      : linkedToContextStoreResolved
        ? isExternalSite
          ? 'Built for External'
          : isBuiltForAll
            ? 'Built for all'
            : `Built for · ${builtForHomeStoreCode ?? contextStoreCode}`
        : isApplied || isLinkedToStore
          ? builtForHomeStoreCode
            ? isLiveOnStorefront
              ? `Live · ${builtForHomeStoreCode}`
              : `Built for · ${builtForHomeStoreCode}`
            : `${perStoreAppliedCount} live`
          : 'Unused'
    : isApplied
      ? `${perStoreAppliedCount} live`
      : needsActivation
        ? 'Activate to go live'
        : liveBlockReason === 'catalog_template_override'
          ? 'Catalog override'
          : liveBlockReason === 'single_front_template'
            ? 'Shared template'
            : isLinkedToStore
              ? `${linkedStoreNames.length} assigned`
              : 'Unused'

  const statusTitle = contextStoreCode && appliedToContextStoreResolved
    ? `Live on ${contextStoreCode}`
    : contextStoreCode && linkedToContextStoreResolved
      ? isExternalSite
        ? 'External marketing site — assign in Template Gallery when ready'
        : isBuiltForAll
          ? 'Built for all business units — assign in Template Gallery to go live'
          : `Built for ${builtForHomeStoreCode ?? contextStoreCode} — assign in Template Gallery to go live`
      : isApplied || isLinkedToStore
        ? builtForHomeStoreCode
          ? isLiveOnStorefront
            ? `Live on ${builtForHomeStoreCode}. Select that unit above to manage, or preview below.`
            : `Built for ${builtForHomeStoreCode}. Assign in Template Gallery to go live on that unit.`
          : systemTemplateGalleryStatusTitle(
              contextStoreCode,
              assignedStoreNames.length ? assignedStoreNames : linkedStoreNames,
            )
      : needsActivation
        ? `Assigned to ${linkedStoreNames.join(', ')}. Click Activate to replace the catalog template on the live storefront.`
        : liveBlockReason === 'catalog_template_override'
          ? 'A catalog template is still assigned to this store. Click Activate to switch the live storefront to this site.'
          : liveBlockReason === 'single_front_template'
            ? 'A shared catalog template is set for all stores. Change it in template settings or assign per store.'
            : isLinkedToStore
              ? linkedStoreNames.join(', ')
              : 'Assign this site to a business unit to show it on the live storefront.'

  const showTopAssignmentBadge = !(
    (singleTemplateMode && isSingleTemplateSelected)
    || (perStoreTemplateMode && appliedToContextStoreResolved)
  )
  const storeRibbonLabel = perStoreGalleryRibbonLabel(
    contextStoreCode,
    Boolean(perStoreTemplateMode && appliedToContextStoreResolved),
    isLiveOnStorefront,
  )
  const hidePerStoreBodyStatus = Boolean(storeRibbonLabel)

  const linkedStoreLabels = linkedStoreCodes.length > 0 ? linkedStoreCodes : linkedStoreNames
  const topAssignmentBadgeLabel =
    contextStoreCode && (linkedToContextStoreResolved || appliedToContextStoreResolved)
      ? contextStoreCode
      : linkedStoreLabels.length === 1
        ? linkedStoreLabels[0]
        : `${linkedStoreLabels.length} units`

  const topAssignmentBadge =
    singleTemplateMode && isSingleTemplateSelected && showTopAssignmentBadge ? (
      <span className={cn('min-w-0 shrink', templateBadgeEmeraldClass)} title="Active storefront template for all business units">
        <Check className="h-2.5 w-2.5 shrink-0" />
        <span className="truncate">All stores</span>
      </span>
    ) : isLinkedToStore && showTopAssignmentBadge ? (
      <span
        className={cn(
          'min-w-0 shrink',
          isApplied
            ? templateBadgeEmeraldClass
            : 'inline-flex items-center gap-1 rounded-full bg-amber-500/95 px-1.5 py-px text-[9px] font-bold text-white shadow-sm',
        )}
        title={isApplied ? assignedStoreNames.join(', ') : linkedStoreNames.join(', ')}
      >
        <Check className="h-2.5 w-2.5 shrink-0" />
        <span className="truncate">{topAssignmentBadgeLabel}</span>
      </span>
    ) : null

  const previewOverlayContent = (() => {
    if (!effectivePreviewOnly && needsActivation) {
      return (
        <>
          <ExternalLink className="h-3 w-3" />
          Activate & view live
        </>
      )
    }
    if (showViewLive) {
      return (
        <>
          <ExternalLink className="h-3 w-3" />
          {multipleLiveStores ? `View live (${resolvedViewLiveLinks.length})` : 'View live'}
        </>
      )
    }
    if (isAssignedNotLive && !effectivePreviewOnly) {
      return (
        <>
          <Pencil className="h-3 w-3" />
          Open in builder
        </>
      )
    }
    return (
      <>
        <Eye className="h-3 w-3" />
        Preview
      </>
    )
  })()

  const cardDescription =
    singleTemplateMode && !isSingleTemplateSelected
      ? 'Assign to your live store — apply for all business units.'
      : site.description?.trim()
      || (isBuiltForAll
        ? 'Built for all business units — assign to any unit below.'
        : needsActivation
        ? `Activate for ${linkedStoreNames[0] ?? 'store'} to replace catalog template.`
        : liveBlockReason === 'catalog_template_override'
          ? 'Catalog template still controls this store — activate to go live.'
          : perStoreTemplateMode && !onAssign && site.website_store_scope === 'store' && site.website_store_name
            ? `Built for ${site.website_store_name} — switch business unit above to assign.`
          : isExternalSite
            ? 'External marketing site — not tied to a business unit.'
          : site.website_store_scope === 'store' && site.website_store_name
            ? `Built for ${site.website_store_name}.`
            : 'Assign to your live store — pick a business unit below.')

  return (
    <div
      title={
        !effectivePreviewOnly && needsActivation
          ? `Activate and open live storefront for ${site.name}`
          : multipleLiveStores
            ? `View live — pick from ${resolvedViewLiveLinks.length} business units`
            : showViewLive
              ? `View live site for ${site.name}`
              : isAssignedNotLive
                ? `Open ${site.name} in Website Builder`
                : `Preview ${site.name}`
      }
      onClick={e => {
        if ((e.target as HTMLElement).closest('[data-template-card-action]')) return
        handleCardClick()
      }}
      className={cn(
        templateCardShellClass,
        showAssignHighlight && perStoreTemplateMode && templateCardSelectedClass,
        showAssignHighlight && singleTemplateMode && templateCardSelectedClass,
      )}
      data-current-for-selected-store={appliedToContextStoreResolved ? 'true' : undefined}
    >
      <div className="relative isolate overflow-hidden rounded-t-xl bg-white">
        {storeRibbonLabel ? (
          <span className={templateCardCurrentForStoreRibbonClass}>
            {storeRibbonLabel}
          </span>
        ) : null}
        <div className={cn(templateCardMediaHeightClass, 'w-full overflow-hidden')}>
          <WebsiteSiteGlimpse
            siteId={site.id}
            vendorSlug={vendorSlug}
            fallbackImage={staticThumb}
            templates={templates}
            variant="card"
            className="h-full w-full transform-gpu"
          />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />
        <div className="absolute inset-x-1.5 top-1.5 flex items-center justify-between gap-1.5 overflow-hidden">
          <span
            className={cn(
              'flex min-w-0 shrink items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold shadow-sm',
              displayStatus.color,
            )}
            title={displayStatus.label}
          >
            <StatusIcon className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{displayStatus.shortLabel}</span>
          </span>
          {topAssignmentBadge}
        </div>
        <div className={templateCardPreviewOverlayClass}>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold text-gray-900 shadow-md">
            {previewOverlayContent}
          </span>
        </div>
        <div className="absolute bottom-1 left-1.5 right-1.5 flex items-end justify-between gap-1">
          <span className={templateCardMediaChipClass}>
            Builder · {pageCount} pg
          </span>
        </div>
      </div>
      <div className={templateCardBodyClass}>
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-extrabold leading-tight text-gray-900 transition-colors group-hover/card:text-primary">
              {site.name}
            </div>
            {builtForScopeLabel ? (
              <span
                className={cn(
                  'mt-0.5 inline-flex max-w-full items-center gap-1 text-[10px] font-semibold',
                  isExternalSite || isBuiltForAll ? 'text-violet-700' : 'text-violet-700',
                )}
                title={
                  isBuiltForAll
                    ? 'Built for all business units — assign to any unit in Template Gallery'
                    : isExternalSite
                      ? 'External marketing site — not tied to a business unit'
                      : `Built for business unit ${builtForHomeStoreCode}`
                }
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    isBuiltForAll ? 'bg-slate-500' : 'bg-violet-500',
                  )}
                />
                <span className="truncate">{builtForScopeLabel}</span>
              </span>
            ) : null}
          </div>
          {singleTemplateMode ? (
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold',
                isSingleTemplateSelected ? 'text-primary' : 'text-gray-400',
              )}
              title={
                isSingleTemplateSelected
                  ? 'This Website Builder site is the live template for every business unit'
                  : 'Not selected — click Assign · all to apply'
              }
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  isSingleTemplateSelected ? 'bg-primary' : 'bg-gray-300',
                )}
              />
              {isSingleTemplateSelected ? 'Assigned all' : 'Not applied'}
            </span>
          ) : perStoreTemplateMode && !hidePerStoreBodyStatus ? (
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold',
                isApplied || appliedToContextStoreResolved
                  ? 'text-emerald-700'
                  : needsActivation || liveBlockReason === 'catalog_template_override'
                    ? 'text-amber-700'
                    : linkedToContextStoreResolved
                      ? 'text-violet-700'
                      : 'text-gray-400',
              )}
              title={statusTitle}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  isApplied || appliedToContextStoreResolved
                    ? 'bg-emerald-500'
                    : needsActivation || liveBlockReason === 'catalog_template_override'
                      ? 'bg-amber-500'
                      : linkedToContextStoreResolved
                        ? 'bg-violet-500'
                        : 'bg-gray-300',
                )}
              />
              {statusLabel}
            </span>
          ) : null}
        </div>
        <p className="truncate text-[10px] leading-tight text-gray-500" title={cardDescription}>
          {cardDescription}
        </p>
        <div className={templateCardActionRowClass} data-template-card-action>
          {singleTemplateMode && onUseForAllStores && !effectivePreviewOnly ? (
            isSingleTemplateSelected ? (
              <span className={templateCardActivePillClass} title="Assigned for all business units">
                <Check className="h-3 w-3 shrink-0" />
                {singleTemplateActionLabel(true)}
              </span>
            ) : (
              <button
                type="button"
                disabled={useForAllStoresPending}
                onClick={onUseForAllStores}
                className={templateCardAssignPillClass}
              >
                <Store className="h-3 w-3 shrink-0" />
                {singleTemplateActionLabel(false)}
              </button>
            )
          ) : null}
          {singleTemplateMode && effectivePreviewOnly ? (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                onPreview()
              }}
              className={templateCardAssignPillClass}
            >
              <Eye className="h-3 w-3 shrink-0" />
              Preview
            </button>
          ) : null}
          {perStoreTemplateMode && showPerStoreAssignAction ? (
            <button
              type="button"
              disabled={assignPending}
              onClick={onAssign}
              className={cn(
                appliedToContextStoreResolved && !needsActivation
                  ? templateCardActivePillClass
                  : needsActivation
                    ? cn(
                        templateCardPrimaryActionClass,
                        'border-amber-200 bg-amber-50/80 text-amber-800 hover:border-amber-300 hover:bg-amber-100',
                      )
                    : templateCardAssignPillClass,
              )}
            >
              {needsActivation ? (
                <>
                  <Store className="h-3 w-3 shrink-0" />
                  Activate{contextStoreCode ? ` · ${contextStoreCode}` : ''}
                </>
              ) : appliedToContextStoreResolved ? (
                <>
                  <Check className="h-3 w-3 shrink-0" />
                  {perStoreTemplateActionLabel(contextStoreCode, true, true)}
                </>
              ) : (
                <>
                  <Store className="h-3 w-3 shrink-0" />
                  {perStoreTemplateActionLabel(
                    contextStoreCode,
                    false,
                    isApplied || (isLinkedToStore && !appliedToContextStoreResolved),
                  )}
                </>
              )}
            </button>
          ) : perStoreTemplateMode && !showPerStoreAssignAction ? (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                onPreview()
              }}
              className={templateCardAssignPillClass}
            >
              <Eye className="h-3 w-3 shrink-0" />
              Preview
            </button>
          ) : null}
          <div className={templateCardActionClusterClass}>
            <Link
              to={`/websites/${site.id}`}
              onClick={e => e.stopPropagation()}
              className={templateCardIconActionClass}
              title="Edit in Website Builder"
              aria-label="Edit in Website Builder"
            >
              <Globe className="h-3 w-3" />
            </Link>
            {showViewLive ? (
              <AppliedTemplateViewLiveButton
                links={resolvedViewLiveLinks}
                templateName={site.name}
                highlightStoreId={highlightStoreId}
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
