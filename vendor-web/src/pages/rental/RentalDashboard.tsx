import { useQuery } from '@tanstack/react-query'
import { Boxes, CheckCircle2, Clock, IndianRupee, Package, Wrench } from 'lucide-react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { formatCurrency } from '@/lib/utils'
import { rentalApi } from './api'
import { assetCardAvailability } from './rentalDates'
import { RentalEmptyState, StatusBadge } from './RentalPrimitives'
import { Skeleton } from '@/components/ui/skeleton'
import type { RentalAsset, RentalBooking } from './rentalConstants'

type Props = {
  allBookings: RentalBooking[]
  onGoToAssets: () => void
  onGoToBookings: (status?: string) => void
  onSelectBooking: (b: RentalBooking) => void
}

export default function RentalDashboard({ allBookings, onGoToAssets, onGoToBookings, onSelectBooking }: Props) {
  const { data: dash, isLoading } = useQuery({ queryKey: ['rental-dashboard'], queryFn: rentalApi.dashboard })

  const cards = [
    { label: 'Total Assets', value: dash?.total_assets ?? 0, icon: Package, color: 'text-blue-600 bg-blue-500/10', onClick: onGoToAssets },
    { label: 'Available', value: dash?.available ?? 0, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-500/10', onClick: () => onGoToAssets() },
    { label: 'Occupied', value: dash?.occupied ?? 0, icon: Boxes, color: 'text-amber-600 bg-amber-500/10', onClick: () => onGoToAssets() },
    { label: 'Maintenance', value: dash?.maintenance ?? 0, icon: Wrench, color: 'text-orange-600 bg-orange-500/10', onClick: () => onGoToAssets() },
    { label: 'Pending Bookings', value: dash?.pending_bookings ?? 0, icon: Clock, color: 'text-indigo-600 bg-indigo-500/10', onClick: () => onGoToBookings('pending') },
    { label: 'Rental Revenue', value: formatCurrency(Number(dash?.rental_revenue || 0)), icon: IndianRupee, color: 'text-teal-600 bg-teal-500/10', onClick: () => onGoToBookings() },
  ]

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <Skeleton className="mb-2 h-8 w-8 rounded-lg" />
              <Skeleton className="mb-1 h-5 w-12" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={c.onClick}
            className="rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/30 hover:shadow-sm"
          >
            <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${c.color}`}>
              <c.icon className="h-4 w-4" />
            </div>
            <p className="text-xl font-bold text-foreground">{c.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{c.label}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Recent Rental Assets</h2>
            <button type="button" className="text-xs text-primary hover:underline" onClick={onGoToAssets}>View all</button>
          </div>
          {(dash?.recent_assets || []).length === 0 ? (
            <RentalEmptyState icon={Package} title="No assets yet" description="Add your first rental rack to get started." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2"><TableColumnLabel>Asset</TableColumnLabel></th>
                    <th className="px-4 py-2"><TableColumnLabel>Dates</TableColumnLabel></th>
                    <th className="px-4 py-2"><TableColumnLabel>Capacity</TableColumnLabel></th>
                    <th className="px-4 py-2"><TableColumnLabel>Status</TableColumnLabel></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(dash.recent_assets as RentalAsset[]).map((a) => {
                    const av = assetCardAvailability(a, allBookings)
                    return (
                      <tr key={a.id}>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-foreground">{a.name}</p>
                          <p className="text-xs capitalize text-muted-foreground">{(a.category || '').replace(/_/g, ' ')}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                          {av.kind === 'range' ? av.detail : av.label}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {a.available_capacity}/{a.capacity_max} {a.capacity_unit}
                        </td>
                        <td className="px-4 py-2.5"><StatusBadge status={a.status} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Upcoming Bookings</h2>
            <button type="button" className="text-xs text-primary hover:underline" onClick={() => onGoToBookings()}>View all</button>
          </div>
          {(dash?.upcoming_bookings || []).length === 0 ? (
            <RentalEmptyState icon={Clock} title="No upcoming bookings" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2"><TableColumnLabel>Booking</TableColumnLabel></th>
                    <th className="px-4 py-2"><TableColumnLabel>Customer</TableColumnLabel></th>
                    <th className="px-4 py-2"><TableColumnLabel>Status</TableColumnLabel></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(dash.upcoming_bookings as RentalBooking[]).map((b) => (
                    <tr key={b.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onSelectBooking(b)}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-foreground">{b.booking_number || b.id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">{b.asset_name}</p>
                      </td>
                      <td className="px-4 py-2.5">{b.customer_name}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={b.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
