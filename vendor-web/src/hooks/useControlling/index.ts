import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/controlling'

export const coKeys = {
  dashboard: (companyId?: string | null) => ['controlling', 'dashboard', companyId ?? 'all'] as const,
  activityTypes: (companyId?: string | null) => ['controlling', 'activity-types', companyId ?? 'all'] as const,
  overheadPools: (companyId?: string | null) => ['controlling', 'overhead-pools', companyId ?? 'all'] as const,
  overheadRates: (poolId: string) => ['controlling', 'overhead-rates', poolId] as const,
  productCosts: (p?: Record<string, unknown>) => ['controlling', 'product-costs', p] as const,
  productCost: (id: string) => ['controlling', 'product-cost', id] as const,
  manufacturingOrders: (p?: Record<string, unknown>) => ['controlling', 'mo', p] as const,
  manufacturingOrder: (id: string) => ['controlling', 'mo-one', id] as const,
  variance: (id: string) => ['controlling', 'variance', id] as const,
  varianceDetailed: (id: string) => ['controlling', 'variance-detailed', id] as const,
  wip: (companyId?: string | null) => ['controlling', 'wip', companyId ?? 'all'] as const,
  wipReport: (p?: Record<string, unknown>) => ['controlling', 'wip-report', p] as const,
  coGlMapping: (companyId: string) => ['controlling', 'co-gl-mapping', companyId] as const,
}

export const useControllingDashboard = (companyId?: string) =>
  useQuery({
    queryKey: coKeys.dashboard(companyId),
    queryFn: () => api.getControllingDashboard(companyId ? { company_id: companyId } : undefined),
  })

export const useWipSummary = (companyId?: string) =>
  useQuery({
    queryKey: coKeys.wip(companyId),
    queryFn: () => api.getWipSummary(companyId ? { company_id: companyId } : undefined),
  })

export const useActivityTypes = (companyId?: string) =>
  useQuery({
    queryKey: coKeys.activityTypes(companyId),
    queryFn: () => api.listActivityTypes(companyId ? { company_id: companyId } : undefined),
  })

export const useCreateActivityType = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createActivityType,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['controlling', 'activity-types'] }),
  })
}

export const useUpdateActivityType = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.updateActivityType(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['controlling', 'activity-types'] }),
  })
}

export const useOverheadPools = (companyId?: string) =>
  useQuery({
    queryKey: coKeys.overheadPools(companyId),
    queryFn: () => api.listOverheadPools(companyId ? { company_id: companyId } : undefined),
  })

export const useOverheadRates = (poolId: string | undefined) =>
  useQuery({
    queryKey: coKeys.overheadRates(poolId ?? ''),
    queryFn: () => api.listOverheadRates(poolId!),
    enabled: !!poolId,
  })

export const useCreateOverheadPool = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createOverheadPool,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['controlling', 'overhead-pools'] }),
  })
}

export const useCreateOverheadRate = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ poolId, data }: { poolId: string; data: Record<string, unknown> }) =>
      api.createOverheadRate(poolId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['controlling', 'overhead-rates'] }),
  })
}

export const useProductCosts = (params?: { company_id?: string; product_id?: string; status?: string }) =>
  useQuery({
    queryKey: coKeys.productCosts(params),
    queryFn: () => api.listProductCosts(params),
  })

export const useCreateProductCost = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createProductCost,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['controlling', 'product-costs'] }),
  })
}

export const useUpdateProductCost = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.updateProductCost(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['controlling', 'product-costs'] })
      qc.invalidateQueries({ queryKey: ['controlling', 'product-cost'] })
    },
  })
}

export const useRollUpBomProductCost = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.rollUpBomProductCost,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['controlling', 'product-costs'] }),
  })
}

export const useManufacturingOrders = (params?: { company_id?: string; status?: string; order_kind?: string }) =>
  useQuery({
    queryKey: coKeys.manufacturingOrders(params),
    queryFn: () => api.listManufacturingOrders(params),
  })

export const useCreateManufacturingOrder = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createManufacturingOrder,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['controlling', 'mo'] }),
  })
}

export const useUpdateManufacturingOrder = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.updateManufacturingOrder(id, data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['controlling', 'mo'] })
      qc.invalidateQueries({ queryKey: coKeys.manufacturingOrder(variables.id) })
    },
  })
}

function invalidateMo(qc: ReturnType<typeof useQueryClient>, orderId?: string) {
  qc.invalidateQueries({ queryKey: ['controlling', 'mo'] })
  if (orderId) {
    qc.invalidateQueries({ queryKey: coKeys.manufacturingOrder(orderId) })
    qc.invalidateQueries({ queryKey: coKeys.variance(orderId) })
    qc.invalidateQueries({ queryKey: coKeys.varianceDetailed(orderId) })
  }
}

export const useRefreshOrderPlanned = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.refreshOrderPlannedFromStandard,
    onSuccess: (_, orderId) => invalidateMo(qc, orderId),
  })
}

export const useOrderVariance = (orderId: string | undefined) =>
  useQuery({
    queryKey: coKeys.variance(orderId ?? ''),
    queryFn: () => api.getOrderVariance(orderId!),
    enabled: !!orderId,
  })

export const useManufacturingOrder = (orderId: string | undefined) =>
  useQuery({
    queryKey: coKeys.manufacturingOrder(orderId ?? ''),
    queryFn: () => api.getManufacturingOrder(orderId!),
    enabled: !!orderId,
  })

export const useOrderVarianceDetailed = (orderId: string | undefined) =>
  useQuery({
    queryKey: coKeys.varianceDetailed(orderId ?? ''),
    queryFn: () => api.getOrderVarianceDetailed(orderId!),
    enabled: !!orderId,
  })

export const useWipReport = (params?: { company_id?: string; group_by?: string }) =>
  useQuery({
    queryKey: coKeys.wipReport(params),
    queryFn: () => api.getWipReport(params),
  })

export const useCoGlMapping = (companyId: string | undefined) =>
  useQuery({
    queryKey: coKeys.coGlMapping(companyId ?? ''),
    queryFn: () => api.getCoGlMapping({ company_id: companyId! }),
    enabled: !!companyId,
  })

export const usePutCoGlMapping = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.putCoGlMapping,
    onSuccess: d => {
      qc.invalidateQueries({ queryKey: ['controlling', 'co-gl-mapping'] })
      if (d && typeof d === 'object' && 'company_id' in d) {
        qc.invalidateQueries({ queryKey: coKeys.coGlMapping(String((d as { company_id: string }).company_id)) })
      }
    },
  })
}

export const usePostProductionCompletion = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, entry_date }: { orderId: string; entry_date?: string }) =>
      api.postProductionCompletion(orderId, entry_date ? { entry_date } : undefined),
    onSuccess: (_, v) => invalidateMo(qc, v.orderId),
  })
}

export const usePostCogsIssue = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, entry_date }: { orderId: string; entry_date?: string }) =>
      api.postCogsIssue(orderId, entry_date ? { entry_date } : undefined),
    onSuccess: (_, v) => invalidateMo(qc, v.orderId),
  })
}

export const usePatchOrderCostLine = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      orderId,
      lineId,
      data,
    }: {
      orderId: string
      lineId: string
      data: Record<string, unknown>
    }) => api.patchOrderCostLine(orderId, lineId, data),
    onSuccess: (_, v) => invalidateMo(qc, v.orderId),
  })
}

export const useGenerateOperationsFromStandard = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.generateOperationsFromStandard,
    onSuccess: (_, orderId) => invalidateMo(qc, orderId),
  })
}

export const useSyncActivityActualsFromOperations = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.syncActivityActualsFromOperations,
    onSuccess: (_, orderId) => invalidateMo(qc, orderId),
  })
}

export const useRecalculateOverheadActual = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, as_of }: { orderId: string; as_of?: string }) =>
      api.recalculateOverheadActual(orderId, as_of ? { as_of } : undefined),
    onSuccess: (_, v) => invalidateMo(qc, v.orderId),
  })
}

export const useUpdateOrderOperation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      orderId,
      opId,
      data,
    }: {
      orderId: string
      opId: string
      data: Record<string, unknown>
    }) => api.updateOrderOperation(orderId, opId, data),
    onSuccess: (_, v) => invalidateMo(qc, v.orderId),
  })
}

export const useDeleteOrderOperation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, opId }: { orderId: string; opId: string }) =>
      api.deleteOrderOperation(orderId, opId),
    onSuccess: (_, v) => invalidateMo(qc, v.orderId),
  })
}

// ── Status transitions ────────────────────────────────────────────────────────

export const useTransitionOrderStatus = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, status, notes }: { orderId: string; status: string; notes?: string }) =>
      api.transitionOrderStatus(orderId, { status, notes }),
    onSuccess: (_, v) => invalidateMo(qc, v.orderId),
  })
}

// ── Activity Confirmations ────────────────────────────────────────────────────

export const coConfirmationKeys = {
  list: (p?: Record<string, unknown>) => ['controlling', 'confirmations', p] as const,
}

export const useActivityConfirmations = (params?: {
  company_id?: string
  order_id?: string
  confirmation_type?: string
  from_date?: string
  to_date?: string
}) =>
  useQuery({
    queryKey: coConfirmationKeys.list(params),
    queryFn: () => api.listActivityConfirmations(params),
  })

export const useCreateActivityConfirmation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createActivityConfirmation,
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['controlling', 'confirmations'] })
      const ord = (d as { order_id?: string }).order_id
      if (ord) invalidateMo(qc, ord)
    },
  })
}

export const useUpdateActivityConfirmation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.updateActivityConfirmation(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['controlling', 'confirmations'] }),
  })
}

export const useDeleteActivityConfirmation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteActivityConfirmation,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['controlling', 'confirmations'] }),
  })
}

// ── Goods Movements ───────────────────────────────────────────────────────────

export const coGmKeys = {
  list: (p?: Record<string, unknown>) => ['controlling', 'goods-movements', p] as const,
}

export const useGoodsMovements = (params?: {
  company_id?: string
  order_id?: string
  movement_type?: string
  from_date?: string
  to_date?: string
}) =>
  useQuery({
    queryKey: coGmKeys.list(params),
    queryFn: () => api.listGoodsMovements(params),
  })

export const useCreateGoodsMovement = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createGoodsMovement,
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['controlling', 'goods-movements'] })
      const ord = (d as { order_id?: string }).order_id
      if (ord) invalidateMo(qc, ord)
    },
  })
}

export const useReverseGoodsMovement = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.reverseGoodsMovement(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['controlling', 'goods-movements'] }),
  })
}

// ── Cost Allocations ──────────────────────────────────────────────────────────

export const coAllocKeys = {
  list: (p?: Record<string, unknown>) => ['controlling', 'cost-allocations', p] as const,
}

export const useCostAllocations = (params?: {
  company_id?: string
  period_year?: number
  period_month?: number
  allocation_cycle?: string
  status?: string
}) =>
  useQuery({
    queryKey: coAllocKeys.list(params),
    queryFn: () => api.listCostAllocations(params),
  })

export const useCreateCostAllocation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createCostAllocation,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['controlling', 'cost-allocations'] }),
  })
}

export const usePostCostAllocation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, entry_date }: { id: string; entry_date?: string }) =>
      api.postCostAllocation(id, entry_date ? { entry_date } : undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['controlling', 'cost-allocations'] }),
  })
}

export const useDeleteCostAllocation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteCostAllocation,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['controlling', 'cost-allocations'] }),
  })
}

// ── Budget Lines ──────────────────────────────────────────────────────────────

export const coBudgetKeys = {
  lines: (orderId: string) => ['controlling', 'budget-lines', orderId] as const,
  bva: (orderId: string) => ['controlling', 'budget-vs-actual', orderId] as const,
}

export const useBudgetLines = (orderId: string | undefined) =>
  useQuery({
    queryKey: coBudgetKeys.lines(orderId ?? ''),
    queryFn: () => api.listBudgetLines(orderId!),
    enabled: !!orderId,
  })

export const useBudgetVsActual = (orderId: string | undefined) =>
  useQuery({
    queryKey: coBudgetKeys.bva(orderId ?? ''),
    queryFn: () => api.getBudgetVsActual(orderId!),
    enabled: !!orderId,
  })

export const useCreateBudgetLine = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, data }: { orderId: string; data: Record<string, unknown> }) =>
      api.createBudgetLine(orderId, data),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: coBudgetKeys.lines(v.orderId) })
      qc.invalidateQueries({ queryKey: coBudgetKeys.bva(v.orderId) })
    },
  })
}

export const useUpdateBudgetLine = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, blId, data }: { orderId: string; blId: string; data: Record<string, unknown> }) =>
      api.updateBudgetLine(orderId, blId, data),
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: coBudgetKeys.lines(v.orderId) }),
  })
}

export const useDeleteBudgetLine = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, blId }: { orderId: string; blId: string }) =>
      api.deleteBudgetLine(orderId, blId),
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: coBudgetKeys.lines(v.orderId) }),
  })
}

// ── Variance Runs ─────────────────────────────────────────────────────────────

export const coVrunKeys = {
  list: (p?: Record<string, unknown>) => ['controlling', 'variance-runs', p] as const,
}

export const useVarianceRuns = (params?: {
  company_id?: string
  period_year?: number
  period_month?: number
  status?: string
}) =>
  useQuery({
    queryKey: coVrunKeys.list(params),
    queryFn: () => api.listVarianceRuns(params),
  })

export const useCreateVarianceRun = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createVarianceRun,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['controlling', 'variance-runs'] }),
  })
}

export const usePostVarianceRun = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ runId, entry_date }: { runId: string; entry_date?: string }) =>
      api.postVarianceRun(runId, entry_date ? { entry_date } : undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['controlling', 'variance-runs'] })
      qc.invalidateQueries({ queryKey: ['controlling', 'dashboard'] })
    },
  })
}

// ── Period-end report ─────────────────────────────────────────────────────────

export const coPeriodKeys = {
  report: (y: number, m: number, cid?: string) => ['controlling', 'period-end', y, m, cid] as const,
}

export const usePeriodEndReport = (year: number, month: number, companyId?: string) =>
  useQuery({
    queryKey: coPeriodKeys.report(year, month, companyId),
    queryFn: () => api.getPeriodEndReport({ period_year: year, period_month: month, company_id: companyId }),
    enabled: year > 0 && month > 0,
  })

// ── Internal orders report ────────────────────────────────────────────────────

export const coInternalKeys = {
  report: (p?: Record<string, unknown>) => ['controlling', 'internal-orders-report', p] as const,
}

export const useInternalOrdersReport = (params?: {
  company_id?: string
  order_kind?: string
  status?: string
}) =>
  useQuery({
    queryKey: coInternalKeys.report(params),
    queryFn: () => api.getInternalOrdersReport(params),
  })

// ── Work Centers ──────────────────────────────────────────────────────────────

export const coWcKeys = {
  list: (p?: Record<string, unknown>) => ['controlling', 'work-centers', p] as const,
}

export const useWorkCenters = (params?: { company_id?: string; is_active?: boolean }) =>
  useQuery({
    queryKey: coWcKeys.list(params),
    queryFn: () => api.listWorkCenters(params),
  })

export const useCreateWorkCenter = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createWorkCenter,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['controlling', 'work-centers'] }),
  })
}

export const useUpdateWorkCenter = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.updateWorkCenter(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['controlling', 'work-centers'] }),
  })
}

export const useDeleteWorkCenter = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteWorkCenter(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['controlling', 'work-centers'] }),
  })
}

// ── Routings ──────────────────────────────────────────────────────────────────

export const coRoutingKeys = {
  list: (p?: Record<string, unknown>) => ['controlling', 'routings', p] as const,
  one: (id: string) => ['controlling', 'routing', id] as const,
}

export const useRoutings = (params?: { company_id?: string; product_id?: string; status?: string }) =>
  useQuery({
    queryKey: coRoutingKeys.list(params),
    queryFn: () => api.listRoutings(params),
  })

export const useRouting = (id: string | undefined) =>
  useQuery({
    queryKey: coRoutingKeys.one(id ?? ''),
    queryFn: () => api.getRouting(id!),
    enabled: !!id,
  })

export const useCreateRouting = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createRouting,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['controlling', 'routings'] }),
  })
}

export const useUpdateRouting = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.updateRouting(id, data),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['controlling', 'routings'] })
      qc.invalidateQueries({ queryKey: coRoutingKeys.one(v.id) })
    },
  })
}

export const useDeleteRouting = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteRouting(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['controlling', 'routings'] }),
  })
}

export const useAddRoutingOperation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ routingId, data }: { routingId: string; data: Record<string, unknown> }) =>
      api.addRoutingOperation(routingId, data),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: coRoutingKeys.one(v.routingId) })
      qc.invalidateQueries({ queryKey: ['controlling', 'routings'] })
    },
  })
}

export const useUpdateRoutingOperation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ routingId, opId, data }: { routingId: string; opId: string; data: Record<string, unknown> }) =>
      api.updateRoutingOperation(routingId, opId, data),
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: coRoutingKeys.one(v.routingId) }),
  })
}

export const useDeleteRoutingOperation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ routingId, opId }: { routingId: string; opId: string }) =>
      api.deleteRoutingOperation(routingId, opId),
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: coRoutingKeys.one(v.routingId) }),
  })
}

export const useSetCostVersionRouting = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ versionId, routing_id }: { versionId: string; routing_id: string | null }) =>
      api.setCostVersionRouting(versionId, { routing_id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['controlling', 'product-costs'] }),
  })
}

export const useApplyOverheadToCostVersion = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ versionId, ...data }: { versionId: string } & Record<string, unknown>) =>
      api.applyOverheadToCostVersion(versionId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['controlling', 'product-costs'] }),
  })
}

// ── Controlling Areas ──────────────────────────────────────────────────────────

export const coAreaKeys = {
  list: () => ['controlling', 'controlling-areas'] as const,
  companies: (areaId: string) => ['controlling', 'controlling-area-companies', areaId] as const,
}

export const useControllingAreas = () =>
  useQuery({
    queryKey: coAreaKeys.list(),
    queryFn: () => api.listControllingAreas(),
  })

export const useControllingAreaCompanies = (areaId: string | undefined) =>
  useQuery({
    queryKey: coAreaKeys.companies(areaId ?? ''),
    queryFn: () => api.listControllingAreaCompanies(areaId!),
    enabled: !!areaId,
  })

export const useCreateControllingArea = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createControllingArea,
    onSuccess: () => qc.invalidateQueries({ queryKey: coAreaKeys.list() }),
  })
}

export const useUpdateControllingArea = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.updateControllingArea(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: coAreaKeys.list() }),
  })
}

export const useDeleteControllingArea = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteControllingArea,
    onSuccess: () => qc.invalidateQueries({ queryKey: coAreaKeys.list() }),
  })
}

export const useAssignCompanyToControllingArea = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ areaId, companyId }: { areaId: string; companyId: string }) =>
      api.assignCompanyToControllingArea(areaId, companyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: coAreaKeys.list() })
      qc.invalidateQueries({ queryKey: ['controlling', 'controlling-area-companies'] })
      qc.invalidateQueries({ queryKey: ['finance', 'companies'] })
    },
  })
}
