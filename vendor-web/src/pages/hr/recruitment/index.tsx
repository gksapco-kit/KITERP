import { onModalBackdropClick, cn } from '@/lib/utils'
import { dialogOverlayClass, dialogPanelClass } from '@/lib/modalUi'
import { Button } from '@/components/ui/button'
import { hrInputClass, hrSelectClass, hrTabActiveClass, hrTabInactiveClass, hrTableHeadClass, hrStatusBadge, hrLabelClass, hrEmptyStateClass, hrCardClass } from '../hrFormUi'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Briefcase, Users, Calendar, Copy, ExternalLink, Trash2, Pencil, X, Search, GitBranch } from 'lucide-react'
import { isVendorAdminEmbed } from '@/lib/adminEmbed'
import { adminAppOrigin } from '@/lib/adminAppOrigin'
import {
  HR_RECRUITMENT_COMMON_MEETING_URL_KEY,
  readRecruitmentCommonMeetingUrl,
} from '@/lib/hrModuleSettings'
import {
  useHRJobs, useCreateHRJob, useUpdateHRJob, useDeleteHRJob,
  useHRCandidates, useCreateHRCandidate, useUpdateHRCandidate, useDeleteHRCandidate,
  useCreateHRApplication,
  useHRInterviews, useUpdateHRInterview,
  useHRDepartments, useCreateHRDepartment,
  useHRDesignations, useCreateHRDesignation,
  useStores,
  useMyVendor,
  useUpdateVendor,
} from '@/hooks/useVendor'
import type { JobPosting, Candidate, JobApplication, InterviewRound, HRDepartment, HRDesignation } from '@/types'
import type { StoreRecord } from '@/api/vendor'

import { askConfirm } from '@/components/common/ConfirmProvider'

function copyText(value: string, okMsg: string) {
  void navigator.clipboard?.writeText(value).then(
    () => toast.success(okMsg),
    () => toast.error('Could not copy'),
  )
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim())
}

function normalizeInterviewLink(value: string): string {
  const v = value.trim()
  if (!v) return ''
  if (isHttpUrl(v) || v.startsWith('mailto:') || v.startsWith('tel:')) return v
  // Allow bare meet/zoom hosts without scheme.
  if (/^(meet\.google\.com|zoom\.us|teams\.microsoft\.com)\//i.test(v)) {
    return `https://${v}`
  }
  return v
}

function formatInterviewWhen(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

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
  const createDept = useCreateHRDepartment()
  const createDesig = useCreateHRDesignation()
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
  const [addingDept, setAddingDept] = useState(false)
  const [addingDesig, setAddingDesig] = useState(false)
  const [newDeptName, setNewDeptName] = useState('')
  const [newDesigName, setNewDesigName] = useState('')

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

  async function addDepartment() {
    const name = newDeptName.trim()
    if (!name) return
    const created = await createDept.mutateAsync({ name }) as HRDepartment
    set('department_id', created.id)
    setNewDeptName('')
    setAddingDept(false)
  }

  async function addDesignation() {
    const name = newDesigName.trim()
    if (!name) return
    const created = await createDesig.mutateAsync({ name, level: 1 }) as HRDesignation
    set('designation_id', created.id)
    setNewDesigName('')
    setAddingDesig(false)
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
                <Select
                  value={form.status}
                  onChange={v => set('status', v as JobPosting['status'])}
                  className={denseFieldClass}
                  options={[
                    { value: 'draft', label: 'Draft' },
                    { value: 'open', label: 'Open (live)' },
                    { value: 'on_hold', label: 'On Hold' },
                    { value: 'closed', label: 'Closed' },
                  ]}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="mb-0.5 flex items-center justify-between gap-2">
                  <Label className={cn(denseLabelClass, 'mb-0')}>Department</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingDept((v) => !v)
                      setAddingDesig(false)
                    }}
                    className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </button>
                </div>
                {addingDept ? (
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={newDeptName}
                      onChange={(e) => setNewDeptName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          void addDepartment()
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          setAddingDept(false)
                          setNewDeptName('')
                        }
                      }}
                      className={denseFieldClass}
                      placeholder="New department name"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 shrink-0 px-2.5"
                      disabled={!newDeptName.trim() || createDept.isPending}
                      onClick={() => void addDepartment()}
                    >
                      {createDept.isPending ? '…' : 'Save'}
                    </Button>
                  </div>
                ) : null}
                <Select
                  value={form.department_id || ''}
                  onChange={v => set('department_id', v)}
                  className={denseFieldClass}
                  options={[
                    { value: '', label: '— None —' },
                    ...(depts as HRDepartment[]).map(d => ({ value: d.id, label: d.name })),
                  ]}
                />
              </div>
              <div>
                <div className="mb-0.5 flex items-center justify-between gap-2">
                  <Label className={cn(denseLabelClass, 'mb-0')}>Designation</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingDesig((v) => !v)
                      setAddingDept(false)
                    }}
                    className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </button>
                </div>
                {addingDesig ? (
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={newDesigName}
                      onChange={(e) => setNewDesigName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          void addDesignation()
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          setAddingDesig(false)
                          setNewDesigName('')
                        }
                      }}
                      className={denseFieldClass}
                      placeholder="New designation title"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 shrink-0 px-2.5"
                      disabled={!newDesigName.trim() || createDesig.isPending}
                      onClick={() => void addDesignation()}
                    >
                      {createDesig.isPending ? '…' : 'Save'}
                    </Button>
                  </div>
                ) : null}
                <Select
                  value={form.designation_id || ''}
                  onChange={v => set('designation_id', v)}
                  className={denseFieldClass}
                  options={[
                    { value: '', label: '— None —' },
                    ...(desigs as HRDesignation[]).map(d => ({ value: d.id, label: d.name })),
                  ]}
                />
              </div>
              <div>
                <Label className={denseLabelClass}>Store</Label>
                <Select
                  value={form.store_id || ''}
                  onChange={v => set('store_id', v)}
                  className={denseFieldClass}
                  options={[
                    { value: '', label: '— Any —' },
                    ...stores.map(s => ({ value: s.id, label: s.name })),
                  ]}
                />
              </div>
              <div>
                <Label className={denseLabelClass}>Employment Type</Label>
                <Select
                  value={form.employment_type}
                  onChange={v => set('employment_type', v)}
                  className={denseFieldClass}
                  options={[
                    { value: 'full_time', label: 'Full-time' },
                    { value: 'part_time', label: 'Part-time' },
                    { value: 'contract', label: 'Contract' },
                    { value: 'intern', label: 'Intern' },
                    { value: 'temporary', label: 'Temporary' },
                  ]}
                />
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
 existing,
 onClose,
}: {
  existing?: Candidate | null
  onClose: () => void
}) {
  const create = useCreateHRCandidate()
  const update = useUpdateHRCandidate()
  const [form, setForm] = useState({
    full_name: existing?.full_name ?? '',
    email: existing?.email ?? '',
    phone: existing?.phone ?? '',
    current_company: existing?.current_company ?? '',
    current_designation: existing?.current_designation ?? '',
    total_experience_years: existing?.total_experience_years != null ? String(existing.total_experience_years) : '',
    current_ctc: existing?.current_ctc != null ? String(existing.current_ctc) : '',
    expected_ctc: existing?.expected_ctc != null ? String(existing.expected_ctc) : '',
    notice_period_days: existing?.notice_period_days != null ? String(existing.notice_period_days) : '',
    location: existing?.location ?? '',
    source: existing?.source || 'direct',
    resume_url: existing?.resume_url ?? '',
    skills: Array.isArray(existing?.skills) ? existing.skills.join(', ') : '',
    notes: existing?.notes ?? '',
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
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
    }
    if (existing) {
      await update.mutateAsync({ id: existing.id, data: payload })
    } else {
      await create.mutateAsync(payload)
    }
    onClose()
  }

  const busy = create.isPending || update.isPending

  return (
    <ModalOverlay onClose={onClose} className="z-[100] bg-black/60 p-3">
      <ModalPanel className="max-h-[calc(100dvh-1.5rem)] max-w-3xl !rounded-lg overflow-hidden">
        <ModalHeader
          title={existing ? 'Edit Candidate' : 'Add Candidate'}
          onClose={onClose}
          className="border-0 px-4 py-2.5 [&>div>h2]:text-base [&>div>h2]:leading-none"
        />
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <ModalBody className="space-y-2 overflow-visible px-4 pb-1 pt-0">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-3 sm:col-span-1">
                <Label className={denseLabelClass} required>Full Name</Label>
                <input
                  required
                  value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })}
                  className={denseFieldClass}
                  placeholder="Candidate name"
                />
              </div>
              <div>
                <Label className={denseLabelClass}>Email</Label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className={denseFieldClass}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <Label className={denseLabelClass}>Phone</Label>
                <input
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className={denseFieldClass}
                  placeholder="Mobile"
                />
              </div>
              <div>
                <Label className={denseLabelClass}>Current Company</Label>
                <input
                  value={form.current_company}
                  onChange={e => setForm({ ...form, current_company: e.target.value })}
                  className={denseFieldClass}
                />
              </div>
              <div>
                <Label className={denseLabelClass}>Current Designation</Label>
                <input
                  value={form.current_designation}
                  onChange={e => setForm({ ...form, current_designation: e.target.value })}
                  className={denseFieldClass}
                />
              </div>
              <div>
                <Label className={denseLabelClass}>Location</Label>
                <input
                  value={form.location}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  className={denseFieldClass}
                />
              </div>
              <div>
                <Label className={denseLabelClass}>Experience (yrs)</Label>
                <input
                  type="number"
                  step="0.5"
                  value={form.total_experience_years}
                  onChange={e => setForm({ ...form, total_experience_years: e.target.value })}
                  className={denseFieldClass}
                />
              </div>
              <div>
                <Label className={denseLabelClass}>Notice (days)</Label>
                <input
                  type="number"
                  value={form.notice_period_days}
                  onChange={e => setForm({ ...form, notice_period_days: e.target.value })}
                  className={denseFieldClass}
                />
              </div>
              <div>
                <Label className={denseLabelClass}>Source</Label>
                <Select
                  value={form.source}
                  onChange={v => setForm({ ...form, source: v })}
                  className={denseFieldClass}
                  options={[
                    { value: 'direct', label: 'Direct' },
                    { value: 'linkedin', label: 'LinkedIn' },
                    { value: 'naukri', label: 'Naukri' },
                    { value: 'referral', label: 'Referral' },
                    { value: 'agency', label: 'Agency' },
                    { value: 'portal', label: 'Portal' },
                    { value: 'other', label: 'Other' },
                  ]}
                />
              </div>
              <div>
                <Label className={denseLabelClass}>Current CTC</Label>
                <input
                  type="number"
                  value={form.current_ctc}
                  onChange={e => setForm({ ...form, current_ctc: e.target.value })}
                  className={denseFieldClass}
                />
              </div>
              <div>
                <Label className={denseLabelClass}>Expected CTC</Label>
                <input
                  type="number"
                  value={form.expected_ctc}
                  onChange={e => setForm({ ...form, expected_ctc: e.target.value })}
                  className={denseFieldClass}
                />
              </div>
              <div>
                <Label className={denseLabelClass}>Resume URL</Label>
                <input
                  value={form.resume_url}
                  onChange={e => setForm({ ...form, resume_url: e.target.value })}
                  className={denseFieldClass}
                  placeholder="https://..."
                />
              </div>
              <div className="col-span-3 sm:col-span-2">
                <Label className={denseLabelClass}>Skills</Label>
                <input
                  value={form.skills}
                  onChange={e => setForm({ ...form, skills: e.target.value })}
                  className={denseFieldClass}
                  placeholder="React, TypeScript, Node"
                />
              </div>
              <div className="col-span-3 sm:col-span-1">
                <Label className={denseLabelClass}>Notes</Label>
                <input
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className={denseFieldClass}
                  placeholder="Short notes"
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter className="border-0 px-4 py-2.5">
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="h-8" disabled={busy}>
              {busy ? 'Saving…' : (existing ? 'Save changes' : 'Add candidate')}
            </Button>
          </ModalFooter>
        </form>
      </ModalPanel>
    </ModalOverlay>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────
type TabKey = 'jobs' | 'candidates' | 'careers' | 'interviews'

const HR_EMBED_OPEN_PIPELINE = 'kiterp:hr:open-pipeline'
const HR_EMBED_CAREERS_REFRESH = 'kiterp:hr:careers-refresh'
const ADMIN_EMBED_REQUEST_AUTH = 'kiterp:admin:embed-request-auth'
const ADMIN_EMBED_AUTH_RESPONSE = 'kiterp:admin:embed-auth'

function CareersInboxEmbed() {
  const navigate = useNavigate()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const adminOrigin = adminAppOrigin()

  useEffect(() => {
    const origin = adminOrigin
    const base = `${origin}/dashboard/embed/hr/careers`

    const applySrc = (accessToken?: string) => {
      if (accessToken) {
        const url = new URL(base)
        url.searchParams.set('access_token', accessToken)
        setSrc(url.toString())
      } else {
        setSrc(base)
      }
    }

    applySrc()

    const topWin = window.top
    if (!topWin || topWin === window) return

    const onAuthMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return
      const data = event.data as { type?: string; accessToken?: string } | null
      if (data?.type !== ADMIN_EMBED_AUTH_RESPONSE || !data.accessToken) return
      applySrc(data.accessToken)
    }

    const requestAuth = () => {
      topWin.postMessage({ type: ADMIN_EMBED_REQUEST_AUTH }, origin)
    }

    window.addEventListener('message', onAuthMessage)
    requestAuth()
    const retry = window.setInterval(requestAuth, 800)

    return () => {
      window.clearInterval(retry)
      window.removeEventListener('message', onAuthMessage)
    }
  }, [adminOrigin])

  useEffect(() => {
    const onRefresh = (event: MessageEvent) => {
      if (event.data?.type !== HR_EMBED_CAREERS_REFRESH) return
      iframeRef.current?.contentWindow?.postMessage(
        { type: HR_EMBED_CAREERS_REFRESH },
        adminOrigin,
      )
    }
    window.addEventListener('message', onRefresh)
    return () => window.removeEventListener('message', onRefresh)
  }, [adminOrigin])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as {
        type?: string
        jobPostingId?: string
        stage?: string
        applicationId?: string
      } | null
      if (!data || data.type !== HR_EMBED_OPEN_PIPELINE) return
      const jobId = typeof data.jobPostingId === 'string' ? data.jobPostingId.trim() : ''
      if (!jobId) return
      const stage = typeof data.stage === 'string' && data.stage.trim() ? data.stage.trim() : ''
      const applicationId =
        typeof data.applicationId === 'string' ? data.applicationId.trim() : ''
      const params = new URLSearchParams()
      if (stage) params.set('stage', stage)
      if (applicationId) params.set('applicationId', applicationId)
      const qs = params.toString()
      navigate(`/hr/recruitment/jobs/${jobId}${qs ? `?${qs}` : ''}`)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [navigate])

  if (!src) {
    return (
      <div className="flex h-[calc(100vh-15rem)] min-h-[28rem] items-center justify-center rounded-xl border border-border bg-white text-sm text-muted-foreground">
        Loading careers inbox…
      </div>
    )
  }

  return (
    <iframe
      ref={iframeRef}
      title="Careers inbox"
      src={src}
      className="h-[calc(100vh-15rem)] min-h-[28rem] w-full rounded-xl border border-border bg-white"
      allow="clipboard-read; clipboard-write"
    />
  )
}

function CommonMeetingUrlBar() {
  const { data: vendor } = useMyVendor()
  const updateVendor = useUpdateVendor()
  const saved = readRecruitmentCommonMeetingUrl(
    vendor?.settings as Record<string, unknown> | undefined,
  )
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(saved)

  useEffect(() => {
    if (!editing) setDraft(saved)
  }, [saved, editing])

  const save = async () => {
    const normalized = normalizeInterviewLink(draft)
    const existing = (vendor?.settings || {}) as Record<string, unknown>
    await updateVendor.mutateAsync({
      settings: {
        ...existing,
        [HR_RECRUITMENT_COMMON_MEETING_URL_KEY]: normalized || null,
      },
    } as Partial<import('@/types').Vendor>)
    setEditing(false)
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-1 lg:max-w-xl">
      <Label className="text-[11px] font-medium text-muted-foreground">Common meeting URL</Label>
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          readOnly={!editing}
          value={editing ? draft : saved}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="https://meet.google.com/abc-defg-hij"
          className={cn(
            hrInputClass,
            'min-w-[12rem] flex-1 text-sm',
            !editing && !saved && 'text-muted-foreground italic',
          )}
        />
        {editing ? (
          <>
            <Button
              type="button"
              size="sm"
              className="h-8"
              disabled={updateVendor.isPending}
              onClick={() => void save()}
            >
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              disabled={updateVendor.isPending}
              onClick={() => {
                setDraft(saved)
                setEditing(false)
              }}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 px-2"
              disabled={!saved}
              title="Copy meeting link"
              onClick={() => copyText(saved, 'Meeting link copied')}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 px-2"
              title="Edit meeting link"
              onClick={() => {
                setDraft(saved)
                setEditing(true)
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {saved && isHttpUrl(saved) ? (
              <a
                href={saved}
                target="_blank"
                rel="noopener noreferrer"
                title="Open meeting link"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

export default function RecruitmentPage() {
  const adminEmbed = isVendorAdminEmbed()
  const [tab, setTab] = useState<TabKey>('jobs')

  const tabs = useMemo(
    () =>
      adminEmbed
        ? [
            { k: 'jobs' as const, label: 'Jobs', icon: Briefcase },
            { k: 'careers' as const, label: 'Careers', icon: Users },
            { k: 'interviews' as const, label: 'Interviews', icon: Calendar },
          ]
        : [
            { k: 'jobs' as const, label: 'Jobs', icon: Briefcase },
            { k: 'candidates' as const, label: 'Candidates', icon: Users },
            { k: 'interviews' as const, label: 'Interviews', icon: Calendar },
          ],
    [adminEmbed],
  )

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recruitment</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {adminEmbed
              ? 'Manage jobs and interviews · Careers applications from the platform Careers page'
              : 'Manage Jobs, Candidates And Interviews'}
          </p>
        </div>
        <CommonMeetingUrlBar />
      </div>

      <div className="mb-5 flex gap-1 border-b border-border">
        {tabs.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={cn(
              '-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors focus:outline-none',
              tab === t.k ? hrTabActiveClass : hrTabInactiveClass,
            )}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'jobs' && <JobsTab />}
      {tab === 'candidates' && !adminEmbed && <CandidatesTab />}
      {tab === 'careers' && adminEmbed && <CareersInboxEmbed />}
      {tab === 'interviews' && <InterviewsTab />}
    </div>
  )
}

function JobsTab() {
  const [statusFilter, setStatusFilter] = useState<string>('')
  const { data: jobs = [], isLoading } = useHRJobs(statusFilter || undefined)
  const { data: depts = [] } = useHRDepartments()
  const { data: desigs = [] } = useHRDesignations()
  const deleteJob = useDeleteHRJob()
  const [editing, setEditing] = useState<JobPosting | null>(null)
  const [showNew, setShowNew] = useState(false)

  const deptName = (job: JobPosting) =>
    job.department?.name
    || (depts as HRDepartment[]).find((d) => d.id === job.department_id)?.name
    || null
  const desigName = (job: JobPosting) =>
    job.designation?.name
    || (desigs as HRDesignation[]).find((d) => d.id === job.designation_id)?.name
    || null

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          className={cn(hrSelectClass, 'w-auto')}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'draft', label: 'Draft' },
            { value: 'open', label: 'Open' },
            { value: 'on_hold', label: 'On Hold' },
            { value: 'closed', label: 'Closed' },
          ]}
        />
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
                const dept = deptName(job)
                const desig = desigName(job)
                return (
                  <tr key={job.id} className="border-b border-border hover:bg-muted/30">
                    <td className="py-3 px-4 min-w-[13rem] max-w-[18rem]">
                      <div className="flex flex-col gap-1.5">
                        <Link
                          to={`/hr/recruitment/jobs/${job.id}`}
                          className="text-sm font-semibold text-foreground hover:text-primary hover:underline underline-offset-2"
                        >
                          {job.title}
                        </Link>
                        <button
                          type="button"
                          title={`Copy full job ID\n${job.id}`}
                          onClick={() => {
                            void navigator.clipboard?.writeText(job.id).then(
                              () => toast.success('Job ID copied'),
                              () => toast.error('Could not copy job ID'),
                            )
                          }}
                          className="inline-flex h-6 w-fit items-center gap-1 rounded-md border border-border bg-muted/50 px-1.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
                        >
                          <span className="font-medium tracking-wide">ID</span>
                          <span className="font-mono font-semibold tracking-tight text-foreground/80">
                            {job.id.replace(/-/g, '').slice(0, 8).toUpperCase()}
                          </span>
                          <Copy className="h-3 w-3 opacity-60" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {dept || desig ? (
                        <>
                          {dept || '—'}
                          {desig ? <span className="text-muted-foreground/70"> · {desig}</span> : null}
                        </>
                      ) : (
                        '—'
                      )}
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

const PIPELINE_STAGE: Record<string, { label: string; color: string }> = {
  applied: { label: 'Applied', color: hrStatusBadge.draft },
  screening: { label: 'Screening', color: hrStatusBadge.scheduled },
  shortlisted: { label: 'Shortlisted', color: 'bg-violet-500/15 text-violet-700 dark:text-violet-300' },
  interviewing: { label: 'Interviewing', color: hrStatusBadge.on_hold },
  offer_made: { label: 'Offer Made', color: 'bg-teal-500/15 text-teal-700 dark:text-teal-300' },
  hired: { label: 'Hired', color: hrStatusBadge.completed },
  rejected: { label: 'Rejected', color: hrStatusBadge.failed },
  withdrawn: { label: 'Withdrawn', color: hrStatusBadge.cancelled },
}

const STAGE_RANK: Record<string, number> = {
  hired: 0,
  offer_made: 1,
  interviewing: 2,
  shortlisted: 3,
  screening: 4,
  applied: 5,
  rejected: 6,
  withdrawn: 7,
}

function primaryApplication(apps: JobApplication[]): JobApplication | null {
  if (!apps.length) return null
  return [...apps].sort((a, b) => {
    const ra = STAGE_RANK[a.current_stage] ?? 99
    const rb = STAGE_RANK[b.current_stage] ?? 99
    if (ra !== rb) return ra - rb
    return new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime()
  })[0]
}

function pipelineStatusLabel(app: JobApplication): { label: string; color: string } {
  const base = PIPELINE_STAGE[app.current_stage] ?? {
    label: app.current_stage.replace(/_/g, ' '),
    color: hrStatusBadge.draft,
  }
  if (app.current_stage === 'interviewing') {
    const rounds = app.interviews ?? []
    if (rounds.some(i => i.status === 'completed')) {
      return { label: 'Completed Interview', color: hrStatusBadge.completed }
    }
    if (rounds.some(i => i.status === 'scheduled')) {
      return { label: 'Interview Scheduled', color: hrStatusBadge.scheduled }
    }
  }
  return base
}

function AddCandidateToPipelineModal({
  candidate,
  onClose,
}: {
  candidate: Candidate
  onClose: () => void
}) {
  const { data: jobs = [] } = useHRJobs()
  const create = useCreateHRApplication()
  const [jobId, setJobId] = useState('')
  const alreadyOn = useMemo(
    () => new Set((candidate.applications ?? []).map(a => a.job_posting_id)),
    [candidate.applications],
  )
  const availableJobs = useMemo(
    () =>
      (jobs as JobPosting[])
        .filter(j => j.status === 'open' || j.status === 'draft')
        .filter(j => !alreadyOn.has(j.id)),
    [jobs, alreadyOn],
  )

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!jobId) return
    await create.mutateAsync({
      candidate_id: candidate.id,
      job_posting_id: jobId,
      current_stage: 'applied',
    })
    onClose()
  }

  return (
    <ModalOverlay onClose={onClose} className="z-[100] bg-black/60 p-3">
      <ModalPanel className="max-w-md !rounded-lg overflow-hidden">
        <ModalHeader title="Add to pipeline" onClose={onClose} className="border-0 px-4 py-2.5 [&>div>h2]:text-base" />
        <form onSubmit={submit} className="flex flex-col">
          <ModalBody className="space-y-3 px-4 pt-0 pb-1">
            <p className="text-sm text-muted-foreground">
              Add <span className="font-medium text-foreground">{candidate.full_name}</span> to a job pipeline.
            </p>
            <div>
              <Label className={denseLabelClass} required>Job</Label>
              <Select
                value={jobId}
                onChange={setJobId}
                className={denseFieldClass}
                placeholder="Select open job…"
                options={availableJobs.map(j => ({ value: j.id, label: j.title }))}
              />
              {availableJobs.length === 0 ? (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {alreadyOn.size > 0
                    ? 'Already on every available job pipeline.'
                    : 'No open jobs. Create a job first.'}
                </p>
              ) : null}
            </div>
          </ModalBody>
          <ModalFooter className="border-0 px-4 py-2.5">
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" className="h-8" disabled={!jobId || create.isPending}>
              {create.isPending ? 'Adding…' : 'Add to pipeline'}
            </Button>
          </ModalFooter>
        </form>
      </ModalPanel>
    </ModalOverlay>
  )
}

function CandidatesTab() {
  const [search, setSearch] = useState('')
  const { data: candidates = [], isLoading } = useHRCandidates(search || undefined)
  const deleteCand = useDeleteHRCandidate()
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState<Candidate | null>(null)
  const [pipelineFor, setPipelineFor] = useState<Candidate | null>(null)

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
                {['Name', 'Contact', 'Current Role', 'Experience', 'CTC (Cur / Exp)', 'Source', 'Status', 'Actions'].map(h =>
                  <th key={h} className="text-left py-3 px-4 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(candidates as Candidate[]).map(c => {
                const apps = c.applications ?? []
                const primary = primaryApplication(apps)
                const status = primary ? pipelineStatusLabel(primary) : null
                return (
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
                      {status && primary ? (
                        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize', status.color)}>
                          {status.label}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPipelineFor(c)}
                          className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/40 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                        >
                          <Plus className="h-3 w-3" /> Add to pipeline
                        </button>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditing(c)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => { if (await askConfirm('Delete candidate?')) deleteCand.mutate(c.id) }}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Delete"
                        >
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

      {showNew && <CandidateModal onClose={() => setShowNew(false)} />}
      {editing && <CandidateModal existing={editing} onClose={() => setEditing(null)} />}
      {pipelineFor && (
        <AddCandidateToPipelineModal candidate={pipelineFor} onClose={() => setPipelineFor(null)} />
      )}
    </div>
  )
}

function InterviewsTab() {
  const [upcoming, setUpcoming] = useState(true)
  const { data: interviews = [], isLoading } = useHRInterviews(upcoming)
  const updateIv = useUpdateHRInterview()
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null)
  const [linkDraft, setLinkDraft] = useState('')

  const startEditLink = (iv: InterviewRound) => {
    setEditingLinkId(iv.id)
    setLinkDraft(iv.location_or_link || '')
  }

  const saveLink = async (iv: InterviewRound) => {
    const next = normalizeInterviewLink(linkDraft)
    await updateIv.mutateAsync({ id: iv.id, data: { location_or_link: next || null } })
    setEditingLinkId(null)
    setLinkDraft('')
  }

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
                {['When', 'Round', 'Candidate', 'Job', 'Mode', 'Interview link', 'Status', 'Result', 'Actions'].map(h =>
                  <th key={h} className="text-left py-3 px-4 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(interviews as InterviewRound[]).map(iv => {
                const cfg = INTV_STATUS[iv.status] ?? INTV_STATUS.scheduled
                const app = iv.application
                const job = app?.job_posting
                const meetLink = normalizeInterviewLink(iv.location_or_link || '')
                const editing = editingLinkId === iv.id
                return (
                  <tr key={iv.id} className="border-b border-border hover:bg-muted/30">
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {formatInterviewWhen(iv.scheduled_at)}
                      {iv.duration_min ? <p className="text-xs text-muted-foreground">{iv.duration_min} min</p> : null}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <p className="font-medium text-foreground">R{iv.round_number}</p>
                      <p className="text-xs text-muted-foreground">{iv.round_name ?? ''}</p>
                    </td>
                    <td className="py-3 px-4 text-sm text-foreground">{app?.candidate?.full_name ?? '—'}</td>
                    <td className="py-3 px-4 text-sm">
                      {job ? (
                        <Link
                          to={`/hr/recruitment/jobs/${job.id}`}
                          className="font-medium text-foreground hover:text-primary hover:underline underline-offset-2"
                        >
                          {job.title}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs capitalize text-muted-foreground">{iv.mode ?? '—'}</td>
                    <td className="py-3 px-4 min-w-[14rem] max-w-[18rem]">
                      {editing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            value={linkDraft}
                            onChange={(e) => setLinkDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                void saveLink(iv)
                              }
                              if (e.key === 'Escape') {
                                setEditingLinkId(null)
                                setLinkDraft('')
                              }
                            }}
                            placeholder="https://meet.google.com/…"
                            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs"
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 px-2"
                            disabled={updateIv.isPending}
                            onClick={() => void saveLink(iv)}
                          >
                            Save
                          </Button>
                        </div>
                      ) : meetLink ? (
                        <div className="flex items-center gap-1 min-w-0">
                          {isHttpUrl(meetLink) ? (
                            <a
                              href={meetLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-w-0 truncate text-xs font-medium text-primary hover:underline"
                              title={meetLink}
                            >
                              {meetLink.replace(/^https?:\/\//, '')}
                            </a>
                          ) : (
                            <span className="min-w-0 truncate text-xs text-muted-foreground" title={meetLink}>
                              {meetLink}
                            </span>
                          )}
                          <button
                            type="button"
                            title="Copy interview link"
                            onClick={() => copyText(meetLink, 'Interview link copied')}
                            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          {isHttpUrl(meetLink) ? (
                            <a
                              href={meetLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open interview link"
                              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : null}
                          <button
                            type="button"
                            title="Edit interview link"
                            onClick={() => startEditLink(iv)}
                            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditLink(iv)}
                          className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:border-primary/40 hover:text-primary"
                        >
                          <Plus className="h-3 w-3" />
                          Add link
                        </button>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {iv.recommendation ? `${iv.recommendation}${iv.rating ? ` (${iv.rating}/5)` : ''}` : '—'}
                    </td>
                    <td className="py-3 px-4">
                      {iv.status === 'scheduled' && (
                        <Select
                          value=""
                          onChange={v => updateIv.mutate({ id: iv.id, data: { status: v } })}
                          placeholder="Mark…"
                          className={cn(hrSelectClass, 'h-8 w-auto px-2 text-xs')}
                          options={[
                            { value: 'completed', label: 'Completed' },
                            { value: 'no_show', label: 'No Show' },
                            { value: 'cancelled', label: 'Cancel' },
                            { value: 'rescheduled', label: 'Reschedule' },
                          ]}
                        />
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
