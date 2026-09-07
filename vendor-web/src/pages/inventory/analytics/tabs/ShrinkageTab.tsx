import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarsChart, type CatDatum } from '@/components/charts/reportCharts'
import { Loader2, RefreshCw, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { filtersToParams, type AnalyticsFilters } from '../useAnalyticsFilters'
import { exportCSV } from '../exportUtils'

const INR = '₹'
function fmt(n: number) {
  if (n >= 1e7) return `${INR}${(n / 1e7).toFixed(2)} Cr`
  if (n >= 1e5) return `${INR}${(n / 1e5).toFixed(2)} L`
  return `${INR}${n.toFixed(2)}`
}

const GROUP_OPTIONS = [
  { value: 'store',         label: 'By Store' },
  { value: 'movement_type', label: 'By Movement Type' },
]

const TYPE_CFG: Record<string, string> = {
  write_off:   'bg-red-100 text-red-700 dark:bg-red-950/30',
  adjustment:  'bg-amber-100 text-amber-700 dark:bg-amber-950/30',
  stock_count: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30',
}

interface ShrinkageItem {
  movement_type: string; store_id: string | null; store_name: string
  total_units: number; total_value: number; events: number
}
interface GroupedItem { label: string; total_units: number; total_value: number; events: number }

export function ShrinkageTab({
  filters,
  setFilters,
  refreshKey = 0,
}: {
  filters: AnalyticsFilters
  setFilters: (patch: Partial<AnalyticsFilters>) => void
  refreshKey?: number
}) {
  const groupBy = filters.group_by || 'store'
  const params = filtersToParams(filters, { group_by: groupBy })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vendor', 'inv-analytics-shrinkage', params, refreshKey],
    queryFn: () => vendorApi.inventoryAnalyticsShrinkage(params),
  })

  const d = data ?? {}
  const items: ShrinkageItem[] = d.items ?? []
  const grouped: GroupedItem[] = d.grouped ?? []
  const totalValue: number = d.total_value ?? 0
  const totalUnits: number = d.total_units ?? 0

  const chartData: CatDatum[] = grouped.slice(0, 15).map((g) => ({ label: g.label, value: g.total_value }))

  function doExport() {
    exportCSV(
      'shrinkage.csv',
      ['Movement Type', 'Store', 'Units', 'Value', 'Events'],
      items.map((i) => [i.movement_type, i.store_name, i.total_units, i.total_value, i.events]),
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-md border overflow-hidden">
          {GROUP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilters({ group_by: opt.value })}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors',
                groupBy === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={doExport}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
          <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Totals */}
      <div className="flex gap-4 rounded-lg border bg-red-50 dark:bg-red-950/20 px-4 py-3">
        <div>
          <p className="text-xs text-red-600 font-medium">Total Shrinkage Value</p>
          <p className="text-2xl font-bold text-red-700">{fmt(totalValue)}</p>
        </div>
        <div className="border-l pl-4">
          <p className="text-xs text-muted-foreground font-medium">Total Units Lost</p>
          <p className="text-2xl font-bold">{totalUnits.toLocaleString()}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid lg:grid-cols-5 gap-4 items-start">
          <Card className="lg:col-span-2">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-2">Shrinkage by {groupBy === 'store' ? 'Store' : 'Type'}</p>
              <BarsChart data={chartData} money />
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Type</th>
                      <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Store</th>
                      <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Units</th>
                      <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Value</th>
                      <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Events</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.slice(0, 100).map((item, idx) => (
                      <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 px-3">
                          <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', TYPE_CFG[item.movement_type] ?? 'bg-gray-100 text-gray-600')}>
                            {item.movement_type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-xs text-muted-foreground">{item.store_name}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs">{item.total_units.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs">{fmt(item.total_value)}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs">{item.events}</td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">No shrinkage recorded for this period</td></tr>
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
