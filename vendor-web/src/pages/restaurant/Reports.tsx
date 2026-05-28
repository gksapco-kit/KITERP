import { useState, type ElementType } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, BarChart3, ChefHat, Clock, Loader2, Users,
  UtensilsCrossed, DollarSign, Calendar,
} from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { formatCurrency, cn } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  new:       'bg-blue-500',
  preparing: 'bg-amber-500',
  ready:     'bg-emerald-500',
  done:      'bg-gray-400',
}

const TABLE_STATUS_COLORS: Record<string, string> = {
  free:     'bg-emerald-500',
  seated:   'bg-blue-500',
  ordering: 'bg-amber-500',
  billed:   'bg-red-500',
  dirty:    'bg-gray-400',
}

export default function RestaurantReportsPage() {
  const [kpiDays, setKpiDays] = useState(1)

  const dashQ = useQuery({
    queryKey: ['restaurant', 'reports', 'dashboard'],
    queryFn: () => vendorApi.restaurantReportDashboard(),
    refetchInterval: 60_000,
  })

  const hoursQ = useQuery({
    queryKey: ['restaurant', 'reports', 'kots-by-hour', kpiDays],
    queryFn: () => vendorApi.restaurantReportKotsByHour(kpiDays),
    refetchInterval: 60_000,
  })

  const d = dashQ.data
  const hours = hoursQ.data?.data ?? []
  const maxKots = Math.max(...hours.map(h => h.kots), 1)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/restaurant/floor"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-600" /> Restaurant Reports
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Live operational metrics</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/restaurant/kitchen"><ChefHat className="w-4 h-4 mr-1" />Kitchen</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/restaurant/reservations"><Calendar className="w-4 h-4 mr-1" />Reservations</Link>
          </Button>
        </div>
      </div>

      {dashQ.isLoading && <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>}

      {d && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard icon={UtensilsCrossed} label="Open orders" value={d.today.open_orders} color="text-amber-600" />
            <KpiCard icon={Users} label="Covers today" value={d.today.total_covers} color="text-blue-600" />
            <KpiCard icon={DollarSign} label="Restaurant revenue" value={formatCurrency(d.today.restaurant_revenue)} color="text-emerald-600" />
            <KpiCard icon={Calendar} label="Upcoming reservations" value={d.upcoming_reservations} color="text-violet-600" />
          </div>

          {/* KOTs by status + Tables by status */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-white p-4 space-y-3">
              <h2 className="font-semibold text-gray-700 flex items-center gap-2"><ChefHat className="w-4 h-4 text-orange-600" />KOTs by status</h2>
              {Object.keys(STATUS_COLORS).map(st => {
                const count = d.kots_by_status[st] ?? 0
                const total = Object.values(d.kots_by_status).reduce((a, b) => a + b, 0) || 1
                return (
                  <div key={st} className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-600">
                      <span className="capitalize">{st}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', STATUS_COLORS[st])} style={{ width: `${(count / total) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
              {!Object.keys(d.kots_by_status).length && <p className="text-sm text-gray-400">No KOTs today.</p>}
            </div>

            <div className="rounded-xl border bg-white p-4 space-y-3">
              <h2 className="font-semibold text-gray-700 flex items-center gap-2"><UtensilsCrossed className="w-4 h-4 text-amber-600" />Tables by status</h2>
              {Object.entries(d.tables.by_status).map(([st, count]) => {
                const total = d.tables.total || 1
                return (
                  <div key={st} className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-600">
                      <span className="capitalize">{st}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full', TABLE_STATUS_COLORS[st] ?? 'bg-gray-400')} style={{ width: `${(count / total) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
              <p className="text-xs text-gray-400">{d.tables.total} total active tables</p>
            </div>
          </div>

          {/* KOTs by hour */}
          <div className="rounded-xl border bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-700 flex items-center gap-2"><Clock className="w-4 h-4 text-blue-600" />KOT volume by hour</h2>
              <div className="flex gap-1">
                {[1, 3, 7].map(d => (
                  <button key={d} type="button" onClick={() => setKpiDays(d)}
                    className={cn('text-xs px-2 py-0.5 rounded-full border transition-colors', kpiDays === d ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-500')}>
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            {hoursQ.isLoading && <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>}
            {!hoursQ.isLoading && hours.length === 0 && <p className="text-sm text-gray-400">No KOT data for this period.</p>}
            {hours.length > 0 && (
              <div className="flex items-end gap-1 h-24">
                {Array.from({ length: 24 }, (_, h) => {
                  const entry = hours.find(x => x.hour === h)
                  const count = entry?.kots ?? 0
                  const pct = (count / maxKots) * 100
                  return (
                    <div key={h} className="flex flex-col items-center flex-1 gap-0.5" title={`${h}:00 — ${count} KOTs`}>
                      <div className="w-full rounded-sm bg-amber-400 transition-all" style={{ height: `${Math.max(pct, count > 0 ? 8 : 2)}%` }} />
                      {h % 6 === 0 && <span className="text-[9px] text-gray-400">{h}h</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, color }: { icon: ElementType; label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-xl border bg-white p-4 flex items-center gap-3">
      <div className={cn('p-2 rounded-lg bg-gray-50', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}
