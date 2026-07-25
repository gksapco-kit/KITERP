import { useState } from 'react'
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
  Phone,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { adminApi } from '@/api/admin.api'
import {
  AttachmentPreviewModal,
  type AttachmentPreview,
} from '@/components/common/AttachmentPreviewModal'
import { askConfirm } from '@/components/common/ConfirmProvider'
import { useAuthStore } from '@/stores/authStore'
import { isPlatformStaff, isSuperuserAdmin } from '@/lib/platformAccess'
import { cn, mediaUrl } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const STATUSES = ['', 'new', 'reviewed', 'shortlisted', 'rejected'] as const

const STATUS_STYLE: Record<string, string> = {
  new: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  reviewed: 'bg-blue-50 text-blue-800 border-blue-200',
  shortlisted: 'bg-violet-50 text-violet-800 border-violet-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
}

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

/** Pull "Portfolio: https://..." out of cover_note so it can render like the LinkedIn chip. */
function splitCoverNote(coverNote?: string | null): { note: string; portfolioUrl: string | null } {
  const raw = (coverNote || '').trim()
  if (!raw) return { note: '', portfolioUrl: null }

  const match = raw.match(/Portfolio:\s*(https?:\/\/\S+)/i)
  if (!match) return { note: raw, portfolioUrl: null }

  const portfolioUrl = match[1].replace(/[),.;]+$/g, '')
  const note = raw
    .replace(match[0], ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return { note, portfolioUrl }
}

export default function CareerApplications() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [preview, setPreview] = useState<AttachmentPreview | null>(null)
  const allowed = isPlatformStaff(user)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-career-applications', statusFilter],
    queryFn: () => adminApi.listCareerApplications({ status: statusFilter || undefined, size: 50 }),
    enabled: allowed,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminApi.updateCareerApplication(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-career-applications'] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteCareerApplication(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-career-applications'] }),
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
  const busy = updateMut.isPending || deleteMut.isPending

  return (
    <div className="w-full max-w-none space-y-2.5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <Briefcase className="h-5 w-5 text-primary" />
            Careers
          </h1>
          <p className="mt-0.5 text-xs text-gray-500">
            Applications from the KIT ERP Careers page · Open roles from HR Recruitment
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
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
            const { note: coverNoteText, portfolioUrl } = splitCoverNote(app.cover_note)
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

                    {isSuperuserAdmin(user) ? (
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
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
                      </div>
                    ) : null}
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
                    {coverNoteText ? (
                      <span className="min-w-0 max-w-full truncate text-[11px] text-gray-600">
                        {coverNoteText}
                      </span>
                    ) : null}
                  </div>
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
    </div>
  )
}
