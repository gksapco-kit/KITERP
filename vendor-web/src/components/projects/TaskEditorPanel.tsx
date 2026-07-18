import { useEffect, useMemo, useState } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StaffPicker, type StaffPickerValue } from '@/components/commission/StaffPicker'
import { Loader2, X, Link2, GitBranch } from 'lucide-react'
import type { ProjectTask, ProjectTaskUpdateInput, TaskPriority, TaskStatus } from '@/types/project'
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/types/project'

type Props = {
  task: ProjectTask
  allTasks: ProjectTask[]
  onClose: () => void
  onSave: (taskId: string, data: ProjectTaskUpdateInput) => void
  saving?: boolean
}

export function TaskEditorPanel({ task, allTasks, onClose, onSave, saving }: Props) {
  useEscapeToClose(onClose)

  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [assignee, setAssignee] = useState<StaffPickerValue | null>(
    task.assignee_id
      ? { id: task.assignee_id, user_id: task.assignee_id, full_name: task.assignee_name || 'Assignee' }
      : null,
  )
  const [parentTaskId, setParentTaskId] = useState(task.parent_task_id ?? '')
  const [linkedIds, setLinkedIds] = useState<string[]>(task.linked_task_ids ?? [])

  useEffect(() => {
    setTitle(task.title)
    setDescription(task.description ?? '')
    setStatus(task.status)
    setPriority(task.priority)
    setDueDate(task.due_date ?? '')
    setAssignee(
      task.assignee_id
        ? { id: task.assignee_id, user_id: task.assignee_id, full_name: task.assignee_name || 'Assignee' }
        : null,
    )
    setParentTaskId(task.parent_task_id ?? '')
    setLinkedIds(task.linked_task_ids ?? [])
  }, [task])

  const parentOptions = useMemo(
    () => allTasks.filter((t) => t.id !== task.id),
    [allTasks, task.id],
  )

  const linkOptions = useMemo(
    () => allTasks.filter((t) => t.id !== task.id && !linkedIds.includes(t.id)),
    [allTasks, task.id, linkedIds],
  )

  const handleSave = () => {
    if (!title.trim()) return
    onSave(task.id, {
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      due_date: dueDate || undefined,
      assignee_id: assignee?.user_id || null,
      assignee_name: assignee?.full_name || null,
      parent_task_id: parentTaskId || null,
      linked_task_ids: linkedIds,
    })
  }

  const toggleLink = (id: string) => {
    setLinkedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <div data-kiterp-modal className="fixed inset-0 z-[100] flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md h-full bg-card border-l border-border shadow-xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-border bg-card">
          <h2 className="text-lg font-semibold text-foreground">Edit task</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-muted text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {Object.entries(TASK_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {Object.entries(TASK_PRIORITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Due date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Responsible (team member)</Label>
            <StaffPicker selected={assignee} onSelect={setAssignee} />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5" />
              Parent task (subtask of)
            </Label>
            <select
              value={parentTaskId}
              onChange={(e) => setParentTaskId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">None — top-level task</option>
              {parentOptions.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5" />
              Connected tasks
            </Label>
            {linkedIds.length > 0 && (
              <ul className="space-y-1">
                {linkedIds.map((id) => {
                  const lt = allTasks.find((t) => t.id === id)
                  return (
                    <li key={id} className="flex items-center justify-between text-sm rounded-md border px-2 py-1.5">
                      <span className="truncate">{lt?.title ?? id}</span>
                      <button
                        type="button"
                        className="text-xs text-red-500 hover:underline shrink-0 ml-2"
                        onClick={() => toggleLink(id)}
                      >
                        Remove
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            {linkOptions.length > 0 && (
              <select
                value=""
                onChange={(e) => { if (e.target.value) toggleLink(e.target.value) }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Add connected task…</option>
                {linkOptions.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={handleSave} disabled={saving || !title.trim()}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save task
            </Button>
            <Button variant="cancel" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
