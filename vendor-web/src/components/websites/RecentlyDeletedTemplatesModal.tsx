import { useCallback, useState } from 'react'
import { Trash2, X, Loader2, RotateCcw, AlertTriangle, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import {
  useTrashedSites,
  useRestoreSite,
  usePermanentlyDeleteSite,
  useWebsiteTemplates,
} from '@/hooks/useWebsites'
import { WebsiteSiteGlimpse } from '@/components/websites/WebsiteSiteGlimpse'
import { openBuilderSiteDraftPreview } from '@/lib/openBuilderSiteDraftPreview'
import { extractApiError } from '@/lib/errorMessages'
import { useVendorStore } from '@/stores/vendorStore'
import { toast } from 'sonner'
import type { SiteTrashItem, WebsiteTemplate } from '@/types/websites'

function TrashRow({
  item,
  vendorSlug,
  templates,
  onPreview,
  onRestore,
  onPermanentDelete,
  previewing,
  restoring,
  deleting,
}: {
  item: SiteTrashItem
  vendorSlug?: string | null
  templates: WebsiteTemplate[]
  onPreview: (id: string) => void
  onRestore: (id: string, name: string) => void
  onPermanentDelete: (id: string, name: string) => void
  previewing: boolean
  restoring: boolean
  deleting: boolean
}) {
  const busy = restoring || deleting || previewing
  const subtitle = item.applied_template_name?.trim() || item.description?.trim() || null

  return (
    <li className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card">
      <button
        type="button"
        aria-label={`Preview ${item.name}`}
        disabled={busy}
        onClick={() => onPreview(item.id)}
        className="group/glimpse relative w-32 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 shadow-sm transition hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border"
      >
        <div className="relative aspect-[16/10] w-full">
          <WebsiteSiteGlimpse
            siteId={item.id}
            vendorSlug={vendorSlug}
            templates={templates}
            variant="card"
            scaleMode="cover"
            className="absolute inset-0"
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover/glimpse:bg-black/35">
          {previewing ? (
            <Loader2 className="h-5 w-5 animate-spin text-white opacity-0 transition group-hover/glimpse:opacity-100" />
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[10px] font-semibold text-white opacity-0 transition group-hover/glimpse:opacity-100">
              <Eye className="h-3 w-3" />
              Preview
            </span>
          )}
        </div>
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-foreground">{item.name}</h3>
          {item.is_published && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
              Was published
            </span>
          )}
        </div>
        {subtitle && (
          <p className="mt-0.5 truncate text-xs text-gray-500">{subtitle}</p>
        )}
        <p className="mt-1.5 text-xs text-gray-500">
          {item.page_count} page{item.page_count === 1 ? '' : 's'}
          <span className="mx-1.5 text-gray-300">·</span>
          {item.days_remaining <= 0
            ? 'Purging soon'
            : `${item.days_remaining} day${item.days_remaining === 1 ? '' : 's'} left to restore`}
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row sm:items-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => onRestore(item.id, item.name)}
          className="border-primary/30 text-primary hover:bg-accent"
        >
          {restoring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 mr-1" />}
          Restore
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => onPermanentDelete(item.id, item.name)}
          className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
          Delete permanently
        </Button>
      </div>
    </li>
  )
}

export function RecentlyDeletedTemplatesModal({ onClose }: { onClose: () => void }) {
  const vendorSlug = useVendorStore(s => s.vendor?.slug)
  const { data: websiteTemplates = [] } = useWebsiteTemplates()
  const { data: items = [], isLoading, isError, error, refetch, isFetching } = useTrashedSites()
  const loadError = isError ? extractApiError(error, 'Could not load recently deleted items') : null
  const restoreSite = useRestoreSite()
  const permanentlyDeleteSite = usePermanentlyDeleteSite()
  const [previewingId, setPreviewingId] = useState<string | null>(null)

  useEscapeToClose(onClose, true)

  const handlePreview = useCallback(async (id: string) => {
    if (previewingId) return
    setPreviewingId(id)
    try {
      await openBuilderSiteDraftPreview(id)
    } finally {
      setPreviewingId(null)
    }
  }, [previewingId])

  const handleRestore = useCallback(async (id: string, name: string) => {
    try {
      await restoreSite.mutateAsync(id)
      toast.success(`"${name}" restored to Business Website Builder`)
    } catch (err) {
      toast.error(extractApiError(err, 'Could not restore template'))
    }
  }, [restoreSite])

  const handlePermanentDelete = useCallback(async (id: string, name: string) => {
    if (!confirm(`Permanently delete "${name}"? This cannot be undone.`)) return
    try {
      await permanentlyDeleteSite.mutateAsync(id)
      toast.success(`"${name}" permanently deleted`)
    } catch (err) {
      toast.error(extractApiError(err, 'Could not delete permanently'))
    }
  }, [permanentlyDeleteSite])

  const restoringId = restoreSite.isPending ? restoreSite.variables : null
  const deletingId = permanentlyDeleteSite.isPending ? permanentlyDeleteSite.variables : null

  return (
    <div
      data-kiterp-modal
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(90vh,820px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-border dark:bg-card"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4 dark:border-border">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-foreground">Recently deleted</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Deleted websites and templates stay here for 30 days, then are removed permanently.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50/80 px-6 py-2.5 text-xs text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Restore anytime within 30 days, or delete permanently now if you are sure.
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-gray-700">Could not load recently deleted</p>
              <p className="mt-1 max-w-sm text-xs text-gray-500">{loadError}</p>
              <p className="mt-3 max-w-sm text-xs text-gray-500">
                If you just updated the app, restart the backend server so site trash is enabled.
                Sites deleted before that update were removed permanently and will not appear here.
              </p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                <Trash2 className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-gray-700">Nothing in recently deleted</p>
              <p className="mt-1 max-w-sm text-xs text-gray-500">
                When you delete a website or template, it will appear here for 30 days before being removed permanently.
              </p>
              <p className="mt-3 max-w-sm text-xs text-gray-500">
                Only sites deleted after the Recently deleted feature was enabled are kept here.
                Older deletes were permanent and cannot be restored.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map(item => (
                <TrashRow
                  key={item.id}
                  item={item}
                  vendorSlug={vendorSlug}
                  templates={websiteTemplates}
                  onPreview={id => void handlePreview(id)}
                  onRestore={handleRestore}
                  onPermanentDelete={handlePermanentDelete}
                  previewing={previewingId === item.id}
                  restoring={restoringId === item.id}
                  deleting={deletingId === item.id}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-6 py-3 dark:border-border">
          <p className="text-xs text-gray-500">
            {loadError ? 'Could not load trash' : `${items.length} item${items.length === 1 ? '' : 's'} in trash`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isFetching}
              onClick={() => void refetch()}
              className="border-primary/30 text-primary hover:bg-accent"
            >
              {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Refresh'}
            </Button>
            <Button type="button" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
