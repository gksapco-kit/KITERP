import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Building2,
  Calendar,
  CalendarRange,
  CheckCircle,
  Clock,
  Home,
  Loader2,
  MapPin,
  Save,
  Timer,
  Wifi,
  X,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { essApi } from '@/api/ess'
import { useESSMarkAttendance } from '@/hooks/useESS'

const ESS_MARK_RANGE_MAX_DAYS = 90

const STATUS_OPTS = [
  'present', 'absent', 'late', 'half_day', 'on_leave', 'holiday', 'week_off', 'time', 'total_hours',
] as const

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  present:     { label: 'Present',     color: 'text-green-700 bg-green-50 border-green-200', icon: CheckCircle },
  absent:      { label: 'Absent',      color: 'text-red-700 bg-red-50 border-red-200', icon: XCircle },
  late:        { label: 'Late',        color: 'text-orange-700 bg-orange-50 border-orange-200', icon: Clock },
  half_day:    { label: 'Half Day',    color: 'text-yellow-700 bg-yellow-50 border-yellow-200', icon: AlertCircle },
  on_leave:    { label: 'On Leave',    color: 'text-primary bg-primary/10 border-primary/30', icon: Calendar },
  holiday:     { label: 'Holiday',     color: 'text-violet-700 bg-violet-50 border-violet-200', icon: Calendar },
  week_off:    { label: 'Week Off',    color: 'text-gray-600 bg-gray-100 border-gray-200', icon: Calendar },
  time:        { label: 'Time Entry',  color: 'text-indigo-700 bg-indigo-50 border-indigo-200', icon: Timer },
  total_hours: { label: 'Total Hours', color: 'text-teal-700 bg-teal-50 border-teal-200', icon: Clock },
}

const WORK_FROM_OPTS = [
  { value: 'office', label: 'Office', icon: Building2 },
  { value: 'home', label: 'Home', icon: Home },
  { value: 'remote', label: 'Remote', icon: Wifi },
  { value: 'field', label: 'Field', icon: MapPin },
] as const

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function calcHours(start: string, end: string): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  return Math.max(0, Math.round((mins / 60) * 100) / 100)
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'text-gray-600 bg-gray-100 border-gray-200', icon: Clock }
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${cfg.color}`}>
      <cfg.icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

interface DayEntry {
  status: string
  work_from: string
  comment: string
  included: boolean
  submitted: boolean
  loading: boolean
  clock_in: string
  clock_out: string
  total_hours: string
}

export const ESS_ATTENDANCE_STATUSES = STATUS_OPTS.filter(
  s => s !== 'time' && s !== 'total_hours',
).map(s => ({ value: s, label: STATUS_CONFIG[s]?.label ?? s }))

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  wide,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className={`bg-white rounded-xl shadow-2xl w-full flex flex-col min-h-0 ${wide ? 'max-w-4xl max-h-[95vh]' : 'max-w-xl max-h-[92vh]'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function EssMarkSingleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const mark = useESSMarkAttendance()
  const t = todayIso()
  const [date, setDate] = useState(t)
  const [status, setStatus] = useState('present')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (open) {
      setDate(t)
      setStatus('present')
      setNotes('')
    }
  }, [open, t])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await mark.mutateAsync({ date, status, notes: notes.trim() || undefined })
    onClose()
  }

  return (
    <ModalShell title="Mark attendance (single day)" onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
        <p className="text-xs text-gray-500">
          Mark your own attendance for a past or today&apos;s date. HR may review in the central dashboard.
        </p>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
          <input
            type="date"
            required
            max={t}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
          <select
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {ESS_ATTENDANCE_STATUSES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
          <textarea
            rows={2}
            className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
            placeholder="Reason or comment"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-1 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={mark.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {mark.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Save
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

export function EssMarkRangeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const t = todayIso()

  const [fromDate, setFromDate] = useState(t)
  const [toDate, setToDate] = useState(t)
  const [globalStatus, setGlobalStatus] = useState('present')
  const [globalWF, setGlobalWF] = useState('office')
  const [skipWeekends, setSkipWeekends] = useState(true)
  const [skipExisting, setSkipExisting] = useState(true)
  const [step, setStep] = useState<1 | 2>(1)
  const [dayMap, setDayMap] = useState<Record<string, DayEntry>>({})
  const [bulkBusy, setBulkBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setFromDate(t)
    setToDate(t)
    setGlobalStatus('present')
    setGlobalWF('office')
    setSkipWeekends(true)
    setSkipExisting(true)
    setStep(1)
    setDayMap({})
    setBulkBusy(false)
  }, [open, t])

  const allDays = useMemo(() => {
    if (!fromDate || !toDate || fromDate > toDate) return []
    const list: { date: string; dow: number; label: string }[] = []
    const cur = new Date(`${fromDate}T00:00:00`)
    const end = new Date(`${toDate}T00:00:00`)
    const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    while (cur <= end) {
      list.push({
        date: cur.toISOString().slice(0, 10),
        dow: cur.getDay(),
        label: `${DOW[cur.getDay()]} ${cur.getDate()} ${cur.toLocaleString('default', { month: 'short', year: 'numeric' })}`,
      })
      cur.setDate(cur.getDate() + 1)
    }
    return list
  }, [fromDate, toDate])

  const visibleDays = skipWeekends ? allDays.filter((d) => d.dow !== 0 && d.dow !== 6) : allDays
  const rangeDayCount = allDays.length

  function goToStep2() {
    if (fromDate > toDate) {
      toast.error('From date must be on or before To date')
      return
    }
    if (toDate > t) {
      toast.error('Cannot mark attendance for future dates')
      return
    }
    if (rangeDayCount > ESS_MARK_RANGE_MAX_DAYS) {
      toast.error(`Range cannot exceed ${ESS_MARK_RANGE_MAX_DAYS} days`)
      return
    }
    if (visibleDays.length === 0) {
      toast.error('No days in range (check weekend skip)')
      return
    }
    const init: Record<string, DayEntry> = {}
    for (const d of visibleDays) {
      init[d.date] = dayMap[d.date] ?? {
        status: globalStatus,
        work_from: globalWF,
        comment: '',
        included: true,
        submitted: false,
        loading: false,
        clock_in: '09:00',
        clock_out: '18:00',
        total_hours: '',
      }
    }
    setDayMap(init)
    setStep(2)
  }

  function setDayField(date: string, field: keyof DayEntry, value: unknown) {
    setDayMap((prev) => ({ ...prev, [date]: { ...prev[date], [field]: value } }))
  }

  async function submitDay(date: string) {
    const entry = dayMap[date]
    if (!entry || entry.submitted || entry.loading || !entry.included) return
    setDayField(date, 'loading', true)
    try {
      const isTime = entry.status === 'time'
      const isHours = entry.status === 'total_hours'
      const hours = isTime
        ? calcHours(entry.clock_in, entry.clock_out)
        : entry.total_hours ? parseFloat(entry.total_hours) : undefined

      const parts = [
        entry.work_from ? `Work from: ${entry.work_from}` : '',
        isTime && entry.clock_in && entry.clock_out
          ? `${entry.clock_in}–${entry.clock_out} (${hours}h)`
          : '',
        isHours && hours !== undefined ? `${hours}h total` : '',
        entry.comment ? entry.comment : '',
      ].filter(Boolean)

      await essApi.markAttendanceRange({
        from_date: date,
        to_date: date,
        status: (isTime || isHours) ? 'present' : entry.status,
        notes: parts.join(' · ') || undefined,
        skip_weekends: false,
        skip_existing: skipExisting,
      })
      setDayField(date, 'submitted', true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof msg === 'string' ? msg : `Failed to save ${date}`)
    } finally {
      setDayField(date, 'loading', false)
    }
  }

  async function submitAll() {
    setBulkBusy(true)
    const pending = visibleDays.filter((d) => dayMap[d.date]?.included && !dayMap[d.date]?.submitted)
    for (const d of pending) {
      await submitDay(d.date)
    }
    setBulkBusy(false)
    qc.invalidateQueries({ queryKey: ['ess-attendance-today'] })
    qc.invalidateQueries({ queryKey: ['ess-attendance'] })
    const anyLeft = visibleDays.some((d) => dayMap[d.date]?.included && !dayMap[d.date]?.submitted)
    if (!anyLeft) {
      toast.success('Attendance range saved')
      onClose()
    }
  }

  const submittedCount = visibleDays.filter((d) => dayMap[d.date]?.submitted).length
  const includedCount = visibleDays.filter((d) => dayMap[d.date]?.included).length
  const allDone = visibleDays.length > 0 && submittedCount === includedCount && includedCount > 0

  if (!open) return null

  if (step === 1) {
    return (
      <ModalShell
        title="Mark Attendance — Date Range"
        subtitle="Step 1 of 2 · Set range & defaults"
        onClose={onClose}
      >
        <div className="flex flex-col flex-1 min-h-0">
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          <p className="text-xs text-gray-500 -mt-2">
            Applies to your profile only. Max {ESS_MARK_RANGE_MAX_DAYS} days; no future dates.
          </p>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Date Range *</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-7">From</span>
                <input
                  type="date"
                  max={t}
                  className="border rounded-lg px-3 py-2 text-sm"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value)
                    if (e.target.value > toDate) setToDate(e.target.value)
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-4">To</span>
                <input
                  type="date"
                  min={fromDate}
                  max={t}
                  className="border rounded-lg px-3 py-2 text-sm"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
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

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Default Status</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTS.map((s) => {
                const cfg = STATUS_CONFIG[s]
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setGlobalStatus(s)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      globalStatus === s
                        ? `${cfg.color} border-current shadow-sm`
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <cfg.icon className="w-3 h-3 shrink-0" />
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Default Work From</p>
            <div className="flex gap-1.5 flex-wrap">
              {WORK_FROM_OPTS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setGlobalWF(value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    globalWF === value
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-3 h-3 shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input
                type="checkbox"
                checked={skipWeekends}
                onChange={(e) => setSkipWeekends(e.target.checked)}
                className="rounded text-primary"
              />
              Skip weekends (Sat &amp; Sun)
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input
                type="checkbox"
                checked={skipExisting}
                onChange={(e) => setSkipExisting(e.target.checked)}
                className="rounded text-primary"
              />
              Skip days already marked
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 shrink-0">
          <p className="text-xs text-gray-500">
            {visibleDays.length > 0
              ? <>{visibleDays.length} day{visibleDays.length !== 1 ? 's' : ''} · your attendance</>
              : 'Select a valid date range to continue'}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="button"
              disabled={visibleDays.length === 0 || rangeDayCount > ESS_MARK_RANGE_MAX_DAYS}
              onClick={goToStep2}
              className="flex items-center gap-2 px-5 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              Add Day Details →
            </button>
          </div>
        </div>
        </div>
      </ModalShell>
    )
  }

  const SaveBar = ({ top }: { top?: boolean }) => (
    <div className={`flex items-center justify-between px-4 py-2 bg-gray-50 ${top ? 'border-b' : 'border-t'} shrink-0`}>
      <p className="text-xs text-gray-500">
        <strong className="text-gray-700">{submittedCount}</strong>/{includedCount} saved
        {includedCount > 0 && (
          <span className="ml-2 inline-block w-24 h-1.5 align-middle rounded-full bg-gray-200 overflow-hidden">
            <span
              className="block h-full bg-green-500 transition-all"
              style={{ width: `${includedCount ? (submittedCount / includedCount) * 100 : 0}%` }}
            />
          </span>
        )}
      </p>
      <div className="flex gap-2">
        {allDone ? (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Done ✓
          </button>
        ) : (
          <>
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="button"
              onClick={submitAll}
              disabled={bulkBusy || includedCount === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {bulkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {bulkBusy ? 'Saving…' : 'Save All'}
            </button>
          </>
        )}
      </div>
    </div>
  )

  return (
    <ModalShell
      title="Day-wise Entry"
      subtitle={`${fromDate} → ${toDate} · ${visibleDays.length} days`}
      onClose={onClose}
      wide
    >
      <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-3 px-5 py-2 border-b shrink-0">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="text-xs text-gray-500 hover:text-gray-700 border rounded px-2 py-1 hover:bg-gray-50"
        >
          ← Back
        </button>
      </div>
      <SaveBar top />
      <div className="overflow-y-auto flex-1">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10 bg-gray-100 border-b">
            <tr>
              <th className="w-8 px-2 py-2 text-left font-medium text-gray-500">#</th>
              <th className="w-36 px-2 py-2 text-left font-medium text-gray-500">Date &amp; Day</th>
              <th className="w-32 px-2 py-2 text-left font-medium text-gray-500">Status</th>
              <th className="w-28 px-2 py-2 text-left font-medium text-gray-500">Work From</th>
              <th className="w-48 px-2 py-2 text-left font-medium text-gray-500">
                <span className="flex items-center gap-1">
                  <Timer className="w-3 h-3" /> Hours / Time
                </span>
              </th>
              <th className="px-2 py-2 text-left font-medium text-gray-500">Comment</th>
            </tr>
          </thead>
          <tbody>
            {visibleDays.map(({ date, label }, idx) => {
              const entry = dayMap[date]
              if (!entry) return null
              const isSaved = entry.submitted
              const isSkipped = !entry.included
              const isTime = entry.status === 'time'
              const autoHrs = isTime ? calcHours(entry.clock_in, entry.clock_out) : null

              function handleTime(field: 'clock_in' | 'clock_out', val: string) {
                const ci = field === 'clock_in' ? val : entry.clock_in
                const co = field === 'clock_out' ? val : entry.clock_out
                const h = calcHours(ci, co)
                setDayMap((prev) => ({
                  ...prev,
                  [date]: { ...prev[date], [field]: val, total_hours: h > 0 ? String(h) : '' },
                }))
              }

              return (
                <tr
                  key={date}
                  className={`border-b transition-colors ${
                    isSaved
                      ? 'bg-green-50'
                      : isSkipped
                        ? 'bg-gray-50 opacity-40'
                        : idx % 2 === 0
                          ? 'bg-white'
                          : 'bg-slate-50/60'
                  }`}
                >
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={entry.included}
                        disabled={isSaved}
                        onChange={(e) => setDayField(date, 'included', e.target.checked)}
                        className="rounded text-primary w-3 h-3"
                      />
                      <span className="text-gray-300">{idx + 1}</span>
                    </label>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap font-medium text-gray-700">
                    {isSaved ? (
                      <span className="flex items-center gap-1 text-green-700">
                        <CheckCircle className="w-3 h-3" />
                        {label}
                      </span>
                    ) : (
                      label
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {isSaved ? (
                      <StatusBadge status={isTime ? 'present' : entry.status} />
                    ) : (
                      <select
                        value={entry.status}
                        onChange={(e) => setDayField(date, 'status', e.target.value)}
                        disabled={isSkipped}
                        className="w-full border rounded px-1.5 py-1 text-xs focus:ring-1 focus:ring-primary outline-none bg-white"
                      >
                        {STATUS_OPTS.map((s) => (
                          <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {isSaved ? (
                      <span className="capitalize text-gray-600">{entry.work_from}</span>
                    ) : (
                      <select
                        value={entry.work_from}
                        onChange={(e) => setDayField(date, 'work_from', e.target.value)}
                        disabled={isSkipped}
                        className="w-full border rounded px-1.5 py-1 text-xs outline-none bg-white"
                      >
                        {WORK_FROM_OPTS.map(({ value, label: wl }) => (
                          <option key={value} value={value}>{wl}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {isSaved ? (
                      <span className="text-gray-600 font-medium">
                        {isTime && entry.clock_in && entry.clock_out
                          ? `${entry.clock_in}–${entry.clock_out} · ${autoHrs}h`
                          : entry.total_hours
                            ? `${entry.total_hours}h`
                            : '—'}
                      </span>
                    ) : isTime ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="time"
                          value={entry.clock_in}
                          onChange={(e) => handleTime('clock_in', e.target.value)}
                          disabled={isSkipped}
                          className="border rounded px-1 py-0.5 text-xs w-[4.8rem]"
                        />
                        <span className="text-gray-300">→</span>
                        <input
                          type="time"
                          value={entry.clock_out}
                          onChange={(e) => handleTime('clock_out', e.target.value)}
                          disabled={isSkipped}
                          className="border rounded px-1 py-0.5 text-xs w-[4.8rem]"
                        />
                        {autoHrs !== null && autoHrs > 0 && (
                          <span className="text-indigo-600 font-semibold whitespace-nowrap">= {autoHrs}h</span>
                        )}
                      </div>
                    ) : entry.status === 'total_hours' ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="24"
                          step="0.5"
                          value={entry.total_hours}
                          onChange={(e) => setDayField(date, 'total_hours', e.target.value)}
                          disabled={isSkipped}
                          placeholder="0"
                          className="border rounded px-1.5 py-1 text-xs w-16"
                        />
                        <span className="text-gray-400">h</span>
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {isSaved ? (
                      <span className="text-gray-500 italic">{entry.comment || '—'}</span>
                    ) : (
                      <input
                        value={entry.comment}
                        onChange={(e) => setDayField(date, 'comment', e.target.value)}
                        disabled={isSkipped}
                        placeholder="Comment…"
                        className="w-full border rounded px-2 py-1 text-xs placeholder-gray-300"
                      />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <SaveBar />
      </div>
    </ModalShell>
  )
}
