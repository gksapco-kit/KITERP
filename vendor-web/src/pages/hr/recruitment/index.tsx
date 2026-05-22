import { onModalBackdropClick } from '@/lib/utils'
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

const JOB_STATUS: Record<string, { label: string; color: string }> = {
  draft:   { label: 'Draft',   color: 'bg-gray-100 text-gray-600' },
  open:    { label: 'Open',    color: 'bg-green-100 text-green-700' },
  closed:  { label: 'Closed',  color: 'bg-red-100 text-red-700' },
  on_hold: { label: 'On Hold', color: 'bg-yellow-100 text-yellow-700' },
}

const INTV_STATUS: Record<string, { label: string; color: string }> = {
  scheduled:   { label: 'Scheduled',   color: 'bg-blue-100 text-blue-700' },
  completed:   { label: 'Completed',   color: 'bg-green-100 text-green-700' },
  no_show:     { label: 'No Show',     color: 'bg-red-100 text-red-700' },
  cancelled:   { label: 'Cancelled',   color: 'bg-gray-100 text-gray-600' },
  rescheduled: { label: 'Rescheduled', color: 'bg-amber-100 text-amber-700' },
}

// ── Job Modal ─────────────────────────────────────────────────────────
function JobModal({ existing, onClose }: { existing?: JobPosting | null; onClose: () => void }) {
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
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onModalBackdropClick(onClose)}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-lg font-semibold">{existing ? 'Edit Job' : 'New Job Posting'}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 uppercase">Title *</label>
            <input required value={form.title} onChange={e => set('title', e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Senior Software Engineer" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Department</label>
              <select value={form.department_id || ''} onChange={e => set('department_id', e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                <option value="">— None —</option>
                {(depts as HRDepartment[]).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Designation</label>
              <select value={form.designation_id || ''} onChange={e => set('designation_id', e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                <option value="">— None —</option>
                {(desigs as HRDesignation[]).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Store</label>
              <select value={form.store_id || ''} onChange={e => set('store_id', e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                <option value="">— Any —</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Employment Type</label>
              <select value={form.employment_type} onChange={e => set('employment_type', e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                <option value="full_time">Full-time</option>
                <option value="part_time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="intern">Intern</option>
                <option value="temporary">Temporary</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Openings</label>
              <input type="number" min={1} value={form.openings} onChange={e => set('openings', Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Location</label>
              <input value={form.location} onChange={e => set('location', e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="City, Remote, etc." />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Salary Min</label>
              <input type="number" value={form.salary_min} onChange={e => set('salary_min', e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Salary Max</label>
              <input type="number" value={form.salary_max} onChange={e => set('salary_max', e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 uppercase">Description</label>
            <textarea rows={3} value={form.description} onChange={e => set('description', e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 uppercase">Requirements</label>
            <textarea rows={3} value={form.requirements} onChange={e => set('requirements', e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 uppercase">Benefits</label>
            <textarea rows={2} value={form.benefits} onChange={e => set('benefits', e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 uppercase">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value as JobPosting['status'])}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
              <option value="draft">Draft</option>
              <option value="open">Open (live)</option>
              <option value="on_hold">On Hold</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <button type="button" onClick={onClose} className="btn-cancel px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button type="submit" disabled={create.isPending || update.isPending}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
              {create.isPending || update.isPending ? 'Saving…' : (existing ? 'Save changes' : 'Create job')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Candidate Modal ───────────────────────────────────────────────────
function CandidateModal({ onClose }: { onClose: () => void }) {
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
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-lg font-semibold">Add Candidate</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 uppercase">Full Name *</label>
            <input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Phone</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Current Company</label>
              <input value={form.current_company} onChange={e => setForm({ ...form, current_company: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Current Designation</label>
              <input value={form.current_designation} onChange={e => setForm({ ...form, current_designation: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Experience (yrs)</label>
              <input type="number" step="0.5" value={form.total_experience_years}
                onChange={e => setForm({ ...form, total_experience_years: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Notice Period (days)</label>
              <input type="number" value={form.notice_period_days}
                onChange={e => setForm({ ...form, notice_period_days: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Current CTC</label>
              <input type="number" value={form.current_ctc}
                onChange={e => setForm({ ...form, current_ctc: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Expected CTC</label>
              <input type="number" value={form.expected_ctc}
                onChange={e => setForm({ ...form, expected_ctc: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Location</label>
              <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Source</label>
              <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
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
            <label className="text-xs font-medium text-gray-600 uppercase">Resume URL</label>
            <input value={form.resume_url} onChange={e => setForm({ ...form, resume_url: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="https://..." />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 uppercase">Skills (comma-separated)</label>
            <input value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="React, TypeScript, Node" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 uppercase">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <button type="button" onClick={onClose} className="btn-cancel px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button type="submit" disabled={create.isPending}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
              {create.isPending ? 'Saving…' : 'Add candidate'}
            </button>
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
          <h1 className="text-2xl font-bold text-gray-900">Recruitment</h1>
          <p className="text-sm text-gray-500 mt-1">Manage Jobs, Candidates And Interviews</p>
        </div>
      </div>

      <div className="flex border-b mb-5 gap-1">
        {[
          { k: 'jobs',       label: 'Jobs',       icon: Briefcase },
          { k: 'candidates', label: 'Candidates', icon: Users },
          { k: 'interviews', label: 'Interviews', icon: Calendar },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as TabKey)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.k ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon className="w-4 h-4" /> {t.label}
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
          className="px-3 py-2 border rounded-lg text-sm">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="open">Open</option>
          <option value="on_hold">On Hold</option>
          <option value="closed">Closed</option>
        </select>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium">
          <Plus className="w-4 h-4" /> New Job
        </button>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (jobs as JobPosting[]).length === 0 ? (
          <div className="p-12 text-center">
            <Briefcase className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No job postings yet.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
              <tr>
                {['Title', 'Department / Designation', 'Type', 'Openings', 'Location', 'Status', 'Actions'].map(h =>
                  <th key={h} className="text-left py-3 px-4 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(jobs as JobPosting[]).map(job => {
                const cfg = JOB_STATUS[job.status] ?? JOB_STATUS.draft
                return (
                  <tr key={job.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <Link to={`/hr/recruitment/jobs/${job.id}`} className="text-sm font-medium text-blue-700 hover:underline">
                        {job.title}
                      </Link>
                      {job.public_slug && (
                        <p className="text-[11px] text-gray-400 mt-0.5">/{job.public_slug}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {job.department?.name ?? '—'}
                      {job.designation && <span className="text-gray-400"> · {job.designation.name}</span>}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{job.employment_type}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{job.openings}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{job.location ?? '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Link to={`/hr/recruitment/jobs/${job.id}`}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Pipeline">
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                        <button onClick={() => setEditing(job)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => { if (confirm('Delete this job?')) deleteJob.mutate(job.id) }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
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
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, phone…"
            className="pl-9 pr-3 py-2 border rounded-lg text-sm w-72" />
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium">
          <Plus className="w-4 h-4" /> Add Candidate
        </button>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (candidates as Candidate[]).length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No candidates yet.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
              <tr>
                {['Name', 'Contact', 'Current Role', 'Experience', 'CTC (Cur / Exp)', 'Source', 'Actions'].map(h =>
                  <th key={h} className="text-left py-3 px-4 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(candidates as Candidate[]).map(c => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <p className="text-sm font-medium text-gray-900">{c.full_name}</p>
                    {c.location && <p className="text-[11px] text-gray-400">{c.location}</p>}
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-600">
                    {c.email && <p>{c.email}</p>}
                    {c.phone && <p>{c.phone}</p>}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {c.current_designation ?? '—'}
                    {c.current_company && <p className="text-[11px] text-gray-400">@ {c.current_company}</p>}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {c.total_experience_years ? `${c.total_experience_years} yrs` : '—'}
                    {c.notice_period_days != null && <p className="text-[11px] text-gray-400">{c.notice_period_days} d notice</p>}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {c.current_ctc != null ? `₹${Number(c.current_ctc).toLocaleString()}` : '—'}
                    {c.expected_ctc != null && <span className="text-gray-400"> → ₹{Number(c.expected_ctc).toLocaleString()}</span>}
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{c.source ?? 'direct'}</span>
                  </td>
                  <td className="py-3 px-4">
                    <button onClick={() => { if (confirm('Delete candidate?')) deleteCand.mutate(c.id) }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
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
        <button onClick={() => setUpcoming(true)}
          className={`px-3 py-1.5 text-sm rounded-lg ${upcoming ? 'bg-primary text-white' : 'bg-white border text-gray-600'}`}>
          Upcoming
        </button>
        <button onClick={() => setUpcoming(false)}
          className={`px-3 py-1.5 text-sm rounded-lg ${!upcoming ? 'bg-primary text-white' : 'bg-white border text-gray-600'}`}>
          All
        </button>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (interviews as InterviewRound[]).length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No interviews scheduled.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
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
                  <tr key={iv.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {iv.scheduled_at ? new Date(iv.scheduled_at).toLocaleString() : '—'}
                      {iv.duration_min ? <p className="text-[11px] text-gray-400">{iv.duration_min} min</p> : null}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <p className="font-medium">R{iv.round_number}</p>
                      <p className="text-[11px] text-gray-400">{iv.round_name ?? ''}</p>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700">{app?.candidate?.full_name ?? '—'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{app?.job_posting?.title ?? '—'}</td>
                    <td className="py-3 px-4 text-xs text-gray-500">{iv.mode ?? '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500">
                      {iv.recommendation ? `${iv.recommendation}${iv.rating ? ` (${iv.rating}/5)` : ''}` : '—'}
                    </td>
                    <td className="py-3 px-4">
                      {iv.status === 'scheduled' && (
                        <select onChange={e => updateIv.mutate({ id: iv.id, data: { status: e.target.value } })}
                          defaultValue=""
                          className="text-xs border rounded px-2 py-1">
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
