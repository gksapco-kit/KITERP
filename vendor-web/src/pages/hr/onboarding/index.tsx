import { onModalBackdropClick } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { useState } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Plus, Trash2, X, Layers, ListChecks, Pencil, CheckCircle2, Circle, Clock as ClockIcon } from 'lucide-react'
import {
  useHROnbTemplates, useCreateHROnbTemplate, useUpdateHROnbTemplate, useDeleteHROnbTemplate,
  useHRChecklists, useCreateHRChecklist, useUpdateOnbTask,
  useHREmployees, useHRDepartments, useHRDesignations,
} from '@/hooks/useVendor'
import type {
  OnboardingTemplate, OnboardingTemplateItem, OnboardingChecklist, OnboardingTask,
  HRDepartment, HRDesignation, EmployeeProfile,
} from '@/types'

type Tab = 'active' | 'templates'

export default function OnboardingPage() {
  const [tab, setTab] = useState<Tab>('active')
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Onboarding</h1>
          <p className="text-sm text-gray-500 mt-1">Onboard New Hires With Structured Checklists</p>
        </div>
      </div>
      <div className="flex border-b mb-5 gap-1">
        {[
          { k: 'active', label: 'Active Onboarding', icon: ListChecks },
          { k: 'templates', label: 'Templates', icon: Layers },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as Tab)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.k ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>
      {tab === 'active' && <ActiveTab />}
      {tab === 'templates' && <TemplatesTab />}
    </div>
  )
}

const TASK_STATUS = {
  pending: { color: 'text-gray-500', icon: Circle, label: 'Pending' },
  in_progress: { color: 'text-blue-500', icon: ClockIcon, label: 'In progress' },
  done: { color: 'text-green-600', icon: CheckCircle2, label: 'Done' },
  skipped: { color: 'text-gray-400', icon: Circle, label: 'Skipped' },
} as const

function ActiveTab() {
  const [statusFilter, setStatusFilter] = useState('')
  const { data: lists = [], isLoading } = useHRChecklists(statusFilter || undefined)
  const [showNew, setShowNew] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">All statuses</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="overdue">Overdue</option>
        </select>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium">
          <Plus className="w-4 h-4" /> Start Onboarding
        </button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-white border rounded-xl p-8 text-center text-gray-400" onClick={e => e.stopPropagation()}>Loading…</div>
        ) : (lists as OnboardingChecklist[]).length === 0 ? (
          <div className="bg-white border rounded-xl p-12 text-center">
            <ListChecks className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No active onboarding checklists.</p>
          </div>
        ) : (
          (lists as OnboardingChecklist[]).map(cl => (
            <ChecklistCard key={cl.id} checklist={cl}
              expanded={expandedId === cl.id} onToggle={() => setExpandedId(expandedId === cl.id ? null : cl.id)} />
          ))
        )}
      </div>

      {showNew && <StartChecklistModal onClose={() => setShowNew(false)} />}
    </div>
  )
}

function ChecklistCard({ checklist, expanded, onToggle }: { checklist: OnboardingChecklist; expanded: boolean; onToggle: () => void }) {
  const update = useUpdateOnbTask()
  const tasks = (checklist.tasks ?? []) as OnboardingTask[]
  const done = tasks.filter(t => t.status === 'done').length
  const total = tasks.length
  const pct = total ? Math.round((done / total) * 100) : 0
  const statusColor = checklist.status === 'completed' ? 'bg-green-100 text-green-700'
    : checklist.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'

  return (
    <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
      <div onClick={onToggle} className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50">
        <div>
          <p className="text-sm font-semibold text-gray-900">Employee #{checklist.employee_id.slice(0, 8)}</p>
          <p className="text-xs text-gray-500">Started {new Date(checklist.started_at).toLocaleDateString()}
            {checklist.target_completion_date && ` · Target ${checklist.target_completion_date}`}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-32">
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span className="text-gray-500">{done}/{total} tasks</span>
              <span className="font-semibold text-gray-700">{pct}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>{checklist.status.replace('_', ' ')}</span>
        </div>
      </div>
      {expanded && (
        <div className="border-t px-4 py-3 space-y-1.5">
          {tasks.length === 0 ? (
            <p className="text-sm text-gray-400 py-3 text-center">No tasks in this checklist.</p>
          ) : tasks.map(t => {
            const cfg = TASK_STATUS[t.status] ?? TASK_STATUS.pending
            const Icon = cfg.icon
            return (
              <div key={t.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">
                <Icon className={`w-4 h-4 ${cfg.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{t.title}</p>
                  {t.description && <p className="text-xs text-gray-500">{t.description}</p>}
                  <p className="text-xs text-gray-400">
                    {t.category && `${t.category} · `}{t.due_date && `Due ${t.due_date}`}
                  </p>
                </div>
                <select value={t.status} onChange={e => update.mutate({ id: t.id, data: { status: e.target.value } })}
                  className="text-xs border rounded px-2 py-1">
                  {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StartChecklistModal({
 onClose }: { onClose: () => void }) {
  const create = useCreateHRChecklist()
  const { data: employeesData } = useHREmployees({ size: 200 })
  const employees: EmployeeProfile[] = Array.isArray(employeesData)
    ? employeesData
    : (employeesData as { items?: EmployeeProfile[] })?.items ?? []
  const { data: templates = [] } = useHROnbTemplates()
  const [form, setForm] = useState({
    employee_id: '', template_id: '', target_completion_date: '',
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.employee_id) return
    await create.mutateAsync({
      employee_id: form.employee_id,
      template_id: form.template_id || null,
      target_completion_date: form.target_completion_date || null,
    })
    onClose()
  }
  return (
    <div data-kiterp-modal className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={onModalBackdropClick(onClose)}>
      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-lg font-semibold">Start Onboarding</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <Label className="text-xs font-medium text-gray-600 uppercase" required>Employee</Label>
            <select required value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
              <option value="">— Select —</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>
                  {e.vendor_user?.user?.full_name ?? `Employee ${e.id.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600 uppercase">Template (optional)</Label>
            <select value={form.template_id} onChange={e => setForm({ ...form, template_id: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
              <option value="">— Auto-pick by designation —</option>
              {(templates as OnboardingTemplate[]).map(t => (
                <option key={t.id} value={t.id}>{t.name}{t.is_default ? ' (default)' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600 uppercase">Target Completion Date</Label>
            <input type="date" value={form.target_completion_date}
              onChange={e => setForm({ ...form, target_completion_date: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <button type="button" onClick={onClose} className="btn-cancel px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button type="submit" disabled={create.isPending}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
              {create.isPending ? 'Starting…' : 'Start'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Templates Tab ─────────────────────────────────────────────────────
function TemplatesTab() {
  const { data: templates = [], isLoading } = useHROnbTemplates()
  const deleteTpl = useDeleteHROnbTemplate()
  const [editing, setEditing] = useState<OnboardingTemplate | null>(null)
  const [showNew, setShowNew] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-end mb-3">
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium">
          <Plus className="w-4 h-4" /> New Template
        </button>
      </div>
      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (templates as OnboardingTemplate[]).length === 0 ? (
          <div className="p-12 text-center">
            <Layers className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No templates yet.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
              <tr>
                {['Name', 'Scope', 'Items', 'Default', 'Actions'].map(h => <th key={h} className="text-left py-3 px-4 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(templates as OnboardingTemplate[]).map(t => (
                <tr key={t.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <p className="text-sm font-medium">{t.name}</p>
                    {t.description && <p className="text-xs text-gray-500">{t.description}</p>}
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-600">
                    {t.designation_id || t.department_id ? 'Scoped' : 'All employees'}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">{t.items?.length ?? 0}</td>
                  <td className="py-3 px-4">
                    {t.is_default && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Default</span>}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditing(t)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => { if (confirm('Delete this template?')) deleteTpl.mutate(t.id) }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {(showNew || editing) && (
        <TemplateModal existing={editing} onClose={() => { setShowNew(false); setEditing(null) }} />
      )}
    </div>
  )
}

function TemplateModal({
 existing, onClose }: { existing?: OnboardingTemplate | null; onClose: () => void }) {
  const create = useCreateHROnbTemplate()
  const update = useUpdateHROnbTemplate()
  const { data: depts = [] } = useHRDepartments()
  const { data: desigs = [] } = useHRDesignations()
  const [form, setForm] = useState({
    name: existing?.name ?? '',
    description: existing?.description ?? '',
    department_id: existing?.department_id ?? '',
    designation_id: existing?.designation_id ?? '',
    is_default: existing?.is_default ?? false,
  })
  const [items, setItems] = useState<Partial<OnboardingTemplateItem>[]>(
    existing?.items ?? [{ title: '', sequence: 1, default_due_offset_days: 7 }]
  )

  function addItem() {
    setItems([...items, { title: '', sequence: items.length + 1, default_due_offset_days: 7 }])
  }
  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx))
  }
  function updateItem(idx: number, key: string, val: unknown) {
    setItems(items.map((it, i) => i === idx ? { ...it, [key]: val } : it))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      name: form.name,
      description: form.description || null,
      department_id: form.department_id || null,
      designation_id: form.designation_id || null,
      is_default: form.is_default,
      items: items.filter(i => i.title).map((i, idx) => ({
        sequence: idx + 1,
        title: i.title,
        description: i.description ?? null,
        category: i.category ?? null,
        default_due_offset_days: Number(i.default_due_offset_days ?? 7),
        default_assignee_role: i.default_assignee_role ?? null,
      })),
    }
    if (existing) await update.mutateAsync({ id: existing.id, data: payload })
    else await create.mutateAsync(payload)
    onClose()
  }

  return (
    <div data-kiterp-modal className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-lg font-semibold">{existing ? 'Edit Template' : 'New Onboarding Template'}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <Label className="text-xs font-medium text-gray-600 uppercase" required>Template Name</Label>
            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600 uppercase">Description</Label>
            <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-gray-600 uppercase">Department</Label>
              <select value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                <option value="">All</option>
                {(depts as HRDepartment[]).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600 uppercase">Designation</Label>
              <select value={form.designation_id} onChange={e => setForm({ ...form, designation_id: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                <option value="">All</option>
                {(desigs as HRDesignation[]).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_default} onChange={e => setForm({ ...form, is_default: e.target.checked })} />
            Use as default template (auto-applied to new hires)
          </label>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">Tasks ({items.length})</h3>
              <button type="button" onClick={addItem}
                className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded">
                <Plus className="w-3 h-3" /> Add task
              </button>
            </div>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="border rounded-lg p-2 grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-1 text-center text-sm font-medium text-gray-500 pt-2">{idx + 1}</div>
                  <input value={it.title ?? ''} onChange={e => updateItem(idx, 'title', e.target.value)}
                    placeholder="Task title" className="col-span-4 px-2 py-1.5 border rounded text-sm" />
                  <input value={it.category ?? ''} onChange={e => updateItem(idx, 'category', e.target.value)}
                    placeholder="Category" className="col-span-2 px-2 py-1.5 border rounded text-sm" />
                  <input type="number" value={it.default_due_offset_days ?? 7}
                    onChange={e => updateItem(idx, 'default_due_offset_days', e.target.value)}
                    placeholder="Days" className="col-span-2 px-2 py-1.5 border rounded text-sm" />
                  <input value={it.default_assignee_role ?? ''}
                    onChange={e => updateItem(idx, 'default_assignee_role', e.target.value)}
                    placeholder="Assignee role" className="col-span-2 px-2 py-1.5 border rounded text-sm" />
                  <button type="button" onClick={() => removeItem(idx)}
                    className="col-span-1 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button type="button" onClick={onClose} className="btn-cancel px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button type="submit" disabled={create.isPending || update.isPending}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
              {create.isPending || update.isPending ? 'Saving…' : (existing ? 'Save changes' : 'Create template')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
