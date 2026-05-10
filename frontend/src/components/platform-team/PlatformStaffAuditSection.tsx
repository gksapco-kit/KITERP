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
}

export function PlatformStaffAuditSection({ scope, memberUserId, title = 'Audit history' }: Props) {
  const [page, setPage] = useState(1)
  const size = 15
  const { data, isLoading, isError } = usePlatformStaffAudit(scope, memberUserId, page, size)

  useEffect(() => {
    setPage(1)
  }, [memberUserId, scope])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-6 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading…
          </div>
        )}
        {isError && <p className="text-sm text-destructive">Could not load audit history.</p>}
        {!isLoading && !isError && data && (
          <>
            {data.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events recorded yet.</p>
            ) : (
              <div className="overflow-x-auto border rounded-md">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="p-2 font-medium">When</th>
                      <th className="p-2 font-medium">Event</th>
                      <th className="p-2 font-medium">Actor</th>
                      <th className="p-2 font-medium">Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((row) => {
                      const summary = summarizeDetail(row.action, row.detail ?? undefined)
                      return (
                        <tr key={row.id} className="border-b last:border-0">
                          <td className="p-2 whitespace-nowrap text-muted-foreground">
                            {formatWhen(row.created_at)}
                          </td>
                          <td className="p-2">{ACTION_LABELS[row.action] ?? row.action}</td>
                          <td className="p-2">{row.actor_full_name || row.actor_user_id || '—'}</td>
                          <td className="p-2 text-muted-foreground max-w-[240px] truncate" title={summary}>
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
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  Page {data.page} of {data.pages} ({data.total} total)
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
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
      </CardContent>
    </Card>
  )
}
