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
  if (n >= 1e7) return `${INR}${(n / 1e7).toFixed(2)} Cr`
  if (n >= 1e5) return `${INR}${(n / 1e5).toFixed(2)} L`
  return `${INR}${n.toFixed(2)}`
}

const STATUS_CFG = {
  available:       { label: 'Available',       cls: 'text-green-600 bg-green-100 dark:bg-green-950/30' },
  fully_reserved:  { label: 'Fully Reserved',  cls: 'text-amber-600 bg-amber-100 dark:bg-amber-950/30' },
  overcommitted:   { label: 'Overcommitted',   cls: 'text-red-500 bg-red-100 dark:bg-red-950/30' },
} as const

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  ...Object.entries(STATUS_CFG).map(([k, v]) => ({ value: k, label: v.label })),
]

interface ATPItem {
  product_id: string; product_name: string; sku: string | null; category: string
  on_hand: number; reserved: number; atp: number; reorder_point: number | null
  cost_price: number; atp_value: number; status: keyof typeof STATUS_CFG
}

export function ATPTab({ filters, refreshKey = 0 }: { filters: AnalyticsFilters; refreshKey?: number }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const params = filtersToParams(filters, { limit: 500 })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vendor', 'inv-analytics-atp', params, refreshKey],
    queryFn: () => vendorApi.inventoryAnalyticsATP(params),
  })

  const d = data ?? {}
  const items: ATPItem[] = d.items ?? []
  const summary = d.summary ?? {}
  const totalAtpValue: number = d.total_atp_value ?? 0

  const visible = statusFilter === 'all' ? items : items.filter((i) => i.status === statusFilter)

  const donutData: CatDatum[] = Object.entries(STATUS_CFG).map(([k, v]) => ({
    label: v.label,
    value: summary[k as keyof typeof STATUS_CFG]?.count ?? 0,
  })).filter((d) => d.value > 0)

  function doExport() {
    exportCSV(
      'atp.csv',
      ['Product', 'SKU', 'Category', 'On Hand', 'Reserved', 'ATP', 'ATP Value', 'Status'],
      items.map((i) => [i.product_name, i.sku ?? '', i.category, i.on_hand, i.reserved, i.atp, i.atp_value, i.status]),
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} className="w-44" />
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={doExport}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
          <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* ATP Value KPI */}
      <div className="rounded-xl border bg-green-50 dark:bg-green-950/20 px-4 py-3 inline-block">
        <p className="text-xs text-green-600 font-medium">Total ATP Value</p>
        <p className="text-2xl font-bold text-green-700">{fmt(totalAtpValue)}</p>
      </div>

      {/* Status pills */}
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(STATUS_CFG).map(([k, v]) => {
          const s = summary[k as keyof typeof STATUS_CFG] ?? {}
          return (
            <button
              key={k}
              onClick={() => setStatusFilter(statusFilter === k ? 'all' : k)}
              className={cn('rounded-lg border p-3 text-left hover:shadow-sm transition-all', v.cls, statusFilter === k && 'ring-2 ring-primary')}
            >
              <p className={cn('text-xs font-medium')}>{v.label}</p>
              <p className="text-2xl font-bold">{s.count ?? 0}</p>
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4 items-start">
          <Card className="lg:col-span-1">
            <CardContent className="pt-4">
              <DonutChart data={donutData} height={200} money={false} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Product</th>
                      <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">On Hand</th>
                      <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Reserved</th>
                      <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">ATP</th>
                      <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">ATP Value</th>
                      <th className="py-2 px-3 text-center text-xs font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.slice(0, 100).map((item) => {
                      const cfg = STATUS_CFG[item.status]
                      return (
                        <tr key={item.product_id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-2 px-3">
                            <div className="font-medium max-w-[180px] truncate">{item.product_name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{item.sku}</div>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-xs">{item.on_hand}</td>
                          <td className="py-2 px-3 text-right font-mono text-xs text-muted-foreground">{item.reserved}</td>
                          <td className="py-2 px-3 text-right font-mono text-xs font-semibold">{item.atp}</td>
                          <td className="py-2 px-3 text-right font-mono text-xs">{fmt(item.atp_value)}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded', cfg.cls)}>{cfg.label}</span>
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
