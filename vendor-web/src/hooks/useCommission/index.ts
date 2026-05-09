import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/commission'

const keys = {
  payees: (p?: Record<string, unknown>) => ['commission', 'payees', p] as const,
  payeeSearch: (q: string) => ['commission', 'payee-search', q] as const,
  payeeMasterBank: (id: string) => ['commission', 'payee-master-bank', id] as const,
  plans: (p?: Record<string, unknown>) => ['commission', 'plans', p] as const,
  plan: (id: string) => ['commission', 'plan', id] as const,
  assignments: (p?: Record<string, unknown>) => ['commission', 'assignments', p] as const,
  accruals: (p?: Record<string, unknown>) => ['commission', 'accruals', p] as const,
  payoutRuns: (p?: Record<string, unknown>) => ['commission', 'payout-runs', p] as const,
  payoutRun: (id: string) => ['commission', 'payout-run', id] as const,
  summary: (p?: Record<string, unknown>) => ['commission', 'summary', p] as const,
  byPayee: (p?: Record<string, unknown>) => ['commission', 'by-payee', p] as const,
  bySource: (p?: Record<string, unknown>) => ['commission', 'by-source', p] as const,
  trend: (p?: Record<string, unknown>) => ['commission', 'trend', p] as const,
  byProduct: (p?: Record<string, unknown>) => ['commission', 'by-product', p] as const,
}

// ── Payees ──────────────────────────────────────────────────────────────────
export const useSearchPayees = (q: string) =>
  useQuery({ queryKey: keys.payeeSearch(q), queryFn: () => api.searchPayees(q), enabled: q.length >= 1, staleTime: 10_000 })

export const usePayees = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: keys.payees(params), queryFn: () => api.listPayees(params) })

export const useCreatePayee = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.createPayee, onSuccess: () => qc.invalidateQueries({ queryKey: ['commission', 'payees'] }) })
}

export const useUpdatePayee = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.updatePayee(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commission', 'payees'] }),
  })
}

export const useDeletePayee = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.deletePayee, onSuccess: () => qc.invalidateQueries({ queryKey: ['commission', 'payees'] }) })
}

export const usePayeeMasterBank = (id: string | null, enabled = true) =>
  useQuery({
    queryKey: keys.payeeMasterBank(id || ''),
    queryFn: () => api.getPayeeMasterBank(id!),
    enabled: !!id && enabled,
    staleTime: 60_000,
  })

// ── Plans ────────────────────────────────────────────────────────────────────
export const usePlans = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: keys.plans(params), queryFn: () => api.listPlans(params) })

export const usePlan = (id: string) =>
  useQuery({ queryKey: keys.plan(id), queryFn: () => api.getPlan(id), enabled: !!id })

export const useCreatePlan = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.createPlan, onSuccess: () => qc.invalidateQueries({ queryKey: ['commission', 'plans'] }) })
}

export const useUpdatePlan = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.updatePlan(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commission', 'plans'] }),
  })
}

export const useDeletePlan = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.deletePlan, onSuccess: () => qc.invalidateQueries({ queryKey: ['commission', 'plans'] }) })
}

// ── Rules ────────────────────────────────────────────────────────────────────
export const useCreateRule = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ planId, data }: { planId: string; data: Record<string, unknown> }) => api.createRule(planId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commission', 'plans'] }),
  })
}

export const useUpdateRule = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.updateRule(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commission', 'plans'] }),
  })
}

export const useDeleteRule = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commission', 'plans'] }),
  })
}

// ── Assignments ──────────────────────────────────────────────────────────────
export const useAssignments = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: keys.assignments(params), queryFn: () => api.listAssignments(params) })

export const useCreateAssignment = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.createAssignment, onSuccess: () => qc.invalidateQueries({ queryKey: ['commission', 'assignments'] }) })
}

export const useUpdateAssignment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.updateAssignment(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commission', 'assignments'] }),
  })
}

export const useDeleteAssignment = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.deleteAssignment, onSuccess: () => qc.invalidateQueries({ queryKey: ['commission', 'assignments'] }) })
}

// ── Accruals ─────────────────────────────────────────────────────────────────
export const useAccruals = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: keys.accruals(params), queryFn: () => api.listAccruals(params) })

export const useApproveAccrual = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.approveAccrual, onSuccess: () => qc.invalidateQueries({ queryKey: ['commission', 'accruals'] }) })
}

export const useReverseAccrual = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.reverseAccrual, onSuccess: () => qc.invalidateQueries({ queryKey: ['commission', 'accruals'] }) })
}

export const useBulkApproveAccruals = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: Record<string, unknown>) => api.bulkApproveAccruals(params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commission', 'accruals'] }),
  })
}

// ── Payout Runs ───────────────────────────────────────────────────────────────
export const usePayoutRuns = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: keys.payoutRuns(params), queryFn: () => api.listPayoutRuns(params) })

export const usePayoutRun = (id: string) =>
  useQuery({ queryKey: keys.payoutRun(id), queryFn: () => api.getPayoutRun(id), enabled: !!id })

export const useCreatePayoutRun = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.createPayoutRun, onSuccess: () => qc.invalidateQueries({ queryKey: ['commission', 'payout-runs'] }) })
}

export const useApprovePayoutRun = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => api.approvePayoutRun(id, notes),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commission', 'payout-runs'] }),
  })
}

export const usePayPayoutRun = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => api.payPayoutRun(id, notes),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commission', 'payout-runs'] }),
  })
}

export const useCancelPayoutRun = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => api.cancelPayoutRun(id, notes),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commission', 'payout-runs'] }),
  })
}

// ── Reports ───────────────────────────────────────────────────────────────────
export const useCommissionSummary = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: keys.summary(params), queryFn: () => api.getCommissionSummary(params) })

export const useByPayeeReport = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: keys.byPayee(params), queryFn: () => api.getByPayeeReport(params) })

export const useBySourceReport = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: keys.bySource(params), queryFn: () => api.getBySourceReport(params) })

export const useTrendReport = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: keys.trend(params), queryFn: () => api.getTrendReport(params) })

export const useByProductReport = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: keys.byProduct(params), queryFn: () => api.getByProductReport(params) })
