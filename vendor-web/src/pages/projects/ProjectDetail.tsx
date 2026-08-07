import { useMemo, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { useStoreName } from '@/components/common/BusinessUnitSelect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  useProject,
  useProjectTasks,
  useUpdateProject,
  useCreateProjectTask,
  useUpdateProjectTask,
  useDeleteProjectTask,
  useReorderProjectTasks,
  useProjectCostingStatus,
  useEnableProjectCosting,
  useProjectBudgetVsActual,
  useProjectBudgetLines,
  useCreateProjectBudgetLine,
  useDeleteProjectBudgetLine,
  useProjectCostLines,
  useAddProjectCostLine,
  usePatchProjectCostLine,
  useProjectVariance,
  usePostProjectCompletion,
  usePostProjectSettlement,
  useProjectGoodsMovements,
  usePostProjectGoodsMovement,
  useReverseProjectGoodsMovement,
  useProjectActivityConfirmations,
  usePostProjectActivityConfirmation,
  useProjectCostingAuditLog,
  type ProjectBudgetLine,
  type ProjectCostLine,
  type ProjectGoodsMovement,
  type ProjectActivityConfirmation,
  type ProjectAuditEntry,
} from '@/hooks/useProjects'
import { useCompanies } from '@/hooks/useFinance'
import { useHasPermission } from '@/hooks/usePermissions'
import { useProducts } from '@/hooks/useVendor'
import { formatDate, formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { CustomerPicker, type CustomerPickerValue } from '@/components/commission/CustomerPicker'
import { StaffPicker, type StaffPickerValue } from '@/components/commission/StaffPicker'
import { TaskEditorPanel } from '@/components/projects/TaskEditorPanel'
import { Select } from '@/components/ui/select'
import {
  ArrowLeft, Loader2, ChevronLeft, ChevronRight, Plus, Trash2,
  CheckCircle2, Circle, Flag, GripVertical, Pencil, Save, X,
  User, Link2, GitBranch, ExternalLink,
  BarChart3, DollarSign, Zap, AlertTriangle, CheckCircle,
  PackageCheck, Clock, RotateCcw, FileText, History,
} from 'lucide-react'
import type {
  ProjectMilestone,
  ProjectPriority,
  ProjectStatus,
  ProjectTask,
  ProjectTaskUpdateInput,
  TaskStatus,
} from '@/types/project'
import {
  PROJECT_PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  TASK_COLUMNS,
  TASK_STATUS_LABELS,
} from '@/types/project'

const COLUMN_COLORS: Record<TaskStatus, string> = {
  todo: 'border-t-slate-400',
  in_progress: 'border-t-blue-500',
  review: 'border-t-amber-500',
  done: 'border-t-emerald-500',
}

function nextStatus(status: TaskStatus): TaskStatus | null {
  const idx = TASK_COLUMNS.indexOf(status)
  return idx < TASK_COLUMNS.length - 1 ? TASK_COLUMNS[idx + 1] : null
}

function prevStatus(status: TaskStatus): TaskStatus | null {
  const idx = TASK_COLUMNS.indexOf(status)
  return idx > 0 ? TASK_COLUMNS[idx - 1] : null
}

function TaskCard({
  task,
  onMove,
  onDelete,
  onDragStart,
  onEdit,
  canManage = true,
}: {
  task: ProjectTask
  onMove: (taskId: string, status: TaskStatus) => void
  onDelete: (taskId: string) => void
  onDragStart: (taskId: string) => void
  onEdit: (task: ProjectTask) => void
  canManage?: boolean
}) {
  const prev = prevStatus(task.status)
  const next = nextStatus(task.status)

  return (
    <div
      draggable
      onDragStart={() => onDragStart(task.id)}
      className="rounded-md border border-border bg-card px-2 py-1.5 shadow-sm hover:shadow transition-shadow cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start gap-1">
        <GripVertical className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-0.5">
            <button
              type="button"
              onClick={() => onEdit(task)}
              className="min-w-0 flex-1 text-left text-xs font-medium leading-snug text-foreground hover:text-primary"
            >
              {task.title}
            </button>
            {canManage && prev && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onMove(task.id, prev) }}
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title={`Move to ${TASK_STATUS_LABELS[prev]}`}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            )}
            {canManage && next && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onMove(task.id, next) }}
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title={`Move to ${TASK_STATUS_LABELS[next]}`}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
            {canManage && (
              <button
                type="button"
                onClick={() => onDelete(task.id)}
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title="Delete task"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
          {(task.assignee_name || task.parent_title || (task.linked_tasks?.length ?? 0) > 0 || task.due_date) && (
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              {task.assignee_name && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1 py-0.5 text-[10px] leading-none text-muted-foreground">
                  <User className="h-2.5 w-2.5" />
                  {task.assignee_name}
                </span>
              )}
              {task.parent_title && (
                <span className="inline-flex items-center gap-0.5 text-[10px] leading-none text-muted-foreground" title="Subtask of">
                  <GitBranch className="h-2.5 w-2.5" />
                  {task.parent_title}
                </span>
              )}
              {(task.linked_tasks?.length ?? 0) > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] leading-none text-muted-foreground">
                  <Link2 className="h-2.5 w-2.5" />
                  {task.linked_tasks!.length} linked
                </span>
              )}
              {task.due_date && (
                <span className="text-[10px] leading-none text-muted-foreground">Due {formatDate(task.due_date)}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function KanbanColumn({
  status,
  tasks,
  onAdd,
  onMove,
  onDelete,
  onDrop,
  draggingId,
  onDragStart,
  onEditTask,
  canManage = true,
}: {
  status: TaskStatus
  tasks: ProjectTask[]
  onAdd: (status: TaskStatus, title: string) => void
  onMove: (taskId: string, status: TaskStatus) => void
  onDelete: (taskId: string) => void
  onDrop: (status: TaskStatus, dropIndex?: number) => void
  draggingId: string | null
  onDragStart: (taskId: string) => void
  onEditTask: (task: ProjectTask) => void
  canManage?: boolean
}) {
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const submitAdd = () => {
    const title = draft.trim()
    if (!title) return
    onAdd(status, title)
    setDraft('')
    setAdding(false)
  }

  return (
    <div
      className={`flex flex-col min-w-[260px] flex-1 rounded-xl border border-border border-t-4 ${COLUMN_COLORS[status]} bg-muted/20`}
      onDragOver={(e) => { e.preventDefault(); if (dragOverIndex === null) setDragOverIndex(tasks.length) }}
      onDrop={() => { onDrop(status, dragOverIndex ?? tasks.length); setDragOverIndex(null) }}
      onDragLeave={() => setDragOverIndex(null)}
    >
      <div className="px-3 py-2.5 flex items-center justify-between border-b border-border/60">
        <h3 className="text-sm font-semibold text-foreground">{TASK_STATUS_LABELS[status]}</h3>
        <Badge variant="secondary">{tasks.length}</Badge>
      </div>
      <div className="flex-1 p-1.5 space-y-1.5 min-h-[200px]">
        {tasks.map((t, i) => (
          <div
            key={t.id}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverIndex(i) }}
          >
            {dragOverIndex === i && draggingId && draggingId !== t.id && (
              <div className="h-1 rounded bg-primary/60 mb-1" aria-hidden />
            )}
            <TaskCard
              task={t}
              onMove={onMove}
              onDelete={onDelete}
              onDragStart={onDragStart}
              onEdit={onEditTask}
              canManage={canManage}
            />
          </div>
        ))}
        {draggingId && dragOverIndex === tasks.length && (
          <div className="h-1 rounded bg-primary/30" aria-hidden />
        )}
      </div>
      {canManage && (
        <div className="p-2 border-t border-border/60">
          {adding ? (
            <div className="space-y-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Task title"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitAdd()
                  if (e.key === 'Escape') setAdding(false)
                }}
              />
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={submitAdd} disabled={!draft.trim()}>Add</Button>
                <Button size="sm" variant="cancel" onClick={() => setAdding(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="w-full flex items-center justify-center gap-1 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-md transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add task
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: project, isLoading: projectLoading } = useProject(id)
  const storeName = useStoreName(project?.store_id)
  const { data: tasks = [], isLoading: tasksLoading } = useProjectTasks(id)
  const updateProject = useUpdateProject()
  const createTask = useCreateProjectTask(id!)
  const updateTask = useUpdateProjectTask(id!)
  const deleteTask = useDeleteProjectTask(id!)
  const reorderTasks = useReorderProjectTasks(id!)
  const [activeTab, setActiveTab] = useState<'overview' | 'planning' | 'settlement'>('overview')

  const canManage = useHasPermission('projects.manage')
  const canCosting = useHasPermission('projects.manage')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    status: 'planning' as ProjectStatus,
    priority: 'medium' as ProjectPriority,
    start_date: '',
    end_date: '',
    due_date: '',
  })
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [newMilestone, setNewMilestone] = useState('')
  const [newMilestoneDate, setNewMilestoneDate] = useState('')
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null)
  const [customer, setCustomer] = useState<CustomerPickerValue | null>(null)
  const [owner, setOwner] = useState<StaffPickerValue | null>(null)

  const tasksByColumn = useMemo(() => {
    const map: Record<TaskStatus, ProjectTask[]> = {
      todo: [],
      in_progress: [],
      review: [],
      done: [],
    }
    for (const t of tasks) {
      const col = TASK_COLUMNS.includes(t.status) ? t.status : 'todo'
      map[col].push(t)
    }
    for (const col of TASK_COLUMNS) {
      map[col].sort((a, b) => a.position - b.position)
    }
    return map
  }, [tasks])

  const startEdit = useCallback(() => {
    if (!project) return
    setEditForm({
      name: project.name,
      description: project.description ?? '',
      status: project.status,
      priority: project.priority,
      start_date: project.start_date ?? '',
      end_date: project.end_date ?? '',
      due_date: project.due_date ?? '',
    })
    setCustomer(
      project.customer_id
        ? {
            id: project.customer_id,
            full_name: project.customer_name || 'Customer',
            email: project.customer_email ?? undefined,
            phone: project.customer_phone ?? undefined,
          }
        : null,
    )
    setOwner(
      project.owner_id
        ? { id: project.owner_id, user_id: project.owner_id, full_name: project.owner_name || 'Owner' }
        : null,
    )
    setEditing(true)
  }, [project])

  const saveEdit = () => {
    if (!id || !editForm.name.trim()) return
    updateProject.mutate(
      {
        id,
        data: {
          name: editForm.name.trim(),
          description: editForm.description.trim() || undefined,
          status: editForm.status,
          priority: editForm.priority,
          start_date: editForm.start_date || undefined,
          end_date: editForm.end_date || undefined,
          due_date: editForm.due_date || undefined,
          customer_id: customer?.id ?? null,
          customer_name: customer?.full_name ?? null,
          owner_id: owner?.user_id ?? null,
          owner_name: owner?.full_name ?? null,
        },
      },
      { onSuccess: () => { setEditing(false); toast.success('Project updated') } },
    )
  }

  const saveTask = (taskId: string, data: ProjectTaskUpdateInput) => {
    updateTask.mutate(
      { taskId, data },
      {
        onSuccess: () => {
          setEditingTask(null)
          toast.success('Task updated')
        },
      },
    )
  }

  const handleMoveTask = (taskId: string, status: TaskStatus) => {
    const colTasks = tasksByColumn[status]
    updateTask.mutate({
      taskId,
      data: { status, position: colTasks.length },
    })
  }

  const handleDrop = (targetStatus: TaskStatus, dropIndex?: number) => {
    if (!draggingId) return
    const dragged = tasks.find((t) => t.id === draggingId)
    if (!dragged) { setDraggingId(null); return }

    if (dragged.status !== targetStatus) {
      // Cross-column move: append to target column (existing behaviour).
      handleMoveTask(draggingId, targetStatus)
    } else if (dropIndex !== undefined) {
      // Within-column reorder: rebuild positions for the affected column.
      const colTasks = tasksByColumn[targetStatus].filter((t) => t.id !== draggingId)
      const reordered = [
        ...colTasks.slice(0, dropIndex),
        dragged,
        ...colTasks.slice(dropIndex),
      ]
      const reorderItems = reordered.map((t, i) => ({
        id: t.id,
        status: targetStatus,
        position: i,
      }))
      reorderTasks.mutate(reorderItems)
    }
    setDraggingId(null)
  }

  const handleAddTask = (status: TaskStatus, title: string) => {
    createTask.mutate({
      title,
      status,
      position: tasksByColumn[status].length,
    })
  }

  const milestones: ProjectMilestone[] = project?.milestones ?? []

  const addMilestone = () => {
    if (!id || !newMilestone.trim()) return
    const next: ProjectMilestone[] = [
      ...milestones,
      {
        id: crypto.randomUUID(),
        title: newMilestone.trim(),
        completed: false,
        due_date: newMilestoneDate || undefined,
      },
    ]
    updateProject.mutate(
      { id, data: { milestones: next } },
      { onSuccess: () => { setNewMilestone(''); setNewMilestoneDate(''); toast.success('Milestone added') } },
    )
  }

  const toggleMilestone = (msId: string) => {
    if (!id) return
    const next = milestones.map((m) =>
      m.id === msId
        ? { ...m, completed: !m.completed, completed_at: !m.completed ? new Date().toISOString() : null }
        : m,
    )
    updateProject.mutate({ id, data: { milestones: next } })
  }

  if (projectLoading || !id) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Project not found.</p>
        <Link to="/projects" className="text-primary hover:underline text-sm mt-2 inline-block">Back to projects</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        to="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to projects
      </Link>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            {editing ? (
              <div className="min-w-[280px] flex-1 space-y-2">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input
                      className="h-8"
                      value={editForm.name}
                      onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Status</Label>
                    <Select
                      value={editForm.status}
                      onChange={(v) => setEditForm((p) => ({ ...p, status: v as ProjectStatus }))}
                      className="h-8 rounded-md border border-input bg-background text-sm"
                      options={(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map((s) => ({
                        value: s,
                        label: PROJECT_STATUS_LABELS[s],
                      }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Priority</Label>
                    <Select
                      value={editForm.priority}
                      onChange={(v) => setEditForm((p) => ({ ...p, priority: v as ProjectPriority }))}
                      className="h-8 rounded-md border border-input bg-background text-sm"
                      options={(Object.keys(PROJECT_PRIORITY_LABELS) as ProjectPriority[]).map((p) => ({
                        value: p,
                        label: PROJECT_PRIORITY_LABELS[p],
                      }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Start</Label>
                    <Input className="h-8" type="date" value={editForm.start_date} onChange={(e) => setEditForm((p) => ({ ...p, start_date: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">End</Label>
                    <Input className="h-8" type="date" value={editForm.end_date} onChange={(e) => setEditForm((p) => ({ ...p, end_date: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Due</Label>
                    <Input className="h-8" type="date" value={editForm.due_date} onChange={(e) => setEditForm((p) => ({ ...p, due_date: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                    rows={2}
                    className="flex min-h-0 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                    placeholder="Description"
                  />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="min-w-0 space-y-1">
                    <Label className="text-xs">Customer</Label>
                    <CustomerPicker
                      selected={customer}
                      onSelect={setCustomer}
                      compact
                      placeholder="Search customers…"
                    />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <Label className="text-xs">Project owner</Label>
                    <StaffPicker
                      selected={owner}
                      onSelect={setOwner}
                      compact
                      placeholder="Search staff…"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-0.5">
                  <Button size="sm" className="h-8" onClick={saveEdit} disabled={updateProject.isPending}>
                    <Save className="mr-1 h-3.5 w-3.5" /> Save
                  </Button>
                  <Button size="sm" variant="cancel" className="h-8" onClick={() => setEditing(false)}>
                    <X className="mr-1 h-3.5 w-3.5" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold text-foreground">{project.name}</h1>
                  <Badge variant="soft">{project.project_number}</Badge>
                  <Badge variant="success">{PROJECT_STATUS_LABELS[project.status]}</Badge>
                  <Badge variant="secondary">{PROJECT_PRIORITY_LABELS[project.priority]}</Badge>
                </div>
                {project.description && (
                  <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{project.description}</p>
                )}
                <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                  {storeName && <span>Business unit: {storeName}</span>}
                  {project.start_date && <span>Start: {formatDate(project.start_date)}</span>}
                  {project.end_date && <span>End: {formatDate(project.end_date)}</span>}
                  {project.due_date && <span>Due: {formatDate(project.due_date)}</span>}
                  {project.customer_name && (
                    <span className="inline-flex items-center gap-1">
                      Customer:
                      {project.customer_id ? (
                        <Link to={`/customers?highlight=${project.customer_id}`} className="text-primary hover:underline inline-flex items-center gap-0.5">
                          {project.customer_name}
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      ) : (
                        project.customer_name
                      )}
                      {project.customer_phone && <span className="text-muted-foreground"> · {project.customer_phone}</span>}
                    </span>
                  )}
                  {project.owner_name && <span>Owner: {project.owner_name}</span>}
                </div>
                {project.items && project.items.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Products & services</p>
                    <div className="flex flex-wrap gap-1.5">
                      {project.items.map((it) => (
                        <span key={it.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs text-foreground">
                          {it.name}
                          <span className="text-muted-foreground">· {it.item_type}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {!editing && canManage && (
              <Button variant="outline" size="sm" onClick={startEdit}>
                <Pencil className="w-4 h-4 mr-1" /> Edit
              </Button>
            )}
          </div>

          <div className="border-t border-border/60 pt-2.5">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{project.progress_percent}% · {project.done_task_count ?? 0}/{project.task_count ?? tasks.length} tasks</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${project.progress_percent}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border pb-0">
        {([
          { key: 'overview', label: 'Overview', icon: Flag },
          { key: 'planning', label: 'Planning & Actuals', icon: BarChart3 },
          { key: 'settlement', label: 'Settlement', icon: DollarSign },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-md border border-b-0 transition-colors ${
              activeTab === key
                ? 'bg-background border-border text-foreground font-medium -mb-px'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Task Board</h2>
            {tasksLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {TASK_COLUMNS.map((col) => (
                  <KanbanColumn
                    key={col}
                    status={col}
                    tasks={tasksByColumn[col]}
                    onAdd={handleAddTask}
                    onMove={handleMoveTask}
                    onDelete={(taskId) => deleteTask.mutate(taskId)}
                    onDrop={(s, idx) => handleDrop(s, idx)}
                    draggingId={draggingId}
                    onDragStart={setDraggingId}
                    onEditTask={setEditingTask}
                    canManage={canManage}
                  />
                ))}
              </div>
            )}
          </div>

          {editingTask && (
            <TaskEditorPanel
              task={editingTask}
              allTasks={tasks}
              onClose={() => setEditingTask(null)}
              onSave={saveTask}
              saving={updateTask.isPending}
            />
          )}

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Flag className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Milestones</h2>
              </div>
              <ul className="space-y-2 mb-4">
                {milestones.length === 0 && (
                  <li className="text-sm text-muted-foreground">No milestones yet.</li>
                )}
                {milestones.map((m) => (
                  <li key={m.id ?? m.title} className="flex items-center gap-3 py-1.5">
                    <button
                      type="button"
                      onClick={() => m.id && toggleMilestone(m.id)}
                      className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                    >
                      {m.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>
                    <span className={`text-sm flex-1 ${m.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {m.title}
                    </span>
                    {m.due_date && (
                      <span className="text-xs text-muted-foreground">{formatDate(m.due_date)}</span>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Input
                  value={newMilestone}
                  onChange={(e) => setNewMilestone(e.target.value)}
                  placeholder="New milestone"
                  onKeyDown={(e) => e.key === 'Enter' && addMilestone()}
                  className="max-w-xs flex-1"
                />
                <Input
                  type="date"
                  value={newMilestoneDate}
                  onChange={(e) => setNewMilestoneDate(e.target.value)}
                  className="w-36 shrink-0"
                  title="Due date (optional)"
                />
                <Button size="sm" onClick={addMilestone} disabled={!newMilestone.trim() || updateProject.isPending}>
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === 'planning' && id && (
        <PlanningTab projectId={id} />
      )}

      {activeTab === 'settlement' && id && (
        <SettlementTab projectId={id} />
      )}
    </div>
  )
}

// ── Planning & Actuals tab ────────────────────────────────────────────────────

const BUDGET_CATEGORIES = ['material', 'labor', 'overhead', 'other']
const COST_LINE_CATEGORIES = ['material', 'labor', 'overhead', 'other']

function PlanningTab({ projectId }: { projectId: string }) {
  const { data: status, isLoading: statusLoading } = useProjectCostingStatus(projectId)
  const { data: project } = useProject(projectId)
  const { data: companies = [] } = useCompanies()
  const enableCosting = useEnableProjectCosting(projectId)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('')

  const defaultCompanyId = companies.find((c) => c.is_default)?.id || companies[0]?.id || ''

  const enabled = status?.costing_enabled
  const coOrderId = status?.co_order_id
  const companyId = status?.company_id
  const storeId = project?.store_id

  // Catalog products for UOM (and material fallback labels) — scoped to project BU
  const { data: productsRaw } = useProducts(
    storeId ? { store_id: storeId, page_size: 200 } : undefined,
  )
  const catalogProducts = useMemo(() => {
    const raw = productsRaw as { items?: unknown[] } | unknown[] | undefined
    if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>
    if (raw && Array.isArray(raw.items)) return raw.items as Array<Record<string, unknown>>
    return [] as Array<Record<string, unknown>>
  }, [productsRaw])

  const productUomById = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of catalogProducts) {
      const id = String(p.id ?? '')
      if (!id) continue
      const productUom = String(p.uom || '').trim()
      if (productUom) map.set(id, productUom)
      const variants = (p.variants as Array<Record<string, unknown>> | undefined) ?? []
      for (const v of variants) {
        const vid = String(v.id ?? '')
        const vuom = String(v.uom || productUom || '').trim()
        if (vid && vuom) map.set(vid, vuom)
      }
    }
    return map
  }, [catalogProducts])

  const resolveProductUom = (productId: string, variantId?: string | null) => {
    if (variantId && productUomById.has(variantId)) return productUomById.get(variantId)!
    if (productUomById.has(productId)) return productUomById.get(productId)!
    return ''
  }

  const { data: bva, isLoading: bvaLoading } = useProjectBudgetVsActual(enabled ? projectId : undefined)
  const { data: budgetLines = [] } = useProjectBudgetLines(enabled ? projectId : undefined)
  const { data: costLines = [] } = useProjectCostLines(enabled ? projectId : undefined)
  const { data: goodsMovements = [] } = useProjectGoodsMovements(enabled ? projectId : undefined)
  const { data: activityConfirmations = [] } = useProjectActivityConfirmations(enabled ? projectId : undefined)
  const { data: auditLog = [] } = useProjectCostingAuditLog(enabled ? projectId : undefined)

  const createBudgetLine = useCreateProjectBudgetLine(projectId)
  const deleteBudgetLine = useDeleteProjectBudgetLine(projectId)
  const addCostLine = useAddProjectCostLine(projectId)
  const patchCostLine = usePatchProjectCostLine(projectId)
  const postGoodsMovement = usePostProjectGoodsMovement(projectId)
  const reverseGoodsMovement = useReverseProjectGoodsMovement(projectId)
  const postActivityConfirmation = usePostProjectActivityConfirmation(projectId)

  const [blForm, setBlForm] = useState({ category: 'material', amount_budgeted: '', description: '' })
  const [clForm, setClForm] = useState({ category: 'material', amount_planned: '', description: '' })
  const [editingLine, setEditingLine] = useState<string | null>(null)
  const [lineEdit, setLineEdit] = useState<Record<string, string>>({})

  // Goods movement form
  const [gmForm, setGmForm] = useState({
    movement_type: 'component_issue',
    product_id: '',
    posting_date: new Date().toISOString().slice(0, 10),
    description: '',
    qty: '',
    unit_cost: '',
    uom: 'EA',
    batch_no: '',
  })
  const [showGmForm, setShowGmForm] = useState(false)
  const [reversingGmId, setReversingGmId] = useState<string | null>(null)
  const [reverseReason, setReverseReason] = useState('')

  // Activity confirmation form
  const [acForm, setAcForm] = useState({
    confirmation_type: 'labor',
    confirmation_date: new Date().toISOString().slice(0, 10),
    hours_confirmed: '',
    rate_per_hour: '',
    narration: '',
  })
  const [showAcForm, setShowAcForm] = useState(false)

  const [activeActualTab, setActiveActualTab] = useState<'material' | 'labor' | 'audit'>('material')

  // Materials available for issue: prefer cost lines with product_id, fall back to project catalog products.
  // UOM always comes from the product master (variant UOM if present), never free-typed.
  const materialOptions = (() => {
    const itemVariantByProduct = new Map(
      (project?.items ?? [])
        .filter((it) => it.item_type === 'product')
        .map((it) => [it.id, it.variant_id ?? null] as const),
    )
    const fromLines = costLines
      .filter((cl) => cl.category === 'material' && cl.product_id)
      .map((cl) => {
        const productId = cl.product_id as string
        const variantId = itemVariantByProduct.get(productId)
        return {
          value: productId,
          label: cl.description || 'Material',
          uom: resolveProductUom(productId, variantId),
          unit_cost: cl.rate_planned || '0',
          description: cl.description || '',
        }
      })
    const seen = new Set(fromLines.map((o) => o.value))
    const fromItems = (project?.items ?? [])
      .filter((it) => it.item_type === 'product' && !seen.has(it.id))
      .map((it) => ({
        value: it.id,
        label: it.sku ? `${it.name} (${it.sku})` : it.name,
        uom: resolveProductUom(it.id, it.variant_id),
        unit_cost: it.price != null ? String(it.price) : '0',
        description: it.name,
      }))
    return [...fromLines, ...fromItems]
  })()

  const emptyGmForm = () => ({
    movement_type: 'component_issue',
    product_id: '',
    posting_date: new Date().toISOString().slice(0, 10),
    description: '',
    qty: '',
    unit_cost: '',
    uom: '',
    batch_no: '',
  })

  const selectMaterial = (productId: string) => {
    const opt = materialOptions.find((o) => o.value === productId)
    setGmForm((f) => ({
      ...f,
      product_id: productId,
      description: opt?.description || f.description,
      uom: opt?.uom || '',
      unit_cost: opt && parseFloat(opt.unit_cost) > 0 ? opt.unit_cost : f.unit_cost,
    }))
  }

  if (statusLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>

  if (!enabled) {
    const companyId = selectedCompanyId || defaultCompanyId
    return (
      <Card>
        <CardContent className="p-6 space-y-4 max-w-md">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">Costing not enabled</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Enable costing to track planned vs actual costs and post settlements to the GL.
            The project's catalog items will be seeded as planned cost lines.
          </p>
          {companies.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Company</Label>
              <Select
                value={companyId}
                onChange={setSelectedCompanyId}
                className="h-9 text-sm rounded-md border border-input"
                options={companies.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
              />
            </div>
          )}
          <Button
            onClick={() => enableCosting.mutate(companyId)}
            disabled={!companyId || enableCosting.isPending}
            className="gap-1.5"
          >
            {enableCosting.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            Enable costing
          </Button>
        </CardContent>
      </Card>
    )
  }

  const totalBudgeted = budgetLines.reduce((s, b) => s + parseFloat(b.amount_budgeted), 0)
  const totalPlanned = parseFloat(bva?.total_planned ?? '0')
  const totalActual = parseFloat(bva?.total_actual ?? '0')

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Budgeted', value: totalBudgeted, color: 'text-blue-700' },
          { label: 'Planned', value: totalPlanned, color: 'text-gray-800' },
          { label: 'Actual', value: totalActual, color: 'text-emerald-700' },
          { label: 'Variance', value: totalPlanned - totalActual, color: totalPlanned - totalActual >= 0 ? 'text-emerald-600' : 'text-red-600' },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
              <p className={`text-lg font-bold ${color}`}>{formatCurrency(value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Budget lines */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold">Budget lines</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-left pb-1.5 pr-3">Category</th>
                <th className="text-left pb-1.5 pr-3">Description</th>
                <th className="text-right pb-1.5 pr-3">Amount</th>
                <th className="text-left pb-1.5">Type</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {budgetLines.map((bl) => (
                <tr key={bl.id} className="border-b border-border/40 last:border-0">
                  <td className="py-2 pr-3 capitalize">{bl.category}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{bl.description || '—'}</td>
                  <td className="py-2 pr-3 text-right font-medium">{formatCurrency(parseFloat(bl.amount_budgeted))}</td>
                  <td className="py-2 text-xs text-muted-foreground">{bl.budget_type}</td>
                  <td className="py-2 pl-2">
                    <button
                      type="button"
                      onClick={() => deleteBudgetLine.mutate(bl.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {budgetLines.length === 0 && (
                <tr><td colSpan={5} className="py-3 text-center text-xs text-muted-foreground">No budget lines yet</td></tr>
              )}
            </tbody>
          </table>
          {/* Add budget line */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Select
              value={blForm.category}
              onChange={(v) => setBlForm((f) => ({ ...f, category: v }))}
              className="h-8 text-xs rounded-md border border-input w-36"
              options={BUDGET_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
            <input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={blForm.amount_budgeted}
              onChange={(e) => setBlForm((f) => ({ ...f, amount_budgeted: e.target.value }))}
              className="h-8 w-32 rounded-md border border-input px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={blForm.description}
              onChange={(e) => setBlForm((f) => ({ ...f, description: e.target.value }))}
              className="h-8 min-w-0 flex-1 rounded-md border border-input px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={!blForm.amount_budgeted || createBudgetLine.isPending}
              onClick={() => {
                createBudgetLine.mutate(
                  { category: blForm.category, amount_budgeted: parseFloat(blForm.amount_budgeted), description: blForm.description || undefined },
                  { onSuccess: () => setBlForm({ category: 'material', amount_budgeted: '', description: '' }) },
                )
              }}
            >
              <Plus className="w-3 h-3 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cost lines */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold">Cost lines — Plan vs Actual</h3>
          <p className="text-xs text-muted-foreground">Actual column is derived from posted goods movements and activity confirmations below.</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-left pb-1.5 pr-3">Description</th>
                <th className="text-left pb-1.5 pr-3">Cat.</th>
                <th className="text-right pb-1.5 pr-3">Planned</th>
                <th className="text-right pb-1.5 pr-3">Actual (posted)</th>
                <th className="text-right pb-1.5">Variance</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {costLines.map((cl) => {
                const p = parseFloat(cl.amount_planned)
                const a = parseFloat(cl.amount_actual)
                const varAmt = p - a
                const isEditing = editingLine === cl.id
                return (
                  <tr
                    key={cl.id}
                    className="border-b border-border/40 last:border-0 group hover:bg-muted/30"
                  >
                    <td className="py-2 pr-3">{cl.description || '—'}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground capitalize">{cl.category}</td>
                    <td className="py-2 pr-3 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={lineEdit.amount_planned}
                          onChange={(e) => setLineEdit((l) => ({ ...l, amount_planned: e.target.value }))}
                          className="w-24 rounded border border-input px-1.5 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      ) : (
                        formatCurrency(p)
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right text-emerald-700 font-medium">
                      {formatCurrency(a)}
                    </td>
                    <td className={`py-2 text-right text-xs font-medium ${varAmt >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {varAmt >= 0 ? `+${formatCurrency(varAmt)}` : formatCurrency(varAmt)}
                    </td>
                    <td className="py-2 pl-2">
                      {isEditing ? (
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" className="h-6 px-2 text-xs"
                            onClick={() => {
                              patchCostLine.mutate(
                                { lineId: cl.id, data: { amount_planned: parseFloat(lineEdit.amount_planned) } },
                                { onSuccess: () => setEditingLine(null) },
                              )
                            }}
                          ><Save className="w-3 h-3" /></Button>
                          <Button size="sm" variant="cancel" className="h-6 px-2 text-xs" onClick={() => setEditingLine(null)}><X className="w-3 h-3" /></Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                          onClick={() => { setEditingLine(cl.id); setLineEdit({ amount_planned: cl.amount_planned }) }}
                        ><Pencil className="w-3 h-3" /></button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {costLines.length === 0 && (
                <tr><td colSpan={6} className="py-3 text-center text-xs text-muted-foreground">No plan lines yet. Add one below, or add products/services on the project.</td></tr>
              )}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-2 pt-1">
            <Select
              value={clForm.category}
              onChange={(v) => setClForm((f) => ({ ...f, category: v }))}
              className="h-8 text-xs rounded-md border border-input w-36"
              options={COST_LINE_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
            <input
              type="number"
              step="0.01"
              placeholder="Planned amount"
              value={clForm.amount_planned}
              onChange={(e) => setClForm((f) => ({ ...f, amount_planned: e.target.value }))}
              className="h-8 w-32 rounded-md border border-input px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <input
              type="text"
              placeholder="Description"
              value={clForm.description}
              onChange={(e) => setClForm((f) => ({ ...f, description: e.target.value }))}
              className="h-8 min-w-0 flex-1 rounded-md border border-input px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={!clForm.amount_planned || !clForm.description.trim() || addCostLine.isPending}
              onClick={() => {
                const amount = parseFloat(clForm.amount_planned)
                if (!Number.isFinite(amount) || amount < 0) return
                const maxSeq = costLines.reduce((m, ln) => Math.max(m, ln.sequence ?? 0), 0)
                addCostLine.mutate(
                  {
                    category: clForm.category,
                    description: clForm.description.trim(),
                    amount_planned: amount,
                    qty_planned: 1,
                    rate_planned: amount,
                    uom: 'piece',
                    sequence: maxSeq + 10,
                  },
                  { onSuccess: () => setClForm({ category: 'material', amount_planned: '', description: '' }) },
                )
              }}
            >
              {addCostLine.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Posted Actuals */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Posted Actuals</h3>
            <p className="text-xs text-muted-foreground">Source documents — reversible, auditable</p>
          </div>

          {/* Sub-tab bar */}
          <div className="flex gap-1 border-b border-border">
            {([
              { id: 'material', label: 'Material Issues', icon: PackageCheck },
              { id: 'labor', label: 'Labour / Time', icon: Clock },
              { id: 'audit', label: 'Audit Log', icon: History },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveActualTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                  activeActualTab === id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>

          {/* Material issues */}
          {activeActualTab === 'material' && (
            <div className="space-y-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left pb-1.5 pr-3">Doc No</th>
                    <th className="text-left pb-1.5 pr-3">Date</th>
                    <th className="text-left pb-1.5 pr-3">Material</th>
                    <th className="text-left pb-1.5 pr-3">Type</th>
                    <th className="text-right pb-1.5 pr-3">Qty</th>
                    <th className="text-right pb-1.5 pr-3">Rate</th>
                    <th className="text-right pb-1.5 pr-3">Total</th>
                    <th className="text-left pb-1.5 pr-3">Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {goodsMovements.map((gm) => {
                    const materialLabel =
                      (gm.product_id && materialOptions.find((o) => o.value === gm.product_id)?.label) ||
                      gm.description ||
                      '—'
                    const reversesDoc = (gm.extra?.reverses_document_no as string | undefined) || null
                    const reversedByDoc = (gm.extra?.reversed_by_document_no as string | undefined) || null
                    const isReversalDoc = Boolean(gm.extra?.reverses_id)
                    const canReverse = gm.status !== 'reversed' && !isReversalDoc
                    return (
                    <tr key={gm.id} className={`border-b border-border/30 last:border-0 ${gm.status === 'reversed' ? 'opacity-50 line-through' : ''}`}>
                      <td className="py-1.5 pr-3 font-mono">
                        {gm.document_no || '—'}
                        {reversesDoc && (
                          <div className="text-[10px] text-muted-foreground no-underline font-sans normal-case">rev of {reversesDoc}</div>
                        )}
                        {reversedByDoc && gm.status === 'reversed' && (
                          <div className="text-[10px] text-muted-foreground no-underline font-sans normal-case">→ {reversedByDoc}</div>
                        )}
                      </td>
                      <td className="py-1.5 pr-3">{gm.posting_date}</td>
                      <td className="py-1.5 pr-3 max-w-[10rem] truncate" title={materialLabel}>{materialLabel}</td>
                      <td className="py-1.5 pr-3 capitalize text-muted-foreground">{gm.movement_type.replace(/_/g, ' ')}</td>
                      <td className="py-1.5 pr-3 text-right">{parseFloat(gm.qty).toFixed(2)} {gm.uom}</td>
                      <td className="py-1.5 pr-3 text-right">{formatCurrency(parseFloat(gm.unit_cost))}</td>
                      <td className="py-1.5 pr-3 text-right font-medium">{formatCurrency(parseFloat(gm.total_cost))}</td>
                      <td className="py-1.5 pr-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${gm.status === 'reversed' ? 'bg-red-50 text-red-600' : isReversalDoc ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {isReversalDoc ? 'reversal' : gm.status}
                        </span>
                      </td>
                      <td className="py-1.5">
                        {canReverse && (
                          reversingGmId === gm.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                placeholder="Reversal reason"
                                value={reverseReason}
                                onChange={(e) => setReverseReason(e.target.value)}
                                className="h-6 w-32 rounded border border-input px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                              />
                              <button
                                type="button"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => {
                                  if (!reverseReason.trim()) return
                                  reverseGoodsMovement.mutate(
                                    { gmId: gm.id, reason: reverseReason },
                                    { onSuccess: () => { setReversingGmId(null); setReverseReason('') } },
                                  )
                                }}
                              ><RotateCcw className="w-3 h-3" /></button>
                              <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setReversingGmId(null)}><X className="w-3 h-3" /></button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              title="Reverse"
                              className="text-muted-foreground hover:text-red-600"
                              onClick={() => { setReversingGmId(gm.id); setReverseReason('') }}
                            ><RotateCcw className="w-3 h-3" /></button>
                          )
                        )}
                      </td>
                    </tr>
                    )
                  })}
                  {goodsMovements.length === 0 && (
                    <tr><td colSpan={9} className="py-3 text-center text-muted-foreground">No goods movements posted yet</td></tr>
                  )}
                </tbody>
              </table>

              {/* Post new goods movement form */}
              {coOrderId && companyId && (
                showGmForm ? (
                  <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
                    <p className="text-xs font-medium">Post goods movement</p>
                    {materialOptions.length === 0 && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                        No materials on this project. Add products on the project Overview, then re-enable costing (or add a material cost line).
                      </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Material *</label>
                        <Select
                          value={gmForm.product_id}
                          onChange={selectMaterial}
                          className="h-7 text-xs rounded border border-input w-full mt-0.5"
                          options={[
                            { value: '', label: 'Select material…' },
                            ...materialOptions.map((o) => ({ value: o.value, label: o.label })),
                          ]}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Type</label>
                        <Select
                          value={gmForm.movement_type}
                          onChange={(v) => setGmForm((f) => ({ ...f, movement_type: v }))}
                          className="h-7 text-xs rounded border border-input w-full mt-0.5"
                          options={[
                            { value: 'component_issue', label: 'Issue (material)' },
                            { value: 'component_return', label: 'Return' },
                            { value: 'fg_receipt', label: 'FG receipt' },
                          ]}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Posting date</label>
                        <input type="date" value={gmForm.posting_date}
                          onChange={(e) => setGmForm((f) => ({ ...f, posting_date: e.target.value }))}
                          className="h-7 w-full rounded border border-input px-1.5 text-xs mt-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Qty *</label>
                        <input type="number" step="0.01" placeholder="0.00" value={gmForm.qty}
                          onChange={(e) => setGmForm((f) => ({ ...f, qty: e.target.value }))}
                          className="h-7 w-full rounded border border-input px-1.5 text-xs mt-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Unit cost *</label>
                        <input type="number" step="0.01" placeholder="0.00" value={gmForm.unit_cost}
                          onChange={(e) => setGmForm((f) => ({ ...f, unit_cost: e.target.value }))}
                          className="h-7 w-full rounded border border-input px-1.5 text-xs mt-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">UOM</label>
                        <div
                          className="h-7 w-full rounded border border-input bg-muted/40 px-1.5 text-xs mt-0.5 flex items-center text-muted-foreground"
                          title={gmForm.product_id ? 'From product master' : 'Select a material first'}
                        >
                          {gmForm.uom || (gmForm.product_id ? '—' : 'Select material')}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Batch / Lot</label>
                        <input type="text" placeholder="optional" value={gmForm.batch_no}
                          onChange={(e) => setGmForm((f) => ({ ...f, batch_no: e.target.value }))}
                          className="h-7 w-full rounded border border-input px-1.5 text-xs mt-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Description</label>
                        <input type="text" placeholder="optional" value={gmForm.description}
                          onChange={(e) => setGmForm((f) => ({ ...f, description: e.target.value }))}
                          className="h-7 w-full rounded border border-input px-1.5 text-xs mt-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        disabled={
                          !gmForm.product_id ||
                          !gmForm.uom ||
                          !gmForm.qty ||
                          gmForm.unit_cost === '' ||
                          postGoodsMovement.isPending ||
                          materialOptions.length === 0
                        }
                        onClick={() => {
                          const opt = materialOptions.find((o) => o.value === gmForm.product_id)
                          if (!opt?.uom) return
                          postGoodsMovement.mutate({
                            company_id: companyId,
                            order_id: coOrderId,
                            product_id: gmForm.product_id,
                            movement_type: gmForm.movement_type,
                            posting_date: gmForm.posting_date,
                            qty: parseFloat(gmForm.qty),
                            unit_cost: parseFloat(gmForm.unit_cost),
                            uom: opt.uom,
                            batch_no: gmForm.batch_no || undefined,
                            description: gmForm.description || opt?.label || undefined,
                          }, { onSuccess: () => { setShowGmForm(false); setGmForm(emptyGmForm()) } })
                        }}
                      >
                        {postGoodsMovement.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <PackageCheck className="w-3 h-3 mr-1" />}
                        Post
                      </Button>
                      <Button size="sm" variant="cancel" className="h-7 text-xs" onClick={() => setShowGmForm(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowGmForm(true)}>
                    <Plus className="w-3 h-3 mr-1" /> Post goods movement
                  </Button>
                )
              )}
            </div>
          )}

          {/* Labour / Time confirmations */}
          {activeActualTab === 'labor' && (
            <div className="space-y-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left pb-1.5 pr-3">Date</th>
                    <th className="text-left pb-1.5 pr-3">Type</th>
                    <th className="text-right pb-1.5 pr-3">Hours</th>
                    <th className="text-right pb-1.5 pr-3">Rate/hr</th>
                    <th className="text-right pb-1.5 pr-3">Total</th>
                    <th className="text-left pb-1.5">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {activityConfirmations.map((ac) => (
                    <tr key={ac.id} className="border-b border-border/30 last:border-0">
                      <td className="py-1.5 pr-3">{ac.confirmation_date}</td>
                      <td className="py-1.5 pr-3 capitalize text-muted-foreground">{ac.confirmation_type}</td>
                      <td className="py-1.5 pr-3 text-right">{parseFloat(ac.hours_confirmed).toFixed(2)}</td>
                      <td className="py-1.5 pr-3 text-right">{formatCurrency(parseFloat(ac.rate_per_hour))}</td>
                      <td className="py-1.5 pr-3 text-right font-medium">{formatCurrency(parseFloat(ac.total_cost))}</td>
                      <td className="py-1.5 text-muted-foreground truncate max-w-[10rem]">{ac.narration || '—'}</td>
                    </tr>
                  ))}
                  {activityConfirmations.length === 0 && (
                    <tr><td colSpan={6} className="py-3 text-center text-muted-foreground">No activity confirmations posted yet</td></tr>
                  )}
                </tbody>
              </table>

              {/* Post new activity confirmation form */}
              {coOrderId && companyId && (
                showAcForm ? (
                  <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
                    <p className="text-xs font-medium">Confirm activity (labour / machine time)</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Type</label>
                        <Select
                          value={acForm.confirmation_type}
                          onChange={(v) => setAcForm((f) => ({ ...f, confirmation_type: v }))}
                          className="h-7 text-xs rounded border border-input w-full mt-0.5"
                          options={[
                            { value: 'labor', label: 'Labour' },
                            { value: 'machine', label: 'Machine' },
                            { value: 'setup', label: 'Setup' },
                            { value: 'other', label: 'Other' },
                          ]}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Confirmation date</label>
                        <input type="date" value={acForm.confirmation_date}
                          onChange={(e) => setAcForm((f) => ({ ...f, confirmation_date: e.target.value }))}
                          className="h-7 w-full rounded border border-input px-1.5 text-xs mt-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Hours</label>
                        <input type="number" step="0.25" placeholder="0.00" value={acForm.hours_confirmed}
                          onChange={(e) => setAcForm((f) => ({ ...f, hours_confirmed: e.target.value }))}
                          className="h-7 w-full rounded border border-input px-1.5 text-xs mt-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Rate / hr (₹)</label>
                        <input type="number" step="0.01" placeholder="0.00" value={acForm.rate_per_hour}
                          onChange={(e) => setAcForm((f) => ({ ...f, rate_per_hour: e.target.value }))}
                          className="h-7 w-full rounded border border-input px-1.5 text-xs mt-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Narration / Note</label>
                      <input type="text" placeholder="optional" value={acForm.narration}
                        onChange={(e) => setAcForm((f) => ({ ...f, narration: e.target.value }))}
                        className="h-7 w-full rounded border border-input px-1.5 text-xs mt-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" className="h-7 text-xs" disabled={!acForm.hours_confirmed || !acForm.rate_per_hour || postActivityConfirmation.isPending}
                        onClick={() => {
                          postActivityConfirmation.mutate({
                            company_id: companyId,
                            order_id: coOrderId,
                            confirmation_type: acForm.confirmation_type,
                            confirmation_date: acForm.confirmation_date,
                            hours_confirmed: parseFloat(acForm.hours_confirmed),
                            rate_per_hour: parseFloat(acForm.rate_per_hour),
                            qty_confirmed: 0,
                            narration: acForm.narration || undefined,
                          }, { onSuccess: () => { setShowAcForm(false); setAcForm({ confirmation_type: 'labor', confirmation_date: new Date().toISOString().slice(0, 10), hours_confirmed: '', rate_per_hour: '', narration: '' }) } })
                        }}
                      >
                        {postActivityConfirmation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3 mr-1" />}
                        Confirm
                      </Button>
                      <Button size="sm" variant="cancel" className="h-7 text-xs" onClick={() => setShowAcForm(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAcForm(true)}>
                    <Plus className="w-3 h-3 mr-1" /> Confirm activity
                  </Button>
                )
              )}
            </div>
          )}

          {/* Audit log */}
          {activeActualTab === 'audit' && (
            <div className="space-y-1">
              {auditLog.length === 0 && (
                <p className="py-3 text-center text-xs text-muted-foreground">No audit entries yet</p>
              )}
              {auditLog.map((entry) => {
                const entityLabel = entry.entity_type.replace(/_/g, ' ')
                const diffSummary = entry.diff
                  ? Object.entries(entry.diff)
                      .filter(([k]) => !['project_id', 'before', 'after'].includes(k))
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(', ')
                  : ''
                return (
                  <div key={entry.id} className="flex items-center gap-2 py-1.5 border-b border-border/30 last:border-0 text-xs">
                    <FileText className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium capitalize">{entry.action}</span>
                      <span className="text-muted-foreground"> - </span>
                      <span className="text-muted-foreground">{entry.performed_by_name || '—'}</span>
                      <span className="text-muted-foreground"> - </span>
                      <span className="text-muted-foreground">{entityLabel}</span>
                      {diffSummary && (
                        <span className="text-muted-foreground"> — {diffSummary}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-muted-foreground/70">
                      {entry.created_at ? new Date(entry.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Settlement tab ────────────────────────────────────────────────────────────

function SettlementTab({ projectId }: { projectId: string }) {
  const { data: status, isLoading } = useProjectCostingStatus(projectId)
  const { data: variance } = useProjectVariance(status?.costing_enabled ? projectId : undefined)
  const postCompletion = usePostProjectCompletion(projectId)
  const postSettlement = usePostProjectSettlement(projectId)
  const [entryDate, setEntryDate] = useState('')

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>

  if (!status?.costing_enabled) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-sm">Enable costing on the Planning tab first.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const settlementStatus = status.settlement_status || variance?.settlement_status || 'none'
  const completionPosted = settlementStatus !== 'none'
  const fullySettled = settlementStatus === 'cogs_closed'

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Order no.</p>
              <p className="font-medium text-sm">{status.order_no}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Settlement status</p>
              <Badge variant={fullySettled ? 'success' : completionPosted ? 'secondary' : 'soft'}>
                {settlementStatus === 'none' && 'Not settled'}
                {settlementStatus === 'production_posted' && 'Completion posted'}
                {settlementStatus === 'cogs_partial' && 'Partial settlement'}
                {settlementStatus === 'cogs_closed' && 'Fully settled'}
              </Badge>
            </div>
            {variance && (
              <>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Planned</p>
                  <p className="font-medium text-sm">{formatCurrency(parseFloat(variance.planned_total))}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Actual</p>
                  <p className="font-medium text-sm">{formatCurrency(parseFloat(variance.actual_total))}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Variance</p>
                  <p className={`font-medium text-sm ${parseFloat(variance.total_variance) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(parseFloat(variance.total_variance))}
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* GL mapping warning */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Settlement posts to the general ledger. Ensure{' '}
          <Link to="/controlling" className="underline">WIP, FG, COGS, and variance accounts</Link>{' '}
          are configured in CO GL mapping for this company before posting.
        </span>
      </div>

      {/* Entry date */}
      <div className="flex items-center gap-3">
        <Label className="text-xs shrink-0">Entry date (optional)</Label>
        <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="h-8 text-sm w-44" />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Step 1 — Post production completion (WIP → FG)</p>
          <Button
            size="sm"
            disabled={completionPosted || postCompletion.isPending}
            onClick={() => postCompletion.mutate(entryDate || undefined)}
            className="gap-1.5"
          >
            {postCompletion.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : completionPosted
                ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                : <Zap className="w-3.5 h-3.5" />}
            {completionPosted ? 'Completion posted' : 'Post completion'}
          </Button>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Step 2 — Post settlement (FG → COGS)</p>
          <Button
            size="sm"
            variant="outline"
            disabled={!completionPosted || fullySettled || postSettlement.isPending}
            onClick={() => postSettlement.mutate(entryDate || undefined)}
            className="gap-1.5"
          >
            {postSettlement.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : fullySettled
                ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                : <DollarSign className="w-3.5 h-3.5" />}
            {fullySettled ? 'Settled' : 'Post settlement'}
          </Button>
        </div>
      </div>

      {/* Variance by category */}
      {variance?.by_category && Object.keys(variance.by_category).length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold">Variance by category</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left pb-1.5 pr-3">Category</th>
                  <th className="text-right pb-1.5 pr-3">Planned</th>
                  <th className="text-right pb-1.5 pr-3">Actual</th>
                  <th className="text-right pb-1.5">Variance</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(variance.by_category).map(([cat, vals]) => {
                  const v = parseFloat(vals.planned) - parseFloat(vals.actual)
                  return (
                    <tr key={cat} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-3 capitalize">{cat}</td>
                      <td className="py-2 pr-3 text-right">{formatCurrency(parseFloat(vals.planned))}</td>
                      <td className="py-2 pr-3 text-right">{formatCurrency(parseFloat(vals.actual))}</td>
                      <td className={`py-2 text-right font-medium text-xs ${v >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {v >= 0 ? `+${formatCurrency(v)}` : formatCurrency(v)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
