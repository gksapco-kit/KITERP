import { useEffect, useMemo, useState } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useLeads, useSaveLead, useConvertLead, useDeleteLead, usePurgeLead, usePurgeTrashedLeads, useRestoreLead } from '@/hooks/useCrm'
import { crmApi, type Lead } from '@/api/crm'
import { Plus, Loader2, Target, Sparkles, ArrowRight, Check, GitBranch, XCircle, AlertTriangle, UserRound, Trash2, RotateCcw } from 'lucide-react'
import { CrmModal, Field, SearchBar, Pager, LoadingRow, EmptyRow } from './_shared'
import { useAssigneeOptions } from './crmFormShared'
import { modalWidthMd, modalWidthSm, modalWidthXl } from '@/lib/modalUi'
import { formatDateTime } from '@/lib/utils'
import { extractApiError } from '@/lib/errorMessages'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

const STATUSES = [
  'new',
  'working',
  'contacted',
  'qualified',
  'unqualified',
  'requested_for_demo',
  'demo_scheduled',
  'demo_completed',
  'not_responding',
  'contact_later',
  'converted',
] as const

const STATUS_LABELS: Record<string, string> = {
  new: 'new',
  working: 'working',
  contacted: 'contacted',
  qualified: 'qualified',
  unqualified: 'unqualified',
  requested_for_demo: 'Requested for Demo',
  demo_scheduled: 'Demo Scheduled',
  demo_completed: 'Demo Completed',
  not_responding: 'Not responding',
  contact_later: 'Contact Later',
  converted: 'converted',
}

const STATUS_OPTIONS = STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] || s }))

const ROADMAP_STEPS = [
  'new',
  'working',
  'contacted',
  'requested_for_demo',
  'demo_scheduled',
  'demo_completed',
  'qualified',
  'converted',
] as const

const OTHER_STATUSES = ['contact_later', 'not_responding', 'unqualified'] as const

function sourceLabel(source?: string | null) {
  const key = (source || '').trim().toLowerCase().replace(/\s+/g, '_')
  const labels: Record<string, string> = {
    talk_to_us: 'Talk to us',
    platform_contact: 'Talk to us',
    website: 'Website',
    ads: 'Ads',
    referral: 'Referral',
    other: 'Other',
    manual: 'Manual',
  }
  return labels[key] || source || '—'
}

function SourceChip({ source }: { source?: string | null }) {
  if (!source?.trim()) {
    return <span className="text-sm text-gray-400">—</span>
  }
  const label = sourceLabel(source)
  return (
    <Badge
      variant="soft"
      title={label}
      className="max-w-[14rem] min-w-0 whitespace-nowrap overflow-hidden"
    >
      <span className="truncate">{label}</span>
    </Badge>
  )
}

function truncateEmail(email?: string | null, maxChars = 20) {
  const value = (email || '').trim()
  if (!value) return '—'
  if (value.length <= maxChars) return value
  return `${value.slice(0, maxChars)}...`
}

function statusLabel(status: string) {
  return STATUS_LABELS[status] || status
}

function roadmapLabel(status: string) {
  const label = statusLabel(status)
  return label === label.toLowerCase() ? label.charAt(0).toUpperCase() + label.slice(1) : label
}

function leadDisplayName(lead: Lead) {
  return [lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.email || lead.phone || 'Lead'
}

type LeadFormValues = {
  first_name: string
  last_name: string
  company: string
  email: string
  phone: string
  title: string
  source: string
  status: string
  notes: string
  assigned_to: string
}

type LeadMatch = { lead: Lead; reasons: string[] }

function phoneDigits(value?: string | null) {
  const digits = (value || '').replace(/\D/g, '')
  return digits.length > 10 ? digits.slice(-10) : digits
}

function matchReasonLabel(reason: string) {
  switch (reason) {
    case 'email': return 'same email'
    case 'phone': return 'same phone'
    case 'name': return 'same first and last name'
    case 'company': return 'same company'
    default: return reason
  }
}

function sameName(a?: string | null, b?: string | null) {
  return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase()
}

async function findLeadMatches(form: Pick<LeadFormValues, 'first_name' | 'last_name' | 'company' | 'email' | 'phone'>): Promise<LeadMatch[]> {
  const email = form.email.trim()
  const phone = phoneDigits(form.phone)
  const firstName = form.first_name.trim()
  const lastName = form.last_name.trim()
  const queries = new Set<string>()
  if (email.includes('@')) queries.add(email)
  if (phone.length >= 8) queries.add(phone)
  if (firstName.length >= 2) queries.add(firstName)
  if (lastName.length >= 2) queries.add(lastName)
  if (!queries.size) return []

  const pages = await Promise.all([...queries].map((q) => crmApi.listLeads({ q, size: 20, page: 1 })))
  const byId = new Map<string, Lead>()
  for (const page of pages) {
    for (const item of page.items || []) byId.set(item.id, item)
  }

  const matches: LeadMatch[] = []
  for (const lead of byId.values()) {
    const reasons: string[] = []
    if (email && lead.email && email.toLowerCase() === lead.email.trim().toLowerCase()) reasons.push('email')
    if (phone.length >= 8 && phoneDigits(lead.phone) === phone) reasons.push('phone')
    if (firstName && lastName && sameName(firstName, lead.first_name) && sameName(lastName, lead.last_name)) {
      reasons.push('name')
    }
    const formCompany = form.company.trim().toLowerCase()
    const leadCompany = (lead.company || '').trim().toLowerCase()
    if (formCompany && leadCompany && formCompany === leadCompany && reasons.length) {
      reasons.push('company')
    }
    if (reasons.length) matches.push({ lead, reasons })
  }
  return matches.sort((a, b) => b.reasons.length - a.reasons.length).slice(0, 4)
}

function statusTriggerClass(status: string) {
  switch (status) {
    case 'qualified':
    case 'demo_completed':
      return 'border-emerald-300 bg-emerald-50 text-emerald-800'
    case 'unqualified':
    case 'not_responding':
      return 'border-red-300 bg-red-50 text-red-800'
    case 'converted':
      return 'border-violet-300 bg-violet-50 text-violet-800'
    case 'contacted':
    case 'working':
      return 'border-sky-300 bg-sky-50 text-sky-800'
    case 'requested_for_demo':
    case 'demo_scheduled':
      return 'border-amber-300 bg-amber-50 text-amber-800'
    case 'contact_later':
      return 'border-orange-300 bg-orange-50 text-orange-800'
    default:
      return 'border-gray-200 bg-white text-gray-700'
  }
}

function LeadForm({
  onClose,
  onUseExisting,
}: {
  onClose: () => void
  onUseExisting: (lead: Lead) => void
}) {
  const save = useSaveLead()
  const { options: assigneeOptions, isLoading: assigneesLoading } = useAssigneeOptions()
  const [form, setForm] = useState<LeadFormValues>({
    first_name: '', last_name: '', company: '', email: '', phone: '',
    title: '', source: 'website', status: 'new', notes: '', assigned_to: '',
  })
  const [matches, setMatches] = useState<LeadMatch[]>([])
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        if (!form.email.trim() && !form.phone.trim() && !form.first_name.trim()) {
          setMatches([])
          return
        }
        setChecking(true)
        try {
          setMatches(await findLeadMatches(form))
        } catch {
          setMatches([])
        } finally {
          setChecking(false)
        }
      })()
    }, 400)
    return () => window.clearTimeout(timer)
  }, [form.first_name, form.last_name, form.company, form.email, form.phone])

  const persist = () => {
    save.mutate(
      {
        data: {
          first_name: form.first_name || undefined,
          last_name: form.last_name || undefined,
          company: form.company || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          title: form.title || undefined,
          source: form.source,
          status: form.status,
          notes: form.notes || undefined,
          assigned_to: form.assigned_to || undefined,
        },
      },
      { onSuccess: onClose },
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.first_name && !form.last_name && !form.email && !form.phone) return
    setChecking(true)
    try {
      const found = await findLeadMatches(form)
      setMatches(found)
      if (found.length) {
        toast.message('A matching lead already exists. Use the existing one or create a new lead.')
        return
      }
    } catch {
      /* allow create if lookup fails */
    } finally {
      setChecking(false)
    }
    persist()
  }
  const formId = 'lead-form-new'

  return (
    <CrmModal
      title="New lead"
      onClose={onClose}
      maxW={modalWidthMd}
      bodyClassName={matches.length ? '[scrollbar-gutter:auto]' : '!overflow-hidden [scrollbar-gutter:auto]'}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {matches.length > 0 ? (
            <Button type="button" disabled={save.isPending} onClick={persist}>
              {save.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Create new anyway
            </Button>
          ) : (
            <Button type="submit" form={formId} disabled={save.isPending || checking}>
              {save.isPending || checking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Save lead
            </Button>
          )}
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
        <Field label="First name">
          <Input className="h-9" value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} />
        </Field>
        <Field label="Last name">
          <Input className="h-9" value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} />
        </Field>
        <Field label="Title">
          <Input className="h-9" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
        </Field>
        <Field label="Company">
          <Input className="h-9" value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} />
        </Field>
        <Field label="Email">
          <Input className="h-9" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
        </Field>
        <Field label="Phone">
          <PhoneInput
            value={form.phone}
            onChange={v => setForm(p => ({ ...p, phone: v }))}
            defaultCountryIso="IN"
            compact
            compactCountry
            subtleFeedback
            autoComplete="tel"
            name="phone"
          />
        </Field>
        <Field label="Source">
          <Input className="h-9" value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} placeholder="website, ads, referral" />
        </Field>
        <Field label="Status">
          <Select
            className="h-9"
            value={form.status}
            onChange={v => setForm(p => ({ ...p, status: v }))}
            options={STATUS_OPTIONS.filter((o) => o.value !== 'converted')}
          />
        </Field>
        <Field label="Assigned to">
          <Select
            className="h-9"
            value={form.assigned_to}
            onChange={v => setForm(p => ({ ...p, assigned_to: v }))}
            disabled={assigneesLoading}
            options={selectOptionsWithBlank(
              assigneesLoading ? 'Loading…' : '— Unassigned —',
              assigneeOptions,
            )}
            placeholder={assigneesLoading ? 'Loading…' : '— Unassigned —'}
          />
        </Field>
        <Field label="Notes" className="col-span-2 sm:col-span-3">
          <textarea
            rows={2}
            value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            className="flex h-[52px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </Field>
        {matches.length > 0 && (
          <div className="col-span-2 sm:col-span-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5">
            <div className="mb-2 flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-950">This person may already be a lead</p>
                <p className="text-xs text-amber-800">
                  Use the existing record to avoid duplicates, or create a new lead if this is someone else.
                </p>
              </div>
            </div>
            <ul className="space-y-1.5">
              {matches.map(({ lead, reasons }) => (
                <li key={lead.id} className="flex items-center gap-2 rounded-md border border-amber-100 bg-white px-2.5 py-2">
                  <UserRound className="h-4 w-4 shrink-0 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {lead.number && <span className="mr-1.5 font-mono text-xs text-gray-400">{lead.number}</span>}
                      {leadDisplayName(lead)}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {[lead.company, lead.email || lead.phone, roadmapLabel(lead.status || 'new')].filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-[11px] text-amber-700">Matched on {reasons.map(matchReasonLabel).join(', ')}</p>
                  </div>
                  <Button type="button" size="sm" className="h-8 shrink-0" onClick={() => onUseExisting(lead)}>
                    Use this lead
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </CrmModal>
  )
}

function ConvertModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const convert = useConvertLead()
  const [createDeal, setCreateDeal] = useState(true)
  const [dealTitle, setDealTitle] = useState(`${lead.company || lead.first_name || 'Lead'} – Opportunity`)
  const [dealAmount, setDealAmount] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    convert.mutate(
      {
        id: lead.id,
        payload: {
          create_deal: createDeal,
          deal_title: createDeal ? dealTitle : undefined,
          deal_amount: createDeal && dealAmount ? Number(dealAmount) : undefined,
        },
      },
      { onSuccess: onClose },
    )
  }
  const formId = `convert-lead-${lead.id}`

  return (
    <CrmModal
      title="Convert lead"
      onClose={onClose}
      maxW={modalWidthMd}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={convert.isPending}>
            {convert.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
            Convert
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-3 pb-4">
        <p className="text-sm text-gray-600">
          Converts <strong>{[lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.email}</strong>{' '}
          into a contact{lead.company ? ' and account' : ''}.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={createDeal} onChange={e => setCreateDeal(e.target.checked)} />
          Create deal
        </label>
        {createDeal && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Deal title"><Input value={dealTitle} onChange={e => setDealTitle(e.target.value)} /></Field>
            <Field label="Amount"><Input type="number" value={dealAmount} onChange={e => setDealAmount(e.target.value)} placeholder="0" /></Field>
          </div>
        )}
      </form>
    </CrmModal>
  )
}

function LeadRoadmapModal({
  lead,
  onClose,
  onConvert,
}: {
  lead: Lead
  onClose: () => void
  onConvert: () => void
}) {
  const save = useSaveLead()
  const current = lead.status || 'new'
  const currentIndex = ROADMAP_STEPS.indexOf(current as typeof ROADMAP_STEPS[number])
  const isOther = (OTHER_STATUSES as readonly string[]).includes(current)
  const name = leadDisplayName(lead)

  const setStatus = (next: string) => {
    if (next === current) return
    if (next === 'converted') {
      onConvert()
      return
    }
    save.mutate(
      { id: lead.id, data: { status: next } },
      {
        onSuccess: () => toast.success(`Status updated to ${roadmapLabel(next)}`),
        onError: () => toast.error('Failed to update status'),
      },
    )
  }

  return (
    <CrmModal
      title={
        <span>
          {lead.number && <span className="font-mono text-xs text-gray-400 mr-2">{lead.number}</span>}
          {name}
        </span>
      }
      onClose={onClose}
      maxW={modalWidthXl}
      footer={
        <>
          {current !== 'converted' && (
            <Button type="button" onClick={onConvert}>
              Convert <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        </>
      }
    >
      <div className="space-y-4 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {lead.company && <p className="text-sm text-gray-600">{lead.company}</p>}
            <p className="text-xs text-gray-500">{lead.email || lead.phone || '—'}</p>
          </div>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusTriggerClass(current)}`}>
            {roadmapLabel(current)}
          </span>
        </div>

        <div className="rounded-xl border p-4">
          <div className="mb-3 flex items-center gap-1.5">
            <GitBranch className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">Status roadmap</h3>
          </div>
          <div className="flex items-start overflow-x-auto pb-1">
            {ROADMAP_STEPS.map((step, idx) => {
              const done = currentIndex >= 0 && idx < currentIndex
              const isCurrent = idx === currentIndex
              let dot = 'bg-gray-100 text-gray-400 border border-gray-200'
              if (done) dot = 'bg-emerald-500 text-white'
              else if (isCurrent) {
                dot = step === 'converted'
                  ? 'bg-violet-600 text-white ring-4 ring-violet-100'
                  : 'bg-blue-600 text-white ring-4 ring-blue-100'
              }
              return (
                <div key={step} className="flex min-w-0 flex-1 items-start">
                  <button
                    type="button"
                    disabled={save.isPending}
                    onClick={() => setStatus(step)}
                    className="flex w-[88px] shrink-0 flex-col items-center disabled:opacity-60"
                    title={`Set status to ${roadmapLabel(step)}`}
                  >
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${dot}`}>
                      {done ? <Check className="w-4 h-4" />
                        : isCurrent && step === 'converted' ? <Check className="w-4 h-4" />
                        : idx + 1}
                    </div>
                    <span className={`mt-1 text-center text-[11px] leading-tight ${isCurrent ? 'font-semibold text-gray-800' : done ? 'text-gray-600' : 'text-gray-400'}`}>
                      {roadmapLabel(step)}
                    </span>
                  </button>
                  {idx < ROADMAP_STEPS.length - 1 && (
                    <div className={`mt-3.5 h-0.5 min-w-[12px] flex-1 ${idx < currentIndex ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-gray-500">Other outcomes</p>
          <div className="flex flex-wrap gap-2">
            {OTHER_STATUSES.map((step) => {
              const active = current === step
              return (
                <button
                  key={step}
                  type="button"
                  disabled={save.isPending}
                  onClick={() => setStatus(step)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
                    active
                      ? `${statusTriggerClass(step)} font-semibold`
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {active && <XCircle className="w-3.5 h-3.5" />}
                  {roadmapLabel(step)}
                </button>
              )
            })}
          </div>
          {isOther && (
            <p className="mt-2 text-xs text-gray-500">
              This lead is on an exception status. The main roadmap stays at the last completed step.
            </p>
          )}
        </div>
      </div>
    </CrmModal>
  )
}

function LeadStatusSelect({
  lead,
  onConvert,
}: {
  lead: Lead
  onConvert: () => void
}) {
  const save = useSaveLead()
  const current = lead.status || 'new'

  return (
    <div className="min-w-[10.5rem] max-w-[14rem]">
      <Select
        value={current}
        options={STATUS_OPTIONS}
        disabled={save.isPending}
        aria-label={`Status for ${lead.number || lead.id}`}
        className="h-8 text-xs"
        triggerClassName={statusTriggerClass(current)}
        menuMinWidth={200}
        onChange={(next) => {
          if (next === current) return
          if (next === 'converted' && current !== 'converted') {
            onConvert()
            return
          }
          save.mutate(
            { id: lead.id, data: { status: next } },
            {
              onSuccess: () => toast.success(`Status updated to ${statusLabel(next)}`),
              onError: () => toast.error('Failed to update status'),
            },
          )
        }}
      />
    </div>
  )
}

function LeadAssigneeSelect({
  lead,
  options,
  loading,
}: {
  lead: Lead
  options: { value: string; label: string }[]
  loading?: boolean
}) {
  const save = useSaveLead()
  const current = lead.assigned_to || ''
  const known = options.some((o) => o.value === current)

  return (
    <div className="min-w-[9rem] max-w-[12rem]">
      <Select
        value={current}
        disabled={save.isPending || loading}
        aria-label={`Assignee for ${lead.number || lead.id}`}
        className="h-8 text-xs"
        menuMinWidth={200}
        options={selectOptionsWithBlank(
          loading ? 'Loading…' : '— Unassigned —',
          [
            ...(current && !known ? [{ value: current, label: 'Assigned user' }] : []),
            ...options,
          ],
        )}
        onChange={(next) => {
          if (next === current) return
          save.mutate(
            { id: lead.id, data: { assigned_to: next || null } },
            {
              onSuccess: () => toast.success(next ? 'Assignee updated' : 'Lead unassigned'),
              onError: () => toast.error('Failed to update assignee'),
            },
          )
        }}
      />
    </div>
  )
}

export default function LeadsPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [status, setStatus] = useState<string>('')
  const [showDeleted, setShowDeleted] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [roadmapLead, setRoadmapLead] = useState<Lead | null>(null)
  const [convertLead, setConvertLead] = useState<Lead | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Lead | null>(null)
  const [pendingPurge, setPendingPurge] = useState<Lead | null>(null)
  const [pendingPurgeAll, setPendingPurgeAll] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const { options: assigneeOptions, isLoading: assigneesLoading } = useAssigneeOptions()
  const removeLead = useDeleteLead()
  const purgeLead = usePurgeLead()
  const purgeTrashed = usePurgeTrashedLeads()
  const restoreLead = useRestoreLead()

  const { data, isLoading } = useLeads({
    page,
    size: pageSize,
    q: search || undefined,
    status: showDeleted ? undefined : (status || undefined),
    deleted: showDeleted,
  })
  const { data: trashPage } = useLeads({ deleted: true, page: 1, size: 1 })
  const trashCount = trashPage?.total ?? 0
  const pageItems = data?.items
  const pageIds = useMemo(() => (pageItems ?? []).map((l) => l.id), [pageItems])
  const selectedCount = selectedIds.size
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id))
  const somePageSelected = pageIds.some((id) => selectedIds.has(id))
  const tableCols = 11

  useEffect(() => {
    setSelectedIds(new Set())
    setPendingBulkDelete(false)
  }, [showDeleted, search, status, pageSize])

  const score = async (id: string) => {
    await crmApi.scoreLead(id)
    qc.invalidateQueries({ queryKey: ['crm', 'leads'] })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">CRM</p>
          <h1 className="text-2xl font-bold text-gray-900">{showDeleted ? 'Deleted leads' : 'Leads'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showDeleted ? 'default' : 'outline'}
            onClick={() => { setShowDeleted((v) => !v); setPage(1); setStatus('') }}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {showDeleted ? 'Back to leads' : 'Deleted leads'}
            {!showDeleted && trashCount > 0 ? (
              <span className="ml-2 rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800">{trashCount}</span>
            ) : null}
          </Button>
          {showDeleted && trashCount > 0 ? (
            <Button
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50"
              onClick={() => setPendingPurgeAll(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete all
            </Button>
          ) : null}
          {!showDeleted ? (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-2" /> New lead
            </Button>
          ) : null}
        </div>
      </div>

      {showDeleted ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          These leads were moved to trash. Restore a record to put it back on the active list, or delete it permanently.
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap">
          {['', ...STATUSES].map(s => (
            <button key={s || 'all'}
              onClick={() => { setStatus(s); setPage(1) }}
              className={`text-xs px-3 py-1.5 rounded-full border ${status === s ? 'bg-primary text-white border-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {s ? statusLabel(s) : 'all'}
            </button>
          ))}
        </div>
      )}

      <SearchBar value={searchInput} onChange={setSearchInput}
        onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1) }}
        placeholder="Search by name, company, email…" />

      {selectedCount > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2">
          <p className="text-sm font-medium text-red-900">
            {selectedCount} lead{selectedCount === 1 ? '' : 's'} selected
          </p>
          <Button
            size="sm"
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-100"
            onClick={() => setPendingBulkDelete(true)}
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            {showDeleted ? 'Delete selected permanently' : 'Delete selected'}
          </Button>
        </div>
      ) : null}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full min-w-[72rem]">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="w-10 px-3 py-2">
                  <Checkbox
                    checked={allPageSelected}
                    aria-label="Select all leads on this page"
                    ref={(el) => {
                      if (el) el.indeterminate = somePageSelected && !allPageSelected
                    }}
                    onCheckedChange={(checked) => {
                      setSelectedIds((prev) => {
                        const next = new Set(prev)
                        if (checked) pageIds.forEach((id) => next.add(id))
                        else pageIds.forEach((id) => next.delete(id))
                        return next
                      })
                    }}
                  />
                </th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Lead</TableColumnLabel></th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Name</TableColumnLabel></th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Email</TableColumnLabel></th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell"><TableColumnLabel>Phone</TableColumnLabel></th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Status</TableColumnLabel></th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell"><TableColumnLabel>Assigned to</TableColumnLabel></th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase hidden md:table-cell"><TableColumnLabel>Title</TableColumnLabel></th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase hidden md:table-cell"><TableColumnLabel>Company</TableColumnLabel></th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase min-w-[9rem]"><TableColumnLabel>Source</TableColumnLabel></th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Actions</TableColumnLabel></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? <LoadingRow cols={tableCols} /> : !data?.items?.length ? (
                <EmptyRow cols={tableCols} message={showDeleted ? 'No deleted leads' : 'No leads yet'} action={
                  showDeleted ? undefined : (
                  <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
                    <Target className="w-4 h-4 mr-1" /> Capture your first lead
                  </Button>
                  )
                } />
              ) : data.items.map(l => (
                <tr key={l.id} className={showDeleted ? 'bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-gray-50'}>
                  <td className="w-10 px-3 py-2">
                    <Checkbox
                      checked={selectedIds.has(l.id)}
                      aria-label={`Select ${l.number || l.id}`}
                      onCheckedChange={(checked) => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev)
                          if (checked) next.add(l.id)
                          else next.delete(l.id)
                          return next
                        })
                      }}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <p className="text-sm font-medium">
                      {l.number || '—'}
                    </p>
                    <p className="mt-0.5 whitespace-nowrap text-xs text-gray-500">{formatDateTime(l.created_at)}</p>
                    {showDeleted && l.deleted_at ? (
                      <p className="mt-0.5 whitespace-nowrap text-[11px] text-amber-800">Deleted {formatDateTime(l.deleted_at)}</p>
                    ) : null}
                    {l.notes ? (
                      <p className="mt-0.5 max-w-[16rem] truncate text-[11px] text-gray-400" title={l.notes}>
                        {l.notes}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900">
                    {[l.first_name, l.last_name].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600 whitespace-nowrap">
                    <span className="cursor-default" title={l.email || undefined}>
                      {truncateEmail(l.email)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600 hidden lg:table-cell">{l.phone || '—'}</td>
                  <td className="px-4 py-2">
                    {showDeleted ? (
                      <span className="text-xs font-medium capitalize text-gray-600">{statusLabel(l.status || 'new')}</span>
                    ) : (
                      <LeadStatusSelect
                        lead={l}
                        onConvert={() => setConvertLead(l)}
                      />
                    )}
                  </td>
                  <td className="px-4 py-2 hidden lg:table-cell">
                    {showDeleted ? (
                      <span className="text-sm text-gray-500">
                        {assigneeOptions.find((o) => o.value === (l.assigned_to || ''))?.label || '—'}
                      </span>
                    ) : (
                      <LeadAssigneeSelect
                        lead={l}
                        options={assigneeOptions}
                        loading={assigneesLoading}
                      />
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600 hidden md:table-cell">{l.title || '—'}</td>
                  <td className="px-4 py-2 text-sm text-gray-600 hidden md:table-cell">{l.company || '—'}</td>
                  <td className="px-4 py-2 align-middle min-w-[9rem]">
                    <SourceChip source={l.source} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      {showDeleted ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={restoreLead.isPending}
                            onClick={() => {
                              restoreLead.mutate(l.id, {
                                onSuccess: () => toast.success('Lead restored'),
                                onError: () => toast.error('Could not restore lead'),
                              })
                            }}
                          >
                            {restoreLead.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RotateCcw className="w-4 h-4 mr-1" />}
                            Restore
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Delete permanently"
                            onClick={() => setPendingPurge(l)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => score(l.id)} title="AI score">
                            <Sparkles className="w-4 h-4 text-primary/80" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setRoadmapLead(l)} title="Status roadmap">
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setPendingDelete(l)} title="Move to trash">
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} pages={data?.pages || 0} total={data?.total || 0} onPage={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} itemLabel="leads" />
        </CardContent>
      </Card>

      {showCreate && (
        <LeadForm
          onClose={() => setShowCreate(false)}
          onUseExisting={(lead) => {
            setShowCreate(false)
            setRoadmapLead(lead)
          }}
        />
      )}
      {roadmapLead && (
        <LeadRoadmapModal
          lead={data?.items?.find(l => l.id === roadmapLead.id) || roadmapLead}
          onClose={() => setRoadmapLead(null)}
          onConvert={() => {
            const lead = data?.items?.find(l => l.id === roadmapLead.id) || roadmapLead
            setRoadmapLead(null)
            setConvertLead(lead)
          }}
        />
      )}
      {convertLead && <ConvertModal lead={convertLead} onClose={() => setConvertLead(null)} />}
      {pendingDelete && (
        <CrmModal
          title="Move lead to trash"
          onClose={() => setPendingDelete(null)}
          maxW={modalWidthSm}
          footer={
            <>
              <Button type="button" variant="outline" onClick={() => setPendingDelete(null)}>Cancel</Button>
              <Button
                type="button"
                disabled={removeLead.isPending}
                onClick={() => {
                  removeLead.mutate(pendingDelete.id, {
                    onSuccess: () => {
                      toast.success('Lead moved to trash')
                      setPendingDelete(null)
                    },
                    onError: (err) => {
                      const status = (err as { response?: { status?: number } })?.response?.status
                      if (status === 409) {
                        toast.success('Lead is already in trash')
                        setPendingDelete(null)
                        qc.invalidateQueries({ queryKey: ['crm', 'leads'] })
                        return
                      }
                      toast.error(extractApiError(err, 'Could not delete lead'))
                    },
                  })
                }}
              >
                {removeLead.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Move to trash
              </Button>
            </>
          }
        >
          <p className="text-sm text-gray-600">
            <strong>{[pendingDelete.first_name, pendingDelete.last_name].filter(Boolean).join(' ') || pendingDelete.number}</strong>
            {' '}will be hidden from the active list. You can restore it from Deleted leads.
          </p>
        </CrmModal>
      )}
      {pendingBulkDelete && (
        <CrmModal
          title={
            showDeleted
              ? (selectedCount === 1 ? 'Delete lead permanently' : `Delete ${selectedCount} leads permanently`)
              : (selectedCount === 1 ? 'Move lead to trash' : `Move ${selectedCount} leads to trash`)
          }
          onClose={() => !bulkDeleting && setPendingBulkDelete(false)}
          maxW={modalWidthSm}
          footer={
            <>
              <Button type="button" variant="outline" disabled={bulkDeleting} onClick={() => setPendingBulkDelete(false)}>Cancel</Button>
              <Button
                type="button"
                disabled={bulkDeleting || selectedCount === 0}
                onClick={async () => {
                  const ids = Array.from(selectedIds)
                  if (!ids.length) return
                  setBulkDeleting(true)
                  let ok = 0
                  let already = 0
                  let fail = 0
                  for (const id of ids) {
                    try {
                      await crmApi.deleteLead(id, showDeleted ? { permanent: true } : undefined)
                      ok++
                    } catch (err) {
                      const status = (err as { response?: { status?: number } })?.response?.status
                      if (!showDeleted && status === 409) already++
                      else fail++
                    }
                  }
                  await qc.invalidateQueries({ queryKey: ['crm', 'leads'] })
                  setSelectedIds(new Set())
                  setPendingBulkDelete(false)
                  setBulkDeleting(false)
                  const done = ok + already
                  if (done) {
                    toast.success(
                      showDeleted
                        ? (done === 1 ? 'Lead deleted permanently' : `${done} leads deleted permanently`)
                        : (done === 1 ? 'Lead moved to trash' : `${done} leads moved to trash`),
                    )
                  }
                  if (fail) toast.error(`Could not delete ${fail} lead${fail === 1 ? '' : 's'}`)
                }}
              >
                {bulkDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                {showDeleted ? 'Delete permanently' : 'Move to trash'}
              </Button>
            </>
          }
        >
          <p className="text-sm text-gray-600">
            {showDeleted
              ? (selectedCount === 1
                ? 'The selected lead will be permanently deleted. This cannot be undone.'
                : `${selectedCount} selected leads will be permanently deleted. This cannot be undone.`)
              : (selectedCount === 1
                ? 'The selected lead will be hidden from the active list. You can restore it from Deleted leads.'
                : `${selectedCount} selected leads will be hidden from the active list. You can restore them from Deleted leads.`)}
          </p>
        </CrmModal>
      )}
      {pendingPurge && (
        <CrmModal
          title="Delete lead permanently"
          onClose={() => !purgeLead.isPending && setPendingPurge(null)}
          maxW={modalWidthSm}
          footer={
            <>
              <Button type="button" variant="outline" disabled={purgeLead.isPending} onClick={() => setPendingPurge(null)}>Cancel</Button>
              <Button
                type="button"
                disabled={purgeLead.isPending}
                onClick={() => {
                  purgeLead.mutate(pendingPurge.id, {
                    onSuccess: () => {
                      toast.success('Lead deleted permanently')
                      setPendingPurge(null)
                    },
                    onError: (err) => toast.error(extractApiError(err, 'Could not delete lead')),
                  })
                }}
              >
                {purgeLead.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Delete permanently
              </Button>
            </>
          }
        >
          <p className="text-sm text-gray-600">
            <strong>{[pendingPurge.first_name, pendingPurge.last_name].filter(Boolean).join(' ') || pendingPurge.number}</strong>
            {' '}will be permanently deleted. This cannot be undone.
          </p>
        </CrmModal>
      )}
      {pendingPurgeAll && (
        <CrmModal
          title="Delete all trashed leads"
          onClose={() => !purgeTrashed.isPending && setPendingPurgeAll(false)}
          maxW={modalWidthSm}
          footer={
            <>
              <Button type="button" variant="outline" disabled={purgeTrashed.isPending} onClick={() => setPendingPurgeAll(false)}>Cancel</Button>
              <Button
                type="button"
                disabled={purgeTrashed.isPending}
                onClick={() => {
                  purgeTrashed.mutate(undefined, {
                    onSuccess: (res) => {
                      const n = res?.deleted ?? 0
                      toast.success(n === 1 ? 'Lead deleted permanently' : `${n} leads deleted permanently`)
                      setPendingPurgeAll(false)
                      setSelectedIds(new Set())
                    },
                    onError: (err) => toast.error(extractApiError(err, 'Could not delete leads')),
                  })
                }}
              >
                {purgeTrashed.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Delete all
              </Button>
            </>
          }
        >
          <p className="text-sm text-gray-600">
            All {trashCount} lead{trashCount === 1 ? '' : 's'} in trash will be permanently deleted. This cannot be undone.
          </p>
        </CrmModal>
      )}
    </div>
  )
}
