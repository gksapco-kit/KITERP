import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { BarsChart, compactCurrency, type CatDatum } from '@/components/charts/reportCharts'
import { Loader2, RefreshCw, Download } from 'lucide-react'
import { filtersToParams, type AnalyticsFilters } from '../useAnalyticsFilters'
import { exportCSV } from '../exportUtils'

const INR = '₹'
function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

const BASIS_OPTIONS = [
  { value: 'all_outbound', label: 'All Outbound' },
  { value: 'sales', label: 'Sales Only' },
]

interface TurnoverItem {
  group: string
  cogs: number
  inventory_value: number
  turnover_ratio: number | null
  days_sales_of_inventory: number | null
}

export function TurnoverTab({
  filters,
  setFilters,
  refreshKey = 0,
}: {
  filters: AnalyticsFilters
  setFilters: (p: Partial<AnalyticsFilters>) => void
  refreshKey?: number
}) {
  const params = filtersToParams(filters, { basis: filters.basis })
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vendor', 'inv-analytics-turnover', params, refreshKey],
    queryFn: () => vendorApi.inventoryAnalyticsTurnover(params),
  })

  const d = data ?? {}
  const items: TurnoverItem[] = d.items ?? []

  const chartData: CatDatum[] = items.slice(0, 12).map((i) => ({ label: i.group, value: i.cogs }))

  function doExport() {
    exportCSV(
      'inventory-turnover.csv',
      ['Category', 'COGS', 'Inventory Value', 'Turnover Ratio', 'DSI (days)'],
      items.map((i) => [i.group, i.cogs, i.inventory_value, i.turnover_ratio ?? '', i.days_sales_of_inventory ?? '']),
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Basis</span>
        <Select
          value={filters.basis}
          onChange={(v) => setFilters({ basis: v as AnalyticsFilters['basis'] })}
          options={BASIS_OPTIONS}
          className="w-40"
        />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={doExport}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
          <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">COGS by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <BarsChart data={chartData} height={240} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/40">
                    <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Category</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">COGS</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Inv. Value</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Turnover</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">DSI</th>
                  </tr></thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.group} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 px-3 font-medium">{item.group}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs">{INR}{fmt(item.cogs)}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs">{INR}{fmt(item.inventory_value)}</td>
                        <td className="py-2 px-3 text-right font-semibold">
                          {item.turnover_ratio != null ? `${item.turnover_ratio}×` : '—'}
                        </td>
                        <td className="py-2 px-3 text-right text-muted-foreground text-xs">
                          {item.days_sales_of_inventory != null ? `${item.days_sales_of_inventory}d` : '—'}
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">No outbound movements in the selected period</td></tr>
                    )}
                  </tbody>
                  {items.length > 0 && (
                    <tfoot><tr className="border-t font-semibold bg-muted/20">
                      <td className="py-2 px-3">Total</td>
                      <td className="py-2 px-3 text-right font-mono text-xs">{INR}{fmt(d.total_cogs ?? 0)}</td>
                      <td className="py-2 px-3 text-right font-mono text-xs">{INR}{fmt(d.total_inventory_value ?? 0)}</td>
                      <td colSpan={2} />
                    </tr></tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
