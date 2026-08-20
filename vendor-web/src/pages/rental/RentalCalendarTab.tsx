import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Clock, Loader2, Plus, Search, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { rentalApi } from './api'
import { addDaysYMD, formatCardDate, todayLocalYMD } from './rentalDates'
import { RentalEmptyState } from './RentalPrimitives'
import type { RentalAsset, RentalAssetUnit } from './rentalConstants'

type BrowseMode = 'date' | 'asset'
type StatusChip = 'all' | 'available' | 'partial' | 'booked' | 'unavailable'

type CalendarDay = {
  date: string
  status: string
  reserved_qty: number
  available_capacity: number
  detail?: string | null
}

type CalendarResource = {
  id: string
  kind: 'child' | 'unit'
  label: string
  code?: string | null
  highlight?: boolean
  selectable?: boolean
  days: CalendarDay[]
}

type CalendarPayload = {
  days: CalendarDay[]
  resources: CalendarResource[]
  resource_kind?: 'child' | 'unit' | null
}

type DayItem = {
  id: string
  asset_id: string
  parent_asset_id?: string | null
  unit_id?: string | null
  kind: 'asset' | 'child' | 'unit'
  label: string
  code?: string | null
  status: StatusChip | string
  reserved_qty: number
  available_capacity: number
  next_available_date?: string | null
  next_available_time?: string | null
}

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function ymd(y: number, m: number, d: number) {
  const mm = String(m + 1).padStart(2, '0')
  const dd = String(d).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

function dayCellTone(status: string | undefined) {
  if (status === 'booked') return 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-200/60 dark:border-rose-800/40'
  if (status === 'partial') return 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/40'
  if (status === 'available') return 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-800/30'
  if (status === 'maintenance') return 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-200/50 dark:border-amber-800/30'
  return 'bg-muted/30 text-muted-foreground/70 border-transparent'
}

function resourceCellTone(status: string | undefined) {
  if (status === 'booked') return 'bg-rose-500/80 hover:bg-rose-500'
  if (status === 'partial') return 'bg-amber-500/80 hover:bg-amber-500'
  if (status === 'available') return 'bg-emerald-500/75 hover:bg-emerald-500'
  if (status === 'maintenance') return 'bg-amber-500/45'
  return 'bg-muted'
}

function statusPillClass(status: string) {
  if (status === 'available') return 'bg-emerald-500/15 text-emerald-800 border-emerald-200/60'
  if (status === 'partial') return 'bg-amber-500/15 text-amber-800 border-amber-200/60'
  if (status === 'booked') return 'bg-rose-500/15 text-rose-800 border-rose-200/60'
  return 'bg-muted text-muted-foreground border-border'
}

function normalizeCalendar(data: unknown): CalendarPayload {
  if (Array.isArray(data)) return { days: data as CalendarDay[], resources: [] }
  const obj = (data || {}) as Partial<CalendarPayload>
  return {
    days: obj.days || [],
    resources: obj.resources || [],
    resource_kind: obj.resource_kind ?? null,
  }
}

function assetSelectOptions(assets: RentalAsset[]) {
  return [
    { value: '__none__', label: 'Choose an asset…' },
    ...assets
      .filter((a) => !a.parent_asset_id)
      .filter((a) => a.is_bookable !== false || assets.some((c) => c.parent_asset_id === a.id))
      .map((a) => {
        const kids = assets.filter((c) => c.parent_asset_id === a.id).length
        const extra = kids
          ? ` · ${kids} unit${kids === 1 ? '' : 's'}`
          : a.unit_mode === 'serialized' && (a.unit_count ?? 0) > 0
            ? ` · ${a.unit_count} units`
            : ''
        return {
          value: a.id,
          label: `${a.name}${a.asset_code ? ` (${a.asset_code})` : ''}${extra}`,
        }
      }),
  ]
}

function unitLabel(unit: {
  label?: string | null
  serial_no?: string | null
  name?: string
  asset_code?: string | null
  code?: string | null
}) {
  const name = unit.label || unit.name || unit.serial_no || 'Unit'
  const code = unit.code || unit.asset_code || (unit.label && unit.serial_no ? unit.serial_no : null)
  return code ? `${name} (${code})` : name
}

function inDateSpan(date: string, a: string, b: string) {
  const lo = a <= b ? a : b
  const hi = a <= b ? b : a
  return date >= lo && date <= hi
}

function roundLocalTime(now = new Date()): string {
  const extra = now.getSeconds() > 0 || now.getMilliseconds() > 0 ? 1 : 0
  let minutes = now.getHours() * 60 + now.getMinutes() + extra
  minutes = Math.ceil(minutes / 15) * 15
  if (minutes >= 24 * 60) minutes = 23 * 60 + 45
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mm = String(minutes % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

function formatNextAvailable(
  date?: string | null,
  time?: string | null,
  today?: string,
): string | null {
  if (!date) return null
  const dateLabel = today && date === today ? 'Today' : (formatCardDate(date) || date)
  let timeLabel = time || ''
  if (!timeLabel) {
    if (today && date === today) {
      timeLabel = roundLocalTime()
      if (timeLabel < '10:00') timeLabel = '10:00'
    } else {
      timeLabel = '10:00'
    }
  }
  return `${dateLabel}, ${timeLabel}`
}

const LEGEND = [
  { label: 'Available', tone: 'bg-emerald-500', key: 'available' as const },
  { label: 'Partial', tone: 'bg-amber-500', key: 'partial' as const },
  { label: 'Booked', tone: 'bg-rose-500', key: 'booked' as const },
  { label: 'Unavailable', tone: 'bg-muted-foreground/30', key: 'unavailable' as const },
]

export type CalendarBookRequest = {
  asset_id: string
  start_date: string
  end_date: string
  quantity?: number
  unit_id?: string
  unit_label?: string
}

type Props = {
  assets: RentalAsset[]
  assetId: string
  onAssetChange: (id: string) => void
  onBookRequest?: (req: CalendarBookRequest) => void
}

export default function RentalCalendarTab({ assets, assetId, onAssetChange, onBookRequest }: Props) {
  const [browseMode, setBrowseMode] = useState<BrowseMode>(assetId ? 'asset' : 'date')
  const [fromDateBrowse, setFromDateBrowse] = useState(false)
  const [focusDate, setFocusDate] = useState(todayLocalYMD)
  const [search, setSearch] = useState('')
  const [statusChip, setStatusChip] = useState<StatusChip>('all')
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [preferResources, setPreferResources] = useState(true)
  const [unitId, setUnitId] = useState('__all__')
  const [rangeAnchor, setRangeAnchor] = useState<{ date: string; resourceId: string | null } | null>(null)
  const [hoverDate, setHoverDate] = useState<string | null>(null)
  const today = todayLocalYMD()

  const selectedAsset = assets.find((a) => a.id === assetId)
  const parentId = selectedAsset?.parent_asset_id || assetId
  const parentAsset = assets.find((a) => a.id === parentId)

  const topAssets = useMemo(
    () => assets
      .filter((a) => !a.parent_asset_id)
      .filter((a) => a.is_bookable !== false || assets.some((c) => c.parent_asset_id === a.id))
      .slice(0, 6),
    [assets],
  )

  const childAssets = useMemo(
    () => assets.filter((a) => a.parent_asset_id === parentId).sort((a, b) => a.name.localeCompare(b.name)),
    [assets, parentId],
  )

  const fetchSerializedUnits = Boolean(parentId) && browseMode === 'asset' && (
    parentAsset?.unit_mode === 'serialized' || selectedAsset?.unit_mode === 'serialized'
  )

  const { data: serialUnits = [] } = useQuery({
    queryKey: ['rental-asset-units', parentId],
    queryFn: () => rentalApi.listAssetUnits(parentId),
    enabled: fetchSerializedUnits,
    staleTime: 30_000,
  })

  const { data: dayData, isFetching: dayFetching } = useQuery({
    queryKey: ['rental-day-availability', focusDate],
    queryFn: () => rentalApi.dayAvailability(focusDate),
    enabled: browseMode === 'date',
    staleTime: 15_000,
  })

  useEffect(() => {
    if (selectedAsset?.parent_asset_id) {
      setUnitId(selectedAsset.id)
      return
    }
    setUnitId('__all__')
  }, [assetId, selectedAsset?.parent_asset_id, selectedAsset?.id])

  useEffect(() => {
    if (browseMode !== 'asset' || !focusDate) return
    const [y, m] = focusDate.split('-').map(Number)
    if (y && m >= 1 && m <= 12) setCursor({ year: y, month: m - 1 })
  }, [browseMode, focusDate])

  const monthStart = ymd(cursor.year, cursor.month, 1)
  const lastDay = new Date(cursor.year, cursor.month + 1, 0).getDate()
  const monthEnd = ymd(cursor.year, cursor.month, lastDay)

  const { data, isFetching } = useQuery({
    queryKey: ['rental-calendar', parentId, monthStart, monthEnd],
    queryFn: () => rentalApi.calendar(parentId, monthStart, monthEnd),
    enabled: browseMode === 'asset' && !!parentId,
  })

  const payload = useMemo(() => normalizeCalendar(data), [data])

  const unitOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [{ value: '__all__', label: 'All units' }]
    if (childAssets.length > 0) {
      for (const c of childAssets) options.push({ value: c.id, label: unitLabel(c) })
    } else if ((serialUnits as RentalAssetUnit[]).length > 0) {
      for (const u of serialUnits as RentalAssetUnit[]) {
        options.push({ value: u.id, label: unitLabel(u) })
      }
    } else {
      for (const r of payload.resources) options.push({ value: r.id, label: unitLabel(r) })
    }
    return options
  }, [childAssets, serialUnits, payload.resources])

  const hasUnitChoices = unitOptions.length > 1
  const hasResources = payload.resources.length > 0
  const view = hasResources && preferResources ? 'resources' : 'month'
  const resourceNoun = payload.resource_kind === 'unit' || (serialUnits as RentalAssetUnit[]).length > 0 ? 'unit' : 'variant'
  const selectedUnitLabel = unitOptions.find((o) => o.value === unitId)?.label
  const displayedResources = useMemo(() => {
    if (unitId === '__all__') return payload.resources
    return payload.resources.filter((r) => r.id === unitId)
  }, [payload.resources, unitId])

  const dayItems = useMemo(() => {
    const items = (dayData?.items || []) as DayItem[]
    const q = search.trim().toLowerCase()
    return items.filter((it) => {
      if (statusChip !== 'all' && it.status !== statusChip) return false
      if (!q) return true
      return (
        it.label.toLowerCase().includes(q)
        || (it.code || '').toLowerCase().includes(q)
      )
    })
  }, [dayData?.items, search, statusChip])

  const counts = dayData?.counts || { all: 0, available: 0, partial: 0, booked: 0, unavailable: 0 }

  const byDate = useMemo(() => {
    const m = new Map<string, CalendarDay>()
    for (const d of payload.days) m.set(d.date, d)
    return m
  }, [payload.days])

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1)
    const startDow = first.getDay()
    const out: Array<{ date: string; inMonth: boolean }> = []
    const prevLast = new Date(cursor.year, cursor.month, 0).getDate()
    for (let i = startDow - 1; i >= 0; i--) {
      out.push({ date: ymd(cursor.year, cursor.month - 1, prevLast - i), inMonth: false })
    }
    for (let d = 1; d <= lastDay; d++) out.push({ date: ymd(cursor.year, cursor.month, d), inMonth: true })
    const remaining = (7 - (out.length % 7)) % 7
    for (let d = 1; d <= remaining; d++) out.push({ date: ymd(cursor.year, cursor.month + 1, d), inMonth: false })
    return out
  }, [cursor, lastDay])

  const monthDays = useMemo(
    () => Array.from({ length: lastDay }, (_, i) => ymd(cursor.year, cursor.month, i + 1)),
    [cursor, lastDay],
  )

  useEffect(() => {
    setRangeAnchor(null)
    setHoverDate(null)
  }, [parentId, unitId, monthStart, monthEnd, browseMode])

  const goPrevMonth = () => setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }))
  const goNextMonth = () => setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }))
  const goTodayMonth = () => { const n = new Date(); setCursor({ year: n.getFullYear(), month: n.getMonth() }) }

  const switchMode = (mode: BrowseMode) => {
    setBrowseMode(mode)
    setRangeAnchor(null)
    setHoverDate(null)
    if (mode === 'date') {
      setStatusChip('all')
      setFromDateBrowse(false)
    }
  }

  const goBackToDateBrowse = () => {
    setRangeAnchor(null)
    setHoverDate(null)
    setFromDateBrowse(false)
    setBrowseMode('date')
  }

  const resolveBookTarget = (res?: CalendarResource | null): Omit<CalendarBookRequest, 'start_date' | 'end_date'> | null => {
    if (!parentId) return null
    if (res?.kind === 'child') return { asset_id: res.id, quantity: 1 }
    if (res?.kind === 'unit') {
      return {
        asset_id: parentId,
        quantity: 1,
        unit_id: res.id,
        unit_label: unitLabel(res),
      }
    }
    if (unitId !== '__all__') {
      const child = childAssets.find((c) => c.id === unitId)
      if (child) return { asset_id: child.id, quantity: 1 }
      const serial = (serialUnits as RentalAssetUnit[]).find((u) => u.id === unitId)
      if (serial) {
        return {
          asset_id: parentId,
          quantity: 1,
          unit_id: serial.id,
          unit_label: unitLabel(serial),
        }
      }
      const fromPayload = payload.resources.find((r) => r.id === unitId)
      if (fromPayload) return resolveBookTarget(fromPayload)
    }
    const bookable = assets.find((a) => a.id === parentId)
    if (bookable?.is_bookable === false && childAssets[0]) {
      return { asset_id: childAssets[0].id, quantity: 1 }
    }
    return { asset_id: parentId, quantity: 1 }
  }

  const openBook = (start: string, end: string, res?: CalendarResource | null, override?: Omit<CalendarBookRequest, 'start_date' | 'end_date'>) => {
    if (!onBookRequest) return
    const target = override || resolveBookTarget(res)
    if (!target) {
      toast.error(browseMode === 'date' ? 'Pick an available asset or unit' : 'Select an asset first')
      return
    }
    const startDate = start <= end ? start : end
    const endDate = start <= end ? end : start
    setRangeAnchor(null)
    setHoverDate(null)
    onBookRequest({ ...target, start_date: startDate, end_date: endDate })
  }

  const handleDayClick = (date: string, status: string | undefined, res?: CalendarResource | null) => {
    if (!onBookRequest || !parentId) return
    if (date < today) {
      toast.message('Cannot book a past date')
      return
    }
    if (status === 'booked' || status === 'unavailable' || status === 'maintenance') {
      toast.message(status === 'booked' ? 'That day is already booked' : 'That day is unavailable')
      return
    }
    const resourceKey = res?.id ?? null
    if (!rangeAnchor || rangeAnchor.resourceId !== resourceKey) {
      setRangeAnchor({ date, resourceId: resourceKey })
      setHoverDate(date)
      return
    }
    openBook(rangeAnchor.date, date, res)
  }

  const bookFromToolbar = () => {
    if (!onBookRequest) return
    if (browseMode === 'date') {
      toast.message('Pick an available row below to start a booking')
      return
    }
    if (!parentId) return
    openBook(today, today, unitId !== '__all__' ? payload.resources.find((r) => r.id === unitId) ?? null : null)
  }

  const bookDayItem = (item: DayItem) => {
    if (!onBookRequest) return
    if (item.status === 'booked' || item.status === 'unavailable') {
      toast.message(item.status === 'booked' ? 'Already fully booked that day' : 'Unavailable that day')
      return
    }
    if (focusDate < today) {
      toast.message('Cannot book a past date')
      return
    }
    openBook(focusDate, focusDate, null, {
      asset_id: item.asset_id,
      quantity: 1,
      ...(item.unit_id
        ? { unit_id: item.unit_id, unit_label: item.label }
        : {}),
    })
  }

  const openItemInAssetMode = (item: DayItem) => {
    onAssetChange(item.parent_asset_id || item.asset_id)
    if (item.kind === 'child') setUnitId(item.asset_id)
    else if (item.kind === 'unit' && item.unit_id) setUnitId(item.unit_id)
    else setUnitId('__all__')
    setPreferResources(true)
    setFromDateBrowse(true)
    switchMode('asset')
  }

  const previewEnd = hoverDate && rangeAnchor ? hoverDate : rangeAnchor?.date
  const rangeLabel = rangeAnchor
    ? previewEnd && previewEnd !== rangeAnchor.date
      ? `${formatCardDate(rangeAnchor.date)} → ${formatCardDate(previewEnd)}`
      : `${formatCardDate(rangeAnchor.date)} (click end date)`
    : null

  const parentLabel = parentAsset
    ? `${parentAsset.name}${parentAsset.asset_code ? ` (${parentAsset.asset_code})` : ''}`
    : null

  return (
    <div className="space-y-2">
      {browseMode === 'asset' && (
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-1.5 text-foreground"
            onClick={goBackToDateBrowse}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {fromDateBrowse && focusDate
              ? `Back to ${formatCardDate(focusDate) || 'date'}`
              : 'Back to date browse'}
          </Button>
          {parentLabel && (
            <span className="truncate text-[11px] text-muted-foreground">{parentLabel}</span>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="rounded-lg border border-border bg-card px-2.5 py-1.5">
        <div className="flex flex-wrap items-end gap-x-2 gap-y-1.5">
          <div className="shrink-0">
            <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Browse by
            </label>
            <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => switchMode('date')}
                className={cn(
                  'rounded px-2 py-1 transition-colors',
                  browseMode === 'date' ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Date
              </button>
              <button
                type="button"
                onClick={() => switchMode('asset')}
                className={cn(
                  'rounded px-2 py-1 transition-colors',
                  browseMode === 'asset' ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Asset
              </button>
            </div>
          </div>

          {browseMode === 'date' ? (
            <>
              <div className="min-w-0">
                <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Date
                </label>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-label="Previous day"
                    onClick={() => setFocusDate((d) => addDaysYMD(d, -1))}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <Input
                    type="date"
                    className="h-8 w-[9.5rem]"
                    value={focusDate}
                    onChange={(e) => setFocusDate(e.target.value || today)}
                  />
                  <button
                    type="button"
                    aria-label="Next day"
                    onClick={() => setFocusDate((d) => addDaysYMD(d, 1))}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="min-w-[10rem] flex-1 sm:max-w-[14rem]">
                <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Search
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-8 pl-7"
                    placeholder="Filter assets…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="min-w-[10rem] flex-1 sm:max-w-[14rem]">
                <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Asset
                </label>
                <Select
                  value={parentId || '__none__'}
                  onChange={(v) => {
                    setUnitId('__all__')
                    onAssetChange(v === '__none__' ? '' : v)
                  }}
                  options={assetSelectOptions(assets)}
                />
              </div>
              <div className="min-w-[8rem] flex-1 sm:max-w-[12rem]">
                <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Unit
                </label>
                <Select
                  value={hasUnitChoices ? unitId : '__all__'}
                  onChange={(v) => {
                    setUnitId(v)
                    setPreferResources(true)
                  }}
                  disabled={!parentId || !hasUnitChoices}
                  options={
                    hasUnitChoices
                      ? unitOptions
                      : [{ value: '__all__', label: parentId ? 'No units on this asset' : 'Select an asset first' }]
                  }
                />
              </div>
            </>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-1">
            {browseMode === 'asset' && hasResources && (
              <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setPreferResources(true)}
                  className={cn(
                    'rounded px-2 py-1 transition-colors',
                    view === 'resources' ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  By {resourceNoun}
                </button>
                <button
                  type="button"
                  onClick={() => setPreferResources(false)}
                  className={cn(
                    'rounded px-2 py-1 transition-colors',
                    view === 'month' ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  Month
                </button>
              </div>
            )}
            {onBookRequest && (
              <Button
                size="sm"
                className="h-8 gap-1"
                disabled={browseMode === 'asset' && !parentId}
                onClick={bookFromToolbar}
              >
                <Plus className="h-3.5 w-3.5" />
                New booking
              </Button>
            )}
          </div>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/60 pt-1.5">
          {LEGEND.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className={cn('h-1.5 w-1.5 rounded-[2px]', l.tone)} />
              {l.label}
            </span>
          ))}
          {browseMode === 'date' && (
            <>
              <span className="hidden text-border sm:inline">|</span>
              {([
                ['all', 'All', counts.all],
                ['available', 'Available', counts.available],
                ['partial', 'Partial', counts.partial],
                ['booked', 'Booked', counts.booked],
                ['unavailable', 'Unavailable', counts.unavailable],
              ] as const).map(([key, label, count]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusChip(key)}
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[10px] transition-colors',
                    statusChip === key
                      ? 'border-primary/40 bg-primary/10 font-medium text-foreground'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                >
                  {label} · {count}
                </button>
              ))}
              <span className="text-[10px] text-muted-foreground sm:ml-auto">
                {formatCardDate(focusDate)}
                {dayFetching ? ' · loading…' : ''}
              </span>
            </>
          )}
          {browseMode === 'asset' && onBookRequest && parentId && (
            <span className="text-[10px] text-muted-foreground/80 sm:ml-auto">
              Free day → end day to book
            </span>
          )}
        </div>
      </div>

      {browseMode === 'date' ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {dayFetching && !dayData ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading availability…
            </div>
          ) : dayItems.length === 0 ? (
            <RentalEmptyState
              icon={CalendarDays}
              title="No matching assets for this date"
              description={
                search || statusChip !== 'all'
                  ? 'Try clearing search or status filters.'
                  : 'Nothing is listed for this day. Pick another date or switch to Asset browse.'
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {dayItems.map((item) => {
                const canBook = item.status === 'available' || item.status === 'partial'
                const nextLabel = formatNextAvailable(item.next_available_date, item.next_available_time, today)
                return (
                  <li
                    key={`${item.kind}-${item.id}`}
                    className="flex flex-wrap items-center gap-2 px-2.5 py-2 hover:bg-muted/30 sm:flex-nowrap"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {item.code ? `${item.code} · ` : ''}
                        {item.kind === 'unit' ? 'Unit' : item.kind === 'child' ? 'Sub-asset' : 'Asset'}
                        {` · ${item.available_capacity} left`}
                      </p>
                    </div>
                    <div className="min-w-0 sm:w-[11.5rem] sm:shrink-0">
                      {nextLabel ? (
                        <div className="flex items-start gap-1.5">
                          <Clock className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/80" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              Next available
                            </p>
                            <p className="truncate text-xs font-medium tabular-nums text-foreground">
                              {nextLabel}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">Not available</p>
                      )}
                    </div>
                    <div className="ml-auto flex flex-wrap items-center gap-1.5">
                      <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize', statusPillClass(item.status))}>
                        {item.status}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => openItemInAssetMode(item)}
                      >
                        Calendar
                      </Button>
                      {onBookRequest && (
                        <Button
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          disabled={!canBook || focusDate < today}
                          onClick={() => bookDayItem(item)}
                        >
                          Book
                        </Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : (
        <>
          {rangeAnchor && (
            <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border border-primary/25 bg-primary/5 px-2.5 py-1.5">
              <p className="text-xs text-foreground">
                <span className="font-medium">Selecting</span>
                <span className="text-muted-foreground"> · {rangeLabel}</span>
              </p>
              <div className="flex items-center gap-1.5">
                {rangeAnchor.date === (hoverDate || rangeAnchor.date) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => {
                      const res = rangeAnchor.resourceId
                        ? payload.resources.find((r) => r.id === rangeAnchor.resourceId) ?? null
                        : null
                      openBook(rangeAnchor.date, rangeAnchor.date, res)
                    }}
                  >
                    Book this day
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => { setRangeAnchor(null); setHoverDate(null) }}
                  className="inline-flex h-6 items-center gap-0.5 rounded px-1.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!parentId ? (
            <RentalEmptyState
              icon={CalendarDays}
              title="Choose an asset to see availability"
              description="Pick a rental asset above, or jump in from one of these. Or switch to Date browse to see what’s free on a day."
              action={
                topAssets.length > 0 ? (
                  <div className="flex max-w-lg flex-wrap justify-center gap-1.5">
                    {topAssets.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => onAssetChange(a.id)}
                        className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-muted/40"
                      >
                        {a.name}
                        {a.asset_code ? <span className="ml-1 text-muted-foreground">{a.asset_code}</span> : null}
                      </button>
                    ))}
                  </div>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between gap-2 border-b border-border px-2.5 py-1.5">
                <button
                  type="button"
                  onClick={goPrevMonth}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex min-w-0 flex-col items-center text-center">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-semibold text-foreground">
                      {MONTHS[cursor.month]} {cursor.year}
                    </h2>
                    {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    <button
                      type="button"
                      onClick={goTodayMonth}
                      className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      Today
                    </button>
                  </div>
                  <p className="max-w-full truncate text-[10px] text-muted-foreground">
                    {parentLabel}
                    {unitId !== '__all__' && selectedUnitLabel ? ` · ${selectedUnitLabel}` : hasResources ? ` · ${displayedResources.length} ${resourceNoun}${displayedResources.length === 1 ? '' : 's'}` : null}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={goNextMonth}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="p-2 sm:p-2.5">
                {hasResources && view === 'resources' ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-x-0.5 border-spacing-y-1">
                      <thead>
                        <tr>
                          <th className="sticky left-0 z-10 min-w-[6.5rem] bg-card pr-2 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {resourceNoun}
                          </th>
                          {monthDays.map((date) => {
                            const isToday = date === today
                            const weekend = new Date(`${date}T12:00:00`).getDay() % 6 === 0
                            return (
                              <th
                                key={date}
                                className={cn(
                                  'w-6 min-w-6 pb-0.5 text-center text-[10px] font-medium',
                                  isToday ? 'text-primary' : weekend ? 'text-muted-foreground/70' : 'text-muted-foreground',
                                )}
                              >
                                {Number(date.slice(-2))}
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {displayedResources.map((res) => {
                          const dayMap = new Map(res.days.map((d) => [d.date, d]))
                          const isSelected = unitId === res.id
                          return (
                            <tr key={res.id}>
                              <td className="sticky left-0 z-10 bg-card pr-2 align-middle">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUnitId(isSelected ? '__all__' : res.id)
                                    setPreferResources(true)
                                  }}
                                  className={cn(
                                    'max-w-[7.5rem] truncate rounded px-1 py-0.5 text-left text-xs transition-colors',
                                    isSelected
                                      ? 'bg-primary/10 font-semibold text-foreground'
                                      : 'text-foreground/85 hover:bg-muted',
                                  )}
                                  title={res.code ? `${res.label} (${res.code})` : res.label}
                                >
                                  {res.label}
                                </button>
                              </td>
                              {monthDays.map((date) => {
                                const info = dayMap.get(date)
                                const canBook = Boolean(
                                  onBookRequest
                                  && date >= today
                                  && info
                                  && (info.status === 'available' || info.status === 'partial'),
                                )
                                const selectedSpan = Boolean(
                                  rangeAnchor
                                  && rangeAnchor.resourceId === res.id
                                  && previewEnd
                                  && inDateSpan(date, rangeAnchor.date, previewEnd),
                                )
                                const isAnchor = rangeAnchor?.resourceId === res.id && rangeAnchor.date === date
                                const isToday = date === today
                                const title = info
                                  ? `${res.label} · ${date} · ${info.status.replace(/_/g, ' ')}${info.detail ? ` · ${info.detail}` : ''}`
                                  : `${res.label} · ${date}`
                                return (
                                  <td key={date} className="p-0 text-center align-middle">
                                    <button
                                      type="button"
                                      disabled={!onBookRequest}
                                      title={canBook ? `${title} — click to book` : title}
                                      onClick={() => handleDayClick(date, info?.status, res)}
                                      onMouseEnter={() => {
                                        if (rangeAnchor?.resourceId === res.id) setHoverDate(date)
                                      }}
                                      onMouseLeave={() => {
                                        if (rangeAnchor?.resourceId === res.id) setHoverDate(rangeAnchor.date)
                                      }}
                                      className={cn(
                                        'inline-flex h-6 w-6 items-center justify-center rounded transition-all',
                                        resourceCellTone(info?.status),
                                        canBook && 'cursor-pointer',
                                        !canBook && 'cursor-default opacity-90',
                                        isToday && 'outline outline-1 outline-offset-0 outline-foreground/25',
                                        (isAnchor || selectedSpan) && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
                                      )}
                                    />
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="grid grid-cols-7 gap-1">
                    {DOW.map((d) => (
                      <div key={d} className="py-0.5 text-center text-[10px] font-medium text-muted-foreground">{d}</div>
                    ))}
                    {cells.map(({ date, inMonth }) => {
                      const info = byDate.get(date)
                      const dayNum = Number(date.slice(-2))
                      const canBook = Boolean(
                        inMonth
                        && onBookRequest
                        && date >= today
                        && info
                        && (info.status === 'available' || info.status === 'partial'),
                      )
                      const selectedSpan = Boolean(
                        rangeAnchor
                        && !rangeAnchor.resourceId
                        && previewEnd
                        && inDateSpan(date, rangeAnchor.date, previewEnd),
                      )
                      const isAnchor = !rangeAnchor?.resourceId && rangeAnchor?.date === date
                      const isToday = date === today
                      return (
                        <button
                          key={date}
                          type="button"
                          disabled={!inMonth || !onBookRequest}
                          onClick={() => {
                            if (!inMonth) return
                            handleDayClick(date, info?.status, null)
                          }}
                          onMouseEnter={() => {
                            if (rangeAnchor && !rangeAnchor.resourceId) setHoverDate(date)
                          }}
                          onMouseLeave={() => {
                            if (rangeAnchor && !rangeAnchor.resourceId) setHoverDate(rangeAnchor.date)
                          }}
                          title={
                            info
                              ? `${date} · ${info.status.replace(/_/g, ' ')} · ${info.available_capacity} left${canBook ? ' — click to book' : ''}`
                              : date
                          }
                          className={cn(
                            'flex min-h-[3rem] flex-col items-center justify-center gap-0.5 rounded-md border text-xs transition-all',
                            inMonth ? dayCellTone(info?.status) : 'border-transparent bg-transparent text-muted-foreground/35',
                            canBook && 'cursor-pointer hover:brightness-[0.98]',
                            isToday && inMonth && 'ring-1 ring-foreground/20',
                            (isAnchor || selectedSpan) && inMonth && 'ring-2 ring-primary',
                          )}
                        >
                          <span className={cn('font-medium', isToday && inMonth && 'text-primary')}>{dayNum}</span>
                          {inMonth && info ? (
                            <span className="text-[10px] leading-none opacity-80">
                              {info.available_capacity} left
                            </span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
