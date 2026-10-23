/**
 * Cutting yield maths. A factor is the raw input for 1 unit of output:
 * boneless chicken 1.30 → 1.30 kg raw gives 1 kg to the customer.
 * Mirrors backend/app/services/yield_service.py.
 */

const round4 = (n: number) => Math.round(n * 10000) / 10000

/** Raw input to cut for the output the customer asked for, rounded up to the weigh-out step. */
export function rawInputFor(output: number, factor: number, step?: number | null): number {
  if (!(output > 0) || !(factor > 0)) return 0
  const raw = output * factor
  if (step && step > 0) return round4(Math.ceil(raw / step - 1e-9) * step)
  return round4(raw)
}

/** Output the raw stock on hand can give for a cut. */
export function outputFrom(raw: number, factor: number): number {
  if (!(raw > 0) || !(factor > 0)) return 0
  return round4(raw / factor)
}

/** 1.30 → 76.9 (% of the raw weight that reaches the customer). */
export function yieldPercent(factor: number | null | undefined): number | null {
  if (!factor || factor <= 0) return null
  return Math.round((100 / factor) * 10) / 10
}

export type CarcassOrderLine = {
  cut: string
  /** Amount of this cut that 1 kg of raw chicken yields. */
  perRaw: number
  perRawUom: string
  orderQty: number
}

export type CarcassOrderResult = {
  /** Raw chicken required so every ordered cut is covered by the same birds. */
  rawKg: number
  limitingCut: string | null
  lines: Array<CarcassOrderLine & { rawKg: number; produced: number; leftover: number }>
}

/**
 * One carcass supplies every cut. Raw chicken is the largest line
 * (order ÷ yield from 1 kg raw), and the other cuts are leftover from that bird.
 */
export function carcassRaw(lines: CarcassOrderLine[]): CarcassOrderResult {
  const detailed = lines.map((line) => {
    const rawKg = line.orderQty > 0 && line.perRaw > 0 ? round4(line.orderQty / line.perRaw) : 0
    return { ...line, rawKg, produced: 0, leftover: 0 }
  })
  const rawKg = detailed.reduce((max, line) => Math.max(max, line.rawKg), 0)
  const limiting = detailed.find((line) => line.rawKg > 0 && Math.abs(line.rawKg - rawKg) < 0.0001)
  for (const line of detailed) {
    line.produced = line.perRaw > 0 ? round4(rawKg * line.perRaw) : 0
    line.leftover = round4(Math.max(0, line.produced - line.orderQty))
  }
  return { rawKg, limitingCut: limiting?.cut ?? null, lines: detailed }
}

/** Effective cost of 1 unit of output: raw cost × factor. */
export function costPerOutput(rawCost: number | null | undefined, factor: number | null | undefined): number | null {
  if (!rawCost || rawCost <= 0 || !factor || factor <= 0) return null
  return Math.round(rawCost * factor * 100) / 100
}

export function formatQty(value: number | null | undefined, uom = 'kg'): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const digits = uom === 'kg' || uom === 'l' ? 3 : 2
  return `${Number(value.toFixed(digits)).toLocaleString('en-IN', { maximumFractionDigits: digits })} ${uom}`
}

export function formatMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
