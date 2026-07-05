export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'

export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent'

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface ProjectMilestone {
  id?: string
  title: string
  due_date?: string | null
  completed?: boolean
  completed_at?: string | null
}

export interface ProjectChecklistItem {
  id?: string
  text: string
  done?: boolean
}

export interface LinkedTaskSummary {
  id: string
  title: string
  status: TaskStatus
}

export interface Project {
  id: string
  vendor_id: string
  store_id?: string | null
  sales_area_id?: string | null
  items?: ProjectItemInput[]
  project_number: string
  name: string
  description?: string | null
  status: ProjectStatus
  priority: ProjectPriority
  customer_id?: string | null
  customer_name?: string | null
  customer_email?: string | null
  customer_phone?: string | null
  owner_id?: string | null
  owner_name?: string | null
  start_date?: string | null
  end_date?: string | null
  due_date?: string | null
  budget?: number | null
  currency: string
  progress_percent: number
  color?: string | null
  tags?: string[]
  milestones?: ProjectMilestone[]
  created_at: string
  updated_at: string
  completed_at?: string | null
  task_count?: number
  done_task_count?: number
}

export interface ProjectTask {
  id: string
  vendor_id: string
  project_id: string
  title: string
  description?: string | null
  status: TaskStatus
  priority: TaskPriority
  assignee_id?: string | null
  assignee_name?: string | null
  parent_task_id?: string | null
  parent_title?: string | null
  linked_task_ids?: string[]
  linked_tasks?: LinkedTaskSummary[]
  subtask_count?: number
  due_date?: string | null
  position: number
  labels?: string[]
  checklist?: ProjectChecklistItem[]
  created_at: string
  updated_at: string
  completed_at?: string | null
}

export interface ProjectOverview {
  total_projects: number
  by_status: Record<string, number>
  active_count: number
  overdue_count: number
  total_tasks: number
  open_tasks: number
  completed_tasks: number
  avg_progress: number
}

export interface ProjectListResponse {
  items: Project[]
  total: number
  page: number
  size: number
  pages: number
}

export interface ProjectItemInput {
  id: string
  name: string
  item_type: 'product' | 'service'
  sku?: string
  price?: number
}

export interface ProjectCreateInput {
  name: string
  description?: string
  status?: ProjectStatus
  priority?: ProjectPriority
  store_id?: string
  sales_area_id?: string
  items?: ProjectItemInput[]
  customer_id?: string
  customer_name?: string
  owner_id?: string
  owner_name?: string
  start_date?: string
  end_date?: string
  due_date?: string
}

export interface ProjectUpdateInput {
  name?: string
  description?: string
  status?: ProjectStatus
  priority?: ProjectPriority
  customer_id?: string | null
  customer_name?: string | null
  owner_id?: string | null
  owner_name?: string | null
  start_date?: string
  end_date?: string
  due_date?: string
  progress_percent?: number
  milestones?: ProjectMilestone[]
}

export interface ProjectTaskCreateInput {
  title: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  assignee_id?: string
  assignee_name?: string
  parent_task_id?: string
  linked_task_ids?: string[]
  due_date?: string
  position?: number
}

export interface ProjectTaskUpdateInput {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  assignee_id?: string | null
  assignee_name?: string | null
  parent_task_id?: string | null
  linked_task_ids?: string[]
  due_date?: string
  position?: number
}

export interface TaskReorderItem {
  id: string
  status: TaskStatus
  position: number
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const PROJECT_PRIORITY_LABELS: Record<ProjectPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
}

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

export const TASK_COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'review', 'done']
