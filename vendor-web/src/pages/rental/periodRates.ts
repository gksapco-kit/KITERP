/** Flexible day/week/month/year period slots for rental assets. */

export type PeriodUnit = 'days' | 'weeks' | 'months' | 'years'

export type PeriodRate = { days: number; rate: number }
export type PeriodRateRow = { days: number; rate: string }

export const PERIOD_UNIT_OPTIONS: { value: PeriodUnit; label: string }[] = [
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
  { value: 'months', label: 'Months' },
  { value: 'years', label: 'Years' },
]

export const PERIOD_PRESETS: { days: number; label: string }[] = [
  { days: 1, label: '1 day' },
  { days: 3, label: '3 days' },
  { days: 7, label: '1 week' },
  { days: 14, label: '2 weeks' },
  { days: 30, label: '1 month' },
  { days: 90, label: '3 months' },
  { days: 365, label: '1 year' },
]

const UNIT_DAYS: Record<PeriodUnit, number> = {
  days: 1,
  weeks: 7,
  months: 30,
  years: 365,
}

export function periodPlanId(days: number): string {
  if (days === 1) return 'daily'
  if (days === 7) return 'weekly'
  if (days === 30) return 'monthly'
  if (days === 365) return 'yearly'
  return `per_${days}`
}

export function parsePeriodPlanDays(plan: string): number | null {
  const p = (plan || '').toLowerCase()
  if (p === 'daily') return 1
  if (p === 'weekly') return 7
  if (p === 'monthly') return 30
  if (p === 'yearly') return 365
  const m = /^per_(\d+)$/.exec(p)
  return m ? Number(m[1]) : null
}

export function formatPeriodLabel(days: number): string {
  if (days <= 0) return ''
  if (days === 1) return 'Daily'
  if (days === 7) return 'Weekly'
  if (days === 30) return 'Monthly'
  if (days === 365) return 'Yearly'
  if (days % 365 === 0) {
    const y = days / 365
    return y === 1 ? 'Yearly' : `${y} years`
  }
  if (days % 30 === 0) {
    const mo = days / 30
    return mo === 1 ? 'Monthly' : `${mo} months`
  }
  if (days % 7 === 0) {
    const w = days / 7
    return w === 1 ? 'Weekly' : `${w} weeks`
  }
  return days === 1 ? 'Daily' : `${days} days`
}

export function formatPeriodSuffix(days: number): string {
  if (days <= 0) return ''
  if (days === 1) return 'day'
  if (days === 7) return 'week'
  if (days === 30) return 'mo'
  if (days === 365) return 'yr'
  if (days % 365 === 0) {
    const y = days / 365
    return y === 1 ? 'yr' : `${y}yr`
  }
  if (days % 30 === 0) {
    const mo = days / 30
    return mo === 1 ? 'mo' : `${mo}mo`
  }
  if (days % 7 === 0) {
    const w = days / 7
    return w === 1 ? 'week' : `${w}w`
  }
  return `${days}d`
}

export function splitPeriod(days: number): { qty: number; unit: PeriodUnit } {
  if (days >= 365 && days % 365 === 0) return { qty: days / 365, unit: 'years' }
  if (days >= 30 && days % 30 === 0) return { qty: days / 30, unit: 'months' }
  if (days >= 7 && days % 7 === 0) return { qty: days / 7, unit: 'weeks' }
  return { qty: Math.max(1, days), unit: 'days' }
}

export function combinePeriod(qty: number, unit: PeriodUnit): number {
  const n = Number(qty)
  if (!Number.isFinite(n) || n <= 0) return 1
  return Math.max(1, Math.round(n * UNIT_DAYS[unit]))
}

export function normalizePeriodRates(
  raw: unknown,
  daily = 0,
  weekly = 0,
  monthly = 0,
  yearly = 0,
): PeriodRate[] {
  const rows: PeriodRate[] = []
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const rec = item as Record<string, unknown>
      const days = Number(rec.days)
      const rate = Number(rec.rate)
      if (Number.isFinite(days) && days > 0 && Number.isFinite(rate) && rate > 0) {
        rows.push({ days: Math.round(days), rate })
      }
    }
  }
  if (rows.length === 0) {
    if (daily > 0) rows.push({ days: 1, rate: daily })
    if (weekly > 0) rows.push({ days: 7, rate: weekly })
    if (monthly > 0) rows.push({ days: 30, rate: monthly })
    if (yearly > 0) rows.push({ days: 365, rate: yearly })
  }
  const byDays = new Map<number, PeriodRate>()
  for (const row of rows) byDays.set(row.days, row)
  return [...byDays.values()].sort((a, b) => a.days - b.days)
}

export function periodRowsFromAsset(a: {
  period_rates?: unknown
  daily_rate?: number | string
  weekly_rate?: number | string
  monthly_rate?: number | string
  yearly_rate?: number | string
}): PeriodRateRow[] {
  return normalizePeriodRates(
    a.period_rates,
    Number(a.daily_rate || 0),
    Number(a.weekly_rate || 0),
    Number(a.monthly_rate || 0),
    Number(a.yearly_rate || 0),
  ).map((r) => ({ days: r.days, rate: String(r.rate) }))
}

export function periodRatesForSave(rows: PeriodRateRow[] | undefined): PeriodRate[] {
  const byDays = new Map<number, PeriodRate>()
  for (const row of rows || []) {
    const days = Math.round(Number(row.days) || 0)
    const rate = Number(row.rate)
    if (days > 0 && Number.isFinite(rate) && rate > 0) {
      byDays.set(days, { days, rate })
    }
  }
  return [...byDays.values()].sort((a, b) => a.days - b.days)
}

export function periodLegacyRates(rows: PeriodRateRow[] | PeriodRate[]): {
  daily_rate: number
  weekly_rate: number
  monthly_rate: number
  yearly_rate: number
} {
  const find = (days: number) => Number(rows.find((r) => r.days === days)?.rate || 0) || 0
  return {
    daily_rate: find(1),
    weekly_rate: find(7),
    monthly_rate: find(30),
    yearly_rate: find(365),
  }
}

export function periodRateForPlan(
  rows: PeriodRate[] | undefined,
  plan: string,
  legacy?: { daily?: number; weekly?: number; monthly?: number; yearly?: number },
): PeriodRate | null {
  const days = parsePeriodPlanDays(plan)
  if (!days) return null
  const list = rows?.length
    ? rows
    : normalizePeriodRates(
        [],
        Number(legacy?.daily || 0),
        Number(legacy?.weekly || 0),
        Number(legacy?.monthly || 0),
        Number(legacy?.yearly || 0),
      )
  return list.find((r) => r.days === days) || null
}
