/**
 * Conversion of a variant's selling unit into the product's stock UOM.
 * Mirrors backend/app/services/shared_stock.py so the form can preview what the server will do.
 */

/** How many kilograms one of this unit is. */
const WEIGHT_PER_KG: Record<string, number> = {
  kg: 1, kilogram: 1, g: 0.001, gram: 0.001, grams: 0.001,
  mg: 0.000001, milligram: 0.000001, mcg: 0.000000001,
  tonne: 1000, quintal: 100, oz: 0.0283495, lb: 0.453592,
}

/** How many litres one of this unit is. */
const VOLUME_PER_L: Record<string, number> = {
  l: 1, litre: 1, liter: 1, kl: 1000, dl: 0.1, cl: 0.01, ml: 0.001, mcl: 0.000001,
  cubic_cm: 0.001, cubic_m: 1000, fl_oz: 0.0295735, pt: 0.473176, qt: 0.946353, gal: 3.78541,
}

export type UomDimension = 'weight' | 'volume' | 'count'

export function normalizeUom(uom: string | null | undefined): string {
  return String(uom ?? '').toLowerCase().trim().replace(/\s+/g, '_')
}

export function uomDimension(uom: string | null | undefined): UomDimension {
  const key = normalizeUom(uom)
  if (key in WEIGHT_PER_KG) return 'weight'
  if (key in VOLUME_PER_L) return 'volume'
  return 'count'
}

const round4 = (n: number) => Math.round(n * 10000) / 10000

/** Kilograms one sale of the variant moves: Qty × UOM for weight units, else the Weight (kg) field. */
function kgPerSale(uom: string, uomQuantity: number | null | undefined, weightKg: number | null | undefined): number {
  const factor = WEIGHT_PER_KG[normalizeUom(uom)]
  if (factor !== undefined) {
    const pack = Number(uomQuantity) > 0 ? Number(uomQuantity) : 1
    return round4(pack * factor)
  }
  const weight = Number(weightKg)
  return weight > 0 ? round4(weight) : 0
}

export type VariantConversionInput = {
  /** Product-level stock UOM (kg, g, l, piece …). */
  stockUom: string
  uom?: string | null
  uomQuantity?: number | string | null
  weightKg?: number | string | null
  /**
   * Manual rule: stock UOM units one sale uses. When it is a positive number it wins over
   * the automatic UOM / Qty / Weight conversion.
   */
  stockPerSale?: number | string | null
}

/** The manual "1 sale = N stock units" value as a positive number, or null when not set. */
export function manualStockPerSale(value: number | string | null | undefined): number | null {
  if (value === '' || value == null) return null
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? round4(n) : null
}

/**
 * Turn what the vendor typed ("[sales qty] sale = [stock qty] <stock UOM>") into the stored
 * per-sale value. Sales qty defaults to 1. Returns null when no stock qty is typed (automatic),
 * and NaN when the typed numbers cannot make a valid rule.
 */
export function manualRuleFromInputs(
  salesQty: number | string | null | undefined,
  stockQty: number | string | null | undefined,
): number | null {
  if (stockQty === '' || stockQty == null) return null
  const stock = Number(stockQty)
  const sales = salesQty === '' || salesQty == null ? 1 : Number(salesQty)
  if (!Number.isFinite(stock) || !Number.isFinite(sales) || stock <= 0 || sales <= 0) return NaN
  const per = round4(stock / sales)
  return per > 0 ? per : NaN
}

/**
 * How much of the stock balance one sale of this variant uses, in the stock UOM.
 * 0 means the variant cannot be converted yet (e.g. a piece with no Weight (kg)).
 */
export function stockUnitsPerSale({ stockUom, uom, uomQuantity, weightKg, stockPerSale }: VariantConversionInput): number {
  const manual = manualStockPerSale(stockPerSale)
  if (manual !== null) return manual
  const pool = normalizeUom(stockUom)
  const dim = uomDimension(pool)
  const variantUom = normalizeUom(uom) || 'piece'
  const qty = uomQuantity === '' || uomQuantity == null ? null : Number(uomQuantity)
  const weight = weightKg === '' || weightKg == null ? null : Number(weightKg)

  if (dim === 'weight') {
    return round4(kgPerSale(variantUom, qty, weight) / WEIGHT_PER_KG[pool])
  }
  if (dim === 'volume') {
    const perL = VOLUME_PER_L[variantUom]
    if (perL === undefined) return 0
    const pack = qty && qty > 0 ? qty : 1
    return round4((pack * perL) / VOLUME_PER_L[pool])
  }
  return 1
}

/** What the variant needs filled in so it converts, or null when it already does. */
export function conversionProblem(input: VariantConversionInput): string | null {
  if (stockUnitsPerSale(input) > 0) return null
  const dim = uomDimension(input.stockUom)
  if (dim === 'volume') return 'Set the variant UOM to a volume unit (L, ml …) and its Qty, or type how much stock one sale uses'
  return 'Set Weight (kg) so this variant converts to the stock UOM'
}

const trim = (n: number) => Number(n.toFixed(4)).toLocaleString('en-IN', { maximumFractionDigits: 4 })

/** "1 sale = 0.1 kg" style text. */
export function formatStockUnits(value: number, stockUomLabel: string): string {
  return `${trim(value)} ${stockUomLabel}`
}
