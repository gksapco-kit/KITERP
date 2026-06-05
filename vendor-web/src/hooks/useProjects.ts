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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY('tasks', projectId) })
    },
    onError: apiError('Failed to reorder tasks'),
  })
}
