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

// ── Exchange Rates ─────────────────────────────────────────────────────────
export const listExchangeRates = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/exchange-rates`, { params }).then(r => r.data)
export const createExchangeRate = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/exchange-rates`, data).then(r => r.data)

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
