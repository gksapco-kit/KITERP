import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useConversations, useConversation, usePostChatMessage } from '@/hooks/useCrm'
import { crmApi } from '@/api/crm'
import { apiClient } from '@/api/client'
import {
  Send, Loader2, MessageSquare, CheckCircle2, User,
  Calendar, ChevronDown, ChevronRight, ExternalLink, Trash2,
  Globe, Filter, RefreshCw, Inbox as InboxIcon,
} from 'lucide-react'
import { format } from 'date-fns'
import { formatDateTime } from '@/lib/utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────────────────
export type FormSubmission = {
  id: string
  site_id: string
  form_type: string
  payload: Record<string, unknown>
  crm_lead_id?: string | null
  gdpr_consent?: boolean
  created_at: string
}

type SiteRecord = { id: string; name: string }

// ── Constants ─────────────────────────────────────────────────────────────────
const FORM_TYPE_LABELS: Record<string, string> = {
  contact: 'Contact',
  newsletter: 'Newsletter',
  booking: 'Booking',
  quote: 'Quote Request',
  feedback: 'Feedback',
}

// ── Site / form-submission hooks ───────────────────────────────────────────────
function useSiteList() {
  return useQuery({
    queryKey: ['vendor', 'sites'],
    queryFn: async (): Promise<SiteRecord[]> => {
      const r = await apiClient.get('/vendors/me/sites')
      return (r.data?.sites ?? r.data ?? []) as SiteRecord[]
    },
  })
}

function useFormSubmissions(
  siteId: string,
  params: { form_type?: string; limit?: number; offset?: number },
) {
  return useQuery({
    queryKey: ['vendor', 'form-submissions', siteId, params],
    queryFn: async () => {
      const r = await apiClient.get(`/vendors/me/sites/${siteId}/form-submissions`, { params })
      return r.data as { submissions: FormSubmission[]; total: number }
    },
    enabled: !!siteId,
  })
}

function useDeleteFormSubmission(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/vendors/me/sites/${siteId}/form-submissions/${id}`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['vendor', 'form-submissions', siteId] }),
  })
}

// ── SubmissionRow ─────────────────────────────────────────────────────────────
function SubmissionRow({
  sub,
  onDelete,
  isDeleting,
}: {
  sub: FormSubmission
  onDelete: (id: string) => void
  isDeleting: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const payload = (sub.payload || {}) as Record<string, unknown>
  const name = (payload.name as string) || (payload.full_name as string) || '—'
  const email = (payload.email as string) || '—'
  const message = (payload.message as string) || ''

  const formLabel = FORM_TYPE_LABELS[sub.form_type] || sub.form_type
  const otherFields = Object.entries(payload).filter(
    ([k]) => !['name', 'full_name', 'email', 'message', 'gdpr_consent', 'has_file_upload'].includes(k),
  )

  return (
    <div className={cn('border border-gray-200 rounded-xl overflow-hidden transition-all', expanded ? 'shadow-md' : 'hover:shadow-sm')}>
      <div
        className="flex items-center gap-3 p-4 cursor-pointer bg-white hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-primary" />
        </div>
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
              'bg-gray-100 text-gray-600',
            )}>
              {formLabel}
            </span>
            {message && <span className="text-xs text-gray-500 truncate max-w-[260px]">{message}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {sub.crm_lead_id && (
            <span className="text-xs bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">CRM Lead</span>
          )}
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {sub.created_at ? format(new Date(sub.created_at), 'MMM d, HH:mm') : '—'}
          </span>
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

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
                <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{value != null && value !== '' ? String(value) : '—'}</p>
              </div>
            ))}
          </div>
          {payload.booking != null && typeof payload.booking === 'object' ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-bold text-amber-700 mb-1">Booking Request</p>
              <p className="text-sm text-amber-800">
                {(payload.booking as { date?: string; time?: string }).date} at {(payload.booking as { date?: string; time?: string }).time}
              </p>
            </div>
          ) : null}
          <div className="flex items-center justify-between pt-1 border-t border-gray-200">
            <div className="flex items-center gap-3 text-xs text-gray-400">
              {sub.gdpr_consent && <span className="text-emerald-600 font-medium">✓ GDPR Consent</span>}
              {sub.crm_lead_id && (
                <a href="/crm/leads" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
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

// ── Form Submissions tab ──────────────────────────────────────────────────────
function FormSubmissionsTab() {
  const { data: sites = [] } = useSiteList()
  const [selectedSiteId, setSelectedSiteId] = useState<string>('')
  const [formType, setFormType] = useState<string>('')
  const [page, setPage] = useState(0)
  const limit = 20

  // Default to first site
  useEffect(() => {
    if (sites.length && !selectedSiteId) setSelectedSiteId(sites[0].id)
  }, [sites, selectedSiteId])

  const { data, isLoading, refetch } = useFormSubmissions(selectedSiteId, {
    form_type: formType || undefined,
    limit,
    offset: page * limit,
  })
  const deleteSubmission = useDeleteFormSubmission(selectedSiteId)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const submissions: FormSubmission[] = data?.submissions || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / limit)

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this submission? This action cannot be undone.')) return
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
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Site selector */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm">
          <Globe className="w-4 h-4 text-gray-400 shrink-0" />
          <select
            value={selectedSiteId}
            onChange={e => { setSelectedSiteId(e.target.value); setPage(0) }}
            className="text-sm text-gray-700 bg-transparent focus:outline-none pr-2 max-w-[200px]"
          >
            {sites.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Form type filter */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm">
          <Filter className="w-4 h-4 text-gray-400 shrink-0" />
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

        <span className="text-sm text-gray-500">{total} submission{total !== 1 ? 's' : ''}</span>

        <button
          onClick={() => refetch()}
          className="ml-auto flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* List */}
      {!selectedSiteId ? (
        <div className="text-center py-16 text-gray-400 text-sm">No websites found. Create a website to see form submissions.</div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-primary/80" />
        </div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <InboxIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
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
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-sm text-gray-500">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  )
}

// ── Chat / Conversations tab ──────────────────────────────────────────────────
function ChatsTab() {
  const qc = useQueryClient()
  const [status, setStatus] = useState('open')
  const [selected, setSelected] = useState<string | null>(null)
  const { data: convList, isLoading: loadingList } = useConversations({ status: status || undefined, page: 1, size: 50 })
  const { data: convo, isLoading: loadingConv } = useConversation(selected || undefined)
  const post = usePostChatMessage(selected || '')
  const [draft, setDraft] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!selected && convList?.items?.length) setSelected(convList.items[0].id)
  }, [convList, selected])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [convo?.messages?.length])

  const send = () => {
    if (!draft.trim() || !selected) return
    post.mutate(draft.trim(), { onSuccess: () => setDraft('') })
  }

  const closeConv = async () => {
    if (!selected) return
    await crmApi.closeConversation(selected)
    qc.invalidateQueries({ queryKey: ['crm', 'conversations'] })
    qc.invalidateQueries({ queryKey: ['crm', 'inbox-count'] })
    qc.invalidateQueries({ queryKey: ['crm', 'conversation', selected] })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 h-[calc(100vh-260px)]">
      {/* Conversation list */}
      <Card className="flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-1 shrink-0">
          {[['open', 'Open'], ['pending', 'Pending'], ['resolved', 'Resolved'], ['', 'All']].map(([s, label]) => (
            <button
              key={s || 'all'}
              onClick={() => setStatus(s)}
              className={cn(
                'text-xs px-2.5 py-1 rounded-full font-semibold transition-colors',
                status === s ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:bg-gray-100',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="overflow-y-auto flex-1 divide-y">
          {loadingList ? (
            <div className="p-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          ) : !convList?.items?.length ? (
            <div className="p-6 text-center text-sm text-gray-500">
              <MessageSquare className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              No conversations
            </div>
          ) : convList.items.map(c => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={cn('w-full text-left p-3 hover:bg-gray-50 transition-colors', selected === c.id ? 'bg-accent border-l-2 border-primary' : '')}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate text-gray-900">{c.visitor_name || c.visitor_email || c.visitor_id || 'Visitor'}</p>
                    <p className="text-xs text-gray-400">{formatDateTime(c.last_message_at)}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant={c.status === 'open' ? 'soft' : c.status === 'resolved' ? 'success' : 'secondary'}>{c.status}</Badge>
                  {c.bot_handled && <Badge variant="outline">bot</Badge>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Conversation detail */}
      <Card className="flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2">
            <MessageSquare className="w-10 h-10 opacity-30" />
            <p className="text-sm">Select a conversation to start</p>
          </div>
        ) : loadingConv ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{convo?.conversation.visitor_name || convo?.conversation.visitor_email || 'Visitor'}</p>
                  <p className="text-xs text-gray-400">{convo?.conversation.channel || 'widget'}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={closeConv}>
                <CheckCircle2 className="w-4 h-4 mr-1" /> Resolve
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {convo?.messages?.length ? convo.messages.map(m => {
                const mine = m.sender === 'agent' || m.sender === 'system'
                const bot = m.sender === 'bot'
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={cn('max-w-[75%] rounded-2xl px-4 py-2.5 text-sm', mine ? 'bg-primary text-white' : bot ? 'bg-primary/10 text-primary' : 'bg-white border border-gray-200 text-gray-900 shadow-sm')}>
                      {bot && <p className="text-xs uppercase font-bold mb-1 opacity-60">Bot</p>}
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <p className={cn('text-xs mt-1.5', mine ? 'text-primary-foreground/85' : 'text-gray-400')}>{formatDateTime(m.created_at)}</p>
                    </div>
                  </div>
                )
              }) : (
                <p className="text-center text-sm text-gray-400 py-8">No messages yet.</p>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t p-3 flex gap-2 shrink-0">
              <Input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="Type a reply…"
                className="flex-1"
              />
              <Button onClick={send} disabled={!draft.trim() || post.isPending}>
                {post.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

// ── Main Inbox page ───────────────────────────────────────────────────────────
export default function InboxPage() {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Overview</p>
        <h1 className="text-2xl font-bold text-foreground">Inbox</h1>
        <p className="text-sm text-muted-foreground mt-1">Live chat conversations from your Business Front widget.</p>
      </div>
      <ChatsTab />
    </div>
  )
}
