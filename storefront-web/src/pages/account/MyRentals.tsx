import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronRight, Loader2, PackageOpen, Truck, CreditCard, MapPin, Calendar,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { storeApi } from '@/api/store'
import { useVendor } from '@/contexts/VendorContext'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

type Booking = {
  id: string
  booking_number?: string
  asset_name?: string
  asset_code?: string
  asset_location?: string
  capacity_unit?: string
  capacity_max?: number
  quantity?: number
  start_date: string
  end_date: string
  status: string
  rental_amount?: number
  deposit_amount?: number
  total_amount?: number
  payment_status?: string
  delivery_status?: string
  van_number?: string
  van_driver_name?: string
  van_driver_phone?: string
  van_vehicle_type?: string
  estimated_delivery_at?: string
  delivered_at?: string
  delivery_notes?: string
  delivery_address?: string
  timeline?: Array<{ event: string; detail?: string; at?: string }>
}

function badge(status?: string) {
  const map: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700',
    approved: 'bg-blue-50 text-blue-700',
    confirmed: 'bg-indigo-50 text-indigo-700',
    active: 'bg-emerald-50 text-emerald-700',
    completed: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-rose-50 text-rose-600',
    rejected: 'bg-rose-50 text-rose-600',
    paid: 'bg-emerald-50 text-emerald-700',
    unpaid: 'bg-rose-50 text-rose-600',
    in_transit: 'bg-sky-50 text-sky-700',
    assigned: 'bg-indigo-50 text-indigo-700',
    delivered: 'bg-emerald-50 text-emerald-700',
    pending_delivery: 'bg-amber-50 text-amber-700',
  }
  return map[status || ''] || 'bg-gray-50 text-gray-600'
}

export default function MyRentals() {
  const { storePath } = useVendor()
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Booking | null>(null)
  const [payMethod, setPayMethod] = useState('upi')

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['my-rentals'],
    queryFn: storeApi.listMyRentalBookings,
  })

  const pay = useMutation({
    mutationFn: (id: string) =>
      storeApi.payRentalBooking(id, { payment_method: payMethod, payment_reference: `SF-${Date.now()}` }),
    onSuccess: (data) => {
      toast.success('Payment successful')
      setSelected(data)
      qc.invalidateQueries({ queryKey: ['my-rentals'] })
    },
    onError: () => toast.error('Payment failed'),
  })

  const cancel = useMutation({
    mutationFn: (id: string) => storeApi.cancelRentalBooking(id),
    onSuccess: (data) => {
      toast.success('Booking cancelled')
      setSelected(data)
      qc.invalidateQueries({ queryKey: ['my-rentals'] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof msg === 'string' ? msg : 'Could not cancel booking')
    },
  })

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      <nav className="text-sm text-gray-500 mb-6 flex flex-wrap items-center gap-1">
        <Link to={storePath('/')} className="hover:text-primary">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={storePath('/account')} className="hover:text-primary">Account</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-900">My Rentals</span>
      </nav>

      <div className="flex flex-wrap justify-between gap-3 items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <PackageOpen className="w-6 h-6 text-primary" /> My Rentals
          </h1>
          <p className="text-sm text-gray-500 mt-1">Track bookings, payments, and delivery vans.</p>
        </div>
        <Link to={storePath('/rentals')}>
          <Button size="sm">Browse Rentals</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
      ) : (bookings as Booking[]).length === 0 ? (
        <div className="border border-dashed rounded-xl p-10 text-center">
          <p className="text-sm text-gray-500 mb-3">You have no rental bookings yet.</p>
          <Link to={storePath('/rentals')}><Button size="sm">Find a rack</Button></Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-5 gap-4">
          <div className={`${selected ? 'lg:col-span-3' : 'lg:col-span-5'} space-y-3`}>
            {(bookings as Booking[]).map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelected(b)}
                className={`w-full text-left rounded-xl border bg-white p-4 hover:shadow-md transition-shadow ${
                  selected?.id === b.id ? 'ring-2 ring-primary border-primary' : ''
                }`}
              >
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{b.asset_name || 'Rental asset'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{b.booking_number}</p>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full capitalize ${badge(b.status)}`}>
                    {(b.status || '').replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />{b.start_date} → {b.end_date}</span>
                  <span>{b.quantity} / {b.capacity_max || '—'} {b.capacity_unit}</span>
                  <span>{formatCurrency(Number(b.total_amount || 0))}</span>
                </div>
              </button>
            ))}
          </div>

          {selected && (
            <div className="lg:col-span-2 rounded-xl border bg-white p-4 space-y-4">
              <div>
                <h2 className="font-semibold text-gray-900">{selected.asset_name}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{selected.booking_number}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className={`text-[11px] px-2 py-0.5 rounded-full capitalize ${badge(selected.status)}`}>
                  {(selected.status || '').replace(/_/g, ' ')}
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full capitalize ${badge(selected.payment_status)}`}>
                  Payment: {(selected.payment_status || 'unpaid').replace(/_/g, ' ')}
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-gray-400">Rental period</dt>
                  <dd>{selected.start_date} – {selected.end_date}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">Storage</dt>
                  <dd>{selected.quantity} / {selected.capacity_max || '—'} {selected.capacity_unit}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-gray-400">Location</dt>
                  <dd className="flex items-center gap-1"><MapPin className="w-3 h-3 text-gray-400" />{selected.asset_location || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">Payment</dt>
                  <dd>{formatCurrency(Number(selected.rental_amount || 0))}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">Deposit</dt>
                  <dd>{formatCurrency(Number(selected.deposit_amount || 0))}</dd>
                </div>
              </dl>

              {selected.payment_status !== 'paid' && !['cancelled', 'rejected'].includes(selected.status) && (
                <div className="border-t pt-3 space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4" /> Pay rental
                  </h3>
                  <select
                    className="w-full h-9 rounded-md border px-2 text-sm"
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                  >
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="netbanking">Net Banking</option>
                    <option value="cod">Pay on delivery</option>
                  </select>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={pay.isPending}
                    onClick={() => pay.mutate(selected.id)}
                  >
                    {pay.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : `Pay ${formatCurrency(Number(selected.total_amount || 0))}`}
                  </Button>
                </div>
              )}

              {selected.delivery_status && selected.delivery_status !== 'not_required' && (
                <div className="border-t pt-3 space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Truck className="w-4 h-4" /> Delivery van tracking
                  </h3>
                  <p className={`text-xs inline-flex px-2 py-0.5 rounded-full capitalize ${badge(selected.delivery_status)}`}>
                    {(selected.delivery_status || '').replace(/_/g, ' ')}
                  </p>
                  {selected.van_number ? (
                    <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700 space-y-1">
                      <p><span className="text-gray-400">Van:</span> {selected.van_number}</p>
                      {selected.van_vehicle_type && <p><span className="text-gray-400">Type:</span> {selected.van_vehicle_type}</p>}
                      {selected.van_driver_name && <p><span className="text-gray-400">Driver:</span> {selected.van_driver_name}</p>}
                      {selected.van_driver_phone && (
                        <p>
                          <span className="text-gray-400">Phone:</span>{' '}
                          <a className="text-primary" href={`tel:${selected.van_driver_phone}`}>{selected.van_driver_phone}</a>
                        </p>
                      )}
                      {selected.estimated_delivery_at && (
                        <p><span className="text-gray-400">ETA:</span> {new Date(selected.estimated_delivery_at).toLocaleString('en-IN')}</p>
                      )}
                      {selected.delivered_at && (
                        <p><span className="text-gray-400">Delivered:</span> {new Date(selected.delivered_at).toLocaleString('en-IN')}</p>
                      )}
                      {selected.delivery_notes && <p className="text-xs text-gray-500">{selected.delivery_notes}</p>}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">Waiting for vendor to assign a delivery van.</p>
                  )}
                  {selected.delivery_address && (
                    <p className="text-xs text-gray-500">Address: {selected.delivery_address}</p>
                  )}
                </div>
              )}

              {(selected.timeline || []).length > 0 && (
                <div className="border-t pt-3">
                  <h3 className="text-sm font-semibold mb-2">Timeline</h3>
                  <ol className="space-y-2">
                    {(selected.timeline || []).map((t, i) => (
                      <li key={i} className="text-xs flex gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        <div>
                          <p className="font-medium text-gray-800">{t.event}</p>
                          {t.detail && <p className="text-gray-500">{t.detail}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="flex flex-wrap gap-2 border-t pt-3">
                {['pending', 'approved'].includes(selected.status) && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={cancel.isPending}
                    onClick={() => cancel.mutate(selected.id)}
                  >
                    Cancel Rental
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setSelected(null)}>Close</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
