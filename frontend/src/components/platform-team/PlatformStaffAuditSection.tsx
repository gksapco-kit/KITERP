import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { usePlatformStaffAudit } from '@/hooks/usePlatformStaff'
import { Loader2 } from 'lucide-react'

const ACTION_LABELS: Record<string, string> = {
  platform_login: 'Signed in (platform)',
  support_access_created: 'Support access granted',
  support_profile_updated: 'Profile or role updated',
  support_access_removed: 'Platform access removed',
  support_password_reset: 'Password reset (admin)',
  vendor_dashboard_handoff: 'Opened vendor dashboard (handoff)',
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function summarizeDetail(action: string, detail: Record<string, unknown> | null | undefined): string {
  if (!detail) return '—'
  if (action === 'support_profile_updated') {
    const ch = detail.changes
    if (ch && typeof ch === 'object') {
      return Object.keys(ch as object).join(', ')
    }
  }
  if (action === 'support_access_created') {
    const parts: string[] = []
    if (detail.job_role) parts.push(String(detail.job_role))
    if (detail.converted_existing_user) parts.push('existing user upgraded')
    return parts.length ? parts.join(' · ') : '—'
  }
  return '—'
}

type Props = {
  scope: 'me' | 'member'
  memberUserId?: string
  title?: string
  /** Smaller page size and denser rows */
  compact?: boolean
  /** Render table only (parent provides card/title) */
  embedded?: boolean
}

export function PlatformStaffAuditSection({
  scope,
  memberUserId,
  title = 'Audit history',
  compact = false,
  embedded = false,
}: Props) {
  const [page, setPage] = useState(1)
  const size = compact ? 8 : 15
  const { data, isLoading, isError } = usePlatformStaffAudit(scope, memberUserId, page, size)

  useEffect(() => {
    setPage(1)
  }, [memberUserId, scope])

  const body = (
    <>
      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-4 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading…
        </div>
      )}
      {isError && <p className="text-sm text-destructive">Could not load audit history.</p>}
      {!isLoading && !isError && data && (
        <>
          {data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events recorded yet.</p>
          ) : (
            <div
              className={
                embedded
                  ? 'border rounded-md overflow-auto max-h-[min(22rem,calc(100vh-18rem))] lg:max-h-none lg:h-full'
                  : 'overflow-x-auto border rounded-md'
              }
            >
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/95 backdrop-blur z-10">
                  <tr className="border-b text-left">
                    <th className="p-1.5 font-medium">When</th>
                    <th className="p-1.5 font-medium">Event</th>
                    <th className="p-1.5 font-medium">Actor</th>
                    <th className="p-1.5 font-medium">Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => {
                    const summary = summarizeDetail(row.action, row.detail ?? undefined)
                    return (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="p-1.5 whitespace-nowrap text-muted-foreground text-xs">
                          {formatWhen(row.created_at)}
                        </td>
                        <td className="p-1.5 text-xs">{ACTION_LABELS[row.action] ?? row.action}</td>
                        <td className="p-1.5 text-xs">{row.actor_full_name || row.actor_user_id || '—'}</td>
                        <td
                          className="p-1.5 text-xs text-muted-foreground max-w-[180px] truncate"
                          title={summary}
                        >
                          {summary}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {data.pages > 1 && (
            <div className="flex items-center justify-between gap-2 flex-wrap pt-2">
              <p className="text-xs text-muted-foreground">
                Page {data.page} of {data.pages} ({data.total} total)
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7"
                  disabled={page >= data.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )

  if (embedded) {
    return <div className="h-full min-h-0 flex flex-col gap-2">{body}</div>
  }

  return (
    <Card>
      {title ? (
        <CardHeader className={compact ? 'px-4 py-2.5 space-y-0' : undefined}>
          <CardTitle className={compact ? 'text-base' : undefined}>{title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className={compact ? 'px-4 pb-3 pt-0 space-y-2' : 'space-y-4'}>{body}</CardContent>
    </Card>
  )
}
