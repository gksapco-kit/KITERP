import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Briefcase,
  Building2,
  FileText,
  Globe,
  Image as ImageIcon,
  Linkedin,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  StickyNote,
  Tags,
  UserRound,
  GitBranch,
} from 'lucide-react'
import { toast } from 'sonner'
import { adminApi, type CareerApplicationItem } from '@/api/admin.api'
import {
  AttachmentPreviewModal,
  type AttachmentPreview,
} from '@/components/common/AttachmentPreviewModal'
import { askConfirm } from '@/components/common/ConfirmProvider'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { useAuthStore } from '@/stores/authStore'
import { isPlatformStaff, isSuperuserAdmin } from '@/lib/platformAccess'
import { cn, mediaUrl } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

const fieldClass =
  'h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring'

type CareerDetailsForm = {
  full_name: string
  email: string
  phone: string
  city: string
  company: string
  current_role: string
  experience_years: string
  position_title: string
  linkedin_url: string
  skills: string
  portfolio: string
  cover_note: string
  status: string
}

function parseCoverNote(coverNote?: string | null): {
  note: string
  portfolio: string
  skills: string
} {
  let raw = (coverNote || '').trim()
  if (!raw) return { note: '', portfolio: '', skills: '' }

  let skills = ''
  let portfolio = ''

  const skillsMatch = raw.match(/Skills:\s*([^\n]+)/i)
  if (skillsMatch) {
    skills = skillsMatch[1].trim()
    raw = raw.replace(skillsMatch[0], '').trim()
  }

  const portfolioMatch = raw.match(/Portfolio:\s*([^\n]+)/i)
  if (portfolioMatch) {
    portfolio = portfolioMatch[1].trim().replace(/[),.;]+$/g, '')
    raw = raw.replace(portfolioMatch[0], '').trim()
  }

  raw = raw.replace(/\n{3,}/g, '\n\n').trim()
  return { note: raw, portfolio, skills }
}

function buildCoverNote(form: Pick<CareerDetailsForm, 'skills' | 'portfolio' | 'cover_note'>): string | null {
  const parts: string[] = []
  if (form.skills.trim()) parts.push(`Skills: ${form.skills.trim()}`)
  if (form.portfolio.trim()) {
    let url = form.portfolio.trim()
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`
    parts.push(`Portfolio: ${url}`)
  }
  if (form.cover_note.trim()) parts.push(form.cover_note.trim())
  return parts.length ? parts.join('\n\n') : null
}

const HR_EMBED_OPEN_PIPELINE = 'kiterp:hr:open-pipeline'

function careerStatusToPipelineStage(status: string): string | undefined {
  if (status === 'rejected') return 'rejected'
  if (status === 'shortlisted') return 'shortlisted'
  if (status === 'reviewed') return 'screening'
  if (status === 'new') return 'applied'
  return undefined
}

function openJobPipeline(
  app: CareerApplicationItem,
  embedded: boolean,
  syncPipeline: (id: string, status: string) => Promise<{
    job_posting_id: string
    current_stage: string
    application_id: string
  }>,
) {
  const run = async () => {
    try {
      const synced = await syncPipeline(app.id, app.status)
      const jobId = synced.job_posting_id?.trim() || app.job_posting_id?.trim()
      if (!jobId) {
        toast.error('No job linked to this application')
        return
      }
      const stage = synced.current_stage || careerStatusToPipelineStage(app.status)
      if (embedded) {
        // Parent admin (HrManagement overlay) or nested vendor frame listens for this.
        window.postMessage(
          {
            type: HR_EMBED_OPEN_PIPELINE,
            jobPostingId: jobId,
            stage,
            applicationId: synced.application_id,
          },
          '*',
        )
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(
            {
              type: HR_EMBED_OPEN_PIPELINE,
              jobPostingId: jobId,
              stage,
              applicationId: synced.application_id,
            },
            '*',
          )
        }
        return
      }
      toast.success('Synced to job pipeline')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Could not sync to pipeline')
    }
  }
  void run()
}

function pipelineButtonTitle(app: CareerApplicationItem): string {
  if (app.status === 'rejected') {
    if (!app.job_posting_id && !app.position_title) {
      return 'Open job pipeline · Rejected stage (will try to find linked job)'
    }
    return 'Open job pipeline · Rejected stage'
  }
  if (!app.job_posting_id && !app.position_title) {
    return 'No job linked to this application'
  }
  return 'Open job pipeline'
}

function canOpenPipeline(app: CareerApplicationItem): boolean {
  if (app.status === 'rejected') return true
  return Boolean(app.job_posting_id || app.position_title)
}

function toDetailsForm(app: CareerApplicationItem): CareerDetailsForm {
  const parsed = parseCoverNote(app.cover_note)
  return {
    full_name: app.full_name || '',
    email: app.email || '',
    phone: app.phone || '',
    city: app.city || '',
    company: app.company || '',
    current_role: app.current_role || '',
    experience_years: app.experience_years != null ? String(app.experience_years) : '',
    position_title: app.position_title || '',
    linkedin_url: app.linkedin_url || '',
    skills: parsed.skills,
    portfolio: parsed.portfolio,
    cover_note: parsed.note,
    status: app.status || 'new',
  }
}

const STATUSES = ['', 'new', 'reviewed', 'shortlisted', 'rejected'] as const

const STATUS_STYLE: Record<string, string> = {
  new: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  reviewed: 'bg-blue-50 text-blue-800 border-blue-200',
  shortlisted: 'bg-violet-50 text-violet-800 border-violet-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
}

const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  reviewed: 'Reviewed',
  shortlisted: 'Shortlisted',
  rejected: 'Rejected',
}

const EDIT_STATUSES = ['new', 'reviewed', 'shortlisted', 'rejected'] as const

function isWordCv(filename?: string | null, url = '') {
  return /\.docx?(\?|#|$)/i.test(`${filename || ''} ${url}`)
}

function isPdfCv(filename?: string | null, url = '') {
  return /\.pdf(\?|#|$)/i.test(`${filename || ''} ${url}`)
}

function downloadFile(url: string, filename?: string | null) {
  const name = (filename || 'document').replace(/[/\\?%*:|"<>]/g, '-').trim() || 'document'
  const href = mediaUrl(url)
  const a = document.createElement('a')
  a.href = href
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  toast.success(`Download started: ${name}`)
}

function MetaChip({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1 text-[11px] text-gray-600">
      <Icon className="h-3 w-3 shrink-0 text-gray-400" />
      <span className="truncate">{children}</span>
    </span>
  )
}

/** Parsed cover note fields for list display. */
function splitCoverNote(coverNote?: string | null): {
  note: string
  portfolioUrl: string | null
  skills: string
} {
  const parsed = parseCoverNote(coverNote)
  const portfolioUrl = parsed.portfolio
    ? /^https?:\/\//i.test(parsed.portfolio)
      ? parsed.portfolio
      : `https://${parsed.portfolio}`
    : null
  return { note: parsed.note, portfolioUrl, skills: parsed.skills }
}

function CareerNoteModal({
  open,
  name,
  initialNote,
  busy,
  onClose,
  onSave,
}: {
  open: boolean
  name: string
  initialNote: string
  busy: boolean
  onClose: () => void
  onSave: (note: string) => void
}) {
  const [draft, setDraft] = useState(initialNote)

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      data-kiterp-modal
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-foreground">Note for {name}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Internal note visible only to platform staff reviewing this application.
        </p>
        <textarea
          autoFocus
          rows={5}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add interview feedback, follow-up reminders, etc."
          className="mt-3 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => onSave(draft.trim())}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save note'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function CareerDetailsEditModal({
  open,
  initial,
  busy,
  onClose,
  onSave,
}: {
  open: boolean
  initial: CareerDetailsForm
  busy: boolean
  onClose: () => void
  onSave: (form: CareerDetailsForm) => void
}) {
  const [draft, setDraft] = useState(initial)

  if (!open || typeof document === 'undefined') return null

  const set = <K extends keyof CareerDetailsForm>(key: K, value: CareerDetailsForm[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      data-kiterp-modal
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-foreground">Edit candidate details</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Update contact and profile information for this application.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="text-xs">Status</Label>
            <select
              value={draft.status}
              onChange={(e) => set('status', e.target.value)}
              className={fieldClass}
            >
              {EDIT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status] ?? status}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Full name</Label>
            <input
              required
              value={draft.full_name}
              onChange={(e) => set('full_name', e.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <input
              required
              type="email"
              value={draft.email}
              onChange={(e) => set('email', e.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <Label className="text-xs">Phone</Label>
            <PhoneInput
              value={draft.phone}
              onChange={(phone) => set('phone', phone)}
              defaultCountryIso="IN"
              autoComplete="tel"
              name="phone"
              compact
            />
          </div>
          <div>
            <Label className="text-xs">City</Label>
            <input value={draft.city} onChange={(e) => set('city', e.target.value)} className={fieldClass} />
          </div>
          <div>
            <Label className="text-xs">Company</Label>
            <input
              value={draft.company}
              onChange={(e) => set('company', e.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <Label className="text-xs">Current role</Label>
            <input
              value={draft.current_role}
              onChange={(e) => set('current_role', e.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <Label className="text-xs">Experience (years)</Label>
            <input
              type="number"
              min={0}
              max={80}
              value={draft.experience_years}
              onChange={(e) => set('experience_years', e.target.value)}
              className={fieldClass}
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Applied position</Label>
            <input
              value={draft.position_title}
              onChange={(e) => set('position_title', e.target.value)}
              className={fieldClass}
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">LinkedIn URL</Label>
            <input
              value={draft.linkedin_url}
              onChange={(e) => set('linkedin_url', e.target.value)}
              className={fieldClass}
              placeholder="https://linkedin.com/in/..."
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Skills</Label>
            <input
              value={draft.skills}
              onChange={(e) => set('skills', e.target.value)}
              className={fieldClass}
              placeholder="e.g. Java, AWS, React"
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Portfolio URL</Label>
            <input
              value={draft.portfolio}
              onChange={(e) => set('portfolio', e.target.value)}
              className={fieldClass}
              placeholder="https://your-portfolio.com"
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Cover message</Label>
            <textarea
              rows={3}
              value={draft.cover_note}
              onChange={(e) => set('cover_note', e.target.value)}
              placeholder="Additional message from the applicant"
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy || !draft.full_name.trim() || !draft.email.trim()}
            onClick={() => onSave(draft)}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function CareerApplications({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [preview, setPreview] = useState<AttachmentPreview | null>(null)
  const [noteEditor, setNoteEditor] = useState<{ id: string; name: string; note: string } | null>(null)
  const [detailsEditor, setDetailsEditor] = useState<{ id: string; form: CareerDetailsForm } | null>(null)
  const allowed = isPlatformStaff(user)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-career-applications', statusFilter],
    queryFn: () => adminApi.listCareerApplications({ status: statusFilter || undefined, size: 50 }),
    enabled: allowed,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (!embedded) return
    const onRefresh = (event: MessageEvent) => {
      if (event.data?.type !== 'kiterp:hr:careers-refresh') return
      void qc.invalidateQueries({ queryKey: ['admin-career-applications'] })
    }
    window.addEventListener('message', onRefresh)
    return () => window.removeEventListener('message', onRefresh)
  }, [embedded, qc])

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminApi.updateCareerApplication(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-career-applications'] }),
  })

  const noteMut = useMutation({
    mutationFn: ({ id, admin_note }: { id: string; admin_note: string | null }) =>
      adminApi.updateCareerApplication(id, { admin_note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-career-applications'] })
      setNoteEditor(null)
      toast.success('Note saved')
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Could not save note')
    },
  })

  const detailsMut = useMutation({
    mutationFn: ({ id, form }: { id: string; form: CareerDetailsForm }) =>
      adminApi.updateCareerApplication(id, {
        status: form.status,
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        city: form.city.trim() || null,
        company: form.company.trim() || null,
        current_role: form.current_role.trim() || null,
        experience_years: form.experience_years.trim() ? Number(form.experience_years) : null,
        position_title: form.position_title.trim() || null,
        linkedin_url: form.linkedin_url.trim() || null,
        cover_note: buildCoverNote(form),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-career-applications'] })
      setDetailsEditor(null)
      toast.success('Candidate details updated')
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Could not update details')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteCareerApplication(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-career-applications'] }),
  })

  const syncPipelineMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminApi.syncCareerApplicationToPipeline(id, status),
  })

  const handleDelete = async (id: string, name: string) => {
    if (
      !(await askConfirm({
        title: `Delete application from ${name}?`,
        description: 'This permanently removes the application, CV, and photo.',
        confirmLabel: 'Delete',
        variant: 'danger',
      }))
    ) {
      return
    }
    deleteMut.mutate(id)
  }

  if (!allowed) {
    return <Navigate to="/dashboard" replace />
  }

  const items = data?.items ?? []
  const busy = updateMut.isPending || deleteMut.isPending || noteMut.isPending || detailsMut.isPending || syncPipelineMut.isPending

  return (
    <div className={cn('w-full max-w-none space-y-2.5', embedded && 'space-y-2')}>
      <div className={cn('flex flex-wrap items-end justify-between gap-2', embedded && 'items-center')}>
        {!embedded ? (
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
              <Briefcase className="h-5 w-5 text-primary" />
              Careers
            </h1>
            <p className="mt-0.5 text-xs text-gray-500">
              Applications from the KIT ERP Careers page · Open roles from HR Recruitment
            </p>
          </div>
        ) : null}
        <div className={cn('flex flex-wrap gap-1.5', embedded && 'ml-auto')}>
          {STATUSES.map((s) => (
            <button
              key={s || 'all'}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize',
                statusFilter === s
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
              )}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-7 w-7 animate-spin text-gray-300" />
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-500">
          No career applications yet.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map((app) => {
            const { note: coverNoteText, portfolioUrl, skills } = splitCoverNote(app.cover_note)
            return (
            <article
              key={app.id}
              className="rounded-md border border-gray-200 bg-white px-2.5 py-2 shadow-sm"
            >
              <div className="flex items-start gap-2">
                {app.photo_url ? (
                  <button
                    type="button"
                    onClick={() =>
                      setPreview({
                        url: app.photo_url!,
                        filename: app.photo_filename || 'Photo',
                        kind: 'image',
                        applicationId: app.id,
                        attachment: 'photo',
                      })
                    }
                    className="h-11 w-11 shrink-0 overflow-hidden rounded border border-gray-200 bg-white"
                    title="View photo"
                  >
                    <img
                      src={mediaUrl(app.photo_url)}
                      alt={app.full_name}
                      className="h-full w-full object-cover object-center"
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-dashed border-gray-200 bg-gray-50 text-[11px] font-semibold text-gray-400">
                    {app.full_name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((p) => p[0]?.toUpperCase() ?? '')
                      .join('') || '?'}
                  </div>
                )}

                <div className="min-w-0 flex-1 space-y-1">
                  {/* Row 1: name + CV/Photo + actions */}
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                      <h2 className="truncate text-[13px] font-semibold text-gray-900">{app.full_name}</h2>
                      <span
                        className={cn(
                          'shrink-0 rounded border px-1.5 py-px text-[10px] font-semibold capitalize',
                          STATUS_STYLE[app.status] ?? 'bg-gray-50 text-gray-700 border-gray-200',
                        )}
                      >
                        {app.status}
                      </span>
                      {app.position_title ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                          <Briefcase className="h-3 w-3" />
                          {app.position_title}
                        </span>
                      ) : null}
                      {app.experience_years != null ? (
                        <span className="text-[11px] text-gray-500">{app.experience_years} yrs</span>
                      ) : null}
                      <span className="text-[11px] text-gray-400">
                        {app.created_at ? new Date(app.created_at).toLocaleString() : '—'}
                      </span>
                      {app.cv_url ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (isWordCv(app.cv_filename, app.cv_url)) {
                              downloadFile(app.cv_url, app.cv_filename || 'CV.doc')
                              return
                            }
                            if (isPdfCv(app.cv_filename, app.cv_url)) {
                              setPreview({
                                url: app.cv_url,
                                filename: app.cv_filename || 'CV.pdf',
                                kind: 'pdf',
                                applicationId: app.id,
                                attachment: 'cv',
                              })
                              return
                            }
                            downloadFile(app.cv_url, app.cv_filename || 'CV')
                          }}
                          className="inline-flex max-w-[12rem] items-center gap-1 truncate text-[11px] font-medium text-primary hover:underline"
                          title={
                            isWordCv(app.cv_filename, app.cv_url)
                              ? 'Download Word document'
                              : isPdfCv(app.cv_filename, app.cv_url)
                                ? 'Preview PDF'
                                : 'Download file'
                          }
                        >
                          <FileText className="h-3 w-3 shrink-0" />
                          <span className="truncate">{app.cv_filename || 'View CV'}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-gray-400">No CV</span>
                      )}
                      {app.photo_url ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPreview({
                              url: app.photo_url!,
                              filename: app.photo_filename || 'Photo',
                              kind: 'image',
                              applicationId: app.id,
                              attachment: 'photo',
                            })
                          }
                          className="inline-flex max-w-[10rem] items-center gap-1 truncate text-[11px] font-medium text-primary hover:underline"
                        >
                          <ImageIcon className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            Photo{app.photo_filename ? ` · ${app.photo_filename}` : ''}
                          </span>
                        </button>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-1.5 text-[10px]"
                        disabled={busy || !canOpenPipeline(app)}
                        title={pipelineButtonTitle(app)}
                        onClick={() =>
                          openJobPipeline(app, embedded, (id, status) =>
                            syncPipelineMut.mutateAsync({ id, status }),
                          )
                        }
                      >
                        <GitBranch className="mr-0.5 h-3 w-3" />
                        Pipeline
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-1.5 text-[10px]"
                        disabled={busy}
                        onClick={() =>
                          setDetailsEditor({ id: app.id, form: toDetailsForm(app) })
                        }
                      >
                        <Pencil className="mr-0.5 h-3 w-3" />
                        Edit
                      </Button>
                      {(app.status === 'shortlisted' || app.status === 'rejected') ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-1.5 text-[10px]"
                          disabled={busy}
                          onClick={() =>
                            setNoteEditor({
                              id: app.id,
                              name: app.full_name,
                              note: app.admin_note || '',
                            })
                          }
                        >
                          <StickyNote className="mr-0.5 h-3 w-3" />
                          {app.admin_note ? 'Edit note' : 'Add note'}
                        </Button>
                      ) : null}
                    {isSuperuserAdmin(user) ? (
                      <>
                        {app.status !== 'rejected' ? (
                          <>
                            {app.status === 'new' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-1.5 text-[10px]"
                                disabled={busy}
                                onClick={() => updateMut.mutate({ id: app.id, status: 'reviewed' })}
                              >
                                Reviewed
                              </Button>
                            ) : null}
                            {(app.status === 'new' || app.status === 'reviewed') ? (
                              <Button
                                size="sm"
                                className="h-6 px-1.5 text-[10px]"
                                disabled={busy}
                                onClick={() => updateMut.mutate({ id: app.id, status: 'shortlisted' })}
                              >
                                Shortlist
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-1.5 text-[10px]"
                              disabled={busy}
                              onClick={() => updateMut.mutate({ id: app.id, status: 'rejected' })}
                            >
                              Reject
                            </Button>
                          </>
                        ) : null}
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-6 px-1.5 text-[10px]"
                          disabled={busy}
                          onClick={() => handleDelete(app.id, app.full_name)}
                        >
                          Delete
                        </Button>
                      </>
                    ) : null}
                    </div>
                  </div>

                  {/* Row 2: contact + notes */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    {app.email ? (
                      <MetaChip icon={Mail}>
                        <a href={`mailto:${app.email}`} className="hover:underline">
                          {app.email}
                        </a>
                      </MetaChip>
                    ) : null}
                    {app.phone ? (
                      <MetaChip icon={Phone}>
                        <a href={`tel:${app.phone}`} className="hover:underline">
                          {app.phone}
                        </a>
                      </MetaChip>
                    ) : null}
                    {app.city ? <MetaChip icon={MapPin}>{app.city}</MetaChip> : null}
                    {app.company ? <MetaChip icon={Building2}>{app.company}</MetaChip> : null}
                    {app.current_role ? <MetaChip icon={UserRound}>{app.current_role}</MetaChip> : null}
                    {app.linkedin_url ? (
                      <MetaChip icon={Linkedin}>
                        <a
                          href={app.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          LinkedIn
                        </a>
                      </MetaChip>
                    ) : null}
                    {portfolioUrl ? (
                      <MetaChip icon={Globe}>
                        <a
                          href={portfolioUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                          title={portfolioUrl}
                        >
                          Portfolio
                        </a>
                      </MetaChip>
                    ) : null}
                    {skills ? (
                      <MetaChip icon={Tags}>
                        <span title={skills}>{skills}</span>
                      </MetaChip>
                    ) : null}
                    {coverNoteText ? (
                      <span className="min-w-0 max-w-full truncate text-[11px] text-gray-600">
                        {coverNoteText}
                      </span>
                    ) : null}
                  </div>

                  {app.admin_note ? (
                    <div className="rounded border border-amber-200 bg-amber-50/80 px-2 py-1 text-[11px] text-amber-950">
                      <span className="font-medium">Note: </span>
                      <span className="whitespace-pre-wrap break-words">{app.admin_note}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
            )
          })}
        </div>
      )}

      <AttachmentPreviewModal
        open={!!preview}
        attachment={preview}
        onClose={() => setPreview(null)}
      />

      <CareerNoteModal
        key={noteEditor?.id ?? 'closed'}
        open={!!noteEditor}
        name={noteEditor?.name ?? ''}
        initialNote={noteEditor?.note ?? ''}
        busy={noteMut.isPending}
        onClose={() => setNoteEditor(null)}
        onSave={(note) => {
          if (!noteEditor) return
          noteMut.mutate({ id: noteEditor.id, admin_note: note || null })
        }}
      />

      <CareerDetailsEditModal
        key={detailsEditor?.id ?? 'closed'}
        open={!!detailsEditor}
        initial={detailsEditor?.form ?? toDetailsForm({ id: '', full_name: '', email: '', status: 'new', cv_url: '', created_at: null })}
        busy={detailsMut.isPending}
        onClose={() => setDetailsEditor(null)}
        onSave={(form) => {
          if (!detailsEditor) return
          detailsMut.mutate({ id: detailsEditor.id, form })
        }}
      />
    </div>
  )
}
