import { Check, ExternalLink, Eye, Globe, Store } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { WebsiteSiteGlimpse } from '@/components/websites/WebsiteSiteGlimpse'
import { AppliedTemplateViewLiveButton, templateCardIconActionClass } from '@/components/websites/AppliedTemplateViewLiveButton'
import { resolveSiteAppliedTemplateLabel } from '@/lib/websiteAppliedTemplate'
import { resolveSiteStaticThumbnail } from '@/lib/websiteSitePreview'
import { WebsiteScopeBadge } from '@/components/websites/WebsiteScopeBadge'
import type { BuilderSiteLiveBlockReason } from '@/lib/builderDraftTemplateSites'
import type { AppliedTemplateViewLiveLink } from '@/lib/liveStorefrontUrl'
import {
  templateBadgeEmeraldClass,
  templateCardActionBtnClass,
  templateCardBodyClass,
  templateCardMediaHeightClass,
  templateCardPreviewOverlayClass,
  templateCardShellClass,
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
  onAssign?: () => void
  assignPending?: boolean
  onPreview: () => void
  onViewLivePicker?: (links: AppliedTemplateViewLiveLink[]) => void
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
  onAssign,
  assignPending,
  onPreview,
  onViewLivePicker,
}: Props) {
  const appliedLabel = resolveSiteAppliedTemplateLabel(site, templates)
  const staticThumb = resolveSiteStaticThumbnail(site, templates)
  const pageCount = site.page_count ?? 0
  const isApplied = perStoreAppliedCount > 0
  const isLinkedToStore = linkedStoreNames.length > 0
  const needsActivation = isLinkedToStore && !isApplied && liveBlockReason === 'catalog_template_override'
  const isLiveOnStorefront = viewLiveLinks.length > 0
  const multipleLiveStores = viewLiveLinks.length > 1

  const handleCardClick = () => {
    if (needsActivation && onAssign) {
      onAssign()
      return
    }
    if (multipleLiveStores && onViewLivePicker) {
      onViewLivePicker(viewLiveLinks)
      return
    }
    if (viewLiveLinks.length === 1) {
      window.open(viewLiveLinks[0].href, '_blank', 'noopener,noreferrer')
      return
    }
    onPreview()
  }

  const statusLabel = isApplied
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

  const statusTitle = isApplied
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

  return (
    <div
      title={
        needsActivation
          ? `Activate and open live storefront for ${site.name}`
          : multipleLiveStores
            ? `View live site — pick from ${viewLiveLinks.length} business units`
            : isLiveOnStorefront
              ? `View live site for ${site.name}`
              : `Preview ${site.name}`
      }
      onClick={e => {
        if ((e.target as HTMLElement).closest('[data-template-card-action]')) return
        handleCardClick()
      }}
      className={cn(
        templateCardShellClass,
        showAssignHighlight && 'border-emerald-400 ring-2 ring-emerald-200',
      )}
    >
      <div className="relative overflow-hidden">
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
            ) : isLiveOnStorefront ? (
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
        {isLinkedToStore ? (
          <span
            className={cn(
              'absolute right-2 top-2 max-w-[70%]',
              isApplied ? templateBadgeEmeraldClass : 'inline-flex items-center gap-1 rounded-full bg-amber-500/95 px-2 py-0.5 text-[9px] font-bold text-white shadow-sm',
            )}
            title={isApplied ? assignedStoreNames.join(', ') : linkedStoreNames.join(', ')}
          >
            <Check className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">
              {linkedStoreNames.length === 1
                ? linkedStoreNames[0]
                : `${linkedStoreNames.length} BUs / Stores`}
            </span>
          </span>
        ) : null}
        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
            <span className="shrink-0 rounded-full bg-primary/90 px-1.5 py-0 text-[9px] font-semibold text-white">
              Website Builder
            </span>
            <span className="shrink-0 rounded-full bg-emerald-600/90 px-1.5 py-0 text-[9px] font-extrabold uppercase tracking-wide text-white">
              Published
            </span>
            {appliedLabel ? (
              <span className="min-w-0 truncate rounded-full bg-white/80 px-1.5 py-0 text-[9px] font-semibold uppercase text-gray-700">
                {appliedLabel}
              </span>
            ) : null}
            <span className="shrink-0 rounded-full bg-white/80 px-1.5 py-0 text-[9px] font-semibold text-gray-700">
              {pageCount} pg
            </span>
          </div>
        </div>
      </div>
      <div className={templateCardBodyClass}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 truncate text-sm font-extrabold text-gray-900 transition-colors group-hover/card:text-primary">
            {site.name}
          </div>
          {perStoreTemplateMode ? (
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
        <p className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-gray-500">
          {site.description?.trim()
            || (needsActivation
              ? `Assigned to ${linkedStoreNames[0] ?? 'store'} — click Activate to go live on the storefront.`
              : liveBlockReason === 'catalog_template_override'
                ? 'Published, but a catalog template still controls this store — click Activate.'
                : 'Published Website Builder site — assign to a business unit.')}
        </p>
        <div className="mt-1.5">
          <WebsiteScopeBadge scope={site.website_store_scope} storeName={site.website_store_name} />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center justify-end gap-1.5" data-template-card-action>
          <div className="inline-flex items-center gap-1">
            {perStoreTemplateMode && onAssign ? (
              <button
                type="button"
                disabled={assignPending}
                onClick={onAssign}
                className={cn(
                  templateCardActionBtnClass,
                  isApplied
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:border-emerald-300 hover:bg-emerald-100'
                    : 'border-emerald-200 bg-emerald-50/80 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100',
                )}
              >
                {isApplied ? (
                  <>
                    <Check className="h-3 w-3" />
                    Manage
                  </>
                ) : needsActivation ? (
                  <>
                    <Store className="h-3 w-3" />
                    Activate
                  </>
                ) : (
                  <>
                    <Store className="h-3 w-3" />
                    Assign
                  </>
                )}
              </button>
            ) : null}
            <Link
              to={`/websites/${site.id}`}
              onClick={e => e.stopPropagation()}
              className={cn(
                templateCardActionBtnClass,
                'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50',
              )}
            >
              <Globe className="h-3 w-3" />
              Edit
            </Link>
            <AppliedTemplateViewLiveButton links={viewLiveLinks} templateName={site.name} />
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
              <Eye className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
