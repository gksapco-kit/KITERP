import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, TrendingDown, GitMerge } from 'lucide-react'
import { HBarsChart, type CatDatum } from '@/components/charts/reportCharts'
import { filtersToParams, type ProcurementReportFilters } from '../useProcurementReportFilters'

const INR = '₹'
function fmt(n: number) {
  if (n >= 1e7) return `${INR}${(n / 1e7).toFixed(2)} Cr`
  if (n >= 1e5) return `${INR}${(n / 1e5).toFixed(2)} L`
  return `${INR}${n.toFixed(2)}`
}

interface FunnelStage { stage: string; count: number }

export function SourcingFunnelTab({ filters, refreshKey = 0 }: { filters: ProcurementReportFilters; refreshKey?: number }) {
  const params = filtersToParams(filters)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vendor', 'proc-analytics-sourcing-funnel', params, refreshKey],
    queryFn: () => vendorApi.procurementAnalyticsSourcingFunnel(params),
  })

  const funnel: FunnelStage[] = data?.funnel ?? []
  const rfqResponseRate: number | null = data?.rfq_response_rate ?? null
  const prConversion: number | null = data?.pr_conversion_rate ?? null
  const savings: number = data?.savings ?? 0
  const savingsPct: number | null = data?.savings_pct ?? null
  const targetValue: number = data?.target_value ?? 0
  const awardedValue: number = data?.awarded_value ?? 0
  const rfqStats: Record<string, number> = data?.rfq_supplier_stats ?? {}

  const funnelChartData: CatDatum[] = funnel.map(s => ({ label: s.stage, value: s.count }))
  const rfqChartData: CatDatum[] = Object.entries(rfqStats)
    .map(([k, v]) => ({ label: k.replace(/_/g, ' '), value: v }))
    .filter(d => d.value > 0)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {/* KPI row — static Tailwind classes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border p-4 bg-violet-50 dark:bg-violet-950/20">
          <p className="text-xs font-medium text-violet-600 opacity-90">PR → PO Conversion</p>
          <p className="text-2xl font-bold mt-1 text-violet-700">
            {prConversion != null ? `${prConversion}%` : '—'}
          </p>
        </div>
        <div className="rounded-xl border p-4 bg-blue-50 dark:bg-blue-950/20">
          <p className="text-xs font-medium text-blue-600 opacity-90">RFQ Response Rate</p>
          <p className="text-2xl font-bold mt-1 text-blue-700">
            {rfqResponseRate != null ? `${rfqResponseRate}%` : '—'}
          </p>
        </div>
        <div className="rounded-xl border p-4 bg-green-50 dark:bg-green-950/20">
          <p className="text-xs font-medium text-green-600 opacity-90">Realised Savings</p>
          <p className="text-2xl font-bold mt-1 text-green-700">{fmt(savings)}</p>
        </div>
        <div className="rounded-xl border p-4 bg-teal-50 dark:bg-teal-950/20">
          <p className="text-xs font-medium text-teal-600 opacity-90">Savings vs Target</p>
          <p className="text-2xl font-bold mt-1 text-teal-700">
            {savingsPct != null ? `${savingsPct}%` : '—'}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Funnel chart — horizontal bars */}
          <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <GitMerge className="w-4 h-4 text-violet-600" />
              <h3 className="text-sm font-semibold text-foreground">Procurement Funnel</h3>
              <p className="text-xs text-gray-500">Documents by stage</p>
            </div>
            {funnelChartData.length === 0 ? (
              <div className="h-[200px] grid place-items-center text-sm text-gray-400">No funnel data for this period</div>
            ) : (
              <HBarsChart data={funnelChartData} height={Math.max(200, funnelChartData.length * 44)} money={false} />
            )}
          </div>

          {/* Savings + RFQ breakdown */}
          <div className="space-y-3">
            {/* Savings vs Target */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3">Savings vs Target Price</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target</span>
                  <span className="font-mono font-medium">{fmt(targetValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Awarded</span>
                  <span className="font-mono font-medium">{fmt(awardedValue)}</span>
                </div>
                <div className="flex justify-between font-semibold text-green-600 border-t border-border pt-2">
                  <span className="flex items-center gap-1">
                    <TrendingDown className="h-3.5 w-3.5" /> Saved
                  </span>
                  <span className="font-mono">{fmt(savings)}</span>
                </div>
              </div>
            </div>

            {/* RFQ Supplier Responses chart */}
            {rfqChartData.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3">RFQ Supplier Responses</p>
                <HBarsChart data={rfqChartData} height={Math.max(120, rfqChartData.length * 36)} money={false} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
