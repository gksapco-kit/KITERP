import axios from '@/lib/axios'
import type {
  CommissionPayee, CommissionPlan, CommissionRule,
  CommissionAssignment, CommissionAccrual,
  CommissionPayoutRun, CommissionSummary,
  ByPayeeRow, TrendRow, BySourceResult, PaginatedResult,
} from '@/types/commission'

const BASE = '/vendors/me/commission'

// ── Payees ─────────────────────────────────────────────────────────────────
export const searchPayees = (q: string) =>
  axios.get(`${BASE}/payees/search`, { params: { q, limit: 20 } }).then(r => r.data as CommissionPayee[])

export const listPayees = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/payees`, { params }).then(r => r.data as PaginatedResult<CommissionPayee>)

export const createPayee = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/payees`, data).then(r => r.data as CommissionPayee)

export const updatePayee = (id: string, data: Record<string, unknown>) =>
  axios.put(`${BASE}/payees/${id}`, data).then(r => r.data as CommissionPayee)

export const deletePayee = (id: string) =>
  axios.delete(`${BASE}/payees/${id}`)

export const getPayeeMasterBank = (id: string) =>
  axios.get(`${BASE}/payees/${id}/master-bank`).then(r => r.data as MasterBankInfo)

export interface MasterBankInfo {
  bank_name?: string
  account_number?: string
  account_holder_name?: string
  account_type?: string
  ifsc_code?: string
  pan_number?: string
}

// ── Plans ──────────────────────────────────────────────────────────────────
export const listPlans = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/plans`, { params }).then(r => r.data as PaginatedResult<CommissionPlan>)

export const getPlan = (id: string) =>
  axios.get(`${BASE}/plans/${id}`).then(r => r.data as CommissionPlan)

export const createPlan = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/plans`, data).then(r => r.data as CommissionPlan)

export const updatePlan = (id: string, data: Record<string, unknown>) =>
  axios.put(`${BASE}/plans/${id}`, data).then(r => r.data as CommissionPlan)

export const deletePlan = (id: string) =>
  axios.delete(`${BASE}/plans/${id}`)

// ── Rules ─────────────────────────────────────────────────────────────────
export const createRule = (planId: string, data: Record<string, unknown>) =>
  axios.post(`${BASE}/plans/${planId}/rules`, data).then(r => r.data as CommissionRule)

export const updateRule = (ruleId: string, data: Record<string, unknown>) =>
  axios.put(`${BASE}/rules/${ruleId}`, data).then(r => r.data as CommissionRule)

export const deleteRule = (ruleId: string) =>
  axios.delete(`${BASE}/rules/${ruleId}`)

// ── Assignments ────────────────────────────────────────────────────────────
export const listAssignments = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/assignments`, { params }).then(r => r.data as PaginatedResult<CommissionAssignment>)

export const createAssignment = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/assignments`, data).then(r => r.data as CommissionAssignment)

export const updateAssignment = (id: string, data: Record<string, unknown>) =>
  axios.put(`${BASE}/assignments/${id}`, data).then(r => r.data as CommissionAssignment)

export const deleteAssignment = (id: string) =>
  axios.delete(`${BASE}/assignments/${id}`)

// ── Accruals ───────────────────────────────────────────────────────────────
export const listAccruals = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/accruals`, { params }).then(r => r.data as PaginatedResult<CommissionAccrual>)

export const approveAccrual = (id: string) =>
  axios.post(`${BASE}/accruals/${id}/approve`).then(r => r.data)

export const reverseAccrual = (id: string) =>
  axios.post(`${BASE}/accruals/${id}/reverse`).then(r => r.data)

export const bulkApproveAccruals = (params?: Record<string, unknown>) =>
  axios.post(`${BASE}/accruals/bulk-approve`, null, { params }).then(r => r.data)

// ── Payout Runs ────────────────────────────────────────────────────────────
export const listPayoutRuns = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/payout-runs`, { params }).then(r => r.data as PaginatedResult<CommissionPayoutRun>)

export const getPayoutRun = (id: string) =>
  axios.get(`${BASE}/payout-runs/${id}`).then(r => r.data as CommissionPayoutRun)

export const createPayoutRun = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/payout-runs`, data).then(r => r.data as CommissionPayoutRun)

export const approvePayoutRun = (id: string, notes?: string) =>
  axios.post(`${BASE}/payout-runs/${id}/approve`, { notes }).then(r => r.data)

export const payPayoutRun = (id: string, notes?: string) =>
  axios.post(`${BASE}/payout-runs/${id}/pay`, { notes }).then(r => r.data)

export const cancelPayoutRun = (id: string, notes?: string) =>
  axios.post(`${BASE}/payout-runs/${id}/cancel`, { notes }).then(r => r.data)

// ── Reports ────────────────────────────────────────────────────────────────
export const getCommissionSummary = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/reports/summary`, { params }).then(r => r.data as CommissionSummary)

export const getByPayeeReport = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/reports/by-payee`, { params }).then(r => r.data as ByPayeeRow[])

export const getBySourceReport = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/reports/by-source`, { params }).then(r => r.data as BySourceResult)

export const getTrendReport = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/reports/trend`, { params }).then(r => r.data as TrendRow[])

export const getByProductReport = (params?: Record<string, unknown>) =>
  axios.get(`${BASE}/reports/by-product`, { params }).then(r => r.data)
