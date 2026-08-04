import { CalendarClock, Plus } from 'lucide-react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/utils'
import { BOOKING_STATUSES, type RentalBooking } from './rentalConstants'
import { RentalEmptyState, StatusBadge, TableSkeleton } from './RentalPrimitives'

type Props = {
  bookings: RentalBooking[]
  loading: boolean
  status: string
  onStatusChange: (v: string) => void
  onCreate: () => void
  onSelect: (b: RentalBooking) => void
  selectedId?: string | null
}

export default function RentalBookingsTab({
  bookings, loading, status, onStatusChange, onCreate, onSelect, selectedId,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select
          value={status || '__all__'}
          onChange={(v) => onStatusChange(v === '__all__' ? '' : v)}
          options={[{ value: '__all__', label: 'All bookings' }, ...BOOKING_STATUSES]}
          wrapperClassName="w-48"
        />
        <Button size="sm" onClick={onCreate}>
          <Plus className="mr-1 h-4 w-4" /> Add Booking
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : bookings.length === 0 ? (
          <RentalEmptyState
            icon={CalendarClock}
            title="No rental bookings yet"
            description="Bookings created for your rental assets will show up here."
            action={<Button size="sm" onClick={onCreate}><Plus className="mr-1 h-4 w-4" /> Add Booking</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3"><TableColumnLabel>Booking</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Customer</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Asset</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Qty</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Dates</TableColumnLabel></th>
                  <th className="px-4 py-3 text-right"><TableColumnLabel>Total</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Status</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bookings.map((b) => (
                  <tr
                    key={b.id}
                    className={`cursor-pointer transition-colors hover:bg-muted/40 ${selectedId === b.id ? 'bg-primary/5' : ''}`}
                    onClick={() => onSelect(b)}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{b.booking_number || `#${b.id.slice(0, 6)}`}</td>
                    <td className="px-4 py-3">{b.customer_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{b.asset_name || b.asset_code || '—'}</td>
                    <td className="px-4 py-3">{b.quantity} {b.capacity_unit || ''}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatDate(b.start_date)} → {formatDate(b.end_date)}
                    </td>
                    <td className="px-4 py-3 text-right">{formatCurrency(Number(b.total_amount || 0))}</td>
                    <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
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
