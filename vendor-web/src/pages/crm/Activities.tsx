import { useEffect, useMemo, useRef, useState } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  useActivities, useSaveActivity, useCompleteActivity,
} from '@/hooks/useCrm'
import { useHREmployees, useMyMembership } from '@/hooks/useVendor'
import { useAuthStore } from '@/stores/authStore'
import type { EmployeeProfile } from '@/types'
import type { Activity } from '@/api/crm'
import {
  Plus, Loader2, Activity as ActivityIcon, CheckCircle2, Calendar, Phone, Mail, Users,
  StickyNote, Bell, ArrowRight, CalendarClock, Ticket, Headphones, Wrench,
} from 'lucide-react'
import { CrmModal, Field, Pager, LoadingRow, EmptyRow } from './_shared'
import { useCrmExtras, CrmScheduleRow } from './crmExtras'
import {
  inputCls, empDisplayName, findMyEmployee,
  CrmPeopleRow, MonitorSection, validateCrmPeopleRow,
} from './crmFormShared'
import { modalWidthMd } from '@/lib/modalUi'
import { formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'

const TYPES = [
  { id: 'task', label: 'Task', icon: ActivityIcon },
  { id: 'call', label: 'Call', icon: Phone },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'meeting', label: 'Meeting', icon: Users },
  { id: 'note', label: 'Note', icon: StickyNote },
  { id: 'reminder', label: 'Reminder', icon: Bell },
  { id: 'schedule', label: 'Schedule', icon: CalendarClock },
  { id: 'followup', label: 'Follow-up', icon: ArrowRight },
  { id: 'ticket_followup', label: 'Ticket Follow-up', icon: Ticket },
  { id: 'technical_support', label: 'Technical Support', icon: Wrench },
  { id: 'support', label: 'Support', icon: Headphones },
  { id: 'other', label: 'Other', icon: ActivityIcon },
]

function activityTypeLabel(a: Activity): string {
  if (a.type === 'other') {
    const label = (a.custom_fields as Record<string, unknown> | null | undefined)?.type_label
    return typeof label === 'string' && label.trim() ? label.trim() : 'Other'
  }
  return TYPES.find(t => t.id === a.type)?.label ?? a.type.replace(/_/g, ' ')
}

function ActivityForm({ onClose }: { onClose: () => void }) {
  const save = useSaveActivity()
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
    type: 'task', type_other: '', subject: '', description: '', due_at: '', reminder_at: '',
    duration_minutes: '', priority: 'medium', status: 'open',
    location: '', meeting_url: '', outcome: '',
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
    let related_type: string | undefined
    let related_id: string | undefined
    let owner_id: string | undefined
    let description = form.description.trim()

    if (form.participant_type === 'customer' && form.participant_value) {
      const [kind, id] = form.participant_value.split(':')
      related_type = kind
      related_id = id
    } else if (form.participant_type === 'internal' && form.participant_value) {
      owner_id = form.participant_value
    } else if (form.participant_type === 'external' && form.participant_external.trim()) {
      const tag = `[External: ${form.participant_external.trim()}]`
      description = description ? `${tag}\n${description}` : tag
    }

    const custom_fields = extras.serialize({
      responsible_name: form.responsible.trim() || undefined,
      notes: form.notes.trim() || undefined,
      type_label: form.type === 'other' ? form.type_other.trim() : undefined,
      monitor_manager_id: form.monitor_manager_id || undefined,
      monitor_additional: form.monitor_additional.trim() || undefined,
    })
    const hasCustom = Object.keys(custom_fields).length > 0

    return {
      type: form.type, subject: form.subject.trim(),
      description: description || undefined,
      due_at: form.due_at || undefined,
      reminder_at: form.reminder_at || undefined,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined,
      priority: form.priority,
      status: form.status,
      location: form.location || undefined,
      meeting_url: form.meeting_url || undefined,
      outcome: form.outcome || undefined,
      related_type,
      related_id,
      owner_id,
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
          toast.success('Task saved')
          onClose()
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { detail?: string | { msg?: string }[] } } })?.response?.data?.detail
          if (typeof msg === 'string') toast.error(msg)
          else if (Array.isArray(msg)) toast.error(msg.map(d => d.msg).filter(Boolean).join(', ') || 'Could not save task')
          else toast.error('Could not save task')
        },
      },
    )
  }
  const formId = 'activity-form-new'

  return (
    <CrmModal
      title="New task"
      onClose={onClose}
      maxW={modalWidthMd}
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
            Save
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
              options={TYPES.map(t => ({ value: t.id, label: t.label }))}
            />
          </Field>
          <Field label="Priority">
            <Select
              value={form.priority}
              onChange={v => set('priority', v)}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
                { value: 'urgent', label: 'Urgent' },
              ]}
            />
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={v => set('status', v)}
              options={[
                { value: 'open', label: 'Open' },
                { value: 'in_progress', label: 'In progress' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />
          </Field>
        </div>
        {form.type === 'other' && (
          <Field label="Specify type" required>
            <Input
              value={form.type_other}
              onChange={e => set('type_other', e.target.value)}
              placeholder="Enter task type…"
            />
          </Field>
        )}
        <Field label="Subject" required><Input value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="What needs to be done?" className="h-9" /></Field>
        <Field label="Description">
          <textarea value={form.description} onChange={e => set('description', e.target.value)}
            placeholder="Details, agenda, or context…"
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

        {(form.type === 'meeting' || form.type === 'call') && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Location"><Input value={form.location} onChange={e => set('location', e.target.value)} placeholder="Office or room" className="h-9" /></Field>
            <Field label="Meeting URL"><Input value={form.meeting_url} onChange={e => set('meeting_url', e.target.value)} placeholder="https://…" className="h-9" /></Field>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="Outcome">
            <Input value={form.outcome} onChange={e => set('outcome', e.target.value)} placeholder="Result or next step" className="h-9" />
          </Field>
          <Field label="Notes">
            <Input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Internal notes…" className="h-9" />
          </Field>
        </div>

        {extras.actionToolbar}
        {extras.documentsSection}
        {extras.photosSection}
        {extras.sections}
      </form>
    </CrmModal>
  )
}

export default function ActivitiesPage() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [type, setType] = useState('')
  const [status, setStatus] = useState('open')
  const [showCreate, setShowCreate] = useState(false)
  const complete = useCompleteActivity()
  const { data, isLoading } = useActivities({ page, size: pageSize, type: type || undefined, status: status || undefined })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">CRM</p>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> New task
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {['', ...TYPES.map(t => t.id)].map(t => (
          <button key={t || 'all'} onClick={() => { setType(t); setPage(1) }}
            className={`text-xs px-3 py-1.5 rounded-full border ${type === t ? 'bg-primary text-white border-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t ? (TYPES.find(x => x.id === t)?.label ?? t) : 'all types'}
          </button>
        ))}
        <span className="w-px bg-gray-200 mx-1" />
        {['open', 'in_progress', 'completed', 'cancelled', ''].map(s => (
          <button key={s || 'all-status'} onClick={() => { setStatus(s); setPage(1) }}
            className={`text-xs px-3 py-1.5 rounded-full border ${status === s ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {s === 'open' ? 'open' : s || 'all status'}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Activity</TableColumnLabel></th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell"><TableColumnLabel>Type</TableColumnLabel></th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell"><TableColumnLabel>Due</TableColumnLabel></th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden xl:table-cell"><TableColumnLabel>Priority</TableColumnLabel></th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Status</TableColumnLabel></th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Actions</TableColumnLabel></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? <LoadingRow cols={6} /> : !data?.items?.length ? (
                <EmptyRow cols={6} message="No tasks" action={
                  <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
                    <Calendar className="w-4 h-4 mr-1" /> Schedule task
                  </Button>
                } />
              ) : data.items.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium">
                      {a.number && <span className="font-mono text-xs text-gray-400 mr-1.5">{a.number}</span>}
                      {a.subject}
                    </p>
                    {a.description && <p className="text-xs text-gray-500 line-clamp-1">{a.description}</p>}
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <Badge variant="soft">{activityTypeLabel(a)}</Badge>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-600 hidden lg:table-cell">{a.due_at ? formatDateTime(a.due_at) : '—'}</td>
                  <td className="px-6 py-4 hidden xl:table-cell">
                    <Badge variant={a.priority === 'urgent' ? 'destructive' : a.priority === 'high' ? 'warning' : 'secondary'}>
                      {a.priority || 'medium'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={a.status === 'completed' ? 'success' : a.status === 'cancelled' ? 'destructive' : 'secondary'}>
                      {a.status || 'open'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {a.status !== 'completed' && (
                      <Button variant="ghost" size="sm" onClick={() => complete.mutate({ id: a.id })} title="Mark complete">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} pages={data?.pages || 0} total={data?.total || 0} onPage={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} itemLabel="activities" />
        </CardContent>
      </Card>

      {showCreate && <ActivityForm onClose={() => setShowCreate(false)} />}
    </div>
  )
}
