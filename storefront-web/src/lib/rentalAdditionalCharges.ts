/** Named additional charges: amount or % of a chosen basis, shown independently or together. */

export type AdditionalChargeType = 'amount' | 'percent'
export type AdditionalChargeShowMode = 'independent' | 'together'
export type AdditionalChargePercentOf = 'rental' | 'running' | 'grand' | 'deposit'

export type AdditionalCharge = {
  id: string
  name: string
  description: string
  charge_type: AdditionalChargeType
  show_mode: AdditionalChargeShowMode
  percent_of: AdditionalChargePercentOf
  value: number
}

export type ChargeBasis = {
  rental: number
  extra?: number
  deposit?: number
}

export const PERCENT_OF_OPTIONS: { value: AdditionalChargePercentOf; label: string }[] = [
  { value: 'rental', label: 'Rental' },
  { value: 'running', label: 'Rental + extras' },
  { value: 'grand', label: 'Total + deposit' },
  { value: 'deposit', label: 'Deposit' },
]

function parseChargeType(raw: unknown): AdditionalChargeType {
  return String(raw || '').toLowerCase() === 'percent' ? 'percent' : 'amount'
}

function parseShowMode(raw: unknown): AdditionalChargeShowMode {
  return String(raw || '').toLowerCase() === 'independent' ? 'independent' : 'together'
}

function parsePercentOf(raw: unknown): AdditionalChargePercentOf {
  const v = String(raw || '').toLowerCase()
  if (v === 'running' || v === 'grand' || v === 'deposit') return v
  return 'rental'
}

export function percentOfLabel(percentOf: AdditionalChargePercentOf | undefined): string {
  return PERCENT_OF_OPTIONS.find((o) => o.value === (percentOf || 'rental'))?.label || 'Rental'
}

function percentBase(basis: ChargeBasis, percentOf: AdditionalChargePercentOf): number {
  const rental = Number(basis.rental) || 0
  const extra = Number(basis.extra) || 0
  const deposit = Number(basis.deposit) || 0
  if (percentOf === 'running') return rental + extra
  if (percentOf === 'grand') return rental + extra + deposit
  if (percentOf === 'deposit') return deposit
  return rental
}

export function normalizeAdditionalCharges(raw: unknown): AdditionalCharge[] {
  if (!Array.isArray(raw)) return []
  const rows: AdditionalCharge[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const name = String(rec.name || '').trim()
    if (!name) continue
    const value = Number(rec.value)
    if (!Number.isFinite(value) || value <= 0) continue
    const chargeType = parseChargeType(rec.charge_type)
    rows.push({
      id: String(rec.id || '').trim() || `${name}-${rows.length}`,
      name: name.slice(0, 120),
      description: String(rec.description || '').trim().slice(0, 500),
      charge_type: chargeType,
      show_mode: parseShowMode(rec.show_mode),
      percent_of: parsePercentOf(rec.percent_of),
      value: chargeType === 'percent' ? Math.min(100, value) : value,
    })
  }
  return rows
}

export function additionalChargeAmount(
  charge: Pick<AdditionalCharge, 'charge_type' | 'value' | 'percent_of'>,
  basis: ChargeBasis,
): number {
  if (charge.charge_type !== 'percent') {
    return Math.round(charge.value * 100) / 100
  }
  const extra = percentBase(basis, charge.percent_of || 'rental') * (charge.value / 100)
  return Math.round(extra * 100) / 100
}

export function chargeLineAmounts(
  rental: number,
  charges: AdditionalCharge[],
  deposit = 0,
): { charge: AdditionalCharge; amount: number }[] {
  let extra = 0
  return charges.map((charge) => {
    const amount = additionalChargeAmount(charge, { rental, extra, deposit })
    extra += amount
    return { charge, amount }
  })
}

export function chargesForEstimate(
  charges: AdditionalCharge[],
  selectedIndependentIds: string[] | 'all' = 'all',
): AdditionalCharge[] {
  return charges.filter((charge) => {
    if (charge.show_mode !== 'independent') return true
    if (selectedIndependentIds === 'all') return true
    return selectedIndependentIds.includes(charge.id) || selectedIndependentIds.includes(charge.name)
  })
}

export function applyAdditionalCharges(
  rental: number,
  raw: unknown,
  selectedIndependentIds: string[] | 'all' = 'all',
  deposit = 0,
): number {
  const charges = chargesForEstimate(normalizeAdditionalCharges(raw), selectedIndependentIds)
  const extra = chargeLineAmounts(rental, charges, deposit).reduce((sum, line) => sum + line.amount, 0)
  return Math.round((rental + extra) * 100) / 100
}

export function formatAdditionalChargeValue(
  charge: Pick<AdditionalCharge, 'charge_type' | 'value' | 'percent_of'>,
  symbol = '',
): string {
  if (charge.charge_type === 'percent') {
    const body = Number.isInteger(charge.value) ? String(charge.value) : charge.value.toFixed(2)
    return `${body}% of ${percentOfLabel(charge.percent_of).toLowerCase()}`
  }
  const body = Number.isInteger(charge.value) ? String(charge.value) : charge.value.toFixed(2)
  return symbol ? `${symbol}${body}` : body
}

export function splitAdditionalCharges(charges: AdditionalCharge[]) {
  return {
    independent: charges.filter((c) => c.show_mode === 'independent'),
    together: charges.filter((c) => c.show_mode !== 'independent'),
  }
}
