import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, Clock, BarChart2 } from 'lucide-react'
import { BarsChart, type CatDatum } from '@/components/charts/reportCharts'
import { filtersToParams, type ProcurementReportFilters } from '../useProcurementReportFilters'

interface Stage {
  stage: string
  avg_hours?: number
  avg_days?: number
  count: number
  unit: 'hours' | 'days'
}

const STAGE_ACCENTS = [
  { accent: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/20' },
  { accent: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-950/20' },
  { accent: 'text-teal-600',   bg: 'bg-teal-50 dark:bg-teal-950/20' },
  { accent: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-950/20' },
]

export function CycleTimeTab({ filters, refreshKey = 0 }: { filters: ProcurementReportFilters; refreshKey?: number }) {
  const params = filtersToParams(filters)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vendor', 'proc-analytics-cycle-time', params, refreshKey],
    queryFn: () => vendorApi.procurementAnalyticsCycleTime(params),
  })

  const stages: Stage[] = data?.stages ?? []
  const totalDays: number = data?.total_cycle_days ?? 0

  const chartData: CatDatum[] = stages.map(s => ({
    label: s.stage,
    value: s.unit === 'hours' ? parseFloat(((s.avg_hours ?? 0) / 24).toFixed(2)) : (s.avg_days ?? 0),
  }))

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {/* Total P2P KPI — Sales card style */}
      <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-5">
        <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/20 grid place-items-center shrink-0">
          <Clock className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <p className="text-xs text-blue-600 font-medium">Total Procure-to-Pay Cycle</p>
          <p className="text-4xl font-bold text-blue-700">
            {totalDays.toFixed(1)} <span className="text-base font-normal text-muted-foreground">days</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">PR approval through payment settlement</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : stages.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm">No cycle time data for this period</div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Stage KPI cards */}
          <div className="grid sm:grid-cols-2 gap-3">
            {stages.map((stage, idx) => {
              const { accent, bg } = STAGE_ACCENTS[idx % STAGE_ACCENTS.length]
              const displayVal = stage.unit === 'hours'
                ? `${stage.avg_hours?.toFixed(1) ?? '—'} hrs`
                : `${stage.avg_days?.toFixed(1) ?? '—'} days`
              const dayEquiv = stage.unit === 'hours' ? (stage.avg_hours ?? 0) / 24 : (stage.avg_days ?? 0)
              const maxVal = Math.max(...stages.map(s => s.unit === 'hours' ? (s.avg_hours ?? 0) / 24 : (s.avg_days ?? 0)), 0.1)
              const barPct = Math.min((dayEquiv / maxVal) * 100, 100)

              return (
                <div key={stage.stage} className={`rounded-xl border p-4 ${bg}`}>
                  <p className={`text-xs font-medium ${accent}`}>{stage.stage}</p>
                  <p className={`text-2xl font-bold mt-1 ${accent}`}>{displayVal}</p>
                  <p className="text-xs text-muted-foreground">{stage.count.toLocaleString()} transactions</p>
                  <div className="mt-3 h-1.5 w-full rounded-full bg-black/10">
                    <div className={`h-1.5 rounded-full bg-current ${accent}`} style={{ width: `${barPct}%`, opacity: 0.6 }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Bar chart — stages as day-equivalent */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-foreground">Stage Duration Comparison</h3>
              <p className="text-xs text-gray-500">Avg days (hours converted)</p>
            </div>
            <BarsChart data={chartData} height={220} money={false} />
          </div>
        </div>
      )}
    </div>
  )
}
