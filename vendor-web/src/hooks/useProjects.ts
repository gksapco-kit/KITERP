import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { vendorApi } from '@/api/vendor'
import { apiError } from '@/lib/errorMessages'
import type {
  Project,
  ProjectCreateInput,
  ProjectOverview,
  ProjectTask,
  ProjectTaskCreateInput,
  ProjectTaskUpdateInput,
  ProjectUpdateInput,
  TaskReorderItem,
} from '@/types/project'

// ── Costing types ──────────────────────────────────────────────────────────

export interface ProjectCostingStatus {
  project_id: string
  company_id: string | null
  fin_project_id: string | null
  co_order_id: string | null
  costing_enabled: boolean
  settlement_status: string | null
  order_no: string | null
}

export interface ProjectBudgetLine {
  id: string
  order_id: string
  company_id: string
  vendor_id: string
  budget_type: string
  category: string
  description: string | null
  fiscal_year: number | null
  period_month: number | null
  amount_budgeted: string
  currency: string
}

export interface ProjectCostLine {
  id: string
  order_id: string
  category: string
  description: string | null
  product_id: string | null
  activity_type_id?: string | null
  overhead_pool_id?: string | null
  uom: string
  qty_planned: string
  qty_actual: string
  rate_planned: string
  rate_actual: string
  amount_planned: string
  amount_actual: string
  sequence: number
}

export interface ProjectBudgetVsActual {
  order_id: string
  order_no: string
  title: string | null
  order_kind: string
  total_budgeted: string
  total_planned: string
  total_actual: string
  total_variance: string
  budget_lines: ProjectBudgetLine[]
}

export interface ProjectVariance {
  order_id: string
  order_no: string
  planned_total: string
  actual_total: string
  total_variance: string
  by_category: Record<string, { planned: string; actual: string }>
  settlement_status: string
}

export interface ProjectGoodsMovement {
  id: string
  order_id: string
  company_id: string
  vendor_id: string
  movement_type: string
  posting_date: string
  document_no: string | null
  product_id: string | null
  description: string | null
  uom: string
  qty: string
  unit_cost: string
  total_cost: string
  status: string
  reversal_reason: string | null
  journal_entry_id: string | null
  extra?: Record<string, unknown> | null
  created_at: string | null
}

export interface ProjectActivityConfirmation {
  id: string
  order_id: string
  company_id: string
  vendor_id: string
  confirmation_date: string
  confirmation_type: string
  hours_confirmed: string
  rate_per_hour: string
  total_cost: string
  qty_confirmed: string
  narration: string | null
  status: string
  journal_entry_id: string | null
  created_at: string | null
}

export interface ProjectAuditEntry {
  id: string
  entity_type: string
  entity_id: string
  action: string
  performed_by_id: string | null
  performed_by_name: string | null
  diff: Record<string, unknown> | null
  created_at: string | null
}

const KEY = (...parts: (string | number | undefined | Record<string, unknown>)[]) =>
  ['projects', ...parts] as const

export function useProjectsOverview() {
  return useQuery({
    queryKey: KEY('overview'),
    queryFn: () => vendorApi.getProjectsOverview() as Promise<ProjectOverview>,
  })
}

export function useProjects(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: KEY('list', params),
    queryFn: () => vendorApi.listProjects(params),
  })
}

export function useProject(id?: string) {
  return useQuery({
    queryKey: KEY('detail', id),
    queryFn: () => vendorApi.getProject(id!) as Promise<Project>,
    enabled: !!id,
  })
}

export function useProjectTasks(projectId?: string) {
  return useQuery({
    queryKey: KEY('tasks', projectId),
    queryFn: () => vendorApi.listProjectTasks(projectId!) as Promise<ProjectTask[]>,
    enabled: !!projectId,
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ProjectCreateInput) =>
      vendorApi.createProject(data as unknown as Record<string, unknown>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project created')
    },
    onError: apiError('Failed to create project'),
  })
}

export function useUpdateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProjectUpdateInput }) =>
      vendorApi.updateProject(id, data as unknown as Record<string, unknown>),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: KEY('detail', id) })
    },
    onError: apiError('Failed to update project'),
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vendorApi.deleteProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project deleted')
    },
    onError: apiError('Failed to delete project'),
  })
}

export function useCreateProjectTask(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ProjectTaskCreateInput) =>
      vendorApi.createProjectTask(projectId, data as unknown as Record<string, unknown>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY('tasks', projectId) })
      qc.invalidateQueries({ queryKey: KEY('detail', projectId) })
      qc.invalidateQueries({ queryKey: KEY('overview') })
    },
    onError: apiError('Failed to create task'),
  })
}

export function useUpdateProjectTask(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: ProjectTaskUpdateInput }) =>
      vendorApi.updateProjectTask(projectId, taskId, data as unknown as Record<string, unknown>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY('tasks', projectId) })
      qc.invalidateQueries({ queryKey: KEY('detail', projectId) })
      qc.invalidateQueries({ queryKey: KEY('overview') })
    },
    onError: apiError('Failed to update task'),
  })
}

export function useDeleteProjectTask(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) => vendorApi.deleteProjectTask(projectId, taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY('tasks', projectId) })
      qc.invalidateQueries({ queryKey: KEY('detail', projectId) })
      qc.invalidateQueries({ queryKey: KEY('overview') })
      toast.success('Task deleted')
    },
    onError: apiError('Failed to delete task'),
  })
}

export function useReorderProjectTasks(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (items: TaskReorderItem[]) => vendorApi.reorderProjectTasks(projectId, items),
    // Optimistic update: immediately reflect the new order/status in the cache.
    onMutate: async (items: TaskReorderItem[]) => {
      await qc.cancelQueries({ queryKey: KEY('tasks', projectId) })
      const prev = qc.getQueryData<ProjectTask[]>(KEY('tasks', projectId))
      qc.setQueryData<ProjectTask[]>(KEY('tasks', projectId), (old) => {
        if (!old) return old
        return old.map((t) => {
          const update = items.find((i) => i.id === t.id)
          if (!update) return t
          return { ...t, status: update.status as ProjectTask['status'], position: update.position }
        })
      })
      return { prev }
    },
    onError: (_err, _vars, context: { prev?: ProjectTask[] } | undefined) => {
      if (context?.prev) qc.setQueryData(KEY('tasks', projectId), context.prev)
      apiError('Failed to reorder tasks')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEY('tasks', projectId) })
    },
  })
}

// ── Costing hooks ──────────────────────────────────────────────────────────

export function useProjectCostingStatus(projectId?: string) {
  return useQuery<ProjectCostingStatus>({
    queryKey: KEY('costing-status', projectId),
    queryFn: () => vendorApi.getProjectCostingStatus(projectId!),
    enabled: !!projectId,
  })
}

export function useEnableProjectCosting(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (companyId: string) => vendorApi.enableProjectCosting(projectId, companyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY('costing-status', projectId) })
      qc.invalidateQueries({ queryKey: KEY('detail', projectId) })
      toast.success('Project costing enabled')
    },
    onError: apiError('Failed to enable costing'),
  })
}

export function useProjectBudgetVsActual(projectId?: string) {
  return useQuery<ProjectBudgetVsActual>({
    queryKey: KEY('costing-bva', projectId),
    queryFn: () => vendorApi.getProjectBudgetVsActual(projectId!),
    enabled: !!projectId,
  })
}

export function useProjectBudgetLines(projectId?: string) {
  return useQuery<ProjectBudgetLine[]>({
    queryKey: KEY('costing-budget-lines', projectId),
    queryFn: () => vendorApi.listProjectBudgetLines(projectId!),
    enabled: !!projectId,
  })
}

export function useCreateProjectBudgetLine(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => vendorApi.createProjectBudgetLine(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY('costing-budget-lines', projectId) })
      qc.invalidateQueries({ queryKey: KEY('costing-bva', projectId) })
      toast.success('Budget line added')
    },
    onError: apiError('Failed to add budget line'),
  })
}

export function useDeleteProjectBudgetLine(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (blId: string) => vendorApi.deleteProjectBudgetLine(projectId, blId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY('costing-budget-lines', projectId) })
      qc.invalidateQueries({ queryKey: KEY('costing-bva', projectId) })
      toast.success('Budget line deleted')
    },
    onError: apiError('Failed to delete budget line'),
  })
}

export function useProjectCostLines(projectId?: string) {
  return useQuery<ProjectCostLine[]>({
    queryKey: KEY('costing-cost-lines', projectId),
    queryFn: () => vendorApi.listProjectCostLines(projectId!),
    enabled: !!projectId,
  })
}

export function useAddProjectCostLine(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => vendorApi.addProjectCostLine(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY('costing-cost-lines', projectId) })
      qc.invalidateQueries({ queryKey: KEY('costing-bva', projectId) })
      toast.success('Plan line added')
    },
    onError: apiError('Failed to add plan line'),
  })
}

export function usePatchProjectCostLine(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ lineId, data }: { lineId: string; data: Record<string, unknown> }) =>
      vendorApi.patchProjectCostLine(projectId, lineId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY('costing-cost-lines', projectId) })
      qc.invalidateQueries({ queryKey: KEY('costing-bva', projectId) })
    },
    onError: apiError('Failed to update cost line'),
  })
}

export function useProjectVariance(projectId?: string) {
  return useQuery<ProjectVariance>({
    queryKey: KEY('costing-variance', projectId),
    queryFn: () => vendorApi.getProjectVariance(projectId!),
    enabled: !!projectId,
  })
}

export function usePostProjectCompletion(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entryDate?: string) => vendorApi.postProjectCompletion(projectId, entryDate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY('costing-status', projectId) })
      qc.invalidateQueries({ queryKey: KEY('costing-variance', projectId) })
      toast.success('Production completion posted to GL')
    },
    onError: apiError('Settlement failed — check GL mapping configuration'),
  })
}

export function usePostProjectSettlement(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entryDate?: string) => vendorApi.postProjectSettlement(projectId, entryDate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY('costing-status', projectId) })
      qc.invalidateQueries({ queryKey: KEY('costing-variance', projectId) })
      toast.success('Project settlement posted to GL')
    },
    onError: apiError('Settlement failed — check GL mapping configuration'),
  })
}

// ── Document-driven actuals hooks ─────────────────────────────────────────

export function useProjectGoodsMovements(projectId?: string) {
  return useQuery<ProjectGoodsMovement[]>({
    queryKey: KEY('costing-goods-movements', projectId),
    queryFn: () => vendorApi.listProjectGoodsMovements(projectId!),
    enabled: !!projectId,
  })
}

export function usePostProjectGoodsMovement(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => vendorApi.postProjectGoodsMovement(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY('costing-goods-movements', projectId) })
      qc.invalidateQueries({ queryKey: KEY('costing-cost-lines', projectId) })
      qc.invalidateQueries({ queryKey: KEY('costing-bva', projectId) })
      toast.success('Goods movement posted')
    },
    onError: apiError('Failed to post goods movement'),
  })
}

export function useReverseProjectGoodsMovement(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ gmId, reason }: { gmId: string; reason: string }) =>
      vendorApi.reverseProjectGoodsMovement(projectId, gmId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY('costing-goods-movements', projectId) })
      qc.invalidateQueries({ queryKey: KEY('costing-cost-lines', projectId) })
      qc.invalidateQueries({ queryKey: KEY('costing-bva', projectId) })
      toast.success('Goods movement reversed')
    },
    onError: apiError('Failed to reverse goods movement'),
  })
}

export function useProjectActivityConfirmations(projectId?: string) {
  return useQuery<ProjectActivityConfirmation[]>({
    queryKey: KEY('costing-activity-confirmations', projectId),
    queryFn: () => vendorApi.listProjectActivityConfirmations(projectId!),
    enabled: !!projectId,
  })
}

export function usePostProjectActivityConfirmation(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => vendorApi.postProjectActivityConfirmation(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY('costing-activity-confirmations', projectId) })
      qc.invalidateQueries({ queryKey: KEY('costing-cost-lines', projectId) })
      qc.invalidateQueries({ queryKey: KEY('costing-bva', projectId) })
      toast.success('Activity confirmation posted')
    },
    onError: apiError('Failed to post activity confirmation'),
  })
}

export function useProjectCostingAuditLog(projectId?: string) {
  return useQuery<ProjectAuditEntry[]>({
    queryKey: KEY('costing-audit-log', projectId),
    queryFn: () => vendorApi.getProjectCostingAuditLog(projectId!),
    enabled: !!projectId,
  })
}
