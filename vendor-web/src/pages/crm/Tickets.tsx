import { useEffect, useMemo, useRef, useState } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useTickets, useSaveTicket } from '@/hooks/useCrm'
import { useHREmployees, useMyMembership } from '@/hooks/useVendor'
import { useAuthStore } from '@/stores/authStore'
import type { EmployeeProfile } from '@/types'
import { Plus, Loader2, LifeBuoy, AlertTriangle, Eye } from 'lucide-react'
import { CrmModal, Field, SearchBar, Pager, LoadingRow, EmptyRow } from './_shared'
import { useCrmExtras, CrmScheduleRow } from './crmExtras'
import {
  inputCls, empDisplayName, findMyEmployee,
  CrmPeopleRow, MonitorSection, validateCrmPeopleRow,
} from './crmFormShared'
import { formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'

const PRIORITIES = ['low', 'normal', 'high', 'urgent']
const STATUSES = ['open', 'pending', 'on_hold', 'resolved', 'closed']
const SOURCES = ['web', 'email', 'chat', 'phone', 'api', 'manual']

const TICKET_TYPES = [
  { id: 'incident', label: 'Incident' },
  { id: 'service_request', label: 'Service request' },
  { id: 'question', label: 'Question' },
  { id: 'bug', label: 'Bug' },
  { id: 'billing', label: 'Billing' },
  { id: 'technical_support', label: 'Technical support' },
  { id: 'followup', label: 'Follow-up' },
  { id: 'other', label: 'Other' },
]

function TicketForm({ onClose }: { onClose: () => void }) {
  const save = useSaveTicket()
  const extras = useCrmExtras()
  const { data: empData } = useHREmployees({ limit: 200 })
  const { data: membership } = useMyMembership()
  const employees: EmployeeProfile[] = empData?.items ?? []
  const user = useAuthStore(st => st.user)
  const meName = user?.full_name || user?.email || 'Me'
  const monitorDefaultSet = useRef(false)

  const myEmployee = useMemo(
    () => findMyEmployee(employees, user, membership?.user_id),
    [employees, user, membership?.user_id],
  )

  const [form, setForm] = useState({
    type: 'incident', type_other: '',
    subject: '', description: '',
    priority: 'normal', status: 'open', source: 'web',
    due_at: '', reminder_at: '', duration_minutes: '',
    participant_type: '', participant_value: '', participant_external: '',
    responsible: meName, notes: '',
    monitor_manager_id: '', monitor_additional: '',
  })

  useEffect(() => {
    if (monitorDefaultSet.current || !myEmployee?.manager_id) return
    setForm(p => (p.monitor_manager_id ? p : { ...p, monitor_manager_id: myEmployee.manager_id! }))
    monitorDefaultSet.current = true
  }, [myEmployee?.manager_id])

  const set = <K extends keyof typeof form>(key: K, val: (typeof form)[K]) =>
    setForm(p => ({ ...p, [key]: val }))

  const buildPayload = () => {
    let contact_id: string | undefined
    let account_id: string | undefined
    let assigned_to: string | undefined
    let description = form.description.trim()

    if (form.participant_type === 'customer' && form.participant_value) {
      const [kind, id] = form.participant_value.split(':')
      if (kind === 'account') account_id = id
      else if (kind === 'contact') contact_id = id
    } else if (form.participant_type === 'internal' && form.participant_value) {
      assigned_to = form.participant_value
    } else if (form.participant_type === 'external' && form.participant_external.trim()) {
      const tag = `[External: ${form.participant_external.trim()}]`
      description = description ? `${tag}\n${description}` : tag
    }

    const custom_fields = extras.serialize({
      ticket_type: form.type,
      type_label: form.type === 'other' ? form.type_other.trim() : undefined,
      responsible_name: form.responsible.trim() || undefined,
      notes: form.notes.trim() || undefined,
      monitor_manager_id: form.monitor_manager_id || undefined,
      monitor_additional: form.monitor_additional.trim() || undefined,
      due_at: form.due_at || undefined,
      reminder_at: form.reminder_at || undefined,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined,
    })
    const hasCustom = Object.keys(custom_fields).length > 0

    return {
      subject: form.subject.trim(),
      description: description || undefined,
      priority: form.priority,
      status: form.status,
      source: form.source,
      contact_id,
      account_id,
      assigned_to,
      custom_fields: hasCustom ? custom_fields : undefined,
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.subject.trim()) return
    if (form.type === 'other' && !form.type_other.trim()) return
    const peopleErr = validateCrmPeopleRow(form)
    if (peopleErr) {
      toast.error(peopleErr)
      return
    }

    save.mutate(
      { data: buildPayload() },
      {
        onSuccess: () => {
          toast.success('Ticket created')
          onClose()
        },
        onError: (err) => toast.error(extractApiError(err, 'Could not create ticket')),
      },
    )
  }

  const formId = 'ticket-form-new'

  return (
    <CrmModal
      title="New ticket"
      onClose={onClose}
      maxW="max-w-5xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            disabled={save.isPending || (form.type === 'other' && !form.type_other.trim())}
          >
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Create
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-2.5 pb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Field label="Type" required>
            <Select
              value={form.type}
              onChange={v => setForm(p => ({ ...p, type: v, type_other: v === 'other' ? p.type_other : '' }))}
              options={TICKET_TYPES.map(t => ({ value: t.id, label: t.label }))}
            />
          </Field>
          <Field label="Priority">
            <Select
              value={form.priority}
              onChange={v => set('priority', v)}
              options={PRIORITIES.map(p => ({ value: p, label: p }))}
            />
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={v => set('status', v)}
              options={STATUSES.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))}
            />
          </Field>
        </div>

        {form.type === 'other' && (
          <Field label="Specify type" required>
            <Input
              value={form.type_other}
              onChange={e => set('type_other', e.target.value)}
              placeholder="Enter ticket type…"
            />
          </Field>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="Subject" required>
            <Input value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Brief summary" className="h-9" />
          </Field>
          <Field label="Source">
            <Select
              value={form.source}
              onChange={v => set('source', v)}
              options={SOURCES.map(s => ({ value: s, label: s }))}
            />
          </Field>
        </div>

        <Field label="Description">
          <textarea value={form.description} onChange={e => set('description', e.target.value)}
            placeholder="Issue details or customer request…"
            className="flex min-h-[56px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </Field>

        <CrmPeopleRow
          participantType={form.participant_type}
          participantValue={form.participant_value}
          participantExternal={form.participant_external}
          onParticipantTypeChange={v => setForm(p => ({ ...p, participant_type: v, participant_value: '', participant_external: '' }))}
          onParticipantValue={v => set('participant_value', v)}
          onParticipantExternal={v => set('participant_external', v)}
          responsible={form.responsible}
          onResponsible={v => set('responsible', v)}
          meName={meName}
          employees={employees}
        />

        <MonitorSection
          managerId={form.monitor_manager_id}
          additional={form.monitor_additional}
          employees={employees}
          onManager={id => set('monitor_manager_id', id)}
          onAdditional={v => set('monitor_additional', v)}
        />

        <CrmScheduleRow
          dueAt={form.due_at}
          onDueAt={v => set('due_at', v)}
          reminderAt={form.reminder_at}
          onReminderAt={v => set('reminder_at', v)}
          duration={form.duration_minutes}
          onDuration={v => set('duration_minutes', v)}
        />

        <Field label="Notes">
          <Input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Internal notes…" className="h-9" />
        </Field>

        {extras.actionToolbar}
        {extras.documentsSection}
        {extras.photosSection}
        {extras.sections}
      </form>
    </CrmModal>
  )
}

export default function TicketsPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [status, setStatus] = useState('open')
  const [showCreate, setShowCreate] = useState(false)
  const { data, isLoading } = useTickets({ page, size: 20, q: search || undefined, status: status || undefined })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">CRM</p>
          <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> New ticket
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {['', ...STATUSES].map(s => (
          <button key={s || 'all'} onClick={() => { setStatus(s); setPage(1) }}
            className={`text-xs px-3 py-1.5 rounded-full border ${status === s ? 'bg-primary text-white border-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {s || 'all'}
          </button>
        ))}
      </div>

      <SearchBar value={searchInput} onChange={setSearchInput}
        onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1) }}
        placeholder="Search tickets…" />

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Ticket</TableColumnLabel></th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell"><TableColumnLabel>Priority</TableColumnLabel></th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Status</TableColumnLabel></th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell"><TableColumnLabel>Source</TableColumnLabel></th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden xl:table-cell"><TableColumnLabel>Updated</TableColumnLabel></th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Action</TableColumnLabel></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? <LoadingRow cols={6} /> : !data?.items?.length ? (
                <EmptyRow cols={6} message="No tickets" action={
                  <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
                    <LifeBuoy className="w-4 h-4 mr-1" /> Open ticket
                  </Button>
                } />
              ) : data.items.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-400">{t.number}</span>
                      <span className="truncate">{t.subject}</span>
                      {t.sla_breached && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" aria-label="SLA breached" />}
                    </p>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <Badge variant={t.priority === 'urgent' ? 'destructive' : t.priority === 'high' ? 'warning' : 'secondary'}>{t.priority}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={t.status === 'resolved' || t.status === 'closed' ? 'success' : 'soft'}>{t.status}</Badge>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-600 hidden lg:table-cell">{t.source}</td>
                  <td className="px-6 py-4 text-xs text-gray-500 hidden xl:table-cell">{formatDateTime(t.updated_at)}</td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/crm/tickets/${t.id}`)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} pages={data?.pages || 0} total={data?.total || 0} onPage={setPage} />
        </CardContent>
      </Card>

      {showCreate && <TicketForm onClose={() => setShowCreate(false)} />}
    </div>
  )
}
