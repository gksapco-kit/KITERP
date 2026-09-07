import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { DonutChart, type CatDatum } from '@/components/charts/reportCharts'
import { Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { filtersToParams, type ProcurementReportFilters } from '../useProcurementReportFilters'

const DOC_OPTIONS = [
  { value: '', label: 'All Document Types' },
  { value: 'PO', label: 'Purchase Orders' },
  { value: 'PR', label: 'Purchase Requisitions' },
  { value: 'Invoice', label: 'Vendor Invoices' },
]

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  approved: { label: 'Approved', cls: 'text-green-600 bg-green-100 dark:bg-green-950/30' },
  rejected: { label: 'Rejected', cls: 'text-red-500 bg-red-100 dark:bg-red-950/30' },
  pending:  { label: 'Pending',  cls: 'text-amber-600 bg-amber-100 dark:bg-amber-950/30' },
}

const AGING_CFG: Record<string, string> = {
  '< 24h':    'bg-green-100 text-green-700',
  '1–3 days': 'bg-yellow-100 text-yellow-700',
  '3–7 days': 'bg-orange-100 text-orange-700',
  '> 7 days': 'bg-red-100 text-red-600',
}

interface TurnaroundRow {
  doc_type: string; level: number; pending: number; approved: number; rejected: number; avg_hours: number | null
}
interface AgingBucket { bucket: string; count: number }

export function ApprovalTurnaroundTab({ filters, refreshKey = 0 }: { filters: ProcurementReportFilters; refreshKey?: number }) {
  const [docType, setDocType] = useState('')
  const params = filtersToParams(filters, { doc_type: docType || undefined })
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vendor', 'proc-analytics-approval-turnaround', params, refreshKey],
    queryFn: () => vendorApi.procurementAnalyticsApprovalTurnaround(params),
  })

  const turnaround: TurnaroundRow[] = data?.turnaround ?? []
  const pendingTotal: number = data?.pending_total ?? 0
  const pendingAging: AgingBucket[] = data?.pending_aging ?? []

  const donutData: CatDatum[] = pendingAging.filter((b) => b.count > 0).map((b) => ({ label: b.bucket, value: b.count }))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={docType} onChange={setDocType} options={DOC_OPTIONS} className="w-52" />
        <div className="ml-auto">
          <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Pending summary */}
      <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/20 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-amber-700">Total Pending Approvals</p>
          <p className="text-3xl font-bold text-amber-800">{pendingTotal}</p>
        </div>
        {donutData.length > 0 && (
          <div className="w-32">
            <DonutChart data={donutData} height={100} compact money={false} />
          </div>
        )}
      </div>

      {/* Aging pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {pendingAging.map((b) => (
          <div key={b.bucket} className={cn('rounded-lg border p-3', AGING_CFG[b.bucket] ?? 'bg-gray-100 text-gray-600')}>
            <p className="text-xs font-medium">{b.bucket}</p>
            <p className="text-2xl font-bold">{b.count}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Doc Type</th>
                    <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Level</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Approved</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Rejected</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Pending</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Avg Turnaround</th>
                  </tr>
                </thead>
                <tbody>
                  {turnaround.map((row, idx) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 px-3">
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-muted">{row.doc_type}</span>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">Level {row.level}</td>
                      <td className="py-2 px-3 text-right">
                        <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded', STATUS_CFG.approved.cls)}>{row.approved}</span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded', STATUS_CFG.rejected.cls)}>{row.rejected}</span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded', STATUS_CFG.pending.cls)}>{row.pending}</span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {row.avg_hours != null ? `${row.avg_hours} hrs` : '—'}
                      </td>
                    </tr>
                  ))}
                  {turnaround.length === 0 && (
                    <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">No approval data for this period</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
