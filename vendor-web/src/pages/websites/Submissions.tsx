import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft, Mail, Calendar, Trash2, Loader2, Inbox,
  ChevronDown, ChevronRight, Filter, RefreshCw, ExternalLink, User,
} from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useFormSubmissions, useDeleteFormSubmission, useSite } from '@/hooks/useWebsites'
import type { FormSubmission } from '@/types/websites'

import { askConfirm } from '@/components/common/ConfirmProvider'
const FORM_TYPE_LABELS: Record<string, string> = {
  contact: 'Contact Form',
  newsletter: 'Newsletter',
  booking: 'Booking Request',
  lead: 'Lead Capture',
  checkout: 'Checkout Inquiry',
}

function SubmissionRow({ sub, onDelete, isDeleting }: {
  sub: FormSubmission
  onDelete: (id: string) => void
  isDeleting: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const payload = sub.payload || {}
  const name = (payload.name as string) || (payload.full_name as string) || 'Anonymous'
  const email = (payload.email as string) || ''
  const message = (payload.message as string) || ''
  const formLabel = FORM_TYPE_LABELS[sub.form_type] || sub.form_type

  const otherFields = Object.entries(payload).filter(
    ([k]) => !['name', 'full_name', 'email', 'message', 'gdpr_consent', 'has_file_upload'].includes(k)
  )

  return (
    <div className={cn('border border-gray-200 rounded-xl overflow-hidden transition-all', expanded ? 'shadow-md' : 'hover:shadow-sm')}>
      <div
        className="flex items-center gap-3 p-4 cursor-pointer bg-white hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-primary" />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">{name}</span>
            {email && <span className="text-xs text-gray-400">{email}</span>}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className={cn(
              'text-xs font-bold px-2 py-0.5 rounded-full',
              sub.form_type === 'contact' ? 'bg-blue-100 text-blue-700' :
              sub.form_type === 'newsletter' ? 'bg-emerald-100 text-emerald-700' :
              sub.form_type === 'booking' ? 'bg-amber-100 text-amber-700' :
              'bg-gray-100 text-gray-600'
            )}>
              {formLabel}
            </span>
            {message && (
              <span className="text-xs text-gray-500 truncate max-w-[300px]">{message}</span>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 shrink-0">
          {sub.crm_lead_id && (
            <span className="text-xs bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
              CRM Lead
            </span>
          )}
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {sub.created_at ? format(new Date(sub.created_at), 'MMM d, HH:mm') : '—'}
          </span>
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries({
              Name: name,
              Email: email,
              ...(payload.phone ? { Phone: payload.phone as string } : {}),
              ...(payload.message ? { Message: message } : {}),
              ...Object.fromEntries(otherFields.map(([k, v]) => [k.replace(/_/g, ' '), String(v)])),
            }).map(([label, value]) => (
              <div key={label} className={cn(label === 'Message' ? 'sm:col-span-2' : '')}>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{value || '—'}</p>
              </div>
            ))}
          </div>

          {/* Booking detail if present */}
          {!!(payload.booking && typeof payload.booking === 'object') && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-bold text-amber-700 mb-1">Booking Request</p>
              <p className="text-sm text-amber-800">
                {(payload.booking as any).date} at {(payload.booking as any).time}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between pt-1 border-t border-gray-200">
            <div className="flex items-center gap-3 text-xs text-gray-400">
              {sub.gdpr_consent && <span className="text-emerald-600 font-medium">✓ GDPR Consent</span>}
              {sub.crm_lead_id && (
                <a
                  href={`/crm/leads`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  View CRM Lead <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <button
              onClick={e => { e.stopPropagation(); onDelete(sub.id) }}
              disabled={isDeleting}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
            >
              {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function WebsiteSubmissions() {
  const { siteId } = useParams<{ siteId: string }>()
  const navigate = useNavigate()
  const [formType, setFormType] = useState<string>('')
  const [page, setPage] = useState(0)
  const limit = 20

  const { data: site } = useSite(siteId || null)
  const { data, isLoading, refetch } = useFormSubmissions(siteId!, {
    form_type: formType || undefined,
    limit,
    offset: page * limit,
  })
  const deleteSubmission = useDeleteFormSubmission(siteId!)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const submissions: FormSubmission[] = data?.submissions || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / limit)

  const handleDelete = async (id: string) => {
    if (!await askConfirm('Delete this submission? This action cannot be undone.')) return
    setDeletingId(id)
    try {
      await deleteSubmission.mutateAsync(id)
      toast.success('Submission deleted')
    } catch {
      toast.error('Failed to delete')
    }
    setDeletingId(null)
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/websites/${siteId}`)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Builder
        </button>
        <div className="w-px h-4 bg-gray-300" />
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" /> Form Submissions
          </h1>
          {site && <p className="text-sm text-gray-500">{site.name}</p>}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={formType}
            onChange={e => { setFormType(e.target.value); setPage(0) }}
            className="text-sm text-gray-700 bg-transparent focus:outline-none pr-2"
          >
            <option value="">All form types</option>
            {Object.entries(FORM_TYPE_LABELS).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </div>
        <div className="text-sm text-gray-500">{total} submission{total !== 1 ? 's' : ''}</div>
        <button
          onClick={() => refetch()}
          className="ml-auto flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-primary/80" />
        </div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No submissions yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Contact forms, booking requests, and newsletter sign-ups from your website will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map(sub => (
            <SubmissionRow
              key={sub.id}
              sub={sub}
              onDelete={handleDelete}
              isDeleting={deletingId === sub.id}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-500">Page {page + 1} of {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
