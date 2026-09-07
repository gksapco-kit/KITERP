import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { HBarsChart, type CatDatum } from '@/components/charts/reportCharts'
import { Loader2, Download, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { filtersToParams, type ProcurementReportFilters } from '../useProcurementReportFilters'
import { exportCSV } from '@/pages/inventory/analytics/exportUtils'

const INR = '₹'
function fmt(n: number) {
  if (n >= 1e7) return `${INR}${(n / 1e7).toFixed(2)} Cr`
  if (n >= 1e5) return `${INR}${(n / 1e5).toFixed(2)} L`
  return `${INR}${n.toFixed(2)}`
}

const GROUP_OPTIONS = [
  { value: 'supplier',      label: 'By Supplier' },
  { value: 'material_type', label: 'By Material Type' },
  { value: 'branch',        label: 'By Branch' },
  { value: 'plant',         label: 'By Plant' },
  { value: 'item_category', label: 'By Item Category' },
  { value: 'account',       label: 'By Account' },
]

const ABC_COLORS: Record<string, string> = {
  A: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40',
  B: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40',
  C: 'bg-gray-100 text-gray-600 dark:bg-gray-800/40',
}

interface SpendItem {
  dim: string | null; label: string; po_count: number
  spend: number; pct_of_total: number; cumulative_pct: number; abc_class: string
}

export function SpendTab({
  filters,
  setFilters,
  refreshKey = 0,
}: {
  filters: ProcurementReportFilters
  setFilters: (patch: Partial<ProcurementReportFilters>) => void
  refreshKey?: number
}) {
  const groupBy = filters.group_by || 'supplier'
  const params = filtersToParams(filters, { group_by: groupBy, limit: 500 })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vendor', 'proc-analytics-spend', params, refreshKey],
    queryFn: () => vendorApi.procurementAnalyticsSpend(params),
  })

  const d = data ?? {}
  const items: SpendItem[] = d.items ?? []
  const totalSpend: number = d.total_spend ?? 0

  const top20: CatDatum[] = items.slice(0, 20).map((i) => ({ label: i.label, value: i.spend }))

  function doExport() {
    exportCSV(
      'spend-analysis.csv',
      ['Label', 'PO Count', 'Spend', '% of Total', 'Cumulative %', 'ABC Class'],
      items.map((i) => [i.label, i.po_count, i.spend, i.pct_of_total, i.cumulative_pct, i.abc_class]),
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Select
          value={groupBy}
          onChange={(v) => setFilters({ group_by: v })}
          options={GROUP_OPTIONS}
          className="w-48"
        />
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={doExport}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
          <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Summary pill */}
      <div className="rounded-lg border bg-muted/30 px-4 py-2.5 flex items-center gap-6 text-sm">
        <span>Total spend: <strong className="font-mono">{fmt(totalSpend)}</strong></span>
        <span className="text-muted-foreground">{d.total ?? 0} items</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid lg:grid-cols-5 gap-4 items-start">
          {/* Chart */}
          <Card className="lg:col-span-2">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-2">Top 20 by spend</p>
              <HBarsChart data={top20} money />
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="lg:col-span-3">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">#</th>
                      <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">
                        {GROUP_OPTIONS.find((o) => o.value === groupBy)?.label.replace('By ', '')}
                      </th>
                      <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">POs</th>
                      <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Spend</th>
                      <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">% Total</th>
                      <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Cum. %</th>
                      <th className="py-2 px-3 text-center text-xs font-medium text-muted-foreground">ABC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.slice(0, 200).map((item, idx) => (
                      <tr key={item.dim ?? idx} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 px-3 text-muted-foreground text-xs">{idx + 1}</td>
                        <td className="py-2 px-3 font-medium max-w-[180px] truncate">{item.label}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs">{item.po_count}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs">{fmt(item.spend)}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs">{item.pct_of_total}%</td>
                        <td className="py-2 px-3 text-right font-mono text-xs">{item.cumulative_pct}%</td>
                        <td className="py-2 px-3 text-center">
                          <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded', ABC_COLORS[item.abc_class])}>
                            {item.abc_class}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">No spend data for this period</td></tr>
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
