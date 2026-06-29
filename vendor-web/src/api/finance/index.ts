import axios from '@/lib/axios'
import type {
  Company, CostCenter, Project, IntercompanyPartner,
  AccountSearchResult, RefDocResult,
} from '@/types/finance'

const BASE = '/vendors/me/finance'

// ── Setup ──────────────────────────────────────────────────────────────────
export const seedCOA = () => axios.post(`${BASE}/setup/seed-coa`)

// ── Chart of Accounts ──────────────────────────────────────────────────────
export const listAccounts = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/coa`, { params }).then(r => r.data)
export const createAccount = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/coa`, data).then(r => r.data)
export const updateAccount = (id: string, data: Record<string, unknown>) =>
  axios.put(`${BASE}/coa/${id}`, data).then(r => r.data)
export const searchAccounts = (params: { q?: string; company_id?: string; account_type?: string; limit?: number }) =>
  axios.get(`${BASE}/coa/search`, { params }).then(r => r.data as AccountSearchResult[])

// ── Multi-company ──────────────────────────────────────────────────────────
export const listCompanies = () =>
  axios.get(`${BASE}/companies`).then(r => r.data as Company[])
export const createCompany = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/companies`, data).then(r => r.data as Company)
export const updateCompany = (id: string, data: Record<string, unknown>) =>
  axios.patch(`${BASE}/companies/${id}`, data).then(r => r.data as Company)

// ── Cost Centres ───────────────────────────────────────────────────────────
export const listCostCenters = (params?: { company_id?: string }) =>
  axios.get(`${BASE}/cost-centers`, { params }).then(r => r.data as CostCenter[])
export const createCostCenter = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/cost-centers`, data).then(r => r.data as CostCenter)
export const updateCostCenter = (id: string, data: Record<string, unknown>) =>
  axios.patch(`${BASE}/cost-centers/${id}`, data).then(r => r.data as CostCenter)
export const deleteCostCenter = (id: string) =>
  axios.delete(`${BASE}/cost-centers/${id}`)

// ── Projects ───────────────────────────────────────────────────────────────
export const listProjects = (params?: { company_id?: string; status?: string }) =>
  axios.get(`${BASE}/projects`, { params }).then(r => r.data as Project[])
export const createProject = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/projects`, data).then(r => r.data as Project)

// ── Intercompany ───────────────────────────────────────────────────────────
export const listIntercompanyPartners = (params?: { company_id?: string }) =>
  axios.get(`${BASE}/intercompany-partners`, { params }).then(r => r.data as IntercompanyPartner[])

// ── Reference docs ─────────────────────────────────────────────────────────
export const searchReferenceDocs = (params: { doc_type: string; q?: string }) =>
  axios.get(`${BASE}/reference-docs/search`, { params }).then(r => r.data as RefDocResult[])

// ── Fiscal Years & Periods ─────────────────────────────────────────────────
export const listFiscalYears = (params?: { company_id?: string }) =>
  axios.get(`${BASE}/fiscal-years`, { params }).then(r => r.data)
export const createFiscalYear = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/fiscal-years`, data).then(r => r.data)
/** Attach an existing fiscal year variant to more business units (shared calendar, no duplicate period rows). */
export const assignFiscalYearCompanies = (
  fyId: string,
  data: { company_ids: string[]; is_current?: boolean }
) => axios.post(`${BASE}/fiscal-years/${fyId}/companies`, data).then(r => r.data)
/** Add an audit / adjustment date window inside a fiscal year (see POST /fiscal-years with template for create-time audit slots). */
export const addFiscalYearAuditPeriod = (fyId: string, data: { name: string; start_date: string; end_date: string }) =>
  axios.post(`${BASE}/fiscal-years/${fyId}/audit-periods`, data).then(r => r.data)
export const listPeriods = (fyId: string) =>
  axios.get(`${BASE}/fiscal-years/${fyId}/periods`).then(r => r.data)
export const closePeriod = (periodId: string) =>
  axios.post(`${BASE}/periods/${periodId}/close`).then(r => r.data)
export const lockPeriod = (periodId: string) =>
  axios.post(`${BASE}/periods/${periodId}/lock`).then(r => r.data)
export const reopenPeriod = (periodId: string) =>
  axios.post(`${BASE}/periods/${periodId}/reopen`).then(r => r.data)

// ── GL field configuration ────────────────────────────────────────────────
export const listFieldRules = (params?: { entity_type?: string }) =>
  axios.get(`${BASE}/field-rules`, { params }).then(r => r.data)
export const getEffectiveFieldRules = (params?: { entity_type?: string; company_id?: string }) =>
  axios.get(`${BASE}/field-rules/effective`, { params }).then(r => r.data as { entity_type: string; fields: Record<string, string> })
export const createFieldRule = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/field-rules`, data).then(r => r.data)
export const updateFieldRule = (id: string, data: Record<string, unknown>) =>
  axios.put(`${BASE}/field-rules/${id}`, data).then(r => r.data)
export const deleteFieldRule = (id: string) =>
  axios.delete(`${BASE}/field-rules/${id}`).then(r => r.data)


// ── Journal Entries ────────────────────────────────────────────────────────
export const listJournalEntries = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/journal-entries`, { params }).then(r => r.data)
export const getJournalEntry = (id: string) =>
  axios.get(`${BASE}/journal-entries/${id}`).then(r => r.data)
export const createJournalEntry = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/journal-entries`, data).then(r => r.data)
export const updateJournalEntry = (id: string, data: Record<string, unknown>) =>
  axios.put(`${BASE}/journal-entries/${id}`, data).then(r => r.data)
export const postJournalEntry = (id: string) =>
  axios.post(`${BASE}/journal-entries/${id}/post`).then(r => r.data)
export const voidJournalEntry = (id: string) =>
  axios.post(`${BASE}/journal-entries/${id}/void`).then(r => r.data)
export const postManualJournal = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/journal/manual`, data).then(r => r.data)
export const getTrialBalance = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/trial-balance`, { params }).then(r => r.data)
export const getAccountLedger = (accountId: string, params?: Record<string, unknown>) =>
  axios.get(`${BASE}/ledger/${accountId}`, { params }).then(r => r.data)
export const getPartyLedger = (partyType: string, partyId: string, params?: Record<string, unknown>) =>
  axios.get(`${BASE}/ledger/party/${partyType}/${partyId}`, { params }).then(r => r.data)
export const getCostCenterLedger = (costCenterId: string, params?: Record<string, unknown>) =>
  axios.get(`${BASE}/ledger/cost-center/${costCenterId}`, { params }).then(r => r.data)
export const getLedgerSummary = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/ledger/summary`, { params }).then(r => r.data)

// ── AR ─────────────────────────────────────────────────────────────────────
export const getArAging = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/ar/aging`, { params }).then(r => r.data)
export const applyPayment = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/ar/apply-payment`, data).then(r => r.data)
export const listPaymentApplications = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/ar/applications`, { params }).then(r => r.data)

// ── AP ─────────────────────────────────────────────────────────────────────
export const listBills = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/ap/bills`, { params }).then(r => r.data)
export const getBill = (id: string) =>
  axios.get(`${BASE}/ap/bills/${id}`).then(r => r.data)
export const createBill = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/ap/bills`, data).then(r => r.data)
export const updateBill = (id: string, data: Record<string, unknown>) =>
  axios.put(`${BASE}/ap/bills/${id}`, data).then(r => r.data)
export const postBill = (id: string) =>
  axios.post(`${BASE}/ap/bills/${id}/post`).then(r => r.data)
export const recordVendorPayment = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/ap/payments`, data).then(r => r.data)
export const getApAging = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/ap/aging`, { params }).then(r => r.data)
export const listPaymentRuns = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/ap/payment-runs`, { params }).then(r => r.data)
export const createPaymentRun = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/ap/payment-runs`, data).then(r => r.data)

// ── Bank ───────────────────────────────────────────────────────────────────
export const listBankAccounts = () =>
  axios.get(`${BASE}/bank/accounts`).then(r => r.data)
export const createBankAccount = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/bank/accounts`, data).then(r => r.data)
export const updateBankAccount = (id: string, data: Record<string, unknown>) =>
  axios.put(`${BASE}/bank/accounts/${id}`, data).then(r => r.data)
export const listStatements = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/bank/statements`, { params }).then(r => r.data)
export const createStatement = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/bank/statements`, data).then(r => r.data)
export const uploadStatementCSV = (bankAccountId: string, file: File) => {
  const form = new FormData()
  form.append('file', file)
  return axios.post(`${BASE}/bank/statements/upload-csv?bank_account_id=${bankAccountId}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}
export const listReconciliations = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/bank/reconciliations`, { params }).then(r => r.data)
export const createReconciliation = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/bank/reconciliations`, data).then(r => r.data)
export const autoMatchReconciliation = (id: string, data: Record<string, unknown>) =>
  axios.post(`${BASE}/bank/reconciliations/${id}/auto-match`, data).then(r => r.data)

// ── Budgets & Forecasts ────────────────────────────────────────────────────
export const listBudgets = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/budgets`, { params }).then(r => r.data)
export const createBudget = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/budgets`, data).then(r => r.data)
export const updateBudget = (id: string, data: Record<string, unknown>) =>
  axios.put(`${BASE}/budgets/${id}`, data).then(r => r.data)
export const getBudgetVariance = (id: string) =>
  axios.get(`${BASE}/budgets/${id}/variance`).then(r => r.data)
export const listForecasts = () =>
  axios.get(`${BASE}/forecasts`).then(r => r.data)
export const createForecast = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/forecasts`, data).then(r => r.data)

// ── Fixed Assets ───────────────────────────────────────────────────────────
export const listAssetCategories = () =>
  axios.get(`${BASE}/assets/categories`).then(r => r.data)
export const createAssetCategory = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/assets/categories`, data).then(r => r.data)
export const listAssets = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/assets`, { params }).then(r => r.data)
export const getAsset = (id: string) =>
  axios.get(`${BASE}/assets/${id}`).then(r => r.data)
export const createAsset = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/assets`, data).then(r => r.data)
export const updateAsset = (id: string, data: Record<string, unknown>) =>
  axios.put(`${BASE}/assets/${id}`, data).then(r => r.data)
export const runDepreciation = (id: string) =>
  axios.post(`${BASE}/assets/${id}/depreciate`).then(r => r.data)
export const disposeAsset = (id: string, data: Record<string, unknown>) =>
  axios.post(`${BASE}/assets/${id}/dispose`, data).then(r => r.data)
export const listMaintenance = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/assets/maintenance`, { params }).then(r => r.data)
export const createMaintenance = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/assets/maintenance`, data).then(r => r.data)

// ── Tax ────────────────────────────────────────────────────────────────────
export const listTaxCodes = () =>
  axios.get(`${BASE}/tax/codes`).then(r => r.data)
export const createTaxCode = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/tax/codes`, data).then(r => r.data)
export const listTaxReturns = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/tax/returns`, { params }).then(r => r.data)
export const createTaxReturn = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/tax/returns`, data).then(r => r.data)
export const computeTaxReturn = (id: string) =>
  axios.post(`${BASE}/tax/returns/${id}/compute`).then(r => r.data)
export const fileTaxReturn = (id: string, data: Record<string, unknown>) =>
  axios.post(`${BASE}/tax/returns/${id}/file`, data).then(r => r.data)

// ── Reports ────────────────────────────────────────────────────────────────
export const getProfitLoss = (params: Record<string, unknown>) =>
  axios.get(`${BASE}/reports/profit-loss`, { params }).then(r => r.data)
export const getBalanceSheet = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/reports/balance-sheet`, { params }).then(r => r.data)
export const getCashFlow = (params: Record<string, unknown>) =>
  axios.get(`${BASE}/reports/cash-flow`, { params }).then(r => r.data)
export const getCostAnalysis = (params: Record<string, unknown>) =>
  axios.get(`${BASE}/reports/cost-analysis`, { params }).then(r => r.data)
export const getFinanceDashboard = () =>
  axios.get(`${BASE}/reports/dashboard`).then(r => r.data)

// ── Capital ────────────────────────────────────────────────────────────────
export const listLoans = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/capital/loans`, { params }).then(r => r.data)
export const getLoan = (id: string) =>
  axios.get(`${BASE}/capital/loans/${id}`).then(r => r.data)
export const createLoan = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/capital/loans`, data).then(r => r.data)
export const generateLoanSchedule = (id: string) =>
  axios.post(`${BASE}/capital/loans/${id}/generate-schedule`).then(r => r.data)
export const listInvestments = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/capital/investments`, { params }).then(r => r.data)
export const createInvestment = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/capital/investments`, data).then(r => r.data)
export const addValuation = (invId: string, data: Record<string, unknown>) =>
  axios.post(`${BASE}/capital/investments/${invId}/valuations`, data).then(r => r.data)
export const getInvestmentROI = (invId: string) =>
  axios.get(`${BASE}/capital/investments/${invId}/roi`).then(r => r.data)

// ── Controls ───────────────────────────────────────────────────────────────
export const listApprovalPolicies = () =>
  axios.get(`${BASE}/controls/policies`).then(r => r.data)
export const createApprovalPolicy = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/controls/policies`, data).then(r => r.data)
export const listApprovals = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/controls/approvals`, { params }).then(r => r.data)
export const createApprovalRequest = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/controls/approvals`, data).then(r => r.data)
export const approveRequest = (id: string, data: Record<string, unknown>) =>
  axios.post(`${BASE}/controls/approvals/${id}/approve`, data).then(r => r.data)
export const rejectRequest = (id: string, data: Record<string, unknown>) =>
  axios.post(`${BASE}/controls/approvals/${id}/reject`, data).then(r => r.data)
export const listAuditLog = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/audit-log`, { params }).then(r => r.data)

// ── Financial Statement Versions (FSV) ────────────────────────────────────
export const seedFSV = () => axios.post(`${BASE}/fsv/seed`).then(r => r.data)
export const listFSV = (params?: { statement_type?: string }) =>
  axios.get(`${BASE}/fsv`, { params }).then(r => r.data as FsvVersion[])
export const createFSV = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/fsv`, data).then(r => r.data as FsvVersion)
export const updateFSV = (id: string, data: Record<string, unknown>) =>
  axios.put(`${BASE}/fsv/${id}`, data).then(r => r.data as FsvVersion)
export const deleteFSV = (id: string) =>
  axios.delete(`${BASE}/fsv/${id}`)

export const listFsvNodes = (versionId: string) =>
  axios.get(`${BASE}/fsv/${versionId}/nodes`).then(r => r.data as FsvNode[])
export const createFsvNode = (versionId: string, data: Record<string, unknown>) =>
  axios.post(`${BASE}/fsv/${versionId}/nodes`, data).then(r => r.data as FsvNode)
export const updateFsvNode = (versionId: string, nodeId: string, data: Record<string, unknown>) =>
  axios.put(`${BASE}/fsv/${versionId}/nodes/${nodeId}`, data).then(r => r.data as FsvNode)
export const deleteFsvNode = (versionId: string, nodeId: string) =>
  axios.delete(`${BASE}/fsv/${versionId}/nodes/${nodeId}`)
export const addFsvNodeAccount = (versionId: string, nodeId: string, data: Record<string, unknown>) =>
  axios.post(`${BASE}/fsv/${versionId}/nodes/${nodeId}/accounts`, data).then(r => r.data)
export const removeFsvNodeAccount = (versionId: string, nodeId: string, assignmentId: string) =>
  axios.delete(`${BASE}/fsv/${versionId}/nodes/${nodeId}/accounts/${assignmentId}`)

export const computeFSV = (versionId: string, params?: { from_date?: string; to_date?: string }) =>
  axios.get(`${BASE}/fsv/${versionId}/compute`, { params }).then(r => r.data as FsvResult)

// FSV types
export type FsvVersion = {
  id: string; vendor_id: string; name: string; statement_type: string
  description: string | null; is_default: boolean; created_at: string
}
export type FsvNode = {
  id: string; version_id: string; name: string; node_type: string
  sort_order: number; sign_flip: boolean; bold: boolean
  indent_level: number; parent_id: string | null
  account_assignments: { id: string; account_id: string | null; code_from: string | null; code_to: string | null }[]
}
export type FsvResultRow = {
  node_id: string; name: string; node_type: string
  indent_level: number; bold: boolean; sign_flip: boolean
  value: number; account_count: number
}
export type FsvResult = {
  version_id: string; version_name: string; statement_type: string
  from_date: string; to_date: string; rows: FsvResultRow[]
}
export const getOpenItems = (params: {
  account_id: string
  party_type?: string
  party_id?: string
  include_partial?: boolean
}) => axios.get(`${BASE}/gl/open-items`, { params }).then(r => r.data as OpenItem[])

export const clearOpenItems = (data: {
  line_ids: string[]
  clearing_date: string
  notes?: string
}) => axios.post(`${BASE}/gl/open-items/clear`, data).then(r => r.data)

export const resetClearing = (batchId: string) =>
  axios.delete(`${BASE}/gl/open-items/clear/${batchId}`).then(r => r.data)

export const listClearingBatches = (params?: {
  account_id?: string
  party_type?: string
  party_id?: string
  skip?: number
  limit?: number
}) => axios.get(`${BASE}/gl/clearing-batches`, { params }).then(r => r.data as ClearingBatch[])

// ── Types (local to this file) ──────────────────────────────────────────────
export type OpenItem = {
  id: string
  journal_entry_id: string
  entry_no: string
  entry_date: string
  account_id: string
  party_type: string | null
  party_id: string | null
  debit: number
  credit: number
  currency: string
  narration: string
  ref_doc_type: string | null
  ref_doc_no: string | null
  assignment: string | null
  open_item_status: 'open' | 'partial' | 'cleared'
  source_type: string
}

export type ClearingBatch = {
  id: string
  vendor_id: string
  account_id: string
  clearing_ref: string
  clearing_date: string
  party_type: string | null
  party_id: string | null
  line_count: number
  total_debit: number
  total_credit: number
  notes: string | null
  created_at: string
}

// ── Posting Keys ─────────────────────────────────────────────────────────────
export interface PostingKey {
  id: string
  code: string
  name: string
  side: 'debit' | 'credit'
  account_type: string | null
  reversal_key: string | null
  is_active: boolean
}

export const seedPostingKeys = () =>
  axios.post(`${BASE}/posting-keys/seed`).then(r => r.data)
export const listPostingKeys = () =>
  axios.get(`${BASE}/posting-keys`).then(r => r.data as PostingKey[])
export const createPostingKey = (data: Omit<PostingKey, 'id' | 'is_active'>) =>
  axios.post(`${BASE}/posting-keys`, data).then(r => r.data as PostingKey)
export const deletePostingKey = (id: string) =>
  axios.delete(`${BASE}/posting-keys/${id}`)

// ── Field Status Groups ───────────────────────────────────────────────────────
export interface FieldStatusRule {
  field_name: string
  status: 'required' | 'optional' | 'suppressed'
}
export interface FieldStatusGroup {
  id: string
  code: string
  name: string
  rules: FieldStatusRule[]
}

export const seedFieldStatusGroups = () =>
  axios.post(`${BASE}/field-status-groups/seed`).then(r => r.data)
export const listFieldStatusGroups = () =>
  axios.get(`${BASE}/field-status-groups`).then(r => r.data as FieldStatusGroup[])
export const createFieldStatusGroup = (data: Omit<FieldStatusGroup, 'id'>) =>
  axios.post(`${BASE}/field-status-groups`, data).then(r => r.data as FieldStatusGroup)
export const deleteFieldStatusGroup = (id: string) =>
  axios.delete(`${BASE}/field-status-groups/${id}`)

// ── Tolerance Groups ──────────────────────────────────────────────────────────
export interface ToleranceGroup {
  id: string
  code: string
  name: string
  max_line_amount: number | null
  max_document_amount: number | null
  payment_diff_abs: number | null
  payment_diff_pct: number | null
  currency: string
}

export const seedToleranceGroup = () =>
  axios.post(`${BASE}/tolerance-groups/seed`).then(r => r.data)
export const listToleranceGroups = () =>
  axios.get(`${BASE}/tolerance-groups`).then(r => r.data as ToleranceGroup[])
export const createToleranceGroup = (data: Omit<ToleranceGroup, 'id'>) =>
  axios.post(`${BASE}/tolerance-groups`, data).then(r => r.data as ToleranceGroup)
export const updateToleranceGroup = (id: string, data: Omit<ToleranceGroup, 'id'>) =>
  axios.put(`${BASE}/tolerance-groups/${id}`, data).then(r => r.data as ToleranceGroup)
export const deleteToleranceGroup = (id: string) =>
  axios.delete(`${BASE}/tolerance-groups/${id}`)

// ── Profit Centers ────────────────────────────────────────────────────────────
export interface ProfitCenter {
  id: string
  code: string
  name: string
  description: string | null
  parent_id: string | null
  manager: string | null
  is_active: boolean
}
export interface PnlRow {
  dimension_id: string | null
  dimension_name: string
  income: number
  expense: number
  net: number
}

export const listProfitCenters = () =>
  axios.get(`${BASE}/profit-centers`).then(r => r.data as ProfitCenter[])
export const createProfitCenter = (data: Omit<ProfitCenter, 'id' | 'is_active'>) =>
  axios.post(`${BASE}/profit-centers`, data).then(r => r.data as ProfitCenter)
export const updateProfitCenter = (id: string, data: Omit<ProfitCenter, 'id' | 'is_active'>) =>
  axios.put(`${BASE}/profit-centers/${id}`, data).then(r => r.data as ProfitCenter)
export const deleteProfitCenter = (id: string) =>
  axios.delete(`${BASE}/profit-centers/${id}`)
export const getProfitCenterPnl = (params: { from_date: string; to_date: string }) =>
  axios.get(`${BASE}/profit-centers/pnl`, { params }).then(r => r.data as PnlRow[])

// ── Segments ──────────────────────────────────────────────────────────────────
export interface Segment {
  id: string
  code: string
  name: string
  description: string | null
  is_active: boolean
}

export const listSegments = () =>
  axios.get(`${BASE}/segments`).then(r => r.data as Segment[])
export const createSegment = (data: Omit<Segment, 'id' | 'is_active'>) =>
  axios.post(`${BASE}/segments`, data).then(r => r.data as Segment)
export const deleteSegment = (id: string) =>
  axios.delete(`${BASE}/segments/${id}`)
export const getSegmentPnl = (params: { from_date: string; to_date: string }) =>
  axios.get(`${BASE}/segments/pnl`, { params }).then(r => r.data as PnlRow[])

// ── Exchange Rates ────────────────────────────────────────────────────────────
export interface ExchangeRate {
  id: string
  from_currency: string
  to_currency: string
  rate: string
  rate_date: string
  rate_type: string
}
export interface FxRevalRun {
  id: string
  currency: string
  run_date: string
  rate_used: string
  total_gain: string
  total_loss: string
  status: string
  created_at: string | null
}
export interface CarryForwardEntry {
  id: string
  account_id: string
  from_fiscal_year: number
  to_fiscal_year: number
  closing_balance: string
  carried_forward_at: string | null
}

export const upsertExchangeRate = (data: { from_currency: string; to_currency: string; rate: number; rate_date: string; rate_type?: string }) =>
  axios.post(`${BASE}/fx/rates`, data).then(r => r.data as ExchangeRate)
export const listExchangeRates = (params?: { from_currency?: string; to_currency?: string }) =>
  axios.get(`${BASE}/fx/rates`, { params }).then(r => r.data as ExchangeRate[])
export const simulateFxReval = (data: { currency: string; run_date: string; local_currency?: string; rate_type?: string }) =>
  axios.post(`${BASE}/fx/reval/simulate`, data).then(r => r.data as FxRevalRun)
export const listFxRevalRuns = () =>
  axios.get(`${BASE}/fx/reval`).then(r => r.data as FxRevalRun[])
export const runCarryForward = (data: { from_fiscal_year: number; to_fiscal_year: number }) =>
  axios.post(`${BASE}/fx/carry-forward`, data).then(r => r.data)
export const listCarryForwards = (fiscal_year?: number) =>
  axios.get(`${BASE}/fx/carry-forward`, { params: fiscal_year ? { fiscal_year } : undefined }).then(r => r.data as CarryForwardEntry[])

// ── Validation Rules ──────────────────────────────────────────────────────────
export interface ValidationRule {
  id: string
  name: string
  description: string | null
  call_point: string
  prerequisite_expr: string | null
  check_expr: string
  error_message: string
  is_active: boolean
  sort_order: number
}
export const listValidations = () => axios.get(`${BASE}/validations`).then(r => r.data as ValidationRule[])
export const createValidation = (data: Omit<ValidationRule, 'id' | 'is_active'>) => axios.post(`${BASE}/validations`, data).then(r => r.data as ValidationRule)
export const updateValidation = (id: string, data: Omit<ValidationRule, 'id' | 'is_active'>) => axios.put(`${BASE}/validations/${id}`, data).then(r => r.data as ValidationRule)
export const deleteValidation = (id: string) => axios.delete(`${BASE}/validations/${id}`)

// ── Substitution Rules ────────────────────────────────────────────────────────
export interface SubstitutionRule {
  id: string
  name: string
  description: string | null
  call_point: string
  prerequisite_expr: string | null
  target_field: string
  substitution_expr: string
  is_active: boolean
  sort_order: number
}
export const listSubstitutions = () => axios.get(`${BASE}/substitutions`).then(r => r.data as SubstitutionRule[])
export const createSubstitution = (data: Omit<SubstitutionRule, 'id' | 'is_active'>) => axios.post(`${BASE}/substitutions`, data).then(r => r.data as SubstitutionRule)
export const deleteSubstitution = (id: string) => axios.delete(`${BASE}/substitutions/${id}`)

// ── Number Ranges ─────────────────────────────────────────────────────────────
export interface NumberRange {
  id: string
  document_type: string
  fiscal_year: number
  number_from: number
  number_to: number
  current_number: number
  prefix: string | null
  is_external: boolean
}
export const seedNumberRanges = (fiscal_year: number) => axios.post(`${BASE}/number-ranges/seed`, null, { params: { fiscal_year } }).then(r => r.data)
export const listNumberRanges = () => axios.get(`${BASE}/number-ranges`).then(r => r.data as NumberRange[])
export const createNumberRange = (data: Omit<NumberRange, 'id' | 'current_number'>) => axios.post(`${BASE}/number-ranges`, data).then(r => r.data as NumberRange)

// ── Document Splitting ────────────────────────────────────────────────────────
export interface SplitRule {
  id: string
  name: string
  dimension: string
  split_method: string
  is_active: boolean
  base_account_types: string[]
}
export interface SplitItem {
  id: string
  journal_line_id: string
  profit_center_id: string | null
  segment_id: string | null
  cost_center_id: string | null
  debit: string
  credit: string
  split_pct: string
}

export const listSplitRules = () => axios.get(`${BASE}/split-rules`).then(r => r.data as SplitRule[])
export const createSplitRule = (data: Omit<SplitRule, 'id' | 'is_active'>) => axios.post(`${BASE}/split-rules`, data).then(r => r.data as SplitRule)
export const deleteSplitRule = (id: string) => axios.delete(`${BASE}/split-rules/${id}`)
export const getSplitItems = (jeId: string) => axios.get(`${BASE}/split-items/${jeId}`).then(r => r.data as SplitItem[])
export const applyDocumentSplit = (jeId: string) => axios.post(`${BASE}/split-rules/apply/${jeId}`).then(r => r.data)

// ── Parallel Ledgers ──────────────────────────────────────────────────────────
export interface Ledger {
  id: string
  code: string
  name: string
  description: string | null
  is_leading: boolean
  currency: string
  is_active: boolean
}
export interface LedgerAssignment {
  id: string
  ledger_id: string
  company_id: string
  is_active: boolean
}
export interface LedgerTrialBalanceRow {
  account_id: string
  account_code: string
  account_name: string
  account_type: string
  debit: string
  credit: string
  net: string
}

export const listLedgers = () => axios.get(`${BASE}/ledgers`).then(r => r.data as Ledger[])
export const createLedger = (data: Omit<Ledger, 'id' | 'is_active'>) => axios.post(`${BASE}/ledgers`, data).then(r => r.data as Ledger)
export const updateLedger = (id: string, data: Partial<Ledger>) => axios.patch(`${BASE}/ledgers/${id}`, data).then(r => r.data as Ledger)
export const deleteLedger = (id: string) => axios.delete(`${BASE}/ledgers/${id}`)
export const listLedgerAssignments = (params?: { company_id?: string; ledger_id?: string }) =>
  axios.get(`${BASE}/ledger-assignments`, { params }).then(r => r.data as LedgerAssignment[])
export const assignLedger = (data: { ledger_id: string; company_id: string }) =>
  axios.post(`${BASE}/ledger-assignments`, data).then(r => r.data as LedgerAssignment)
export const removeAssignment = (id: string) => axios.delete(`${BASE}/ledger-assignments/${id}`)
export const getLedgerTrialBalance = (ledgerId: string, fiscalYearId?: string) =>
  axios.get(`${BASE}/ledger-trial-balance/${ledgerId}`, { params: fiscalYearId ? { fiscal_year_id: fiscalYearId } : {} })
    .then(r => r.data as LedgerTrialBalanceRow[])






