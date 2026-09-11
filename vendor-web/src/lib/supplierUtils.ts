import type { Supplier } from '@/types'

export function normalizeSupplierName(name: string): string {
  return name.trim().toLowerCase()
}

export function normalizeSupplierPhone(phone?: string | null): string {
  return (phone || '').replace(/\D/g, '')
}

function compactAlnum(value?: string | null): string {
  return (value || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
}

/** Secondary line for supplier pickers (company · GSTIN · email · phone). */
export function supplierSearchHint(s: Pick<Supplier, 'company_name' | 'name' | 'gstin' | 'email' | 'phone'>): string {
  return [
    s.company_name && s.company_name !== s.name ? s.company_name : null,
    s.gstin,
    s.email,
    s.phone,
  ].filter(Boolean).join(' · ')
}

/**
 * Lower is a better match. 100 = no match.
 * Prefix on name/company ranks above contains, GSTIN, email, and phone.
 */
export function rankSupplierMatch(s: Supplier, query: string): number {
  const q = query.trim().toLowerCase()
  if (!q) return 50

  const tokens = q.split(/\s+/).filter(Boolean)
  const name = (s.name || '').toLowerCase()
  const company = (s.company_name || '').toLowerCase()
  const contact = (s.contact_name || '').toLowerCase()
  const email = (s.email || '').toLowerCase()
  const gstin = (s.gstin || '').toLowerCase()
  const gstinCompact = compactAlnum(s.gstin)
  const phoneDigits = (s.phone || '').replace(/\D/g, '')
  const haystack = [name, company, contact, email, gstin, gstinCompact, phoneDigits].join(' ')

  const allMatch = tokens.every((token) => {
    const digits = token.replace(/\D/g, '')
    const compact = compactAlnum(token)
    return haystack.includes(token)
      || (digits.length >= 3 && phoneDigits.includes(digits))
      || (compact.length >= 3 && gstinCompact.includes(compact))
  })
  if (!allMatch) return 100

  const first = tokens[0]
  if (name === q || company === q) return 0
  if (name.startsWith(first) || name.split(/\s+/).some(w => w.startsWith(first))) return 1
  if (company.startsWith(first) || company.split(/\s+/).some(w => w.startsWith(first))) return 2
  if (gstin.startsWith(first) || gstinCompact.startsWith(compactAlnum(first))) return 3
  if (email.startsWith(first) || contact.startsWith(first)) return 4
  if (name.includes(first) || company.includes(first)) return 5
  return 6
}

export function sortSuppliersByQuery(suppliers: Supplier[], query: string): Supplier[] {
  return [...suppliers].sort((a, b) => {
    const rank = rankSupplierMatch(a, query) - rankSupplierMatch(b, query)
    return rank !== 0 ? rank : a.name.localeCompare(b.name)
  })
}

/** Stable key for detecting duplicate master-data rows in UI lists. */
export function supplierDedupeKey(s: Supplier): string {
  return `${normalizeSupplierName(s.name)}|${normalizeSupplierPhone(s.phone)}|${(s.email || '').trim().toLowerCase()}`
}

/** Keep the oldest record when name/phone/email match — hides duplicate rows in dropdowns. */
export function dedupeSuppliers(suppliers: Supplier[]): Supplier[] {
  const byKey = new Map<string, Supplier>()
  for (const s of suppliers) {
    const key = supplierDedupeKey(s)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, s)
      continue
    }
    const existingTs = existing.created_at ? new Date(existing.created_at).getTime() : Number.MAX_SAFE_INTEGER
    const candidateTs = s.created_at ? new Date(s.created_at).getTime() : Number.MAX_SAFE_INTEGER
    if (candidateTs < existingTs) byKey.set(key, s)
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function findExistingSupplier(
  suppliers: Supplier[],
  input: { name: string; phone?: string; email?: string },
): Supplier | undefined {
  const normName = normalizeSupplierName(input.name)
  if (!normName) return undefined
  const normPhone = normalizeSupplierPhone(input.phone)
  const normEmail = (input.email || '').trim().toLowerCase()

  return suppliers.find(s => {
    if (normalizeSupplierName(s.name) === normName) return true
    if (normPhone && normalizeSupplierPhone(s.phone) === normPhone) return true
    if (normEmail && (s.email || '').trim().toLowerCase() === normEmail) return true
    return false
  })
}
