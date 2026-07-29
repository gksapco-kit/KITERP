import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Loader2, MessageSquareText, Mail, Phone, UserPlus, Send,
  CheckCircle2, ExternalLink, Zap, ZapOff, LifeBuoy,
} from 'lucide-react'
import apiClient from '@/api/client'
import { crmApi, EmailTemplate } from '@/api/crm'
import { Button } from '@/components/ui/button'
import { contactQueryKeys, CONTACT_QUERY_POLL_MS } from '@/hooks/useContactQueries'
import { CrmModal } from '@/pages/crm/_shared'
import { useAssigneeOptions } from '@/pages/crm/crmFormShared'
import { modalWidthMd } from '@/lib/modalUi'

const STATUSES = ['', 'new', 'read', 'resolved'] as const

const fieldClass =
  'w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40'

type ContactQuery = {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  message: string
  status: string
  created_at?: string | null
  converted_lead_id?: string | null
  converted_lead_number?: string | null
  converted_at?: string | null
  converted_ticket_id?: string | null
  converted_ticket_number?: string | null
  ticket_converted_at?: string | null
  reply_count?: number
  last_reply_at?: string | null
}

type AutoReplyWorkflow = {
  workflow_id: string | null
  status: 'active' | 'paused'
  name: string | null
}

// ── Move-as-Lead modal ────────────────────────────────────────────────────────

function LeadModal({
  query,
  onClose,
  onSuccess,
}: {
  query: ContactQuery
  onClose: () => void
  onSuccess: (leadNumber: string, leadId: string) => void
}) {
  const parts = query.name.trim().split(/\s+/)
  const [firstName, setFirstName] = useState(parts[0] ?? '')
  const [lastName, setLastName] = useState(parts.slice(1).join(' '))
  const [company, setCompany] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [rating, setRating] = useState('')
  const [source, setSource] = useState('storefront_contact')
  const [assignedTo, setAssignedTo] = useState('')
  const { options: assigneeOptions, isLoading: assigneesLoading } = useAssigneeOptions()

  const mut = useMutation({
    mutationFn: () =>
      apiClient
        .post(`/vendors/me/contact-queries/${query.id}/convert-to-lead`, {
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          company: company || undefined,
          // Keep customer message as lead notes; append internal notes when provided
          notes: internalNotes.trim()
            ? `${query.message}\n\n— Internal notes —\n${internalNotes.trim()}`
            : query.message,
          rating: rating || undefined,
          source: source || undefined,
          assigned_to: assignedTo || undefined,
        })
        .then((r) => r.data),
    onSuccess: (data) => {
      onSuccess(data.number ?? 'LED-?', data.id)
      onClose()
    },
  })

  return (
    <CrmModal
      title={
        <span className="inline-flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-primary" /> Move as Lead
        </span>
      }
      onClose={onClose}
      maxW={modalWidthMd}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={mut.isPending}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <UserPlus className="w-4 h-4 mr-1" />}
            Create Lead
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">First name</span>
            <input
              className={fieldClass}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Last name</span>
            <input
              className={fieldClass}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </label>
        </div>

        <label className="space-y-1 text-sm block">
          <span className="text-muted-foreground">Company</span>
          <input
            className={fieldClass}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Optional"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Rating</span>
            <select
              className={fieldClass}
              value={rating}
              onChange={(e) => setRating(e.target.value)}
            >
              <option value="">— none —</option>
              <option value="hot">Hot</option>
              <option value="warm">Warm</option>
              <option value="cold">Cold</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Source</span>
            <select
              className={fieldClass}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="storefront_contact">Storefront Contact</option>
              <option value="website">Website</option>
              <option value="referral">Referral</option>
              <option value="manual">Manual</option>
            </select>
          </label>
        </div>

        <label className="space-y-1 text-sm block">
          <span className="text-muted-foreground">Assigned to</span>
          <select
            className={fieldClass}
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            disabled={assigneesLoading}
          >
            <option value="">{assigneesLoading ? 'Loading…' : '— Unassigned —'}</option>
            {assigneeOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 space-y-1">
          <p><span className="font-medium">Email:</span> {query.email ?? '—'}</p>
          <p><span className="font-medium">Phone:</span> {query.phone ?? '—'}</p>
          <p className="whitespace-pre-wrap"><span className="font-medium">Note:</span> {query.message}</p>
        </div>

        <label className="space-y-1 text-sm block">
          <span className="text-muted-foreground">Internal Notes</span>
          <textarea
            rows={3}
            className={`${fieldClass} resize-none`}
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            placeholder="Optional notes for your team…"
          />
        </label>

        {mut.isError && (
          <p className="text-sm text-destructive">
            {(mut.error as any)?.response?.data?.detail ?? 'Failed to create lead.'}
          </p>
        )}
      </div>
    </CrmModal>
  )
}

// ── Respond modal ─────────────────────────────────────────────────────────────

function RespondModal({
  query,
  templates,
  onClose,
}: {
  query: ContactQuery
  templates: EmailTemplate[]
  onClose: () => void
}) {
  const [channel, setChannel] = useState<'email' | 'sms' | 'whatsapp'>(
    query.email ? 'email' : 'sms',
  )
  const [templateId, setTemplateId] = useState('')
  const [subject, setSubject] = useState(`Re: Your enquiry`)
  const [body, setBody] = useState('')
  const [markResolved, setMarkResolved] = useState(false)
  const qc = useQueryClient()

  const channelTemplates = templates.filter(
    (t) => !t.channel || t.channel === channel,
  )

  useEffect(() => {
    if (!templateId) return
    const tpl = templates.find((t) => t.id === templateId)
    if (!tpl) return
    if (tpl.subject) setSubject(tpl.subject)
    setBody(tpl.body_text ?? '')
  }, [templateId, templates])

  const hasEmail = Boolean(query.email)
  const hasPhone = Boolean(query.phone)

  const mut = useMutation({
    mutationFn: () =>
      apiClient
        .post(`/vendors/me/contact-queries/${query.id}/reply`, {
          channel,
          body,
          subject: channel === 'email' ? subject : undefined,
          template_id: templateId || undefined,
          mark_resolved: markResolved,
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contactQueryKeys.all })
      onClose()
    },
  })

  return (
    <CrmModal
      title={
        <span className="inline-flex items-center gap-2">
          <Send className="w-5 h-5 text-primary" /> Respond to {query.name}
        </span>
      }
      onClose={onClose}
      maxW={modalWidthMd}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={mut.isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !body.trim()}
          >
            {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
            Send
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <div className="flex gap-2">
          {(['email', 'sms', 'whatsapp'] as const).map((ch) => {
            const disabled = ch === 'email' ? !hasEmail : !hasPhone
            return (
              <button
                key={ch}
                type="button"
                disabled={disabled}
                onClick={() => { setChannel(ch); setTemplateId('') }}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors
                  ${channel === ch ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border'}
                  ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:border-primary/60'}`}
              >
                {ch === 'email' ? '✉ Email' : ch === 'sms' ? '💬 SMS' : '📱 WhatsApp'}
              </button>
            )
          })}
        </div>

        <label className="space-y-1 text-sm block">
          <span className="text-muted-foreground">Template (optional)</span>
          <select
            className={fieldClass}
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">— custom message —</option>
            {channelTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        {channel === 'email' && (
          <label className="space-y-1 text-sm block">
            <span className="text-muted-foreground">Subject</span>
            <input
              className={fieldClass}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
        )}

        <label className="space-y-1 text-sm block">
          <span className="text-muted-foreground">Message</span>
          <textarea
            rows={5}
            className={`${fieldClass} resize-none`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              templateId
                ? 'Template body loaded above — edit as needed'
                : 'Type your reply…'
            }
          />
        </label>

        <p className="text-xs text-muted-foreground">
          Sending to:{' '}
          <span className="font-medium">
            {channel === 'email' ? query.email : query.phone}
          </span>
        </p>

        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            className="rounded"
            checked={markResolved}
            onChange={(e) => setMarkResolved(e.target.checked)}
          />
          Mark as resolved after sending
        </label>

        {mut.isError && (
          <p className="text-sm text-destructive">
            {(mut.error as any)?.response?.data?.detail ?? 'Failed to send reply.'}
          </p>
        )}
      </div>
    </CrmModal>
  )
}

// ── Move-as-Ticket modal ──────────────────────────────────────────────────────

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

function TicketModal({
  query,
  onClose,
  onSuccess,
}: {
  query: ContactQuery
  onClose: () => void
  onSuccess: (ticketNumber: string, ticketId: string) => void
}) {
  const [subject, setSubject] = useState(`Enquiry from ${query.name}`)
  const [priority, setPriority] = useState('normal')
  const [assignedTo, setAssignedTo] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const { options: assigneeOptions, isLoading: assigneesLoading } = useAssigneeOptions()

  const mut = useMutation({
    mutationFn: () =>
      apiClient
        .post(`/vendors/me/contact-queries/${query.id}/convert-to-ticket`, {
          subject: subject.trim() || undefined,
          priority,
          assigned_to: assignedTo || undefined,
          notes: internalNotes.trim() || undefined,
        })
        .then((r) => r.data),
    onSuccess: (data) => {
      onSuccess(data.number ?? 'TCK-?', data.id)
      onClose()
    },
  })

  return (
    <CrmModal
      title={
        <span className="inline-flex items-center gap-2">
          <LifeBuoy className="w-5 h-5 text-amber-600" /> Move as Ticket
        </span>
      }
      onClose={onClose}
      maxW={modalWidthMd}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={mut.isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white"
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
          >
            {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <LifeBuoy className="w-4 h-4 mr-1" />}
            Create Ticket
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <label className="space-y-1 text-sm block">
          <span className="text-muted-foreground">Subject</span>
          <input
            className={fieldClass}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Priority</span>
            <select
              className={fieldClass}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Assigned to</span>
            <select
              className={fieldClass}
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              disabled={assigneesLoading}
            >
              <option value="">{assigneesLoading ? 'Loading…' : '— Unassigned —'}</option>
              {assigneeOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 space-y-1">
          <p><span className="font-medium">Email:</span> {query.email ?? '—'}</p>
          <p><span className="font-medium">Phone:</span> {query.phone ?? '—'}</p>
          <p className="whitespace-pre-wrap"><span className="font-medium">Message:</span> {query.message}</p>
        </div>

        <label className="space-y-1 text-sm block">
          <span className="text-muted-foreground">Internal Notes</span>
          <textarea
            rows={3}
            className={`${fieldClass} resize-none`}
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            placeholder="Optional notes for your team…"
          />
        </label>

        {mut.isError && (
          <p className="text-sm text-destructive">
            {(mut.error as any)?.response?.data?.detail ?? 'Failed to create ticket.'}
          </p>
        )}
      </div>
    </CrmModal>
  )
}


// ── Reply history modal ───────────────────────────────────────────────────────

type QueryReply = {
  id: string
  channel: string
  direction?: string | null
  subject?: string | null
  body?: string | null
  status?: string | null
  provider?: string | null
  occurred_at?: string | null
}

function ReplyHistoryModal({
  query,
  onClose,
}: {
  query: ContactQuery
  onClose: () => void
}) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['contact-queries', query.id, 'replies'],
    queryFn: () =>
      apiClient
        .get(`/vendors/me/contact-queries/${query.id}/replies`)
        .then((r) => r.data as { items: QueryReply[]; total: number }),
  })

  const items = data?.items ?? []

  return (
    <CrmModal
      title={
        <span className="inline-flex items-center gap-2">
          <Send className="w-5 h-5 text-primary" />
          Replies to {query.name}
        </span>
      }
      onClose={onClose}
      maxW={modalWidthMd}
      footer={
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-3 pb-2 max-h-[60vh] overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">
            {(error as any)?.response?.data?.detail ?? 'Failed to load replies.'}
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No replies recorded for this query yet.
          </p>
        ) : (
          items.map((r) => (
            <div key={r.id} className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {r.channel || 'message'}
                </span>
                {r.status && (
                  <span
                    className={`px-2 py-0.5 rounded-full border ${
                      r.status === 'sent' || r.status === 'delivered'
                        ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                        : r.status === 'failed'
                          ? 'bg-red-500/10 text-red-700 border-red-500/20'
                          : 'bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {r.status}
                  </span>
                )}
                {r.occurred_at && (
                  <span className="text-muted-foreground ml-auto">
                    {new Date(r.occurred_at).toLocaleString()}
                  </span>
                )}
              </div>
              {r.subject && (
                <p className="text-sm font-medium">
                  <span className="text-muted-foreground font-normal">Subject: </span>
                  {r.subject}
                </p>
              )}
              <p className="text-sm whitespace-pre-wrap">
                {r.body?.trim() || '—'}
              </p>
            </div>
          ))
        )}
      </div>
    </CrmModal>
  )
}


// ── Main page ─────────────────────────────────────────────────────────────────

export default function ContactQueries() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [leadModal, setLeadModal] = useState<ContactQuery | null>(null)
  const [ticketModal, setTicketModal] = useState<ContactQuery | null>(null)
  const [respondModal, setRespondModal] = useState<ContactQuery | null>(null)
  const [repliesModal, setRepliesModal] = useState<ContactQuery | null>(null)
  const [toast, setToast] = useState<{ message: string; crm_id?: string; crm_href?: string } | null>(null)

  // Main list
  const { data, isLoading } = useQuery({
    queryKey: contactQueryKeys.list(statusFilter),
    queryFn: async () => {
      const res = await apiClient.get('/vendors/me/contact-queries', {
        params: { status: statusFilter || undefined, size: 50 },
      })
      return res.data as { items: ContactQuery[]; total: number }
    },
    staleTime: 0,
    refetchInterval: CONTACT_QUERY_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })

  // CRM email templates (for respond modal)
  const { data: templates = [] } = useQuery({
    queryKey: ['crm', 'templates'],
    queryFn: () => crmApi.listTemplates(),
    staleTime: 60_000,
  })

  // Auto-reply workflow toggle
  const { data: autoReply, refetch: refetchAutoReply } = useQuery<AutoReplyWorkflow>({
    queryKey: ['contact-queries', 'auto-reply-workflow'],
    queryFn: () =>
      apiClient.get('/vendors/me/contact-queries/auto-reply-workflow').then((r) => r.data),
    staleTime: 30_000,
  })

  const toggleAutoReply = useMutation({
    mutationFn: (newStatus: 'active' | 'paused') =>
      apiClient
        .patch('/vendors/me/contact-queries/auto-reply-workflow', { status: newStatus })
        .then((r) => r.data),
    onSuccess: () => refetchAutoReply(),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.patch(`/vendors/me/contact-queries/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: contactQueryKeys.all }),
  })

  const items = data?.items ?? []

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  const isAutoActive = autoReply?.status === 'active'

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[120] bg-card border rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 text-sm animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
          <span>{toast.message}</span>
          {toast.crm_href && (
            <a
              href={toast.crm_href}
              className="text-primary font-medium hover:underline flex items-center gap-1"
            >
              View <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <button
            type="button"
            className="ml-2 text-muted-foreground hover:text-foreground"
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquareText className="w-6 h-6 text-primary" />
            Queries
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Customer messages from your storefront Contact Us page — name, email, phone, and issue.
          </p>
        </div>

        {/* Auto-reply toggle */}
        <button
          type="button"
          onClick={() =>
            toggleAutoReply.mutate(isAutoActive ? 'paused' : 'active')
          }
          disabled={toggleAutoReply.isPending}
          className={`flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg border transition-colors
            ${isAutoActive
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-background border-border text-muted-foreground'}`}
          title={isAutoActive ? 'Auto-reply is ON — click to disable' : 'Enable auto-reply on new queries'}
        >
          {isAutoActive
            ? <Zap className="w-4 h-4" />
            : <ZapOff className="w-4 h-4" />}
          Auto-reply {isAutoActive ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border ${
              statusFilter === s
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-muted-foreground border-border'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/40" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
          No contact queries yet. They appear when shoppers submit the Contact Us form on your storefront.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((q) => (
            <div key={q.id} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold">{q.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {q.created_at ? new Date(q.created_at).toLocaleString() : '—'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  {/* Lead conversion badge */}
                  {q.converted_lead_id ? (
                    <a
                      href="/crm/leads"
                      title="Open CRM Leads"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      In CRM · {q.converted_lead_number || 'Lead'}
                      <ExternalLink className="w-3 h-3 opacity-80" />
                    </a>
                  ) : null}
                  {/* Ticket conversion badge */}
                  {q.converted_ticket_id ? (
                    <a
                      href="/crm/tickets"
                      title="Open CRM Tickets"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-600 text-white shadow-sm hover:bg-amber-700 transition-colors"
                    >
                      <LifeBuoy className="w-3.5 h-3.5" />
                      Ticket · {q.converted_ticket_number || 'TCK'}
                      <ExternalLink className="w-3 h-3 opacity-80" />
                    </a>
                  ) : null}
                  {(q.reply_count ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => setRepliesModal(q)}
                      title="View sent replies"
                      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-blue-500/10 text-blue-700 border border-blue-500/20 hover:bg-blue-500/20 transition-colors cursor-pointer"
                    >
                      <Send className="w-3 h-3" /> {q.reply_count} repl{q.reply_count === 1 ? 'y' : 'ies'}
                    </button>
                  )}
                  <span className="text-xs font-medium capitalize px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {q.status}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                {q.email && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    <a href={`mailto:${q.email}`} className="hover:underline">
                      {q.email}
                    </a>
                  </span>
                )}
                {q.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                    <a href={`tel:${q.phone}`} className="hover:underline">
                      {q.phone}
                    </a>
                  </span>
                )}
              </div>

              <p className="text-sm whitespace-pre-wrap border-t pt-3">{q.message}</p>

              <div className="flex flex-wrap gap-2">
                {q.status === 'new' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updateMut.isPending}
                    onClick={() => updateMut.mutate({ id: q.id, status: 'read' })}
                  >
                    Mark read
                  </Button>
                )}
                {(q.status === 'new' || q.status === 'read') && (
                  <Button
                    size="sm"
                    disabled={updateMut.isPending}
                    onClick={() => updateMut.mutate({ id: q.id, status: 'resolved' })}
                  >
                    Resolve
                  </Button>
                )}

                {/* Move as Lead */}
                {!q.converted_lead_id && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setLeadModal(q)}
                    className="border-primary/40 text-primary hover:bg-primary/10"
                  >
                    <UserPlus className="w-3.5 h-3.5 mr-1" />
                    Move as Lead
                  </Button>
                )}

                {/* Move as Ticket */}
                {!q.converted_ticket_id && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setTicketModal(q)}
                    className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10"
                  >
                    <LifeBuoy className="w-3.5 h-3.5 mr-1" />
                    Move as Ticket
                  </Button>
                )}

                {/* Respond */}
                {(q.email || q.phone) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRespondModal(q)}
                  >
                    <Send className="w-3.5 h-3.5 mr-1" />
                    Respond
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Move-as-lead modal */}
      {leadModal && (
        <LeadModal
          query={leadModal}
          onClose={() => setLeadModal(null)}
          onSuccess={(leadNumber, leadId) => {
            qc.setQueriesData(
              { queryKey: contactQueryKeys.all },
              (old: { items: ContactQuery[]; total: number } | undefined) => {
                if (!old?.items) return old
                return {
                  ...old,
                  items: old.items.map((item) =>
                    item.id === leadModal.id
                      ? { ...item, converted_lead_id: leadId, converted_lead_number: leadNumber, status: 'resolved' }
                      : item,
                  ),
                }
              },
            )
            qc.invalidateQueries({ queryKey: contactQueryKeys.all })
            qc.invalidateQueries({ queryKey: ['crm', 'leads'] })
            setToast({ message: `Moved to CRM as ${leadNumber}.`, crm_href: '/crm/leads' })
          }}
        />
      )}

      {/* Move-as-ticket modal */}
      {ticketModal && (
        <TicketModal
          query={ticketModal}
          onClose={() => setTicketModal(null)}
          onSuccess={(ticketNumber, ticketId) => {
            qc.setQueriesData(
              { queryKey: contactQueryKeys.all },
              (old: { items: ContactQuery[]; total: number } | undefined) => {
                if (!old?.items) return old
                return {
                  ...old,
                  items: old.items.map((item) =>
                    item.id === ticketModal.id
                      ? { ...item, converted_ticket_id: ticketId, converted_ticket_number: ticketNumber, status: 'resolved' }
                      : item,
                  ),
                }
              },
            )
            qc.invalidateQueries({ queryKey: contactQueryKeys.all })
            qc.invalidateQueries({ queryKey: ['crm', 'tickets'] })
            setToast({ message: `Logged as ticket ${ticketNumber}.`, crm_href: '/crm/tickets' })
          }}
        />
      )}

      {/* Reply history modal */}
      {repliesModal && (
        <ReplyHistoryModal
          query={repliesModal}
          onClose={() => setRepliesModal(null)}
        />
      )}

      {/* Respond modal */}
      {respondModal && (
        <RespondModal
          query={respondModal}
          templates={templates}
          onClose={() => setRespondModal(null)}
        />
      )}
    </div>
  )
}
