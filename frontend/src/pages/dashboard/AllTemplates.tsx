import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
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
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/authStore'
import { isSuperuserAdmin } from '@/lib/platformAccess'
import {
  useAdminWebsiteTemplates,
  useAdminWebsiteTemplate,
  usePublishWebsiteTemplate,
  useUnpublishWebsiteTemplate,
  useSyncWebsiteTemplate,
} from '@/hooks/useAdmin'
import type { AdminWebsiteTemplateBucket, AdminWebsiteTemplateRow } from '@/api/admin.api'

const selectCls =
  'h-9 rounded-md border border-gray-200 bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary'

function formatWhen(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function catalogBadge(row: AdminWebsiteTemplateRow) {
  if (row.catalog_published) {
    return { label: 'Published', className: 'bg-green-100 text-green-700' }
  }
  if (row.platform_template_id) {
    return { label: 'Not published', className: 'bg-yellow-100 text-yellow-800' }
  }
  return { label: 'Not published', className: 'bg-gray-100 text-gray-600' }
}

function bucketBadge(bucket: AdminWebsiteTemplateBucket) {
  if (bucket === 'assigned') {
    return { label: 'Assigned', className: 'bg-blue-100 text-blue-700' }
  }
  return { label: 'Draft', className: 'bg-amber-50 text-amber-800' }
}

export default function AllTemplates() {
  const { user } = useAuthStore()
  const isSuperuser = isSuperuserAdmin(user)

  const [view, setView] = useState<'assigned' | 'draft' | 'all'>('all')
  const [search, setSearch] = useState('')
  const [openSiteId, setOpenSiteId] = useState<string | null>(null)

  const { data, isLoading, isError, error, refetch, isFetching } = useAdminWebsiteTemplates(
    {
      view,
      search: search.trim() || undefined,
    },
    { enabled: isSuperuser },
  )
  const detailQuery = useAdminWebsiteTemplate(isSuperuser ? openSiteId : null)
  const publishMut = usePublishWebsiteTemplate()
  const unpublishMut = useUnpublishWebsiteTemplate()
  const syncMut = useSyncWebsiteTemplate()

  const stats = data?.stats
  const items = data?.items ?? []

  const errMessage = useMemo(() => {
    const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
    if (typeof detail === 'string') return detail
    return 'Could not load website templates.'
  }, [error])

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
            <div className="space-y-3">
              {items.map((row) => {
                const cat = catalogBadge(row)
                const bucket = bucketBadge(row.list_bucket)
                return (
                  <div
                    key={row.site_id}
                    className="flex flex-col gap-3 border-b py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">{row.name}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${bucket.className}`}>
                          {bucket.label}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cat.className}`}>
                          {cat.label}
                        </span>
                        {row.needs_sync && (
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                            Sync available
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                        <Store className="h-3 w-3" />
                        {row.vendor_name}
                        {row.vendor_email ? ` · ${row.vendor_email}` : ''}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {row.page_count} pages · Updated {formatWhen(row.content_updated_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setOpenSiteId(row.site_id)}
                      >
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        Open
                      </Button>
                      {row.needs_sync && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => syncMut.mutate(row.site_id)}
                        >
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                          Sync
                        </Button>
                      )}
                      {row.catalog_published ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => unpublishMut.mutate(row.site_id)}
                        >
                          <XCircle className="mr-1.5 h-3.5 w-3.5" />
                          Unpublish
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy}
                          onClick={() => publishMut.mutate(row.site_id)}
                        >
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                          Publish
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail modal */}
      {openSiteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {detailQuery.data?.name || 'Template'}
                </h2>
                <p className="text-sm text-gray-500">{detailQuery.data?.vendor_name}</p>
              </div>
              <button
                type="button"
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                onClick={() => setOpenSiteId(null)}
                aria-label="Close"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-4 text-sm">
              {detailQuery.isLoading ? (
                <p className="text-gray-500">Loading…</p>
              ) : detailQuery.data ? (
                <>
                  <p className="text-gray-600">
                    {detailQuery.data.description || 'No description provided.'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${bucketBadge(detailQuery.data.list_bucket).className}`}>
                      {bucketBadge(detailQuery.data.list_bucket).label}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${catalogBadge(detailQuery.data).className}`}>
                      {catalogBadge(detailQuery.data).label}
                    </span>
                    {detailQuery.data.needs_sync && (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                        Source changed — sync to update catalog
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="mb-1 font-medium text-gray-800">Pages</p>
                    <ul className="list-inside list-disc text-gray-600">
                      {(detailQuery.data.page_titles.length
                        ? detailQuery.data.page_titles
                        : ['(no pages yet)']
                      ).map((title) => (
                        <li key={title}>{title}</li>
                      ))}
                    </ul>
                  </div>
                  {detailQuery.data.platform_slug && (
                    <p className="text-xs text-gray-500">
                      Catalog id: <code>{detailQuery.data.platform_slug}</code>
                    </p>
                  )}
                  <p className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                    {detailQuery.data.note}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {detailQuery.data.needs_sync && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => syncMut.mutate(detailQuery.data!.site_id)}
                      >
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                        Sync recent changes
                      </Button>
                    )}
                    {detailQuery.data.catalog_published ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => unpublishMut.mutate(detailQuery.data!.site_id)}
                      >
                        Mark not published
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => publishMut.mutate(detailQuery.data!.site_id)}
                      >
                        Publish for all vendors
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-red-600">Failed to load template detail.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
