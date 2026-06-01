/**
 * Standalone Create-Booking modal — can be opened from any context (POS, Bookings page, etc.)
 * Pre-fill any combination of customer / service / date / time / staff.
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { apiClient } from '@/api/client'
import { useServices } from '@/hooks/useVendor'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'
import {
  X, Search, Plus, CalendarDays, Clock, Users, Building2,
  Hourglass, AlertTriangle, CheckCircle, Zap, ExternalLink,
  Loader2, Check, CalendarCheck2,
} from 'lucide-react'
import type { Customer } from '@/types'

// ── Helpers ──────────────────────────────────────────────────────────────────
function tMins(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m }
function minsT(m: number) { const h = Math.floor(m / 60) % 24; const min = m % 60; return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}` }
function fmtDur(m: number) { if (m < 60) return `${m} min`; const h = Math.floor(m/60); const r = m%60; return r ? `${h}h ${r}m` : `${h}h` }
function fmt12(t: string) { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}` }

const SLOT_START = 8*60; const SLOT_END = 22*60; const SLOT_SPAN = SLOT_END-SLOT_START
function slotPct(t: string) { return Math.min(100,Math.max(0,((tMins(t)-SLOT_START)/SLOT_SPAN)*100)) }

// ── Types ─────────────────────────────────────────────────────────────────────
export interface CreateBookingPreFill {
  customer?: Customer | null
  serviceId?: string
  date?: string
  startTime?: string
  endTime?: string
  staffId?: string
}

export interface CreateBookingModalProps {
  preFill?: CreateBookingPreFill
  onCreated?: (bookingId: string) => void
  onClose: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────
export function CreateBookingModal({
 preFill, onCreated, onClose }: CreateBookingModalProps) {
  useEscapeToClose(onClose)

  const qc = useQueryClient()
  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

  // ── Remote data ──────────────────────────────────────────────────────────
  const { data: svcData } = useServices({ size: 200, status: 'active' })
  const services = (svcData?.items || []) as unknown as Record<string, unknown>[]

  const { data: teamData } = useQuery({
    queryKey: ['team-for-booking'],
    queryFn: () => vendorApi.listTeamMembers({ size: 100 }),
    staleTime: 5 * 60_000,
  })
  const teamMembers = (teamData?.items || []) as unknown as Record<string, unknown>[]

  const { data: storesData } = useQuery({
    queryKey: ['stores-for-booking'],
    queryFn: async () => { const r = await apiClient.get('/vendors/me/stores', { params: { size: 50 } }); return r.data?.items || [] },
    staleTime: 5 * 60_000,
  })
  const stores = (storesData || []) as Record<string, unknown>[]

  // ── Form state ──────────────────────────────────────────────────────────
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(preFill?.customer ?? null)
  const [custSearch, setCustSearch] = useState('')
  const [custResults, setCustResults] = useState<Customer[]>([])
  const [showCustDropdown, setShowCustDropdown] = useState(false)

  const [selectedService, setSelectedService] = useState(preFill?.serviceId ?? '')
  const [selectedStaff, setSelectedStaff] = useState(preFill?.staffId ?? '')
  const [selectedStore, setSelectedStore] = useState('')
  const [bookingDate, setBookingDate] = useState(preFill?.date ?? '')
  const [startTime, setStartTime] = useState(preFill?.startTime ?? '')
  const [endTime, setEndTime] = useState(preFill?.endTime ?? '')
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cod')
  const [creating, setCreating] = useState(false)

  const selectedSvc = useMemo(() => services.find(s => s.id === selectedService), [services, selectedService])
  const svcDuration = (selectedSvc?.duration_minutes as number | undefined) ?? 0

  // Slot availability
  const [dateSlots, setDateSlots] = useState<Record<string, unknown>[]>([])
  const [dateSlotsLoading, setDateSlotsLoading] = useState(false)

  useEffect(() => {
    if (!bookingDate) return
    setDateSlotsLoading(true)
    setDateSlots([])
    vendorApi.listBookings({ booking_date: bookingDate, size: 100 })
      .then((res: any) => setDateSlots((res?.items || []).filter((b: any) => b.start_time)))
      .catch(() => {})
      .finally(() => setDateSlotsLoading(false))
  }, [bookingDate])

  const selectedDuration = useMemo(() => {
    if (!startTime || !endTime) return 0
    const d = tMins(endTime) - tMins(startTime)
    return d > 0 ? d : 0
  }, [startTime, endTime])

  const hasConflict = useMemo(() => {
    if (!startTime || !endTime || selectedDuration === 0) return false
    const sf = tMins(startTime); const st = tMins(endTime)
    const relevant = (dateSlots as any[]).filter(s => {
      if (!s.start_time || !s.end_time) return false
      if (['cancelled', 'no_show'].includes(s.status)) return false
      if (selectedStaff) return (s.staff_id === selectedStaff || s.assigned_staff_id === selectedStaff)
      return true
    })
    return relevant.some((s: any) => {
      const ef = tMins((s.start_time as string).slice(0, 5))
      const et = tMins((s.end_time as string).slice(0, 5))
      return sf < et && st > ef
    })
  }, [startTime, endTime, selectedDuration, dateSlots, selectedStaff])

  const activeSlots = useMemo(
    () => (dateSlots as any[]).filter(s => !['cancelled', 'no_show'].includes(s.status) && s.start_time),
    [dateSlots],
  )

  // Auto-fill end time when service or start time changes
  const handleStartChange = (val: string) => {
    setStartTime(val)
    if (svcDuration > 0 && val) {
      setEndTime(minsT(Math.min(tMins(val) + svcDuration, 23*60+59)))
    }
  }

  const handleServiceChange = (svcId: string) => {
    setSelectedService(svcId)
    setEndTime('')
    if (startTime && svcId) {
      const svc = services.find(s => s.id === svcId)
      const dur = (svc?.duration_minutes as number | undefined) ?? 0
      if (dur > 0) setEndTime(minsT(Math.min(tMins(startTime) + dur, 23*60+59)))
    }
  }

  // Customer search
  const searchCustomers = useCallback(async (q: string) => {
    if (q.length < 2) { setCustResults([]); return }
    try {
      const res = await vendorApi.listCustomers({ search: q, size: 6 })
      setCustResults(res.items || [])
      setShowCustDropdown(true)
    } catch { setCustResults([]) }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => searchCustomers(custSearch), 300)
    return () => clearTimeout(t)
  }, [custSearch, searchCustomers])

  // Submit
  const handleCreate = async () => {
    if (!selectedService || !bookingDate || !selectedCustomer) {
      toast.error('Please select a customer, service, and date')
      return
    }
    setCreating(true)
    try {
      const res: any = await vendorApi.createBooking({
        service_id: selectedService,
        booking_date: bookingDate,
        start_time: startTime || undefined,
        end_time: endTime || undefined,
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.full_name,
        customer_email: selectedCustomer.email,
        customer_phone: selectedCustomer.phone,
        notes: notes || undefined,
        payment_method: paymentMethod,
        ...(selectedStaff ? { staff_id: selectedStaff, assigned_staff_name: (teamMembers.find(m => (m as any).id === selectedStaff) as any)?.full_name } : {}),
        ...(selectedStore ? { store_id: selectedStore } : {}),
      })
      toast.success('Booking created!')
      qc.invalidateQueries({ queryKey: ['bookings'] })
      onCreated?.(res?.id || '')
      onClose()
    } catch (err) {
      toast.error(extractApiError(err, 'Could not create booking'))
    } finally {
      setCreating(false)
    }
  }

  // Timeline
  const selFromPct = startTime ? slotPct(startTime) : null
  const selToPct   = endTime   ? slotPct(endTime) : null

  const readyChecks = [
    { label: 'Customer selected', ok: !!selectedCustomer },
    { label: 'Service selected', ok: !!selectedService },
    { label: 'Date set', ok: !!bookingDate },
    { label: 'Time slot set', ok: !!(startTime && endTime) },
    { label: 'No conflicts', ok: !hasConflict },
  ]

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-emerald-700 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <CalendarCheck2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Create Booking</h2>
              <p className="text-primary-foreground/85 text-xs mt-0.5">Fill in the details below to confirm the appointment</p>
            </div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/25 transition-colors">
                <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Body — three columns */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          {/* ── COL 1: Who & What ──────────────────────────────────────────── */}
          <div className="w-64 shrink-0 border-r overflow-y-auto px-4 py-5 space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-primary/80">Who &amp; What</p>

            {/* Customer */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">Customer *</label>
              {selectedCustomer ? (
                <div className="flex items-center gap-2 p-2 bg-accent border border-primary/30 rounded-xl">
                  <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {selectedCustomer.full_name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{selectedCustomer.full_name}</p>
                    <p className="text-xs text-gray-500 truncate">{selectedCustomer.phone || selectedCustomer.email}</p>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <a href={`/customers/${selectedCustomer.id}`} target="_blank" rel="noopener noreferrer"
                      className="p-1 rounded hover:bg-primary/15" title="Open" onClick={e => e.stopPropagation()}>
                      <ExternalLink className="w-3 h-3 text-primary/70" />
                    </a>
                    <button type="button" aria-label="Close" onClick={() => { setSelectedCustomer(null); setCustSearch('') }}
                      className="p-1 rounded hover:bg-primary/15" title="Remove">
                <X className="w-3 h-3 text-primary/70" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    placeholder="Search name, phone, email…"
                    value={custSearch}
                    onChange={e => setCustSearch(e.target.value)}
                    onFocus={() => custResults.length && setShowCustDropdown(true)}
                    autoComplete="off"
                    className="w-full h-9 pl-8 pr-3 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {showCustDropdown && custResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-xl shadow-xl max-h-48 overflow-y-auto">
                      {custResults.map(c => (
                        <button key={c.id}
                          className="w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-2 border-b border-gray-50 last:border-0"
                          onClick={() => { setSelectedCustomer(c); setShowCustDropdown(false); setCustSearch('') }}>
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">{c.full_name[0].toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{c.full_name}</p>
                            <p className="text-xs text-gray-400 truncate">{c.phone || c.email}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Service */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">Service *</label>
              <select
                className="w-full h-9 px-3 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                value={selectedService}
                onChange={e => handleServiceChange(e.target.value)}
              >
                <option value="">Select a service…</option>
                {services.map(s => (
                  <option key={s.id as string} value={s.id as string}>
                    {s.name as string}{s.duration_minutes ? ` (${s.duration_minutes}m)` : ''}
                  </option>
                ))}
              </select>
              {selectedSvc && svcDuration > 0 && (
                <p className="text-xs text-primary flex items-center gap-1 mt-1">
                  <Hourglass className="w-2.5 h-2.5" /> {fmtDur(svcDuration)}
                  {(selectedSvc.price as number) > 0 && <span className="ml-auto text-gray-500">{formatCurrency(selectedSvc.price as number)}</span>}
                </p>
              )}
            </div>

            {/* Who Serves */}
            {teamMembers.length > 0 && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-1.5">
                  <Users className="w-3 h-3 text-primary/70" /> Who Serves
                </label>
                <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}
                  className="w-full h-9 px-3 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Any available</option>
                  {teamMembers.map((m: any) => (
                    <option key={m.id} value={m.id}>{m.full_name || m.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Store/Location */}
            {stores.length > 1 && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-1.5">
                  <Building2 className="w-3 h-3 text-primary/70" /> Location
                </label>
                <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)}
                  className="w-full h-9 px-3 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">All locations</option>
                  {stores.map((st: any) => (
                    <option key={st.id} value={st.id}>{st.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Payment */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">Payment</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                className="w-full h-9 px-3 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="cod">Cash on Delivery</option>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="online">Online</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">Notes</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-white resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any special instructions…"
              />
            </div>
          </div>

          {/* ── COL 2: When ────────────────────────────────────────────────── */}
          <div className="w-56 shrink-0 border-r overflow-y-auto px-4 py-5 space-y-4 bg-gray-50/40">
            <p className="text-xs font-bold uppercase tracking-widest text-primary/80">When</p>

            {/* Date */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-1.5">
                <CalendarDays className="w-3 h-3 text-primary/70" /> Date *
              </label>
              <input type="date" value={bookingDate} min={today}
                onChange={e => setBookingDate(e.target.value)}
                className="w-full h-9 px-3 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-ring" />
              {bookingDate && (
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(bookingDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short' })}
                </p>
              )}
            </div>

            {/* Start + End time */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-1.5">
                <Clock className="w-3 h-3 text-primary/70" /> Time Slot
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Start</p>
                  <input type="time" value={startTime} onChange={e => handleStartChange(e.target.value)}
                    className="w-full h-9 px-2 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">End</p>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                    className="w-full h-9 px-2 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              {svcDuration > 0 && startTime && (
                <button type="button" onClick={() => setEndTime(minsT(Math.min(tMins(startTime) + svcDuration, 23*60+59)))}
                  className="mt-1.5 flex items-center gap-1 text-xs text-primary hover:text-primary font-medium">
                  <Zap className="w-3 h-3" /> Auto-fill ({fmtDur(svcDuration)})
                </button>
              )}
            </div>

            {/* Slot status */}
            {selectedDuration > 0 && (
              <div className={`rounded-xl border px-3 py-2.5 ${hasConflict ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  {hasConflict
                    ? <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                    : <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                  <span className={`text-xs font-bold uppercase tracking-wide ${hasConflict ? 'text-red-500' : 'text-emerald-600'}`}>
                    {hasConflict ? 'Time Conflict' : 'Slot Available'}
                  </span>
                </div>
                <p className={`text-xs font-medium ${hasConflict ? 'text-red-700' : 'text-emerald-700'}`}>
                  {fmt12(startTime)} – {fmt12(endTime)}
                </p>
                <p className={`text-xs mt-0.5 ${hasConflict ? 'text-red-400' : 'text-emerald-500'}`}>
                  {hasConflict ? 'Overlaps an existing booking' : fmtDur(selectedDuration)}
                </p>
              </div>
            )}

            {/* Ready checklist */}
            <div className="rounded-xl border border-gray-100 bg-white p-3 space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Ready?</p>
              {readyChecks.map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${item.ok ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                    {item.ok && <Check className="w-2 h-2 text-white" />}
                  </div>
                  <span className={`text-xs ${item.ok ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── COL 3: Availability ─────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 overflow-y-auto px-4 py-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-primary/80">Availability</p>
              {dateSlotsLoading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                : bookingDate && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${activeSlots.length === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                    <Users className="w-3 h-3 inline mr-0.5" />{activeSlots.length} booked
                  </span>
                )
              }
            </div>

            {/* Timeline */}
            {bookingDate && (
              <div>
                <div className="relative h-10 bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
                  {[8, 11, 14, 17, 20, 22].map(h => (
                    <div key={h} className="absolute top-0 bottom-0 w-px bg-gray-200"
                      style={{ left: `${((h*60-SLOT_START)/SLOT_SPAN)*100}%` }} />
                  ))}
                  {selFromPct !== null && selToPct !== null && selectedDuration > 0 && (
                    <div className={`absolute top-1 bottom-1 rounded-lg border-2 ${hasConflict ? 'bg-red-400/30 border-red-500' : 'bg-primary/50/30 border-primary'}`}
                      style={{ left: `${selFromPct}%`, width: `${Math.max(1.5, selToPct-selFromPct)}%` }} />
                  )}
                  {activeSlots.map((slot: any) => {
                    const l = slotPct(slot.start_time!.slice(0,5))
                    const r = slotPct(slot.end_time!.slice(0,5))
                    return (
                      <div key={slot.id} className="absolute top-2 bottom-2 bg-rose-500 rounded-md opacity-70"
                        style={{ left: `${l}%`, width: `${Math.max(1.5, r-l)}%` }}
                        title={`${slot.customer_name || 'Booked'} · ${slot.start_time?.slice(0,5)}–${slot.end_time?.slice(0,5)}`}
                      />
                    )
                  })}
                </div>
                <div className="flex justify-between mt-1 px-0.5">
                  {['8AM','11AM','2PM','5PM','8PM','10PM'].map(l => (
                    <span key={l} className="text-xs text-gray-400">{l}</span>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-2.5 rounded bg-rose-500 opacity-75"/><span className="text-xs text-gray-500">Booked</span></div>
                  {selectedDuration > 0 && <div className="flex items-center gap-1.5"><div className={`w-3 h-2.5 rounded border-2 ${hasConflict ? 'bg-red-400/30 border-red-500' : 'bg-primary/50/30 border-primary'}`}/><span className="text-xs text-gray-500">Your slot</span></div>}
                </div>
              </div>
            )}

            {/* Slot list */}
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
              {!bookingDate && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CalendarDays className="w-8 h-8 text-gray-200 mb-2" />
                  <p className="text-xs text-gray-400">Pick a date to see availability</p>
                </div>
              )}
              {bookingDate && !dateSlotsLoading && activeSlots.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mb-2">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                  </div>
                  <p className="text-xs font-medium text-gray-600">All clear!</p>
                  <p className="text-xs text-gray-400 mt-0.5">No bookings on this date</p>
                </div>
              )}
              {!dateSlotsLoading && activeSlots.map((slot: any) => {
                const dot: Record<string, string> = { pending: 'bg-amber-400', confirmed: 'bg-blue-400', in_progress: 'bg-primary/70', completed: 'bg-green-400' }
                const badge: Record<string, string> = { pending: 'bg-amber-100 text-amber-700', confirmed: 'bg-blue-100 text-blue-700', in_progress: 'bg-primary/12 text-primary', completed: 'bg-green-100 text-green-700' }
                const label: Record<string, string> = { pending: 'Pending', confirmed: 'Confirmed', in_progress: 'In Progress', completed: 'Completed' }
                return (
                  <div key={slot.id} className="flex items-center gap-2.5 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-white">
                        {(slot.customer_name || 'G').trim().split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{slot.customer_name || 'Guest'}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />{slot.start_time?.slice(0,5)}{slot.end_time ? ` – ${slot.end_time.slice(0,5)}` : ''}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${badge[slot.status] || 'bg-gray-100 text-gray-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full inline-block ${dot[slot.status] || 'bg-gray-300'}`} />
                      {label[slot.status] || slot.status}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 px-6 py-4 flex items-center gap-3 shrink-0">
          <Button variant="cancel" className="h-10 px-5" onClick={onClose} disabled={creating}>
            Cancel
          </Button>
          <div className="flex-1" />
          {/* Summary pills */}
          <div className="hidden sm:flex items-center gap-2 flex-wrap">
            {selectedCustomer && (
              <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-semibold">
                {selectedCustomer.full_name}
              </span>
            )}
            {selectedSvc && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-semibold">
                {selectedSvc.name as string}
              </span>
            )}
            {bookingDate && (
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-semibold">
                {new Date(bookingDate+'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short' })}
                {startTime && ` · ${fmt12(startTime)}`}
              </span>
            )}
          </div>
          <Button
            className="h-10 px-6 bg-primary hover:bg-primary/90 font-semibold gap-2 min-w-[160px]"
            disabled={!selectedCustomer || !selectedService || !bookingDate || creating}
            onClick={handleCreate}
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {creating ? 'Creating…' : 'Create Booking'}
          </Button>
        </div>
      </div>
    </div>
  )
}
