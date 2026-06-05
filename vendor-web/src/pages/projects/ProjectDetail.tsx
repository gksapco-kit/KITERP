import { useMemo, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
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
} from '@/hooks/useProjects'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { CustomerPicker, type CustomerPickerValue } from '@/components/commission/CustomerPicker'
import { StaffPicker, type StaffPickerValue } from '@/components/commission/StaffPicker'
import { TaskEditorPanel } from '@/components/projects/TaskEditorPanel'
import {
  ArrowLeft, Loader2, ChevronLeft, ChevronRight, Plus, Trash2,
  CheckCircle2, Circle, Flag, GripVertical, Pencil, Save, X,
  User, Link2, GitBranch, ExternalLink,
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
}: {
  task: ProjectTask
  onMove: (taskId: string, status: TaskStatus) => void
  onDelete: (taskId: string) => void
  onDragStart: (taskId: string) => void
  onEdit: (task: ProjectTask) => void
}) {
  const prev = prevStatus(task.status)
  const next = nextStatus(task.status)

  return (
    <div
      draggable
      onDragStart={() => onDragStart(task.id)}
      className="rounded-lg border border-border bg-card p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => onEdit(task)}
            className="text-left w-full text-sm font-medium text-foreground leading-snug hover:text-primary"
          >
            {task.title}
          </button>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {task.assignee_name && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                <User className="w-2.5 h-2.5" />
                {task.assignee_name}
              </span>
            )}
            {task.parent_title && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground" title="Subtask of">
                <GitBranch className="w-2.5 h-2.5" />
                {task.parent_title}
              </span>
            )}
            {(task.linked_tasks?.length ?? 0) > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Link2 className="w-2.5 h-2.5" />
                {task.linked_tasks!.length} linked
              </span>
            )}
            {task.due_date && (
              <span className="text-[10px] text-muted-foreground">Due {formatDate(task.due_date)}</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onDelete(task.id)}
          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0"
          title="Delete task"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border">
        {prev && (
          <button
            type="button"
            onClick={() => onMove(task.id, prev)}
            className="p-1 rounded hover:bg-muted text-muted-foreground"
            title={`Move to ${TASK_STATUS_LABELS[prev]}`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        {next && (
          <button
            type="button"
            onClick={() => onMove(task.id, next)}
            className="p-1 rounded hover:bg-muted text-muted-foreground ml-auto"
            title={`Move to ${TASK_STATUS_LABELS[next]}`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
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
}: {
  status: TaskStatus
  tasks: ProjectTask[]
  onAdd: (status: TaskStatus, title: string) => void
  onMove: (taskId: string, status: TaskStatus) => void
  onDelete: (taskId: string) => void
  onDrop: (status: TaskStatus) => void
  draggingId: string | null
  onDragStart: (taskId: string) => void
  onEditTask: (task: ProjectTask) => void
}) {
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)

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
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => onDrop(status)}
    >
      <div className="px-3 py-2.5 flex items-center justify-between border-b border-border/60">
        <h3 className="text-sm font-semibold text-foreground">{TASK_STATUS_LABELS[status]}</h3>
        <Badge variant="secondary">{tasks.length}</Badge>
      </div>
      <div className="flex-1 p-2 space-y-2 min-h-[200px]">
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            onMove={onMove}
            onDelete={onDelete}
            onDragStart={onDragStart}
            onEdit={onEditTask}
          />
        ))}
        {draggingId && (
          <div className="h-1 rounded bg-primary/30" aria-hidden />
        )}
      </div>
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
    </div>
  )
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: project, isLoading: projectLoading } = useProject(id)
  const { data: tasks = [], isLoading: tasksLoading } = useProjectTasks(id)
  const updateProject = useUpdateProject()
  const createTask = useCreateProjectTask(id!)
  const updateTask = useUpdateProjectTask(id!)
  const deleteTask = useDeleteProjectTask(id!)

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

  const handleDrop = (status: TaskStatus) => {
    if (!draggingId) return
    const task = tasks.find((t) => t.id === draggingId)
    if (!task || task.status === status) {
      setDraggingId(null)
      return
    }
    handleMoveTask(draggingId, status)
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
      { id: crypto.randomUUID(), title: newMilestone.trim(), completed: false },
    ]
    updateProject.mutate(
      { id, data: { milestones: next } },
      { onSuccess: () => { setNewMilestone(''); toast.success('Milestone added') } },
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
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            {editing ? (
              <div className="flex-1 space-y-3 min-w-[280px]">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value as ProjectStatus }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map((s) => (
                        <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Priority</Label>
                    <select
                      value={editForm.priority}
                      onChange={(e) => setEditForm((p) => ({ ...p, priority: e.target.value as ProjectPriority }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {(Object.keys(PROJECT_PRIORITY_LABELS) as ProjectPriority[]).map((p) => (
                        <option key={p} value={p}>{PROJECT_PRIORITY_LABELS[p]}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1.5">
                    <Label>Start</Label>
                    <Input type="date" value={editForm.start_date} onChange={(e) => setEditForm((p) => ({ ...p, start_date: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>End</Label>
                    <Input type="date" value={editForm.end_date} onChange={(e) => setEditForm((p) => ({ ...p, end_date: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Due</Label>
                    <Input type="date" value={editForm.due_date} onChange={(e) => setEditForm((p) => ({ ...p, due_date: e.target.value }))} />
                  </div>
                </div>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Description"
                />
                <div className="space-y-1.5">
                  <Label>Customer</Label>
                  <CustomerPicker selected={customer} onSelect={setCustomer} />
                </div>
                <div className="space-y-1.5">
                  <Label>Project owner</Label>
                  <StaffPicker selected={owner} onSelect={setOwner} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveEdit} disabled={updateProject.isPending}>
                    <Save className="w-4 h-4 mr-1" /> Save
                  </Button>
                  <Button size="sm" variant="cancel" onClick={() => setEditing(false)}>
                    <X className="w-4 h-4 mr-1" /> Cancel
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
              </div>
            )}
            {!editing && (
              <Button variant="outline" size="sm" onClick={startEdit}>
                <Pencil className="w-4 h-4 mr-1" /> Edit
              </Button>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Progress</span>
              <span>{project.progress_percent}% · {project.done_task_count ?? 0}/{project.task_count ?? tasks.length} tasks</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${project.progress_percent}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

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
                onDrop={handleDrop}
                draggingId={draggingId}
                onDragStart={setDraggingId}
                onEditTask={setEditingTask}
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
          <div className="flex gap-2">
            <Input
              value={newMilestone}
              onChange={(e) => setNewMilestone(e.target.value)}
              placeholder="New milestone"
              onKeyDown={(e) => e.key === 'Enter' && addMilestone()}
              className="max-w-sm"
            />
            <Button size="sm" onClick={addMilestone} disabled={!newMilestone.trim() || updateProject.isPending}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
