import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { DonutChart, type CatDatum } from '@/components/charts/reportCharts'
import { Loader2, RefreshCw, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { filtersToParams, type ProcurementReportFilters } from '../useProcurementReportFilters'
import { exportCSV } from '@/pages/inventory/analytics/exportUtils'

const INR = '₹'
function fmt(n: number) {
  if (n >= 1e7) return `${INR}${(n / 1e7).toFixed(2)} Cr`
  if (n >= 1e5) return `${INR}${(n / 1e5).toFixed(2)} L`
  return `${INR}${n.toFixed(2)}`
}

const REASON_OPTIONS = [
  { value: '', label: 'All Reasons' },
  { value: 'quality_rejection', label: 'Quality Rejection' },
  { value: 'wrong_item', label: 'Wrong Item' },
  { value: 'excess_delivery', label: 'Excess Delivery' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'other', label: 'Other' },
]

const REASON_CFG: Record<string, string> = {
  quality_rejection: 'bg-red-100 text-red-700',
  wrong_item:        'bg-orange-100 text-orange-700',
  excess_delivery:   'bg-yellow-100 text-yellow-700',
  damaged:           'bg-rose-100 text-rose-700',
  other:             'bg-gray-100 text-gray-600',
}

interface ReturnItem {
  id: string; supplier_id: string | null; supplier_name: string
  return_reason: string; status: string; total: number; created_at: string | null
}

export function ReturnsTab({
  filters,
  setFilters,
  refreshKey = 0,
}: {
  filters: ProcurementReportFilters
  setFilters: (patch: Partial<ProcurementReportFilters>) => void
  refreshKey?: number
}) {
  const [reason, setReason] = useState('')
  const params = filtersToParams(filters, { return_reason: reason || undefined, limit: 500 })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vendor', 'proc-analytics-returns', params, refreshKey],
    queryFn: () => vendorApi.procurementAnalyticsReturns(params),
  })

  const items: ReturnItem[] = data?.items ?? []
  const byReason: { reason: string; count: number; value: number }[] = data?.by_reason ?? []
  const bySupplier: { supplier_id: string | null; name: string; count: number; value: number }[] = data?.by_supplier ?? []
  const totalValue: number = data?.total_value ?? 0

  const donutData: CatDatum[] = byReason.map((r) => ({
    label: r.reason.replace('_', ' '),
    value: r.value,
  }))

  function doExport() {
    exportCSV(
      'purchase-returns.csv',
      ['Supplier', 'Reason', 'Status', 'Total', 'Date'],
      items.map((i) => [i.supplier_name, i.return_reason, i.status, i.total, i.created_at ?? '']),
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={reason} onChange={setReason} options={REASON_OPTIONS} className="w-48" />
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={doExport}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
          <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Total */}
      <div className="rounded-xl border bg-red-50 dark:bg-red-950/20 px-4 py-3 inline-block">
        <p className="text-xs text-red-600 font-medium">Total Return Value</p>
        <p className="text-2xl font-bold text-red-700">{fmt(totalValue)}</p>
        <p className="text-xs text-muted-foreground">{data?.total ?? 0} returns</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4 items-start">
          {/* By reason donut */}
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">By Return Reason</p>
              {donutData.length > 0
                ? <DonutChart data={donutData} height={200} money />
                : <div className="py-8 text-center text-xs text-muted-foreground">No data</div>
              }
            </CardContent>
          </Card>

          {/* Top suppliers */}
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Top Suppliers by Return Value</p>
              <div className="space-y-2">
                {bySupplier.slice(0, 8).map((sup) => (
                  <div key={sup.supplier_id ?? sup.name} className="flex justify-between text-sm">
                    <span className="truncate max-w-[150px]">{sup.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{fmt(sup.value)} · {sup.count}</span>
                  </div>
                ))}
                {bySupplier.length === 0 && <p className="text-xs text-muted-foreground">No data</p>}
              </div>
            </CardContent>
          </Card>

          {/* Recent returns list */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-y-auto max-h-64">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 sticky top-0">
                      <th className="py-1.5 px-3 text-left text-xs font-medium text-muted-foreground">Supplier</th>
                      <th className="py-1.5 px-3 text-left text-xs font-medium text-muted-foreground">Reason</th>
                      <th className="py-1.5 px-3 text-right text-xs font-medium text-muted-foreground">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.slice(0, 50).map((item) => (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="py-1.5 px-3 max-w-[120px] truncate text-xs">{item.supplier_name}</td>
                        <td className="py-1.5 px-3">
                          <span className={cn('text-xs px-1 py-0.5 rounded', REASON_CFG[item.return_reason] ?? 'bg-gray-100 text-gray-600')}>
                            {item.return_reason.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-xs">{fmt(item.total)}</td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr><td colSpan={3} className="py-8 text-center text-xs text-muted-foreground">No returns</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
