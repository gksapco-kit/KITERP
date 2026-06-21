import { Check, ExternalLink, Eye, Globe, Pencil, Store } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { WebsiteSiteGlimpse } from '@/components/websites/WebsiteSiteGlimpse'
import { AppliedTemplateViewLiveButton, templateCardIconActionClass } from '@/components/websites/AppliedTemplateViewLiveButton'
import { resolveSiteStaticThumbnail } from '@/lib/websiteSitePreview'
import type { BuilderSiteLiveBlockReason } from '@/lib/builderDraftTemplateSites'
import type { AppliedTemplateViewLiveLink } from '@/lib/liveStorefrontUrl'
import {
  templateBadgeEmeraldClass,
  templateBadgeVioletClass,
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
  templateCardShellClass,
  perStoreTemplateActionLabel,
  singleTemplateActionLabel,
} from '@/lib/websiteTemplateBadges'
import type { SiteListItem, WebsiteTemplate } from '@/types/websites'

type Props = {
  site: SiteListItem
  templates: WebsiteTemplate[]
  vendorSlug?: string
  perStoreAppliedCount: number
  linkedStoreNames?: string[]
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
  linkedToContextStore?: boolean
  appliedToContextStore?: boolean
}

export function BuilderDraftTemplateCard({
  site,
  templates,
  vendorSlug,
  perStoreAppliedCount,
  linkedStoreNames = [],
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
  linkedToContextStore = false,
  appliedToContextStore = false,
}: Props) {
  const navigate = useNavigate()
  const staticThumb = resolveSiteStaticThumbnail(site, templates)
  const pageCount = site.page_count ?? 0
  const isApplied = perStoreAppliedCount > 0
  const isLinkedToStore = linkedStoreNames.length > 0
  const isAssigned = isSingleTemplateSelected || isApplied || isLinkedToStore
  const isLiveOnStorefront = viewLiveLinks.length > 0
  const needsActivation = isLinkedToStore
    && !isLiveOnStorefront
    && liveBlockReason === 'catalog_template_override'
  const isAssignedNotLive = isAssigned && !isLiveOnStorefront && !needsActivation
  const multipleLiveStores = viewLiveLinks.length > 1
  const canAssignToContext = Boolean(
    perStoreTemplateMode && onAssign && contextStoreCode && !appliedToContextStore && !needsActivation,
  )
  const canAssignSingleAll = Boolean(singleTemplateMode && onUseForAllStores && !isSingleTemplateSelected)
  const showAssignOverlay = canAssignToContext || canAssignSingleAll
  const assignOverlayLabel = singleTemplateMode && !isSingleTemplateSelected
    ? singleTemplateActionLabel(false)
    : contextStoreCode
      ? perStoreTemplateActionLabel(contextStoreCode, false, isApplied || isLinkedToStore)
      : 'Assign'

  const handleCardClick = () => {
    if (needsActivation && onAssign) {
      onAssign()
      return
    }
    if (canAssignToContext && onAssign) {
      onAssign()
      return
    }
    if (canAssignSingleAll && onUseForAllStores) {
      onUseForAllStores()
      return
    }
    if (viewLiveLinks.length > 1 && onViewLivePicker) {
      onViewLivePicker(viewLiveLinks)
      return
    }
    if (viewLiveLinks.length === 1) {
      window.open(viewLiveLinks[0].href, '_blank', 'noopener,noreferrer')
      return
    }
    if (isAssignedNotLive) {
      navigate(`/websites/${site.id}`)
      return
    }
    onPreview()
  }

  const linkedToContextStoreResolved = linkedToContextStore
  const appliedToContextStoreResolved = appliedToContextStore

  const statusLabel = contextStoreCode
    ? appliedToContextStoreResolved
      ? `Live · ${contextStoreCode}`
      : linkedToContextStoreResolved && !isApplied
        ? `Assigned · ${contextStoreCode}`
        : isApplied
          ? `${perStoreAppliedCount} other BU${perStoreAppliedCount === 1 ? '' : 's'}`
          : needsActivation && linkedToContextStoreResolved
            ? `Activate · ${contextStoreCode}`
            : isLinkedToStore
              ? linkedToContextStoreResolved
                ? `Assigned · ${contextStoreCode}`
                : `${linkedStoreNames.length} other BU${linkedStoreNames.length === 1 ? '' : 's'}`
              : 'Unused'
    : isApplied
      ? `${perStoreAppliedCount} live`
      : needsActivation
        ? 'Needs activation'
        : liveBlockReason === 'catalog_template_override'
          ? 'Catalog override'
          : liveBlockReason === 'single_front_template'
            ? 'Shared template'
            : isLinkedToStore
              ? `${linkedStoreNames.length} assigned`
              : 'Unused'

  const statusTitle = contextStoreCode && (appliedToContextStoreResolved || linkedToContextStoreResolved)
    ? `Assigned to ${contextStoreCode}`
    : isApplied
      ? assignedStoreNames.join(', ')
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

  return (
    <div
      title={
        needsActivation
          ? `Activate and open live storefront for ${site.name}`
          : showAssignOverlay
            ? `${assignOverlayLabel} — ${site.name}`
            : multipleLiveStores
              ? `View live site — pick from ${viewLiveLinks.length} business units`
              : isLiveOnStorefront
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
      <div className="relative overflow-hidden">
        {perStoreTemplateMode && appliedToContextStoreResolved && contextStoreCode ? (
          <span className={templateCardCurrentForStoreRibbonClass}>
            Current for {contextStoreCode}
          </span>
        ) : null}
        <div className={cn(templateCardMediaHeightClass, 'w-full')}>
          <WebsiteSiteGlimpse
            siteId={site.id}
            vendorSlug={vendorSlug}
            fallbackImage={staticThumb}
            templates={templates}
            className="h-full w-full"
          />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />
        <div className={templateCardPreviewOverlayClass}>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold text-gray-900 shadow-md">
            {needsActivation ? (
              <>
                <ExternalLink className="h-3 w-3" />
                Activate & view live
              </>
            ) : showAssignOverlay ? (
              <>
                <Store className="h-3 w-3" />
                {assignOverlayLabel}
              </>
            ) : isLiveOnStorefront ? (
              <>
                <ExternalLink className="h-3 w-3" />
                {multipleLiveStores ? `View live site (${viewLiveLinks.length})` : 'View live site'}
              </>
            ) : isAssignedNotLive ? (
              <>
                <Pencil className="h-3 w-3" />
                Open in builder
              </>
            ) : (
              <>
                <Eye className="h-3 w-3" />
                Preview
              </>
            )}
          </span>
        </div>
        {singleTemplateMode && isSingleTemplateSelected && showTopAssignmentBadge ? (
          <span className={cn('absolute right-1.5 top-1.5 max-w-[70%]', templateBadgeVioletClass)} title="Active storefront template for all business units">
            <Check className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">All stores</span>
          </span>
        ) : isLinkedToStore && showTopAssignmentBadge ? (
          <span
            className={cn(
              'absolute right-1.5 top-1.5 max-w-[70%]',
              isApplied ? templateBadgeEmeraldClass : 'inline-flex items-center gap-1 rounded-full bg-amber-500/95 px-1.5 py-px text-[9px] font-bold text-white shadow-sm',
            )}
            title={isApplied ? assignedStoreNames.join(', ') : linkedStoreNames.join(', ')}
          >
            <Check className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">
              {contextStoreCode && (linkedToContextStoreResolved || appliedToContextStoreResolved)
                ? contextStoreCode
                : linkedStoreNames.length === 1
                  ? linkedStoreNames[0]
                  : `${linkedStoreNames.length} units`}
            </span>
          </span>
        ) : null}
        <div className="absolute bottom-1 left-1.5 right-1.5 flex items-end justify-between gap-1">
          <span className={templateCardMediaChipClass}>
            Builder · {pageCount} pg
          </span>
        </div>
      </div>
      <div className={templateCardBodyClass}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 truncate text-sm font-extrabold text-gray-900 transition-colors group-hover/card:text-primary">
            {site.name}
          </div>
          {singleTemplateMode ? (
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold',
                isSingleTemplateSelected ? 'text-violet-700' : 'text-gray-400',
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
                  isSingleTemplateSelected ? 'bg-violet-500' : 'bg-gray-300',
                )}
              />
              {isSingleTemplateSelected ? 'Assigned all' : 'Not applied'}
            </span>
          ) : perStoreTemplateMode ? (
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold',
                isApplied
                  ? 'text-emerald-700'
                  : needsActivation || liveBlockReason === 'catalog_template_override'
                    ? 'text-amber-700'
                    : isLinkedToStore
                      ? 'text-emerald-700'
                      : 'text-gray-400',
              )}
              title={statusTitle}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  isApplied
                    ? 'bg-emerald-500'
                    : needsActivation || liveBlockReason === 'catalog_template_override'
                      ? 'bg-amber-500'
                      : isLinkedToStore
                        ? 'bg-emerald-500'
                        : 'bg-gray-300',
                )}
              />
              {statusLabel}
            </span>
          ) : null}
        </div>
        <p className="line-clamp-2 text-[10px] leading-snug text-gray-500">
          {singleTemplateMode && !isSingleTemplateSelected
            ? 'Assign to your live store — apply for all business units.'
            : site.description?.trim()
            || (needsActivation
              ? `Activate for ${linkedStoreNames[0] ?? 'store'} to replace catalog template.`
              : liveBlockReason === 'catalog_template_override'
                ? 'Catalog template still controls this store — activate to go live.'
                : site.website_store_scope === 'store' && site.website_store_name
                  ? `Built for ${site.website_store_name}.`
                  : 'Assign to your live store — pick a business unit below.')}
        </p>
        <div className={templateCardActionRowClass} data-template-card-action>
          {singleTemplateMode && onUseForAllStores ? (
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
          {perStoreTemplateMode && onAssign ? (
            <button
              type="button"
              disabled={assignPending}
              onClick={onAssign}
              className={cn(
                templateCardPrimaryActionClass,
                appliedToContextStoreResolved && !needsActivation
                  ? 'border-2 border-primary bg-primary/10 text-primary hover:border-primary hover:bg-primary/15'
                  : 'border-emerald-200 bg-emerald-50/80 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100',
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
            <AppliedTemplateViewLiveButton
              links={viewLiveLinks}
              templateName={site.name}
              highlightStoreId={highlightStoreId}
            />
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                onPreview()
              }}
              className={templateCardIconActionClass}
              title="Preview published site"
              aria-label="Preview published site"
            >
              <Eye className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
