import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, Download, Receipt } from 'lucide-react'
import { BarsChart, type CatDatum } from '@/components/charts/reportCharts'
import { cn } from '@/lib/utils'
import { filtersToParams, type ProcurementReportFilters } from '../useProcurementReportFilters'
import { exportCSV } from '@/pages/inventory/analytics/exportUtils'

const INR = '₹'
function fmt(n: number) {
  if (n >= 1e7) return `${INR}${(n / 1e7).toFixed(2)} Cr`
  if (n >= 1e5) return `${INR}${(n / 1e5).toFixed(2)} L`
  return `${INR}${n.toFixed(2)}`
}

interface GSTItem {
  hsn_code: string; place_of_supply: string; line_count: number
  cgst: number; sgst: number; igst: number; total_tax: number
}
interface GSTTotals { cgst: number; sgst: number; igst: number; total_tax: number }

const TAX_TILES = [
  { key: 'cgst' as const,      label: 'Total CGST',       accent: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-950/20' },
  { key: 'sgst' as const,      label: 'Total SGST',       accent: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/20' },
  { key: 'igst' as const,      label: 'Total IGST',       accent: 'text-teal-600',   bg: 'bg-teal-50 dark:bg-teal-950/20' },
  { key: 'total_tax' as const, label: 'Total Input Tax',  accent: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-950/20' },
]

export function GSTInputCreditTab({ filters, refreshKey = 0 }: { filters: ProcurementReportFilters; refreshKey?: number }) {
  const params = filtersToParams(filters, { limit: 500 })
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vendor', 'proc-analytics-gst-input-credit', params, refreshKey],
    queryFn: () => vendorApi.procurementAnalyticsGSTInputCredit(params),
  })

  const items: GSTItem[] = data?.items ?? []
  const totals: GSTTotals = data?.totals ?? { cgst: 0, sgst: 0, igst: 0, total_tax: 0 }
  const poGstTotal: number = data?.po_gst_total ?? 0
  const variance: number = data?.gst_variance ?? 0

  const taxChartData: CatDatum[] = [
    { label: 'CGST', value: totals.cgst },
    { label: 'SGST', value: totals.sgst },
    { label: 'IGST', value: totals.igst },
  ].filter(d => d.value > 0)

  // Top HSN codes by total tax
  const hsnChartData: CatDatum[] = items
    .slice(0, 12)
    .map(i => ({ label: i.hsn_code || 'N/A', value: i.total_tax }))
    .filter(d => d.value > 0)

  function doExport() {
    exportCSV(
      'gst-input-credit.csv',
      ['HSN Code', 'Place of Supply', 'Lines', 'CGST', 'SGST', 'IGST', 'Total Tax'],
      items.map((i) => [i.hsn_code, i.place_of_supply, i.line_count, i.cgst, i.sgst, i.igst, i.total_tax]),
    )
  }

  return (
    <div className="space-y-4">
      {/* Tax type summary tiles — static Tailwind classes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {TAX_TILES.map(t => (
          <div key={t.key} className={`rounded-xl border p-4 ${t.bg}`}>
            <p className={`text-xs font-medium mb-1 ${t.accent}`}>{t.label}</p>
            <p className={`text-xl font-bold tabular-nums ${t.accent}`}>{fmt(totals[t.key])}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      {(taxChartData.length > 0 || hsnChartData.length > 0) && (
        <div className="grid lg:grid-cols-2 gap-4">
          {taxChartData.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Receipt className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-semibold text-foreground">Tax Type Breakdown</h3>
                <p className="text-xs text-gray-500">CGST / SGST / IGST split</p>
              </div>
              <BarsChart data={taxChartData} height={200} money />
            </div>
          )}

          {hsnChartData.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Receipt className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-foreground">Top HSN Codes by Tax</h3>
                <p className="text-xs text-gray-500">Input credit by HSN</p>
              </div>
              <BarsChart data={hsnChartData} height={200} money />
            </div>
          )}
        </div>
      )}

      {/* PO vs Invoice GST variance */}
      <div className={cn(
        'rounded-xl border px-4 py-3 flex items-center justify-between text-sm',
        Math.abs(variance) < 1 ? 'bg-green-50 dark:bg-green-950/20' : 'bg-amber-50 dark:bg-amber-950/20',
      )}>
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-muted-foreground">PO Tax vs Invoice Tax Reconciliation</p>
          <div className="flex flex-wrap gap-4 sm:gap-6">
            <span>PO GST: <strong className="font-mono">{fmt(poGstTotal)}</strong></span>
            <span>Invoice GST: <strong className="font-mono">{fmt(totals.total_tax)}</strong></span>
            <span className={cn('font-semibold', Math.abs(variance) < 1 ? 'text-green-600' : 'text-amber-600')}>
              Variance: {fmt(Math.abs(variance))} {variance > 0 ? '(over-billed)' : variance < 0 ? '(under-billed)' : '✓'}
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={doExport}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">HSN Code</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Place of Supply</th>
                  <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Lines</th>
                  <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">CGST</th>
                  <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">SGST</th>
                  <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">IGST</th>
                  <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 px-3 font-mono text-xs">{item.hsn_code}</td>
                    <td className="py-2 px-3 text-xs">{item.place_of_supply}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{item.line_count}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{fmt(item.cgst)}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{fmt(item.sgst)}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{fmt(item.igst)}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs font-semibold">{fmt(item.total_tax)}</td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">No GST data for this period</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
