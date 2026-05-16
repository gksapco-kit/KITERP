import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  fromDate: string   // 'YYYY-MM-DD'
  toDate:   string
  maxDate?: string   // 'YYYY-MM-DD'  (defaults to today)
  onChange: (from: string, to: string) => void
}

const DAYS   = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']

function toYMD(d: Date) {
  return d.toISOString().slice(0, 10)
}
function parseYMD(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function sameDay(a: string, b: string) { return a === b }
function inRange(day: string, from: string, to: string) {
  return day > from && day < to
}

export function DateRangePicker({ fromDate, toDate, maxDate, onChange }: Props) {
  const today   = toYMD(new Date())
  const max     = maxDate ?? today

  // calendar cursor (year + month being displayed)
  const [cursor, setCursor] = useState<Date>(() => {
    return fromDate ? parseYMD(fromDate) : new Date()
  })

  // picking state: null = pick start, 'from' = from chosen, pick end
  const [picking, setPicking] = useState<'from' | null>(fromDate ? 'from' : null)
  const [hovered, setHovered] = useState<string | null>(null)

  const year  = cursor.getFullYear()
  const month = cursor.getMonth()

  // all calendar cells (may include padding from prev/next month)
  function buildGrid() {
    const first   = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0).getDate()
    const startDow = first.getDay()          // 0 = Sunday
    const cells: Array<{ date: string; cur: boolean }> = []

    // pad from previous month
    const prevLast = new Date(year, month, 0).getDate()
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevLast - i)
      cells.push({ date: toYMD(d), cur: false })
    }
    for (let d = 1; d <= lastDay; d++) {
      cells.push({ date: toYMD(new Date(year, month, d)), cur: true })
    }
    // pad to complete last row
    const remaining = (7 - (cells.length % 7)) % 7
    for (let d = 1; d <= remaining; d++) {
      cells.push({ date: toYMD(new Date(year, month + 1, d)), cur: false })
    }
    return cells
  }

  function handleDayClick(day: string) {
    if (day > max) return

    if (!picking || picking === null) {
      // first click → set from, start picking end
      onChange(day, day)
      setPicking('from')
      return
    }

    // second click → set range
    if (day < fromDate) {
      onChange(day, fromDate)
    } else {
      onChange(fromDate, day)
    }
    setPicking(null)
    setHovered(null)
  }

  function handleDayHover(day: string) {
    if (picking === 'from') setHovered(day)
  }

  const effectiveTo = picking === 'from' && hovered ? hovered : toDate

  function prevMonth() {
    setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1))
  }
  function nextMonth() {
    setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1))
  }

  const cells = buildGrid()
  const canGoNext = toYMD(new Date(year, month + 1, 1)) <= max

  return (
    <div className="select-none w-72">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prevMonth}
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-gray-800">
          {MONTHS[month]} {year}
        </span>
        <button type="button" onClick={nextMonth} disabled={!canGoNext}
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 disabled:opacity-30 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map(({ date, cur }) => {
          const isFrom      = sameDay(date, fromDate)
          const isTo        = effectiveTo && sameDay(date, effectiveTo)
          const isInRange   = fromDate && effectiveTo && inRange(date, fromDate, effectiveTo)
          const isToday     = sameDay(date, today)
          const isPast      = date > max
          const isStart     = isFrom
          const isEnd       = isTo && date !== fromDate
          const isRangeEdge = isFrom || isTo

          let cellCls = 'relative flex items-center justify-center h-8 text-xs cursor-pointer transition-colors '

          // range highlight strip
          if (isInRange) {
            cellCls += 'bg-blue-100 '
          } else if (isRangeEdge && fromDate !== effectiveTo) {
            cellCls += isStart ? 'bg-gradient-to-r from-transparent to-blue-100 '
                                : 'bg-gradient-to-l from-transparent to-blue-100 '
          }

          let dotCls = 'w-8 h-8 flex items-center justify-center rounded-full text-xs font-medium z-10 '

          if (isFrom || isTo) {
            dotCls += 'bg-primary text-white font-semibold '
          } else if (isInRange) {
            dotCls += 'text-blue-800 hover:bg-blue-200 '
          } else if (!cur) {
            dotCls += 'text-gray-300 '
          } else if (isPast) {
            dotCls += 'text-gray-300 cursor-not-allowed '
          } else if (isToday) {
            dotCls += 'text-blue-600 font-semibold border border-blue-300 hover:bg-blue-50 '
          } else {
            dotCls += 'text-gray-700 hover:bg-gray-100 '
          }

          return (
            <div key={date} className={cellCls}
              onClick={() => !isPast && cur && handleDayClick(date)}
              onMouseEnter={() => handleDayHover(date)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className={dotCls}>{new Date(date + 'T00:00:00').getDate()}</span>
            </div>
          )
        })}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t">
        <button type="button"
          onClick={() => { onChange('', ''); setPicking(null) }}
          className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors">
          Clear
        </button>

        <div className="text-xs text-gray-500">
          {picking === 'from'
            ? <span className="text-blue-600">Click end date…</span>
            : fromDate && toDate
              ? <span>{fromDate === toDate ? fromDate : `${fromDate} → ${toDate}`}</span>
              : <span>Click start date</span>
          }
        </div>

        <button type="button"
          onClick={() => { onChange(today, today); setPicking(null) }}
          className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors">
          Today
        </button>
      </div>
    </div>
  )
}
