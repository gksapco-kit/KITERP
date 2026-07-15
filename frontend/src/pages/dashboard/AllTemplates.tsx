import { useCallback, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  LayoutTemplate,
  Loader2,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  Store,
  Clock,
  Globe,
  FileText,
  Calendar,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/authStore'
import { isSuperuserAdmin } from '@/lib/platformAccess'
import { buildAdminDraftPreviewUrl } from '@/lib/appUrls'
import { cn, mediaUrl } from '@/lib/utils'
import {
  useAdminWebsiteTemplates,
  usePublishWebsiteTemplate,
  useUnpublishWebsiteTemplate,
  useSyncWebsiteTemplate,
  useCreateWebsiteTemplatePreview,
} from '@/hooks/useAdmin'
import type { AdminWebsiteTemplateRow } from '@/api/admin.api'

const selectCls =
  'h-9 rounded-md border border-gray-200 bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary'

function formatShortDate(value?: string | null) {
  if (!value) return '—'
  try {
    return format(new Date(value), 'MMM d, yy')
  } catch {
    return '—'
  }
}

function statusChip(row: AdminWebsiteTemplateRow) {
  if (row.catalog_published) {
    return {
      label: 'In catalog',
      className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      Icon: CheckCircle2,
    }
  }
  if (row.needs_sync) {
    return {
      label: 'Sync available',
      className: 'bg-orange-50 text-orange-800 border-orange-200',
      Icon: RefreshCw,
    }
  }
  if (row.list_bucket === 'assigned') {
    return {
      label: 'Assigned',
      className: 'bg-blue-50 text-blue-800 border-blue-200',
      Icon: Store,
    }
  }
  return {
    label: 'Draft',
    className: 'bg-violet-50 text-violet-800 border-violet-200',
    Icon: LayoutTemplate,
  }
}

type TemplateCardProps = {
  row: AdminWebsiteTemplateRow
  busy: boolean
  previewing: boolean
  onPreview: () => void
  onPublish: () => void
  onUnpublish: () => void
  onSync: () => void
}

function AdminTemplateCard({
  row,
  busy,
  previewing,
  onPreview,
  onPublish,
  onUnpublish,
  onSync,
}: TemplateCardProps) {
  const chip = statusChip(row)
  const thumb = row.thumbnail ? mediaUrl(row.thumbnail) : null
  const StatusIcon = chip.Icon

  return (
    <div className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md">
      {/* Thumbnail */}
      <div
        role="button"
        tabIndex={0}
        className="relative aspect-[16/10] cursor-pointer overflow-hidden rounded-t-xl bg-gradient-to-br from-slate-100 via-emerald-50 to-teal-100"
        onClick={onPreview}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onPreview()
          }
        }}
      >
        {thumb ? (
          <img
            src={thumb}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-top"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <LayoutTemplate className="h-10 w-10 text-primary/30" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-black/0 transition-all group-hover:bg-black/10" />
        <div
          className={cn(
            'absolute left-2 top-2 flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
            chip.className,
          )}
        >
          <StatusIcon className="h-2.5 w-2.5" />
          {chip.label}
        </div>
        {row.catalog_published && row.needs_sync && (
          <div className="absolute right-2 top-2 rounded-full border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-800">
            Sync
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5">
        <h3 className="truncate text-sm font-bold leading-tight text-gray-900" title={row.name}>
          {row.name}
        </h3>

        <div className="mt-2">
          <span
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-800"
            title={row.vendor_email ? `${row.vendor_name} · ${row.vendor_email}` : row.vendor_name}
          >
            <Store className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{row.vendor_name}</span>
          </span>
        </div>

        <div className="mt-2 flex items-center gap-2 border-t border-gray-100 pt-2 text-[10px] text-gray-500">
          <span className="flex items-center gap-0.5">
            <FileText className="h-2.5 w-2.5" />
            {row.page_count} pg{row.page_count !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-0.5 truncate">
            <Calendar className="h-2.5 w-2.5 shrink-0" />
            {formatShortDate(row.content_updated_at)}
          </span>
        </div>

        <div className="mt-2 grid grid-cols-1 gap-1.5">
          <div className="flex gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 min-w-0 flex-1 px-2 text-[11px]"
              disabled={previewing || busy}
              onClick={onPreview}
            >
              {previewing ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Eye className="mr-1 h-3 w-3" />
              )}
              {previewing ? 'Opening…' : 'Preview'}
            </Button>
            {row.needs_sync ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 w-7 shrink-0 px-0"
                disabled={busy}
                title="Sync catalog"
                aria-label="Sync catalog"
                onClick={onSync}
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            ) : null}
          </div>
          {row.catalog_published ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-full px-2 text-[11px]"
              disabled={busy}
              onClick={onUnpublish}
            >
              <XCircle className="mr-1 h-3 w-3" />
              Unpublish
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              className="h-7 w-full bg-primary px-2 text-[11px] text-white hover:bg-primary/90"
              disabled={busy}
              onClick={onPublish}
            >
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Publish
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AllTemplates() {
  const { user } = useAuthStore()
  const isSuperuser = isSuperuserAdmin(user)

  const [view, setView] = useState<'assigned' | 'draft' | 'all'>('all')
  const [search, setSearch] = useState('')
  const [previewingSiteId, setPreviewingSiteId] = useState<string | null>(null)
  const previewInFlightRef = useRef(false)

  const { data, isLoading, isError, error, refetch, isFetching } = useAdminWebsiteTemplates(
    {
      view,
      search: search.trim() || undefined,
    },
    { enabled: isSuperuser },
  )
  const publishMut = usePublishWebsiteTemplate()
  const unpublishMut = useUnpublishWebsiteTemplate()
  const syncMut = useSyncWebsiteTemplate()
  const previewMut = useCreateWebsiteTemplatePreview()

  const stats = data?.stats
  const items = data?.items ?? []

  const errMessage = useMemo(() => {
    const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
    if (typeof detail === 'string') return detail
    return 'Could not load website templates.'
  }, [error])

  const openPreview = useCallback(
    async (siteId: string) => {
      if (previewInFlightRef.current) return
      previewInFlightRef.current = true
      // Open synchronously from the click — async `window.open` after await is blocked.
      const previewTab = window.open('about:blank', 'kiterp-admin-template-preview')
      setPreviewingSiteId(siteId)
      try {
        const result = await previewMut.mutateAsync(siteId)
        const url = buildAdminDraftPreviewUrl(
          result.preview_token,
          result.page_slug,
          result.vendor_slug,
        )
        if (previewTab && !previewTab.closed) {
          previewTab.location.replace(url)
          previewTab.focus()
          return
        }
        const tab = window.open(url, 'kiterp-admin-template-preview')
        if (tab) {
          tab.focus()
          return
        }
        try {
          await navigator.clipboard.writeText(url)
          toast.error('Pop-up blocked. Preview link copied — paste it into a new tab.', {
            duration: 8000,
          })
        } catch {
          toast.error(`Could not open preview. Open this URL manually: ${url}`, {
            duration: 12000,
          })
        }
      } catch {
        try {
          previewTab?.close()
        } catch {
          /* ignore */
        }
        // Error toast handled by mutation
      } finally {
        previewInFlightRef.current = false
        setPreviewingSiteId(null)
      }
    },
    [previewMut.mutateAsync],
  )

  const busy =
    publishMut.isPending ||
    unpublishMut.isPending ||
    syncMut.isPending

  if (!isSuperuser) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Templates</h1>
          <p className="mt-1 text-gray-600">
            Review website builder designs from every business account. Publish approved templates
            so any vendor can use them under Business Website Templates.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {[
          { name: 'Total templates', value: stats?.total ?? 0, icon: LayoutTemplate, color: 'bg-blue-500' },
          { name: 'Published', value: stats?.published ?? 0, icon: Globe, color: 'bg-green-500' },
          { name: 'Needs sync', value: stats?.needs_sync ?? 0, icon: Clock, color: 'bg-yellow-500' },
        ].map((stat) => (
          <Card key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{stat.name}</CardTitle>
              <div className={`rounded-lg p-2 ${stat.color}`}>
                <stat.icon className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? '...' : stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Website builder templates</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Show</span>
            <select
              value={view}
              onChange={(e) => setView(e.target.value as 'assigned' | 'draft' | 'all')}
              className={selectCls}
              aria-label="Template list filter"
            >
              <option value="all">All templates</option>
              <option value="assigned">Assigned templates</option>
              <option value="draft">Draft templates</option>
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or business…"
              className="h-9 min-w-[12rem] rounded-md border border-gray-200 bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {errMessage}
            </div>
          )}
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading templates…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-500">
              No website builder templates in this view yet. When a business creates a site in the
              Website Builder, it will appear here.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((row) => (
                <AdminTemplateCard
                  key={row.site_id}
                  row={row}
                  busy={busy}
                  previewing={previewingSiteId === row.site_id}
                  onPreview={() => void openPreview(row.site_id)}
                  onPublish={() => publishMut.mutate(row.site_id)}
                  onUnpublish={() => unpublishMut.mutate(row.site_id)}
                  onSync={() => syncMut.mutate(row.site_id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
