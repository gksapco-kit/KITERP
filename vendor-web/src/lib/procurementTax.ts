/**
 * Tax resolution for procurement documents.
 *
 * Mirrors `_split_line_tax` in backend/app/services/procurement_service.py —
 * keep the two in sync so the figure previewed on screen matches the figure the
 * server persists.
 *
 * For combined GST codes (tax_type === 'GST'):
 *   intraState=true  → splits evenly into CGST + SGST (amount = full rate on line)
 *   intraState=false → full rate goes to IGST
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
  /** Total tax amount on the line (CGST + SGST + IGST combined). */
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

/**
 * Full GSTIN regex — mirrors backend gst_utils._GSTIN_RE.
 * 2-digit state code + 5 alpha + 4 digit + 1 alpha + 1 digit + 1 alpha + 1 digit.
 */
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z]\d$/i

/** Extract the 2-digit state code from a valid GSTIN, or null if format is wrong. */
function gstinStateCode(gstin: string | null | undefined): string | null {
  if (!gstin) return null
  const s = gstin.trim()
  if (!GSTIN_RE.test(s)) return null
  return s.slice(0, 2)
}

/** True when supplier and vendor GSTINs share the same state prefix. */
export function isIntraState(
  supplierGstin: string | null | undefined,
  vendorGstin: string | null | undefined,
): boolean {
  const s = gstinStateCode(supplierGstin)
  const v = gstinStateCode(vendorGstin)
  return !!(s && v && s === v)
}

/**
 * Return a short label describing how a combined-GST code will split for the
 * current transaction direction.  Used as the hint text in the tax-code picker.
 *
 * Examples:
 *   taxSplitLabel(entry, true)  → "CGST 9% + SGST 9%"
 *   taxSplitLabel(entry, false) → "IGST 18%"
 *   taxSplitLabel(entry, ...)   — non-GST types → "" (no label)
 */
export function taxSplitLabel(entry: TaxCode, intraState: boolean): string {
  const taxType = (entry.tax_type || '').trim().toUpperCase()
  const rate = Number(entry.rate) || 0
  if (taxType !== 'GST' || rate <= 0) return ''
  if (intraState) {
    const half = Math.round(rate / 2 * 100) / 100
    return `CGST ${half}% + SGST ${half}%`
  }
  return `IGST ${rate}%`
}

export function resolveLineTax(
  lineTotal: number,
  taxCode: string | undefined | null,
  codeMap: Map<string, TaxCode>,
  intraState = false,
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

  if (taxType === 'GST') {
    // Combined GST code: split by place of supply.
    const totalAmount = Math.round((lineTotal * rate) / 100 * 100) / 100
    return { rate, amount: totalAmount, taxType, resolved: true }
  }

  const amount = Math.round((lineTotal * rate) / 100 * 100) / 100
  return { rate, amount, taxType, resolved: true }
}