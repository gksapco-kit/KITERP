import { useState, useMemo } from 'react'
import {
  Calendar, CheckCircle, XCircle, Clock, AlertCircle,
  ThumbsUp, ThumbsDown, Pencil, X, Save, ChevronDown,
  CalendarRange, Users, Loader2,
  Home, Building2, Wifi, MapPin, Timer,
} from 'lucide-react'
import {
  useHRAttendance, useHREmployees, useHRDepartments,
  useHRMarkAttendance, useHRUpdateAttendance, useHRMarkAttendanceRange,
} from '@/hooks/useVendor'
import type { AttendanceRecord } from '@/types'
import { cn, onModalBackdropClick } from '@/lib/utils'

// ── Config ───────────────────────────────────────────────────────────────────────
const STATUS_OPTS = ['present', 'absent', 'late', 'half_day', 'on_leave', 'holiday', 'week_off', 'time', 'total_hours']

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  present:     { label: 'Present',     color: 'text-green-700 bg-green-50 border-green-200 dark:text-green-300 dark:bg-green-500/15 dark:border-green-500/30', icon: CheckCircle },
  absent:      { label: 'Absent',      color: 'text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-500/15 dark:border-red-500/30', icon: XCircle },
  late:        { label: 'Late',        color: 'text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-500/15 dark:border-orange-500/30', icon: Clock },
  half_day:    { label: 'Half Day',    color: 'text-yellow-700 bg-yellow-50 border-yellow-200 dark:text-yellow-300 dark:bg-yellow-500/15 dark:border-yellow-500/30', icon: AlertCircle },
  on_leave:    { label: 'On Leave',    color: 'text-primary bg-primary/10 border-primary/30', icon: Calendar },
  holiday:     { label: 'Holiday',     color: 'text-primary bg-accent border-primary/30', icon: Calendar },
  week_off:    { label: 'Week Off',    color: 'text-muted-foreground bg-muted border-border', icon: Calendar },
  time:        { label: 'Time Entry',  color: 'text-indigo-700 bg-indigo-50 border-indigo-200 dark:text-indigo-300 dark:bg-indigo-500/15 dark:border-indigo-500/30', icon: Timer },
  total_hours: { label: 'Total Hours', color: 'text-teal-700 bg-teal-50 border-teal-200 dark:text-teal-300 dark:bg-teal-500/15 dark:border-teal-500/30', icon: Clock },
}

function calcHours(start: string, end: string): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  return Math.max(0, Math.round(mins / 60 * 100) / 100)
}

const APPROVAL_CONFIG: Record<string, { label: string; color: string }> = {
  pending:  { label: 'Pending',  color: 'text-amber-700 bg-amber-50 border border-amber-200 dark:text-amber-300 dark:bg-amber-500/15 dark:border-amber-500/30' },
  approved: { label: 'Approved', color: 'text-green-700 bg-green-50 border border-green-200 dark:text-green-300 dark:bg-green-500/15 dark:border-green-500/30' },
  rejected: { label: 'Rejected', color: 'text-red-700 bg-red-50 border border-red-200 dark:text-red-300 dark:bg-red-500/15 dark:border-red-500/30' },
}

// ── Badges ───────────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'text-muted-foreground bg-muted border-border', icon: Clock }
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${cfg.color}`}>
      <cfg.icon className="w-3 h-3" />{cfg.label}
    </span>
  )
}

function ApprovalBadge({ status }: { status?: string | null }) {
  const s   = status ?? 'pending'
  const cfg = APPROVAL_CONFIG[s] ?? APPROVAL_CONFIG.pending
  return <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
}

// ── Single Mark / Edit Modal ──────────────────────────────────────────────────────
interface MarkModalProps {
  employees: any[]
  record?: AttendanceRecord | null
  defaultDate?: string
  onClose: () => void
}

function AttendanceModal({ employees, record, defaultDate, onClose }: MarkModalProps) {
  const mark   = useHRMarkAttendance()
  const update = useHRUpdateAttendance()
  const isEdit = !!record

  const [form, setForm] = useState({
    employee_id:      record?.employee_id ?? '',
    date:             record?.date ?? (defaultDate ?? new Date().toISOString().slice(0, 10)),
    status:           record?.status ?? 'present',
    clock_in:         record?.clock_in  ? new Date(record.clock_in).toLocaleTimeString('en-GB',  { hour: '2-digit', minute: '2-digit' }) : '',
    clock_out:        record?.clock_out ? new Date(record.clock_out).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '',
    work_hours:       record?.work_hours       != null ? String(record.work_hours)       : '',
    overtime_hours:   record?.overtime_hours   != null ? String(record.overtime_hours)   : '',
    notes:            record?.notes            ?? '',
    approval_status:  record?.approval_status  ?? 'pending',
    rejection_reason: record?.rejection_reason ?? '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const buildDT = (d: string, t: string) => t ? `${d}T${t}:00` : undefined

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isEdit && record) {
      const data: Record<string, unknown> = {
        status: form.status, notes: form.notes || undefined,
        approval_status: form.approval_status,
        rejection_reason: form.approval_status === 'rejected' ? form.rejection_reason || undefined : undefined,
      }
      if (form.clock_in)       data.clock_in       = buildDT(form.date, form.clock_in)
      if (form.clock_out)      data.clock_out      = buildDT(form.date, form.clock_out)
      if (form.work_hours)     data.work_hours     = parseFloat(form.work_hours)
      if (form.overtime_hours) data.overtime_hours = parseFloat(form.overtime_hours)
      await update.mutateAsync({ id: record.id, data })
    } else {
      await mark.mutateAsync({ employee_id: form.employee_id, date: form.date, status: form.status, notes: form.notes || undefined })
    }
    onClose()
  }

  const isPending = mark.isPending || update.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onModalBackdropClick(onClose)}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">{isEdit ? 'Edit Attendance Record' : 'Mark Attendance'}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {!isEdit && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Employee *</label>
              <select required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none" value={form.employee_id} onChange={e => set('employee_id', e.target.value)}>
                <option value="">— Select Employee —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.vendor_user?.user?.full_name ?? e.employee_code}</option>)}
              </select>
            </div>
          )}
          {isEdit && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
              <span className="font-medium">{(record?.employee as any)?.vendor_user?.user?.full_name ?? (record?.employee as any)?.employee_code ?? '—'}</span>
              <span className="text-gray-400 ml-2">· {record?.date}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {!isEdit && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.date} onChange={e => set('date', e.target.value)} />
              </div>
            )}
            <div className={isEdit ? 'col-span-2' : ''}>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUS_OPTS.map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>)}
              </select>
            </div>
          </div>
          {isEdit && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Clock In</label>
                  <input type="time" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.clock_in} onChange={e => set('clock_in', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Clock Out</label>
                  <input type="time" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.clock_out} onChange={e => set('clock_out', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Work Hours</label>
                  <input type="number" step="0.5" min="0" max="24" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.work_hours} onChange={e => set('work_hours', e.target.value)} placeholder="e.g. 8.5" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">OT Hours</label>
                  <input type="number" step="0.5" min="0" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.overtime_hours} onChange={e => set('overtime_hours', e.target.value)} placeholder="e.g. 1.5" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Approval</label>
                <div className="flex gap-2">
                  {(['pending', 'approved', 'rejected'] as const).map(s => (
                    <button key={s} type="button" onClick={() => set('approval_status', s)}
                      className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${form.approval_status === s
                        ? s === 'approved' ? 'bg-green-600 text-white border-green-600'
                          : s === 'rejected' ? 'bg-red-600 text-white border-red-600'
                          : 'bg-amber-500 text-white border-amber-500'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                      {s === 'approved' ? '✓ Approve' : s === 'rejected' ? '✕ Reject' : '⏳ Pending'}
                    </button>
                  ))}
                </div>
              </div>
              {form.approval_status === 'rejected' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Rejection Reason</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.rejection_reason} onChange={e => set('rejection_reason', e.target.value)} placeholder="Reason…" />
                </div>
              )}
            </>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes…" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-cancel px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button type="submit" disabled={isPending} className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg disabled:opacity-50 hover:bg-primary/90">
              <Save className="w-4 h-4" />
              {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Mark'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Work-from options ─────────────────────────────────────────────────────────────
const WORK_FROM_OPTS = [
  { value: 'office',  label: 'Office',  icon: Building2 },
  { value: 'home',    label: 'Home',    icon: Home },
  { value: 'remote',  label: 'Remote',  icon: Wifi },
  { value: 'field',   label: 'Field',   icon: MapPin },
]

interface DayEntry {
  status:       string
  work_from:    string
  comment:      string
  included:     boolean
  submitted:    boolean
  loading:      boolean
  clock_in:     string   // HH:MM — used when status === 'time'
  clock_out:    string   // HH:MM
  total_hours:  string   // decimal string, auto-filled from times or manual
}

// ── Range Mark Modal ──────────────────────────────────────────────────────────────
interface RangeModalProps {
  employees:   any[]
  defaultFrom: string
  defaultTo:   string
  onClose:     () => void
}

function RangeMarkModal({ employees, defaultFrom, defaultTo, onClose }: RangeModalProps) {
  const markRange = useHRMarkAttendanceRange()

  // ── Step 1 state ──
  const [fromDate,     setFromDate]     = useState(defaultFrom)
  const [toDate,       setToDate]       = useState(defaultTo)
  const [globalStatus, setGlobalStatus] = useState('present')
  const [globalWF,     setGlobalWF]     = useState('office')
  const [skipWeekends, setSkipWeekends] = useState(true)
  const [skipExisting, setSkipExisting] = useState(true)
  const [selected,     setSelected]     = useState<string[]>([])
  const [searchEmp,    setSearchEmp]    = useState('')

  // ── Step 2 state ──
  const [step,     setStep]     = useState<1 | 2>(1)
  const [dayMap,   setDayMap]   = useState<Record<string, DayEntry>>({})
  const [bulkBusy, setBulkBusy] = useState(false)

  // ── Helpers ──
  const empFiltered = employees.filter(e =>
    (e.vendor_user?.user?.full_name ?? e.employee_code ?? '').toLowerCase().includes(searchEmp.toLowerCase())
  )
  function toggleEmployee(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function toggleAll() {
    setSelected(prev => prev.length === employees.length ? [] : employees.map(e => e.id))
  }

  // ── Date list ──
  const allDays = useMemo<{ date: string; dow: number; label: string }[]>(() => {
    if (!fromDate || !toDate || fromDate > toDate) return []
    const list = []
    const cur  = new Date(fromDate + 'T00:00:00')
    const end  = new Date(toDate   + 'T00:00:00')
    const DOW  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    while (cur <= end) {
      list.push({
        date:  cur.toISOString().slice(0, 10),
        dow:   cur.getDay(),
        label: `${DOW[cur.getDay()]} ${cur.getDate()} ${cur.toLocaleString('default', { month: 'short', year: 'numeric' })}`,
      })
      cur.setDate(cur.getDate() + 1)
    }
    return list
  }, [fromDate, toDate])

  const visibleDays = skipWeekends ? allDays.filter(d => d.dow !== 0 && d.dow !== 6) : allDays
  const empCount    = selected.length === 0 ? employees.length : selected.length

  // ── Advance to step 2: initialise dayMap from current global defaults ──
  function goToStep2() {
    const init: Record<string, DayEntry> = {}
    for (const d of visibleDays) {
      init[d.date] = dayMap[d.date] ?? {
        status:      globalStatus,
        work_from:   globalWF,
        comment:     '',
        included:    true,
        submitted:   false,
        loading:     false,
        clock_in:    '09:00',
        clock_out:   '18:00',
        total_hours: '',
      }
    }
    setDayMap(init)
    setStep(2)
  }

  function setDayField(date: string, field: keyof DayEntry, value: unknown) {
    setDayMap(prev => ({ ...prev, [date]: { ...prev[date], [field]: value } }))
  }

  // ── Submit a single day ──
  async function submitDay(date: string) {
    const entry = dayMap[date]
    if (!entry || entry.submitted || entry.loading) return
    setDayField(date, 'loading', true)
    try {
      const isTime   = entry.status === 'time'
      const isHours  = entry.status === 'total_hours'
      const hours    = isTime
        ? calcHours(entry.clock_in, entry.clock_out)
        : entry.total_hours ? parseFloat(entry.total_hours) : undefined

      const parts = [
        entry.work_from ? `Work from: ${entry.work_from}` : '',
        isTime  && entry.clock_in && entry.clock_out
          ? `${entry.clock_in}–${entry.clock_out} (${hours}h)` : '',
        isHours && hours !== undefined ? `${hours}h total` : '',
        entry.comment ? entry.comment : '',
      ].filter(Boolean)

      await markRange.mutateAsync({
        employee_ids:  selected,
        from_date:     date,
        to_date:       date,
        status:        (isTime || isHours) ? 'present' : entry.status,
        notes:         parts.join(' · ') || undefined,
        skip_weekends: false,
        skip_existing: skipExisting,
      })
      setDayField(date, 'submitted', true)
    } finally {
      setDayField(date, 'loading', false)
    }
  }

  // ── Submit all unsubmitted included days ──
  async function submitAll() {
    setBulkBusy(true)
    const pending = visibleDays.filter(d => dayMap[d.date]?.included && !dayMap[d.date]?.submitted)
    for (const d of pending) {
      await submitDay(d.date)
    }
    setBulkBusy(false)
    const anyLeft = visibleDays.some(d => dayMap[d.date]?.included && !dayMap[d.date]?.submitted)
    if (!anyLeft) onClose()
  }

  const submittedCount = visibleDays.filter(d => dayMap[d.date]?.submitted).length
  const includedCount  = visibleDays.filter(d => dayMap[d.date]?.included).length
  const allDone        = visibleDays.length > 0 && submittedCount === includedCount && includedCount > 0

  // ═══════════════════════════════════════════════════════════════════
  // STEP 1 — Range + defaults
  // ═══════════════════════════════════════════════════════════════════
  if (step === 1) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-base font-semibold text-gray-900">Mark Attendance — Date Range</h2>
              <p className="text-xs text-gray-400">Step 1 of 2 · Set range &amp; defaults</p>
            </div>
          </div>
          <button type="button" aria-label="Close" type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* Date range — future dates allowed on To */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Date Range *</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-7">From</span>
                <input type="date"
                  className="form-select"
                  value={fromDate}
                  onChange={e => { setFromDate(e.target.value); if (e.target.value > toDate) setToDate(e.target.value) }}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-4">To</span>
                <input type="date" min={fromDate}
                  className="form-select"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                />
              </div>
              {visibleDays.length > 0 && (
                <div className="flex gap-1.5 text-xs">
                  <span className="bg-primary/10 text-primary border border-primary/30 px-2.5 py-1 rounded-full font-medium">
                    {allDays.length} day{allDays.length !== 1 ? 's' : ''}
                  </span>
                  {skipWeekends && allDays.length !== visibleDays.length && (
                    <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                      {visibleDays.length} workday{visibleDays.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Default status */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Default Status</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTS.map(s => {
                const cfg = STATUS_CONFIG[s]
                return (
                  <button key={s} type="button" onClick={() => setGlobalStatus(s)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      globalStatus === s
                        ? `${cfg.color} border-current shadow-sm`
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                    }`}>
                    <cfg.icon className="w-3 h-3 shrink-0" />{cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Default work from */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Default Work From</p>
            <div className="flex gap-1.5 flex-wrap">
              {WORK_FROM_OPTS.map(({ value, label, icon: Icon }) => (
                <button key={value} type="button" onClick={() => setGlobalWF(value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    globalWF === value
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                  <Icon className="w-3 h-3 shrink-0" />{label}
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={skipWeekends} onChange={e => setSkipWeekends(e.target.checked)} className="rounded text-primary" />
              <span className="text-sm text-gray-700">Skip weekends (Sat &amp; Sun)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={skipExisting} onChange={e => setSkipExisting(e.target.checked)} className="rounded text-primary" />
              <span className="text-sm text-gray-700">Skip days already marked</span>
            </label>
          </div>

          {/* Employees */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Employees
                <span className="ml-1 text-gray-400 font-normal normal-case">
                  {selected.length === 0 ? '(all active)' : `(${selected.length} selected)`}
                </span>
              </p>
              <button type="button" onClick={toggleAll} className="text-xs text-primary hover:underline">
                {selected.length === employees.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="relative mb-2">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                className="w-full pl-8 pr-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                placeholder="Search employees…"
                value={searchEmp}
                onChange={e => setSearchEmp(e.target.value)}
              />
            </div>
            <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
              {empFiltered.length === 0 && <p className="text-xs text-gray-400 text-center py-3">No employees found</p>}
              {empFiltered.map(emp => {
                const name  = emp.vendor_user?.user?.full_name ?? emp.employee_code ?? '—'
                const dept  = emp.department?.name ?? ''
                const isSel = selected.includes(emp.id)
                return (
                  <label key={emp.id}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${isSel ? 'bg-primary/10' : 'hover:bg-gray-50'}`}>
                    <input type="checkbox" checked={isSel} onChange={() => toggleEmployee(emp.id)} className="rounded text-primary" />
                    <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-primary font-semibold text-xs shrink-0">
                      {name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                      {dept && <p className="text-xs text-gray-400 truncate">{dept}</p>}
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 shrink-0">
          <p className="text-xs text-gray-500">
            {visibleDays.length > 0
              ? <>{visibleDays.length} day{visibleDays.length !== 1 ? 's' : ''} · {empCount} employee{empCount !== 1 ? 's' : ''}</>
              : 'Select a date range to continue'}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-cancel px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button type="button" disabled={visibleDays.length === 0} onClick={goToStep2}
              className="flex items-center gap-2 px-5 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
              Add Day Details →
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  // ═══════════════════════════════════════════════════════════════════
  // STEP 2 — Compact table, one row per day
  // ═══════════════════════════════════════════════════════════════════

  const SaveBar = ({ top }: { top?: boolean }) => (
    <div className={`flex items-center justify-between px-4 py-2 bg-gray-50 ${top ? 'border-b' : 'border-t'} shrink-0`}>
      <p className="text-xs text-gray-500">
        <strong className="text-gray-700">{submittedCount}</strong>/{includedCount} saved
        {empCount > 0 && <> · <strong className="text-gray-700">{empCount}</strong> employee{empCount !== 1 ? 's' : ''}</>}
        {includedCount > 0 && (
          <span className="ml-2 inline-block w-24 h-1.5 align-middle rounded-full bg-gray-200 overflow-hidden">
            <span className="block h-full bg-green-500 transition-all" style={{ width: `${(submittedCount / includedCount) * 100}%` }} />
          </span>
        )}
      </p>
      <div className="flex gap-2">
        {allDone
          ? <button type="button" onClick={onClose} className="px-4 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">Done ✓</button>
          : <>
              <button type="button" onClick={onClose} className="btn-cancel px-3 py-1.5 text-xs border rounded-lg">Cancel</button>
              <button type="button" onClick={submitAll} disabled={bulkBusy || includedCount === 0}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
                {bulkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {bulkBusy ? 'Saving…' : 'Save All'}
              </button>
            </>
        }
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setStep(1)}
              className="text-xs text-gray-400 hover:text-gray-700 border rounded px-2 py-1 hover:bg-gray-50">
              ← Back
            </button>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Day-wise Entry</h2>
              <p className="text-xs text-gray-400">{fromDate} → {toDate} · {visibleDays.length} days</p>
            </div>
          </div>
          <button type="button" aria-label="Close" type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" /></button>
        </div>

        {/* Save bar — top */}
        <SaveBar top />

        {/* Table */}
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-100 border-b">
              <tr>
                <th className="w-8  px-2 py-2 text-left font-medium text-gray-500">#</th>
                <th className="w-36 px-2 py-2 text-left font-medium text-gray-500">Date &amp; Day</th>
                <th className="w-32 px-2 py-2 text-left font-medium text-gray-500">Status</th>
                <th className="w-28 px-2 py-2 text-left font-medium text-gray-500">Work From</th>
                <th className="w-48 px-2 py-2 text-left font-medium text-gray-500">
                  <span className="flex items-center gap-1"><Timer className="w-3 h-3" /> Hours / Time</span>
                </th>
                <th className="px-2 py-2 text-left font-medium text-gray-500">Comment</th>
              </tr>
            </thead>
            <tbody>
              {visibleDays.map(({ date, label }, idx) => {
                const entry = dayMap[date]
                if (!entry) return null
                const isSaved   = entry.submitted
                const isSkipped = !entry.included
                const isTime    = entry.status === 'time'
                const autoHrs   = isTime ? calcHours(entry.clock_in, entry.clock_out) : null

                // update total_hours automatically when times change
                function handleTime(field: 'clock_in' | 'clock_out', val: string) {
                  const ci = field === 'clock_in'  ? val : entry.clock_in
                  const co = field === 'clock_out' ? val : entry.clock_out
                  const h  = calcHours(ci, co)
                  setDayMap(prev => ({
                    ...prev,
                    [date]: { ...prev[date], [field]: val, total_hours: h > 0 ? String(h) : '' },
                  }))
                }

                return (
                  <tr key={date}
                    className={`border-b transition-colors ${
                      isSaved   ? 'bg-green-50'
                      : isSkipped ? 'bg-gray-50 opacity-40'
                      : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                    }`}>

                    {/* # + include */}
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={entry.included} disabled={isSaved}
                          onChange={e => setDayField(date, 'included', e.target.checked)}
                          className="rounded text-primary w-3 h-3" />
                        <span className="text-gray-300">{idx + 1}</span>
                      </label>
                    </td>

                    {/* Date & Day */}
                    <td className="px-2 py-1.5 whitespace-nowrap font-medium text-gray-700">
                      {isSaved
                        ? <span className="flex items-center gap-1 text-green-700"><CheckCircle className="w-3 h-3" />{label}</span>
                        : label}
                    </td>

                    {/* Status */}
                    <td className="px-2 py-1.5">
                      {isSaved
                        ? <StatusBadge status={isTime ? 'present' : entry.status} />
                        : (
                          <select value={entry.status}
                            onChange={e => setDayField(date, 'status', e.target.value)}
                            disabled={isSkipped}
                            className="w-full border rounded px-1.5 py-1 text-xs focus:ring-1 focus:ring-primary outline-none bg-white">
                            {STATUS_OPTS.map(s => (
                              <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>
                            ))}
                          </select>
                        )}
                    </td>

                    {/* Work From */}
                    <td className="px-2 py-1.5">
                      {isSaved
                        ? <span className="capitalize text-gray-600">{entry.work_from}</span>
                        : (
                          <select value={entry.work_from}
                            onChange={e => setDayField(date, 'work_from', e.target.value)}
                            disabled={isSkipped}
                            className="w-full border rounded px-1.5 py-1 text-xs focus:ring-1 focus:ring-primary outline-none bg-white">
                            {WORK_FROM_OPTS.map(({ value, label: wl }) => (
                              <option key={value} value={value}>{wl}</option>
                            ))}
                          </select>
                        )}
                    </td>

                    {/* Hours / Time entry — before Comment */}
                    <td className="px-2 py-1.5">
                      {isSaved ? (
                        <span className="text-gray-600 font-medium">
                          {isTime && entry.clock_in && entry.clock_out
                            ? `${entry.clock_in}–${entry.clock_out} · ${autoHrs}h`
                            : entry.total_hours ? `${entry.total_hours}h` : '—'}
                        </span>
                      ) : isTime ? (
                        /* Clock-in/out with auto calculation */
                        <div className="flex items-center gap-1">
                          <input type="time" value={entry.clock_in}
                            onChange={e => handleTime('clock_in', e.target.value)}
                            disabled={isSkipped}
                            className="border rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none w-[4.8rem]"
                          />
                          <span className="text-gray-300">→</span>
                          <input type="time" value={entry.clock_out}
                            onChange={e => handleTime('clock_out', e.target.value)}
                            disabled={isSkipped}
                            className="border rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none w-[4.8rem]"
                          />
                          {autoHrs !== null && autoHrs > 0 && (
                            <span className="text-indigo-600 font-semibold whitespace-nowrap">= {autoHrs}h</span>
                          )}
                        </div>
                      ) : (entry.status === 'total_hours') ? (
                        /* Manual total hours input */
                        <div className="flex items-center gap-1">
                          <input type="number" min="0" max="24" step="0.5"
                            value={entry.total_hours}
                            onChange={e => setDayField(date, 'total_hours', e.target.value)}
                            disabled={isSkipped}
                            placeholder="0"
                            className="border rounded px-1.5 py-1 text-xs focus:ring-1 focus:ring-teal-500 outline-none w-16 placeholder-gray-300"
                          />
                          <span className="text-gray-400">h</span>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Comment */}
                    <td className="px-2 py-1.5">
                      {isSaved
                        ? <span className="text-gray-500 italic">{entry.comment || '—'}</span>
                        : (
                          <input value={entry.comment}
                            onChange={e => setDayField(date, 'comment', e.target.value)}
                            disabled={isSkipped}
                            placeholder="Comment…"
                            className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary outline-none placeholder-gray-300"
                          />
                        )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Save bar — bottom */}
        <SaveBar />
      </div>
    </div>
  )
}

// ── Quick Approve/Reject ──────────────────────────────────────────────────────────
function QuickApproval({ record }: { record: AttendanceRecord }) {
  const update = useHRUpdateAttendance()
  return (
    <div className="flex gap-1">
      <button title="Approve" disabled={update.isPending || record.approval_status === 'approved'}
        onClick={() => update.mutate({ id: record.id, data: { approval_status: 'approved' } })}
        className="p-1.5 rounded-md hover:bg-green-50 text-green-600 disabled:opacity-40">
        <ThumbsUp className="w-3.5 h-3.5" />
      </button>
      <button title="Reject" disabled={update.isPending || record.approval_status === 'rejected'}
        onClick={() => update.mutate({ id: record.id, data: { approval_status: 'rejected' } })}
        className="p-1.5 rounded-md hover:bg-red-50 text-red-600 disabled:opacity-40">
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────────
export default function AttendancePage() {
  const today        = new Date().toISOString().slice(0, 10)
  const firstOfMonth = today.slice(0, 8) + '01'

  const [fromDate,       setFromDate]       = useState(today)
  const [toDate,         setToDate]         = useState(today)
  const [deptFilter,     setDeptFilter]     = useState('')
  const [statusFilter,   setStatusFilter]   = useState('')
  const [approvalFilter, setApprovalFilter] = useState('')
  const [empFilter,      setEmpFilter]      = useState('')
  const [showMark,       setShowMark]       = useState(false)
  const [showRange,      setShowRange]      = useState(false)
  const [editRecord,     setEditRecord]     = useState<AttendanceRecord | null>(null)
  const [showFilters,    setShowFilters]    = useState(false)

  const isRange = fromDate !== toDate

  const { data: attData, isLoading } = useHRAttendance({
    from_date:   fromDate,
    to_date:     toDate,
    status:      statusFilter || undefined,
    employee_id: empFilter    || undefined,
    limit: 500,
  })
  const { data: empData }          = useHREmployees({ department_id: deptFilter || undefined, limit: 200 })
  const { data: departments = [] } = useHRDepartments()

  const allRecords: AttendanceRecord[] = attData?.items ?? []
  const employees = empData?.items ?? []

  const records = useMemo(() => {
    if (!approvalFilter) return allRecords
    return allRecords.filter(x => (x.approval_status ?? 'pending') === approvalFilter)
  }, [allRecords, approvalFilter])

  const presentCount    = records.filter(r => r.status === 'present' || r.status === 'late').length
  const absentCount     = records.filter(r => r.status === 'absent').length
  const onLeaveCount    = records.filter(r => r.status === 'on_leave').length
  const pendingApproval = records.filter(r => !r.approval_status || r.approval_status === 'pending').length

  function setPreset(p: 'today' | 'week' | 'month') {
    const d = new Date()
    if (p === 'today') { setFromDate(today); setToDate(today) }
    else if (p === 'week') {
      const day = d.getDay() || 7
      const mon = new Date(d); mon.setDate(d.getDate() - day + 1)
      setFromDate(mon.toISOString().slice(0, 10)); setToDate(today)
    } else { setFromDate(firstOfMonth); setToDate(today) }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isRange ? `${fromDate} → ${toDate}` : `Daily — ${fromDate}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowRange(true)}
            className="flex items-center gap-2 px-4 py-2 border border-primary/40 text-primary bg-primary/10 rounded-lg hover:bg-primary/15 text-sm font-medium transition-colors">
            <CalendarRange className="w-4 h-4" /> Mark Range
          </button>
          <button onClick={() => setShowMark(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium">
            <CheckCircle className="w-4 h-4" /> Mark Single
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Present / Late',  value: presentCount,    cls: 'bg-green-50 border-green-100 text-green-800 text-green-600' },
          { label: 'Absent',          value: absentCount,     cls: 'bg-red-50 border-red-100 text-red-800 text-red-600' },
          { label: 'On Leave',        value: onLeaveCount,    cls: 'bg-primary/10 border-primary/20 text-primary text-primary' },
          { label: 'Pending Approval',value: pendingApproval, cls: 'bg-amber-50 border-amber-100 text-amber-800 text-amber-600' },
        ].map(({ label, value, cls }) => {
          const [bg, border, numCls, lblCls] = cls.split(' ')
          return (
            <div key={label} className={`${bg} rounded-xl p-4 border ${border}`}>
              <p className={`text-2xl font-bold ${numCls}`}>{value}</p>
              <p className={`text-sm ${lblCls}`}>{label}</p>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">From</label>
            <input type="date"
              className="form-select"
              value={fromDate}
              onChange={e => { setFromDate(e.target.value); if (e.target.value > toDate) setToDate(e.target.value) }}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">To</label>
            <input type="date" min={fromDate}
              className="form-select"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
            />
          </div>
          <div className="flex gap-1">
            {(['today', 'week', 'month'] as const).map(p => (
              <button key={p} onClick={() => setPreset(p)}
                className="px-2.5 py-1.5 text-xs rounded-md border hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors">
                {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
              </button>
            ))}
          </div>
          <button onClick={() => setShowFilters(v => !v)}
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            More Filters <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>
        {showFilters && (
          <div className="flex flex-wrap gap-3 pt-3 border-t">
            <select className="form-select" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
              <option value="">All Departments</option>
              {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select className="form-select" value={empFilter} onChange={e => setEmpFilter(e.target.value)}>
              <option value="">All Employees</option>
              {employees.map((e: any) => <option key={e.id} value={e.id}>{e.vendor_user?.user?.full_name ?? e.employee_code}</option>)}
            </select>
            <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              {STATUS_OPTS.map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>)}
            </select>
            <select className="form-select" value={approvalFilter} onChange={e => setApprovalFilter(e.target.value)}>
              <option value="">All Approval</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            {(deptFilter || empFilter || statusFilter || approvalFilter) && (
              <button type="button" aria-label="Close" onClick={() => { setDeptFilter(''); setEmpFilter(''); setStatusFilter(''); setApprovalFilter('') }}
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground mb-3">No attendance records found for this range.</p>
            <button onClick={() => setShowRange(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-primary/40 text-primary rounded-lg hover:bg-primary/10">
              <CalendarRange className="w-4 h-4" /> Mark Attendance Range
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 border-b border-border">
                <tr>
                  {['Employee', 'Date', 'Clock In', 'Clock Out', 'Hours', 'Status', 'Approval', 'Actions'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map(r => {
                  const name = (r.employee as any)?.vendor_user?.user?.full_name ?? (r.employee as any)?.employee_code ?? '—'
                  const approvalStatus = r.approval_status ?? 'pending'
                  return (
                    <tr key={r.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3 px-4 font-medium text-foreground whitespace-nowrap">{name}</td>
                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{r.date}</td>
                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                        {r.clock_in ? new Date(r.clock_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                        {r.clock_out ? new Date(r.clock_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                        {r.work_hours != null ? `${Number(r.work_hours).toFixed(1)}h` : '—'}
                        {r.overtime_hours != null && Number(r.overtime_hours) > 0 && (
                          <span className="text-xs text-primary/70 ml-1">+{Number(r.overtime_hours).toFixed(1)}OT</span>
                        )}
                      </td>
                      <td className="py-3 px-4"><StatusBadge status={r.status} /></td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5">
                          <ApprovalBadge status={approvalStatus} />
                          {approvalStatus === 'rejected' && r.rejection_reason && (
                            <span className="text-xs text-red-500 max-w-[120px] truncate" title={r.rejection_reason}>{r.rejection_reason}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditRecord(r)} title="Edit"
                            className="p-1.5 rounded-md hover:bg-primary/10 text-primary">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {approvalStatus === 'pending' && <QuickApproval record={r} />}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="px-4 py-2 border-t border-border bg-muted/40 text-xs text-muted-foreground">
              {records.length} record{records.length !== 1 ? 's' : ''} · {attData?.total ?? records.length} total
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showMark  && <AttendanceModal employees={employees} defaultDate={fromDate} onClose={() => setShowMark(false)} />}
      {showRange && <RangeMarkModal  employees={employees} defaultFrom={fromDate} defaultTo={toDate} onClose={() => setShowRange(false)} />}
      {editRecord && <AttendanceModal employees={employees} record={editRecord} onClose={() => setEditRecord(null)} />}
    </div>
  )
}
