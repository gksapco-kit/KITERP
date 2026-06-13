import { normalizeLabelKey } from '@/lib/fieldHelpRegistry'

export type SchemaFieldMappingRecord = {
  id: string
  vendor_id: string
  table_name: string
  column_name: string
  ui_label: string
  help_short?: string | null
  help_full?: string | null
  screens: string[]
  note?: string | null
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

const byTableColumn = new Map<string, SchemaFieldMappingRecord>()
const byUILabel = new Map<string, SchemaFieldMappingRecord>()

export function applyFieldMappings(items: SchemaFieldMappingRecord[]) {
  byTableColumn.clear()
  byUILabel.clear()
  for (const m of items) {
    if (!m.is_active) continue
    const key = `${m.table_name}.${m.column_name}`
    byTableColumn.set(key, m)
    byUILabel.set(normalizeLabelKey(m.ui_label), m)
  }
}

export function getFieldMappingByTableColumn(
  table: string,
  column: string,
): SchemaFieldMappingRecord | null {
  return byTableColumn.get(`${table}.${column}`) ?? null
}

export function getFieldMappingByLabel(label: string): SchemaFieldMappingRecord | null {
  const key = normalizeLabelKey(label)
  if (!key) return null
  return byUILabel.get(key) ?? null
}

export function getAllFieldMappings(): SchemaFieldMappingRecord[] {
  return Array.from(byTableColumn.values())
}
