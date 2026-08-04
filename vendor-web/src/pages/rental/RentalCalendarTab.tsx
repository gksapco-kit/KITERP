import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Select } from '@/components/ui/select'
import { rentalApi } from './api'
import { RentalEmptyState } from './RentalPrimitives'
import type { RentalAsset } from './rentalConstants'

type CalendarDay = { date: string; status: string; reserved_qty: number; available_capacity: number }

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
  return 'bg-muted/30 text-muted-foreground/70 border-transparent'
}

const LEGEND = [
  { label: 'Available', tone: 'bg-emerald-500/60' },
  { label: 'Partially booked', tone: 'bg-amber-500/70' },
  { label: 'Fully booked', tone: 'bg-rose-500/70' },
  { label: 'No data', tone: 'bg-muted' },
]

type Props = {
  assets: RentalAsset[]
  assetId: string
  onAssetChange: (id: string) => void
}

export default function RentalCalendarTab({ assets, assetId, onAssetChange }: Props) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  const monthStart = ymd(cursor.year, cursor.month, 1)
  const lastDay = new Date(cursor.year, cursor.month + 1, 0).getDate()
  const monthEnd = ymd(cursor.year, cursor.month, lastDay)

  const { data: calendarDays = [], isFetching } = useQuery({
    queryKey: ['rental-calendar', assetId, monthStart, monthEnd],
    queryFn: () => rentalApi.calendar(assetId, monthStart, monthEnd),
    enabled: !!assetId,
  })

  const byDate = useMemo(() => {
    const m = new Map<string, CalendarDay>()
    for (const d of calendarDays as CalendarDay[]) m.set(d.date, d)
    return m
  }, [calendarDays])

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

  const goPrev = () => setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }))
  const goNext = () => setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }))
  const goToday = () => { const n = new Date(); setCursor({ year: n.getFullYear(), month: n.getMonth() }) }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px]">
          <label className="text-xs text-muted-foreground">Select asset</label>
          <Select
            value={assetId || '__none__'}
            onChange={(v) => onAssetChange(v === '__none__' ? '' : v)}
            options={[
              { value: '__none__', label: 'Choose an asset…' },
              ...assets.map((a) => ({ value: a.id, label: `${a.name}${a.asset_code ? ` (${a.asset_code})` : ''}` })),
            ]}
          />
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border bg-muted/20 px-1 py-1">
          {LEGEND.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${l.tone}`} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {!assetId ? (
        <RentalEmptyState icon={CalendarDays} title="Select an asset to view its availability calendar" />
      ) : (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={goPrev} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{MONTHS[cursor.month]} {cursor.year}</span>
              {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              <button type="button" onClick={goToday} className="text-xs text-primary hover:underline">Today</button>
            </div>
            <button type="button" onClick={goNext} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {DOW.map((d) => (
              <div key={d} className="py-1 text-center text-xs font-medium text-muted-foreground">{d}</div>
            ))}
            {cells.map(({ date, inMonth }) => {
              const info = byDate.get(date)
              const dayNum = Number(date.slice(-2))
              return (
                <div
                  key={date}
                  title={
                    info
                      ? `${date} · ${info.status.replace(/_/g, ' ')} · reserved ${info.reserved_qty} · available ${info.available_capacity}`
                      : date
                  }
                  className={`flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-md border text-xs ${
                    inMonth ? dayCellTone(info?.status) : 'border-transparent bg-transparent text-muted-foreground/40'
                  }`}
                >
                  <span className="font-medium">{dayNum}</span>
                  {inMonth && info ? (
                    <span className="text-[10px] leading-none opacity-80">{info.available_capacity} left</span>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
