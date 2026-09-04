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
  /**
   * Whether this field has a real UI input on the PO create/edit form.
   * Fields with implemented=false are shown in Field Config with a "Not on form yet"
   * badge and their toggle is disabled so they cannot accidentally become mandatory.
   */
  implemented?: boolean
}

/** PR / PO are used by Field Configuration; WF_* keys are used by Approval Workflow */
export type DocType = 'PR' | 'PO' | 'WF_PR' | 'WF_PO' | 'WF_INVOICE'

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
  // Notes (general, not approval-specific — kept on the PR form)
  { key: 'notes', label: 'Notes / Remarks', group: 'Header', defaultStatus: 'optional' },
]

// ── Purchase Order fields ────────────────────────────────────────
export const PO_FIELDS: ProcurementFieldDef[] = [
  // Header — implemented
  { key: 'header_text', label: 'Notes / Header Text', group: 'Header', defaultStatus: 'optional', implemented: true,
    description: 'Internal notes attached to the PO header' },
  // Header — not on form yet
  { key: 'po_date', label: 'PO Date', group: 'Header', defaultStatus: 'optional', implemented: false,
    description: 'Date the purchase order is issued (defaults to today)' },
  { key: 'po_type', label: 'PO Type', group: 'Header', defaultStatus: 'optional', implemented: false },
  { key: 'reference', label: 'Reference / External Ref', group: 'Header', defaultStatus: 'optional', implemented: false },
  // Organizational — implemented
  { key: 'business_unit', label: 'Business Unit', group: 'Organizational', defaultStatus: 'optional', implemented: true,
    description: 'Store / business unit receiving this order' },
  { key: 'plant', label: 'Branch / Plant', group: 'Organizational', defaultStatus: 'optional', implemented: true,
    description: 'Branch or plant the goods will be delivered to' },
  { key: 'storage_location', label: 'Storage Location', group: 'Organizational', defaultStatus: 'optional', implemented: true,
    description: 'Specific bin or rack within the plant' },
  // Organizational — not on form yet
  { key: 'purchasing_group', label: 'Purchasing Group', group: 'Organizational', defaultStatus: 'suppress', implemented: false },
  { key: 'purchasing_org', label: 'Purchasing Organization', group: 'Organizational', defaultStatus: 'suppress', implemented: false },
  // Vendor — implemented
  { key: 'supplier', label: 'Supplier', group: 'Vendor', defaultStatus: 'mandatory', systemFixed: true, implemented: true,
    description: 'Supplier is always required to save a purchase order' },
  { key: 'payment_terms', label: 'Payment Terms', group: 'Vendor', defaultStatus: 'optional', implemented: true,
    description: 'e.g. Net 30, 2/10 Net 30' },
  // Vendor — not on form yet
  { key: 'supplier_contact', label: 'Supplier Contact', group: 'Vendor', defaultStatus: 'optional', implemented: false },
  { key: 'incoterms', label: 'Incoterms', group: 'Vendor', defaultStatus: 'suppress', implemented: false },
  // Item — implemented (systemFixed are always shown)
  { key: 'material', label: 'Product / Service', group: 'Item', defaultStatus: 'mandatory', systemFixed: true, implemented: true,
    description: 'At least one line item is always required' },
  { key: 'quantity', label: 'Quantity', group: 'Item', defaultStatus: 'mandatory', systemFixed: true, implemented: true },
  { key: 'net_price', label: 'Unit Cost / Net Price', group: 'Item', defaultStatus: 'mandatory', systemFixed: true, implemented: true },
  { key: 'unit', label: 'Unit of Measure', group: 'Item', defaultStatus: 'optional', implemented: true,
    description: 'e.g. PCS, KG, L, BOX — defaults to PCS' },
  { key: 'currency', label: 'Currency', group: 'Item', defaultStatus: 'optional', implemented: true,
    description: 'Transaction currency; defaults to INR' },
  { key: 'tax_code', label: 'Tax Code / GST Rate', group: 'Item', defaultStatus: 'optional', implemented: true },
  { key: 'item_category', label: 'Item Category', group: 'Item', defaultStatus: 'optional', implemented: true,
    description: 'Product/Goods | Service | Subcontract | Consignment | Third Party' },
  { key: 'item_text', label: 'Item Note', group: 'Item', defaultStatus: 'optional', implemented: true,
    description: 'Per-line note visible on printed PO' },
  // Item — not on form yet
  { key: 'short_text', label: 'Item Description', group: 'Item', defaultStatus: 'optional', implemented: false,
    description: 'Free-text override description for service or non-catalog items' },
  // Delivery — implemented
  { key: 'delivery_date', label: 'Expected Delivery Date', group: 'Delivery', defaultStatus: 'optional', implemented: true,
    description: 'When you expect to receive the goods' },
  // Delivery — not on form yet
  { key: 'delivery_address', label: 'Delivery Address', group: 'Delivery', defaultStatus: 'suppress', implemented: false },
  { key: 'overdelivery_tolerance', label: 'Over-Delivery Tolerance %', group: 'Delivery', defaultStatus: 'suppress', implemented: false },
  { key: 'underdelivery_tolerance', label: 'Under-Delivery Tolerance %', group: 'Delivery', defaultStatus: 'suppress', implemented: false },
  { key: 'gr_based_iv', label: 'GR-Based Invoice Verify', group: 'Delivery', defaultStatus: 'suppress', implemented: false },
  // Account Assignment — implemented
  { key: 'account_assignment_category', label: 'Acct Assignment Category', group: 'Account Assignment', defaultStatus: 'optional', implemented: true,
    description: 'Cost Center, Project, Asset, GL Account, or None' },
  // Account Assignment — not on form yet (need migration)
  { key: 'cost_center', label: 'Cost Center', group: 'Account Assignment', defaultStatus: 'suppress', implemented: false },
  { key: 'gl_account', label: 'GL Account', group: 'Account Assignment', defaultStatus: 'suppress', implemented: false },
  { key: 'profit_center', label: 'Profit Center', group: 'Account Assignment', defaultStatus: 'suppress', implemented: false },
  { key: 'project_wbs', label: 'WBS / Project', group: 'Account Assignment', defaultStatus: 'suppress', implemented: false },
  { key: 'internal_order', label: 'Internal Order', group: 'Account Assignment', defaultStatus: 'suppress', implemented: false },
  // Finance — not on form yet
  { key: 'budget_check', label: 'Budget Check', group: 'Finance', defaultStatus: 'suppress', implemented: false },
  { key: 'valuation_price', label: 'Valuation Price', group: 'Finance', defaultStatus: 'suppress', implemented: false },
]

// ── Workflow: PR approval fields ─────────────────────────────────
export const WF_PR_FIELDS: ProcurementFieldDef[] = [
  { key: 'requisitioner', label: 'Requisitioner', group: 'Approval', defaultStatus: 'mandatory',
    description: 'Name of the person raising the requisition' },
  { key: 'approver', label: 'Primary Approver', group: 'Approval', defaultStatus: 'optional',
    description: 'First-level approver for the purchase requisition' },
  { key: 'secondary_approver', label: 'Secondary Approver', group: 'Approval', defaultStatus: 'optional',
    description: 'Second-level approver (used when two-step approval is needed)' },
  { key: 'approval_message', label: 'Message for Approver', group: 'Approval', defaultStatus: 'optional',
    description: 'Justification or urgency note sent to the approver' },
]

// ── Workflow: PO approval fields ─────────────────────────────────
export const WF_PO_FIELDS: ProcurementFieldDef[] = [
  { key: 'approver', label: 'Primary Approver', group: 'Approval', defaultStatus: 'optional',
    description: 'First-level approver assigned when submitting the PO for approval' },
  { key: 'secondary_approver', label: 'Secondary Approver', group: 'Approval', defaultStatus: 'optional',
    description: 'Second-level approver (used when two-step approval is needed)' },
  { key: 'approver_message', label: 'Message for Approver', group: 'Approval', defaultStatus: 'optional',
    description: 'Notes or justification from the requester to the approver' },
  { key: 'approval_threshold', label: 'Approval Threshold Amount', group: 'Approval', defaultStatus: 'optional',
    description: 'Minimum PO total above which approval is required (from Budget Controls)' },
]

// ── Workflow: Invoice approval fields ────────────────────────────
export const WF_INVOICE_FIELDS: ProcurementFieldDef[] = [
  { key: 'approver', label: 'Primary Approver', group: 'Approval', defaultStatus: 'optional',
    description: 'First-level approver assigned when submitting the invoice for approval' },
  { key: 'secondary_approver', label: 'Secondary Approver', group: 'Approval', defaultStatus: 'optional',
    description: 'Second-level approver (two-step approval)' },
  { key: 'approver_message', label: 'Message for Approver', group: 'Approval', defaultStatus: 'optional',
    description: 'Justification or context from the person submitting the invoice' },
  { key: 'approval_notes', label: 'Approval Notes', group: 'Approval', defaultStatus: 'optional',
    description: 'Comments captured from the approver when actioning the invoice' },
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
  switch (docType) {
    case 'PR': return PR_FIELDS
    case 'PO': return PO_FIELDS
    case 'WF_PR': return WF_PR_FIELDS
    case 'WF_PO': return WF_PO_FIELDS
    case 'WF_INVOICE': return WF_INVOICE_FIELDS
  }
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
