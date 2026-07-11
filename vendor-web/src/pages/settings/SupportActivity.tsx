import { useState } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, HelpCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TablePagination } from '@/components/table/TablePagination'
import { fetchVendorPlatformAudit } from '@/api/platformAudit'

const ACTION_LABELS: Record<string, string> = {
  vendor_handoff_redeemed: 'Signed in via admin handoff',
  platform_staff_api_write: 'API change (support session)',
}

function formatDetail(detail: Record<string, unknown> | null | undefined): string {
  if (!detail || typeof detail !== 'object') return '—'
  if (typeof detail.source === 'string' && detail.source) {
    return detail.source
  }
  const method = detail.method
  const path = detail.path
  const status = detail.status_code
  if (method != null && path != null) {
    return `${method} ${path}${status != null ? ` → ${status}` : ''}`
  }
  try {
    return JSON.stringify(detail)
  } catch {
    return '—'
  }
}

export default function SupportActivityPage() {
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendor-platform-audit', page, pageSize],
    queryFn: () => fetchVendorPlatformAudit(page * pageSize, pageSize),
  })

  const rows = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const subtitle =
    'Actions performed by platform support while signed into this business, plus dashboard handoffs from the admin portal.'

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/settings">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Settings
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-muted-foreground" />
            Platform support activity
          </CardTitle>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-16 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : isError ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm">
              <p className="font-medium text-destructive">Could not load audit log</p>
              <p className="text-muted-foreground mt-1">{String((error as Error)?.message ?? error)}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>
                Retry
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No platform support activity recorded for this business yet.
            </p>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="p-3 font-medium whitespace-nowrap"><TableColumnLabel>When</TableColumnLabel></th>
                      <th className="p-3 font-medium"><TableColumnLabel>Action</TableColumnLabel></th>
                      <th className="p-3 font-medium"><TableColumnLabel>Actor</TableColumnLabel></th>
                      <th className="p-3 font-medium min-w-[200px]"><TableColumnLabel>Detail</TableColumnLabel></th>
                      <th className="p-3 font-medium whitespace-nowrap"><TableColumnLabel>IP</TableColumnLabel></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="p-3 whitespace-nowrap text-muted-foreground text-xs align-top">
                          {new Date(r.created_at).toLocaleString()}
                        </td>
                        <td className="p-3 align-top">{ACTION_LABELS[r.action] ?? r.action}</td>
                        <td className="p-3 align-top">
                          {r.actor_email ?? (r.actor_user_id ? `${r.actor_user_id.slice(0, 8)}…` : '—')}
                        </td>
                        <td className="p-3 text-xs font-mono text-muted-foreground break-all align-top">
                          {formatDetail(r.detail ?? undefined)}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap align-top">
                          {r.ip ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {total > 0 && (
                <TablePagination
                  page={page + 1}
                  pages={totalPages}
                  total={total}
                  pageSize={pageSize}
                  onPageChange={(p) => setPage(Math.max(0, p - 1))}
                  onPageSizeChange={(s) => { setPageSize(s); setPage(0) }}
                  itemLabel="events"
                  className="border-0 bg-transparent px-0"
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
