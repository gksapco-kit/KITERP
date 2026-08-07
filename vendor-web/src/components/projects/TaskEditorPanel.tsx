import { useEffect, useMemo, useRef, useState } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StaffPicker, type StaffPickerValue } from '@/components/commission/StaffPicker'
import { Loader2, X, Link2, GitBranch, Plus, CheckSquare, Tag } from 'lucide-react'
import type { ProjectChecklistItem, ProjectTask, ProjectTaskUpdateInput, TaskPriority, TaskStatus } from '@/types/project'
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/types/project'
import { Select } from '@/components/ui/select'

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
  const [labels, setLabels] = useState<string[]>(task.labels ?? [])
  const [labelInput, setLabelInput] = useState('')
  const [checklist, setChecklist] = useState<ProjectChecklistItem[]>(task.checklist ?? [])
  const [checklistInput, setChecklistInput] = useState('')
  const labelInputRef = useRef<HTMLInputElement>(null)
  const checklistInputRef = useRef<HTMLInputElement>(null)

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
    setLabels(task.labels ?? [])
    setChecklist(task.checklist ?? [])
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
      labels,
      checklist,
    })
  }

  const toggleLink = (id: string) => {
    setLinkedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const addLabel = () => {
    const val = labelInput.trim()
    if (!val || labels.includes(val)) { setLabelInput(''); return }
    setLabels((l) => [...l, val])
    setLabelInput('')
  }

  const addChecklistItem = () => {
    const text = checklistInput.trim()
    if (!text) return
    setChecklist((c) => [...c, { id: crypto.randomUUID(), text, done: false }])
    setChecklistInput('')
  }

  const toggleChecklistItem = (idx: number) => {
    setChecklist((c) => c.map((item, i) => i === idx ? { ...item, done: !item.done } : item))
  }

  const removeChecklistItem = (idx: number) => {
    setChecklist((c) => c.filter((_, i) => i !== idx))
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
              <Select
                value={status}
                onChange={(v) => setStatus(v as TaskStatus)}
                className="h-10 rounded-md border border-input bg-background text-sm"
                options={Object.entries(TASK_STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={priority}
                onChange={(v) => setPriority(v as TaskPriority)}
                className="h-10 rounded-md border border-input bg-background text-sm"
                options={Object.entries(TASK_PRIORITY_LABELS).map(([k, v]) => ({ value: k, label: v }))}
              />
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
            <Select
              value={parentTaskId}
              onChange={setParentTaskId}
              className="h-10 rounded-md border border-input bg-background text-sm"
              placeholder="None — top-level task"
              options={[
                { value: '', label: 'None — top-level task' },
                ...parentOptions.map((t) => ({ value: t.id, label: t.title })),
              ]}
            />
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
              <Select
                value=""
                onChange={(v) => { if (v) toggleLink(v) }}
                className="h-10 rounded-md border border-input bg-background text-sm"
                placeholder="Add connected task…"
                options={[
                  { value: '', label: 'Add connected task…' },
                  ...linkOptions.map((t) => ({ value: t.id, label: t.title })),
                ]}
              />
            )}
          </div>

          {/* Labels */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" /> Labels
            </Label>
            <div className="flex flex-wrap gap-1">
              {labels.map((lbl) => (
                <span key={lbl} className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {lbl}
                  <button
                    type="button"
                    onClick={() => setLabels((l) => l.filter((x) => x !== lbl))}
                    className="hover:text-destructive"
                    aria-label={`Remove label ${lbl}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Input
                ref={labelInputRef}
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                placeholder="Add label…"
                className="h-8 flex-1 text-sm"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLabel() } }}
              />
              <Button size="sm" type="button" variant="outline" className="h-8 px-2" onClick={addLabel}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Checklist */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5" /> Checklist
              {checklist.length > 0 && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {checklist.filter((i) => i.done).length}/{checklist.length}
                </span>
              )}
            </Label>
            {checklist.length > 0 && (
              <ul className="space-y-1">
                {checklist.map((item, idx) => (
                  <li key={item.id ?? idx} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleChecklistItem(idx)}
                      className={`h-4 w-4 shrink-0 rounded border ${item.done ? 'bg-primary border-primary' : 'border-input'}`}
                      aria-label={item.done ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {item.done && <span className="block h-full w-full text-white text-[9px] leading-none flex items-center justify-center">✓</span>}
                    </button>
                    <span className={`flex-1 text-sm ${item.done ? 'line-through text-muted-foreground' : ''}`}>{item.text}</span>
                    <button type="button" onClick={() => removeChecklistItem(idx)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {checklist.length > 0 && (
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${checklist.length ? Math.round(checklist.filter(i => i.done).length / checklist.length * 100) : 0}%` }}
                />
              </div>
            )}
            <div className="flex gap-1.5">
              <Input
                ref={checklistInputRef}
                value={checklistInput}
                onChange={(e) => setChecklistInput(e.target.value)}
                placeholder="Add checklist item…"
                className="h-8 flex-1 text-sm"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem() } }}
              />
              <Button size="sm" type="button" variant="outline" className="h-8 px-2" onClick={addChecklistItem}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
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
