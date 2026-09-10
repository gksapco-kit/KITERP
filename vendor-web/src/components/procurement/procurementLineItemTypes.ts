export type RequisitionType = 'product' | 'service' | 'asset' | 'consumption' | 'other'

export const REQUISITION_TYPES: { value: RequisitionType; label: string }[] = [
  { value: 'product', label: 'Product' },
  { value: 'service', label: 'Service' },
  { value: 'asset', label: 'Asset' },
  { value: 'consumption', label: 'Consumption' },
  { value: 'other', label: 'Other' },
]

export const DEFAULT_UOM: Record<RequisitionType, string> = {
  product: 'piece',
  service: 'hour',
  asset: 'unit',
  consumption: 'piece',
  other: 'unit',
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
  tax_code: string
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
    tax_code: '',
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

/** Short label for toasts when the catalog name is not loaded yet. */
export function lineItemDisplayName(item: ItemRow, lineNumber: number): string {
  const desc = item.description.trim()
  if (desc) return desc
  return `${itemTypeLabel(item.item_type)} · line ${lineNumber}`
}

export type LineValidationIssue = {
  lineIndex: number
  field: keyof ItemRow
  fieldLabel: string
  message: string
}

function completionIssue(item: ItemRow, lineNumber: number): LineValidationIssue | null {
  const type = item.item_type
  const prefix = `Line ${lineNumber}`
  if (type === 'product' || type === 'consumption') {
    if (item.reference_id) return null
    return {
      lineIndex: lineNumber - 1,
      field: 'reference_id',
      fieldLabel: 'Product',
      message: `${prefix}: select a Product — the Product field is required`,
    }
  }
  if (type === 'service') {
    if (item.reference_id) return null
    return {
      lineIndex: lineNumber - 1,
      field: 'reference_id',
      fieldLabel: 'Service',
      message: `${prefix}: select a Service — the Service field is required`,
    }
  }
  if (item.description.trim()) return null
  return {
    lineIndex: lineNumber - 1,
    field: 'description',
    fieldLabel: 'Description',
    message: `${prefix}: enter a Description — required for ${itemTypeLabel(type)} lines`,
  }
}

function costCenterIssue(item: ItemRow, lineNumber: number): LineValidationIssue | null {
  if (item.cost_center_id) return null
  const name = lineItemDisplayName(item, lineNumber)
  return {
    lineIndex: lineNumber - 1,
    field: 'cost_center_id',
    fieldLabel: 'Department',
    message: `Line ${lineNumber} (${name}): select Department (cost center) — required on each line to submit`,
  }
}

/** First field-level issue blocking PR submit (completion, then cost center). */
export function findFirstPrSubmitLineIssue(items: ItemRow[]): LineValidationIssue | null {
  for (let i = 0; i < items.length; i++) {
    const issue = completionIssue(items[i], i + 1)
    if (issue) return issue
  }
  const missingCc = items
    .map((it, i) => (!it.cost_center_id ? i + 1 : null))
    .filter((n): n is number => n != null)
  if (missingCc.length) {
    const first = costCenterIssue(items[missingCc[0] - 1], missingCc[0])!
    if (missingCc.length === 1) return first
    const others = missingCc.slice(1).join(', ')
    return {
      ...first,
      message: `${first.message}. Also missing on line${missingCc.length > 2 ? 's' : ''} ${others}`,
    }
  }
  return null
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
