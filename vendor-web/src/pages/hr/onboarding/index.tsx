import { onModalBackdropClick, cn, formatDate } from '@/lib/utils'
import { dialogOverlayClass, dialogPanelClass } from '@/lib/modalUi'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useMemo, useState } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import {
  Plus, Trash2, X, Layers, ListChecks, Pencil, CheckCircle2, Circle,
  Clock as ClockIcon, Calendar, ChevronDown, UserRound,
} from 'lucide-react'
import { hrSelectClass } from '../hrFormUi'
import {
  useHROnbTemplates, useCreateHROnbTemplate, useUpdateHROnbTemplate, useDeleteHROnbTemplate,
  useHRChecklists, useCreateHRChecklist, useUpdateOnbTask,
  useHREmployees, useHRDepartments, useHRDesignations,
} from '@/hooks/useVendor'
import type {
  OnboardingTemplate, OnboardingTemplateItem, OnboardingChecklist, OnboardingTask,
  HRDepartment, HRDesignation, EmployeeProfile,
} from '@/types'

import { askConfirm } from '@/components/common/ConfirmProvider'
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

function employeeDisplayName(emp?: EmployeeProfile | null, fallbackId?: string) {
  const name = emp?.vendor_user?.user?.full_name
    || emp?.full_name
    || emp?.employee_code_custom
    || emp?.employee_code
  if (name) return name
  return fallbackId ? `Employee #${fallbackId.slice(0, 8)}` : 'Employee'
}

function employeeInitials(name: string) {
  return name
    .replace(/^Employee\s+#?/i, '')
    .split(/[\s#]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

function ActiveTab() {
  const [statusFilter, setStatusFilter] = useState('')
  const { data: lists = [], isLoading } = useHRChecklists(statusFilter || undefined)
  const { data: employeesData } = useHREmployees({ size: 200 })
  const [showNew, setShowNew] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const employeesById = useMemo(() => {
    const employees: EmployeeProfile[] = Array.isArray(employeesData)
      ? employeesData
      : (employeesData as { items?: EmployeeProfile[] })?.items ?? []
    return Object.fromEntries(employees.map(e => [e.id, e])) as Record<string, EmployeeProfile>
  }, [employeesData])

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          className={cn(hrSelectClass, 'w-auto min-w-[12rem] max-w-xs')}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'in_progress', label: 'In progress' },
            { value: 'completed', label: 'Completed' },
            { value: 'overdue', label: 'Overdue' },
          ]}
        />
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Start Onboarding
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
            <ChecklistCard
              key={cl.id}
              checklist={cl}
              employee={employeesById[cl.employee_id]}
              expanded={expandedId === cl.id}
              onToggle={() => setExpandedId(expandedId === cl.id ? null : cl.id)}
            />
          ))
        )}
      </div>

      {showNew && <StartChecklistModal onClose={() => setShowNew(false)} />}
    </div>
  )
}

function ChecklistCard({
  checklist, employee, expanded, onToggle,
}: {
  checklist: OnboardingChecklist
  employee?: EmployeeProfile
  expanded: boolean
  onToggle: () => void
}) {
  const update = useUpdateOnbTask()
  const tasks = (checklist.tasks ?? []) as OnboardingTask[]
  const done = tasks.filter(t => t.status === 'done').length
  const total = tasks.length
  const pct = total ? Math.round((done / total) * 100) : 0
  const name = employeeDisplayName(employee, checklist.employee_id)
  const code = employee?.employee_code_custom || employee?.employee_code
  const isCompleted = checklist.status === 'completed'
  const isOverdue = checklist.status === 'overdue'
  const accent = isCompleted ? 'bg-emerald-500' : isOverdue ? 'bg-rose-500' : 'bg-blue-500'
  const statusColor = isCompleted
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : isOverdue
      ? 'bg-rose-50 text-rose-700 ring-rose-200'
      : 'bg-blue-50 text-blue-700 ring-blue-200'
  const barColor = isCompleted
    ? 'bg-emerald-500'
    : isOverdue
      ? 'bg-rose-500'
      : 'bg-gradient-to-r from-primary to-info'

  return (
    <div className="bg-card border border-border text-foreground rounded-xl shadow-sm overflow-hidden transition-shadow hover:shadow-md">
      <div
        onClick={onToggle}
        className="relative flex flex-wrap items-center justify-between gap-4 p-4 pl-5 cursor-pointer hover:bg-muted/40"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}
      >
        <span className={cn('absolute inset-y-0 left-0 w-1', accent)} aria-hidden />
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
            isCompleted ? 'bg-emerald-50 text-emerald-700' : isOverdue ? 'bg-rose-50 text-rose-700' : 'bg-primary/10 text-primary',
          )}>
            {name.startsWith('Employee #') ? <UserRound className="h-4 w-4" /> : employeeInitials(name)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
              {code && (
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {code}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3 text-gray-400" />
                Started {formatDate(checklist.started_at)}
              </span>
              {checklist.target_completion_date && (
                <span className="inline-flex items-center gap-1">
                  <ClockIcon className="h-3 w-3 text-gray-400" />
                  Target {formatDate(checklist.target_completion_date)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="w-40">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-gray-500">{done}/{total} tasks</span>
              <span className="font-semibold tabular-nums text-gray-700">{pct}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={cn('h-full transition-all duration-300', barColor)} style={{ width: `${pct}%` }} />
            </div>
          </div>
          <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium capitalize ring-1 ring-inset', statusColor)}>
            {checklist.status.replace('_', ' ')}
          </span>
          <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform duration-200', expanded && 'rotate-180')} />
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border bg-muted/20 px-4 py-2">
          {tasks.length === 0 ? (
            <p className="text-sm text-gray-400 py-3 text-center">No tasks in this checklist.</p>
          ) : tasks.map(t => {
            const cfg = TASK_STATUS[t.status] ?? TASK_STATUS.pending
            const Icon = cfg.icon
            return (
              <div key={t.id} className="flex items-start gap-3 py-2.5 px-1 hover:bg-muted/40 rounded-lg">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.color}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 leading-snug">{t.title}</p>
                  {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
                  {(t.category || t.due_date) && (
                    <p className="text-xs text-gray-400 mt-1 whitespace-nowrap">
                      {t.category && `${t.category}`}
                      {t.category && t.due_date && ' · '}
                      {t.due_date && `Due ${formatDate(t.due_date)}`}
                    </p>
                  )}
                </div>
                <Select
                  value={t.status}
                  onChange={v => update.mutate({ id: t.id, data: { status: v } })}
                  className="w-36 shrink-0"
                  aria-label={`Status for ${t.title}`}
                  options={Object.entries(TASK_STATUS).map(([k, v]) => ({ value: k, label: v.label }))}
                />
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
    <div data-kiterp-modal className={dialogOverlayClass} onClick={onModalBackdropClick(onClose)}>
      <div className={cn(dialogPanelClass, 'max-w-md')}>
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-lg font-semibold">Start Onboarding</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-3 p-5">
          <div>
            <Label className="text-xs font-medium text-gray-600 uppercase" required>Employee</Label>
            <Select
              value={form.employee_id}
              onChange={v => setForm({ ...form, employee_id: v })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              options={[
                { value: '', label: '— Select —' },
                ...employees.map(e => ({
                  value: e.id,
                  label: e.vendor_user?.user?.full_name ?? `Employee ${e.id.slice(0, 8)}`,
                })),
              ]}
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600 uppercase">Template (optional)</Label>
            <Select
              value={form.template_id}
              onChange={v => setForm({ ...form, template_id: v })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              options={[
                { value: '', label: '— Auto-pick by designation —' },
                ...(templates as OnboardingTemplate[]).map(t => ({
                  value: t.id,
                  label: `${t.name}${t.is_default ? ' (default)' : ''}`,
                })),
              ]}
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600 uppercase">Target Completion Date</Label>
            <input type="date" value={form.target_completion_date}
              onChange={e => setForm({ ...form, target_completion_date: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          </div>
          <div className="shrink-0 flex justify-end gap-2 border-t px-5 py-3">
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
                        <Pencil className="w-4 h-4 text-green-600" />
                      </button>
                      <button onClick={async () => { if (await askConfirm('Delete this template?')) deleteTpl.mutate(t.id) }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                        <Trash2 className="w-4 h-4 text-red-600" />
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
    <div data-kiterp-modal className={dialogOverlayClass}>
      <div className={cn(dialogPanelClass, 'max-w-3xl')}>
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-lg font-semibold">{existing ? 'Edit Template' : 'New Onboarding Template'}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-4 p-5">
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
              <Select
                value={form.department_id}
                onChange={v => setForm({ ...form, department_id: v })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                options={[
                  { value: '', label: 'All' },
                  ...(depts as HRDepartment[]).map(d => ({ value: d.id, label: d.name })),
                ]}
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600 uppercase">Designation</Label>
              <Select
                value={form.designation_id}
                onChange={v => setForm({ ...form, designation_id: v })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                options={[
                  { value: '', label: 'All' },
                  ...(desigs as HRDesignation[]).map(d => ({ value: d.id, label: d.name })),
                ]}
              />
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
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          </div>
          <div className="shrink-0 flex justify-end gap-2 border-t px-5 py-3">
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
