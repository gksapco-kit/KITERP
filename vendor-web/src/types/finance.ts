// ─── Finance domain types ──────────────────────────────────────────────────

export interface Company {
  id: string
  vendor_id: string
  code: string
  name: string
  currency: string
  country: string
  tax_id?: string
  is_default: boolean
  is_active: boolean
}

export interface CostCenter {
  id: string
  vendor_id: string
  company_id: string
  code: string
  name: string
  description?: string
  cc_group?: string
  parent_id?: string
  is_active: boolean
  created_at?: string
}

export interface Project {
  id: string
  vendor_id: string
  company_id: string
  code: string
  name: string
  description?: string
  start_date?: string
  end_date?: string
  budget: string
  status: string
  manager_id?: string
}

export interface IntercompanyPartner {
  id: string
  vendor_id: string
  company_id: string
  partner_company_id: string
  default_ar_account_id?: string
  default_ap_account_id?: string
  is_active: boolean
}

export interface AccountSearchResult {
  id: string
  code: string
  name: string
  account_type: string
  account_subtype?: string
  currency: string
}

export interface RefDocResult {
  id: string
  no: string
  label: string
}

// ─── Journal Entry ──────────────────────────────────────────────────────────

export type DocType = 'SA' | 'DR' | 'CR' | 'AB' | 'ML'
export type JEStatus = 'draft' | 'pending_approval' | 'posted' | 'void'
export type PartyType = 'customer' | 'supplier'
export type RefDocType =
  | 'purchase_order' | 'sales_order' | 'invoice' | 'bill' | 'payment' | 'asset' | 'manual'

export interface JournalLineIn {
  account_id: string
  description?: string
  debit: number
  credit: number
  currency?: string
  fx_rate?: number
  cost_center_id?: string
  project_id?: string
  intercompany_partner_id?: string
  store_id?: string
  value_date?: string
  party_type?: PartyType
  party_id?: string
  ref_doc_type?: RefDocType
  ref_doc_id?: string
  ref_doc_no?: string
  tax_code?: string
  tax_amount?: number
  assignment?: string
  sequence?: number
}

export interface JournalLineOut extends JournalLineIn {
  id: string
  account_code?: string
  account_name?: string
  base_debit: number
  base_credit: number
}

export interface JournalEntryCreate {
  company_id?: string
  entry_date: string           // ISO date
  document_date?: string
  document_type?: DocType
  source_type?: string
  reference?: string
  narration?: string
  header_text?: string
  currency?: string
  /** GL posting period; when set, must contain entry_date. */
  period_id?: string
  lines: JournalLineIn[]
}

export interface JournalEntryUpdate {
  company_id?: string
  entry_date?: string
  document_date?: string
  document_type?: DocType
  reference?: string
  narration?: string
  header_text?: string
  currency?: string
  period_id?: string
  lines?: JournalLineIn[]
}

export interface JournalEntry {
  id: string
  vendor_id: string
  company_id?: string
  company_name?: string
  entry_no: string
  entry_date: string
  document_date?: string
  document_type: DocType
  period_id?: string
  fiscal_year_id?: string
  source_type?: string
  status: JEStatus
  reference?: string
  narration?: string
  header_text?: string
  currency: string
  total_debit: number
  total_credit: number
  requires_approval: boolean
  approval_request_id?: string
  created_by_id?: string
  posted_by_id?: string
  lines: JournalLineOut[]
}

export const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: 'SA', label: 'SA — G/L Account Document' },
  { value: 'DR', label: 'DR — Debit Memo' },
  { value: 'CR', label: 'CR — Credit Memo' },
  { value: 'AB', label: 'AB — Accounting Document' },
  { value: 'ML', label: 'ML — Material Ledger' },
]

export const REF_DOC_TYPES: { value: RefDocType; label: string }[] = [
  { value: 'purchase_order', label: 'Purchase Order' },
  { value: 'sales_order', label: 'Sales Order' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'bill', label: 'Vendor Bill' },
  { value: 'payment', label: 'Payment' },
  { value: 'asset', label: 'Fixed Asset' },
  { value: 'manual', label: 'Manual Reference' },
]
