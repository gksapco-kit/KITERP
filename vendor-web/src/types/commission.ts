// types/commission.ts

export type PayeeLinkType = 'vendor_user' | 'supplier' | 'customer' | 'external'
export type PayeeStatus = 'active' | 'inactive' | 'suspended'
export type PlanStatus = 'active' | 'inactive' | 'draft'
export type CalcType = 'percentage' | 'flat' | 'points' | 'tiered' | 'time_based' | 'revenue_based' | 'count_based' | 'equity'
export type AccrualStatus = 'draft' | 'accrued' | 'approved' | 'paid' | 'reversed' | 'disputed'
export type PayoutRunStatus = 'open' | 'approved' | 'paid' | 'cancelled'

export interface CommissionPayee {
  id: string
  vendor_id: string
  code?: string
  display_name: string
  phone?: string
  email?: string
  external_user_id?: string
  link_type: PayeeLinkType
  vendor_user_id?: string
  supplier_id?: string
  customer_id?: string
  default_payout_method: string
  currency: string
  status: PayeeStatus
  settings: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

export interface TierRow { from: number; to?: number; rate?: number; flat?: number }

export interface CommissionRule {
  id: string
  plan_id: string
  vendor_id: string
  name?: string
  priority: number
  is_active: boolean
  applies_to: string
  product_id?: string
  service_id?: string
  category_id?: string
  uom?: string
  store_id?: string
  customer_group?: string
  channel: string
  event_tag?: string
  team_id?: string
  min_qty?: number
  min_amount?: number
  window_type: string
  period?: string
  revenue_threshold?: number
  count_threshold?: number
  calculation_type: CalcType
  value_numeric?: number
  value_currency?: number
  points_per_unit?: number
  equity_units?: number
  tier_table?: TierRow[]
  time_rate?: Record<string, unknown>
  cap_amount?: number
  floor_amount?: number
  payee_share_percent?: number
  created_at?: string
  updated_at?: string
}

export interface CommissionPlan {
  id: string
  vendor_id: string
  code: string
  name: string
  description?: string
  status: PlanStatus
  effective_from?: string
  effective_to?: string
  payee_scope: string
  priority: number
  stackable: boolean
  settings: Record<string, unknown>
  rules?: CommissionRule[]
  created_at?: string
  updated_at?: string
}

export interface CommissionAssignment {
  id: string
  vendor_id: string
  plan_id: string
  payee_id: string
  store_id?: string
  team_id?: string
  location?: string
  group_name?: string
  valid_from?: string
  valid_to?: string
  weight_percent: number
  is_active: boolean
  notes?: string
  created_at?: string
  /** Enriched by GET /assignments */
  payee_display_name?: string
  payee_link_type?: PayeeLinkType
  payee_email?: string
  payee_phone?: string
  plan_name?: string
  plan_code?: string
  employee_id?: string | null
}

export interface CommissionAccrual {
  id: string
  vendor_id: string
  payee_id: string
  plan_id?: string
  rule_id?: string
  assignment_id?: string
  source_type: string
  source_id: string
  source_line_ref?: string
  sale_date: string
  store_id?: string
  channel?: string
  base_amount: number
  calculation_type: CalcType
  value_applied?: number
  commission_amount: number
  points_amount: number
  equity_units_amount: number
  currency: string
  status: AccrualStatus
  payout_item_id?: string
  gl_entry_id?: string
  reversal_of?: string
  created_by_id?: string
  approved_by_id?: string
  approved_at?: string
  notes?: string
  created_at?: string
}

export interface CommissionPayoutItem {
  id: string
  run_id: string
  payee_id: string
  total_amount: number
  total_points: number
  total_equity: number
  accrual_count: number
  status: string
  payment_ref?: string
  paid_at?: string
  created_at?: string
}

export interface CommissionPayoutRun {
  id: string
  vendor_id: string
  run_no: string
  period_start?: string
  period_end?: string
  status: PayoutRunStatus
  total_amount: number
  total_points: number
  payee_count: number
  payment_method?: string
  gl_entry_id?: string
  notes?: string
  created_by_id?: string
  approved_by_id?: string
  approved_at?: string
  paid_at?: string
  created_at?: string
  items?: CommissionPayoutItem[]
}

export interface CommissionSummary {
  total_accrued: number
  total_paid: number
  pending_approval: number
  avg_per_sale: number
  top_payee_id?: string
  top_payee_amount: number
  sale_count: number
}

export interface ByPayeeRow {
  payee_id: string
  payee_name: string
  total_commission: number
  total_base: number
  count: number
}

export interface TrendRow { period: string; total: number; count: number }

export interface BySourceResult {
  by_channel: { channel: string; total: number; count: number }[]
  by_source_type: { source_type: string; total: number; count: number }[]
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}
