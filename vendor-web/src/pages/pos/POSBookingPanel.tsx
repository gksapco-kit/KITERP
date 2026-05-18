import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { vendorApi } from '@/api/vendor'
import { formatCurrency } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import {
  X, Clock, AlertTriangle, Loader2, CheckCircle,
  CalendarDays, Zap, Users, CalendarCheck2, Hourglass, ExternalLink,
} from 'lucide-react'
import { usePanelResize } from '@/hooks/usePanelResize'
import { DragHandle } from '@/components/common/DragHandle'
import type { Customer } from '@/types'

interface ExistingSlot {
  id: string
  booking_number?: string
  customer_name?: string
  start_time?: string
  end_time?: string
  status: string
}

interface POSBookingPanelProps {
  cartIdx: number
  serviceName: string
  serviceId?: string
  servicePrice: number
  serviceDurationMinutes: number | undefined
  currentDate: string
  currentFromTime: string
  currentToTime: string
  customer?: Customer | null
  onConfirm: (idx: number, date: string, fromTime: string, toTime: string, overriddenPrice?: number, staffId?: string) => void
  onOpenFullBooking?: (params: { date: string; fromTime: string; toTime: string; staffId: string }) => void
  onClose: () => void
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`
}

function formatDisplayTime(t: string): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function formatDisplayDate(d: string): string {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  })
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  pending:     { label: 'Pending',     dot: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700' },
  confirmed:   { label: 'Confirmed',   dot: 'bg-blue-400',   badge: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', dot: 'bg-primary/70', badge: 'bg-primary/12 text-primary' },
  completed:   { label: 'Completed',   dot: 'bg-green-400',  badge: 'bg-green-100 text-green-700' },
  cancelled:   { label: 'Cancelled',   dot: 'bg-gray-300',   badge: 'bg-gray-100 text-gray-500' },
  no_show:     { label: 'No-Show',     dot: 'bg-gray-300',   badge: 'bg-gray-100 text-gray-500' },
}

function CustomerInitial({ name }: { name?: string }) {
  const initials = (name || 'G').trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary flex items-center justify-center shrink-0">
      <span className="text-[10px] font-bold text-white">{initials}</span>
    </div>
  )
}

export function POSBookingPanel({
  cartIdx,
  serviceName,
  servicePrice,
  serviceDurationMinutes,
  currentDate,
  currentFromTime,
  currentToTime,
  customer,
  onConfirm,
  onOpenFullBooking,
  onClose,
}: POSBookingPanelProps) {
  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

  const [date, setDate] = useState(currentDate || today)
  const [fromTime, setFromTime] = useState(currentFromTime || '09:00')
  const [toTime, setToTime] = useState(currentToTime || '')
  const [selectedStaff, setSelectedStaff] = useState('')
  const [slots, setSlots] = useState<ExistingSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [overriddenPrice, setOverriddenPrice] = useState<number | null>(null)

  // Load team members for "Who Serves"
  const { data: teamData } = useQuery({
    queryKey: ['team-for-booking'],
    queryFn: () => vendorApi.listTeamMembers({ size: 100 }),
    staleTime: 5 * 60_000,
  })
  const teamMembers = ((teamData?.items || []) as unknown) as Record<string, unknown>[]

  // Resizable two-column layout — persisted
  const { widths: panelWidths, startResize: startPanelResize, resetWidths: resetPanelWidths } = usePanelResize(
    'pos-booking-panel-cols',
    [340],
    { min: [220], max: [520] },
  )

  const maxDuration = serviceDurationMinutes ?? 0

  // On first open: derive end time from duration if not already set
  useEffect(() => {
    if (fromTime && !currentToTime && maxDuration > 0) {
      const endMins = timeToMinutes(fromTime) + maxDuration
      setToTime(minutesToTime(Math.min(endMins, 23 * 60 + 59)))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When from-time changes, shift to-time by same duration if service has duration
  const handleFromChange = (val: string) => {
    setFromTime(val)
    if (maxDuration > 0 && val) {
      const endMins = timeToMinutes(val) + maxDuration
      setToTime(minutesToTime(Math.min(endMins, 23 * 60 + 59)))
    }
  }

  // Quick-fill to standard duration
  const applyStandardDuration = () => {
    if (!fromTime || maxDuration <= 0) return
    const endMins = timeToMinutes(fromTime) + maxDuration
    setToTime(minutesToTime(Math.min(endMins, 23 * 60 + 59)))
  }

  // Load slots for selected date
  useEffect(() => {
    if (!date) return
    setSlotsLoading(true)
    setSlots([])
    vendorApi.listBookings({ booking_date: date, size: 100 })
      .then((res: any) => {
        setSlots((res?.items || []).filter((b: any) => b.start_time || b.end_time))
      })
      .catch(() => {})
      .finally(() => setSlotsLoading(false))
  }, [date])

  const selectedDuration = useMemo(() => {
    if (!fromTime || !toTime) return 0
    const diff = timeToMinutes(toTime) - timeToMinutes(fromTime)
    return diff > 0 ? diff : 0
  }, [fromTime, toTime])

  const exceedsMax = maxDuration > 0 && selectedDuration > maxDuration

  const computedPrice = useMemo(() => {
    if (!exceedsMax || !maxDuration || !selectedDuration) return null
    return (servicePrice / maxDuration) * selectedDuration
  }, [exceedsMax, maxDuration, selectedDuration, servicePrice])

  const durationError = useMemo(() => {
    if (!fromTime || !toTime) return null
    return timeToMinutes(toTime) - timeToMinutes(fromTime) <= 0
      ? 'End time must be after start time'
      : null
  }, [fromTime, toTime])

  // Conflict detection: does our selection overlap any existing active booking?
  const hasConflict = useMemo(() => {
    if (!fromTime || !toTime || selectedDuration === 0) return false
    const selFrom = timeToMinutes(fromTime)
    const selTo   = timeToMinutes(toTime)
    return slots
      .filter(s => !['cancelled', 'no_show'].includes(s.status) && s.start_time && s.end_time)
      .some(s => {
        const sFrom = timeToMinutes(s.start_time!.slice(0, 5))
        const sTo   = timeToMinutes(s.end_time!.slice(0, 5))
        return selFrom < sTo && selTo > sFrom
      })
  }, [fromTime, toTime, selectedDuration, slots])

  const handleApply = () => {
    if (durationError || !fromTime || !toTime) return
    if (exceedsMax) {
      setOverriddenPrice(computedPrice ?? null)
      setShowConfirm(true)
      return
    }
    onConfirm(cartIdx, date, fromTime, toTime, undefined, selectedStaff || undefined)
  }

  const handleProceed = () => {
    onConfirm(cartIdx, date, fromTime, toTime, overriddenPrice ?? undefined, selectedStaff || undefined)
    setShowConfirm(false)
  }

  const handleOpenFullBooking = () => {
    onOpenFullBooking?.({ date, fromTime, toTime, staffId: selectedStaff })
    onClose()
  }

  // Timeline: 8 AM – 10 PM
  const timelineStart = 8 * 60
  const timelineEnd   = 22 * 60
  const timelineSpan  = timelineEnd - timelineStart

  const slotToPercent = (t: string) =>
    Math.min(100, Math.max(0, ((timeToMinutes(t) - timelineStart) / timelineSpan) * 100))

  const selectedFromPct = fromTime ? slotToPercent(fromTime) : null
  const selectedToPct   = toTime   ? slotToPercent(toTime)   : null

  const activeSlots = slots.filter(s => !['cancelled', 'no_show'].includes(s.status) && s.start_time)

  const canConfirm = !!fromTime && !!toTime && !durationError && selectedDuration > 0

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >

        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-primary to-emerald-700 px-6 py-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <CalendarCheck2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">Book Appointment Slot</h2>
              <p className="text-primary-foreground/85 text-xs mt-0.5 truncate max-w-xs">{serviceName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/25 transition-colors ml-4 shrink-0"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* ── Service info strip ── */}
        <div className="grid grid-cols-2 divide-x border-b bg-accent">
          <div className="flex items-center gap-2.5 px-5 py-3">
            <Hourglass className="w-4 h-4 text-primary/70 shrink-0" />
            <div>
              <p className="text-[10px] font-semibold text-primary/70 uppercase tracking-wide">Standard Slot</p>
              <p className="text-sm font-bold text-primary mt-0.5">
                {maxDuration > 0 ? formatDuration(maxDuration) : <span className="font-normal text-gray-400">Not set</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 px-5 py-3">
            <div className="w-4 h-4 text-primary/70 shrink-0 font-bold text-sm flex items-center justify-center">₹</div>
            <div>
              <p className="text-[10px] font-semibold text-primary/70 uppercase tracking-wide">Base Price</p>
              <p className="text-sm font-bold text-primary mt-0.5">{formatCurrency(servicePrice)}</p>
            </div>
          </div>
        </div>

        {/* ── Body: two columns (drag handle to resize) ── */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          <div className="flex flex-1 min-h-0 min-w-0">

            {/* ── Left: Date + Time pickers ── */}
            <div className="px-5 py-5 space-y-5 overflow-y-auto shrink-0"
              style={{ width: panelWidths[0], minWidth: 220 }}>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Schedule</p>

              {/* Customer chip (read-only from POS) */}
              {customer && (
                <div className="flex items-center gap-2 p-2.5 bg-accent border border-primary/30 rounded-xl">
                  <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {customer.full_name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{customer.full_name}</p>
                    <p className="text-[10px] text-gray-500 truncate">{customer.phone || customer.email}</p>
                  </div>
                  <a href={`/customers/${customer.id}`} target="_blank" rel="noopener noreferrer"
                    className="p-1 rounded hover:bg-primary/15 shrink-0" title="Open customer profile">
                    <ExternalLink className="w-3 h-3 text-primary/70" />
                  </a>
                </div>
              )}

              {/* Who Serves */}
              {teamMembers.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-primary/70" /> Who Serves
                  </label>
                  <select
                    value={selectedStaff}
                    onChange={e => setSelectedStaff(e.target.value)}
                    className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm text-gray-800 bg-gray-50
                      focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent hover:border-gray-300 transition-colors"
                  >
                    <option value="">Any available staff</option>
                    {teamMembers.map((m: any) => (
                      <option key={m.id} value={m.id}>{m.full_name || m.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-primary/70" /> Booking Date
                </label>
                <input
                  type="date"
                  value={date}
                  min={today}
                  onChange={e => setDate(e.target.value)}
                  className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm text-gray-800
                    focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
                    hover:border-gray-300 transition-colors bg-gray-50"
                />
                {date && (
                  <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" /> {formatDisplayDate(date)}
                  </p>
                )}
              </div>

              {/* From / To */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-primary/70" /> Start Time
                  </label>
                  <input
                    type="time"
                    value={fromTime}
                    onChange={e => handleFromChange(e.target.value)}
                    className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm text-gray-800
                      focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
                      hover:border-gray-300 transition-colors bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-primary/70" /> End Time
                  </label>
                  <input
                    type="time"
                    value={toTime}
                    onChange={e => setToTime(e.target.value)}
                    className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm text-gray-800
                      focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
                      hover:border-gray-300 transition-colors bg-gray-50"
                  />
                </div>
              </div>

              {/* Standard duration quick-fill */}
              {maxDuration > 0 && (
                <button
                  type="button"
                  onClick={applyStandardDuration}
                  className="flex items-center gap-1.5 text-xs text-primary hover:text-primary font-medium transition-colors"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Auto-fill standard duration ({formatDuration(maxDuration)})
                </button>
              )}

              {/* Duration status card */}
              {selectedDuration > 0 && !durationError && (
                <div className={`rounded-xl border px-4 py-3 space-y-1 ${
                  hasConflict
                    ? 'bg-red-50 border-red-200'
                    : exceedsMax
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-emerald-50 border-emerald-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold uppercase tracking-wide ${
                      hasConflict ? 'text-red-500' : exceedsMax ? 'text-amber-500' : 'text-emerald-600'
                    }`}>
                      {hasConflict ? 'Time Conflict' : exceedsMax ? 'Exceeds Standard Slot' : 'Slot Available'}
                    </span>
                    {hasConflict
                      ? <AlertTriangle className="w-4 h-4 text-red-400" />
                      : exceedsMax
                      ? <AlertTriangle className="w-4 h-4 text-amber-400" />
                      : <CheckCircle className="w-4 h-4 text-emerald-500" />}
                  </div>
                  <p className={`text-sm font-semibold ${
                    hasConflict ? 'text-red-700' : exceedsMax ? 'text-amber-700' : 'text-emerald-700'
                  }`}>
                    {formatDisplayTime(fromTime)} – {formatDisplayTime(toTime)}
                    <span className="ml-2 text-xs font-normal opacity-70">({formatDuration(selectedDuration)})</span>
                  </p>
                  {hasConflict && (
                    <p className="text-xs text-red-600">
                      This time overlaps an existing booking. You can still proceed.
                    </p>
                  )}
                  {exceedsMax && !hasConflict && computedPrice !== null && (
                    <p className="text-xs text-amber-600">
                      Adjusted price: <strong>{formatCurrency(computedPrice)}</strong>
                      <span className="opacity-70"> (pro-rated for {formatDuration(selectedDuration)})</span>
                    </p>
                  )}
                </div>
              )}

              {durationError && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {durationError}
                </div>
              )}
            </div>

            <DragHandle onMouseDown={e => startPanelResize(0, e.clientX)} className="border-x border-gray-100" />

            {/* ── Right: Availability timeline ── */}
            <div className="px-5 py-5 space-y-4 flex-1 overflow-y-auto min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Availability</p>
                {slotsLoading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                  : (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      activeSlots.length === 0
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      <Users className="w-3 h-3 inline mr-0.5" />
                      {activeSlots.length} booked
                    </span>
                  )
                }
              </div>

              {/* Timeline bar */}
              <div>
                <div className="relative h-10 bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
                  {/* Hour tick marks */}
                  {[8, 11, 14, 17, 20, 22].map(h => (
                    <div
                      key={h}
                      className="absolute top-0 bottom-0 w-px bg-gray-200"
                      style={{ left: `${((h * 60 - timelineStart) / timelineSpan) * 100}%` }}
                    />
                  ))}

                  {/* Selected slot */}
                  {selectedFromPct !== null && selectedToPct !== null && selectedDuration > 0 && (
                    <div
                      className={`absolute top-1 bottom-1 rounded-lg border-2 ${
                        hasConflict
                          ? 'bg-red-400/30 border-red-500'
                          : 'bg-primary/50/30 border-primary'
                      }`}
                      style={{ left: `${selectedFromPct}%`, width: `${Math.max(1.5, selectedToPct - selectedFromPct)}%` }}
                    />
                  )}

                  {/* Existing slots */}
                  {slots
                    .filter(s => !['cancelled', 'no_show'].includes(s.status) && s.start_time && s.end_time)
                    .map(slot => {
                      const left  = slotToPercent(slot.start_time!.slice(0, 5))
                      const right = slotToPercent(slot.end_time!.slice(0, 5))
                      return (
                        <div
                          key={slot.id}
                          className="absolute top-2 bottom-2 bg-rose-500 rounded-md opacity-75"
                          style={{ left: `${left}%`, width: `${Math.max(1.5, right - left)}%` }}
                          title={`${slot.customer_name || 'Booked'} · ${slot.start_time?.slice(0, 5)}–${slot.end_time?.slice(0, 5)}`}
                        />
                      )
                    })}
                </div>

                {/* Time labels */}
                <div className="flex justify-between mt-1 px-0.5">
                  {['8AM', '11AM', '2PM', '5PM', '8PM', '10PM'].map(l => (
                    <span key={l} className="text-[9px] text-gray-400">{l}</span>
                  ))}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-2.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-2.5 rounded bg-rose-500 opacity-75" />
                    <span className="text-[10px] text-gray-500">Booked</span>
                  </div>
                  {selectedDuration > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className={`w-3 h-2.5 rounded border-2 ${hasConflict ? 'bg-red-400/30 border-red-500' : 'bg-primary/50/30 border-primary'}`} />
                      <span className="text-[10px] text-gray-500">Your slot</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Existing bookings list */}
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                {slotsLoading && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                  </div>
                )}
                {!slotsLoading && activeSlots.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mb-2">
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    </div>
                    <p className="text-xs font-semibold text-gray-600">All clear!</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">No bookings on this date</p>
                  </div>
                )}
                {!slotsLoading && activeSlots.map(slot => {
                  const sc = STATUS_CONFIG[slot.status] || STATUS_CONFIG.confirmed
                  return (
                    <div key={slot.id}
                      className="flex items-center gap-2.5 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 hover:bg-gray-100/80 transition-colors">
                      <CustomerInitial name={slot.customer_name} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">
                          {slot.customer_name || 'Guest'}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {slot.start_time?.slice(0, 5)}{slot.end_time ? ` – ${slot.end_time.slice(0, 5)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.badge}`}>
                          {sc.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="border-t bg-gray-50 px-6 py-4 flex items-center gap-3">
          <Button
            variant="cancel"
            className="h-10 px-5 text-sm font-medium"
            onClick={onClose}
          >
            Cancel
          </Button>
          <button type="button" onClick={resetPanelWidths}
            className="text-[10px] text-gray-400 hover:text-primary font-medium transition-colors">
            ⊟ Reset layout
          </button>
          {onOpenFullBooking && (
            <Button
              type="button"
              variant="outline"
              className="h-10 px-4 text-xs font-semibold border-primary/30 text-primary hover:bg-accent gap-1.5"
              onClick={handleOpenFullBooking}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Full Booking Details
            </Button>
          )}
          <div className="flex-1" />
          {selectedDuration > 0 && !durationError && (
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">Selected Duration</p>
              <p className="text-sm font-bold text-gray-700">{formatDuration(selectedDuration)}</p>
            </div>
          )}
          <Button
            className={`h-10 px-6 text-sm font-semibold gap-2 min-w-[160px] ${
              hasConflict
                ? 'bg-rose-600 hover:bg-rose-700'
                : exceedsMax
                ? 'bg-amber-500 hover:bg-amber-600'
                : 'bg-primary hover:bg-primary/90'
            }`}
            disabled={!canConfirm}
            onClick={handleApply}
          >
            <CheckCircle className="w-4 h-4" />
            {exceedsMax ? 'Review & Confirm' : hasConflict ? 'Book Anyway' : 'Confirm Slot'}
          </Button>
        </div>
      </div>

      {/* ── Over-duration confirmation popup ── */}
      {showConfirm && overriddenPrice !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Slot Duration Exceeded</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Standard slot is <strong>{formatDuration(maxDuration)}</strong>.
                  You selected <strong>{formatDuration(selectedDuration)}</strong>.
                  Price will be adjusted proportionally.
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-amber-200 space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Base rate ({formatDuration(maxDuration)})</span>
                  <span className="font-medium">{formatCurrency(servicePrice)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Rate per minute</span>
                  <span className="font-medium">{formatCurrency(servicePrice / maxDuration)}/min</span>
                </div>
              </div>
              <div className="flex justify-between px-4 py-3 text-sm font-bold text-gray-900">
                <span>Total for {formatDuration(selectedDuration)}</span>
                <span className="text-amber-700 text-base">{formatCurrency(overriddenPrice)}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-10" onClick={() => setShowConfirm(false)}>
                Go Back
              </Button>
              <Button className="flex-1 h-10 bg-amber-500 hover:bg-amber-600 font-semibold" onClick={handleProceed}>
                Confirm & Update Price
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
