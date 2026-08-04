import type { RentalAsset, RentalBooking } from './rentalConstants'

/** Today's date as local yyyy-mm-dd (not UTC — avoids an IST day-behind bug near midnight). */
export function todayLocalYMD(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function addDaysYMD(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  dt.setDate(dt.getDate() + days)
  const yyyy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Normalize API/date values for `<input type="date" />` (yyyy-mm-dd). */
export function toDateInputValue(value?: string | null | Date): string {
  if (value == null || value === '') return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const yyyy = value.getFullYear()
    const mm = String(value.getMonth() + 1).padStart(2, '0')
    const dd = String(value.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  const raw = String(value).trim()
  // Accept already-normalized or ISO datetime values.
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (iso) return iso[1]
  // dd-mm-yyyy / dd/mm/yyyy (browser locale display leftovers)
  const dmy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (dmy) {
    const dd = dmy[1].padStart(2, '0')
    const mm = dmy[2].padStart(2, '0')
    return `${dmy[3]}-${mm}-${dd}`
  }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ''
  // Use UTC date parts for ISO-like strings to avoid timezone day-shift.
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    return raw.slice(0, 10)
  }
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Read display window from API/list payloads (snake or camel). */
export function pickDisplayDates(a: Partial<RentalAsset> & Record<string, unknown>) {
  const start = toDateInputValue(
    (a.display_start_date as string | null | undefined)
      ?? (a.displayStartDate as string | null | undefined)
      ?? (a.start_date as string | null | undefined)
      ?? null,
  )
  const end = toDateInputValue(
    (a.display_end_date as string | null | undefined)
      ?? (a.displayEndDate as string | null | undefined)
      ?? (a.end_date as string | null | undefined)
      ?? null,
  )
  return { start, end }
}

/** Local-safe date label for cards (avoids UTC day-shift on yyyy-mm-dd). */
export function formatCardDate(value?: string | null) {
  const iso = toDateInputValue(value)
  if (!iso) return null
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function assetCardAvailability(
  asset: RentalAsset,
  bookings: RentalBooking[],
): { kind: 'range' | 'always'; label: string; detail?: string } {
  const { start, end } = pickDisplayDates(asset as RentalAsset & Record<string, unknown>)
  const startLabel = formatCardDate(start)
  const endLabel = formatCardDate(end)
  if (startLabel || endLabel) {
    return {
      kind: 'range',
      label: 'Date range',
      detail: `${startLabel || '…'} → ${endLabel || '…'}`,
    }
  }
  // Fall back to approved booking windows so the card still shows dates.
  const locked = new Set(['approved', 'confirmed', 'active'])
  const related = bookings.filter((b) => b.asset_id === asset.id && locked.has(b.status))
  if (related.length > 0) {
    const starts = related.map((b) => toDateInputValue(b.start_date)).filter(Boolean).sort()
    const ends = related.map((b) => toDateInputValue(b.end_date)).filter(Boolean).sort()
    const from = formatCardDate(starts[0])
    const to = formatCardDate(ends[ends.length - 1])
    return {
      kind: 'range',
      label: 'Booked period',
      detail: `${from || '…'} → ${to || '…'}`,
    }
  }
  return { kind: 'always', label: 'Always available' }
}
