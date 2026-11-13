import {
  additionalChargesAsLineItems,
  invoiceAdditionalChargesForSave,
  type InvoiceAdditionalChargeRow,
} from '@/lib/invoiceAdditionalCharges'

type LineLike = { qty: number; rate: number; discount: number; tax_rate: number }

export function lineTaxParts(
  item: LineLike,
  isInterState: boolean,
): { taxable: number; cgst: number; sgst: number; igst: number } {
  const taxable = item.qty * item.rate - item.discount
  const rate = Number(item.tax_rate) || 0
  if (isInterState) {
    return { taxable, cgst: 0, sgst: 0, igst: Math.round(taxable * rate) / 100 }
  }
  const half = rate / 2
  const cgst = Math.round(taxable * half) / 100
  const sgst = Math.round(taxable * half) / 100
  return { taxable, cgst, sgst, igst: 0 }
}

export function lineTaxTotal(item: LineLike, isInterState: boolean): number {
  const parts = lineTaxParts(item, isInterState)
  return parts.cgst + parts.sgst + parts.igst
}

export function lineGrossTotal(item: LineLike, isInterState: boolean): number {
  const parts = lineTaxParts(item, isInterState)
  return parts.taxable + parts.cgst + parts.sgst + parts.igst
}

export function discountPctFromLine(item: LineLike): number {
  const base = Number(item.qty) * Number(item.rate)
  const disc = Math.max(0, Number(item.discount) || 0)
  if (!(base > 0)) return 0
  return Math.round((disc / base) * 10000) / 100
}

export function computeInvoiceTotalsPreview(
  items: LineLike[],
  additionalChargeRows: InvoiceAdditionalChargeRow[],
  discountAmount: number,
  isInterState: boolean,
) {
  const charges = invoiceAdditionalChargesForSave(additionalChargeRows)
  const chargeLines = additionalChargesAsLineItems(charges)
  const allLines = [...items, ...chargeLines]

  let lineTaxable = 0
  let chargesTotal = 0
  for (const item of items) {
    lineTaxable += item.qty * item.rate - item.discount
  }
  for (const c of charges) {
    chargesTotal += c.amount
  }

  let cgst = 0
  let sgst = 0
  let igst = 0
  let taxableAmount = 0
  for (const line of allLines) {
    const parts = lineTaxParts(line, isInterState)
    taxableAmount += parts.taxable
    cgst += parts.cgst
    sgst += parts.sgst
    igst += parts.igst
  }

  const discount = Math.max(0, discountAmount)
  const totalTax = cgst + sgst + igst
  const beforeRound = taxableAmount - discount + totalTax
  const grandTotal = Math.round(beforeRound)
  const roundOff = Math.round((grandTotal - beforeRound) * 100) / 100

  return {
    lineTaxable,
    chargesTotal,
    taxableAmount,
    cgst: Math.round(cgst * 100) / 100,
    sgst: Math.round(sgst * 100) / 100,
    igst: Math.round(igst * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    discount,
    roundOff,
    grandTotal,
  }
}
