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
export type JEStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'posted' | 'void'

/** Actions the backend allows for an entry in its current state (single source of truth). */
export type JEAction = 'edit' | 'simulate' | 'submit' | 'withdraw' | 'approve' | 'reject' | 'post' | 'reverse' | 'void'

export interface JEIssue {
  severity: 'error' | 'warning' | 'info'
  /** 0-based index into the submitted lines; null for header / document level. */
  line: number | null
  field?: string | null
  message: string
}

export interface JESimulationLine {
  index: number
  account_id: string
  account_code?: string | null
  account_name?: string | null
  description?: string | null
  debit: string
  credit: string
  base_debit: string
  base_credit: string
  currency: string
  fx_rate: string
  cost_center_id?: string | null
  project_id?: string | null
  open_item?: string | null
}

export interface JESimulationResult {
  ok: boolean
  issues: JEIssue[]
  entry?: {
    entry_no: string
    provisional: boolean
    status_after_save: JEStatus
    entry_date: string
    total_debit: string
    total_credit: string
    period_id?: string | null
    period_name?: string | null
    period_status?: string | null
  }
  approval?: { required: boolean; amount: string }
  can_post_after_save?: boolean
  post_blockers?: JEIssue[]
  lines: JESimulationLine[]
  split_items: {
    line_index: number | null
    debit: string
    credit: string
    split_pct: string
    profit_center_id?: string | null
    segment_id?: string | null
  }[]
}

export interface JETimeline {
  audit: { id: string; action: string; performed_by_id?: string; created_at: string; diff_json?: Record<string, unknown> }[]
  approval: null | {
    id: string
    status: string
    amount?: number | string
    created_at?: string
    resolved_at?: string
    levels_required: number
    levels_approved: number
    requested_by_name?: string | null
    can_act: boolean
    cannot_act_reason?: string | null
    steps: {
      id: string; step_number: number; status: string; action_at?: string; comments?: string
      approver_name?: string | null
    }[]
  }
  split_items: { id: string; line_index: number | null; debit: number; credit: number; split_pct: number }[]
}
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

export interface JournalAttachment {
  url: string
  filename: string
  content_type?: string
  size?: number
  is_image?: boolean
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
  attachments?: JournalAttachment[]
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
  attachments?: JournalAttachment[]
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
  attachments?: JournalAttachment[]
  currency: string
  total_debit: number
  total_credit: number
  requires_approval: boolean
  approval_request_id?: string
  created_by_id?: string
  posted_by_id?: string
  /** Server-computed; drives which buttons the UI shows. */
  allowed_actions?: JEAction[]
  approval_status?: string | null
  /** Present while an approval request is open. */
  approval_progress?: { levels_required: number; levels_approved: number }
  /** Why the current user can't approve/reject this entry (they raised it / already signed a level). */
  approval_blocked_reason?: string | null
  reversed_by_id?: string | null
  reversed_by_entry_no?: string | null
  reverses_id?: string | null
  reverses_entry_no?: string | null
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
