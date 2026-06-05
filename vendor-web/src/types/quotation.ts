export type QuotationExtraFieldType = 'text' | 'email' | 'phone' | 'link' | 'image'

export interface QuotationExtraField {
  id: string
  label: string
  type: QuotationExtraFieldType
  value: string
  /** Image fields may store multiple URLs here. `value` keeps the first image for backward compatibility. */
  values?: string[]
}

export const QUOTATION_EXTRA_FIELD_TYPES: { value: QuotationExtraFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'link', label: 'Link' },
  { value: 'image', label: 'Images' },
]

export function newQuotationExtraField(type: QuotationExtraFieldType = 'text'): QuotationExtraField {
  return {
    id: crypto.randomUUID(),
    label: '',
    type,
    value: '',
    values: type === 'image' ? [] : undefined,
  }
}

export function getQuotationImageUrls(field: QuotationExtraField): string[] {
  if (field.type !== 'image') return []
  if (field.values?.length) return field.values.filter(Boolean)
  return field.value ? [field.value] : []
}

export function quotationFieldHasContent(field: QuotationExtraField): boolean {
  if (!field.label.trim()) return false
  if (field.type === 'image') return getQuotationImageUrls(field).length > 0
  return Boolean(field.value.trim())
}

export function normalizeQuotationExtraFields(raw: unknown): QuotationExtraField[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      const row = item as Record<string, unknown>
      const type = String(row.type || 'text') as QuotationExtraFieldType
      const validType = QUOTATION_EXTRA_FIELD_TYPES.some(t => t.value === type) ? type : 'text'
      const value = String(row.value || '')
      const rawValues = Array.isArray(row.values)
        ? row.values.map(v => String(v)).filter(Boolean)
        : []
      const values = validType === 'image'
        ? (rawValues.length ? rawValues : (value ? [value] : []))
        : undefined
      return {
        id: String(row.id || crypto.randomUUID()),
        label: String(row.label || '').trim(),
        type: validType,
        value: validType === 'image' ? (values?.[0] || '') : value,
        values,
      }
    })
    .filter(quotationFieldHasContent)
}

export function serializeQuotationExtraFields(fields: QuotationExtraField[]): QuotationExtraField[] {
  return fields
    .map(f => {
      const label = f.label.trim()
      if (f.type === 'image') {
        const values = getQuotationImageUrls(f)
        return { ...f, label, value: values[0] || '', values }
      }
      return { ...f, label, value: f.value.trim(), values: undefined }
    })
    .filter(f => f.label)
}
