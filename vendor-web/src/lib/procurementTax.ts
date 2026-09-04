/**
 * Tax resolution for procurement documents.
 *
 * Mirrors `_split_line_tax` in backend/app/services/procurement_service.py —
 * keep the two in sync so the figure previewed on screen matches the figure the
 * server persists.
 */

export interface TaxCode {
  id: string
  code: string
  name: string
  tax_type: string
  rate: number | string
  is_active?: boolean
}

/**
 * Tax types that increase document value. Withholding taxes (TDS/TCS/Income)
 * are deducted at payment, not added to the order, so lines carrying them are
 * priced at net.
 */
const ADDITIVE_TAX_TYPES = new Set(['CGST', 'SGST', 'IGST', 'UTGST', 'GST', 'VAT', 'CESS'])

export interface LineTax {
  rate: number
  amount: number
  taxType: string
  /** False when the code is additive but unknown to the master. */
  resolved: boolean
}

const NO_TAX: LineTax = { rate: 0, amount: 0, taxType: '', resolved: true }

export function buildTaxCodeMap(codes: TaxCode[] | undefined): Map<string, TaxCode> {
  const map = new Map<string, TaxCode>()
  for (const c of codes ?? []) {
    if (c.is_active === false) continue
    map.set((c.code || '').trim().toUpperCase(), c)
  }
  return map
}

export function resolveLineTax(
  lineTotal: number,
  taxCode: string | undefined | null,
  codeMap: Map<string, TaxCode>,
): LineTax {
  const key = (taxCode || '').trim().toUpperCase()
  if (!key) return NO_TAX

  const entry = codeMap.get(key)
  if (!entry) return { ...NO_TAX, resolved: false }

  const taxType = (entry.tax_type || '').trim().toUpperCase()
  const rate = Number(entry.rate) || 0
  if (!ADDITIVE_TAX_TYPES.has(taxType) || rate <= 0) {
    return { rate, amount: 0, taxType, resolved: true }
  }

  const amount = (lineTotal * rate) / 100
  return {
    rate,
    amount: Math.round(amount * 100) / 100,
    taxType,
    resolved: true,
  }
}