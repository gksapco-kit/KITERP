/** Lightweight preview helpers (avoid importing the full invoiceTemplates bundle on list pages). */

export function currentIndianFinancialYearShort(date = new Date()): string {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  if (m >= 4) return `${y}${String(y + 1).slice(-2)}`
  return `${y - 1}${String(y).slice(-2)}`
}

export function previewDocumentNumber(
  prefix: string | undefined,
  suffix: string | undefined,
  defaultPrefix: string,
  sequence = 1,
): string {
  const cleaned = (prefix || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9/]/g, '')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '')
  const p = (cleaned || defaultPrefix).slice(0, 24)
  const seq = Math.max(1, Math.min(999999, Math.floor(Number(sequence) || 1)))
  const base = `${p}/${currentIndianFinancialYearShort()}/${String(seq).padStart(4, '0')}`
  const s = (suffix || '').trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 16)
  return s ? `${base}-${s}` : base
}
