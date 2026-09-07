import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { DonutChart, type CatDatum } from '@/components/charts/reportCharts'
import { Loader2, RefreshCw, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { filtersToParams, type AnalyticsFilters } from '../useAnalyticsFilters'
import { exportCSV } from '../exportUtils'

const INR = '₹'
function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

const STATUS_CFG = {
  stockout:      { label: 'Stockout',       className: 'text-red-600',    bg: 'bg-red-100 dark:bg-red-950/30' },
  below_reorder: { label: 'Below Reorder',  className: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-950/30' },
  healthy:       { label: 'Healthy',        className: 'text-green-600',  bg: 'bg-green-100 dark:bg-green-950/30' },
  excess:        { label: 'Excess Stock',   className: 'text-blue-600',   bg: 'bg-blue-100 dark:bg-blue-950/30' },
} as const

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  ...Object.entries(STATUS_CFG).map(([k, v]) => ({ value: k, label: v.label })),
]

interface HealthItem {
  product_id: string; product_name: string; sku: string | null
  category: string; on_hand: number; reorder_point: number
  reorder_quantity: number; max_stock: number | null
  stock_value: number; status: keyof typeof STATUS_CFG
}

export function StockHealthTab({ filters, refreshKey = 0 }: { filters: AnalyticsFilters; refreshKey?: number }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const params = filtersToParams(filters, { limit: 500 })
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vendor', 'inv-analytics-health', params, refreshKey],
    queryFn: () => vendorApi.inventoryAnalyticsStockHealth(params),
  })

  const d = data ?? {}
  const items: HealthItem[] = d.items ?? []
  const summary = d.summary ?? {}
  const visible = statusFilter === 'all' ? items : items.filter((i) => i.status === statusFilter)

  const donutData: CatDatum[] = Object.entries(STATUS_CFG).map(([k, v]) => ({
    label: v.label,
    value: summary[k as keyof typeof STATUS_CFG]?.count ?? 0,
  })).filter((d) => d.value > 0)

  function doExport() {
    exportCSV(
      'stock-health.csv',
      ['Product', 'SKU', 'Category', 'On Hand', 'Reorder Point', 'Max Stock', 'Value', 'Status'],
      items.map((i) => [i.product_name, i.sku ?? '', i.category, i.on_hand, i.reorder_point, i.max_stock ?? '', i.stock_value, i.status]),
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} className="w-40" />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={doExport}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
          <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Summary pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(STATUS_CFG).map(([k, v]) => {
          const s = summary[k as keyof typeof STATUS_CFG] ?? {}
          return (
            <button
              key={k}
              onClick={() => setStatusFilter(statusFilter === k ? 'all' : k)}
              className={cn('rounded-lg border p-3 text-left hover:shadow-sm transition-all', v.bg, statusFilter === k && 'ring-2 ring-primary')}
            >
              <p className={cn('text-xs font-medium', v.className)}>{v.label}</p>
              <p className="text-2xl font-bold">{s.count ?? 0}</p>
              <p className="text-xs text-muted-foreground">{INR}{fmt(s.value ?? 0)}</p>
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4 items-start">
          <Card className="lg:col-span-1">
            <CardContent className="pt-4">
              <DonutChart data={donutData} height={220} money={false} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/40">
                    <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Product</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">On Hand</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Reorder Pt.</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Max Stock</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Value</th>
                    <th className="py-2 px-3 text-center text-xs font-medium text-muted-foreground">Status</th>
                  </tr></thead>
                  <tbody>
                    {visible.slice(0, 100).map((item) => {
                      const cfg = STATUS_CFG[item.status]
                      return (
                        <tr key={item.product_id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-2 px-3">
                            <div className="font-medium">{item.product_name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{item.sku}</div>
                          </td>
                          <td className="py-2 px-3 text-right font-mono">{item.on_hand}</td>
                          <td className="py-2 px-3 text-right font-mono text-muted-foreground">{item.reorder_point}</td>
                          <td className="py-2 px-3 text-right font-mono text-muted-foreground">{item.max_stock ?? '—'}</td>
                          <td className="py-2 px-3 text-right font-mono text-xs">{INR}{fmt(item.stock_value)}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded', cfg.bg, cfg.className)}>
                              {cfg.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                    {visible.length === 0 && (
                      <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">No products found</td></tr>
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
