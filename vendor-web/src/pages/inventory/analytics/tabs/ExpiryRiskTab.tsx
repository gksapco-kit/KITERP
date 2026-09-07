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

const BUCKET_CFG = {
  expired:    { label: 'Expired',        className: 'text-red-700',    bg: 'bg-red-100 dark:bg-red-950/30' },
  '0_30d':    { label: 'Expires ≤ 30d',  className: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-950/30' },
  '31_90d':   { label: '31–90 days',     className: 'text-amber-600',  bg: 'bg-amber-100 dark:bg-amber-950/30' },
  '91_180d':  { label: '91–180 days',    className: 'text-blue-600',   bg: 'bg-blue-100 dark:bg-blue-950/30' },
  '180d_plus':{ label: '> 180 days',     className: 'text-green-600',  bg: 'bg-green-100 dark:bg-green-950/30' },
} as const

const BUCKET_OPTIONS = [
  { value: 'all', label: 'All Buckets' },
  ...Object.entries(BUCKET_CFG).map(([k, v]) => ({ value: k, label: v.label })),
]

interface ExpiryItem {
  batch_id: string; batch_number: string; product_id: string
  product_name: string; sku: string | null; category: string
  expiry_date: string | null; days_to_expiry: number | null
  quantity_available: number; value_at_risk: number
  quality_status: string; risk_bucket: keyof typeof BUCKET_CFG
}

export function ExpiryRiskTab({ filters, refreshKey = 0 }: { filters: AnalyticsFilters; refreshKey?: number }) {
  const [bucketFilter, setBucketFilter] = useState('all')
  const params = filtersToParams(filters, { limit: 500 })
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vendor', 'inv-analytics-expiry', params, refreshKey],
    queryFn: () => vendorApi.inventoryAnalyticsExpiryRisk(params),
  })

  const d = data ?? {}
  const items: ExpiryItem[] = d.items ?? []
  const summary = d.summary ?? {}
  const visible = bucketFilter === 'all' ? items : items.filter((i) => i.risk_bucket === bucketFilter)

  const donutData: CatDatum[] = Object.entries(BUCKET_CFG).map(([k, v]) => ({
    label: v.label,
    value: summary[k as keyof typeof BUCKET_CFG]?.value ?? 0,
  })).filter((d) => d.value > 0)

  function doExport() {
    exportCSV(
      'expiry-risk.csv',
      ['Batch', 'Product', 'SKU', 'Expiry Date', 'Days to Expiry', 'Qty Available', 'Value at Risk', 'Quality', 'Bucket'],
      items.map((i) => [i.batch_number, i.product_name, i.sku ?? '', i.expiry_date ?? '', i.days_to_expiry ?? '', i.quantity_available, i.value_at_risk, i.quality_status, i.risk_bucket]),
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={bucketFilter} onChange={setBucketFilter} options={BUCKET_OPTIONS} className="w-44" />
        <div className="ml-auto flex items-center gap-2">
          {d.total_value_at_risk != null && (
            <span className="text-sm font-semibold text-orange-600">
              Total at risk: {INR}{fmt(d.total_value_at_risk)}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={doExport}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
          <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {Object.entries(BUCKET_CFG).map(([k, v]) => {
          const s = summary[k as keyof typeof BUCKET_CFG] ?? {}
          return (
            <button
              key={k}
              onClick={() => setBucketFilter(bucketFilter === k ? 'all' : k)}
              className={cn('rounded-lg border p-2.5 text-left hover:shadow-sm transition-all', v.bg, bucketFilter === k && 'ring-2 ring-primary')}
            >
              <p className={cn('text-xs font-medium', v.className)}>{v.label}</p>
              <p className="text-lg font-bold">{s.count ?? 0}</p>
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
              <DonutChart data={donutData} height={220} />
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/40">
                    <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Product / Batch</th>
                    <th className="py-2 px-3 text-center text-xs font-medium text-muted-foreground">Expiry</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Days Left</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Qty</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Value at Risk</th>
                  </tr></thead>
                  <tbody>
                    {visible.slice(0, 100).map((item) => {
                      const cfg = BUCKET_CFG[item.risk_bucket] ?? BUCKET_CFG['180d_plus']
                      return (
                        <tr key={item.batch_id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-2 px-3">
                            <div className="font-medium">{item.product_name}</div>
                            <div className="text-xs text-muted-foreground font-mono">Batch: {item.batch_number}</div>
                          </td>
                          <td className="py-2 px-3 text-center text-xs">{item.expiry_date ?? '—'}</td>
                          <td className="py-2 px-3 text-right">
                            <span className={cn('text-xs font-semibold', cfg.className)}>
                              {item.days_to_expiry != null ? `${item.days_to_expiry}d` : '—'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-xs">{item.quantity_available}</td>
                          <td className="py-2 px-3 text-right font-semibold text-xs">{INR}{fmt(item.value_at_risk)}</td>
                        </tr>
                      )
                    })}
                    {visible.length === 0 && (
                      <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">No expiry data</td></tr>
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
