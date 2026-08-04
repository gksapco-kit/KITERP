export type FieldStatus = 'mandatory' | 'optional' | 'suppress'

export type FieldGroup =
  | 'Header'
  | 'Organizational'
  | 'Item'
  | 'Account Assignment'
  | 'Delivery'
  | 'Vendor'
  | 'Finance'
  | 'Approval'

export type ProcurementFieldDef = {
  key: string
  label: string
  group: FieldGroup
  description?: string
  defaultStatus: FieldStatus
  /** Fields marked as system-fixed cannot have their status changed */
  systemFixed?: boolean
}

export type DocType = 'PR' | 'PO'

// ── Purchase Requisition fields ─────────────────────────────────
export const PR_FIELDS: ProcurementFieldDef[] = [
  // Header
  { key: 'description', label: 'Description / Purpose', group: 'Header', defaultStatus: 'mandatory' },
  { key: 'requisition_date', label: 'Requisition Date', group: 'Header', defaultStatus: 'mandatory' },
  { key: 'required_date', label: 'Required By Date', group: 'Header', defaultStatus: 'mandatory' },
  { key: 'pr_type', label: 'PR Type', group: 'Header', defaultStatus: 'optional' },
  { key: 'priority', label: 'Priority', group: 'Header', defaultStatus: 'optional' },
  { key: 'source_type', label: 'Source Type', group: 'Header', defaultStatus: 'optional' },
  // Organizational
  { key: 'company_code', label: 'Company Code', group: 'Organizational', defaultStatus: 'optional' },
  { key: 'plant', label: 'Plant', group: 'Organizational', defaultStatus: 'optional' },
  { key: 'storage_location', label: 'Storage Location', group: 'Organizational', defaultStatus: 'optional' },
  { key: 'purchasing_group', label: 'Purchasing Group', group: 'Organizational', defaultStatus: 'optional' },
  // Item
  { key: 'material', label: 'Material / Product', group: 'Item', defaultStatus: 'mandatory' },
  { key: 'short_text', label: 'Short Text', group: 'Item', defaultStatus: 'mandatory' },
  { key: 'quantity', label: 'Quantity', group: 'Item', defaultStatus: 'mandatory' },
  { key: 'unit', label: 'Unit of Measure', group: 'Item', defaultStatus: 'mandatory' },
  { key: 'item_category', label: 'Item Category', group: 'Item', defaultStatus: 'optional' },
  { key: 'estimated_price', label: 'Estimated Price', group: 'Item', defaultStatus: 'optional' },
  { key: 'currency', label: 'Currency', group: 'Item', defaultStatus: 'optional' },
  // Account Assignment
  { key: 'account_assignment_category', label: 'Acct Assignment Category', group: 'Account Assignment', defaultStatus: 'optional' },
  { key: 'gl_account', label: 'GL Account', group: 'Account Assignment', defaultStatus: 'optional' },
  { key: 'cost_center', label: 'Cost Center', group: 'Account Assignment', defaultStatus: 'optional' },
  { key: 'profit_center', label: 'Profit Center', group: 'Account Assignment', defaultStatus: 'suppress' },
  { key: 'project_wbs', label: 'WBS / Project', group: 'Account Assignment', defaultStatus: 'suppress' },
  { key: 'internal_order', label: 'Internal Order', group: 'Account Assignment', defaultStatus: 'suppress' },
  // Vendor
  { key: 'preferred_supplier', label: 'Preferred Supplier', group: 'Vendor', defaultStatus: 'optional' },
  // Approval
  { key: 'requisitioner', label: 'Requisitioner', group: 'Approval', defaultStatus: 'mandatory' },
  { key: 'approver', label: 'Approver', group: 'Approval', defaultStatus: 'optional' },
  { key: 'approval_message', label: 'Approval Message', group: 'Approval', defaultStatus: 'optional' },
  { key: 'notes', label: 'Notes / Remarks', group: 'Approval', defaultStatus: 'optional' },
]

// ── Purchase Order fields ────────────────────────────────────────
export const PO_FIELDS: ProcurementFieldDef[] = [
  // Header
  { key: 'po_date', label: 'PO Date', group: 'Header', defaultStatus: 'mandatory' },
  { key: 'po_type', label: 'PO Type', group: 'Header', defaultStatus: 'optional' },
  { key: 'reference', label: 'Reference / External Ref', group: 'Header', defaultStatus: 'optional' },
  { key: 'header_text', label: 'Header Text', group: 'Header', defaultStatus: 'optional' },
  // Organizational
  { key: 'company_code', label: 'Company Code', group: 'Organizational', defaultStatus: 'optional' },
  { key: 'plant', label: 'Plant', group: 'Organizational', defaultStatus: 'optional' },
  { key: 'storage_location', label: 'Storage Location', group: 'Organizational', defaultStatus: 'optional' },
  { key: 'purchasing_group', label: 'Purchasing Group', group: 'Organizational', defaultStatus: 'optional' },
  { key: 'purchasing_org', label: 'Purchasing Organization', group: 'Organizational', defaultStatus: 'suppress' },
  // Vendor
  { key: 'supplier', label: 'Supplier', group: 'Vendor', defaultStatus: 'mandatory' },
  { key: 'supplier_contact', label: 'Supplier Contact', group: 'Vendor', defaultStatus: 'optional' },
  { key: 'payment_terms', label: 'Payment Terms', group: 'Vendor', defaultStatus: 'optional' },
  { key: 'incoterms', label: 'Incoterms', group: 'Vendor', defaultStatus: 'suppress' },
  // Item
  { key: 'material', label: 'Material / Product', group: 'Item', defaultStatus: 'mandatory' },
  { key: 'short_text', label: 'Short Text', group: 'Item', defaultStatus: 'mandatory' },
  { key: 'quantity', label: 'Quantity', group: 'Item', defaultStatus: 'mandatory' },
  { key: 'unit', label: 'Unit of Measure', group: 'Item', defaultStatus: 'mandatory' },
  { key: 'net_price', label: 'Net Price', group: 'Item', defaultStatus: 'mandatory' },
  { key: 'currency', label: 'Currency', group: 'Item', defaultStatus: 'mandatory' },
  { key: 'tax_code', label: 'Tax Code', group: 'Item', defaultStatus: 'optional' },
  { key: 'item_category', label: 'Item Category', group: 'Item', defaultStatus: 'optional' },
  { key: 'item_text', label: 'Item Text', group: 'Item', defaultStatus: 'optional' },
  // Delivery
  { key: 'delivery_date', label: 'Delivery Date', group: 'Delivery', defaultStatus: 'mandatory' },
  { key: 'delivery_address', label: 'Delivery Address', group: 'Delivery', defaultStatus: 'optional' },
  { key: 'overdelivery_tolerance', label: 'Over-Delivery Tolerance %', group: 'Delivery', defaultStatus: 'suppress' },
  { key: 'underdelivery_tolerance', label: 'Under-Delivery Tolerance %', group: 'Delivery', defaultStatus: 'suppress' },
  { key: 'gr_based_iv', label: 'GR-Based Invoice Verify', group: 'Delivery', defaultStatus: 'suppress' },
  // Account Assignment
  { key: 'account_assignment_category', label: 'Acct Assignment Category', group: 'Account Assignment', defaultStatus: 'optional' },
  { key: 'gl_account', label: 'GL Account', group: 'Account Assignment', defaultStatus: 'optional' },
  { key: 'cost_center', label: 'Cost Center', group: 'Account Assignment', defaultStatus: 'optional' },
  { key: 'profit_center', label: 'Profit Center', group: 'Account Assignment', defaultStatus: 'suppress' },
  { key: 'project_wbs', label: 'WBS / Project', group: 'Account Assignment', defaultStatus: 'suppress' },
  { key: 'internal_order', label: 'Internal Order', group: 'Account Assignment', defaultStatus: 'suppress' },
  // Finance
  { key: 'budget_check', label: 'Budget Check', group: 'Finance', defaultStatus: 'optional' },
  { key: 'valuation_price', label: 'Valuation Price', group: 'Finance', defaultStatus: 'suppress' },
]

export const STATUS_META: Record<FieldStatus, { label: string; bgClass: string; textClass: string; ringClass: string }> = {
  mandatory: {
    label: 'Mandatory',
    bgClass: 'bg-rose-100 dark:bg-rose-900/30',
    textClass: 'text-rose-700 dark:text-rose-400',
    ringClass: 'ring-rose-400',
  },
  optional: {
    label: 'Optional',
    bgClass: 'bg-blue-50 dark:bg-blue-900/20',
    textClass: 'text-blue-700 dark:text-blue-400',
    ringClass: 'ring-blue-400',
  },
  suppress: {
    label: 'Suppress',
    bgClass: 'bg-gray-100 dark:bg-gray-800',
    textClass: 'text-gray-500 dark:text-gray-400',
    ringClass: 'ring-gray-400',
  },
}

export const GROUP_ORDER: FieldGroup[] = [
  'Header',
  'Organizational',
  'Item',
  'Vendor',
  'Delivery',
  'Account Assignment',
  'Finance',
  'Approval',
]

export function getFieldsForDocType(docType: DocType): ProcurementFieldDef[] {
  return docType === 'PR' ? PR_FIELDS : PO_FIELDS
}

export function groupFields(fields: ProcurementFieldDef[]): Array<{ group: FieldGroup; items: ProcurementFieldDef[] }> {
  const map = new Map<FieldGroup, ProcurementFieldDef[]>()
  for (const f of fields) {
    if (!map.has(f.group)) map.set(f.group, [])
    map.get(f.group)!.push(f)
  }
  return GROUP_ORDER
    .filter(g => map.has(g))
    .map(g => ({ group: g, items: map.get(g)! }))
}
