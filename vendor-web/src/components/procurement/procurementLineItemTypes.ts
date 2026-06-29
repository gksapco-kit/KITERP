export type RequisitionType = 'product' | 'service' | 'asset' | 'consumption' | 'other'

export const REQUISITION_TYPES: { value: RequisitionType; label: string }[] = [
  { value: 'product', label: 'Product' },
  { value: 'service', label: 'Service' },
  { value: 'asset', label: 'Asset' },
  { value: 'consumption', label: 'Consumption' },
  { value: 'other', label: 'Other' },
]

export const DEFAULT_UOM: Record<RequisitionType, string> = {
  product: 'PCS',
  service: 'HR',
  asset: 'EA',
  consumption: 'PCS',
  other: 'EA',
}

export const UOM_OPTIONS: Record<RequisitionType, { value: string; label: string }[]> = {
  product: [
    { value: 'PCS', label: 'PCS — Pieces' },
    { value: 'BOX', label: 'BOX — Box' },
    { value: 'KG', label: 'KG — Kilogram' },
    { value: 'LTR', label: 'LTR — Litre' },
    { value: 'MTR', label: 'MTR — Metre' },
  ],
  service: [
    { value: 'HR', label: 'HR — Hours' },
    { value: 'DAY', label: 'DAY — Days' },
    { value: 'JOB', label: 'JOB — Job' },
    { value: 'MON', label: 'MON — Month' },
  ],
  asset: [{ value: 'EA', label: 'EA — Each' }],
  consumption: [
    { value: 'PCS', label: 'PCS — Pieces' },
    { value: 'KG', label: 'KG — Kilogram' },
    { value: 'LTR', label: 'LTR — Litre' },
    { value: 'BOX', label: 'BOX — Box' },
    { value: 'MTR', label: 'MTR — Metre' },
  ],
  other: [
    { value: 'EA', label: 'EA — Each' },
    { value: 'PCS', label: 'PCS — Pieces' },
    { value: 'JOB', label: 'JOB — Job' },
  ],
}

export const QTY_LABELS: Record<RequisitionType, string> = {
  product: 'Order Qty',
  service: 'Qty / Hours',
  asset: 'Quantity',
  consumption: 'Issue Qty',
  other: 'Quantity',
}

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const

export interface ItemRow {
  item_type: RequisitionType
  cost_center_id: string
  priority: string
  reference_id: string
  variant_id: string
  description: string
  quantity: number | string
  uom: string
  estimated_price: string
  needed_by_date: string
  notes: string
  plant_id: string
  storage_location_id: string
  service_period_from: string
  service_period_to: string
  asset_tag: string
  account_assignment: string
}

export function emptyItem(type: RequisitionType = 'product'): ItemRow {
  return {
    item_type: type,
    cost_center_id: '',
    priority: 'medium',
    reference_id: '',
    variant_id: '',
    description: '',
    quantity: 1,
    uom: DEFAULT_UOM[type],
    estimated_price: '',
    needed_by_date: '',
    notes: '',
    plant_id: '',
    storage_location_id: '',
    service_period_from: '',
    service_period_to: '',
    asset_tag: '',
    account_assignment: '',
  }
}

export function itemTypeLabel(type?: string | null): string {
  return REQUISITION_TYPES.find(t => t.value === type)?.label ?? 'Product'
}

export function isItemValid(item: ItemRow): boolean {
  const type = item.item_type
  if (type === 'product' || type === 'consumption') return !!item.reference_id
  if (type === 'service') return !!item.reference_id
  if (type === 'asset') return !!item.description.trim()
  return !!item.description.trim()
}

export function buildItemNotes(item: ItemRow): string | undefined {
  const type = item.item_type
  const parts: string[] = []
  if (type === 'service' && (item.service_period_from || item.service_period_to)) {
    parts.push(
      `Service period: ${item.service_period_from || '—'} → ${item.service_period_to || '—'}`,
    )
  }
  if (type === 'asset' && item.asset_tag.trim()) {
    parts.push(`Asset tag / serial: ${item.asset_tag.trim()}`)
  }
  if (type === 'other' && item.account_assignment.trim()) {
    parts.push(`Account assignment: ${item.account_assignment.trim()}`)
  }
  if (item.notes.trim()) parts.push(item.notes.trim())
  return parts.length ? parts.join('\n') : undefined
}

export function itemCollapsedSummary(item: ItemRow): string {
  if (item.description.trim()) return item.description.trim()
  if (item.reference_id) return 'Item selected'
  return 'No item selected'
}
