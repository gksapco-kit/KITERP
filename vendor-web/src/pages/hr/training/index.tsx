import { onModalBackdropClick, cn } from '@/lib/utils'
import { dialogOverlayClass, dialogPanelClass } from '@/lib/modalUi'
import { Button } from '@/components/ui/button'
import { hrInputClass, hrSelectClass, hrTabActiveClass, hrTabInactiveClass, hrTableHeadClass, hrStatusBadge, hrEmptyStateClass, hrCardClass } from '../hrFormUi'
import { InlineFieldLabel } from '@/components/common/InlineFieldLabel'
import { ImageSourcePicker } from '@/components/common/ImageSourcePicker'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { useState } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Link } from 'react-router-dom'
import {
  Plus, Pencil, Trash2, X, GraduationCap, Send, BookOpen,
  Users as UsersIcon, Award, ExternalLink, Search, Loader2,
} from 'lucide-react'
import {
  useHRPrograms, useCreateHRProgram, useUpdateHRProgram, useDeleteHRProgram,
  useHREnrollments, useEnrollEmployees, useHREmployees,
} from '@/hooks/useVendor'
import { vendorApi } from '@/api/vendor'
import type { TrainingProgram, TrainingEnrollment, EmployeeProfile } from '@/types'
import { programCardImage } from '@/lib/trainingVideo'
import { toast } from 'sonner'

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
    <div className="w-full min-w-0 p-4 sm:p-6">
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
              <div key={p.id} className={cn(hrCardClass, 'transition hover:shadow-md')}>
                {(() => {
                  const thumb = programCardImage(p)
                  return thumb ? (
                  <img src={thumb} alt={p.name} className="w-full h-32 object-cover" />
                  ) : (
                  <div className="w-full h-32 bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center">
                    <BookOpen className="w-10 h-10 text-white opacity-80" />
                  </div>
                  )
                })()}
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
                        <Pencil className="h-4 w-4 text-green-600" />
                      </button>
                      <button type="button"
                        onClick={async () => { if (await askConfirm(`Delete program "${p.name}"?`)) del.mutate(p.id) }}
                        className="p-1.5 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4 text-red-600" />
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

const MEDIA_URL_MAX = 500

function sanitizeStoredMediaUrl(value?: string | null): string {
  const s = (value ?? '').trim()
  if (!s || /^data:/i.test(s) || s.length > MEDIA_URL_MAX) return ''
  return s
}

function normalizeProgramMediaUrl(value: string, label: string): string | null {
  const s = value.trim()
  if (!s) return null
  if (/^data:/i.test(s)) {
    throw new Error(`${label}: inline/base64 images are not supported. Upload a file instead.`)
  }
  if (s.length > MEDIA_URL_MAX) {
    throw new Error(`${label}: URL is too long (max ${MEDIA_URL_MAX} characters).`)
  }
  return s
}

function ProgramModal({
 program, onClose }: { program: TrainingProgram | null; onClose: () => void }) {
  const create = useCreateHRProgram()
  const update = useUpdateHRProgram()
  const [coverUploading, setCoverUploading] = useState(false)
  const [form, setForm] = useState<{
    name: string; description: string; category: string; cover_image_url: string;
    video_url: string;
    is_mandatory: boolean; target_audience: string; estimated_hours: string;
    issues_certificate: boolean; status: TrainingProgram['status'];
  }>({
    name:             program?.name ?? '',
    description:      program?.description ?? '',
    category:         program?.category ?? '',
    cover_image_url:  sanitizeStoredMediaUrl(program?.cover_image_url),
    video_url:        sanitizeStoredMediaUrl(program?.video_url),
    is_mandatory:     program?.is_mandatory ?? false,
    target_audience:  program?.target_audience ?? 'all',
    estimated_hours:  program?.estimated_hours != null ? String(program.estimated_hours) : '',
    issues_certificate: program?.issues_certificate ?? true,
    status:           program?.status ?? 'draft',
  })

  const uploadCoverFile = async (file: File) => {
    setCoverUploading(true)
    try {
      const { url } = await vendorApi.uploadGalleryImage(file)
      if (!url) throw new Error('Upload returned no URL')
      setForm(f => ({ ...f, cover_image_url: url }))
      toast.success('Cover image uploaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not upload cover image')
    } finally {
      setCoverUploading(false)
    }
  }

  const submit = () => {
    try {
      const cover_image_url = normalizeProgramMediaUrl(form.cover_image_url, 'Cover image')
      const video_url = normalizeProgramMediaUrl(form.video_url, 'Video link')
      const payload: Record<string, unknown> = {
        ...form,
        cover_image_url,
        video_url,
        estimated_hours: form.estimated_hours === '' ? null : Number(form.estimated_hours),
      }
      if (program) update.mutate({ id: program.id, data: payload }, { onSuccess: onClose })
      else         create.mutate(payload, { onSuccess: onClose })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid media URL')
    }
  }

  const denseInput = cn(hrInputClass, 'h-8 px-2.5 py-1.5')
  const denseSelect = cn(hrSelectClass, 'h-8 py-1 text-sm')

  return (
    <div data-kiterp-modal className={dialogOverlayClass} onClick={onModalBackdropClick(onClose)}>
      <div className={cn(dialogPanelClass, 'max-w-md max-h-none')}>
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
          <h2 className="text-base font-semibold text-foreground">{program ? 'Edit Program' : 'New Program'}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2 px-4 py-3">
          <Field label="Name *" compact>
            <input className={denseInput} value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Description" compact>
            <textarea
              className={cn(denseInput, 'min-h-0 resize-none')}
              rows={2}
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Category" compact>
              <input className={denseInput} value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Compliance" />
            </Field>
            <Field label="Estimated hours" compact>
              <input type="number" step="0.5" className={denseInput}
                value={form.estimated_hours} onChange={e => setForm({ ...form, estimated_hours: e.target.value })} />
            </Field>
          </div>
          <Field label="Cover image" compact>
            <div className="space-y-1.5">
              <ImageSourcePicker
                title="Cover image"
                accept="image/jpeg,image/png,image/webp,image/gif"
                uploading={coverUploading}
                onFile={uploadCoverFile}
                onUrl={async (url) => {
                  const next = sanitizeStoredMediaUrl(url)
                  if (next && /^https?:\/\//i.test(next)) {
                    setForm(f => ({ ...f, cover_image_url: next }))
                    return
                  }
                  throw new Error('Could not use that image. Pick a device or gallery file to upload.')
                }}
                buttonLabel="Upload / choose image"
                buttonClassName="h-8 w-full text-sm"
              />
              {form.cover_image_url ? (
                <div className="relative">
                  <img
                    src={form.cover_image_url}
                    alt="Cover preview"
                    className="h-16 w-full rounded-md border border-border object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                  />
                  <button
                    type="button"
                    className="absolute right-1.5 top-1.5 rounded bg-background/90 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-destructive"
                    onClick={() => setForm(f => ({ ...f, cover_image_url: '' }))}
                  >
                    Remove
                  </button>
                </div>
              ) : null}
            </div>
          </Field>
          <Field label="Video link" compact>
            <input className={denseInput} value={form.video_url}
              onChange={e => setForm({ ...form, video_url: e.target.value })}
              placeholder="https://… or YouTube / Vimeo URL" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Audience" compact>
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
                className={denseSelect}
              />
            </Field>
            <Field label="Status" compact>
              <Select
                value={form.status}
                onChange={(v) => setForm({ ...form, status: v as TrainingProgram['status'] })}
                options={[
                  { value: 'draft', label: 'Draft' },
                  { value: 'published', label: 'Published' },
                  { value: 'archived', label: 'Archived' },
                ]}
                aria-label="Status"
                className={denseSelect}
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-foreground">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" className="h-3.5 w-3.5 rounded" checked={form.is_mandatory}
                onChange={e => setForm({ ...form, is_mandatory: e.target.checked })} />
              Mandatory training
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" className="h-3.5 w-3.5 rounded" checked={form.issues_certificate}
                onChange={e => setForm({ ...form, issues_certificate: e.target.checked })} />
              Issue certificate on completion
            </label>
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-2.5">
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={onClose}>Cancel</Button>
          <Button type="button" size="sm" className="h-8" onClick={submit} disabled={!form.name.trim() || create.isPending || update.isPending}>
            {program ? 'Save' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function employeeDisplayName(emp?: EmployeeProfile | null) {
  if (!emp) return null
  return emp.vendor_user?.user?.full_name ?? emp.full_name ?? emp.employee_code ?? null
}

function formatDueDate(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// ─── Enrollments Tab ──────────────────────────────────────────────
function EnrollmentsTab() {
  const { data: enrollments = [], isLoading } = useHREnrollments()
  const { data: programs = [] } = useHRPrograms()
  // API caps limit at 200 — higher values 422 and leave the map empty (falls back to UUID stubs).
  const { data: empData } = useHREmployees({ limit: 200 })
  const [showEnroll, setShowEnroll] = useState(false)
  const [search, setSearch] = useState('')

  const employees = Array.isArray(empData)
    ? (empData as EmployeeProfile[])
    : ((empData as { items?: EmployeeProfile[] } | undefined)?.items ?? [])
  const employeeById = new Map(employees.map(emp => [emp.id, emp]))
  const programById = new Map((programs as TrainingProgram[]).map(p => [p.id, p]))

  const rows = (enrollments as TrainingEnrollment[]).map(e => {
    const emp = employeeById.get(e.employee_id)
    const program = programById.get(e.program_id)
    const employeeName = employeeDisplayName(emp) ?? `Employee ${e.employee_id.slice(0, 8)}`
    const programName = program?.name ?? `Program ${e.program_id.slice(0, 8)}`
    return { enrollment: e, emp, program, employeeName, programName }
  })

  const normalizedSearch = search.trim().toLowerCase()
  const filtered = normalizedSearch
    ? rows.filter(r =>
      [r.employeeName, r.emp?.employee_code, r.programName, r.enrollment.status]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(normalizedSearch)))
    : rows

  return (
    <div className="w-full min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[14rem] flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search employee or program…"
            className={cn(hrInputClass, 'h-9 pl-8')}
            aria-label="Search enrollments"
          />
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? 'enrollment' : 'enrollments'}
          </p>
          <Button type="button" onClick={() => setShowEnroll(true)}>
            <Send className="h-4 w-4" /> Enroll Employees
          </Button>
        </div>
      </div>

      <div className="w-full overflow-x-auto rounded-xl border border-border bg-card text-foreground shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className={hrEmptyStateClass}>
            <UsersIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">No enrollments yet.</p>
            <Button type="button" className="mt-4" onClick={() => setShowEnroll(true)}>
              <Send className="h-4 w-4" /> Enroll Employees
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No enrollments match your search.</div>
        ) : (
          <table className="w-full min-w-[60rem] table-fixed">
            <thead className={hrTableHeadClass}>
              <tr>
                <th className="w-[22%] px-4 py-3 text-left font-medium">Employee</th>
                <th className="w-[24%] px-4 py-3 text-left font-medium">Program</th>
                <th className="w-[16%] px-4 py-3 text-left font-medium">Progress</th>
                <th className="w-[12%] px-4 py-3 text-left font-medium">Status</th>
                <th className="w-[13%] px-4 py-3 text-left font-medium whitespace-nowrap">Due</th>
                <th className="w-[13%] px-4 py-3 text-left font-medium whitespace-nowrap">Certificate</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ enrollment: e, emp, program, employeeName, programName }) => {
                const stat = ENR_STATUS[e.status] ?? ENR_STATUS.enrolled
                return (
                  <tr key={e.id} className="border-b border-border last:border-b-0 hover:bg-muted/30">
                    <td className="px-4 py-3 align-middle">
                      <p className="truncate text-sm font-medium text-foreground">{employeeName}</p>
                      {emp?.employee_code && (
                        <p className="truncate text-xs text-muted-foreground">{emp.employee_code}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <Link
                        to={`/hr/training/${e.program_id}`}
                        className="block truncate text-sm font-medium text-foreground hover:text-primary hover:underline"
                        title={programName}
                      >
                        {programName}
                      </Link>
                      {program?.category && (
                        <p className="truncate text-xs text-muted-foreground">{program.category}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-2">
                        <div className="h-2 min-w-0 flex-1 rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-primary transition-all"
                            style={{ width: `${Math.min(100, Math.max(0, e.progress_pct ?? 0))}%` }}
                          />
                        </div>
                        <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums text-foreground">
                          {e.progress_pct ?? 0}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${stat.color}`}>
                        {stat.label}
                      </span>
                    </td>
                    <td className="overflow-hidden px-4 py-3 align-middle text-left text-sm text-muted-foreground whitespace-nowrap">
                      <span className="block truncate">{formatDueDate(e.due_date)}</span>
                    </td>
                    <td className="overflow-hidden px-4 py-3 align-middle text-left">
                      {e.certificate_url ? (
                        <a
                          href={e.certificate_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          <Award className="h-3.5 w-3.5" /> View
                        </a>
                      ) : (
                        <span className="block text-left text-xs text-muted-foreground">—</span>
                      )}
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
  const { data: programs = [], isLoading: programsLoading } = useHRPrograms('published')
  const { data: empData, isLoading: employeesLoading } = useHREmployees({ status: 'active', limit: 200 })
  const enroll = useEnrollEmployees()
  const [programId, setProgramId] = useState('')
  const [employeeIds, setEmployeeIds] = useState<string[]>([])
  const [dueDate, setDueDate] = useState('')
  const [employeeSearch, setEmployeeSearch] = useState('')

  const employees = ((empData as { items?: EmployeeProfile[] } | undefined)?.items) ?? []
  const normalizedSearch = employeeSearch.trim().toLowerCase()
  const filteredEmployees = employees.filter(emp => {
    if (!normalizedSearch) return true
    const name = emp.vendor_user?.user?.full_name ?? emp.full_name ?? ''
    return [name, emp.employee_code, emp.designation?.name, emp.department?.name]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(normalizedSearch))
  })
  const allVisibleSelected = filteredEmployees.length > 0
    && filteredEmployees.every(emp => employeeIds.includes(emp.id))

  const toggleVisibleEmployees = () => {
    const visibleIds = filteredEmployees.map(emp => emp.id)
    setEmployeeIds(current => (
      allVisibleSelected
        ? current.filter(id => !visibleIds.includes(id))
        : [...new Set([...current, ...visibleIds])]
    ))
  }

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
              disabled={programsLoading}
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
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="flex items-center gap-2 border-b border-border p-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    value={employeeSearch}
                    onChange={event => setEmployeeSearch(event.target.value)}
                    placeholder="Search employees…"
                    className={`${hrInputClass} h-8 pl-8`}
                    aria-label="Search employees"
                  />
                </div>
                {filteredEmployees.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleVisibleEmployees}
                    className="shrink-0 text-xs font-medium text-primary hover:underline"
                  >
                    {allVisibleSelected ? 'Deselect all' : 'Select all'}
                  </button>
                )}
              </div>
              <div className="max-h-52 overflow-auto">
                {employeesLoading ? (
                  <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading employees…
                  </div>
                ) : employees.length === 0 ? (
                  <div className="p-6 text-center">
                    <UsersIcon className="mx-auto mb-2 h-7 w-7 text-muted-foreground/50" />
                    <p className="text-sm font-medium text-foreground">No active employees found</p>
                    <p className="mt-1 text-xs text-muted-foreground">Add an employee before creating an enrollment.</p>
                  </div>
                ) : filteredEmployees.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">No employees match your search.</p>
                ) : filteredEmployees.map(emp => (
                  <label key={emp.id} className="flex cursor-pointer items-center gap-2 border-b border-border p-2.5 text-sm last:border-b-0 hover:bg-muted/30">
                    <input
                      type="checkbox"
                      checked={employeeIds.includes(emp.id)}
                      onChange={event => setEmployeeIds(current => (
                        event.target.checked
                          ? [...current, emp.id]
                          : current.filter(id => id !== emp.id)
                      ))}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {emp.vendor_user?.user?.full_name ?? emp.full_name ?? emp.employee_code ?? emp.id.slice(0, 8)}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {[emp.employee_code, emp.designation?.name].filter(Boolean).join(' · ')}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </Field>
        </div>
        <div className="shrink-0 flex justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={!programId || employeeIds.length === 0 || enroll.isPending}>
            {enroll.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Enroll {employeeIds.length} {employeeIds.length === 1 ? 'employee' : 'employees'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children, compact }: { label: string; children: React.ReactNode; compact?: boolean }) {
  return (
    <div className={compact ? 'space-y-0.5' : undefined}>
      <InlineFieldLabel
        label={label}
        className={compact ? 'mb-0.5 block text-[11px] font-medium text-muted-foreground' : 'mb-1 block text-xs font-medium text-muted-foreground'}
      />
      {children}
    </div>
  )
}
