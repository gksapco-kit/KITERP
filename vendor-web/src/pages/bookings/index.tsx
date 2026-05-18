import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiClient } from '@/api/client'
import { vendorApi } from '@/api/vendor'
import type { Customer } from '@/types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDate, formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { TableToolbar } from '@/components/table/TableToolbar'
import { processRows, type SortDir } from '@/lib/tableList'
import { useUpdateBookingStatus } from '@/hooks/useVendor'
import { usePanelResize } from '@/hooks/usePanelResize'
import { DragHandle } from '@/components/common/DragHandle'
import { QuickCreateCustomerModal } from '@/components/customers/QuickCreateCustomerModal'
import { ResizableTable } from '@/components/table/ResizableTable'
import {
  Loader2, CalendarDays, ChevronLeft, ChevronRight,
  Plus, X, Search, User, Check, Play, Ban, UserX, CheckCircle,
  Clock, Zap, CalendarCheck2, Users, AlertTriangle, Hourglass,
  ExternalLink, CalendarClock, RotateCcw, Grid3X3, Building2,
} from 'lucide-react'
import { extractApiError } from '@/lib/errorMessages'

// ── Slot-picker helpers (mirrors POSBookingPanel logic) ──────────────────────
function timeToMins(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m }
function minsToTime(mins: number) { const h = Math.floor(mins / 60) % 24; const m = mins % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` }
function fmtDur(mins: number) { if (mins < 60) return `${mins} min`; const h = Math.floor(mins / 60); const m = mins % 60; return m === 0 ? `${h} hr` : `${h} hr ${m} min` }
function fmtTime12(t: string) { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}` }
const SLOT_START = 8 * 60; const SLOT_END = 22 * 60; const SLOT_SPAN = SLOT_END - SLOT_START
function slotPct(t: string) { return Math.min(100, Math.max(0, ((timeToMins(t) - SLOT_START) / SLOT_SPAN) * 100)) }
const SLOT_STATUS_DOT: Record<string, string> = {
  pending: 'bg-amber-400', confirmed: 'bg-blue-400', in_progress: 'bg-primary/70',
  completed: 'bg-green-400', cancelled: 'bg-gray-300', no_show: 'bg-gray-300',
}

const statusBadge: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pending' },
  confirmed: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Confirmed' },
  in_progress: { bg: 'bg-accent', text: 'text-primary', label: 'In Progress' },
  completed: { bg: 'bg-green-50', text: 'text-green-700', label: 'Completed' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-700', label: 'Cancelled' },
  no_show: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'No Show' },
}

// ── Compact horizontal booking card ─────────────────────────────────────────
interface SlotActionCardProps {
  slot: Record<string, unknown>
  overdue?: boolean
  dimmed?: boolean
  onConfirm: () => void
  onStart: () => void
  onComplete: () => void
  onNoShow: () => void
  onCancel: () => void
  onReschedule: () => void
  onView: () => void
  isPending: boolean
}

function SlotActionCard({ slot: s, overdue, dimmed, onConfirm, onStart, onComplete, onNoShow, onCancel, onReschedule, onView, isPending }: SlotActionCardProps) {
  const initials = (s.customer_name as string || 'G').trim().split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  const status = s.status as string
  const canAct = !dimmed && !['completed', 'cancelled', 'no_show'].includes(status)

  const rowBg = overdue
    ? 'border-orange-200 bg-orange-50'
    : dimmed
      ? 'border-gray-100 bg-gray-50/50 opacity-60'
      : 'border-gray-100 bg-white hover:bg-accent/60'

  const avatarCls = overdue ? 'bg-orange-400' : dimmed ? 'bg-gray-300' : 'bg-gradient-to-br from-primary to-emerald-700'
  const statusDotColor = SLOT_STATUS_DOT[status] || 'bg-gray-300'

  return (
    <div className={`rounded-lg border ${rowBg} transition-colors`}>
      {/* ── Single compact row ── */}
      <div className="flex items-center gap-2 px-2.5 py-2">
        {/* Avatar */}
        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${avatarCls}`}>
          <span className="text-[9px] font-bold text-white">{initials}</span>
        </div>

        {/* Name + slot details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] font-bold text-gray-900 truncate leading-tight">
              {(s.customer_name as string) || 'Guest'}
            </p>
            {overdue && <span className="text-[9px] px-1 py-0 rounded bg-orange-100 text-orange-600 font-bold shrink-0">OD</span>}
            {dimmed && <span className="text-[9px] px-1 py-0 rounded bg-gray-100 text-gray-400 font-bold shrink-0">OS</span>}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[9px] text-gray-400 flex items-center gap-0.5 shrink-0">
              <Clock className="w-2 h-2" />
              {overdue && s.booking_date ? `${s.booking_date} · ` : ''}
              {(s.start_time as string)?.slice(0, 5)}{s.end_time ? `–${(s.end_time as string).slice(0, 5)}` : ''}
            </span>
            {!!s.service_name && (
              <span className="text-[9px] text-primary/80 font-medium truncate max-w-[90px]">
                {s.service_name as string}
              </span>
            )}
            {!!s.assigned_staff_name && (
              <span className="text-[9px] text-gray-300 truncate max-w-[70px]">· {s.assigned_staff_name as string}</span>
            )}
          </div>
        </div>

        {/* Right side: status + view + actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Status pill */}
          <span className={`flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
            status === 'pending'     ? 'bg-amber-100 text-amber-700' :
            status === 'confirmed'   ? 'bg-blue-100 text-blue-700' :
            status === 'in_progress' ? 'bg-primary/12 text-primary' :
            status === 'completed'   ? 'bg-emerald-100 text-emerald-700' :
            'bg-gray-100 text-gray-500'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor} shrink-0`} />
            {status === 'in_progress' ? 'Active' : status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
          </span>

          {/* View button */}
          <button onClick={onView} title="View booking"
            className="p-1 rounded-md hover:bg-primary/15 text-primary/70 hover:text-primary transition-colors">
            <ExternalLink className="w-3 h-3" />
          </button>

          {/* Primary action */}
          {canAct && status === 'pending' && (
            <button onClick={onConfirm} disabled={isPending} title="Confirm"
              className="flex items-center gap-0.5 px-2 py-1 rounded-md text-[9px] font-bold bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors">
              <Check className="w-2.5 h-2.5" /> OK
            </button>
          )}
          {canAct && status === 'confirmed' && (
            <button onClick={onStart} disabled={isPending} title="Start"
              className="flex items-center gap-0.5 px-2 py-1 rounded-md text-[9px] font-bold bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors">
              <Play className="w-2.5 h-2.5" /> Go
            </button>
          )}
          {canAct && status === 'in_progress' && (
            <button onClick={onComplete} disabled={isPending} title="Complete"
              className="flex items-center gap-0.5 px-2 py-1 rounded-md text-[9px] font-bold bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors">
              <CheckCircle className="w-2.5 h-2.5" /> Done
            </button>
          )}

          {/* Secondary icon actions */}
          {canAct && (status === 'confirmed' || status === 'in_progress') && (
            <button onClick={onNoShow} disabled={isPending} title="No Show"
              className="p-1 rounded-md hover:bg-gray-200 text-gray-400 hover:text-gray-700 disabled:opacity-50 transition-colors">
              <UserX className="w-3 h-3" />
            </button>
          )}
          {canAct && (
            <button onClick={onReschedule} disabled={isPending} title="Reschedule"
              className="p-1 rounded-md hover:bg-blue-100 text-blue-400 hover:text-blue-600 disabled:opacity-50 transition-colors">
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
          {canAct && (
            <button onClick={onCancel} disabled={isPending} title="Cancel"
              className="p-1 rounded-md hover:bg-red-100 text-red-400 hover:text-red-600 disabled:opacity-50 transition-colors">
              <Ban className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Slot Picker Popup ────────────────────────────────────────────────────────
// Shows a visual 30-min grid for a date. Green = available, Rose = conflict
// (same staff or no staff selected), Amber = other-staff booking (no conflict).
interface SlotPickerProps {
  date: string
  slots: Record<string, unknown>[]     // all bookings for this date
  staffId: string                       // '' = no staff filter
  duration: number                      // service duration in minutes (0 = manual)
  selectedStart: string
  selectedEnd: string
  onPick: (start: string, end: string) => void
  onClose: () => void
}

const GRID_START = 7 * 60   // 7:00 AM
const GRID_END   = 22 * 60  // 10:00 PM
const SLOT_STEP  = 30       // minutes per grid cell

function SlotPickerPopup({ date, slots, staffId, duration, selectedStart, selectedEnd, onPick, onClose }: SlotPickerProps) {
  // Active (non-cancelled) slots split by staff relevance
  const activeSlots = slots.filter((s: any) =>
    !['cancelled', 'no_show'].includes(s.status) && s.start_time && s.end_time,
  )
  const sameStaffSlots = activeSlots.filter((s: any) =>
    !staffId || (s.staff_id === staffId || s.assigned_staff_id === staffId),
  )

  const isConflict = (slotStart: number, slotEnd: number, relevant: typeof activeSlots) =>
    relevant.some((s: any) => {
      const sf = timeToMins((s.start_time as string).slice(0, 5))
      const st = timeToMins((s.end_time as string).slice(0, 5))
      return slotStart < st && slotEnd > sf
    })

  const isOtherStaffOnly = (slotStart: number, slotEnd: number) =>
    !isConflict(slotStart, slotEnd, sameStaffSlots) &&
    isConflict(slotStart, slotEnd, activeSlots)

  const selStart = selectedStart ? timeToMins(selectedStart) : -1
  const selEnd   = selectedEnd   ? timeToMins(selectedEnd)   : -1

  const cells: { label: string; mins: number; state: 'available' | 'conflict' | 'other' | 'selected' | 'past' }[] = []
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes()
  const isToday  = date === new Date().toISOString().split('T')[0]

  for (let m = GRID_START; m < GRID_END; m += SLOT_STEP) {
    const slotEnd = m + (duration || SLOT_STEP)
    const isPast   = isToday && m < nowMins
    const conflict = isConflict(m, slotEnd, sameStaffSlots)
    const otherOnly = !conflict && isOtherStaffOnly(m, slotEnd)
    const selected  = selStart >= 0 && m >= selStart && m < selEnd

    cells.push({
      label: minsToTime(m),
      mins: m,
      state: isPast ? 'past' : selected ? 'selected' : conflict ? 'conflict' : otherOnly ? 'other' : 'available',
    })
  }

  const stateStyle: Record<string, string> = {
    available: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 cursor-pointer',
    conflict:  'bg-rose-100 border-rose-300 text-rose-500 cursor-not-allowed opacity-70',
    other:     'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100 cursor-pointer',
    selected:  'bg-primary border-primary text-white cursor-pointer',
    past:      'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed',
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-emerald-700 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-sm">Select Time Slot</p>
            <p className="text-primary-foreground/85 text-[11px]">
              {date} {staffId ? '· Filtered by staff' : '· All staff'}{duration > 0 ? ` · ${fmtDur(duration)} slots` : ''}
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/25 transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-4 py-2 border-b bg-gray-50">
          {[
            { color: 'bg-emerald-400', label: 'Available' },
            { color: 'bg-primary', label: 'Selected' },
            { color: 'bg-rose-400', label: 'Conflict' },
            { color: 'bg-amber-400', label: 'Other staff' },
            { color: 'bg-gray-200', label: 'Past / N/A' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1">
              <div className={`w-2.5 h-2.5 rounded-sm ${l.color}`} />
              <span className="text-[10px] text-gray-500">{l.label}</span>
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="p-4 grid grid-cols-6 gap-1.5 max-h-72 overflow-y-auto">
          {cells.map(cell => (
            <button
              key={cell.mins}
              disabled={cell.state === 'conflict' || cell.state === 'past'}
              onClick={() => {
                if (cell.state === 'conflict' || cell.state === 'past') return
                const end = duration > 0
                  ? minsToTime(Math.min(cell.mins + duration, 23 * 60 + 59))
                  : minsToTime(Math.min(cell.mins + 60, 23 * 60 + 59))
                onPick(cell.label, end)
                onClose()
              }}
              className={`rounded-lg border text-[11px] font-semibold py-1.5 px-1 text-center transition-all ${stateStyle[cell.state]}`}
            >
              {cell.label}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t bg-gray-50 flex items-center justify-between">
          <p className="text-[10px] text-gray-400">
            {cells.filter(c => c.state === 'available').length} slots available
          </p>
          <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700 font-medium">Close</button>
        </div>
      </div>
    </div>
  )
}

export default function BookingsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [sortKey, setSortKey] = useState('booking_date')

  // Resizable modal columns — persisted to localStorage
  const { widths: modalWidths, startResize: startModalResize, resetWidths: resetModalWidths } = usePanelResize(
    'booking-modal-cols',
    [260, 240],
    { min: [160, 160], max: [440, 380] },
  )
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Cancel modal state
  const [cancelTarget, setCancelTarget] = useState<{ id: string; number: string } | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  const updateStatus = useUpdateBookingStatus()

  // Quick-create customer modal state
  const [showQuickCreate, setShowQuickCreate] = useState(false)

  // Reschedule mini-form state (inside the modal right panel)
  const [rescheduleTarget, setRescheduleTarget] = useState<{ id: string; number: string } | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [rescheduling, setRescheduling] = useState(false)

  const handleRescheduleConfirm = async () => {
    if (!rescheduleTarget || !rescheduleDate) return
    setRescheduling(true)
    try {
      await vendorApi.updateBooking(rescheduleTarget.id, {
        booking_date: rescheduleDate,
        start_time: rescheduleTime || undefined,
      })
      toast.success('Booking rescheduled')
      qc.invalidateQueries({ queryKey: ['bookings'] })
      qc.invalidateQueries({ queryKey: ['overdue-bookings'] })
      setRescheduleTarget(null)
      setRescheduleDate(''); setRescheduleTime('')
      // Reload date slots if the rescheduled booking was for the currently viewed date
      if (bookingDate) {
        vendorApi.listBookings({ booking_date: bookingDate, size: 100 })
          .then((res: any) => setDateSlots((res?.items || []).filter((b: any) => b.start_time)))
          .catch(() => {})
      }
    } catch (err) {
      toast.error(extractApiError(err, 'Could not reschedule booking'))
    } finally {
      setRescheduling(false)
    }
  }

  const params: Record<string, unknown> = { page, size: 20 }
  if (statusFilter) params.status = statusFilter

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', params],
    queryFn: async () => {
      const res = await apiClient.get('/vendors/me/bookings', { params })
      return res.data as { items: Record<string, unknown>[]; total: number; pages: number }
    },
  })

  // Services list for dropdown
  const { data: servicesData } = useQuery({
    queryKey: ['services-for-booking'],
    queryFn: async () => {
      const res = await apiClient.get('/vendors/me/services', { params: { size: 100 } })
      return res.data?.items || []
    },
  })
  const services = (servicesData || []) as Record<string, unknown>[]

  // Overdue bookings (past-date pending/confirmed that need attention)
  const { data: overdueData, refetch: refetchOverdue } = useQuery({
    queryKey: ['overdue-bookings'],
    queryFn: async () => {
      const [pending, confirmed] = await Promise.all([
        apiClient.get('/vendors/me/bookings', { params: { status: 'pending', size: 50 } }),
        apiClient.get('/vendors/me/bookings', { params: { status: 'confirmed', size: 50 } }),
      ])
      const all = [
        ...(pending.data?.items || []),
        ...(confirmed.data?.items || []),
      ] as Record<string, unknown>[]
      // Only keep bookings whose date is before today
      return all.filter(b => b.booking_date && (b.booking_date as string) < today)
        .sort((a, b) => (a.booking_date as string).localeCompare(b.booking_date as string))
    },
    staleTime: 60_000,
  })
  const overdueBookings = overdueData || []

  // Team members + stores for the booking form
  const { data: teamData } = useQuery({
    queryKey: ['team-for-booking'],
    queryFn: () => vendorApi.listTeamMembers({ size: 100 }),
    staleTime: 5 * 60_000,
  })
  const teamMembers = (teamData?.items || []) as unknown as Record<string, unknown>[]

  // External providers: contractors, partners, employees from supplier/party master
  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-for-booking'],
    queryFn: () => vendorApi.listSuppliers({ size: 200 }),
    staleTime: 5 * 60_000,
  })
  const externalProviders = ((suppliersData?.items || []) as unknown as Record<string, unknown>[])
    .filter(s => ['contractor', 'partner', 'employee', 'supplier'].includes(s.party_type as string))

  // Unified service provider list across all master data sources
  const PARTY_TYPE_LABEL: Record<string, string> = {
    contractor: 'Contractor', partner: 'Partner',
    employee: 'External Employee', supplier: 'Supplier / Vendor',
  }
  interface ServiceProvider { id: string; name: string; category: string; subCategory: string; isExternal: boolean }
  const serviceProviders: ServiceProvider[] = [
    ...teamMembers.map(m => ({
      id: `team:${m.id}`,
      name: (m.user as any)?.full_name || (m as any).full_name || 'Unknown',
      category: 'Internal Staff',
      subCategory: (m as any).role_name || 'Staff',
      isExternal: false,
    })),
    ...externalProviders.map(s => ({
      id: `ext:${s.id}`,
      name: (s.name as string) || (s.contact_name as string) || 'Unknown',
      category: PARTY_TYPE_LABEL[s.party_type as string] || 'External',
      subCategory: (s.party_type as string),
      isExternal: true,
    })),
  ]

  // Helper: resolve a serviceProvider id back to its real parts
  const resolveProvider = (pid: string): { staffId?: string; extId?: string; name: string } => {
    const sp = serviceProviders.find(p => p.id === pid)
    if (!sp) return { name: '' }
    if (pid.startsWith('team:')) return { staffId: pid.replace('team:', ''), name: sp.name }
    return { extId: pid.replace('ext:', ''), name: sp.name }
  }

  const { data: storesData } = useQuery({
    queryKey: ['stores-for-booking'],
    queryFn: async () => {
      const r = await apiClient.get('/vendors/me/stores', { params: { size: 50 } })
      return r.data?.items || []
    },
    staleTime: 5 * 60_000,
  })
  const stores = (storesData || []) as Record<string, unknown>[]

  // Create form state
  const [selectedService, setSelectedService] = useState('')
  const [selectedStaff, setSelectedStaff] = useState('')
  const [selectedStore, setSelectedStore] = useState('')
  const [bookingDate, setBookingDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cod')
  const [creating, setCreating] = useState(false)
  const [showSlotPicker, setShowSlotPicker] = useState(false)

  // Slot availability for Create modal
  const [dateSlots, setDateSlots] = useState<Record<string, unknown>[]>([])
  const [dateSlotsLoading, setDateSlotsLoading] = useState(false)

  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

  /** Round current time up to the next 30-min boundary, capped at 22:30. */
  const getNextSlotTime = useCallback((): string => {
    const now = new Date()
    const mins = now.getHours() * 60 + now.getMinutes()
    const next = Math.ceil((mins + 1) / 30) * 30
    const capped = Math.min(next, 22 * 60 + 30)
    return minsToTime(capped)
  }, [])
  const selectedSvc = useMemo(() => services.find(s => s.id === selectedService), [services, selectedService])
  const svcDuration = (selectedSvc?.duration_minutes as number | undefined) ?? 0

  // Auto-fill end time when start time or service changes
  const handleStartTimeChange = (val: string) => {
    setStartTime(val)
    if (svcDuration > 0 && val) {
      setEndTime(minsToTime(Math.min(timeToMins(val) + svcDuration, 23 * 60 + 59)))
    }
  }

  const applyStandardDuration = () => {
    if (!startTime || svcDuration <= 0) return
    setEndTime(minsToTime(Math.min(timeToMins(startTime) + svcDuration, 23 * 60 + 59)))
  }

  // Load existing slots for selected date
  useEffect(() => {
    if (!bookingDate) return
    setDateSlotsLoading(true)
    setDateSlots([])
    vendorApi.listBookings({ booking_date: bookingDate, size: 100 })
      .then((res: any) => setDateSlots((res?.items || []).filter((b: any) => b.start_time)))
      .catch(() => {})
      .finally(() => setDateSlotsLoading(false))
  }, [bookingDate])

  // Duration + conflict
  const selectedDuration = useMemo(() => {
    if (!startTime || !endTime) return 0
    const d = timeToMins(endTime) - timeToMins(startTime)
    return d > 0 ? d : 0
  }, [startTime, endTime])

  const hasConflict = useMemo(() => {
    if (!startTime || !endTime || selectedDuration === 0) return false
    const sf = timeToMins(startTime); const st = timeToMins(endTime)
    // Only conflict with same staff (if one is selected) to avoid false positives
    // when multiple staff work simultaneously
    const relevantSlots = dateSlots.filter((s: any) => {
      if (!s.start_time || !s.end_time) return false
      if (['cancelled', 'no_show'].includes(s.status as string)) return false
      if (selectedStaff) {
        const { staffId } = resolveProvider(selectedStaff)
        if (staffId) return (s.staff_id === staffId || s.assigned_staff_id === staffId)
        // External provider — no staff_id on bookings, skip conflict check
        return false
      }
      return true // no staff selected → conservative: flag all overlaps
    })
    return relevantSlots.some((s: any) => {
      const ef = timeToMins((s.start_time as string).slice(0, 5))
      const et = timeToMins((s.end_time as string).slice(0, 5))
      return sf < et && st > ef
    })
  }, [startTime, endTime, selectedDuration, dateSlots, selectedStaff])

  // All non-cancelled slots for the selected date (used for timeline + slot picker)
  const activeSlots = useMemo(
    () => (dateSlots as any[]).filter(s => !['cancelled', 'no_show'].includes(s.status) && s.start_time),
    [dateSlots],
  )

  // Customer search state — declared before filteredSlots to avoid TDZ
  const [custSearch, setCustSearch] = useState('')
  const [custResults, setCustResults] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showCustDropdown, setShowCustDropdown] = useState(false)
  const [showAllSlots, setShowAllSlots] = useState(false)

  // Filtered view: show only slots matching the current customer/service/staff selection,
  // unless "View All" is toggled on.
  const filteredSlots = useMemo(() => {
    if (showAllSlots) return activeSlots
    const hasFilter = selectedCustomer || selectedService || selectedStaff
    if (!hasFilter) return activeSlots
    return activeSlots.filter((s: any) => {
      if (selectedCustomer && s.customer_id !== selectedCustomer.id) return false
      if (selectedService && s.service_id !== selectedService) return false
      if (selectedStaff) {
        const { staffId } = resolveProvider(selectedStaff)
        if (staffId && s.staff_id !== staffId && s.assigned_staff_id !== staffId) return false
      }
      return true
    })
  }, [activeSlots, showAllSlots, selectedCustomer, selectedService, selectedStaff])

  const searchCustomers = useCallback(async (q: string) => {
    if (q.length < 2) { setCustResults([]); return }
    try {
      const res = await vendorApi.listCustomers({ search: q, size: 5 })
      setCustResults(res.items || [])
      setShowCustDropdown(true)
    } catch { setCustResults([]) }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => searchCustomers(custSearch), 300)
    return () => clearTimeout(t)
  }, [custSearch, searchCustomers])

  const resetCreateForm = () => {
    setSelectedService(''); setSelectedStaff(''); setSelectedStore('')
    setBookingDate(''); setStartTime(''); setEndTime('')
    setNotes(''); setSelectedCustomer(null); setCustSearch(''); setDateSlots([])
    setShowQuickCreate(false); setShowSlotPicker(false); setShowAllSlots(false)
  }

  const handleCreate = async () => {
    if (!selectedService || !bookingDate || !selectedCustomer) {
      toast.error('Please select a service, date, and customer')
      return
    }
    setCreating(true)
    try {
      await vendorApi.createBooking({
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
        ...(() => {
          if (!selectedStaff) return {}
          const { staffId, name } = resolveProvider(selectedStaff)
          return staffId
            ? { staff_id: staffId, assigned_staff_name: name }
            : { assigned_staff_name: name }
        })(),
        ...(selectedStore ? { store_id: selectedStore } : {}),
      })
      toast.success('Booking created successfully')
      qc.invalidateQueries({ queryKey: ['bookings'] })
      setShowCreate(false)
      resetCreateForm()
    } catch (err: unknown) {
      toast.error(extractApiError(err, 'Could not create booking — verify the service, date, and customer are selected'))
    } finally {
      setCreating(false)
    }
  }

  const total = data?.total || 0
  const pages = data?.pages || 0

  type BRow = Record<string, unknown>
  const displayBookings = useMemo(() => {
    if (!data?.items?.length) return []
    return processRows(
      data.items as BRow[],
      '',
      () => [],
      sortKey,
      sortDir,
      {
        booking_number: (b) => b.booking_number || '',
        service_name: (b) => b.service_name || '',
        customer_name: (b) => b.customer_name || '',
        booking_date: (b) => b.booking_date || '',
        status: (b) => b.status || '',
        total: (b) => Number(b.total ?? b.service_price ?? 0),
        created_at: (b) => b.created_at || '',
      },
    )
  }, [data?.items, sortKey, sortDir])
  const statuses = ['', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled']

  const handleStatusChange = (id: string, status: string) => {
    updateStatus.mutate({ id, data: { status } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['bookings'] })
        qc.invalidateQueries({ queryKey: ['overdue-bookings'] })
        if (bookingDate) {
          vendorApi.listBookings({ booking_date: bookingDate, size: 100 })
            .then((res: any) => setDateSlots((res?.items || []).filter((b: any) => b.start_time)))
            .catch(() => {})
        }
      },
    })
  }

  const handleCancelConfirm = () => {
    if (!cancelTarget) return
    updateStatus.mutate(
      { id: cancelTarget.id, data: { status: 'cancelled', cancel_reason: cancelReason || undefined } },
      {
        onSuccess: () => {
          setCancelTarget(null); setCancelReason('')
          qc.invalidateQueries({ queryKey: ['bookings'] })
          qc.invalidateQueries({ queryKey: ['overdue-bookings'] })
          if (bookingDate) {
            vendorApi.listBookings({ booking_date: bookingDate, size: 100 })
              .then((res: any) => setDateSlots((res?.items || []).filter((b: any) => b.start_time)))
              .catch(() => {})
          }
        },
      },
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        <Button onClick={() => {
          const slot = getNextSlotTime()
          setBookingDate(today)
          setStartTime(slot)
          setEndTime('')
          setShowCreate(true)
        }} className="gap-1">
          <Plus className="w-4 h-4" /> New Booking
        </Button>
      </div>

      {/* ── Create Booking Modal ─────────────────────────────────────────────── */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4"
          onClick={() => { setShowCreate(false); resetCreateForm() }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="bg-gradient-to-r from-primary via-primary/90 to-emerald-800 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <CalendarCheck2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white leading-tight">New Booking</h2>
                  <p className="text-primary-foreground/85 text-[11px]">Fill in the details and pick a time slot</p>
                </div>
              </div>
              <button type="button" aria-label="Close"
                onClick={() => { setShowCreate(false); resetCreateForm() }}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/25 transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* ── Body — three columns (drag handles to resize) ── */}
            <div className="flex-1 overflow-hidden flex min-h-0">

              {/* COL 1 — Who & What (narrow) */}
              <div className="shrink-0 flex flex-col overflow-y-auto bg-gray-50/60"
                style={{ width: modalWidths[0], minWidth: 160 }}>
                <div className="px-5 pt-5 pb-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80 mb-4">Who &amp; What</p>

                  {/* Customer */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Customer *</label>
                      {!selectedCustomer && (
                        <button
                          type="button"
                          onClick={() => { setShowQuickCreate(true); setCustSearch(''); setShowCustDropdown(false) }}
                          className="flex items-center gap-0.5 text-[10px] text-primary hover:text-primary font-semibold transition-colors"
                        >
                          <Plus className="w-3 h-3" /> New
                        </button>
                      )}
                    </div>

                    {selectedCustomer ? (
                      <div className="flex items-center gap-2 p-2.5 bg-accent border border-primary/30 rounded-xl">
                        <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shrink-0">
                          {selectedCustomer.full_name[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{selectedCustomer.full_name}</p>
                          <p className="text-[10px] text-gray-500 truncate">{selectedCustomer.phone || selectedCustomer.email}</p>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <a href={`/customers/${selectedCustomer.id}`} target="_blank" rel="noopener noreferrer"
                            className="p-1 rounded hover:bg-primary/15 transition-colors" title="Open customer" onClick={e => e.stopPropagation()}>
                            <ExternalLink className="w-3 h-3 text-primary/80" />
                          </a>
                          <button type="button" aria-label="Close" onClick={() => { setSelectedCustomer(null); setCustSearch('') }}
                            className="p-1 rounded hover:bg-primary/15 transition-colors" title="Remove">
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
                          className="w-full h-9 pl-8 pr-3 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                        />
                        {showCustDropdown && custResults.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border rounded-xl shadow-xl max-h-48 overflow-y-auto">
                            {custResults.map(c => (
                              <button key={c.id}
                                className="w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-2 border-b border-gray-50 last:border-0"
                                onClick={() => { setSelectedCustomer(c); setShowCustDropdown(false); setCustSearch('') }}>
                                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                  <span className="text-[10px] font-bold text-primary">{c.full_name[0].toUpperCase()}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-gray-900 truncate">{c.full_name}</p>
                                  <p className="text-[10px] text-gray-400 truncate">{c.phone || c.email}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Service */}
                  <div className="mb-4">
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Service *</label>
                    <select
                      className="w-full h-9 px-3 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                      value={selectedService}
                      onChange={e => {
                        const svcId = e.target.value
                        setSelectedService(svcId)
                        setEndTime('')
                        if (startTime && svcId) {
                          const svc = services.find(s => s.id === svcId)
                          const dur = (svc?.duration_minutes as number | undefined) ?? 0
                          if (dur > 0) setEndTime(minsToTime(Math.min(timeToMins(startTime) + dur, 23 * 60 + 59)))
                        }
                      }}
                    >
                      <option value="">Select a service…</option>
                      {services.map(s => (
                        <option key={s.id as string} value={s.id as string}>
                          {s.name as string}{s.duration_minutes ? ` (${s.duration_minutes}m)` : ''}
                        </option>
                      ))}
                    </select>
                    {selectedSvc && (
                      <div className="flex items-center justify-between mt-1.5">
                        {svcDuration > 0 && (
                          <span className="text-[10px] text-primary flex items-center gap-1">
                            <Hourglass className="w-2.5 h-2.5" /> {fmtDur(svcDuration)}
                          </span>
                        )}
                        {(selectedSvc.price as number) > 0 && (
                          <span className="text-[10px] font-semibold text-gray-600">{formatCurrency(selectedSvc.price as number)}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Service Provider */}
                  {serviceProviders.length > 0 && (
                    <div className="mb-4">
                      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                        <Users className="w-3 h-3 inline mr-1 text-primary/70" />Service Provider (optional)
                      </label>
                      <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}
                        className="w-full h-9 px-3 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-ring">
                        <option value="">— Any available provider —</option>
                        {/* Group by category */}
                        {['Internal Staff', 'Contractor', 'Partner', 'External Employee', 'Supplier / Vendor'].map(cat => {
                          const members = serviceProviders.filter(p => p.category === cat)
                          if (!members.length) return null
                          return (
                            <optgroup key={cat} label={`── ${cat} ──`}>
                              {members.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name}{p.category === 'Internal Staff' ? ` (${p.subCategory})` : ''}
                                </option>
                              ))}
                            </optgroup>
                          )
                        })}
                      </select>
                      {selectedStaff && (() => {
                        const sp = serviceProviders.find(p => p.id === selectedStaff)
                        if (!sp) return null
                        return (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              sp.isExternal
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-accent text-primary border-primary/30'
                            }`}>
                              {sp.isExternal ? '🔗 ' : '👤 '}{sp.category}
                              {sp.category === 'Internal Staff' && ` · ${sp.subCategory}`}
                            </span>
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  {/* Store / Location */}
                  {stores.length > 1 && (
                    <div className="mb-4">
                      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                        <Building2 className="w-3 h-3 inline mr-1 text-primary/70" />Location
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
                  <div className="mb-4">
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Payment</label>
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
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Notes</label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-white resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      rows={3}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Any special instructions…"
                    />
                  </div>
                </div>
              </div>

              <DragHandle onMouseDown={e => startModalResize(0, e.clientX)} className="border-x border-gray-100 bg-gray-50/60" />

              {/* COL 2 — When (scheduling) */}
              <div className="shrink-0 flex flex-col overflow-y-auto bg-white"
                style={{ width: modalWidths[1], minWidth: 160 }}>
                <div className="px-5 pt-5 pb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80 mb-4">When</p>

                  {/* Date */}
                  <div className="mb-4">
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-1.5">
                      <CalendarDays className="w-3 h-3 text-primary/70" /> Date *
                    </label>
                    <input type="date" value={bookingDate} min={today}
                      onChange={e => setBookingDate(e.target.value)}
                      className="w-full h-9 px-3 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>

                  {/* Time Slot — Picker button + manual inputs */}
                  <div className="mb-3">
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-1.5">
                      <Clock className="w-3 h-3 text-primary/70" /> Time Slot
                    </label>

                    {/* Slot picker trigger */}
                    <button
                      type="button"
                      disabled={!bookingDate}
                      onClick={() => setShowSlotPicker(true)}
                      className={`w-full h-10 flex items-center justify-between px-3 rounded-xl border-2 font-semibold text-xs transition-all mb-2 ${
                        startTime
                          ? hasConflict
                            ? 'border-red-400 bg-red-50 text-red-700'
                            : 'border-primary/60 bg-accent text-primary'
                          : bookingDate
                            ? 'border-dashed border-gray-300 bg-gray-50 text-gray-500 hover:border-primary/60 hover:text-primary'
                            : 'border-dashed border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Grid3X3 className="w-3.5 h-3.5" />
                        {startTime
                          ? <span>{fmtTime12(startTime)}{endTime ? ` → ${fmtTime12(endTime)}` : ''}</span>
                          : <span>{bookingDate ? 'Pick a slot from grid…' : 'Select date first'}</span>
                        }
                      </div>
                      {startTime && <X className="w-3.5 h-3.5 opacity-60 hover:opacity-100"
                        onClick={e => { e.stopPropagation(); setStartTime(''); setEndTime('') }} />}
                    </button>

                    {/* Manual override inputs */}
                    <details className="group">
                      <summary className="text-[10px] text-gray-400 cursor-pointer select-none hover:text-primary font-medium list-none flex items-center gap-1">
                        <span className="group-open:hidden">▸</span><span className="hidden group-open:inline">▾</span>
                        Manual entry
                      </summary>
                      <div className="mt-2 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400 w-8 shrink-0">Start</span>
                          <input type="time" value={startTime} onChange={e => handleStartTimeChange(e.target.value)}
                            className="flex-1 h-8 px-2 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-ring" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400 w-8 shrink-0">End</span>
                          <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                            className="flex-1 h-8 px-2 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-ring" />
                        </div>
                        {svcDuration > 0 && startTime && (
                          <button type="button" onClick={applyStandardDuration}
                            className="flex items-center gap-1 text-[10px] text-primary hover:text-primary font-semibold transition-colors">
                            <Zap className="w-3 h-3" /> Auto-fill {fmtDur(svcDuration)}
                          </button>
                        )}
                      </div>
                    </details>
                  </div>

                  {/* Slot status badge */}
                  {selectedDuration > 0 && startTime && endTime && (
                    <div className={`rounded-xl border px-3 py-2.5 flex items-start gap-2.5 mb-3 ${
                      hasConflict ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'
                    }`}>
                      {hasConflict
                        ? <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        : <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />}
                      <div>
                        <p className={`text-[10px] font-bold uppercase tracking-wide ${hasConflict ? 'text-red-500' : 'text-emerald-600'}`}>
                          {hasConflict ? 'Time Conflict' : 'Slot Available'}
                        </p>
                        <p className={`text-xs font-semibold ${hasConflict ? 'text-red-700' : 'text-emerald-700'}`}>
                          {fmtTime12(startTime)} – {fmtTime12(endTime)}
                        </p>
                        <p className={`text-[10px] ${hasConflict ? 'text-red-400' : 'text-emerald-500'}`}>
                          {hasConflict ? 'Overlaps an existing booking' : fmtDur(selectedDuration)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Completion checklist */}
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-1.5">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">Ready?</p>
                    {[
                      { label: 'Customer selected', ok: !!selectedCustomer },
                      { label: 'Service selected', ok: !!selectedService },
                      { label: 'Date set', ok: !!bookingDate },
                      { label: 'Time slot set', ok: !!(startTime && endTime) },
                      { label: 'No conflicts', ok: !hasConflict },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-2">
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${item.ok ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                          {item.ok && <Check className="w-2 h-2 text-white" />}
                        </div>
                        <span className={`text-[10px] ${item.ok ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <DragHandle onMouseDown={e => startModalResize(1, e.clientX)} className="border-x border-gray-100 bg-white" />

              {/* COL 3 — Availability panel */}
              <div className="flex-1 min-w-0 flex flex-col overflow-y-auto bg-white">
                <div className="px-5 pt-5 pb-3 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80">Availability</p>
                      {(selectedStaff || selectedStore) && (
                        <p className="text-[9px] text-gray-400 mt-0.5">
                          {selectedStaff && `Provider: ${serviceProviders.find(p => p.id === selectedStaff)?.name || '—'}`}
                          {selectedStaff && selectedStore && ' · '}
                          {selectedStore && `Store: ${(stores.find((s: any) => s.id === selectedStore) as any)?.name}`}
                        </p>
                      )}
                    </div>
                    {bookingDate && (
                      dateSlotsLoading
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                        : <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setShowSlotPicker(true)}
                              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                              <Grid3X3 className="w-3 h-3" /> Pick Slot
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowAllSlots(v => !v)}
                              className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors ${
                                showAllSlots
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}>
                              <Users className="w-3 h-3" />
                              {showAllSlots ? 'All Bookings' : 'Filtered'}
                            </button>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              filteredSlots.length === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {filteredSlots.length}/{activeSlots.length}
                            </span>
                          </div>
                    )}
                  </div>

                  {!bookingDate ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
                      <CalendarDays className="w-12 h-12 mb-3 text-gray-200" />
                      <p className="text-sm font-medium text-gray-400">Pick a date first</p>
                      <p className="text-xs text-gray-300 mt-1">Availability for the selected date will appear here</p>
                    </div>
                  ) : (
                    <>
                      {/* Timeline */}
                      <div>
                        <div className="relative h-10 bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
                          {[8, 11, 14, 17, 20, 22].map(h => (
                            <div key={h} className="absolute top-0 bottom-0 w-px bg-gray-200/80"
                              style={{ left: `${((h * 60 - SLOT_START) / SLOT_SPAN) * 100}%` }} />
                          ))}
                          {startTime && endTime && selectedDuration > 0 && (() => {
                            const fp = slotPct(startTime); const tp = slotPct(endTime)
                            return (
                              <div className={`absolute top-1 bottom-1 rounded-lg border-2 ${hasConflict ? 'bg-red-400/30 border-red-500' : 'bg-primary/50/40 border-primary'}`}
                                style={{ left: `${fp}%`, width: `${Math.max(2, tp - fp)}%` }} />
                            )
                          })()}
                          {activeSlots.filter((s: any) => s.end_time).map((s: any) => {
                            const l = slotPct(s.start_time.slice(0, 5)); const r = slotPct(s.end_time.slice(0, 5))
                            const { staffId: selStaffId } = selectedStaff ? resolveProvider(selectedStaff) : { staffId: undefined }
                            const isOther = !!selStaffId && s.staff_id !== selStaffId && s.assigned_staff_id !== selStaffId
                            return (
                              <div key={s.id}
                                className={`absolute top-1.5 bottom-1.5 rounded opacity-70 ${isOther ? 'bg-amber-400' : 'bg-rose-500'}`}
                                style={{ left: `${l}%`, width: `${Math.max(2, r - l)}%` }}
                                title={`${s.customer_name || 'Booked'} · ${s.start_time?.slice(0,5)}–${s.end_time?.slice(0,5)}${isOther ? ' (other provider)' : ''}`} />
                            )
                          })}
                        </div>
                        <div className="flex justify-between mt-1 px-0.5">
                          {['8AM', '11AM', '2PM', '5PM', '8PM', '10PM'].map(l => (
                            <span key={l} className="text-[9px] text-gray-400">{l}</span>
                          ))}
                        </div>
                        <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                          <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-rose-500 opacity-70" /><span className="text-[9px] text-gray-400">Booked{selectedStaff ? ` (${serviceProviders.find(p=>p.id===selectedStaff)?.name||'same provider'})` : ''}</span></div>
                          {selectedStaff && <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-amber-400 opacity-70" /><span className="text-[9px] text-gray-400">Other provider</span></div>}
                          {selectedDuration > 0 && <div className="flex items-center gap-1.5"><div className={`w-3 h-2 rounded-sm border ${hasConflict ? 'bg-red-400/30 border-red-500' : 'bg-primary/50/40 border-primary'}`} /><span className="text-[9px] text-gray-400">Your slot</span></div>}
                        </div>
                      </div>

                      {/* Slot cards — filtered by customer/service/staff unless "All" is on */}
                      <div className="space-y-1 max-h-72 overflow-y-auto pr-0.5">
                        {dateSlotsLoading && <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>}
                        {!dateSlotsLoading && filteredSlots.length === 0 && (
                          <div className="flex flex-col items-center py-8 text-center">
                            {activeSlots.length > 0 && !showAllSlots ? (
                              <>
                                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                                  <Search className="w-4 h-4 text-primary/70" />
                                </div>
                                <p className="text-xs font-semibold text-gray-600">No matching bookings</p>
                                <p className="text-[11px] text-gray-400 mt-1">
                                  {activeSlots.length} booking{activeSlots.length > 1 ? 's' : ''} exist on this date
                                </p>
                                <button type="button" onClick={() => setShowAllSlots(true)}
                                  className="mt-2 text-[11px] text-primary font-semibold hover:underline">
                                  View all bookings →
                                </button>
                              </>
                            ) : (
                              <>
                                <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center mb-2">
                                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                                </div>
                                <p className="text-xs font-semibold text-gray-600">All clear!</p>
                                <p className="text-[11px] text-gray-400">No bookings on this date</p>
                              </>
                            )}
                          </div>
                        )}
                        {!dateSlotsLoading && filteredSlots.map((s: any) => {
                          const { staffId: _sid } = selectedStaff ? resolveProvider(selectedStaff) : { staffId: undefined }
                          const isOtherStaff = !!_sid && s.staff_id !== _sid && s.assigned_staff_id !== _sid
                          return (
                            <SlotActionCard key={s.id} slot={s} dimmed={isOtherStaff && showAllSlots}
                              onView={() => navigate(`/bookings/${s.id}`)}
                              onConfirm={() => handleStatusChange(s.id, 'confirmed')}
                              onStart={() => handleStatusChange(s.id, 'in_progress')}
                              onComplete={() => handleStatusChange(s.id, 'completed')}
                              onNoShow={() => handleStatusChange(s.id, 'no_show')}
                              onCancel={() => setCancelTarget({ id: s.id, number: s.booking_number || '' })}
                              onReschedule={() => { setRescheduleTarget({ id: s.id, number: s.booking_number || '' }); setRescheduleDate(s.booking_date || ''); setRescheduleTime(s.start_time?.slice(0,5) || '') }}
                              isPending={updateStatus.isPending}
                            />
                          )
                        })}
                      </div>
                    </>
                  )}

                  {/* Overdue section */}
                  {overdueBookings.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <CalendarClock className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500">
                          Past incomplete ({overdueBookings.length})
                        </p>
                      </div>
                      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                        {overdueBookings.map((s: any) => (
                          <SlotActionCard key={s.id} slot={s} overdue
                            onView={() => navigate(`/bookings/${s.id}`)}
                            onConfirm={() => handleStatusChange(s.id, 'confirmed')}
                            onStart={() => handleStatusChange(s.id, 'in_progress')}
                            onComplete={() => handleStatusChange(s.id, 'completed')}
                            onNoShow={() => handleStatusChange(s.id, 'no_show')}
                            onCancel={() => setCancelTarget({ id: s.id, number: s.booking_number || '' })}
                            onReschedule={() => { setRescheduleTarget({ id: s.id, number: s.booking_number || '' }); setRescheduleDate(s.booking_date || ''); setRescheduleTime(s.start_time?.slice(0,5) || '') }}
                            isPending={updateStatus.isPending}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="border-t bg-gray-50/80 px-6 py-3 flex items-center gap-3 shrink-0">
              {/* Summary pill */}
              <div className="flex items-center gap-3 flex-1">
                {selectedCustomer && (
                  <span className="flex items-center gap-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-full px-3 py-1">
                    <User className="w-3 h-3 text-primary/80" />
                    {selectedCustomer.full_name}
                  </span>
                )}
                {selectedSvc && (
                  <span className="flex items-center gap-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-full px-3 py-1">
                    <Hourglass className="w-3 h-3 text-primary/80" />
                    {selectedSvc.name as string}
                  </span>
                )}
                {bookingDate && startTime && (
                  <span className="flex items-center gap-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-full px-3 py-1">
                    <Clock className="w-3 h-3 text-primary/80" />
                    {bookingDate} · {fmtTime12(startTime)}
                  </span>
                )}
              </div>
              <button type="button" title="Reset column widths" onClick={resetModalWidths}
                className="text-[10px] text-gray-400 hover:text-primary font-medium transition-colors px-1">
                ⊟ Reset layout
              </button>
              <Button variant="cancel" className="h-9 px-4 text-sm" onClick={() => { setShowCreate(false); resetCreateForm() }}>Cancel</Button>
              <Button
                className="h-9 px-5 gap-2 bg-primary hover:bg-primary/90 font-semibold text-sm"
                onClick={handleCreate}
                disabled={creating || !selectedService || !bookingDate || !selectedCustomer}
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarCheck2 className="w-4 h-4" />}
                Create Booking
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs mx-4 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-blue-600" />
                Reschedule #{rescheduleTarget.number || '—'}
              </h3>
              <button type="button" aria-label="Close" onClick={() => { setRescheduleTarget(null); setRescheduleDate(''); setRescheduleTime('') }}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5 mb-1">
                  <CalendarDays className="w-3.5 h-3.5 text-primary/70" /> New Date *
                </label>
                <input type="date" min={today} value={rescheduleDate}
                  onChange={e => setRescheduleDate(e.target.value)}
                  className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5 mb-1">
                  <Clock className="w-3.5 h-3.5 text-primary/70" /> New Start Time
                </label>
                <input type="time" value={rescheduleTime}
                  onChange={e => setRescheduleTime(e.target.value)}
                  className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="cancel" className="flex-1 h-9 text-sm"
                onClick={() => { setRescheduleTarget(null); setRescheduleDate(''); setRescheduleTime('') }}>Cancel</Button>
              <Button
                className="flex-1 h-9 text-sm gap-1.5 bg-primary hover:bg-primary/90"
                disabled={!rescheduleDate || rescheduling}
                onClick={handleRescheduleConfirm}
              >
                {rescheduling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                Reschedule
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Reason Modal */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Card className="w-full max-w-md mx-4">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Cancel Booking #{cancelTarget.number}</h2>
                <Button variant="ghost" size="sm" onClick={() => { setCancelTarget(null); setCancelReason('') }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div>
                <Label className="text-sm font-medium">Reason (optional)</Label>
                <textarea
                  className="w-full px-3 py-2 border rounded-md text-sm mt-1"
                  rows={3}
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="Why is this booking being cancelled?"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setCancelTarget(null); setCancelReason('') }}>
                  Go Back
                </Button>
                <Button variant="destructive" onClick={handleCancelConfirm} disabled={updateStatus.isPending}>
                  {updateStatus.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Confirm Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex gap-2">
        {statuses.map((s) => {
          const badge = s ? statusBadge[s] : null
          return (
            <button
              key={s || 'all'}
              onClick={() => { setStatusFilter(s); setPage(1) }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {badge?.label || 'All'}
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : displayBookings.length === 0 ? (
        <div className="text-center py-16">
          <CalendarDays className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500">No bookings found.</p>
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <TableToolbar
                search=""
                onSearchChange={() => {}}
                hideSearch
                hint="Sorting applies to the current page."
                sortOptions={[
                  { value: 'booking_date', label: 'Booking date' },
                  { value: 'created_at', label: 'Created' },
                  { value: 'booking_number', label: 'Booking #' },
                  { value: 'service_name', label: 'Service' },
                  { value: 'customer_name', label: 'Customer' },
                  { value: 'status', label: 'Status' },
                  { value: 'total', label: 'Total' },
                ]}
                sortKey={sortKey}
                sortDir={sortDir}
                onSortKeyChange={setSortKey}
                onSortDirChange={setSortDir}
              />
              <ResizableTable tableId="bookings" defaultWidths={[120, 160, 150, 100, 100, 90, 110, 80]}>
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Booking #</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Service</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Customer</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Created</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {displayBookings.map((b) => {
                    const badge = statusBadge[b.status as string] || statusBadge.pending
                    return (
                      <tr key={b.id as string} className="hover:bg-gray-50 cursor-pointer"
                        onClick={(e) => { if ((e.target as HTMLElement).closest('button')) return; navigate(`/bookings/${b.id}`) }}>
                        <td className="px-6 py-4 text-sm font-medium text-blue-600">{(b.booking_number as string) || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{(b.service_name as string) || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{(b.customer_name as string) || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{b.booking_date ? formatDate(b.booking_date as string) : '-'}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-medium">{formatCurrency((b.total as number) || (b.service_price as number) || 0)}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{b.created_at ? formatDate(b.created_at as string) : '-'}</td>
                        <td className="px-4 py-3 text-right">
                          {(() => {
                            const bId = b.id as string
                            const bNum = (b.booking_number as string) || ''
                            const bDate = (b.booking_date as string) || ''
                            const bTime = (b.start_time as string)?.slice(0, 5) || ''
                            const isPend = updateStatus.isPending
                            const onReschedule = () => { setRescheduleTarget({ id: bId, number: bNum }); setRescheduleDate(bDate); setRescheduleTime(bTime) }
                            const onCancel = () => setCancelTarget({ id: bId, number: bNum })

                            if (b.status === 'pending') return (
                              <div className="flex gap-1.5 justify-end items-center">
                                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 font-semibold text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100" onClick={() => handleStatusChange(bId, 'confirmed')} disabled={isPend}>
                                  <Check className="w-3.5 h-3.5" /> Confirm
                                </Button>
                                <button title="Reschedule" disabled={isPend} onClick={onReschedule}
                                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-blue-200 text-blue-500 hover:bg-blue-50 disabled:opacity-40 transition-colors">
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                                <button title="Cancel" disabled={isPend} onClick={onCancel}
                                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors">
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )

                            if (b.status === 'confirmed') return (
                              <div className="flex gap-1.5 justify-end items-center">
                                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 font-semibold text-primary border-primary/40 bg-accent hover:bg-primary/12" onClick={() => handleStatusChange(bId, 'in_progress')} disabled={isPend}>
                                  <Play className="w-3.5 h-3.5" /> Start
                                </Button>
                                <button title="No Show" disabled={isPend} onClick={() => handleStatusChange(bId, 'no_show')}
                                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 transition-colors">
                                  <UserX className="w-3.5 h-3.5" />
                                </button>
                                <button title="Reschedule" disabled={isPend} onClick={onReschedule}
                                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-blue-200 text-blue-500 hover:bg-blue-50 disabled:opacity-40 transition-colors">
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                                <button title="Cancel" disabled={isPend} onClick={onCancel}
                                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors">
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )

                            if (b.status === 'in_progress') return (
                              <div className="flex gap-1.5 justify-end items-center">
                                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 font-semibold text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100" onClick={() => handleStatusChange(bId, 'completed')} disabled={isPend}>
                                  <CheckCircle className="w-3.5 h-3.5" /> Complete
                                </Button>
                                <button title="No Show" disabled={isPend} onClick={() => handleStatusChange(bId, 'no_show')}
                                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 transition-colors">
                                  <UserX className="w-3.5 h-3.5" />
                                </button>
                                <button title="Cancel" disabled={isPend} onClick={onCancel}
                                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors">
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )

                            return null
                          })()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </ResizableTable>
            </CardContent>
          </Card>
          {pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Page {page} of {pages} ({total} records)</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="w-4 h-4" /> Prev
                </Button>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                  Next <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Quick-create customer modal */}
      {showQuickCreate && (
        <QuickCreateCustomerModal
          onSelect={c => {
            setSelectedCustomer(c as Customer)
            setShowQuickCreate(false)
          }}
          onClose={() => setShowQuickCreate(false)}
          returnTo="?returnTo=bookings"
        />
      )}

      {/* Slot picker popup */}
      {showSlotPicker && bookingDate && (
        <SlotPickerPopup
          date={bookingDate}
          slots={dateSlots}
          staffId={selectedStaff}
          duration={svcDuration}
          selectedStart={startTime}
          selectedEnd={endTime}
          onPick={(s, e) => { handleStartTimeChange(s); setEndTime(e) }}
          onClose={() => setShowSlotPicker(false)}
        />
      )}
    </div>
  )
}
