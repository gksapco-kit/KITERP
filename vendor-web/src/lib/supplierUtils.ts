import type { Supplier } from '@/types'

export function normalizeSupplierName(name: string): string {
  return name.trim().toLowerCase()
}

export function normalizeSupplierPhone(phone?: string | null): string {
  return (phone || '').replace(/\D/g, '')
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
