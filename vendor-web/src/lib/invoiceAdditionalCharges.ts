/** Document-level charges (freight, packing, etc.) — fixed ₹ with optional GST %. */

export type InvoiceAdditionalCharge = {
  id: string
  name: string
  amount: number
  tax_rate: number
}

export type InvoiceAdditionalChargeRow = {
  id: string
  name: string
  amount: string
  tax_rate: string
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `chg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function emptyInvoiceAdditionalChargeRow(defaultTaxRate = 18): InvoiceAdditionalChargeRow {
  return {
    id: newId(),
    name: '',
    amount: '',
    tax_rate: String(defaultTaxRate),
  }
}

export function normalizeInvoiceAdditionalCharges(raw: unknown): InvoiceAdditionalCharge[] {
  if (!Array.isArray(raw)) return []
  const out: InvoiceAdditionalCharge[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const name = String(rec.name || '').trim()
    const amount = Math.max(0, Number(rec.amount) || 0)
    if (!name || amount <= 0) continue
    const tax_rate = Math.max(0, Number(rec.tax_rate ?? 18) || 0)
    out.push({
      id: String(rec.id || '').trim() || newId(),
      name,
      amount: Math.round(amount * 100) / 100,
      tax_rate,
    })
  }
  return out
}

export function invoiceAdditionalChargesForSave(
  rows: InvoiceAdditionalChargeRow[] | undefined,
): InvoiceAdditionalCharge[] {
  return normalizeInvoiceAdditionalCharges(
    (rows || []).map((row) => ({
      id: row.id,
      name: row.name,
      amount: Number(row.amount) || 0,
      tax_rate: Number(row.tax_rate) || 0,
    })),
  )
}

/** Pseudo line items for client-side tax preview (qty 1, rate = charge amount). */
export function additionalChargesAsLineItems(
  charges: InvoiceAdditionalCharge[],
): Array<{ qty: number; rate: number; discount: number; tax_rate: number }> {
  return charges.map((c) => ({
    qty: 1,
    rate: c.amount,
    discount: 0,
    tax_rate: c.tax_rate,
  }))
}
