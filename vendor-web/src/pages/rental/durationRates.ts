/** Flexible minute/hour duration slots for rental assets. */

export type DurationRate = { minutes: number; rate: number }
export type DurationRateRow = { minutes: number; rate: string }

export const DURATION_PRESETS: { minutes: number; label: string }[] = [
  { minutes: 15, label: '15 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 45, label: '45 min' },
  { minutes: 60, label: '1 hour' },
  { minutes: 120, label: '2 hours' },
  { minutes: 180, label: '3 hours' },
  { minutes: 240, label: '4 hours' },
  { minutes: 480, label: '8 hours' },
]

export function durationPlanId(minutes: number): string {
  if (minutes === 1) return 'per_minute'
  if (minutes === 60) return 'hourly'
  return `dur_${minutes}`
}

export function parseDurationPlanMinutes(plan: string): number | null {
  const p = (plan || '').toLowerCase()
  if (p === 'per_minute') return 1
  if (p === 'hourly') return 60
  const m = /^dur_(\d+)$/.exec(p)
  return m ? Number(m[1]) : null
}

export function formatDurationLabel(minutes: number): string {
  if (minutes <= 0) return ''
  if (minutes % 60 === 0) {
    const h = minutes / 60
    return h === 1 ? 'Hourly' : `${h} hours`
  }
  return minutes === 1 ? 'Per minute' : `${minutes} min`
}

export function formatDurationSuffix(minutes: number): string {
  if (minutes <= 0) return ''
  if (minutes % 60 === 0) {
    const h = minutes / 60
    return h === 1 ? 'hr' : `${h}h`
  }
  return minutes === 1 ? 'min' : `${minutes}m`
}

export function splitDuration(minutes: number): { qty: number; unit: 'minutes' | 'hours' } {
  if (minutes >= 60 && minutes % 60 === 0) return { qty: minutes / 60, unit: 'hours' }
  return { qty: minutes, unit: 'minutes' }
}

export function combineDuration(qty: number, unit: 'minutes' | 'hours'): number {
  const n = Number(qty)
  if (!Number.isFinite(n) || n <= 0) return 1
  return Math.max(1, Math.round(unit === 'hours' ? n * 60 : n))
}

export function normalizeDurationRates(
  raw: unknown,
  hourlyRate = 0,
  perMinuteRate = 0,
): DurationRate[] {
  const rows: DurationRate[] = []
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const rec = item as Record<string, unknown>
      const minutes = Number(rec.minutes)
      const rate = Number(rec.rate)
      if (Number.isFinite(minutes) && minutes > 0 && Number.isFinite(rate) && rate > 0) {
        rows.push({ minutes: Math.round(minutes), rate })
      }
    }
  }
  if (rows.length === 0) {
    if (perMinuteRate > 0) rows.push({ minutes: 1, rate: perMinuteRate })
    if (hourlyRate > 0) rows.push({ minutes: 60, rate: hourlyRate })
  }
  const byMin = new Map<number, DurationRate>()
  for (const row of rows) byMin.set(row.minutes, row)
  return [...byMin.values()].sort((a, b) => a.minutes - b.minutes)
}

export function durationRowsFromAsset(a: {
  duration_rates?: unknown
  hourly_rate?: number | string
  per_minute_rate?: number | string
}): DurationRateRow[] {
  return normalizeDurationRates(
    a.duration_rates,
    Number(a.hourly_rate || 0),
    Number(a.per_minute_rate || 0),
  ).map((r) => ({ minutes: r.minutes, rate: String(r.rate) }))
}

export function durationRatesForSave(rows: DurationRateRow[] | undefined): DurationRate[] {
  const byMin = new Map<number, DurationRate>()
  for (const row of rows || []) {
    const minutes = Math.round(Number(row.minutes) || 0)
    const rate = Number(row.rate)
    if (minutes > 0 && Number.isFinite(rate) && rate > 0) {
      byMin.set(minutes, { minutes, rate })
    }
  }
  return [...byMin.values()].sort((a, b) => a.minutes - b.minutes)
}

export function durationLegacyRates(rows: DurationRateRow[] | DurationRate[]): {
  hourly_rate: number
  per_minute_rate: number
} {
  const hour = rows.find((r) => r.minutes === 60)
  const min = rows.find((r) => r.minutes === 1)
  return {
    hourly_rate: Number(hour?.rate || 0) || 0,
    per_minute_rate: Number(min?.rate || 0) || 0,
  }
}

export function durationRateForPlan(
  rows: DurationRate[] | undefined,
  plan: string,
  hourlyRate = 0,
  perMinuteRate = 0,
): { minutes: number; rate: number } | null {
  const minutes = parseDurationPlanMinutes(plan)
  if (!minutes) return null
  const list = rows?.length ? rows : normalizeDurationRates([], hourlyRate, perMinuteRate)
  const found = list.find((r) => r.minutes === minutes)
  if (found) return found
  if (minutes === 60 && hourlyRate > 0) return { minutes: 60, rate: hourlyRate }
  if (minutes === 1 && perMinuteRate > 0) return { minutes: 1, rate: perMinuteRate }
  return null
}
