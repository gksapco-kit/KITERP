import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, Factory } from 'lucide-react'
import { cn } from '@/lib/utils'

type POStatus = 'draft' | 'confirmed' | 'in_production' | 'qc' | 'completed' | 'on_hold' | 'cancelled'

export interface GanttOrder {
  id: string
  ref: string
  type: 'mto' | 'mts'
  status: POStatus
  progress: number
  created_at: string
  target_date: string
  customer_name?: string | null
}

interface ProductionScheduleGanttProps {
  orders: GanttOrder[]
  onSelectOrder: (id: string) => void
}

const DAY_MS = 24 * 60 * 60 * 1000
const VISIBLE_DAYS = 21
const ORDER_COL_W = 'w-[180px]'

const STATUS_BAR: Record<POStatus, string> = {
  draft: 'bg-gray-300 dark:bg-gray-600',
  confirmed: 'bg-blue-400 dark:bg-blue-500',
  in_production: 'bg-amber-400 dark:bg-amber-500',
  qc: 'bg-primary/70',
  completed: 'bg-green-500',
  on_hold: 'bg-orange-400',
  cancelled: 'bg-red-300 dark:bg-red-800',
}

const STATUS_LABEL: Record<POStatus, string> = {
  draft: 'Draft', confirmed: 'Confirmed', in_production: 'In Production',
  qc: 'QC Check', completed: 'Completed', on_hold: 'On Hold', cancelled: 'Cancelled',
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS)
}

export function ProductionScheduleGantt({ orders, onSelectOrder }: ProductionScheduleGanttProps) {
  const [anchor, setAnchor] = useState<Date>(() => {
    const d = startOfDay(new Date())
    d.setDate(d.getDate() - 3)
    return d
  })

  const days = useMemo(() => {
    return Array.from({ length: VISIBLE_DAYS }, (_, i) => {
      const d = new Date(anchor)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [anchor])

  const rows = useMemo(() => {
    return orders
      .filter(o => o.target_date && o.status !== 'cancelled')
      .map(o => {
        const target = startOfDay(new Date(o.target_date))
        const created = o.created_at ? startOfDay(new Date(o.created_at)) : target
        // Bars always span at least 1 day; if created_at is after target_date
        // (bad data) or missing, fall back to a 3-day bar ending on target.
        let start = created <= target ? created : new Date(target.getTime() - 2 * DAY_MS)
        const end = target
        if (o.status === 'completed') {
          // Completed orders: show the bar ending today or at target, whichever is earlier.
          start = created
        }
        return { order: o, start, end }
      })
      .sort((a, b) => a.end.getTime() - b.end.getTime())
  }, [orders])

  const windowStart = days[0]
  const windowEnd = days[days.length - 1]
  const todayOffset = daysBetween(windowStart, startOfDay(new Date()))
  const dayPct = 100 / VISIBLE_DAYS

  const visibleRows = rows.filter(r => r.end >= windowStart && r.start <= windowEnd)

  function shift(deltaDays: number) {
    setAnchor(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() + deltaDays)
      return d
    })
  }

  function goToday() {
    const d = startOfDay(new Date())
    d.setDate(d.getDate() - 3)
    setAnchor(d)
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            {windowStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            {' – '}
            {windowEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => shift(-7)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground" title="Previous week">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={goToday} className="text-xs font-medium px-2.5 py-1 rounded-lg border border-border hover:bg-accent">
            Today
          </button>
          <button onClick={() => shift(7)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground" title="Next week">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-border text-xs text-muted-foreground">
        {(Object.keys(STATUS_LABEL) as POStatus[]).filter(s => s !== 'cancelled').map(s => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={cn('w-2.5 h-2.5 rounded-sm', STATUS_BAR[s])} />
            {STATUS_LABEL[s]}
          </span>
        ))}
      </div>

      {visibleRows.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Factory className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm font-medium">No orders scheduled in this window</p>
          <p className="text-xs mt-1">Try navigating to a different week, or check your filters</p>
        </div>
      ) : (
        <div>
          {/* Day header */}
          <div className="flex border-b border-border bg-card">
            <div className={cn(ORDER_COL_W, 'shrink-0 px-3 py-2 text-xs font-bold text-muted-foreground uppercase')}>Order</div>
            <div className="flex flex-1 min-w-0">
              {days.map((d, i) => {
                const isToday = i === todayOffset
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex-1 min-w-0 text-center py-2 text-[10px] font-medium border-l border-border/50',
                      isToday ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground',
                    )}
                  >
                    <div>{d.toLocaleDateString('en-IN', { weekday: 'narrow' })}</div>
                    <div>{d.getDate()}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Rows */}
          {visibleRows.map(({ order, start, end }) => {
            const startOffset = Math.max(0, daysBetween(windowStart, start))
            const endOffset = Math.min(VISIBLE_DAYS, daysBetween(windowStart, end) + 1)
            const barLeftPct = startOffset * dayPct
            const barWidthPct = Math.max(dayPct, (endOffset - startOffset) * dayPct)
            return (
              <div key={order.id} className="flex items-center border-b border-border/60 hover:bg-muted/30 transition-colors">
                <button
                  onClick={() => onSelectOrder(order.id)}
                  className={cn(ORDER_COL_W, 'shrink-0 px-3 py-2.5 text-left')}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold text-foreground">{order.ref}</span>
                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', order.type === 'mto' ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700')}>
                      {order.type.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{order.customer_name || STATUS_LABEL[order.status]}</p>
                </button>
                <div className="relative flex-1 min-w-0" style={{ height: 36 }}>
                  {todayOffset >= 0 && todayOffset < VISIBLE_DAYS && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-primary/40"
                      style={{ left: `${todayOffset * dayPct}%` }}
                    />
                  )}
                  <button
                    onClick={() => onSelectOrder(order.id)}
                    title={`${order.ref} — ${STATUS_LABEL[order.status]} (${order.progress}%)`}
                    className={cn(
                      'absolute top-1.5 h-6 rounded-md shadow-sm flex items-center px-2 overflow-hidden transition-opacity hover:opacity-90',
                      STATUS_BAR[order.status],
                    )}
                    style={{ left: `${barLeftPct}%`, width: `${barWidthPct}%` }}
                  >
                    <div className="absolute inset-y-0 left-0 bg-black/15" style={{ width: `${order.progress}%` }} />
                    <span className="relative text-[10px] font-bold text-white truncate">{order.progress}%</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
