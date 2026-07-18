import { onModalBackdropClick, cn } from '@/lib/utils'
import { dialogOverlayClass, dialogPanelClass } from '@/lib/modalUi'
import { Button } from '@/components/ui/button'
import { hrInputClass, hrTabActiveClass, hrTabInactiveClass, hrTableHeadClass, hrStatusBadge, hrEmptyStateClass, hrCardClass } from '../hrFormUi'
import { InlineFieldLabel } from '@/components/common/InlineFieldLabel'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { useState } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Link } from 'react-router-dom'
import {
  Plus, Pencil, Trash2, X, GraduationCap, Send, BookOpen,
  Users as UsersIcon, Award, ExternalLink,
} from 'lucide-react'
import {
  useHRPrograms, useCreateHRProgram, useUpdateHRProgram, useDeleteHRProgram,
  useHREnrollments, useEnrollEmployees, useHREmployees,
} from '@/hooks/useVendor'
import type { TrainingProgram, TrainingEnrollment, EmployeeProfile } from '@/types'

import { askConfirm } from '@/components/common/ConfirmProvider'
type Tab = 'programs' | 'enrollments'

const PROG_STATUS: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',     color: hrStatusBadge.draft },
  published: { label: 'Published', color: hrStatusBadge.published },
  archived:  { label: 'Archived',  color: hrStatusBadge.archived },
}

const ENR_STATUS: Record<string, { label: string; color: string }> = {
  enrolled:    { label: 'Enrolled',    color: hrStatusBadge.enrolled },
  in_progress: { label: 'In Progress', color: hrStatusBadge.in_progress },
  completed:   { label: 'Completed',   color: hrStatusBadge.completed },
  failed:      { label: 'Failed',      color: hrStatusBadge.failed },
  overdue:     { label: 'Overdue',     color: hrStatusBadge.overdue },
}

export default function TrainingPage() {
  const [tab, setTab] = useState<Tab>('programs')
  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-foreground">Training Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">Build Programs, Courses, Quizzes And Track Enrollments</p>
      </div>
      <div className="mb-5 flex gap-1 border-b border-border">
        {[
          { k: 'programs',    label: 'Programs',    icon: GraduationCap },
          { k: 'enrollments', label: 'Enrollments', icon: UsersIcon },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as Tab)}
            className={cn(
              '-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors focus:outline-none',
              tab === t.k ? hrTabActiveClass : hrTabInactiveClass,
            )}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>
      {tab === 'programs'    ? <ProgramsTab    /> : null}
      {tab === 'enrollments' ? <EnrollmentsTab /> : null}
    </div>
  )
}

// ─── Programs Tab ─────────────────────────────────────────────────
function ProgramsTab() {
  const { data: programs = [], isLoading } = useHRPrograms()
  const del = useDeleteHRProgram()
  const [editing, setEditing] = useState<TrainingProgram | null>(null)
  const [showNew, setShowNew] = useState(false)

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button type="button" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" /> New Program
        </Button>
      </div>
      {isLoading ? (
        <div className={cn(hrCardClass, 'p-8 text-center text-muted-foreground')} onClick={e => e.stopPropagation()}>Loading…</div>
      ) : (programs as TrainingProgram[]).length === 0 ? (
        <div className={hrEmptyStateClass}>
          <GraduationCap className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-muted-foreground">No programs yet. Create your first training program.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(programs as TrainingProgram[]).map(p => {
            const stat = PROG_STATUS[p.status] ?? PROG_STATUS.draft
            return (
              <div key={p.id} className={cn(hrCardClass, 'max-h-[90vh] overflow-hidden overflow-y-auto transition hover:shadow-md')}>
                {p.cover_image_url ? (
                  <img src={p.cover_image_url} alt={p.name} className="w-full h-32 object-cover" />
                ) : (
                  <div className="w-full h-32 bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center">
                    <BookOpen className="w-10 h-10 text-white opacity-80" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="line-clamp-1 font-semibold text-foreground">{p.name}</h3>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${stat.color}`}>{stat.label}</span>
                  </div>
                  <p className="mb-3 text-xs text-muted-foreground">
                    {p.category ?? 'General'}
                    {p.is_mandatory && <span className="font-medium text-orange-500"> · Mandatory</span>}
                    {p.estimated_hours ? <> · {p.estimated_hours}h</> : null}
                  </p>
                  {p.description && <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>}
                  <div className="flex items-center justify-between">
                    <Link to={`/hr/training/${p.id}`} className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <ExternalLink className="h-3 w-3" /> Manage
                    </Link>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setEditing(p)} className="p-1.5 text-muted-foreground hover:text-primary">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button"
                        onClick={async () => { if (await askConfirm(`Delete program "${p.name}"?`)) del.mutate(p.id) }}
                        className="p-1.5 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {(showNew || editing) && (
        <ProgramModal program={editing} onClose={() => { setShowNew(false); setEditing(null) }} />
      )}
    </div>
  )
}

function ProgramModal({
 program, onClose }: { program: TrainingProgram | null; onClose: () => void }) {
  const create = useCreateHRProgram()
  const update = useUpdateHRProgram()
  const [form, setForm] = useState<{
    name: string; description: string; category: string; cover_image_url: string;
    is_mandatory: boolean; target_audience: string; estimated_hours: string;
    issues_certificate: boolean; status: TrainingProgram['status'];
  }>({
    name:             program?.name ?? '',
    description:      program?.description ?? '',
    category:         program?.category ?? '',
    cover_image_url:  program?.cover_image_url ?? '',
    is_mandatory:     program?.is_mandatory ?? false,
    target_audience:  program?.target_audience ?? 'all',
    estimated_hours:  program?.estimated_hours != null ? String(program.estimated_hours) : '',
    issues_certificate: program?.issues_certificate ?? true,
    status:           program?.status ?? 'draft',
  })

  const submit = () => {
    const payload: Record<string, unknown> = {
      ...form,
      estimated_hours: form.estimated_hours === '' ? null : Number(form.estimated_hours),
    }
    if (program) update.mutate({ id: program.id, data: payload }, { onSuccess: onClose })
    else         create.mutate(payload, { onSuccess: onClose })
  }

  return (
    <div data-kiterp-modal className={dialogOverlayClass} onClick={onModalBackdropClick(onClose)}>
      <div className={cn(dialogPanelClass, 'max-w-lg')}>
        <div className="shrink-0 flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-bold text-foreground">{program ? 'Edit Program' : 'New Program'}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-3 p-4">
          <Field label="Name *">
            <input className={hrInputClass} value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Description">
            <textarea className={cn(hrInputClass, 'min-h-[5rem] resize-y')} rows={3} value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <input className={hrInputClass} value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Compliance" />
            </Field>
            <Field label="Estimated hours">
              <input type="number" step="0.5" className={hrInputClass}
                value={form.estimated_hours} onChange={e => setForm({ ...form, estimated_hours: e.target.value })} />
            </Field>
          </div>
          <Field label="Cover image URL">
            <input className={hrInputClass} value={form.cover_image_url}
              onChange={e => setForm({ ...form, cover_image_url: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Audience">
              <Select
                value={form.target_audience}
                onChange={(v) => setForm({ ...form, target_audience: v })}
                options={[
                  { value: 'all', label: 'All employees' },
                  { value: 'department', label: 'By department' },
                  { value: 'designation', label: 'By designation' },
                  { value: 'store', label: 'By store' },
                ]}
                aria-label="Audience"
                className="w-full"
              />
            </Field>
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(v) => setForm({ ...form, status: v as TrainingProgram['status'] })}
                options={[
                  { value: 'draft', label: 'Draft' },
                  { value: 'published', label: 'Published' },
                  { value: 'archived', label: 'Archived' },
                ]}
                aria-label="Status"
                className="w-full"
              />
            </Field>
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_mandatory}
                onChange={e => setForm({ ...form, is_mandatory: e.target.checked })} />
              Mandatory training
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.issues_certificate}
                onChange={e => setForm({ ...form, issues_certificate: e.target.checked })} />
              Issue certificate on completion
            </label>
          </div>
        </div>
        <div className="shrink-0 flex justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={!form.name.trim() || create.isPending || update.isPending}>
            {program ? 'Save' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Enrollments Tab ──────────────────────────────────────────────
function EnrollmentsTab() {
  const { data: enrollments = [], isLoading } = useHREnrollments()
  const [showEnroll, setShowEnroll] = useState(false)

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button type="button" onClick={() => setShowEnroll(true)}>
          <Send className="h-4 w-4" /> Enroll Employees
        </Button>
      </div>
      <div className="max-h-[90vh] overflow-hidden overflow-y-auto rounded-xl border border-border bg-card text-foreground shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : (enrollments as TrainingEnrollment[]).length === 0 ? (
          <div className={hrEmptyStateClass}>
            <UsersIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">No enrollments yet.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className={hrTableHeadClass}>
              <tr>{['Employee', 'Program', 'Progress', 'Status', 'Due', 'Certificate'].map(h =>
                <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {(enrollments as TrainingEnrollment[]).map(e => {
                const stat = ENR_STATUS[e.status] ?? ENR_STATUS.enrolled
                return (
                  <tr key={e.id} className="border-b border-border hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-sm text-muted-foreground">{e.employee_id.slice(0, 8)}</td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{e.program_id.slice(0, 8)}</td>
                    <td className="w-40 px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded bg-muted">
                          <div className="h-2 rounded bg-primary" style={{ width: `${e.progress_pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{e.progress_pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs ${stat.color}`}>{stat.label}</span>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{e.due_date ?? '—'}</td>
                    <td className="px-4 py-2">
                      {e.certificate_url ? (
                        <a href={e.certificate_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline">
                          <Award className="h-3 w-3" /> View
                        </a>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      {showEnroll && <EnrollModal onClose={() => setShowEnroll(false)} />}
    </div>
  )
}

function EnrollModal({
 onClose }: { onClose: () => void }) {
  const { data: programs = [] } = useHRPrograms('published')
  const { data: empData } = useHREmployees({ size: 200 })
  const enroll = useEnrollEmployees()
  const [programId, setProgramId] = useState('')
  const [employeeIds, setEmployeeIds] = useState<string[]>([])
  const [dueDate, setDueDate] = useState('')

  const employees = ((empData as { items?: EmployeeProfile[] } | undefined)?.items) ?? []

  const submit = () => {
    if (!programId || employeeIds.length === 0) return
    enroll.mutate(
      { program_id: programId, employee_ids: employeeIds, due_date: dueDate || undefined },
      { onSuccess: onClose },
    )
  }

  return (
    <div data-kiterp-modal className={dialogOverlayClass} onClick={onModalBackdropClick(onClose)}>
      <div className={cn(dialogPanelClass, 'max-w-lg')}>
        <div className="shrink-0 flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-bold text-foreground">Enroll Employees</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-3 p-4">
          <Field label="Program *">
            <Select
              value={programId}
              onChange={setProgramId}
              options={selectOptionsWithBlank('— Select published program —', (programs as TrainingProgram[]).map(p => ({
                value: p.id,
                label: p.name,
              })))}
              placeholder="— Select published program —"
              aria-label="Training program"
              className="w-full"
            />
          </Field>
          <Field label="Due date">
            <input type="date" className={hrInputClass}
              value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </Field>
          <Field label={`Employees * (${employeeIds.length} selected)`}>
            <div className="max-h-64 overflow-auto rounded-lg border border-border">
              {employees.map(emp => (
                <label key={emp.id} className="flex cursor-pointer items-center gap-2 border-b border-border p-2 text-sm last:border-b-0 hover:bg-muted/30">
                  <input type="checkbox" checked={employeeIds.includes(emp.id)}
                    onChange={e => {
                      if (e.target.checked) setEmployeeIds([...employeeIds, emp.id])
                      else setEmployeeIds(employeeIds.filter(x => x !== emp.id))
                    }} />
                  <span>{emp.vendor_user?.user?.full_name ?? emp.employee_code ?? emp.id.slice(0, 8)}</span>
                  {emp.designation && <span className="text-xs text-muted-foreground">— {emp.designation.name}</span>}
                </label>
              ))}
            </div>
          </Field>
        </div>
        <div className="shrink-0 flex justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={!programId || employeeIds.length === 0 || enroll.isPending}>
            Enroll {employeeIds.length} {employeeIds.length === 1 ? 'employee' : 'employees'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <InlineFieldLabel label={label} className="mb-1 block text-xs font-medium text-muted-foreground" />
      {children}
    </div>
  )
}
