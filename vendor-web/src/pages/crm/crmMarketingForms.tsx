import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from './_shared'
import { inputCls } from './crmContactsShared'

// ── Segment filter builder ───────────────────────────────────────────────────

export type SegmentRule = { field: string; op: string; value: string }
export type SegmentFilter = { match: 'all' | 'any'; rules: SegmentRule[] }

export const SEGMENT_FIELDS: { id: string; label: string; tagField?: boolean }[] = [
  { id: 'lifecycle_stage', label: 'Lifecycle stage' },
  { id: 'lead_source', label: 'Lead source' },
  { id: 'record_type', label: 'Contact type' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'first_name', label: 'First name' },
  { id: 'last_name', label: 'Last name' },
  { id: 'title', label: 'Job title' },
  { id: 'industry', label: 'Industry' },
  { id: 'region', label: 'Region' },
  { id: 'tags', label: 'Tag', tagField: true },
]

export const SEGMENT_OPS: { id: string; label: string; forTags?: boolean }[] = [
  { id: 'eq', label: 'equals' },
  { id: 'neq', label: 'does not equal' },
  { id: 'ilike', label: 'contains text' },
  { id: 'contains', label: 'has tag', forTags: true },
  { id: 'gte', label: '≥' },
  { id: 'lte', label: '≤' },
]

export function parseSegmentFilter(dsl?: Record<string, unknown> | null): SegmentFilter {
  if (!dsl) return { match: 'all', rules: [] }
  const any = Array.isArray(dsl.any) ? dsl.any : []
  const all = Array.isArray(dsl.all) ? dsl.all : []
  const src = any.length ? any : all
  const match = any.length ? 'any' : 'all'
  const rules: SegmentRule[] = src.map(r => {
    const row = r as Record<string, unknown>
    return {
      field: String(row.field || 'lifecycle_stage'),
      op: String(row.op || 'eq'),
      value: row.value != null ? String(row.value) : '',
    }
  })
  return { match, rules }
}

export function serializeSegmentFilter(f: SegmentFilter): Record<string, unknown> {
  const payload = f.rules
    .filter(r => r.field && r.value.trim())
    .map(r => ({ field: r.field, op: r.op, value: r.value.trim() }))
  if (!payload.length) return {}
  return f.match === 'any' ? { any: payload } : { all: payload }
}

export function SegmentFilterBuilder({
  value, onChange,
}: {
  value: SegmentFilter
  onChange: (v: SegmentFilter) => void
}) {
  const addRule = () => onChange({
    ...value,
    rules: [...value.rules, { field: 'lifecycle_stage', op: 'eq', value: '' }],
  })
  const updateRule = (idx: number, patch: Partial<SegmentRule>) => {
    const rules = value.rules.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    onChange({ ...value, rules })
  }
  const removeRule = (idx: number) => onChange({ ...value, rules: value.rules.filter((_, i) => i !== idx) })

  return (
    <div className="space-y-2 rounded-lg border p-3 bg-gray-50/50">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-gray-600">Contact must match</p>
        <select
          value={value.match}
          onChange={e => onChange({ ...value, match: e.target.value as 'all' | 'any' })}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="all">All conditions</option>
          <option value="any">Any condition</option>
        </select>
      </div>
      {value.rules.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">No rules — segment includes all contacts.</p>
      ) : value.rules.map((rule, idx) => {
        const fieldMeta = SEGMENT_FIELDS.find(f => f.id === rule.field)
        const ops = SEGMENT_OPS.filter(o => !o.forTags || fieldMeta?.tagField)
        return (
          <div key={idx} className="grid grid-cols-[1fr_auto_1fr_auto] gap-1.5 items-center">
            <select value={rule.field} onChange={e => updateRule(idx, { field: e.target.value })}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              {SEGMENT_FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
            <select value={rule.op} onChange={e => updateRule(idx, { op: e.target.value })}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm min-w-[7rem]">
              {ops.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <Input value={rule.value} onChange={e => updateRule(idx, { value: e.target.value })}
              placeholder={rule.field === 'lifecycle_stage' ? 'customer' : 'Value'}
              className="h-9" />
            <Button type="button" variant="ghost" size="sm" onClick={() => removeRule(idx)} aria-label="Remove rule">
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        )
      })}
      <Button type="button" variant="outline" size="sm" onClick={addRule}>
        <Plus className="w-3.5 h-3.5 mr-1" /> Add condition
      </Button>
      <p className="text-[11px] text-gray-400">Rows with an empty value are ignored when saving.</p>
    </div>
  )
}

// ── Workflow step builder ────────────────────────────────────────────────────

export type WorkflowStep = {
  type: string
  template_id?: string
  minutes?: number
  subject?: string
  body?: string
  user_id?: string
  field?: string
  value?: string
  url?: string
}

export const WORKFLOW_TRIGGERS = [
  { id: 'lead.created', label: 'When a lead is created' },
  { id: 'contact.created', label: 'When a contact is created' },
  { id: 'deal.won', label: 'When a deal is won' },
  { id: 'deal.lost', label: 'When a deal is lost' },
  { id: 'ticket.created', label: 'When a ticket is created' },
  { id: 'ticket.resolved', label: 'When a ticket is resolved' },
  { id: 'manual', label: 'Manual trigger only' },
]

export const WORKFLOW_STEP_TYPES = [
  { id: 'send_email', label: 'Send email' },
  { id: 'wait', label: 'Wait' },
  { id: 'create_task', label: 'Create task' },
  { id: 'assign_user', label: 'Assign to user' },
  { id: 'update_field', label: 'Update field' },
  { id: 'send_sms', label: 'Send SMS' },
  { id: 'webhook', label: 'Call webhook' },
]

export function parseWorkflowSteps(raw?: Record<string, unknown>[] | null): WorkflowStep[] {
  if (!Array.isArray(raw)) return []
  return raw.map(s => ({
    type: String(s.type || 'wait'),
    template_id: s.template_id ? String(s.template_id) : '',
    minutes: typeof s.minutes === 'number' ? s.minutes : Number(s.minutes) || 60,
    subject: s.subject ? String(s.subject) : '',
    body: s.body ? String(s.body) : '',
    user_id: s.user_id ? String(s.user_id) : '',
    field: s.field ? String(s.field) : '',
    value: s.value != null ? String(s.value) : '',
    url: s.url ? String(s.url) : '',
  }))
}

export function serializeWorkflowSteps(steps: WorkflowStep[]): Record<string, unknown>[] {
  return steps.map(s => {
    const base: Record<string, unknown> = { type: s.type }
    if (s.type === 'send_email' && s.template_id) base.template_id = s.template_id
    if (s.type === 'wait') base.minutes = s.minutes || 60
    if (s.type === 'create_task') {
      if (s.subject) base.subject = s.subject
    }
    if (s.type === 'assign_user' && s.user_id) base.user_id = s.user_id
    if (s.type === 'update_field') {
      if (s.field) base.field = s.field
      if (s.value) base.value = s.value
    }
    if (s.type === 'send_sms' && s.body) base.body = s.body
    if (s.type === 'webhook' && s.url) base.url = s.url
    return base
  })
}

export function parseWorkflowTrigger(raw?: Record<string, unknown> | null): string {
  const ev = raw?.event
  return typeof ev === 'string' ? ev : 'lead.created'
}

export function WorkflowStepBuilder({
  steps, onChange, templates, teamOptions,
}: {
  steps: WorkflowStep[]
  onChange: (s: WorkflowStep[]) => void
  templates: { id: string; name: string }[]
  teamOptions: { id: string; label: string }[]
}) {
  const add = () => onChange([...steps, { type: 'wait', minutes: 60 }])
  const update = (idx: number, patch: Partial<WorkflowStep>) => {
    onChange(steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }
  const remove = (idx: number) => onChange(steps.filter((_, i) => i !== idx))

  return (
    <div className="space-y-2">
      {steps.length === 0 && (
        <p className="text-xs text-gray-400 rounded-lg border border-dashed p-4 text-center">Add steps to define what happens after the trigger.</p>
      )}
      {steps.map((step, idx) => (
        <div key={idx} className="rounded-lg border p-3 space-y-2 bg-white">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-gray-400 w-5">{idx + 1}</span>
            <select value={step.type} onChange={e => update(idx, { type: e.target.value })}
              className={`${inputCls} flex-1 h-9`}>
              {WORKFLOW_STEP_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(idx)}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
          {step.type === 'send_email' && (
            <select value={step.template_id || ''} onChange={e => update(idx, { template_id: e.target.value })}
              className={inputCls}>
              <option value="">Select email template…</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          {step.type === 'wait' && (
            <div className="flex items-center gap-2">
              <Input type="number" min={1} value={step.minutes ?? 60}
                onChange={e => update(idx, { minutes: Number(e.target.value) })}
                className="h-9 w-24" />
              <span className="text-sm text-gray-500">minutes</span>
            </div>
          )}
          {step.type === 'create_task' && (
            <Input value={step.subject || ''} onChange={e => update(idx, { subject: e.target.value })}
              placeholder="Task subject" className="h-9" />
          )}
          {step.type === 'assign_user' && (
            <select value={step.user_id || ''} onChange={e => update(idx, { user_id: e.target.value })}
              className={inputCls}>
              <option value="">Select team member…</option>
              {teamOptions.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          )}
          {step.type === 'update_field' && (
            <div className="grid grid-cols-2 gap-2">
              <Input value={step.field || ''} onChange={e => update(idx, { field: e.target.value })}
                placeholder="Field name" className="h-9" />
              <Input value={step.value || ''} onChange={e => update(idx, { value: e.target.value })}
                placeholder="New value" className="h-9" />
            </div>
          )}
          {step.type === 'send_sms' && (
            <textarea value={step.body || ''} onChange={e => update(idx, { body: e.target.value })}
              placeholder="SMS message…" className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          )}
          {step.type === 'webhook' && (
            <Input value={step.url || ''} onChange={e => update(idx, { url: e.target.value })}
              placeholder="https://…" className="h-9" />
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="w-3.5 h-3.5 mr-1" /> Add step
      </Button>
    </div>
  )
}

// ── Email template editor ────────────────────────────────────────────────────

export const MERGE_TAGS = [
  { tag: '{{contact.first_name}}', label: 'First name' },
  { tag: '{{contact.last_name}}', label: 'Last name' },
  { tag: '{{contact.email}}', label: 'Email' },
  { tag: '{{contact.company}}', label: 'Company' },
  { tag: '{{user.name}}', label: 'Your name' },
  { tag: '{{vendor.name}}', label: 'Vendor name' },
]

export function EmailBodyEditor({
  value, onChange, plainText, onPlainTextChange,
}: {
  value: string
  onChange: (v: string) => void
  plainText?: string
  onPlainTextChange?: (v: string) => void
}) {
  const insertTag = (tag: string) => onChange(value + tag)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {MERGE_TAGS.map(m => (
          <button key={m.tag} type="button" onClick={() => insertTag(m.tag)}
            className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-gray-600">
            {m.label}
          </button>
        ))}
      </div>
      <textarea value={value} onChange={e => onChange(e.target.value)}
        placeholder="Write your email body…"
        className="flex min-h-[180px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed" />
      {onPlainTextChange && (
        <Field label="Plain text fallback (optional)">
          <textarea value={plainText || ''} onChange={e => onPlainTextChange(e.target.value)}
            className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </Field>
      )}
    </div>
  )
}

// ── Campaign drip steps ──────────────────────────────────────────────────────

export type CampaignDripStep = {
  delay_minutes: number
  channel: string
  template_id: string
}

export function CampaignStepsBuilder({
  steps, onChange, templates,
}: {
  steps: CampaignDripStep[]
  onChange: (s: CampaignDripStep[]) => void
  templates: { id: string; name: string }[]
}) {
  const add = () => onChange([...steps, { delay_minutes: 0, channel: 'email', template_id: '' }])
  const update = (idx: number, patch: Partial<CampaignDripStep>) => {
    onChange(steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }
  const remove = (idx: number) => onChange(steps.filter((_, i) => i !== idx))

  return (
    <div className="space-y-2 rounded-lg border p-3 bg-gray-50/50">
      <p className="text-xs font-medium text-gray-600">Drip sequence steps</p>
      {steps.map((step, idx) => (
        <div key={idx} className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-center bg-white rounded-md border p-2">
          <span className="text-xs text-gray-400 w-4">{idx + 1}</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 shrink-0">After</span>
            <Input type="number" min={0} value={step.delay_minutes}
              onChange={e => update(idx, { delay_minutes: Number(e.target.value) })}
              className="h-8 w-16 text-sm" />
            <span className="text-xs text-gray-500">min</span>
          </div>
          <select value={step.template_id} onChange={e => update(idx, { template_id: e.target.value })}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">Template…</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <Button type="button" variant="ghost" size="sm" onClick={() => remove(idx)}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="w-3.5 h-3.5 mr-1" /> Add step
      </Button>
    </div>
  )
}
