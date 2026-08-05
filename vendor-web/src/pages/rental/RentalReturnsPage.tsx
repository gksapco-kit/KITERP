import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Clock, Package, RotateCcw, Wrench } from 'lucide-react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { formatCurrency, formatDate } from '@/lib/utils'
import { rentalApi } from './api'
import type { RentalAsset, RentalBooking } from './rentalConstants'
import { RentalEmptyState, StatusBadge, TableSkeleton } from './RentalPrimitives'
import RentalBookingSheet from './RentalBookingSheet'
import ReturnAssetModal from './ReturnAssetModal'

type ReturnFilter = 'pending_return' | 'completed' | 'all'

const FILTER_OPTIONS: { value: ReturnFilter; label: string }[] = [
  { value: 'pending_return', label: 'Pending Return' },
  { value: 'completed', label: 'Completed' },
  { value: 'all', label: 'All' },
]

export default function RentalReturnsPage() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<ReturnFilter>('pending_return')
  const [selectedBooking, setSelectedBooking] = useState<RentalBooking | null>(null)
  const [returnBooking, setReturnBooking] = useState<RentalBooking | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const IN_PROGRESS_STATUSES = new Set(['pending', 'approved', 'confirmed', 'active'])

  const { data: assets = [] } = useQuery({
    queryKey: ['rental-assets'],
    queryFn: () => rentalApi.listAssets(),
    staleTime: 30_000,
  })
  // Fetch all returnable (in-progress) bookings: pending → approved → confirmed → active
  const { data: inProgressBookings = [], isLoading: loadingInProgress } = useQuery({
    queryKey: ['rental-bookings', 'in_progress'],
    queryFn: () => rentalApi.listBookings('in_progress'),
    staleTime: 15_000,
  })
  const { data: completedBookings = [], isLoading: loadingCompleted } = useQuery({
    queryKey: ['rental-bookings', 'completed'],
    queryFn: () => rentalApi.listBookings('completed'),
    staleTime: 30_000,
  })

  const allReturnBookings = [
    ...(inProgressBookings as RentalBooking[]),
    ...(completedBookings as RentalBooking[]),
  ]

  const filtered = allReturnBookings.filter((b) => {
    if (filter === 'pending_return') return IN_PROGRESS_STATUSES.has(b.status || '') && !b.returned_at
    if (filter === 'completed') return b.status === 'completed' || Boolean(b.returned_at)
    return true
  })

  const isLoading = loadingInProgress || loadingCompleted

  const returnAssetForModal = returnBooking
    ? (assets as RentalAsset[]).find((a) => a.id === returnBooking.asset_id) || null
    : null

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['rental-bookings'] })
    qc.invalidateQueries({ queryKey: ['rental-assets'] })
    qc.invalidateQueries({ queryKey: ['rental-dashboard'] })
  }

  const pendingCount = (inProgressBookings as RentalBooking[]).filter((b) => !b.returned_at).length
  const completedCount = (completedBookings as RentalBooking[]).length
  const withDamages = (completedBookings as RentalBooking[]).filter((b) => Number(b.damage_charge) > 0).length
  // Days late helper
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Returns & Settlements</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Process returns, record damage charges, late fees, and deposit refunds.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Pending Returns', value: pendingCount, icon: Clock, color: 'text-amber-600 bg-amber-500/10' },
          { label: 'Completed Returns', value: completedCount, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-500/10' },
          { label: 'With Damages', value: withDamages, icon: Wrench, color: 'text-rose-600 bg-rose-500/10' },
          {
            label: 'Deposits Outstanding',
            value: formatCurrency(
              (inProgressBookings as RentalBooking[]).reduce((s, b) => s + Number(b.deposit_amount || 0), 0),
            ),
            icon: Package,
            color: 'text-indigo-600 bg-indigo-500/10',
          },
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

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-border">
        {FILTER_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setFilter(o.value)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              filter === o.value
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {isLoading ? (
          <TableSkeleton rows={5} cols={7} />
        ) : filtered.length === 0 ? (
          <RentalEmptyState
            icon={RotateCcw}
            title={filter === 'pending_return' ? 'No pending returns' : 'No records found'}
            description={
              filter === 'pending_return'
                ? 'All active rentals have been returned or none are active yet.'
                : 'Change the filter above to see other records.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3"><TableColumnLabel>Booking</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Customer</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Asset</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Period</TableColumnLabel></th>
                  <th className="px-4 py-3 text-right"><TableColumnLabel>Deposit</TableColumnLabel></th>
                  <th className="px-4 py-3 text-right"><TableColumnLabel>Damages / Fees</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Status</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((b) => {
                  const endDate = b.end_date ? new Date(`${String(b.end_date).slice(0, 10)}T00:00:00`) : null
                  const daysLate = endDate && !Number.isNaN(endDate.getTime()) && !b.returned_at
                    ? Math.max(0, Math.round((today.getTime() - endDate.getTime()) / 86_400_000))
                    : 0
                  const canReturn = IN_PROGRESS_STATUSES.has(b.status || '') && !b.returned_at

                  return (
                    <tr
                      key={b.id}
                      className="cursor-pointer transition-colors hover:bg-muted/40"
                      onClick={() => { setSelectedBooking(b); setDetailOpen(true) }}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{b.booking_number || `#${b.id.slice(0, 6)}`}</p>
                        <StatusBadge status={b.status} />
                      </td>
                      <td className="px-4 py-3">{b.customer_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.asset_name || b.asset_code || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-muted-foreground">{formatDate(b.start_date)} → {formatDate(b.end_date)}</p>
                        {daysLate > 0 && (
                          <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                            <AlertTriangle className="h-3 w-3" /> {daysLate}d overdue
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">{formatCurrency(Number(b.deposit_amount || 0))}</td>
                      <td className="px-4 py-3 text-right text-rose-600">
                        {Number(b.damage_charge) > 0 || Number(b.late_fee) > 0
                          ? formatCurrency(Number(b.damage_charge || 0) + Number(b.late_fee || 0))
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {b.returned_at ? (
                          <span className="text-xs text-muted-foreground">Returned {formatDate(b.returned_at)}</span>
                        ) : canReturn ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
                            onClick={(e) => { e.stopPropagation(); setReturnBooking(b) }}
                          >
                            <RotateCcw className="h-3 w-3" /> Process Return
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RentalBookingSheet
        open={detailOpen}
        booking={selectedBooking}
        onClose={() => { setDetailOpen(false); setSelectedBooking(null); invalidate() }}
        onChanged={(b) => { setSelectedBooking(b); invalidate() }}
        onRequestReturn={(b) => { setReturnBooking(b); setDetailOpen(false) }}
      />

      {returnBooking && (
        <ReturnAssetModal
          booking={returnBooking}
          asset={returnAssetForModal}
          onClose={() => setReturnBooking(null)}
          onDone={(b) => {
            setReturnBooking(null)
            setSelectedBooking(b)
            setDetailOpen(true)
            invalidate()
          }}
        />
      )}
    </div>
  )
}
