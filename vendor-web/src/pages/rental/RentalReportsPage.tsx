import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, IndianRupee, Package, TrendingUp } from 'lucide-react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { formatCurrency } from '@/lib/utils'
import { rentalApi } from './api'
import type { RentalAsset, RentalBooking } from './rentalConstants'
import { RentalEmptyState, StatusBadge, TableSkeleton } from './RentalPrimitives'

type AssetMetrics = {
  asset: RentalAsset
  totalBookings: number
  activeBookings: number
  completedBookings: number
  revenue: number
  depositHeld: number
  idleDays: number
  utilizationPct: number
}

function computeAssetMetrics(assets: RentalAsset[], bookings: RentalBooking[]): AssetMetrics[] {
  const now = new Date()
  return assets.map((a) => {
    const abs = bookings.filter((b) => b.asset_id === a.id)
    const completed = abs.filter((b) => b.status === 'completed')
    const active = abs.filter((b) => ['active', 'confirmed', 'approved'].includes(b.status))
    const revenue = completed.reduce((s, b) => s + Number(b.total_amount || 0), 0)
    const depositHeld = active.reduce((s, b) => s + Number(b.deposit_amount || 0), 0)

    // Utilization: % of last 30 days covered by active bookings
    const windowStart = new Date(now)
    windowStart.setDate(windowStart.getDate() - 30)
    let bookedDays = 0
    for (const b of abs) {
      if (!['active', 'confirmed', 'approved', 'completed'].includes(b.status)) continue
      const start = new Date(Math.max(new Date(b.start_date).getTime(), windowStart.getTime()))
      const end = new Date(Math.min(new Date(b.end_date).getTime(), now.getTime()))
      const diff = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 86400000))
      bookedDays += diff
    }
    const utilizationPct = Math.min(100, Math.round((bookedDays / 30) * 100))

    return {
      asset: a,
      totalBookings: abs.length,
      activeBookings: active.length,
      completedBookings: completed.length,
      revenue,
      depositHeld,
      idleDays: 30 - Math.min(30, bookedDays),
      utilizationPct,
    }
  })
}

export default function RentalReportsPage() {
  const { data: assets = [], isLoading: loadingAssets } = useQuery({
    queryKey: ['rental-assets'],
    queryFn: () => rentalApi.listAssets(),
    staleTime: 60_000,
  })
  const { data: allBookings = [], isLoading: loadingBookings } = useQuery({
    queryKey: ['rental-bookings', '__all__'],
    queryFn: () => rentalApi.listBookings(),
    staleTime: 60_000,
  })

  const metrics = useMemo(
    () => computeAssetMetrics(assets as RentalAsset[], allBookings as RentalBooking[]),
    [assets, allBookings],
  )

  const isLoading = loadingAssets || loadingBookings

  const totals = useMemo(() => ({
    revenue: metrics.reduce((s, m) => s + m.revenue, 0),
    totalBookings: metrics.reduce((s, m) => s + m.totalBookings, 0),
    activeBookings: metrics.reduce((s, m) => s + m.activeBookings, 0),
    depositHeld: metrics.reduce((s, m) => s + m.depositHeld, 0),
    avgUtilization: metrics.length > 0
      ? Math.round(metrics.reduce((s, m) => s + m.utilizationPct, 0) / metrics.length)
      : 0,
  }), [metrics])

  const sortedMetrics = useMemo(
    () => [...metrics].sort((a, b) => b.revenue - a.revenue),
    [metrics],
  )

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Rental Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Asset utilization, revenue by asset, and portfolio performance over the last 30 days.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Revenue', value: formatCurrency(totals.revenue), icon: IndianRupee, color: 'text-teal-600 bg-teal-500/10' },
          { label: 'Avg Utilization (30d)', value: `${totals.avgUtilization}%`, icon: TrendingUp, color: 'text-blue-600 bg-blue-500/10' },
          { label: 'Active Bookings', value: totals.activeBookings, icon: BarChart3, color: 'text-emerald-600 bg-emerald-500/10' },
          { label: 'Deposits Held', value: formatCurrency(totals.depositHeld), icon: Package, color: 'text-amber-600 bg-amber-500/10' },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4">
            <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${c.color}`}>
              <c.icon className="h-4 w-4" />
            </div>
            <p className="text-lg font-bold text-foreground">{c.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Asset utilization table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Asset Performance</h2>
          <p className="text-xs text-muted-foreground">Sorted by revenue. Utilization based on last 30 days.</p>
        </div>
        {isLoading ? (
          <TableSkeleton rows={5} cols={7} />
        ) : sortedMetrics.length === 0 ? (
          <RentalEmptyState icon={BarChart3} title="No data yet" description="Add assets and bookings to see performance reports." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3"><TableColumnLabel>Asset</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Status</TableColumnLabel></th>
                  <th className="px-4 py-3 text-right"><TableColumnLabel>Bookings</TableColumnLabel></th>
                  <th className="px-4 py-3 text-right"><TableColumnLabel>Revenue</TableColumnLabel></th>
                  <th className="px-4 py-3 text-right"><TableColumnLabel>Deposit Held</TableColumnLabel></th>
                  <th className="px-4 py-3 text-right"><TableColumnLabel>Idle (30d)</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Utilization</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedMetrics.map((m) => (
                  <tr key={m.asset.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{m.asset.name}</p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {(m.asset.category || '').replace(/_/g, ' ')}
                        {m.asset.asset_code ? ` · ${m.asset.asset_code}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={m.asset.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-medium">{m.totalBookings}</span>
                      {m.activeBookings > 0 && (
                        <span className="ml-1 text-xs text-emerald-600">({m.activeBookings} active)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(m.revenue)}</td>
                    <td className="px-4 py-3 text-right">{m.depositHeld > 0 ? formatCurrency(m.depositHeld) : '—'}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{m.idleDays}d</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full transition-all ${
                              m.utilizationPct >= 70 ? 'bg-emerald-500' :
                              m.utilizationPct >= 40 ? 'bg-amber-500' : 'bg-rose-400'
                            }`}
                            style={{ width: `${m.utilizationPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{m.utilizationPct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
