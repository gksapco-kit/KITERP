import axios from '@/lib/axios'

const BASE = '/vendors/me/controlling'

export type ControllingDashboard = {
  active_standard_costs: number
  manufacturing_orders: number
  wip_open_orders: number
  wip_planned_value: string
  wip_actual_cost: string
}

export const getControllingDashboard = (params?: { company_id?: string }) =>
  axios.get(`${BASE}/dashboard`, { params }).then(r => r.data as ControllingDashboard)

export const listActivityTypes = (params?: { company_id?: string }) =>
  axios.get(`${BASE}/activity-types`, { params }).then(r => r.data)

export const createActivityType = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/activity-types`, data).then(r => r.data)

export const updateActivityType = (id: string, data: Record<string, unknown>) =>
  axios.patch(`${BASE}/activity-types/${id}`, data).then(r => r.data)

export const listOverheadPools = (params?: { company_id?: string }) =>
  axios.get(`${BASE}/overhead-pools`, { params }).then(r => r.data)

export const createOverheadPool = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/overhead-pools`, data).then(r => r.data)

export const updateOverheadPool = (id: string, data: Record<string, unknown>) =>
  axios.patch(`${BASE}/overhead-pools/${id}`, data).then(r => r.data)

export const listOverheadRates = (poolId: string) =>
  axios.get(`${BASE}/overhead-pools/${poolId}/rates`).then(r => r.data)

export const createOverheadRate = (poolId: string, data: Record<string, unknown>) =>
  axios.post(`${BASE}/overhead-pools/${poolId}/rates`, data).then(r => r.data)

export const listProductCosts = (params?: { company_id?: string; product_id?: string; status?: string }) =>
  axios.get(`${BASE}/product-costs`, { params }).then(r => r.data)

export const getProductCost = (versionId: string) =>
  axios.get(`${BASE}/product-costs/${versionId}`).then(r => r.data)

export const createProductCost = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/product-costs`, data).then(r => r.data)

export const updateProductCost = (versionId: string, data: Record<string, unknown>) =>
  axios.patch(`${BASE}/product-costs/${versionId}`, data).then(r => r.data)

export const rollUpBomProductCost = (versionId: string) =>
  axios.post(`${BASE}/product-costs/${versionId}/roll-up-bom`).then(r => r.data)

export const listManufacturingOrders = (params?: {
  company_id?: string
  status?: string
  order_kind?: string
  project_id?: string
}) => axios.get(`${BASE}/manufacturing-orders`, { params }).then(r => r.data)

export const getManufacturingOrder = (id: string) =>
  axios.get(`${BASE}/manufacturing-orders/${id}`).then(r => r.data)

export const createManufacturingOrder = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/manufacturing-orders`, data).then(r => r.data)

export const updateManufacturingOrder = (id: string, data: Record<string, unknown>) =>
  axios.patch(`${BASE}/manufacturing-orders/${id}`, data).then(r => r.data)

export const refreshOrderPlannedFromStandard = (orderId: string) =>
  axios.post(`${BASE}/manufacturing-orders/${orderId}/refresh-planned-from-standard`).then(r => r.data)

export const getOrderVariance = (orderId: string) =>
  axios.get(`${BASE}/manufacturing-orders/${orderId}/variance`).then(r => r.data)

export const getOrderVarianceDetailed = (orderId: string) =>
  axios.get(`${BASE}/manufacturing-orders/${orderId}/variance-detailed`).then(r => r.data)

export const patchOrderCostLine = (orderId: string, lineId: string, data: Record<string, unknown>) =>
  axios.patch(`${BASE}/manufacturing-orders/${orderId}/cost-lines/${lineId}`, data).then(r => r.data)

export const createOrderOperation = (orderId: string, data: Record<string, unknown>) =>
  axios.post(`${BASE}/manufacturing-orders/${orderId}/operations`, data).then(r => r.data)

export const updateOrderOperation = (orderId: string, opId: string, data: Record<string, unknown>) =>
  axios.patch(`${BASE}/manufacturing-orders/${orderId}/operations/${opId}`, data).then(r => r.data)

export const deleteOrderOperation = (orderId: string, opId: string) =>
  axios.delete(`${BASE}/manufacturing-orders/${orderId}/operations/${opId}`).then(r => r.data)

export const generateOperationsFromStandard = (orderId: string) =>
  axios.post(`${BASE}/manufacturing-orders/${orderId}/operations/generate-from-standard`).then(r => r.data)

export const syncActivityActualsFromOperations = (orderId: string) =>
  axios.post(`${BASE}/manufacturing-orders/${orderId}/sync-activity-actuals-from-operations`).then(r => r.data)

export const recalculateOverheadActual = (orderId: string, params?: { as_of?: string }) =>
  axios.post(`${BASE}/manufacturing-orders/${orderId}/recalculate-overhead-actual`, null, { params }).then(r => r.data)

export const getWipSummary = (params?: { company_id?: string }) =>
  axios.get(`${BASE}/wip-summary`, { params }).then(r => r.data)

export const getWipReport = (params?: { company_id?: string; group_by?: string }) =>
  axios.get(`${BASE}/wip-report`, { params }).then(r => r.data)

export type CoGlMapping = {
  id: string
  vendor_id: string
  company_id: string
  wip_account_id: string | null
  finished_goods_account_id: string | null
  cogs_account_id: string | null
  production_variance_account_id: string | null
  raw_material_account_id: string | null
  notes: string | null
  created_at?: string
  updated_at?: string
}

export const getCoGlMapping = (params: { company_id: string }) =>
  axios.get(`${BASE}/co-gl-mapping`, { params }).then(r => r.data as CoGlMapping | null)

export const putCoGlMapping = (data: Record<string, unknown>) =>
  axios.put(`${BASE}/co-gl-mapping`, data).then(r => r.data as CoGlMapping)

export const postProductionCompletion = (orderId: string, data?: { entry_date?: string }) =>
  axios
    .post(`${BASE}/manufacturing-orders/${orderId}/post-production-completion`, data ?? {})
    .then(r => r.data)

export const postCogsIssue = (orderId: string, data?: { entry_date?: string }) =>
  axios.post(`${BASE}/manufacturing-orders/${orderId}/post-cogs-issue`, data ?? {}).then(r => r.data)

// ── Status transitions ────────────────────────────────────────────────────────

export const transitionOrderStatus = (orderId: string, data: { status: string; notes?: string }) =>
  axios.post(`${BASE}/manufacturing-orders/${orderId}/transition`, data).then(r => r.data)

// ── Activity Confirmations ────────────────────────────────────────────────────

export type ActivityConfirmationOut = {
  id: string
  vendor_id: string
  company_id: string
  order_id: string
  operation_id: string | null
  activity_type_id: string | null
  cost_center_id: string | null
  confirmation_date: string
  confirmation_type: string
  qty_confirmed: string
  hours_confirmed: string
  rate_per_hour: string
  total_cost: string
  scrap_qty: string
  yield_pct: string
  status: string
  narration: string | null
  journal_entry_id: string | null
  extra: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

export const listActivityConfirmations = (params?: {
  company_id?: string
  order_id?: string
  confirmation_type?: string
  from_date?: string
  to_date?: string
}) => axios.get(`${BASE}/activity-confirmations`, { params }).then(r => r.data as ActivityConfirmationOut[])

export const createActivityConfirmation = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/activity-confirmations`, data).then(r => r.data as ActivityConfirmationOut)

export const updateActivityConfirmation = (id: string, data: Record<string, unknown>) =>
  axios.patch(`${BASE}/activity-confirmations/${id}`, data).then(r => r.data as ActivityConfirmationOut)

export const deleteActivityConfirmation = (id: string) =>
  axios.delete(`${BASE}/activity-confirmations/${id}`).then(r => r.data)

// ── Goods Movements ───────────────────────────────────────────────────────────

export type GoodsMovementOut = {
  id: string
  vendor_id: string
  company_id: string
  order_id: string
  movement_type: string
  posting_date: string
  document_no: string | null
  product_id: string | null
  description: string | null
  uom: string
  qty: string
  unit_cost: string
  total_cost: string
  cost_center_id: string | null
  storage_location: string | null
  batch_no: string | null
  status: string
  reversal_reason: string | null
  journal_entry_id: string | null
  extra: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

export const listGoodsMovements = (params?: {
  company_id?: string
  order_id?: string
  movement_type?: string
  from_date?: string
  to_date?: string
}) => axios.get(`${BASE}/goods-movements`, { params }).then(r => r.data as GoodsMovementOut[])

export const createGoodsMovement = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/goods-movements`, data).then(r => r.data as GoodsMovementOut)

export const reverseGoodsMovement = (id: string, reason: string) =>
  axios.post(`${BASE}/goods-movements/${id}/reverse`, { reason }).then(r => r.data as GoodsMovementOut)

// ── Cost Allocations ──────────────────────────────────────────────────────────

export type CostAllocationOut = {
  id: string
  vendor_id: string
  company_id: string
  period_year: number
  period_month: number
  allocation_cycle: string | null
  sender_cost_center_id: string | null
  receiver_cost_center_id: string | null
  receiver_order_id: string | null
  sender_account_id: string | null
  receiver_account_id: string | null
  allocation_method: string
  allocation_value: string
  allocated_amount: string
  status: string
  posting_date: string | null
  narration: string | null
  journal_entry_id: string | null
  extra: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

export const listCostAllocations = (params?: {
  company_id?: string
  period_year?: number
  period_month?: number
  allocation_cycle?: string
  status?: string
}) => axios.get(`${BASE}/cost-allocations`, { params }).then(r => r.data as CostAllocationOut[])

export const createCostAllocation = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/cost-allocations`, data).then(r => r.data as CostAllocationOut)

export const postCostAllocation = (id: string, data?: { entry_date?: string }) =>
  axios.post(`${BASE}/cost-allocations/${id}/post`, data ?? {}).then(r => r.data as CostAllocationOut)

export const deleteCostAllocation = (id: string) =>
  axios.delete(`${BASE}/cost-allocations/${id}`).then(r => r.data)

// ── Budget Lines ──────────────────────────────────────────────────────────────

export type BudgetLineOut = {
  id: string
  vendor_id: string
  company_id: string
  order_id: string
  budget_type: string
  category: string
  description: string | null
  fiscal_year: number | null
  period_month: number | null
  amount_budgeted: string
  currency: string
  notes: string | null
  created_at?: string
  updated_at?: string
}

export type InternalOrderBudgetVsActualOut = {
  order_id: string
  order_no: string
  title: string | null
  order_kind: string
  status: string
  total_budgeted: string
  total_actual: string
  total_variance: string
  by_category: Record<string, Record<string, string>>
  budget_lines: BudgetLineOut[]
}

export const listBudgetLines = (orderId: string) =>
  axios.get(`${BASE}/manufacturing-orders/${orderId}/budget-lines`).then(r => r.data as BudgetLineOut[])

export const createBudgetLine = (orderId: string, data: Record<string, unknown>) =>
  axios.post(`${BASE}/manufacturing-orders/${orderId}/budget-lines`, data).then(r => r.data as BudgetLineOut)

export const updateBudgetLine = (orderId: string, blId: string, data: Record<string, unknown>) =>
  axios.patch(`${BASE}/manufacturing-orders/${orderId}/budget-lines/${blId}`, data).then(r => r.data as BudgetLineOut)

export const deleteBudgetLine = (orderId: string, blId: string) =>
  axios.delete(`${BASE}/manufacturing-orders/${orderId}/budget-lines/${blId}`).then(r => r.data)

export const getBudgetVsActual = (orderId: string) =>
  axios.get(`${BASE}/manufacturing-orders/${orderId}/budget-vs-actual`).then(r => r.data as InternalOrderBudgetVsActualOut)

// ── Variance Runs ─────────────────────────────────────────────────────────────

export type VarianceRunOut = {
  id: string
  vendor_id: string
  company_id: string
  period_year: number
  period_month: number
  run_type: string
  run_date: string
  total_planned: string
  total_actual: string
  total_variance: string
  price_variance: string
  usage_variance: string
  overhead_variance: string
  scrap_variance: string
  order_count: number
  status: string
  narration: string | null
  journal_entry_id: string | null
  extra: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

export const listVarianceRuns = (params?: {
  company_id?: string
  period_year?: number
  period_month?: number
  status?: string
}) => axios.get(`${BASE}/variance-runs`, { params }).then(r => r.data as VarianceRunOut[])

export const createVarianceRun = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/variance-runs`, data).then(r => r.data as VarianceRunOut)

export const postVarianceRun = (runId: string, data?: { entry_date?: string }) =>
  axios.post(`${BASE}/variance-runs/${runId}/post`, data ?? {}).then(r => r.data as VarianceRunOut)

// ── Period-end report ─────────────────────────────────────────────────────────

export type PeriodEndReportOut = {
  company_id: string | null
  period_year: number
  period_month: number
  open_orders: number
  completed_orders: number
  total_planned: string
  total_actual: string
  total_variance: string
  pending_variance_runs: number
  pending_allocations: number
  goods_movements_count: number
  activity_confirmations_count: number
}

export const getPeriodEndReport = (params: { period_year: number; period_month: number; company_id?: string }) =>
  axios.get(`${BASE}/period-end-report`, { params }).then(r => r.data as PeriodEndReportOut)

// ── Internal orders report ────────────────────────────────────────────────────

export const getInternalOrdersReport = (params?: {
  company_id?: string
  order_kind?: string
  status?: string
}) => axios.get(`${BASE}/internal-orders-report`, { params }).then(r => r.data as Record<string, unknown>[])

// ── Work Centers ──────────────────────────────────────────────────────────────

export const listWorkCenters = (params?: { company_id?: string; is_active?: boolean }) =>
  axios.get(`${BASE}/work-centers`, { params }).then(r => r.data)

export const createWorkCenter = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/work-centers`, data).then(r => r.data)

export const updateWorkCenter = (id: string, data: Record<string, unknown>) =>
  axios.patch(`${BASE}/work-centers/${id}`, data).then(r => r.data)

export const deleteWorkCenter = (id: string) =>
  axios.delete(`${BASE}/work-centers/${id}`).then(r => r.data)

// ── Routings ──────────────────────────────────────────────────────────────────

export const listRoutings = (params?: { company_id?: string; product_id?: string; status?: string }) =>
  axios.get(`${BASE}/routings`, { params }).then(r => r.data)

export const getRouting = (id: string) =>
  axios.get(`${BASE}/routings/${id}`).then(r => r.data)

export const createRouting = (data: Record<string, unknown>) =>
  axios.post(`${BASE}/routings`, data).then(r => r.data)

export const updateRouting = (id: string, data: Record<string, unknown>) =>
  axios.patch(`${BASE}/routings/${id}`, data).then(r => r.data)

export const deleteRouting = (id: string) =>
  axios.delete(`${BASE}/routings/${id}`).then(r => r.data)

export const addRoutingOperation = (routingId: string, data: Record<string, unknown>) =>
  axios.post(`${BASE}/routings/${routingId}/operations`, data).then(r => r.data)

export const updateRoutingOperation = (routingId: string, opId: string, data: Record<string, unknown>) =>
  axios.patch(`${BASE}/routings/${routingId}/operations/${opId}`, data).then(r => r.data)

export const deleteRoutingOperation = (routingId: string, opId: string) =>
  axios.delete(`${BASE}/routings/${routingId}/operations/${opId}`).then(r => r.data)

// ── Product cost version routing + overhead ───────────────────────────────────

export const setCostVersionRouting = (versionId: string, data: { routing_id: string | null }) =>
  axios.patch(`${BASE}/product-costs/${versionId}/routing`, data).then(r => r.data)

export const applyOverheadToCostVersion = (versionId: string, data: Record<string, unknown>) =>
  axios.post(`${BASE}/product-costs/${versionId}/apply-overhead`, data).then(r => r.data)
