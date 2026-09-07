import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, Download, Truck, Clock, CheckCircle2 } from 'lucide-react'
import { DonutChart, BarsChart, type CatDatum } from '@/components/charts/reportCharts'
import { filtersToParams, type AnalyticsFilters } from '../useAnalyticsFilters'
import { exportCSV } from '../exportUtils'

const INR = '₹'
function fmt(n: number) {
  if (n >= 1e7) return `${INR}${(n / 1e7).toFixed(2)} Cr`
  if (n >= 1e5) return `${INR}${(n / 1e5).toFixed(2)} L`
  return `${INR}${n.toFixed(2)}`
}

interface TransitOrder {
  order_id: string; reference: string | null; dispatched_at: string | null
  expected_date: string | null; days_in_transit: number | null; value: number
  is_inter_state: boolean; igst_amount: number
}
interface CompletedOrder {
  order_id: string; reference: string | null; dispatched_at: string | null
  received_at: string | null; lead_time_days: number | null; fill_rate_pct: number | null
  value: number; is_inter_state: boolean; igst_amount: number
}

function ageBucket(days: number | null): string {
  const d = days ?? 0
  if (d <= 3) return '0–3 days'
  if (d <= 7) return '4–7 days'
  if (d <= 14) return '8–14 days'
  return '15+ days'
}

function leadBucket(days: number | null): string {
  const d = days ?? 0
  if (d <= 1) return '1 day'
  if (d <= 3) return '2–3 days'
  if (d <= 7) return '4–7 days'
  return '8+ days'
}

function buildBuckets<T>(
  items: T[],
  keyFn: (item: T) => string,
  labels: string[],
): CatDatum[] {
  const counts: Record<string, number> = {}
  for (const item of items) {
    const k = keyFn(item)
    counts[k] = (counts[k] ?? 0) + 1
  }
  return labels
    .map(l => ({ label: l, value: counts[l] ?? 0 }))
    .filter(d => d.value > 0)
}

const AGE_LABELS = ['0–3 days', '4–7 days', '8–14 days', '15+ days']
const LEAD_LABELS = ['1 day', '2–3 days', '4–7 days', '8+ days']

export function InTransitTab({ filters, refreshKey = 0 }: { filters: AnalyticsFilters; refreshKey?: number }) {
  const params = filtersToParams(filters)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vendor', 'inv-analytics-in-transit', params, refreshKey],
    queryFn: () => vendorApi.inventoryAnalyticsInTransit(params),
  })

  const d = data ?? {}
  const inTransit: TransitOrder[] = d.in_transit ?? []
  const completed: CompletedOrder[] = d.completed ?? []
  const inTransitValue: number = d.in_transit_value ?? 0
  const avgLeadTime: number | null = d.avg_lead_time_days ?? null

  const ageBuckets = buildBuckets(inTransit, t => ageBucket(t.days_in_transit), AGE_LABELS)
  const leadBuckets = buildBuckets(completed, c => leadBucket(c.lead_time_days), LEAD_LABELS)

  const hasCharts = ageBuckets.length > 0 || leadBuckets.length > 0

  function doExportInTransit() {
    exportCSV(
      'in-transit.csv',
      ['Reference', 'Dispatched', 'Expected', 'Days In Transit', 'Value', 'Inter-State', 'IGST'],
      inTransit.map(t => [
        t.reference ?? t.order_id.slice(0, 8),
        t.dispatched_at ?? '',
        t.expected_date ?? '',
        t.days_in_transit ?? '',
        t.value,
        t.is_inter_state ? 'Yes' : 'No',
        t.igst_amount,
      ]),
    )
  }

  function doExportCompleted() {
    exportCSV(
      'completed-transfers.csv',
      ['Reference', 'Dispatched', 'Received', 'Lead Time (days)', 'Fill Rate %', 'Value', 'Inter-State', 'IGST'],
      completed.map(c => [
        c.reference ?? c.order_id.slice(0, 8),
        c.dispatched_at ?? '',
        c.received_at ?? '',
        c.lead_time_days ?? '',
        c.fill_rate_pct ?? '',
        c.value,
        c.is_inter_state ? 'Yes' : 'No',
        c.igst_amount,
      ]),
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={doExportInTransit}>
          <Download className="h-3.5 w-3.5 mr-1" />In-Transit CSV
        </Button>
        <Button variant="outline" size="sm" onClick={doExportCompleted}>
          <Download className="h-3.5 w-3.5 mr-1" />Completed CSV
        </Button>
        <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {/* KPI strip — consistent Sales card style */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/20 grid place-items-center">
              <Truck className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <p className="text-xl font-bold text-foreground tabular-nums">{fmt(inTransitValue)}</p>
          <p className="text-xs text-gray-500 mt-0.5">In-Transit Value</p>
          <p className="text-xs text-muted-foreground">{inTransit.length} transfer{inTransit.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/20 grid place-items-center">
              <Clock className="w-4 h-4 text-teal-600" />
            </div>
          </div>
          <p className="text-xl font-bold text-foreground tabular-nums">
            {avgLeadTime != null ? `${avgLeadTime}d` : '—'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Avg Lead Time</p>
          <p className="text-xs text-muted-foreground">{completed.length} completed</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-950/20 grid place-items-center">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            </div>
          </div>
          <p className="text-xl font-bold text-foreground tabular-nums">{completed.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Completed (period)</p>
          {completed.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {completed.filter(c => c.fill_rate_pct != null && c.fill_rate_pct >= 95).length} at ≥95% fill rate
            </p>
          )}
        </div>
      </div>

      {/* Charts */}
      {hasCharts && (
        <div className="grid lg:grid-cols-2 gap-4">
          {ageBuckets.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Truck className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-foreground">Transit Age Distribution</h3>
                <p className="text-xs text-gray-500">Current transfers by days in transit</p>
              </div>
              <DonutChart data={ageBuckets} height={220} money={false} />
            </div>
          )}

          {leadBuckets.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <h3 className="text-sm font-semibold text-foreground">Lead Time Distribution</h3>
                <p className="text-xs text-gray-500">Completed transfers by delivery speed</p>
              </div>
              <BarsChart data={leadBuckets} height={220} money={false} />
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* In-transit table */}
          <div className="rounded-xl border border-border overflow-hidden">
            <p className="text-xs font-semibold text-foreground px-3 pt-3 pb-2 border-b border-border bg-muted/30">
              Currently In-Transit
            </p>
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20 sticky top-0">
                    <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Reference</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Days</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {inTransit.map((t) => (
                    <tr key={t.order_id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="py-2 px-3 font-mono text-xs">{t.reference || t.order_id.slice(0, 8)}</td>
                      <td className="py-2 px-3 text-right font-mono text-xs">{t.days_in_transit ?? '—'}</td>
                      <td className="py-2 px-3 text-right font-mono text-xs">{fmt(t.value)}</td>
                    </tr>
                  ))}
                  {inTransit.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-xs text-muted-foreground">
                        No in-transit transfers
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Completed table */}
          <div className="rounded-xl border border-border overflow-hidden">
            <p className="text-xs font-semibold text-foreground px-3 pt-3 pb-2 border-b border-border bg-muted/30">
              Completed Transfers (period)
            </p>
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20 sticky top-0">
                    <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Reference</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Lead Time</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Fill Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {completed.map((t) => (
                    <tr key={t.order_id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="py-2 px-3 font-mono text-xs">{t.reference || t.order_id.slice(0, 8)}</td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {t.lead_time_days != null ? `${t.lead_time_days}d` : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {t.fill_rate_pct != null ? `${t.fill_rate_pct}%` : '—'}
                      </td>
                    </tr>
                  ))}
                  {completed.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-xs text-muted-foreground">
                        No completed transfers in this period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
