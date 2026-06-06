import type { Contact } from '@/api/crm'

export const SALUTATIONS = ['Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Mx'] as const

export const inputCls = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm'

export function contactDisplayName(c: Pick<Contact, 'record_type' | 'salutation' | 'first_name' | 'last_name'>): string {
  if (c.record_type === 'company') return c.first_name
  const parts = [c.salutation, c.first_name, c.last_name].filter(Boolean)
  return parts.join(' ') || c.first_name
}

export function contactShortLabel(c: Contact): string {
  const name = contactDisplayName(c)
  if (c.record_type === 'company' && c.number) return `${c.number} · ${name}`
  return name
}
