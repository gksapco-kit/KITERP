import { useState, useMemo, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils'
import { themeUi } from '@/lib/themeColors'
import { Repeat, Clock, IndianRupee, Check, Calendar, Plus, X, CalendarDays, RotateCcw } from 'lucide-react'

const inputFocus = `rounded-lg border border-gray-200 outline-none ${themeUi.focusRingInput}`

const INTERVAL_META: Record<string, { label: string; short: string; yearly: number; daysPerCycle: number }> = {
  daily:     { label: 'Daily',        short: '/day',      yearly: 365, daysPerCycle: 1 },
  weekly:    { label: 'Weekly',       short: '/week',     yearly: 52,  daysPerCycle: 7 },
  biweekly:  { label: 'Bi-Weekly',    short: '/2 wks',    yearly: 26,  daysPerCycle: 14 },
  monthly:   { label: 'Monthly',      short: '/month',    yearly: 12,  daysPerCycle: 30 },
  quarterly: { label: 'Quarterly',    short: '/quarter',  yearly: 4,   daysPerCycle: 91 },
  biannual:  { label: 'Half-Yearly',  short: '/6 mo',     yearly: 2,   daysPerCycle: 182 },
  yearly:    { label: 'Yearly',       short: '/year',     yearly: 1,   daysPerCycle: 365 },
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

type RecurUnit = 'day' | 'week' | 'month'

function addCyclesToDate(start: Date, interval: string, cycles: number): Date {
  const d = new Date(start)
  switch (interval) {
    case 'daily':     d.setDate(d.getDate() + cycles); break
    case 'weekly':    d.setDate(d.getDate() + cycles * 7); break
    case 'biweekly':  d.setDate(d.getDate() + cycles * 14); break
    case 'monthly':   d.setMonth(d.getMonth() + cycles); break
    case 'quarterly': d.setMonth(d.getMonth() + cycles * 3); break
    case 'biannual':  d.setMonth(d.getMonth() + cycles * 6); break
    case 'yearly':    d.setFullYear(d.getFullYear() + cycles); break
  }
  return d
}

function cycleBetweenDates(start: Date, end: Date, interval: string): number {
  const diffMs = end.getTime() - start.getTime()
  if (diffMs <= 0) return 0
  const meta = INTERVAL_META[interval]
  if (!meta) return 0
  return Math.max(1, Math.ceil(diffMs / (meta.daysPerCycle * 86400000)))
}

function toInputDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseInputDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(y, (m || 1) - 1, d || 1)
  date.setHours(0, 0, 0, 0)
  return date
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const RECURRING_PREVIEW_CHIP_LIMIT = 16
const RECURRING_SELECTED_DATES_CAP = 120

function getWeekdayOccurrences(dayIndex: number, from: Date, to: Date): string[] {
  const dates: string[] = []
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  const end = new Date(to)
  end.setHours(23, 59, 59, 999)
  while (d.getDay() !== dayIndex) d.setDate(d.getDate() + 1)
  while (d <= end) {
    dates.push(toInputDate(d))
    d.setDate(d.getDate() + 7)
  }
  return dates
}

function generateRecurringDates(
  from: Date, to: Date, every: number, unit: RecurUnit, weekdays: number[],
  limit = Number.POSITIVE_INFINITY,
): string[] {
  const dates: string[] = []
  const start = new Date(from)
  start.setHours(0, 0, 0, 0)
  const end = new Date(to)
  end.setHours(23, 59, 59, 999)
  if (end < start || every < 1) return dates

  if (unit === 'week' && weekdays.length > 0) {
    const weekStart = new Date(start)
    while (weekStart <= end && dates.length < limit) {
      for (const wd of weekdays.sort((a, b) => a - b)) {
        const d = new Date(weekStart)
        const diff = wd - d.getDay()
        d.setDate(d.getDate() + (diff < 0 ? diff + 7 : diff))
        if (d >= start && d <= end && dates.length < limit) {
          const ds = toInputDate(d)
          if (!dates.includes(ds)) dates.push(ds)
        }
      }
      weekStart.setDate(weekStart.getDate() + every * 7)
    }
  } else if (unit === 'day') {
    const cursor = new Date(start)
    while (cursor <= end && dates.length < limit) {
      dates.push(toInputDate(cursor))
      cursor.setDate(cursor.getDate() + every)
    }
  } else if (unit === 'month') {
    const cursor = new Date(start)
    while (cursor <= end && dates.length < limit) {
      dates.push(toInputDate(cursor))
      cursor.setMonth(cursor.getMonth() + every)
    }
  } else {
    const cursor = new Date(start)
    const daysPerUnit = unit === 'week' ? 7 : 1
    while (cursor <= end && dates.length < limit) {
      dates.push(toInputDate(cursor))
      cursor.setDate(cursor.getDate() + every * daysPerUnit)
    }
  }

  return [...new Set(dates)].sort()
}

function countRecurringOccurrences(
  from: Date, to: Date, every: number, unit: RecurUnit, weekdays: number[],
): number {
  return generateRecurringDates(from, to, every, unit, weekdays).length
}

type Mode = 'dates' | 'cycles' | 'pick_dates' | 'weekly' | 'recurring'

interface Props {
  interval: string
  pricePerCycle: number
  currency: string
  priceType?: string
  uom?: string
  trialDays?: number | null
  setupFee?: number | null
  maxCycles?: number | null
  allowedModes?: string[]
  onSubscribe: (config: {
    interval: string; cycles: number; total: number
    startDate: string; endDate: string
    selectedDates?: string[]; weeklyDay?: number
    recurrence?: { every: number; unit: RecurUnit; weekdays?: number[] }
  }) => void
  subscribePending?: boolean
  disabled?: boolean
}

const ALL_MODES: Mode[] = ['dates', 'cycles', 'pick_dates', 'weekly', 'recurring']

export default function SubscriptionConfigurator({
  interval, pricePerCycle, currency, priceType, uom,
  trialDays, setupFee, maxCycles, allowedModes,
  onSubscribe, subscribePending, disabled,
}: Props) {
  const meta = INTERVAL_META[interval]
  const isPerUom = priceType === 'per_unit'
  const uomLabel = uom || 'unit'
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const trialEnd = trialDays && trialDays > 0
    ? new Date(today.getTime() + trialDays * 86400000)
    : today

  const defaultStart = trialEnd
  const defaultCycles = maxCycles && maxCycles > 0 ? maxCycles : 1
  const defaultEnd = addCyclesToDate(defaultStart, interval, defaultCycles)

  const [startDate, setStartDate] = useState(toInputDate(defaultStart))
  const [endDate, setEndDate] = useState(toInputDate(defaultEnd))
  const enabledModes = useMemo(() => {
    if (!allowedModes || allowedModes.length === 0) return ALL_MODES
    return ALL_MODES.filter(m => allowedModes.includes(m))
  }, [allowedModes])

  const [mode, setMode] = useState<Mode>(enabledModes[0] || 'dates')
  const [selectedCycles, setSelectedCycles] = useState<number>(defaultCycles)

  // Pick-dates mode
  const [pickedDates, setPickedDates] = useState<string[]>([])
  const [pickInput, setPickInput] = useState('')

  // Weekly mode
  const [weeklyDay, setWeeklyDay] = useState<number>(1)
  const [weeklyFrom, setWeeklyFrom] = useState(toInputDate(defaultStart))
  const [weeklyTo, setWeeklyTo] = useState(toInputDate(addCyclesToDate(defaultStart, 'monthly', 3)))

  // Recurring mode
  const [recurEvery, setRecurEvery] = useState(1)
  const [recurUnit, setRecurUnit] = useState<RecurUnit>('week')
  const [recurWeekdays, setRecurWeekdays] = useState<number[]>([1]) // Monday
  const [recurFrom, setRecurFrom] = useState(toInputDate(defaultStart))
  const [recurTo, setRecurTo] = useState(toInputDate(addCyclesToDate(defaultStart, 'monthly', 3)))

  const hasTrial = trialDays != null && trialDays > 0
  const hasSetup = setupFee != null && setupFee > 0
  const fee = hasSetup ? setupFee! : 0

  // Recurring schedule — full count for billing; capped list for preview chips only
  const recurOccurrenceCount = useMemo(() => {
    if (mode !== 'recurring') return 0
    return countRecurringOccurrences(
      parseInputDate(recurFrom),
      parseInputDate(recurTo),
      recurEvery,
      recurUnit,
      recurWeekdays,
    )
  }, [mode, recurFrom, recurTo, recurEvery, recurUnit, recurWeekdays])

  const recurDatePreview = useMemo(() => {
    if (mode !== 'recurring') return []
    return generateRecurringDates(
      parseInputDate(recurFrom),
      parseInputDate(recurTo),
      recurEvery,
      recurUnit,
      recurWeekdays,
      RECURRING_PREVIEW_CHIP_LIMIT,
    )
  }, [mode, recurFrom, recurTo, recurEvery, recurUnit, recurWeekdays])

  const weeklyOccurrences = useMemo(() => {
    if (mode !== 'weekly') return []
    return getWeekdayOccurrences(weeklyDay, parseInputDate(weeklyFrom), parseInputDate(weeklyTo))
  }, [mode, weeklyDay, weeklyFrom, weeklyTo])

  const computedCycles = useMemo(() => {
    if (mode === 'cycles') return selectedCycles
    if (mode === 'pick_dates') return pickedDates.length
    if (mode === 'weekly') return weeklyOccurrences.length
    if (mode === 'recurring') return recurOccurrenceCount
    const s = parseInputDate(startDate)
    const e = parseInputDate(endDate)
    return cycleBetweenDates(s, e, interval)
  }, [mode, startDate, endDate, selectedCycles, interval, pickedDates, weeklyOccurrences, recurOccurrenceCount])

  const computedEndDate = useMemo(() => {
    if (mode === 'pick_dates' && pickedDates.length > 0) {
      const sorted = [...pickedDates].sort()
      return parseInputDate(sorted[sorted.length - 1])
    }
    if (mode === 'weekly') return parseInputDate(weeklyTo)
    if (mode === 'recurring') return parseInputDate(recurTo)
    if (mode === 'dates') return parseInputDate(endDate)
    return addCyclesToDate(parseInputDate(startDate), interval, selectedCycles)
  }, [mode, startDate, endDate, selectedCycles, interval, pickedDates, weeklyTo, recurTo])

  const computedStartDate = useMemo(() => {
    if (mode === 'pick_dates' && pickedDates.length > 0) {
      const sorted = [...pickedDates].sort()
      return parseInputDate(sorted[0])
    }
    if (mode === 'weekly') return parseInputDate(weeklyFrom)
    if (mode === 'recurring') return parseInputDate(recurFrom)
    return parseInputDate(startDate)
  }, [mode, startDate, pickedDates, weeklyFrom, recurFrom])

  const handleCycleChange = (c: number) => {
    setSelectedCycles(c)
    const newEnd = addCyclesToDate(parseInputDate(startDate), interval, c)
    setEndDate(toInputDate(newEnd))
  }

  const handleEndDateChange = (val: string) => {
    setEndDate(val)
    const s = parseInputDate(startDate)
    const e = parseInputDate(val)
    const c = cycleBetweenDates(s, e, interval)
    setSelectedCycles(c)
  }

  const handleStartDateChange = (val: string) => {
    setStartDate(val)
    if (mode === 'cycles') {
      const newEnd = addCyclesToDate(parseInputDate(val), interval, selectedCycles)
      setEndDate(toInputDate(newEnd))
    } else {
      const s = parseInputDate(val)
      const e = parseInputDate(endDate)
      const c = cycleBetweenDates(s, e, interval)
      setSelectedCycles(c)
    }
  }

  const addPickDate = useCallback(() => {
    if (!pickInput) return
    if (pickedDates.includes(pickInput)) return
    const max = maxCycles && maxCycles > 0 ? maxCycles : 999
    if (pickedDates.length >= max) return
    setPickedDates(prev => [...prev, pickInput].sort())
    setPickInput('')
  }, [pickInput, pickedDates, maxCycles])

  const removePickDate = (d: string) => setPickedDates(prev => prev.filter(x => x !== d))

  const toggleRecurWeekday = (dayIdx: number) => {
    setRecurWeekdays(prev =>
      prev.includes(dayIdx) ? (prev.length > 1 ? prev.filter(d => d !== dayIdx) : prev) : [...prev, dayIdx]
    )
  }

  const effectiveCycles = maxCycles && maxCycles > 0
    ? Math.min(computedCycles, maxCycles)
    : computedCycles

  const totalAmount = pricePerCycle * effectiveCycles + fee
  const yearlyEquivalent = meta ? pricePerCycle * meta.yearly : pricePerCycle * 12
  const firstCharge = fee + (hasTrial ? 0 : pricePerCycle)
  const firstChargeDate = hasTrial
    ? new Date(today.getTime() + trialDays! * 86400000)
    : today

  if (!meta) return null

  const minStartDate = toInputDate(today)

  const allModeConfig: { id: Mode; label: string; shortLabel: string; icon: typeof Calendar }[] = [
    { id: 'dates',      label: 'Date range',  shortLabel: 'Range',     icon: Calendar },
    { id: 'cycles',     label: 'Billing cycles', shortLabel: 'Cycles',    icon: Clock },
    { id: 'pick_dates', label: 'Pick dates',  shortLabel: 'Pick',      icon: CalendarDays },
    { id: 'weekly',     label: 'Weekly',      shortLabel: 'Weekly',    icon: Repeat },
    { id: 'recurring',  label: 'Recurring',   shortLabel: 'Repeat',    icon: RotateCcw },
  ]
  const modeConfig = allModeConfig.filter(m => enabledModes.includes(m.id))

  const recurSummary = useMemo(() => {
    if (recurUnit === 'week' && recurWeekdays.length > 0) {
      const days = recurWeekdays.sort((a, b) => a - b).map(d => WEEKDAY_SHORT[d]).join(', ')
      return recurEvery === 1 ? `Every ${days}` : `Every ${recurEvery} weeks on ${days}`
    }
    const unitLabel = recurUnit === 'day' ? 'day' : 'month'
    return recurEvery === 1 ? `Every ${unitLabel}` : `Every ${recurEvery} ${unitLabel}s`
  }, [recurEvery, recurUnit, recurWeekdays])

  const handleSubscribe = () => {
    const base = {
      interval,
      cycles: effectiveCycles,
      total: totalAmount,
      startDate: computedStartDate.toISOString(),
      endDate: computedEndDate.toISOString(),
    }
    if (mode === 'pick_dates') {
      onSubscribe({ ...base, selectedDates: [...pickedDates].sort() })
    } else if (mode === 'weekly') {
      onSubscribe({ ...base, weeklyDay, selectedDates: weeklyOccurrences })
    } else if (mode === 'recurring') {
      const selectedDates =
        recurOccurrenceCount <= RECURRING_SELECTED_DATES_CAP
          ? generateRecurringDates(
            parseInputDate(recurFrom),
            parseInputDate(recurTo),
            recurEvery,
            recurUnit,
            recurWeekdays,
            RECURRING_SELECTED_DATES_CAP,
          )
          : undefined
      onSubscribe({
        ...base,
        selectedDates,
        recurrence: { every: recurEvery, unit: recurUnit, weekdays: recurUnit === 'week' ? recurWeekdays : undefined },
      })
    } else {
      onSubscribe(base)
    }
  }

  // Renders the date-preview chip list (reused for weekly + recurring)
  const renderDateChips = (dates: string[], maxShow: number = 12, totalCount?: number) => {
    const total = totalCount ?? dates.length
    return (
    <div className="bg-white rounded-lg border border-gray-100 p-3">
      <p className="text-xs font-medium text-gray-500 mb-1.5">
        {total} occurrence{total !== 1 ? 's' : ''} in this period
      </p>
      <div className="flex flex-wrap gap-1">
        {dates.slice(0, maxShow).map(d => (
          <span key={d} className={`text-xs font-medium px-2 py-0.5 rounded-full ${themeUi.pillPrimary}`}>
            {formatDateShort(parseInputDate(d))}
          </span>
        ))}
        {total > maxShow && (
          <span className="text-xs font-medium text-gray-400 px-2 py-0.5">
            +{total - maxShow} more
          </span>
        )}
      </div>
    </div>
    )
  }

  // Price-line label varies by mode
  const priceLine = mode === 'pick_dates' ? 'Price per selected date'
    : mode === 'weekly' ? `Price per ${WEEKDAYS[weeklyDay]}`
    : mode === 'recurring' ? 'Price per occurrence'
    : `Price per ${meta.label.toLowerCase()} cycle`

  const countUnit = mode === 'pick_dates' ? 'date'
    : mode === 'weekly' || mode === 'recurring' ? 'occurrence'
    : 'cycle'

  return (
    <div className={`rounded-xl border overflow-hidden ${themeUi.borderPrimarySoft} ${themeUi.gradientHeroBr}`}>
      {/* Header */}
      <div className={`px-4 py-2.5 flex items-center justify-between gap-2 ${themeUi.btnSolid}`}>
        <span className="flex items-center gap-2 text-white font-bold text-sm">
          <Repeat className="w-4 h-4 text-white/85 shrink-0" />
          Subscribe
        </span>
        {hasTrial && (
          <span className="text-[10px] font-bold uppercase tracking-wide text-white/90 bg-white/15 px-2 py-0.5 rounded-full">
            {trialDays}d trial
          </span>
        )}
      </div>

      <div className="px-3.5 py-3 space-y-3.5 sm:px-4 sm:py-3.5">
        {/* Price hero */}
        <div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-xl sm:text-2xl font-extrabold text-gray-900 tabular-nums">
              {formatCurrency(pricePerCycle, currency)}
            </p>
            <span className="text-sm font-medium text-gray-500">
              {isPerUom ? `per ${uomLabel}` : meta.short}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Billed {meta.label.toLowerCase()}
            {isPerUom ? ` per ${uomLabel}` : ''}
            · Inclusive of all taxes
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5 tabular-nums">
            ≈ {formatCurrency(yearlyEquivalent, currency)}/year
          </p>
        </div>

        {/* Setup fee — trial moved to header */}
        {hasSetup && (
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-full px-3 py-1 text-xs font-medium">
              <IndianRupee className="w-3.5 h-3.5 shrink-0" />
              {formatCurrency(fee, currency)} one-time setup
            </div>
          </div>
        )}

        {/* Schedule mode — grid fits all options without horizontal scroll in wider sidebar */}
        {modeConfig.length > 1 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">How do you want to schedule?</p>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {modeConfig.map(m => (
              <button
                key={m.id}
                type="button"
                title={m.label}
                onClick={() => setMode(m.id)}
                className={`flex min-w-0 items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  mode === m.id
                    ? `${themeUi.toggleActive} shadow-sm`
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200/80 hover:text-gray-800'
                }`}
              >
                <m.icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{m.shortLabel}</span>
              </button>
            ))}
          </div>
        </div>
        )}

        {/* ── Mode: Date Range ── */}
        {mode === 'dates' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
              <input type="date" value={startDate} min={minStartDate} onChange={e => handleStartDateChange(e.target.value)}
                className={`w-full px-3 py-2.5 text-sm ${inputFocus}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
              <input type="date" value={endDate} min={startDate} onChange={e => handleEndDateChange(e.target.value)}
                className={`w-full px-3 py-2.5 text-sm ${inputFocus}`} />
            </div>
          </div>
        )}

        {/* ── Mode: Cycles ── */}
        {mode === 'cycles' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Number of Billing Cycles</label>
            <div className="flex items-center gap-3">
              <input type="number" min="1" max={maxCycles && maxCycles > 0 ? maxCycles : 999}
                value={selectedCycles} onChange={e => handleCycleChange(Math.max(1, parseInt(e.target.value) || 1))}
                className={`w-24 px-3 py-2.5 text-sm font-bold text-center ${inputFocus}`} />
              <span className="text-sm text-gray-500">
                {meta.label.toLowerCase()} cycle{selectedCycles !== 1 ? 's' : ''}
              </span>
              {maxCycles && maxCycles > 0 && (
                <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">max {maxCycles}</span>
              )}
            </div>
          </div>
        )}

        {/* ── Mode: Pick Dates ── */}
        {mode === 'pick_dates' && (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-gray-600">Select specific dates</label>
            <div className="flex gap-2">
              <input type="date" value={pickInput} min={minStartDate} onChange={e => setPickInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPickDate() } }}
                className={`flex-1 px-3 py-2 text-sm ${inputFocus}`} />
              <button type="button" onClick={addPickDate} disabled={!pickInput || pickedDates.includes(pickInput)}
                className={`px-3 py-2 rounded-lg disabled:opacity-40 text-white text-sm font-medium flex items-center gap-1 transition-colors ${themeUi.btnSolid}`}>
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
            {maxCycles && maxCycles > 0 && (
              <p className="text-xs text-amber-600">Max {maxCycles} dates allowed</p>
            )}
            {pickedDates.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {pickedDates.map(d => (
                  <span key={d} className={`inline-flex items-center gap-1 text-xs font-medium pl-2.5 pr-1 py-1 rounded-full ${themeUi.pillPrimary}`}>
                    {formatDateShort(parseInputDate(d))}
                    <button type="button" onClick={() => removePickDate(d)}
                      className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors ${themeUi.pillPrimaryHoverChip}`}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic text-center py-2">No dates selected yet</p>
            )}
          </div>
        )}

        {/* ── Mode: Weekly ── */}
        {mode === 'weekly' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Deliver / bill every</label>
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map((day, i) => (
                  <button key={day} type="button" onClick={() => setWeeklyDay(i)}
                    className={`py-2 rounded-lg text-xs font-medium transition-all ${
                      weeklyDay === i
                        ? 'bg-[color:var(--color-primary)] text-white shadow-sm'
                        : `bg-gray-100 text-gray-600 ${themeUi.pillPrimaryHoverChip}`
                    }`}>
                    {WEEKDAY_SHORT[i]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                <input type="date" value={weeklyFrom} min={minStartDate} onChange={e => setWeeklyFrom(e.target.value)}
                  className={`w-full px-3 py-2.5 text-sm ${inputFocus}`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Until</label>
                <input type="date" value={weeklyTo} min={weeklyFrom} onChange={e => setWeeklyTo(e.target.value)}
                  className={`w-full px-3 py-2.5 text-sm ${inputFocus}`} />
              </div>
            </div>
            {weeklyOccurrences.length > 0 && renderDateChips(weeklyOccurrences)}
          </div>
        )}

        {/* ── Mode: Recurring ── */}
        {mode === 'recurring' && (
          <div className="space-y-3">
            {/* Frequency row */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Repeat every</label>
              <div className="flex items-center gap-2">
                <input type="number" min="1" max="99" value={recurEvery}
                  onChange={e => setRecurEvery(Math.max(1, parseInt(e.target.value) || 1))}
                  className={`w-16 px-2 py-2 text-sm font-bold text-center ${inputFocus}`} />
                <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                  {([['day', 'Day'], ['week', 'Week'], ['month', 'Month']] as [RecurUnit, string][]).map(([val, lbl]) => (
                    <button key={val} type="button" onClick={() => setRecurUnit(val)}
                      className={`px-3 py-2 font-medium transition-colors ${
                        recurUnit === val
                          ? 'bg-[color:var(--color-primary)] text-white'
                          : `bg-white text-gray-600 ${themeUi.pillPrimaryHoverChip}`
                      }`}>
                      {lbl}{recurEvery > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Weekday multi-select — only for "week" unit */}
            {recurUnit === 'week' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">On these days</label>
                <div className="grid grid-cols-7 gap-1">
                  {WEEKDAYS.map((day, i) => {
                    const active = recurWeekdays.includes(i)
                    return (
                      <button key={day} type="button" onClick={() => toggleRecurWeekday(i)}
                        className={`py-2 rounded-lg text-xs font-medium transition-all ${
                          active
                            ? 'bg-[color:var(--color-primary)] text-white shadow-sm'
                            : `bg-gray-100 text-gray-600 ${themeUi.pillPrimaryHoverChip}`
                        }`}>
                        {WEEKDAY_SHORT[i]}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start</label>
                <input type="date" value={recurFrom} min={minStartDate} onChange={e => setRecurFrom(e.target.value)}
                  className={`w-full px-3 py-2.5 text-sm ${inputFocus}`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">End</label>
                <input type="date" value={recurTo} min={recurFrom} onChange={e => setRecurTo(e.target.value)}
                  className={`w-full px-3 py-2.5 text-sm ${inputFocus}`} />
              </div>
            </div>

            {/* Summary badge */}
            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${themeUi.bgSoftPanel} ${themeUi.borderPrimaryMuted}`}>
              <RotateCcw className={`w-4 h-4 shrink-0 ${themeUi.iconPrimary}`} />
              <p className={`text-xs font-medium ${themeUi.textOnPrimaryMuted}`}>{recurSummary}</p>
              <span className={`ml-auto text-xs font-bold ${themeUi.textPrimaryStrong}`}>{recurOccurrenceCount} dates</span>
            </div>

            {/* Generated dates preview */}
            {recurOccurrenceCount > 0 && renderDateChips(recurDatePreview, RECURRING_PREVIEW_CHIP_LIMIT, recurOccurrenceCount)}
          </div>
        )}

        {/* Timeline visual — for dates/cycles modes */}
        {(mode === 'dates' || mode === 'cycles') && (
          <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Timeline</p>
            <div className="relative">
              <div className="flex items-center gap-0">
                {hasTrial && (
                  <div className="flex-shrink-0 text-center min-w-[3.5rem]">
                    <div className="h-2 bg-green-400 rounded-l-full w-14" />
                    <p className="text-[10px] text-green-700 font-medium mt-1 leading-tight">Trial</p>
                    <p className="text-[10px] text-gray-400">{trialDays}d</p>
                  </div>
                )}
                <div className="flex-1 text-center min-w-0">
                  <div className={`h-2 bg-[color:var(--color-primary)] ${hasTrial ? '' : 'rounded-l-full'} rounded-r-full`} />
                  <p className={`text-[10px] font-medium mt-1 leading-tight ${themeUi.textPrimaryStrong}`}>Active</p>
                  <p className="text-[10px] text-gray-400">{effectiveCycles} cycle{effectiveCycles !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-[11px] sm:text-xs">
                <div>
                  <p className="font-semibold text-gray-700">{hasTrial ? 'Trial starts' : 'Starts'}</p>
                  <p className="text-gray-500">{formatDateShort(today)}</p>
                </div>
                {hasTrial && (
                  <div className="text-center sm:text-left">
                    <p className={`font-semibold ${themeUi.textPrimaryStrong}`}>Billing starts</p>
                    <p className="text-gray-500">{formatDateShort(firstChargeDate)}</p>
                  </div>
                )}
                <div className={hasTrial ? 'text-right' : 'text-right sm:col-start-3'}>
                  <p className="font-semibold text-gray-700">Ends</p>
                  <p className="text-gray-500">{formatDateShort(computedEndDate)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pricing breakdown */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          <div className="flex justify-between px-4 py-2.5 text-sm">
            <span className="text-gray-600">{priceLine}</span>
            <span className="font-semibold text-gray-900">{formatCurrency(pricePerCycle, currency)}</span>
          </div>
          <div className="flex justify-between px-4 py-2.5 text-sm">
            <span className="text-gray-600">× {effectiveCycles} {countUnit}{effectiveCycles !== 1 ? 's' : ''}</span>
            <span className="font-semibold text-gray-900">{formatCurrency(pricePerCycle * effectiveCycles, currency)}</span>
          </div>
          {hasSetup && (
            <div className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-gray-600">One-time setup fee</span>
              <span className="font-semibold text-gray-900">{formatCurrency(fee, currency)}</span>
            </div>
          )}
          {hasTrial && (
            <div className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-green-700 font-medium">Free trial</span>
              <span className="font-semibold text-green-700">{trialDays} days ({formatCurrency(0, currency)})</span>
            </div>
          )}
          <div className="flex justify-between px-4 py-2.5 text-sm">
            <span className="text-gray-600">Period</span>
            <span className="font-medium text-gray-700">
              {formatDateShort(computedStartDate)} → {formatDateShort(computedEndDate)}
            </span>
          </div>
          <div className={`flex justify-between px-4 py-3 text-sm ${themeUi.bgSoftPanel}`}>
            <span className="font-bold text-gray-900">Total to pay</span>
            <span className={`font-extrabold text-lg ${themeUi.textPrimaryStrong}`}>
              {formatCurrency(totalAmount, currency)}
            </span>
          </div>
          {hasTrial && (
            <div className="flex justify-between px-4 py-2 text-xs bg-green-50/50">
              <span className="text-green-700">First charge (after {trialDays}d trial)</span>
              <span className="font-semibold text-green-700">{formatCurrency(firstCharge, currency)}</span>
            </div>
          )}
        </div>

        {/* Subscribe CTA */}
        <button
          type="button"
          onClick={handleSubscribe}
          disabled={subscribePending || disabled || effectiveCycles < 1}
          className={`w-full h-12 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm flex items-center justify-center gap-2 transition-colors ${themeUi.btnSolid} ${themeUi.shadowPrimarySoft}`}
        >
          {subscribePending ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Repeat className="w-5 h-5" />
          )}
          {disabled
            ? 'Out of Stock'
            : hasTrial
              ? `Start ${trialDays}-Day Free Trial`
              : mode === 'recurring'
                ? 'Confirm recurring booking'
                : `Subscribe — ${formatCurrency(totalAmount, currency)}`
          }
        </button>

        <p className="text-xs text-center text-gray-400">
          {mode === 'pick_dates'
            ? `You selected ${effectiveCycles} date${effectiveCycles !== 1 ? 's' : ''}.`
            : mode === 'weekly'
              ? `Every ${WEEKDAYS[weeklyDay]} — ${effectiveCycles} occurrence${effectiveCycles !== 1 ? 's' : ''}.`
              : mode === 'recurring'
                ? `${recurSummary} — ${effectiveCycles} occurrence${effectiveCycles !== 1 ? 's' : ''}.`
                : hasTrial
                  ? `Your free trial starts today. First charge of ${formatCurrency(firstCharge, currency)} on ${formatDateShort(firstChargeDate)}.`
                  : `You will be charged ${formatCurrency(totalAmount, currency)} for ${effectiveCycles} cycle${effectiveCycles !== 1 ? 's' : ''}.`
          }
          {' '}Total: {formatCurrency(totalAmount, currency)}. Cancel anytime.
        </p>
      </div>
    </div>
  )
}
