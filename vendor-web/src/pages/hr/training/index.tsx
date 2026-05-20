import { onModalBackdropClick } from '@/lib/utils'
import { useState } from 'react'
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

type Tab = 'programs' | 'enrollments'

const PROG_STATUS: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',     color: 'bg-gray-100 text-gray-600' },
  published: { label: 'Published', color: 'bg-green-100 text-green-700' },
  archived:  { label: 'Archived',  color: 'bg-gray-200 text-gray-700' },
}

const ENR_STATUS: Record<string, { label: string; color: string }> = {
  enrolled:    { label: 'Enrolled',    color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700' },
  completed:   { label: 'Completed',   color: 'bg-green-100 text-green-700' },
  failed:      { label: 'Failed',      color: 'bg-red-100 text-red-700' },
  overdue:     { label: 'Overdue',     color: 'bg-red-100 text-red-700' },
}

export default function TrainingPage() {
  const [tab, setTab] = useState<Tab>('programs')
  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Training Management</h1>
        <p className="text-sm text-gray-500 mt-1">Build programs, courses, quizzes and track enrollments</p>
      </div>
      <div className="flex border-b mb-5 gap-1">
        {[
          { k: 'programs',    label: 'Programs',    icon: GraduationCap },
          { k: 'enrollments', label: 'Enrollments', icon: UsersIcon },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as Tab)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.k ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon className="w-4 h-4" /> {t.label}
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
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium">
          <Plus className="w-4 h-4" /> New Program
        </button>
      </div>
      {isLoading ? (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-400" onClick={e => e.stopPropagation()}>Loading…</div>
      ) : (programs as TrainingProgram[]).length === 0 ? (
        <div className="bg-white border rounded-xl p-12 text-center">
          <GraduationCap className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No programs yet. Create your first training program.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(programs as TrainingProgram[]).map(p => {
            const stat = PROG_STATUS[p.status] ?? PROG_STATUS.draft
            return (
              <div key={p.id} className="bg-white border rounded-xl shadow-sm overflow-hidden hover:shadow-md transition">
                {p.cover_image_url ? (
                  <img src={p.cover_image_url} alt={p.name} className="w-full h-32 object-cover" />
                ) : (
                  <div className="w-full h-32 bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center">
                    <BookOpen className="w-10 h-10 text-white opacity-80" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900 line-clamp-1">{p.name}</h3>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${stat.color} shrink-0`}>{stat.label}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    {p.category ?? 'General'}
                    {p.is_mandatory && <span className="text-orange-600 font-medium"> · Mandatory</span>}
                    {p.estimated_hours ? <> · {p.estimated_hours}h</> : null}
                  </p>
                  {p.description && <p className="text-xs text-gray-600 line-clamp-2 mb-3">{p.description}</p>}
                  <div className="flex items-center justify-between">
                    <Link to={`/hr/training/${p.id}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Manage
                    </Link>
                    <div className="flex gap-1">
                      <button onClick={() => setEditing(p)} className="p-1.5 text-gray-400 hover:text-blue-600">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { if (confirm(`Delete program "${p.name}"?`)) del.mutate(p.id) }}
                        className="p-1.5 text-gray-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
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

function ProgramModal({ program, onClose }: { program: TrainingProgram | null; onClose: () => void }) {
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onModalBackdropClick(onClose)}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">{program ? 'Edit Program' : 'New Program'}</h2>
          <button type="button" aria-label="Close" onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-4 space-y-3">
          <Field label="Name *">
            <input className="w-full border rounded px-3 py-2 text-sm" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Description">
            <textarea className="w-full border rounded px-3 py-2 text-sm" rows={3} value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <input className="w-full border rounded px-3 py-2 text-sm" value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Compliance" />
            </Field>
            <Field label="Estimated hours">
              <input type="number" step="0.5" className="w-full border rounded px-3 py-2 text-sm"
                value={form.estimated_hours} onChange={e => setForm({ ...form, estimated_hours: e.target.value })} />
            </Field>
          </div>
          <Field label="Cover image URL">
            <input className="w-full border rounded px-3 py-2 text-sm" value={form.cover_image_url}
              onChange={e => setForm({ ...form, cover_image_url: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Audience">
              <select className="w-full border rounded px-3 py-2 text-sm" value={form.target_audience}
                onChange={e => setForm({ ...form, target_audience: e.target.value })}>
                <option value="all">All employees</option>
                <option value="department">By department</option>
                <option value="designation">By designation</option>
                <option value="store">By store</option>
              </select>
            </Field>
            <Field label="Status">
              <select className="w-full border rounded px-3 py-2 text-sm" value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value as TrainingProgram['status'] })}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
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
        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
          <button onClick={onClose} className="btn-cancel px-4 py-2 text-sm border rounded-lg text-gray-700">Cancel</button>
          <button onClick={submit} disabled={!form.name.trim() || create.isPending || update.isPending}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
            {program ? 'Save' : 'Create'}
          </button>
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
        <button onClick={() => setShowEnroll(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium">
          <Send className="w-4 h-4" /> Enroll Employees
        </button>
      </div>
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (enrollments as TrainingEnrollment[]).length === 0 ? (
          <div className="p-12 text-center">
            <UsersIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No enrollments yet.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
              <tr>{['Employee', 'Program', 'Progress', 'Status', 'Due', 'Certificate'].map(h =>
                <th key={h} className="text-left py-2 px-4 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {(enrollments as TrainingEnrollment[]).map(e => {
                const stat = ENR_STATUS[e.status] ?? ENR_STATUS.enrolled
                return (
                  <tr key={e.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4 text-sm font-mono text-gray-500">{e.employee_id.slice(0, 8)}</td>
                    <td className="py-2 px-4 text-xs font-mono text-gray-500">{e.program_id.slice(0, 8)}</td>
                    <td className="py-2 px-4 w-40">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 bg-gray-200 rounded">
                          <div className="h-2 bg-blue-500 rounded" style={{ width: `${e.progress_pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-600">{e.progress_pct}%</span>
                      </div>
                    </td>
                    <td className="py-2 px-4">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${stat.color}`}>{stat.label}</span>
                    </td>
                    <td className="py-2 px-4 text-xs text-gray-500">{e.due_date ?? '—'}</td>
                    <td className="py-2 px-4">
                      {e.certificate_url ? (
                        <a href={e.certificate_url} target="_blank" rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-xs flex items-center gap-1">
                          <Award className="w-3 h-3" /> View
                        </a>
                      ) : <span className="text-xs text-gray-400">—</span>}
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

function EnrollModal({ onClose }: { onClose: () => void }) {
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">Enroll Employees</h2>
          <button type="button" aria-label="Close" onClick={onClose}>
                <X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-4 space-y-3">
          <Field label="Program *">
            <select className="w-full border rounded px-3 py-2 text-sm" value={programId}
              onChange={e => setProgramId(e.target.value)}>
              <option value="">— Select published program —</option>
              {(programs as TrainingProgram[]).map(p =>
                <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Due date">
            <input type="date" className="w-full border rounded px-3 py-2 text-sm"
              value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </Field>
          <Field label={`Employees * (${employeeIds.length} selected)`}>
            <div className="border rounded max-h-64 overflow-auto">
              {employees.map(emp => (
                <label key={emp.id} className="flex items-center gap-2 p-2 text-sm border-b last:border-b-0 hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={employeeIds.includes(emp.id)}
                    onChange={e => {
                      if (e.target.checked) setEmployeeIds([...employeeIds, emp.id])
                      else setEmployeeIds(employeeIds.filter(x => x !== emp.id))
                    }} />
                  <span>{emp.vendor_user?.user?.full_name ?? emp.employee_code ?? emp.id.slice(0, 8)}</span>
                  {emp.designation && <span className="text-xs text-gray-500">— {emp.designation.name}</span>}
                </label>
              ))}
            </div>
          </Field>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
          <button onClick={onClose} className="btn-cancel px-4 py-2 text-sm border rounded-lg text-gray-700">Cancel</button>
          <button onClick={submit} disabled={!programId || employeeIds.length === 0 || enroll.isPending}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
            Enroll {employeeIds.length} {employeeIds.length === 1 ? 'employee' : 'employees'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-700 mb-1">{label}</span>
      {children}
    </label>
  )
}
