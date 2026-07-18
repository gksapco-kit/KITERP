import { onModalBackdropClick, cn } from '@/lib/utils'
import { dialogOverlayClass, dialogPanelClass } from '@/lib/modalUi'
import { Button } from '@/components/ui/button'
import { hrInputClass, hrSelectClass, hrTabActiveClass, hrTabInactiveClass, hrTableHeadClass, hrStatusBadge, hrLabelClass, hrEmptyStateClass, hrCardClass } from '../hrFormUi'
import { Label } from '@/components/ui/label'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Briefcase, Users, Calendar, ExternalLink, Trash2, Pencil, X, Search } from 'lucide-react'
import {
  useHRJobs, useCreateHRJob, useUpdateHRJob, useDeleteHRJob,
  useHRCandidates, useCreateHRCandidate, useDeleteHRCandidate,
  useHRInterviews, useUpdateHRInterview,
  useHRDepartments, useHRDesignations, useStores,
} from '@/hooks/useVendor'
import type { JobPosting, Candidate, InterviewRound, HRDepartment, HRDesignation } from '@/types'
import type { StoreRecord } from '@/api/vendor'

import { askConfirm } from '@/components/common/ConfirmProvider'

const denseFieldClass =
  'h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring [color-scheme:dark]'
const denseLabelClass = 'mb-0.5 block text-[11px] font-medium text-muted-foreground'
const denseTextareaClass =
  'w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none [color-scheme:dark]'

const JOB_STATUS: Record<string, { label: string; color: string }> = {
  draft:   { label: 'Draft',   color: hrStatusBadge.draft },
  open:    { label: 'Open',    color: hrStatusBadge.open },
  closed:  { label: 'Closed',  color: hrStatusBadge.closed },
  on_hold: { label: 'On Hold', color: hrStatusBadge.on_hold },
}

const INTV_STATUS: Record<string, { label: string; color: string }> = {
  scheduled:   { label: 'Scheduled',   color: hrStatusBadge.scheduled },
  completed:   { label: 'Completed',   color: hrStatusBadge.completed },
  no_show:     { label: 'No Show',     color: hrStatusBadge.failed },
  cancelled:   { label: 'Cancelled',   color: hrStatusBadge.cancelled },
  rescheduled: { label: 'Rescheduled', color: hrStatusBadge.on_hold },
}

// ── Job Modal ─────────────────────────────────────────────────────────
function JobModal({
 existing, onClose }: { existing?: JobPosting | null; onClose: () => void }) {
  const create = useCreateHRJob()
  const update = useUpdateHRJob()
  const { data: depts = [] } = useHRDepartments()
  const { data: desigs = [] } = useHRDesignations()
  const { data: storesData } = useStores()
  const stores = (storesData?.stores ?? []) as StoreRecord[]

  const [form, setForm] = useState({
    title: existing?.title ?? '',
    department_id: existing?.department_id ?? '',
    designation_id: existing?.designation_id ?? '',
    store_id: existing?.store_id ?? '',
    employment_type: existing?.employment_type ?? 'full_time',
    location: existing?.location ?? '',
    openings: existing?.openings ?? 1,
    salary_min: existing?.salary_min ?? '',
    salary_max: existing?.salary_max ?? '',
    description: existing?.description ?? '',
    requirements: existing?.requirements ?? '',
    benefits: existing?.benefits ?? '',
    status: existing?.status ?? 'draft',
  })

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const payload: Record<string, unknown> = {
      title: form.title,
      department_id: form.department_id || null,
      designation_id: form.designation_id || null,
      store_id: form.store_id || null,
      employment_type: form.employment_type,
      location: form.location || null,
      openings: Number(form.openings) || 1,
      salary_min: form.salary_min ? Number(form.salary_min) : null,
      salary_max: form.salary_max ? Number(form.salary_max) : null,
      description: form.description || null,
      requirements: form.requirements || null,
      benefits: form.benefits || null,
      status: form.status,
    }
    if (existing) await update.mutateAsync({ id: existing.id, data: payload })
    else await create.mutateAsync(payload)
    onClose()
  }

  return (
    <ModalOverlay onClose={onClose} className="z-[100] bg-black/60 p-3">
      <ModalPanel className="max-h-[calc(100dvh-1.5rem)] max-w-2xl !rounded-lg overflow-hidden">
        <ModalHeader
          title={existing ? 'Edit Job' : 'New Job Posting'}
          onClose={onClose}
          className="border-0 px-4 py-2.5 [&>div>h2]:text-base [&>div>h2]:leading-none"
        />
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <ModalBody className="space-y-2 overflow-y-auto px-4 pb-1 pt-0">
            <div className="grid grid-cols-[1fr_8rem] gap-2">
              <div>
                <Label className={denseLabelClass} required>Title</Label>
                <input required value={form.title} onChange={e => set('title', e.target.value)}
                  className={denseFieldClass} placeholder="e.g. Senior Software Engineer" />
              </div>
              <div>
                <Label className={denseLabelClass}>Status</Label>
                <select value={form.status} onChange={e => set('status', e.target.value as JobPosting['status'])}
                  className={denseFieldClass}>
                  <option value="draft">Draft</option>
                  <option value="open">Open (live)</option>
                  <option value="on_hold">On Hold</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className={denseLabelClass}>Department</Label>
                <select value={form.department_id || ''} onChange={e => set('department_id', e.target.value)}
                  className={denseFieldClass}>
                  <option value="">— None —</option>
                  {(depts as HRDepartment[]).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <Label className={denseLabelClass}>Designation</Label>
                <select value={form.designation_id || ''} onChange={e => set('designation_id', e.target.value)}
                  className={denseFieldClass}>
                  <option value="">— None —</option>
                  {(desigs as HRDesignation[]).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <Label className={denseLabelClass}>Store</Label>
                <select value={form.store_id || ''} onChange={e => set('store_id', e.target.value)}
                  className={denseFieldClass}>
                  <option value="">— Any —</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <Label className={denseLabelClass}>Employment Type</Label>
                <select value={form.employment_type} onChange={e => set('employment_type', e.target.value)}
                  className={denseFieldClass}>
                  <option value="full_time">Full-time</option>
                  <option value="part_time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                  <option value="temporary">Temporary</option>
                </select>
              </div>
              <div>
                <Label className={denseLabelClass}>Openings</Label>
                <input type="number" min={1} value={form.openings} onChange={e => set('openings', Number(e.target.value))}
                  className={denseFieldClass} />
              </div>
              <div>
                <Label className={denseLabelClass}>Location</Label>
                <input value={form.location} onChange={e => set('location', e.target.value)}
                  className={denseFieldClass} placeholder="City, Remote, etc." />
              </div>
              <div>
                <Label className={denseLabelClass}>Salary Min</Label>
                <input type="number" value={form.salary_min} onChange={e => set('salary_min', e.target.value)}
                  className={denseFieldClass} />
              </div>
              <div>
                <Label className={denseLabelClass}>Salary Max</Label>
                <input type="number" value={form.salary_max} onChange={e => set('salary_max', e.target.value)}
                  className={denseFieldClass} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className={denseLabelClass}>Description</Label>
                <textarea rows={3} value={form.description} onChange={e => set('description', e.target.value)}
                  className={denseTextareaClass} placeholder="Role overview…" />
              </div>
              <div>
                <Label className={denseLabelClass}>Requirements</Label>
                <textarea rows={3} value={form.requirements} onChange={e => set('requirements', e.target.value)}
                  className={denseTextareaClass} placeholder="Must-haves…" />
              </div>
              <div>
                <Label className={denseLabelClass}>Benefits</Label>
                <textarea rows={3} value={form.benefits} onChange={e => set('benefits', e.target.value)}
                  className={denseTextareaClass} placeholder="Perks…" />
              </div>
            </div>
          </ModalBody>
          <ModalFooter className="border-0 px-4 py-2.5">
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" className="h-8" disabled={create.isPending || update.isPending}>
              {create.isPending || update.isPending ? 'Saving…' : (existing ? 'Save changes' : 'Create job')}
            </Button>
          </ModalFooter>
        </form>
      </ModalPanel>
    </ModalOverlay>
  )
}

// ── Candidate Modal ───────────────────────────────────────────────────
function CandidateModal({
 onClose }: { onClose: () => void }) {
  const create = useCreateHRCandidate()
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', current_company: '', current_designation: '',
    total_experience_years: '', current_ctc: '', expected_ctc: '', notice_period_days: '',
    location: '', source: 'direct', resume_url: '', skills: '', notes: '',
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    await create.mutateAsync({
      full_name: form.full_name,
      email: form.email || null,
      phone: form.phone || null,
      current_company: form.current_company || null,
      current_designation: form.current_designation || null,
      total_experience_years: form.total_experience_years ? Number(form.total_experience_years) : null,
      current_ctc: form.current_ctc ? Number(form.current_ctc) : null,
      expected_ctc: form.expected_ctc ? Number(form.expected_ctc) : null,
      notice_period_days: form.notice_period_days ? Number(form.notice_period_days) : null,
      location: form.location || null,
      source: form.source,
      resume_url: form.resume_url || null,
      skills: form.skills ? form.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
      notes: form.notes || null,
    })
    onClose()
  }

  return (
    <div data-kiterp-modal className={dialogOverlayClass}>
      <div className={cn(dialogPanelClass, 'max-w-2xl')}>
        <div className="shrink-0 flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-lg font-semibold text-foreground">Add Candidate</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-3 p-5">
          <div>
            <Label className={hrLabelClass} required>Full Name</Label>
            <input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
              className={cn(hrInputClass, 'mt-1')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className={hrLabelClass}>Email</Label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className={cn(hrInputClass, 'mt-1')} />
            </div>
            <div>
              <Label className={hrLabelClass}>Phone</Label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className={cn(hrInputClass, 'mt-1')} />
            </div>
            <div>
              <Label className={hrLabelClass}>Current Company</Label>
              <input value={form.current_company} onChange={e => setForm({ ...form, current_company: e.target.value })}
                className={cn(hrInputClass, 'mt-1')} />
            </div>
            <div>
              <Label className={hrLabelClass}>Current Designation</Label>
              <input value={form.current_designation} onChange={e => setForm({ ...form, current_designation: e.target.value })}
                className={cn(hrInputClass, 'mt-1')} />
            </div>
            <div>
              <Label className={hrLabelClass}>Experience (yrs)</Label>
              <input type="number" step="0.5" value={form.total_experience_years}
                onChange={e => setForm({ ...form, total_experience_years: e.target.value })}
                className={cn(hrInputClass, 'mt-1')} />
            </div>
            <div>
              <Label className={hrLabelClass}>Notice Period (days)</Label>
              <input type="number" value={form.notice_period_days}
                onChange={e => setForm({ ...form, notice_period_days: e.target.value })}
                className={cn(hrInputClass, 'mt-1')} />
            </div>
            <div>
              <Label className={hrLabelClass}>Current CTC</Label>
              <input type="number" value={form.current_ctc}
                onChange={e => setForm({ ...form, current_ctc: e.target.value })}
                className={cn(hrInputClass, 'mt-1')} />
            </div>
            <div>
              <Label className={hrLabelClass}>Expected CTC</Label>
              <input type="number" value={form.expected_ctc}
                onChange={e => setForm({ ...form, expected_ctc: e.target.value })}
                className={cn(hrInputClass, 'mt-1')} />
            </div>
            <div>
              <Label className={hrLabelClass}>Location</Label>
              <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                className={cn(hrInputClass, 'mt-1')} />
            </div>
            <div>
              <Label className={hrLabelClass}>Source</Label>
              <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}
                className={cn(hrInputClass, 'mt-1')}>
                <option value="direct">Direct</option>
                <option value="linkedin">LinkedIn</option>
                <option value="naukri">Naukri</option>
                <option value="referral">Referral</option>
                <option value="agency">Agency</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div>
            <Label className={hrLabelClass}>Resume URL</Label>
            <input value={form.resume_url} onChange={e => setForm({ ...form, resume_url: e.target.value })}
              className={cn(hrInputClass, 'mt-1')} placeholder="https://..." />
          </div>
          <div>
            <Label className={hrLabelClass}>Skills (comma-separated)</Label>
            <input value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })}
              className={cn(hrInputClass, 'mt-1')} placeholder="React, TypeScript, Node" />
          </div>
          <div>
            <Label className={hrLabelClass}>Notes</Label>
            <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              className={cn(hrInputClass, 'mt-1')} />
          </div>
          </div>
          <div className="shrink-0 flex justify-end gap-2 border-t border-border px-5 py-3">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Saving…' : 'Add candidate'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────
type TabKey = 'jobs' | 'candidates' | 'interviews'

export default function RecruitmentPage() {
  const [tab, setTab] = useState<TabKey>('jobs')

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recruitment</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage Jobs, Candidates And Interviews</p>
        </div>
      </div>

      <div className="mb-5 flex gap-1 border-b border-border">
        {[
          { k: 'jobs',       label: 'Jobs',       icon: Briefcase },
          { k: 'candidates', label: 'Candidates', icon: Users },
          { k: 'interviews', label: 'Interviews', icon: Calendar },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as TabKey)}
            className={cn(
              '-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors focus:outline-none',
              tab === t.k ? hrTabActiveClass : hrTabInactiveClass,
            )}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'jobs' && <JobsTab />}
      {tab === 'candidates' && <CandidatesTab />}
      {tab === 'interviews' && <InterviewsTab />}
    </div>
  )
}

function JobsTab() {
  const [statusFilter, setStatusFilter] = useState<string>('')
  const { data: jobs = [], isLoading } = useHRJobs(statusFilter || undefined)
  const deleteJob = useDeleteHRJob()
  const [editing, setEditing] = useState<JobPosting | null>(null)
  const [showNew, setShowNew] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className={cn(hrSelectClass, 'w-auto')}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="open">Open</option>
          <option value="on_hold">On Hold</option>
          <option value="closed">Closed</option>
        </select>
        <Button type="button" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" /> New Job
        </Button>
      </div>

      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : (jobs as JobPosting[]).length === 0 ? (
          <div className={hrEmptyStateClass}>
            <Briefcase className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">No job postings yet.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className={hrTableHeadClass}>
              <tr>
                {['Title', 'Department / Designation', 'Type', 'Openings', 'Location', 'Status', 'Actions'].map(h =>
                  <th key={h} className="text-left py-3 px-4 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(jobs as JobPosting[]).map(job => {
                const cfg = JOB_STATUS[job.status] ?? JOB_STATUS.draft
                return (
                  <tr key={job.id} className="border-b border-border hover:bg-muted/30">
                    <td className="py-3 px-4">
                      <Link to={`/hr/recruitment/jobs/${job.id}`} className="text-sm font-medium text-primary hover:underline">
                        {job.title}
                      </Link>
                      {job.public_slug && (
                        <p className="mt-0.5 text-xs text-muted-foreground">/{job.public_slug}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {job.department?.name ?? '—'}
                      {job.designation && <span className="text-muted-foreground/70"> · {job.designation.name}</span>}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{job.employment_type}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{job.openings}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{job.location ?? '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Link to={`/hr/recruitment/jobs/${job.id}`}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary" title="Pipeline">
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                        <button onClick={() => setEditing(job)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={async () => { if (await askConfirm('Delete this job?')) deleteJob.mutate(job.id) }}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showNew && <JobModal onClose={() => setShowNew(false)} />}
      {editing && <JobModal existing={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function CandidatesTab() {
  const [search, setSearch] = useState('')
  const { data: candidates = [], isLoading } = useHRCandidates(search || undefined)
  const deleteCand = useDeleteHRCandidate()
  const [showNew, setShowNew] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, phone…"
            className={cn(hrInputClass, 'w-72 pl-9')} />
        </div>
        <Button type="button" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" /> Add Candidate
        </Button>
      </div>

      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : (candidates as Candidate[]).length === 0 ? (
          <div className={hrEmptyStateClass}>
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">No candidates yet.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className={hrTableHeadClass}>
              <tr>
                {['Name', 'Contact', 'Current Role', 'Experience', 'CTC (Cur / Exp)', 'Source', 'Actions'].map(h =>
                  <th key={h} className="text-left py-3 px-4 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(candidates as Candidate[]).map(c => (
                <tr key={c.id} className="border-b border-border hover:bg-muted/30">
                  <td className="py-3 px-4">
                    <p className="text-sm font-medium text-foreground">{c.full_name}</p>
                    {c.location && <p className="text-xs text-muted-foreground">{c.location}</p>}
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">
                    {c.email && <p>{c.email}</p>}
                    {c.phone && <p>{c.phone}</p>}
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">
                    {c.current_designation ?? '—'}
                    {c.current_company && <p className="text-xs text-muted-foreground">@ {c.current_company}</p>}
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">
                    {c.total_experience_years ? `${c.total_experience_years} yrs` : '—'}
                    {c.notice_period_days != null && <p className="text-xs text-muted-foreground">{c.notice_period_days} d notice</p>}
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">
                    {c.current_ctc != null ? `₹${Number(c.current_ctc).toLocaleString()}` : '—'}
                    {c.expected_ctc != null && <span className="text-muted-foreground/70"> → ₹{Number(c.expected_ctc).toLocaleString()}</span>}
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <span className={cn('rounded-full px-2 py-0.5', hrStatusBadge.draft)}>{c.source ?? 'direct'}</span>
                  </td>
                  <td className="py-3 px-4">
                    <button onClick={async () => { if (await askConfirm('Delete candidate?')) deleteCand.mutate(c.id) }}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNew && <CandidateModal onClose={() => setShowNew(false)} />}
    </div>
  )
}

function InterviewsTab() {
  const [upcoming, setUpcoming] = useState(true)
  const { data: interviews = [], isLoading } = useHRInterviews(upcoming)
  const updateIv = useUpdateHRInterview()

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <button type="button" onClick={() => setUpcoming(true)}
          className={cn('rounded-lg px-3 py-1.5 text-sm transition-colors', upcoming ? 'bg-primary text-primary-foreground' : 'border border-border bg-background text-muted-foreground hover:text-foreground')}>
          Upcoming
        </button>
        <button type="button" onClick={() => setUpcoming(false)}
          className={cn('rounded-lg px-3 py-1.5 text-sm transition-colors', !upcoming ? 'bg-primary text-primary-foreground' : 'border border-border bg-background text-muted-foreground hover:text-foreground')}>
          All
        </button>
      </div>

      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : (interviews as InterviewRound[]).length === 0 ? (
          <div className={hrEmptyStateClass}>
            <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">No interviews scheduled.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className={hrTableHeadClass}>
              <tr>
                {['When', 'Round', 'Candidate', 'Job', 'Mode', 'Status', 'Result', 'Actions'].map(h =>
                  <th key={h} className="text-left py-3 px-4 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(interviews as InterviewRound[]).map(iv => {
                const cfg = INTV_STATUS[iv.status] ?? INTV_STATUS.scheduled
                const app = iv.application
                return (
                  <tr key={iv.id} className="border-b border-border hover:bg-muted/30">
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {iv.scheduled_at ? new Date(iv.scheduled_at).toLocaleString() : '—'}
                      {iv.duration_min ? <p className="text-xs text-muted-foreground">{iv.duration_min} min</p> : null}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <p className="font-medium text-foreground">R{iv.round_number}</p>
                      <p className="text-xs text-muted-foreground">{iv.round_name ?? ''}</p>
                    </td>
                    <td className="py-3 px-4 text-sm text-foreground">{app?.candidate?.full_name ?? '—'}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{app?.job_posting?.title ?? '—'}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{iv.mode ?? '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {iv.recommendation ? `${iv.recommendation}${iv.rating ? ` (${iv.rating}/5)` : ''}` : '—'}
                    </td>
                    <td className="py-3 px-4">
                      {iv.status === 'scheduled' && (
                        <select onChange={e => updateIv.mutate({ id: iv.id, data: { status: e.target.value } })}
                          defaultValue=""
                          className={cn(hrSelectClass, 'h-8 w-auto px-2 text-xs')}>
                          <option value="" disabled>Mark…</option>
                          <option value="completed">Completed</option>
                          <option value="no_show">No Show</option>
                          <option value="cancelled">Cancel</option>
                          <option value="rescheduled">Reschedule</option>
                        </select>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
