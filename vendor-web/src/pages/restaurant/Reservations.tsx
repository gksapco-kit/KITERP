import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Calendar, Check, Loader2, Plus, Trash2, UtensilsCrossed, Users,
  X, Phone, Mail, Clock,
} from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import type { ReservationItem } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { toast } from 'sonner'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { cn } from '@/lib/utils'

import { askConfirm } from '@/components/common/ConfirmProvider'
const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  pending:   { label: 'Pending',   badge: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: 'Confirmed', badge: 'bg-blue-100 text-blue-700' },
  seated:    { label: 'Seated',    badge: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'Cancelled', badge: 'bg-gray-100 text-gray-500 line-through' },
  no_show:   { label: 'No-show',   badge: 'bg-red-100 text-red-700' },
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function RestaurantReservationsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [dateFrom, setDateFrom] = useState(today())
  const [exactDateOnly, setExactDateOnly] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const { selectedRestaurant } = useRestaurantStore()
  const rid = selectedRestaurant?.id

  const { data, isLoading } = useQuery({
    queryKey: ['restaurant', 'reservations', dateFrom, exactDateOnly, rid],
    queryFn: () =>
      vendorApi.restaurantListReservations({
        date_from: dateFrom,
        date_to: exactDateOnly ? dateFrom : undefined,
        ...(rid ? { restaurant_id: rid } : {}),
      }),
    refetchInterval: 30_000,
  })

  const updateReservation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof vendorApi.restaurantUpdateReservation>[1] }) =>
      vendorApi.restaurantUpdateReservation(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant', 'reservations'] })
      toast.success('Reservation updated')
    },
    onError: () => toast.error('Could not update reservation'),
  })

  const updateReservationStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      vendorApi.restaurantUpdateReservationStatus(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant', 'reservations'] })
      toast.success('Status updated')
    },
    onError: () => toast.error('Could not update status'),
  })

  const deleteRes = useMutation({
    mutationFn: (id: string) => vendorApi.restaurantDeleteReservation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant', 'reservations'] })
      toast.success('Reservation removed')
    },
    onError: () => toast.error('Could not delete reservation'),
  })

  const tablesQ = useQuery({
    queryKey: ['restaurant', 'tables'],
    queryFn: () => vendorApi.restaurantListTables(),
  })

  const seatGuest = useMutation({
    mutationFn: ({ id, table_id, covers }: { id: string; table_id: string; covers?: number }) =>
      vendorApi.restaurantSeatReservation(id, { table_id, covers }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['restaurant'] })
      toast.success('Guest seated — opening table order')
      navigate(`/restaurant/order/${res.order_id}`)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof msg === 'string' ? msg : 'Could not seat reservation')
    },
  })

  const reservations = data?.items ?? []
  const freeTables = (tablesQ.data?.items ?? []).filter(t => t.is_active && t.status === 'free')

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/restaurant/floor"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-600" /> Reservations
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage table bookings and walk-in pre-registrations</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 text-sm w-40" />
          <label className="flex items-center gap-1.5 text-xs text-gray-600 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={exactDateOnly}
              onChange={e => setExactDateOnly(e.target.checked)}
              className="accent-primary"
            />
            This day only
          </label>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
      </div>

      {showForm && (
        <NewReservationForm
          onSuccess={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['restaurant', 'reservations'] }) }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {isLoading && <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>}

      {!isLoading && !reservations.length && (
        <div className="rounded-xl border border-dashed bg-gray-50 p-10 text-center text-gray-400 text-sm">
          No reservations for this date range.
        </div>
      )}

      <div className="space-y-2">
        {reservations.map(r => (
          <ReservationRow
            key={r.id}
            reservation={r}
            freeTables={freeTables}
            onStatusChange={(status) => updateReservationStatus.mutate({ id: r.id, status })}
            onSeat={(tableId, covers) => seatGuest.mutate({ id: r.id, table_id: tableId, covers })}
            onSaveEdit={(body) => updateReservation.mutate({ id: r.id, body })}
            onDelete={async () => { if (await askConfirm('Delete this reservation?')) deleteRes.mutate(r.id) }}
            isPending={updateReservation.isPending || updateReservationStatus.isPending || deleteRes.isPending || seatGuest.isPending}
          />
        ))}
      </div>
    </div>
  )
}


function ReservationRow({
  reservation: r,
  freeTables,
  onStatusChange,
  onSeat,
  onSaveEdit,
  onDelete,
  isPending,
}: {
  reservation: ReservationItem
  freeTables: Array<{ id: string; label: string; capacity: number }>
  onStatusChange: (status: string) => void
  onSeat: (tableId: string, covers?: number) => void
  onSaveEdit: (body: Parameters<typeof vendorApi.restaurantUpdateReservation>[1]) => void
  onDelete: () => void
  isPending: boolean
}) {
  const [expand, setExpand] = useState(false)
  const [editing, setEditing] = useState(false)
  const [seatOpen, setSeatOpen] = useState(false)
  const [seatTableId, setSeatTableId] = useState('')
  const [edit, setEdit] = useState({
    guest_name: r.guest_name,
    guest_phone: r.guest_phone || '',
    guest_email: r.guest_email || '',
    reservation_date: r.reservation_date,
    reservation_time: r.reservation_time,
    party_size: r.party_size,
    notes: r.notes || '',
  })
  const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending

  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <button
        type="button"
        className="w-full flex flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setExpand(e => !e)}
      >
        <div className="shrink-0 text-center w-12">
          <p className="text-lg font-bold text-gray-800">{r.reservation_time}</p>
          <p className="text-xs text-gray-400">{formatDate(r.reservation_date)}</p>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{r.guest_name}</p>
          <p className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
            <Users className="w-3 h-3" /> {r.party_size} guests
            {r.table_label && <span>· Table {r.table_label}</span>}
          </p>
        </div>
        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full shrink-0', cfg.badge)}>
          {cfg.label}
        </span>
      </button>

      {expand && (
        <div className="border-t px-4 py-3 bg-gray-50 space-y-3">
          {!editing ? (
            <>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                {r.guest_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{r.guest_phone}</span>}
                {r.guest_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{r.guest_email}</span>}
                {r.notes && <span className="col-span-2 italic text-gray-500">{r.notes}</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {['pending', 'confirmed', 'cancelled', 'no_show'].map(s => (
                  <Button
                    key={s}
                    size="sm"
                    variant={r.status === s ? 'default' : 'outline'}
                    className="text-xs h-7"
                    disabled={isPending}
                    onClick={() => onStatusChange(s)}
                  >
                    {STATUS_CONFIG[s]?.label ?? s}
                  </Button>
                ))}
                {r.status !== 'seated' && (
                  <Button size="sm" variant="outline" className="text-xs h-7 border-amber-300 text-amber-800" disabled={isPending} onClick={() => setSeatOpen(true)}>
                    Seat at table
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-xs h-7" disabled={isPending} onClick={() => setEditing(true)}>
                  Edit details
                </Button>
                <Button size="sm" variant="ghost" className="text-xs h-7 text-red-500" disabled={isPending} onClick={onDelete}>
                  <Trash2 className="w-3 h-3 mr-1" /> Delete
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Input value={edit.guest_name} onChange={e => setEdit(x => ({ ...x, guest_name: e.target.value }))} className="h-8 text-sm col-span-2" placeholder="Guest name" />
                <PhoneInput value={edit.guest_phone} onChange={v => setEdit(x => ({ ...x, guest_phone: v }))} defaultCountryIso="IN" />
                <Input value={edit.guest_email} onChange={e => setEdit(x => ({ ...x, guest_email: e.target.value }))} className="h-8 text-sm" placeholder="Email" />
                <Input type="date" value={edit.reservation_date} onChange={e => setEdit(x => ({ ...x, reservation_date: e.target.value }))} className="h-8 text-sm" />
                <Input type="time" value={edit.reservation_time} onChange={e => setEdit(x => ({ ...x, reservation_time: e.target.value }))} className="h-8 text-sm" />
                <Input type="number" min={1} value={edit.party_size} onChange={e => setEdit(x => ({ ...x, party_size: parseInt(e.target.value) || 1 }))} className="h-8 text-sm" />
                <Input value={edit.notes} onChange={e => setEdit(x => ({ ...x, notes: e.target.value }))} className="h-8 text-sm col-span-2" placeholder="Notes" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                <Button size="sm" disabled={isPending} onClick={() => { onSaveEdit(edit); setEditing(false) }}>Save</Button>
              </div>
            </div>
          )}
          {seatOpen && (
            <div className="rounded-lg border bg-white p-3 space-y-2">
              <p className="text-xs font-medium text-gray-700">Assign a free table and open order</p>
              <Select
                value={seatTableId}
                onChange={setSeatTableId}
                options={selectOptionsWithBlank('Select table…', freeTables.map(t => ({
                  value: t.id,
                  label: `${t.label} (${t.capacity} seats)`,
                })))}
                placeholder="Select table…"
                aria-label="Table"
                className="w-full"
              />
              {freeTables.length === 0 && <p className="text-xs text-amber-700">No free tables — clear one on the floor first.</p>}
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => setSeatOpen(false)}>Cancel</Button>
                <Button
                  size="sm"
                  disabled={!seatTableId || isPending}
                  onClick={() => { onSeat(seatTableId, edit.party_size); setSeatOpen(false) }}
                >
                  Seat &amp; order
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


function NewReservationForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    guest_name: '', guest_phone: '', guest_email: '',
    reservation_date: today(), reservation_time: '19:00',
    party_size: 2, notes: '',
  })

  const create = useMutation({
    mutationFn: () => vendorApi.restaurantCreateReservation({ ...form, source: 'phone' }),
    onSuccess: () => { toast.success('Reservation created'); onSuccess() },
    onError: () => toast.error('Could not create reservation'),
  })

  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="rounded-xl border bg-white p-5 space-y-4">
      <h2 className="font-semibold text-gray-800">New Reservation</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label className="text-xs font-medium text-gray-500 block mb-1" required>Guest name</Label>
          <Input value={form.guest_name} onChange={e => set('guest_name', e.target.value)} className="h-9 text-sm" placeholder="John Smith" />
        </div>
        <div>
          <Label className="text-xs font-medium text-gray-500 block mb-1">Phone</Label>
          <PhoneInput
            value={form.guest_phone}
            onChange={v => set('guest_phone', v)}
            defaultCountryIso="IN"
            autoComplete="tel"
            name="guest_phone"
          />
        </div>
        <div>
          <Label className="text-xs font-medium text-gray-500 block mb-1">Email</Label>
          <Input value={form.guest_email} onChange={e => set('guest_email', e.target.value)} className="h-9 text-sm" placeholder="guest@email.com" />
        </div>
        <div>
          <Label className="text-xs font-medium text-gray-500 block mb-1" required>Date</Label>
          <Input type="date" value={form.reservation_date} onChange={e => set('reservation_date', e.target.value)} className="h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs font-medium text-gray-500 block mb-1" required>Time</Label>
          <Input type="time" value={form.reservation_time} onChange={e => set('reservation_time', e.target.value)} className="h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs font-medium text-gray-500 block mb-1">Party size</Label>
          <Input type="number" min={1} max={50} value={form.party_size} onChange={e => set('party_size', parseInt(e.target.value) || 1)} className="h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs font-medium text-gray-500 block mb-1">Notes</Label>
          <Input value={form.notes} onChange={e => set('notes', e.target.value)} className="h-9 text-sm" placeholder="Special requests…" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" disabled={!form.guest_name || create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save reservation
        </Button>
      </div>
    </div>
  )
}
