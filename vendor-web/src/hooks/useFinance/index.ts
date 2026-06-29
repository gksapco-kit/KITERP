import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/finance'

// ── Keys ───────────────────────────────────────────────────────────────────
export const finKeys = {
  dashboard: ['finance', 'dashboard'] as const,
  accounts: (p?: Record<string, unknown>) => ['finance', 'accounts', p] as const,
  fiscalYears: (companyId?: string | null) =>
    ['finance', 'fiscal-years', companyId ?? 'all'] as const,
  periods: (fyId: string) => ['finance', 'periods', fyId] as const,
  exchangeRates: (p?: Record<string, unknown>) => ['finance', 'exchange-rates', p] as const,
  journalEntries: (p?: Record<string, unknown>) => ['finance', 'journal-entries', p] as const,
  journalEntry: (id: string) => ['finance', 'journal-entry', id] as const,
  trialBalance: (p?: Record<string, unknown>) => ['finance', 'trial-balance', p] as const,
  ledger: (accountId: string, p?: Record<string, unknown>) => ['finance', 'ledger', accountId, p] as const,
  arAging: (p?: Record<string, unknown>) => ['finance', 'ar-aging', p] as const,
  bills: (p?: Record<string, unknown>) => ['finance', 'bills', p] as const,
  bill: (id: string) => ['finance', 'bill', id] as const,
  apAging: (p?: Record<string, unknown>) => ['finance', 'ap-aging', p] as const,
  paymentRuns: (p?: Record<string, unknown>) => ['finance', 'payment-runs', p] as const,
  bankAccounts: ['finance', 'bank-accounts'] as const,
  statements: (p?: Record<string, unknown>) => ['finance', 'statements', p] as const,
  reconciliations: (p?: Record<string, unknown>) => ['finance', 'reconciliations', p] as const,
  budgets: (p?: Record<string, unknown>) => ['finance', 'budgets', p] as const,
  budgetVariance: (id: string) => ['finance', 'budget-variance', id] as const,
  forecasts: ['finance', 'forecasts'] as const,
  assetCategories: ['finance', 'asset-categories'] as const,
  assets: (p?: Record<string, unknown>) => ['finance', 'assets', p] as const,
  asset: (id: string) => ['finance', 'asset', id] as const,
  taxCodes: ['finance', 'tax-codes'] as const,
  taxReturns: (p?: Record<string, unknown>) => ['finance', 'tax-returns', p] as const,
  pnl: (p?: Record<string, unknown>) => ['finance', 'pnl', p] as const,
  balanceSheet: (p?: Record<string, unknown>) => ['finance', 'balance-sheet', p] as const,
  cashFlow: (p?: Record<string, unknown>) => ['finance', 'cash-flow', p] as const,
  costAnalysis: (p?: Record<string, unknown>) => ['finance', 'cost-analysis', p] as const,
  loans: (p?: Record<string, unknown>) => ['finance', 'loans', p] as const,
  loan: (id: string) => ['finance', 'loan', id] as const,
  investments: (p?: Record<string, unknown>) => ['finance', 'investments', p] as const,
  approvalPolicies: ['finance', 'approval-policies'] as const,
  approvals: (p?: Record<string, unknown>) => ['finance', 'approvals', p] as const,
  auditLog: (p?: Record<string, unknown>) => ['finance', 'audit-log', p] as const,
  fieldRules: (p?: Record<string, unknown>) => ['finance', 'field-rules', p] as const,
  fieldRulesEffective: (p?: Record<string, unknown>) => ['finance', 'field-rules-effective', p] as const,
}

// ── Dashboard ──────────────────────────────────────────────────────────────
export const useFinanceDashboard = () =>
  useQuery({ queryKey: finKeys.dashboard, queryFn: api.getFinanceDashboard })

// ── Multi-company ──────────────────────────────────────────────────────────
export const useCompanies = () =>
  useQuery({ queryKey: ['finance', 'companies'], queryFn: api.listCompanies })

export const useCreateCompany = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.createCompany,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'companies'] }) })
}

export const useUpdateCompany = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.updateCompany(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'companies'] }),
  })
}

export const useCostCenters = (companyId?: string) =>
  useQuery({
    queryKey: ['finance', 'cost-centers', companyId],
    queryFn: () => api.listCostCenters(companyId ? { company_id: companyId } : undefined),
  })

export const useCreateCostCenter = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.createCostCenter,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'cost-centers'] }) })
}

export const useUpdateCostCenter = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.updateCostCenter(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'cost-centers'] }),
  })
}

export const useDeleteCostCenter = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteCostCenter(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'cost-centers'] }),
  })
}

export const useProjects = (companyId?: string) =>
  useQuery({
    queryKey: ['finance', 'projects', companyId],
    queryFn: () => api.listProjects(companyId ? { company_id: companyId } : undefined),
  })

export const useCreateProject = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.createProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'projects'] }) })
}

export const useIntercompanyPartners = (companyId?: string) =>
  useQuery({
    queryKey: ['finance', 'intercompany-partners', companyId],
    queryFn: () => api.listIntercompanyPartners(companyId ? { company_id: companyId } : undefined),
  })

export const useSearchAccounts = (q: string, companyId?: string) =>
  useQuery({
    queryKey: ['finance', 'account-search', q, companyId],
    queryFn: () => api.searchAccounts({ q, company_id: companyId }),
    enabled: true,
    staleTime: 30_000,
  })

// ── Journal Entry (enterprise) ─────────────────────────────────────────────
export const useUpdateJournalEntry = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.updateJournalEntry(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'journal-entries'] }),
  })
}

// ── COA ────────────────────────────────────────────────────────────────────
export const useAccounts = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: finKeys.accounts(params), queryFn: () => api.listAccounts(params) })

export const useCreateAccount = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.createAccount,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'accounts'] }) })
}

export const useUpdateAccount = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.updateAccount(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'accounts'] }),
  })
}

export const useSeedCOA = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.seedCOA,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance'] }) })
}

// ── Fiscal Years ───────────────────────────────────────────────────────────
export const useFiscalYears = (companyId?: string | null) =>
  useQuery({
    queryKey: finKeys.fiscalYears(companyId ?? undefined),
    queryFn: () =>
      api.listFiscalYears(
        companyId !== undefined && companyId !== null && companyId !== ''
          ? { company_id: companyId }
          : undefined,
      ),
    enabled: companyId !== '',
  })

/** All fiscal year variants (no company filter) — for assign dropdowns. */
export const useAllFiscalYears = () =>
  useQuery({
    queryKey: finKeys.fiscalYears('__all__'),
    queryFn: () => api.listFiscalYears(),
  })

export const useCreateFiscalYear = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createFiscalYear,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['finance', 'fiscal-years'] })
    },
  })
}

export const usePeriods = (fyId: string) =>
  useQuery({ queryKey: finKeys.periods(fyId), queryFn: () => api.listPeriods(fyId), enabled: !!fyId })

export const useFieldRules = (params?: { entity_type?: string }) =>
  useQuery({ queryKey: finKeys.fieldRules(params), queryFn: () => api.listFieldRules(params) })

export const useEffectiveFieldRules = (params?: { entity_type?: string; company_id?: string }) =>
  useQuery({
    queryKey: finKeys.fieldRulesEffective(params),
    queryFn: () => api.getEffectiveFieldRules(params),
  })

export const useCreateFieldRule = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createFieldRule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance', 'field-rules'] })
      qc.invalidateQueries({ queryKey: ['finance', 'field-rules-effective'] })
    },
  })
}

export const useUpdateFieldRule = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.updateFieldRule(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance', 'field-rules'] })
      qc.invalidateQueries({ queryKey: ['finance', 'field-rules-effective'] })
    },
  })
}

export const useDeleteFieldRule = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteFieldRule(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance', 'field-rules'] })
      qc.invalidateQueries({ queryKey: ['finance', 'field-rules-effective'] })
    },
  })
}

export const useLockPeriod = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.lockPeriod,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance', 'fiscal-years'] })
      qc.invalidateQueries({ queryKey: ['finance', 'periods'] })
    },
  })
}

export const useReopenPeriod = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.reopenPeriod,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance', 'fiscal-years'] })
      qc.invalidateQueries({ queryKey: ['finance', 'periods'] })
    },
  })
}

// ── Journal Entries ────────────────────────────────────────────────────────
export const useJournalEntries = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: finKeys.journalEntries(params), queryFn: () => api.listJournalEntries(params) })

export const useJournalEntry = (id: string) =>
  useQuery({ queryKey: finKeys.journalEntry(id), queryFn: () => api.getJournalEntry(id), enabled: !!id })

export const useCreateJournalEntry = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.createJournalEntry,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'journal-entries'] }) })
}

export const usePostJournalEntry = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.postJournalEntry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'journal-entries'] }) })
}

export const useVoidJournalEntry = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.voidJournalEntry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'journal-entries'] }) })
}

export const usePostManualJournal = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.postManualJournal,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'journal-entries'] }) })
}

export const useTrialBalance = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: finKeys.trialBalance(params), queryFn: () => api.getTrialBalance(params) })

export const useAccountLedger = (accountId: string, params?: Record<string, unknown>) =>
  useQuery({ queryKey: finKeys.ledger(accountId, params),
    queryFn: () => api.getAccountLedger(accountId, params), enabled: !!accountId })

export const usePartyLedger = (partyType: string, partyId: string, params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ['finance', 'ledger', 'party', partyType, partyId, params],
    queryFn: () => api.getPartyLedger(partyType, partyId, params),
    enabled: !!(partyType && partyId),
  })

export const useCostCenterLedger = (costCenterId: string, params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ['finance', 'ledger', 'cost-center', costCenterId, params],
    queryFn: () => api.getCostCenterLedger(costCenterId, params),
    enabled: !!costCenterId,
  })

export const useLedgerSummary = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ['finance', 'ledger', 'summary', params],
    queryFn: () => api.getLedgerSummary(params),
  })

// ── AR ─────────────────────────────────────────────────────────────────────
export const useArAging = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: finKeys.arAging(params), queryFn: () => api.getArAging(params) })

export const useApplyPayment = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.applyPayment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'ar'] }) })
}

// ── AP ─────────────────────────────────────────────────────────────────────
export const useBills = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: finKeys.bills(params), queryFn: () => api.listBills(params) })

export const useBill = (id: string) =>
  useQuery({ queryKey: finKeys.bill(id), queryFn: () => api.getBill(id), enabled: !!id })

export const useCreateBill = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.createBill,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'bills'] }) })
}

export const useUpdateBill = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.updateBill(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'bills'] }),
  })
}

export const usePostBill = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.postBill(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'bills'] }) })
}

export const useRecordVendorPayment = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.recordVendorPayment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'bills'] }) })
}

export const useApAging = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: finKeys.apAging(params), queryFn: () => api.getApAging(params) })

export const usePaymentRuns = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: finKeys.paymentRuns(params), queryFn: () => api.listPaymentRuns(params) })

export const useCreatePaymentRun = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.createPaymentRun,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'payment-runs'] }) })
}

// ── Bank ───────────────────────────────────────────────────────────────────
export const useBankAccounts = () =>
  useQuery({ queryKey: finKeys.bankAccounts, queryFn: api.listBankAccounts })

export const useCreateBankAccount = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.createBankAccount,
    onSuccess: () => qc.invalidateQueries({ queryKey: finKeys.bankAccounts }) })
}

export const useStatements = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: finKeys.statements(params), queryFn: () => api.listStatements(params) })

export const useCreateStatement = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.createStatement,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'statements'] }) })
}

export const useUploadStatementCSV = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ bankAccountId, file }: { bankAccountId: string; file: File }) =>
      api.uploadStatementCSV(bankAccountId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'statements'] }),
  })
}

export const useReconciliations = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: finKeys.reconciliations(params), queryFn: () => api.listReconciliations(params) })

export const useCreateReconciliation = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.createReconciliation,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'reconciliations'] }) })
}

export const useAutoMatch = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.autoMatchReconciliation(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'reconciliations'] }),
  })
}

// ── Budgets & Forecasts ────────────────────────────────────────────────────
export const useBudgets = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: finKeys.budgets(params), queryFn: () => api.listBudgets(params) })

export const useCreateBudget = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.createBudget,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'budgets'] }) })
}

export const useUpdateBudget = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.updateBudget(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'budgets'] }),
  })
}

export const useBudgetVariance = (id: string) =>
  useQuery({ queryKey: finKeys.budgetVariance(id), queryFn: () => api.getBudgetVariance(id), enabled: !!id })

export const useForecasts = () =>
  useQuery({ queryKey: finKeys.forecasts, queryFn: api.listForecasts })

export const useCreateForecast = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.createForecast,
    onSuccess: () => qc.invalidateQueries({ queryKey: finKeys.forecasts }) })
}

// ── Fixed Assets ───────────────────────────────────────────────────────────
export const useAssetCategories = () =>
  useQuery({ queryKey: finKeys.assetCategories, queryFn: api.listAssetCategories })

export const useCreateAssetCategory = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.createAssetCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: finKeys.assetCategories }) })
}

export const useAssets = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: finKeys.assets(params), queryFn: () => api.listAssets(params) })

export const useAsset = (id: string) =>
  useQuery({ queryKey: finKeys.asset(id), queryFn: () => api.getAsset(id), enabled: !!id })

export const useCreateAsset = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.createAsset,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'assets'] }) })
}

export const useUpdateAsset = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.updateAsset(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'assets'] }),
  })
}

export const useRunDepreciation = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.runDepreciation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'assets'] }) })
}

export const useDisposeAsset = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.disposeAsset(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'assets'] }),
  })
}

// ── Tax ────────────────────────────────────────────────────────────────────
export const useTaxCodes = () =>
  useQuery({ queryKey: finKeys.taxCodes, queryFn: api.listTaxCodes })

export const useCreateTaxCode = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.createTaxCode,
    onSuccess: () => qc.invalidateQueries({ queryKey: finKeys.taxCodes }) })
}

export const useTaxReturns = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: finKeys.taxReturns(params), queryFn: () => api.listTaxReturns(params) })

export const useCreateTaxReturn = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.createTaxReturn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'tax-returns'] }) })
}

export const useComputeTaxReturn = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.computeTaxReturn(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'tax-returns'] }) })
}

export const useFileTaxReturn = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.fileTaxReturn(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'tax-returns'] }),
  })
}

// ── Reports ────────────────────────────────────────────────────────────────
export const useProfitLoss = (params: Record<string, unknown>) =>
  useQuery({ queryKey: finKeys.pnl(params), queryFn: () => api.getProfitLoss(params), enabled: !!params.from_date })

export const useBalanceSheet = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: finKeys.balanceSheet(params), queryFn: () => api.getBalanceSheet(params) })

export const useCashFlow = (params: Record<string, unknown>) =>
  useQuery({ queryKey: finKeys.cashFlow(params), queryFn: () => api.getCashFlow(params), enabled: !!params.from_date })

export const useCostAnalysis = (params: Record<string, unknown>) =>
  useQuery({ queryKey: finKeys.costAnalysis(params), queryFn: () => api.getCostAnalysis(params), enabled: !!params.from_date })

// ── Capital ────────────────────────────────────────────────────────────────
export const useLoans = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: finKeys.loans(params), queryFn: () => api.listLoans(params) })

export const useLoan = (id: string) =>
  useQuery({ queryKey: finKeys.loan(id), queryFn: () => api.getLoan(id), enabled: !!id })

export const useCreateLoan = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.createLoan,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'loans'] }) })
}

export const useGenerateLoanSchedule = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.generateLoanSchedule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'loans'] }) })
}

export const useInvestments = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: finKeys.investments(params), queryFn: () => api.listInvestments(params) })

export const useCreateInvestment = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.createInvestment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'investments'] }) })
}

export const useAddValuation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ invId, data }: { invId: string; data: Record<string, unknown> }) =>
      api.addValuation(invId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'investments'] }),
  })
}

export const useInvestmentROI = (invId: string) =>
  useQuery({ queryKey: ['finance', 'investment-roi', invId],
    queryFn: () => api.getInvestmentROI(invId), enabled: !!invId })

// ── Controls ───────────────────────────────────────────────────────────────
export const useApprovalPolicies = () =>
  useQuery({ queryKey: finKeys.approvalPolicies, queryFn: api.listApprovalPolicies })

export const useCreateApprovalPolicy = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.createApprovalPolicy,
    onSuccess: () => qc.invalidateQueries({ queryKey: finKeys.approvalPolicies }) })
}

export const useApprovals = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: finKeys.approvals(params), queryFn: () => api.listApprovals(params) })

export const useCreateApprovalRequest = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.createApprovalRequest,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'approvals'] }) })
}

export const useApproveRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.approveRequest(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'approvals'] }),
  })
}

export const useRejectRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.rejectRequest(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'approvals'] }),
  })
}

export const useAuditLog = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: finKeys.auditLog(params), queryFn: () => api.listAuditLog(params) })

// ── Financial Statement Versions (FSV) ─────────────────────────────────────
export const useFsvList = (params?: { statement_type?: string }) =>
  useQuery({ queryKey: ['finance', 'fsv', params], queryFn: () => api.listFSV(params) })

export const useSeedFsv = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.seedFSV, onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'fsv'] }) })
}

export const useCreateFsv = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.createFSV, onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'fsv'] }) })
}

export const useUpdateFsv = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.updateFSV(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'fsv'] }),
  })
}

export const useDeleteFsv = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteFSV(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'fsv'] }),
  })
}

export const useFsvNodes = (versionId: string) =>
  useQuery({
    queryKey: ['finance', 'fsv-nodes', versionId],
    queryFn: () => api.listFsvNodes(versionId),
    enabled: !!versionId,
  })

export const useCreateFsvNode = (versionId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.createFsvNode(versionId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'fsv-nodes', versionId] }),
  })
}

export const useDeleteFsvNode = (versionId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (nodeId: string) => api.deleteFsvNode(versionId, nodeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'fsv-nodes', versionId] }),
  })
}

export const useComputeFsv = (
  versionId: string,
  params?: { from_date?: string; to_date?: string },
  enabled = true,
) =>
  useQuery({
    queryKey: ['finance', 'fsv-compute', versionId, params],
    queryFn: () => api.computeFSV(versionId, params),
    enabled: enabled && !!versionId,
  })

// ── GL Open-Item Management & Clearing ─────────────────────────────────────
export const useOpenItems = (params: {
  account_id: string
  party_type?: string
  party_id?: string
  include_partial?: boolean
}, enabled = true) =>
  useQuery({
    queryKey: ['finance', 'open-items', params],
    queryFn: () => api.getOpenItems(params),
    enabled: enabled && !!params.account_id,
  })

export const useClearOpenItems = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.clearOpenItems,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance', 'open-items'] })
      qc.invalidateQueries({ queryKey: ['finance', 'clearing-batches'] })
    },
  })
}

export const useResetClearing = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.resetClearing,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance', 'open-items'] })
      qc.invalidateQueries({ queryKey: ['finance', 'clearing-batches'] })
    },
  })
}

export const useClearingBatches = (params?: {
  account_id?: string
  party_type?: string
  party_id?: string
}) =>
  useQuery({
    queryKey: ['finance', 'clearing-batches', params],
    queryFn: () => api.listClearingBatches(params),
  })

// ── Posting Keys ───────────────────────────────────────────────────────────
export const usePostingKeys = () =>
  useQuery({ queryKey: ['finance', 'posting-keys'], queryFn: api.listPostingKeys })

export const useSeedPostingKeys = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.seedPostingKeys,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'posting-keys'] }),
  })
}

export const useCreatePostingKey = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createPostingKey,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'posting-keys'] }),
  })
}

export const useDeletePostingKey = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deletePostingKey(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'posting-keys'] }),
  })
}

// ── Field Status Groups ────────────────────────────────────────────────────
export const useFieldStatusGroups = () =>
  useQuery({ queryKey: ['finance', 'field-status-groups'], queryFn: api.listFieldStatusGroups })

export const useSeedFieldStatusGroups = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.seedFieldStatusGroups,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'field-status-groups'] }),
  })
}

export const useCreateFieldStatusGroup = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createFieldStatusGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'field-status-groups'] }),
  })
}

export const useDeleteFieldStatusGroup = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteFieldStatusGroup(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'field-status-groups'] }),
  })
}

// ── Tolerance Groups ───────────────────────────────────────────────────────
export const useToleranceGroups = () =>
  useQuery({ queryKey: ['finance', 'tolerance-groups'], queryFn: api.listToleranceGroups })

export const useSeedToleranceGroup = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.seedToleranceGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'tolerance-groups'] }),
  })
}

export const useCreateToleranceGroup = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createToleranceGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'tolerance-groups'] }),
  })
}

export const useUpdateToleranceGroup = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.updateToleranceGroup>[1] }) =>
      api.updateToleranceGroup(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'tolerance-groups'] }),
  })
}

export const useDeleteToleranceGroup = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteToleranceGroup(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'tolerance-groups'] }),
  })
}

// ── Profit Centers ─────────────────────────────────────────────────────────
export const useProfitCenters = () =>
  useQuery({ queryKey: ['finance', 'profit-centers'], queryFn: api.listProfitCenters })

export const useCreateProfitCenter = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createProfitCenter,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'profit-centers'] }),
  })
}

export const useUpdateProfitCenter = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.updateProfitCenter>[1] }) =>
      api.updateProfitCenter(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'profit-centers'] }),
  })
}

export const useDeleteProfitCenter = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteProfitCenter(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'profit-centers'] }),
  })
}

export const useProfitCenterPnl = (params: { from_date: string; to_date: string } | null) =>
  useQuery({
    queryKey: ['finance', 'pc-pnl', params],
    queryFn: () => api.getProfitCenterPnl(params!),
    enabled: !!params,
  })

// ── Segments ───────────────────────────────────────────────────────────────
export const useSegments = () =>
  useQuery({ queryKey: ['finance', 'segments'], queryFn: api.listSegments })

export const useCreateSegment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createSegment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'segments'] }),
  })
}

export const useDeleteSegment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteSegment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'segments'] }),
  })
}

export const useSegmentPnl = (params: { from_date: string; to_date: string } | null) =>
  useQuery({
    queryKey: ['finance', 'seg-pnl', params],
    queryFn: () => api.getSegmentPnl(params!),
    enabled: !!params,
  })

// ── Exchange Rates ─────────────────────────────────────────────────────────
export const useExchangeRates = (params?: { from_currency?: string; to_currency?: string }) =>
  useQuery({ queryKey: ['finance', 'fx-rates', params], queryFn: () => api.listExchangeRates(params) })

export const useUpsertExchangeRate = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.upsertExchangeRate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'fx-rates'] }),
  })
}

export const useFxRevalRuns = () =>
  useQuery({ queryKey: ['finance', 'fx-reval-runs'], queryFn: api.listFxRevalRuns })

export const useSimulateFxReval = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.simulateFxReval,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'fx-reval-runs'] }),
  })
}

export const useCarryForwards = (fiscal_year?: number) =>
  useQuery({ queryKey: ['finance', 'carry-forwards', fiscal_year], queryFn: () => api.listCarryForwards(fiscal_year) })

export const useRunCarryForward = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.runCarryForward,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'carry-forwards'] }),
  })
}

// ── Validation Rules ───────────────────────────────────────────────────────
export const useValidationRules = () =>
  useQuery({ queryKey: ['finance', 'validations'], queryFn: api.listValidations })

export const useCreateValidationRule = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createValidation,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'validations'] }),
  })
}

export const useUpdateValidationRule = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.updateValidation>[1] }) =>
      api.updateValidation(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'validations'] }),
  })
}

export const useDeleteValidationRule = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteValidation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'validations'] }),
  })
}

// ── Substitution Rules ─────────────────────────────────────────────────────
export const useSubstitutionRules = () =>
  useQuery({ queryKey: ['finance', 'substitutions'], queryFn: api.listSubstitutions })

export const useCreateSubstitutionRule = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createSubstitution,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'substitutions'] }),
  })
}

export const useDeleteSubstitutionRule = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteSubstitution(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'substitutions'] }),
  })
}

// ── Number Ranges ──────────────────────────────────────────────────────────
export const useNumberRanges = () =>
  useQuery({ queryKey: ['finance', 'number-ranges'], queryFn: api.listNumberRanges })

export const useSeedNumberRanges = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (fy: number) => api.seedNumberRanges(fy),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'number-ranges'] }),
  })
}

export const useCreateNumberRange = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createNumberRange,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'number-ranges'] }),
  })
}

// ── Document Splitting ─────────────────────────────────────────────────────
export const useSplitRules = () =>
  useQuery({ queryKey: ['finance', 'split-rules'], queryFn: api.listSplitRules })

export const useCreateSplitRule = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createSplitRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'split-rules'] }),
  })
}

export const useDeleteSplitRule = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteSplitRule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'split-rules'] }),
  })
}

export const useSplitItems = (jeId: string | null) =>
  useQuery({
    queryKey: ['finance', 'split-items', jeId],
    queryFn: () => api.getSplitItems(jeId!),
    enabled: !!jeId,
  })

export const useApplyDocumentSplit = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (jeId: string) => api.applyDocumentSplit(jeId),
    onSuccess: (_, jeId) => qc.invalidateQueries({ queryKey: ['finance', 'split-items', jeId] }),
  })
}

// ── Parallel Ledgers ──────────────────────────────────────────────────────────

export const useLedgers = () =>
  useQuery({ queryKey: ['finance', 'ledgers'], queryFn: api.listLedgers })

export const useCreateLedger = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createLedger,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'ledgers'] }),
  })
}

export const useUpdateLedger = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<import('@/api/finance').Ledger> }) =>
      api.updateLedger(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'ledgers'] }),
  })
}

export const useDeleteLedger = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteLedger(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'ledgers'] }),
  })
}

export const useLedgerAssignments = (params?: { company_id?: string; ledger_id?: string }) =>
  useQuery({
    queryKey: ['finance', 'ledger-assignments', params],
    queryFn: () => api.listLedgerAssignments(params),
  })

export const useAssignLedger = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.assignLedger,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'ledger-assignments'] }),
  })
}

export const useRemoveLedgerAssignment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.removeAssignment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'ledger-assignments'] }),
  })
}

export const useLedgerTrialBalance = (ledgerId: string | null, fiscalYearId?: string) =>
  useQuery({
    queryKey: ['finance', 'ledger-tb', ledgerId, fiscalYearId],
    queryFn: () => api.getLedgerTrialBalance(ledgerId!, fiscalYearId),
    enabled: !!ledgerId,
  })






