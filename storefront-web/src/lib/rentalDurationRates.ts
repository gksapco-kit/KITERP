export type DurationRate = { minutes: number; rate: number }
export type PeriodRate = { days: number; rate: number }

export function durationPlanId(minutes: number): string {
  if (minutes === 1) return 'per_minute'
  if (minutes === 60) return 'hourly'
  return `dur_${minutes}`
}

export function periodPlanId(days: number): string {
  if (days === 1) return 'daily'
  if (days === 7) return 'weekly'
  if (days === 30) return 'monthly'
  if (days === 365) return 'yearly'
  return `per_${days}`
}

export function parseDurationPlanMinutes(plan: string): number | null {
  const p = (plan || '').toLowerCase()
  if (p === 'per_minute') return 1
  if (p === 'hourly') return 60
  const m = /^dur_(\d+)$/.exec(p)
  return m ? Number(m[1]) : null
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
  return `${days} days`
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

export function durationRateForPlan(
  rows: DurationRate[] | undefined,
  plan: string,
  hourlyRate = 0,
  perMinuteRate = 0,
): DurationRate | null {
  const minutes = parseDurationPlanMinutes(plan)
  if (!minutes) return null
  const list = rows?.length ? rows : normalizeDurationRates([], hourlyRate, perMinuteRate)
  return list.find((r) => r.minutes === minutes)
    || (minutes === 60 && hourlyRate > 0 ? { minutes: 60, rate: hourlyRate } : null)
    || (minutes === 1 && perMinuteRate > 0 ? { minutes: 1, rate: perMinuteRate } : null)
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

export type PricingAsset = {
  daily_rate?: number
  weekly_rate?: number
  monthly_rate?: number
  yearly_rate?: number
  hourly_rate?: number
  per_minute_rate?: number
  duration_rates?: DurationRate[]
  period_rates?: PeriodRate[]
}

export type StorefrontRateOption = {
  plan: string
  rate: number
  label: string
  suffix: string
}

/** All configured storefront plans, matching vendor asset pricing. */
export function storefrontRateOptions(asset: PricingAsset): StorefrontRateOption[] {
  const periodic = normalizePeriodRates(
    asset.period_rates,
    Number(asset.daily_rate || 0),
    Number(asset.weekly_rate || 0),
    Number(asset.monthly_rate || 0),
    Number(asset.yearly_rate || 0),
  ).map((s) => ({
    plan: periodPlanId(s.days),
    rate: s.rate,
    label: formatPeriodLabel(s.days),
    suffix: formatPeriodSuffix(s.days),
  }))

  const duration = normalizeDurationRates(
    asset.duration_rates,
    Number(asset.hourly_rate || 0),
    Number(asset.per_minute_rate || 0),
  ).map((s) => ({
    plan: durationPlanId(s.minutes),
    rate: s.rate,
    label: formatDurationLabel(s.minutes),
    suffix: formatDurationSuffix(s.minutes),
  }))

  return [...periodic, ...duration]
}

export function primaryStorefrontRate(asset: PricingAsset): StorefrontRateOption | null {
  return storefrontRateOptions(asset)[0] ?? null
}
