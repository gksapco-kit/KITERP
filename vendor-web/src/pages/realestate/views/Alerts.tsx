import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { reApi } from '@/api/realestate'
import { EmptyState, fmtDate, humanize, statusVariant } from '../shared'

export default function Alerts() {
  const { data, isLoading, error } = useQuery({ queryKey: ['re-alerts'], queryFn: reApi.alerts, refetchInterval: 60_000 })
  if (isLoading) return <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
  if (error) return <EmptyState title="Could not load alerts" />
  if (!data?.items.length) return <EmptyState title="All clear" hint="No expiring documents, overdue follow-ups, or pending approvals." />
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {data.items.map((a, i) => (
        <li key={i} className="flex items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">{a.title}</p>
            <p className="text-xs text-muted-foreground">{a.detail}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge variant={statusVariant(a.severity)}>{humanize(a.severity)}</Badge>
            {a.due && <span className="text-[11px] text-muted-foreground">{fmtDate(a.due)}</span>}
          </div>
        </li>
      ))}
    </ul>
  )
}
