import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, Download, Scale } from 'lucide-react'
import { HBarsChart, type CatDatum } from '@/components/charts/reportCharts'
import { filtersToParams, type AnalyticsFilters } from '../useAnalyticsFilters'
import { exportCSV } from '../exportUtils'

const INR = '₹'
function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  if (n >= 1e7) return `${INR}${(n / 1e7).toFixed(2)} Cr`
  if (n >= 1e5) return `${INR}${(n / 1e5).toFixed(2)} L`
  return `${INR}${n.toFixed(2)}`
}

interface ValuationItem {
  product_id: string; product_name: string; sku: string | null; category: string; on_hand: number
  cost_price: number; cost_price_value: number
  map_price: number | null; map_value: number | null
  standard_price: number | null; standard_value: number | null
  fifo_value: number | null; valuation_method: string | null
}
interface Totals { cost_price_value: number; map_value: number; standard_value: number; fifo_value: number }

const METHOD_TILES = [
  { key: 'cost_price_value' as const, label: 'Cost Price Value', accent: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-950/20' },
  { key: 'map_value'        as const, label: 'MAP Value',        accent: 'text-teal-600',   bg: 'bg-teal-50 dark:bg-teal-950/20' },
  { key: 'standard_value'   as const, label: 'Standard Value',   accent: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/20' },
  { key: 'fifo_value'       as const, label: 'FIFO Value',       accent: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-950/20' },
]

export function ValuationComparisonTab({ filters, refreshKey = 0 }: { filters: AnalyticsFilters; refreshKey?: number }) {
  const params = filtersToParams(filters, { limit: 500 })
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vendor', 'inv-analytics-valuation-comparison', params, refreshKey],
    queryFn: () => vendorApi.inventoryAnalyticsValuationComparison(params),
  })

  const d = data ?? {}
  const items: ValuationItem[] = d.items ?? []
  const totals: Totals = d.totals ?? { cost_price_value: 0, map_value: 0, standard_value: 0, fifo_value: 0 }

  const chartData: CatDatum[] = METHOD_TILES
    .map(t => ({ label: t.label, value: (totals[t.key] as number) ?? 0 }))
    .filter(x => x.value > 0)

  function doExport() {
    exportCSV(
      'valuation-comparison.csv',
      ['Product', 'SKU', 'On Hand', 'Cost Price', 'Cost Value', 'MAP', 'MAP Value', 'Standard', 'Std Value', 'FIFO Value', 'Method'],
      items.map((i) => [
        i.product_name, i.sku ?? '', i.on_hand, i.cost_price, i.cost_price_value,
        i.map_price ?? '', i.map_value ?? '', i.standard_price ?? '', i.standard_value ?? '',
        i.fifo_value ?? '', i.valuation_method ?? '',
      ]),
    )
  }

  return (
    <div className="space-y-4">
      {/* Valuation method summary tiles — static classes, no dynamic Tailwind */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {METHOD_TILES.map(t => (
          <div key={t.key} className={`rounded-xl border p-4 ${t.bg}`}>
            <p className={`text-xs font-medium mb-1 ${t.accent}`}>{t.label}</p>
            <p className={`text-xl font-bold tabular-nums ${t.accent}`}>{fmt(totals[t.key])}</p>
          </div>
        ))}
      </div>

      {/* Method comparison chart */}
      {chartData.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Scale className="w-4 h-4 text-violet-600" />
            <h3 className="text-sm font-semibold text-foreground">Valuation Method Comparison</h3>
            <p className="text-xs text-gray-500">Total inventory value by costing method</p>
          </div>
          <HBarsChart data={chartData} height={160} money />
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{d.total ?? 0} products</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={doExport}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
          <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Product</th>
                  <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">On Hand</th>
                  <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Cost Value</th>
                  <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">MAP Value</th>
                  <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Std Value</th>
                  <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">FIFO Value</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Method</th>
                </tr>
              </thead>
              <tbody>
                {items.slice(0, 200).map((item) => (
                  <tr key={item.product_id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 px-3">
                      <div className="font-medium max-w-[200px] truncate">{item.product_name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{item.sku}</div>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{item.on_hand}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{fmt(item.cost_price_value)}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{fmt(item.map_value)}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{fmt(item.standard_value)}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{fmt(item.fifo_value)}</td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">{item.valuation_method ?? '—'}</td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">No products with inventory value found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
