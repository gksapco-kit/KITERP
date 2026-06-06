import { Fragment, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  useDeal, usePipelines, useSaveDeal, useMoveDeal,
  useCommunications, useLogCommunication,
  useAuditLog, useAiInsights, useAiSummarise,
} from '@/hooks/useCrm'
import type { Communication, AuditLog, Stage } from '@/api/crm'
import { crmApi } from '@/api/crm'
import { vendorApi } from '@/api/vendor'
import { useHREmployees } from '@/hooks/useVendor'
import { useAuthStore } from '@/stores/authStore'
import type { EmployeeProfile } from '@/types'
import { CrmModal } from './_shared'
import { currencySymbol, amountInWords } from './crmExtras'
import { cn, formatCurrency, formatDateTime } from '@/lib/utils'
import {
  Loader2, Plus, Trash2, Check, CheckCircle2, Circle, GitBranch, Trophy, XCircle,
  StickyNote, Phone, CalendarClock, ListTodo, MessageSquare, Paperclip, ImagePlus,
  FileText, Sparkles, ArrowRight, Flag, User, Bell, Mail, Clock, Pencil,
} from 'lucide-react'

type StepAttachment = { url: string; filename: string }
type ChecklistItem = {
  text: string; done: boolean; added_at?: string; done_at?: string
  note?: string; assignee?: string; type?: string; due_at?: string; reminder_at?: string
  attachments?: StepAttachment[]; created_by?: string
}
const nowIso = () => new Date().toISOString()

const STEP_TYPES = [
  { value: 'task', label: 'Task', icon: ListTodo },
  { value: 'meeting', label: 'Schedule meeting', icon: CalendarClock },
  { value: 'reminder', label: 'Reminder', icon: Bell },
  { value: 'followup', label: 'Follow-up', icon: ArrowRight },
  { value: 'call', label: 'Call', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'note', label: 'Text / Note', icon: StickyNote },
]
const stepMeta = (type?: string) => STEP_TYPES.find(t => t.value === type) || STEP_TYPES[0]

function itemStatus(i: ChecklistItem): { label: string; cls: string } {
  if (i.done) return { label: 'Done', cls: 'bg-emerald-50 text-emerald-700' }
  if (i.due_at && new Date(i.due_at).getTime() < Date.now()) return { label: 'Overdue', cls: 'bg-rose-50 text-rose-700' }
  return { label: 'Pending', cls: 'bg-amber-50 text-amber-700' }
}
const asObjArray = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v.filter(x => x && typeof x === 'object') as Record<string, unknown>[]) : []
const s = (v: unknown) => (v == null ? '' : String(v))

function SectionTitle({ icon: Icon, children, right }: { icon: typeof StickyNote; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Icon className="w-4 h-4 text-gray-400" />{children}</h3>
      {right}
    </div>
  )
}

export function DealDetail({ dealId, onClose }: { dealId: string; onClose: () => void }) {
  const { data: deal, isLoading } = useDeal(dealId)
  const { data: pipelines } = usePipelines()
  const saveDeal = useSaveDeal()
  const moveDeal = useMoveDeal()
  const [editing, setEditing] = useState(false)

  const pipeline = pipelines?.find(p => p.id === deal?.pipeline_id)
  const stages = pipeline?.stages || []
  const stageName = (id?: string | null) => stages.find(st => st.id === id)?.name || '—'
  const cf = (deal?.custom_fields || {}) as Record<string, unknown>

  const patchCustom = (patch: Record<string, unknown>) =>
    saveDeal.mutate({ id: dealId, data: { custom_fields: { ...cf, ...patch } } })

  if (isLoading || !deal) {
    return (
      <CrmModal title="Deal" onClose={onClose} maxW="max-w-4xl">
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      </CrmModal>
    )
  }

  return (
    <CrmModal
      title={
        <span>
          {deal.number && <span className="font-mono text-xs text-gray-400 mr-2">{deal.number}</span>}
          {deal.title}
        </span>
      }
      onClose={onClose}
      maxW="max-w-4xl"
      headerActions={
        editing ? (
          <Button type="button" size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setEditing(false)}>
            <Check className="w-4 h-4 mr-1" /> Save
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="w-4 h-4 mr-1" /> Edit
          </Button>
        )
      }
    >
      <div className="space-y-5">
        <DealHeader deal={deal} stageName={stageName} />
        <PendingBanner cf={cf} stageLabel={stageName(deal.stage_id)} />
        {/* Read-only until the user clicks Edit */}
        <div className={cn('space-y-5', !editing && 'pointer-events-none opacity-90 select-none')} aria-disabled={!editing}>
          <Roadmap deal={deal} stages={stages} moveDeal={moveDeal} cf={cf} patchCustom={patchCustom} />
          <DealControls deal={deal} stages={stages} saveDeal={saveDeal} moveDeal={moveDeal} />
          <DealDetails cf={cf} patchCustom={patchCustom} />
          <Checklist cf={cf} patchCustom={patchCustom} />
          <Conversations dealId={dealId} />
          <Attachments dealId={dealId} cf={cf} patchCustom={patchCustom} />
        </div>
        <AiSummary dealId={dealId} />
        <StageHistory dealId={dealId} stageName={stageName} />

        <div className="flex justify-end gap-2 pt-1">
          {editing ? (
            <Button type="button" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setEditing(false)}>
              <Check className="w-4 h-4 mr-1" /> Save
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="w-4 h-4 mr-1" /> Edit
            </Button>
          )}
          <Button type="button" variant="cancel" onClick={onClose}>Close</Button>
        </div>
      </div>
    </CrmModal>
  )
}

function Roadmap({ deal, stages, moveDeal, cf, patchCustom }: {
  deal: NonNullable<ReturnType<typeof useDeal>['data']>
  stages: Stage[]
  moveDeal: ReturnType<typeof useMoveDeal>
  cf: Record<string, unknown>
  patchCustom: (p: Record<string, unknown>) => void
}) {
  const currentStageId = deal.stage_id
  const status = deal.status
  if (!stages.length) return null
  const currentIndex = stages.findIndex(st => st.id === currentStageId)

  return (
    <div className="rounded-xl border p-4">
      <SectionTitle icon={GitBranch}>Roadmap</SectionTitle>
      <div className="flex items-start overflow-x-auto pb-1">
        {stages.map((st, idx) => {
          const done = currentIndex >= 0 && idx < currentIndex
          const current = idx === currentIndex
          let dot = 'bg-gray-100 text-gray-400 border border-gray-200'
          if (done) dot = 'bg-emerald-500 text-white'
          else if (current) dot = status === 'won' ? 'bg-emerald-500 text-white'
            : status === 'lost' ? 'bg-rose-500 text-white'
            : 'bg-blue-600 text-white ring-4 ring-blue-100'
          return (
            <Fragment key={st.id}>
              <div className="flex w-[88px] shrink-0 flex-col items-center">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${dot}`}>
                  {done ? <Check className="w-4 h-4" />
                    : current && status === 'won' ? <Trophy className="w-4 h-4" />
                    : current && status === 'lost' ? <XCircle className="w-4 h-4" />
                    : idx + 1}
                </div>
                <span className={`mt-1 text-center text-[11px] leading-tight ${current ? 'font-semibold text-gray-800' : done ? 'text-gray-600' : 'text-gray-400'}`}>
                  {st.name}
                </span>
              </div>
              {idx < stages.length - 1 && (
                <div className={`mt-3.5 h-0.5 flex-1 min-w-[16px] ${idx < currentIndex ? 'bg-emerald-400' : 'bg-gray-200'}`} />
              )}
            </Fragment>
          )
        })}
      </div>
      <div className="mt-3 border-t pt-3">
        <NextStageMover deal={deal} stages={stages} moveDeal={moveDeal} cf={cf} patchCustom={patchCustom} />
      </div>
    </div>
  )
}

function NextStageMover({ deal, stages, moveDeal, cf, patchCustom }: {
  deal: NonNullable<ReturnType<typeof useDeal>['data']>
  stages: Stage[]
  moveDeal: ReturnType<typeof useMoveDeal>
  cf: Record<string, unknown>
  patchCustom: (p: Record<string, unknown>) => void
}) {
  const currentIndex = stages.findIndex(st => st.id === deal.stage_id)
  const next = currentIndex >= 0 ? stages[currentIndex + 1] : undefined
  const { data: empData } = useHREmployees({ limit: 200 })
  const employees: EmployeeProfile[] = empData?.items ?? []
  const empName = (e: EmployeeProfile) => e.vendor_user?.user?.full_name ?? e.employee_code
  const user = useAuthStore(st => st.user)
  const creatorName = user?.full_name || user?.email || 'You'

  const [open, setOpen] = useState(false)
  const [type, setType] = useState('task')
  const [text, setText] = useState('')
  const [assignee, setAssignee] = useState('')
  const [when, setWhen] = useState('')
  const [reminder, setReminder] = useState('')

  if (!next) {
    return <p className="text-sm text-gray-500">This is the final stage of the pipeline.</p>
  }

  const doMove = (withItem: boolean) => {
    if (withItem) {
      const item = {
        text: text.trim() || `Work on ${next.name}`,
        type, done: false, added_at: nowIso(), created_by: creatorName,
        assignee: assignee || undefined, due_at: when || undefined, reminder_at: reminder || undefined,
      }
      patchCustom({ checklist: [...asObjArray(cf.checklist), item] })
    }
    moveDeal.mutate({ id: deal.id, payload: { stage_id: next.id } })
    setOpen(false); setText(''); setAssignee(''); setWhen(''); setReminder('')
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600">Next stage: <span className="font-semibold text-gray-900">{next.name}</span></p>
        <Button type="button" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setOpen(o => !o)}>
          Move to {next.name} <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t pt-3">
          <p className="text-xs font-medium text-gray-500">Create an action item for “{next.name}” (optional)</p>
          <div className="flex flex-wrap gap-2">
            <select value={type} onChange={e => setType(e.target.value)} className="h-9 w-[150px] rounded-md border border-input bg-background px-2 text-sm">
              {STEP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <Input value={text} onChange={e => setText(e.target.value)} placeholder={`e.g. Work on ${next.name}`} className="h-9 flex-1 min-w-[160px]" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={assignee} onChange={e => setAssignee(e.target.value)} className="h-9 w-[200px] rounded-md border border-input bg-background px-2 text-sm">
              <option value="">— Responsible person —</option>
              {employees.map(e => <option key={e.id} value={empName(e)}>{empName(e)}</option>)}
            </select>
            <label className="flex items-center gap-1 text-xs text-gray-500"><Clock className="w-3.5 h-3.5" />When
              <Input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} className="h-9 w-[180px]" /></label>
            <label className="flex items-center gap-1 text-xs text-gray-500"><Bell className="w-3.5 h-3.5" />Reminder
              <Input type="datetime-local" value={reminder} onChange={e => setReminder(e.target.value)} className="h-9 w-[180px]" /></label>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="cancel" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => doMove(false)}>Move only</Button>
            <Button type="button" size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => doMove(true)}>
              Move &amp; add action
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

function PendingBanner({ cf, stageLabel }: { cf: Record<string, unknown>; stageLabel: string }) {
  const open = asObjArray(cf.checklist).filter(i => !i.done)
  const overdue = open.filter(i => i.due_at && new Date(s(i.due_at)).getTime() < Date.now()).length
  const people = Array.from(new Set(open.map(i => s(i.assignee)).filter(Boolean)))
  const unassigned = open.length - open.filter(i => s(i.assignee)).length

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Flag className="w-4 h-4 text-amber-600 shrink-0" />
        <span className="text-amber-900 font-medium">{stageLabel}</span>
        {open.length === 0 ? (
          <span className="text-amber-700">— no pending action items</span>
        ) : (
          <>
            <span className="text-amber-700">— {open.length} pending{overdue > 0 ? `, ${overdue} overdue` : ''} · with</span>
            {people.map(p => (
              <span key={p} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-blue-700 border border-blue-100">
                <User className="w-3 h-3" />{p}
              </span>
            ))}
            {unassigned > 0 && (
              <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-200">
                {unassigned} unassigned
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function DealHeader({ deal, stageName }: { deal: NonNullable<ReturnType<typeof useDeal>['data']>; stageName: (id?: string | null) => string }) {
  const statusTone = deal.status === 'won' ? 'success' : deal.status === 'lost' ? 'destructive' : 'soft'
  const cf = (deal.custom_fields || {}) as Record<string, unknown>
  const ownerName = typeof cf.owner_name === 'string' ? cf.owner_name : ''
  const openItems = asObjArray(cf.checklist).filter(i => !i.done)
  const pendingPeople = Array.from(new Set(openItems.map(i => s(i.assignee)).filter(Boolean)))
  const pendingUnassigned = openItems.length - openItems.filter(i => s(i.assignee)).length
  return (
    <div className="rounded-xl border bg-gray-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(deal.amount, deal.currency)}</p>
          <p className="text-xs text-gray-500 mt-0.5">{amountInWords(deal.amount)} {deal.currency}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={statusTone as never}>{deal.status}</Badge>
          <Badge variant="secondary"><GitBranch className="w-3 h-3 mr-1" />{stageName(deal.stage_id)}</Badge>
          {ownerName && (
            <Badge variant="soft"><User className="w-3 h-3 mr-1" />{ownerName}</Badge>
          )}
        </div>
      </div>

      {(pendingPeople.length > 0 || pendingUnassigned > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="font-medium text-amber-700">Pending with:</span>
          {pendingPeople.map(p => (
            <span key={p} className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-800">
              <User className="w-3 h-3" />{p}
            </span>
          ))}
          {pendingUnassigned > 0 && (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-800">
              {pendingUnassigned} unassigned
            </span>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 mt-3 text-xs text-gray-600">
        {deal.probability != null && <p><span className="text-gray-400">Probability:</span> {deal.probability}%</p>}
        {deal.expected_close_date && <p><span className="text-gray-400">Closes:</span> {formatDateTime(deal.expected_close_date)}</p>}
        {deal.source && <p><span className="text-gray-400">Source:</span> {deal.source}</p>}
        {deal.won_reason && <p className="text-emerald-600">Won: {deal.won_reason}</p>}
        {deal.lost_reason && <p className="text-rose-600">Lost: {deal.lost_reason}</p>}
      </div>
    </div>
  )
}

function DealControls({ deal, stages, saveDeal, moveDeal }: {
  deal: NonNullable<ReturnType<typeof useDeal>['data']>
  stages: Stage[]
  saveDeal: ReturnType<typeof useSaveDeal>
  moveDeal: ReturnType<typeof useMoveDeal>
}) {
  const [reason, setReason] = useState('')
  const [prob, setProb] = useState(deal.probability != null ? String(deal.probability) : '')
  const { data: empData } = useHREmployees({ limit: 200 })
  const employees: EmployeeProfile[] = empData?.items ?? []
  const empName = (e: EmployeeProfile) => e.vendor_user?.user?.full_name ?? e.employee_code
  const user = useAuthStore(st => st.user)
  const meName = user?.full_name || user?.email || 'Me'
  const cf = (deal.custom_fields || {}) as Record<string, unknown>
  const owner = typeof cf.owner_name === 'string' ? cf.owner_name : ''
  const setOwner = (name: string) =>
    saveDeal.mutate({ id: deal.id, data: { custom_fields: { ...cf, owner_name: name || undefined } } })

  // Marking won/lost also moves the deal to the Closed Won / Closed Lost stage
  // so the roadmap + stage history reflect it identically.
  const markOutcome = (won: boolean) => {
    const target = stages.find(st => (won ? st.is_won : st.is_lost))
    if (target && target.id !== deal.stage_id) {
      moveDeal.mutate({ id: deal.id, payload: { stage_id: target.id } })
    }
    saveDeal.mutate({
      id: deal.id,
      data: won
        ? { status: 'won', won_reason: reason || undefined }
        : { status: 'lost', lost_reason: reason || undefined },
    })
  }

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <SectionTitle icon={Flag}>Deal controls</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-gray-500">Deal owner</label>
          <div className="relative mt-1">
            <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <select value={owner} onChange={e => setOwner(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background pl-8 pr-2 text-sm">
              <option value="">— Unassigned —</option>
              <option value={meName}>{meName} (me)</option>
              {owner && owner !== meName && !employees.some(e => empName(e) === owner) && <option value={owner}>{owner}</option>}
              {employees.filter(e => empName(e) !== meName).map(e => <option key={e.id} value={empName(e)}>{empName(e)}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500">Stage</label>
          <select value={deal.stage_id} onChange={e => moveDeal.mutate({ id: deal.id, payload: { stage_id: e.target.value } })}
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
            {stages.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Probability %</label>
          <div className="mt-1 flex gap-2">
            <Input type="number" min="0" max="100" value={prob} onChange={e => setProb(e.target.value)} className="h-9" />
            <Button type="button" variant="outline" size="sm" className="h-9 shrink-0"
              onClick={() => saveDeal.mutate({ id: deal.id, data: { probability: prob === '' ? null : Number(prob) } })}>
              Save
            </Button>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Win / loss reason (optional)" className="h-9 flex-1 min-w-[180px]" />
        <Button type="button" size="sm" className="h-9 bg-emerald-600 hover:bg-emerald-700"
          disabled={saveDeal.isPending} onClick={() => markOutcome(true)}>
          <Trophy className="w-4 h-4 mr-1" /> Mark won
        </Button>
        <Button type="button" size="sm" variant="destructive" className="h-9"
          disabled={saveDeal.isPending} onClick={() => markOutcome(false)}>
          <XCircle className="w-4 h-4 mr-1" /> Mark lost
        </Button>
        {deal.status !== 'open' && (
          <Button type="button" size="sm" variant="outline" className="h-9"
            onClick={() => saveDeal.mutate({ id: deal.id, data: { status: 'open' } })}>
            Reopen
          </Button>
        )}
      </div>
    </div>
  )
}

const DEAL_RESERVED_CF = ['checklist', 'documents', 'photos', 'next_step', 'next_step_at', 'owner_name', 'reminders', 'schedules']

function DealDetails({ cf, patchCustom }: { cf: Record<string, unknown>; patchCustom: (p: Record<string, unknown>) => void }) {
  const entries = Object.entries(cf).filter(([k, v]) => !DEAL_RESERVED_CF.includes(k) && (typeof v === 'string' || typeof v === 'number'))
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const addField = () => {
    if (!key.trim() || DEAL_RESERVED_CF.includes(key.trim())) return
    patchCustom({ [key.trim()]: value.trim() })
    setKey(''); setValue('')
  }
  return (
    <div className="rounded-xl border p-4">
      <SectionTitle icon={FileText}>More details</SectionTitle>
      {entries.length > 0 && (
        <dl className="mb-2 rounded-lg border px-4">
          {entries.map(([k, v]) => (
            <div key={k} className="grid grid-cols-3 gap-3 py-2 border-b last:border-b-0 group">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{k}</dt>
              <dd className="col-span-2 flex items-start justify-between gap-2 text-sm text-gray-800 break-words">
                <span>{String(v)}</span>
                <button type="button" onClick={() => patchCustom({ [k]: undefined })} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div className="flex gap-2">
        <Input value={key} onChange={e => setKey(e.target.value)} placeholder="Field name" className="h-9 flex-1" />
        <Input value={value} onChange={e => setValue(e.target.value)} placeholder="Value" className="h-9 flex-1"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addField() } }} />
        <Button type="button" variant="outline" size="sm" className="h-9" onClick={addField}><Plus className="w-4 h-4" /></Button>
      </div>
    </div>
  )
}

function Checklist({ cf, patchCustom }: { cf: Record<string, unknown>; patchCustom: (p: Record<string, unknown>) => void }) {
  const items: ChecklistItem[] = asObjArray(cf.checklist).map(i => ({
    text: s(i.text), done: !!i.done, added_at: s(i.added_at) || undefined,
    done_at: s(i.done_at) || undefined,     note: s(i.note) || undefined, assignee: s(i.assignee) || undefined,
    type: s(i.type) || 'task', due_at: s(i.due_at) || undefined, reminder_at: s(i.reminder_at) || undefined,
    created_by: s(i.created_by) || undefined,
    attachments: asObjArray(i.attachments).map(a => ({ url: s(a.url), filename: s(a.filename) || 'file' })).filter(a => a.url),
  }))
  const [draft, setDraft] = useState('')
  const [newType, setNewType] = useState('task')
  const [newWhen, setNewWhen] = useState('')
  const [newReminder, setNewReminder] = useState('')
  const [noteEditing, setNoteEditing] = useState<number | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [assignEditing, setAssignEditing] = useState<number | null>(null)
  const [assignDraft, setAssignDraft] = useState('')
  const [dueEditing, setDueEditing] = useState<number | null>(null)
  const [dueDraft, setDueDraft] = useState('')
  const [remEditing, setRemEditing] = useState<number | null>(null)
  const [remDraft, setRemDraft] = useState('')
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null)
  const attachIdx = useRef<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { data: empData } = useHREmployees({ limit: 200 })
  const employees: EmployeeProfile[] = empData?.items ?? []
  const empName = (e: EmployeeProfile) => e.vendor_user?.user?.full_name ?? e.employee_code
  const currentUser = useAuthStore(st => st.user)
  const creatorName = currentUser?.full_name || currentUser?.email || 'You'
  const done = items.filter(i => i.done).length
  const overdue = items.filter(i => !i.done && i.due_at && new Date(i.due_at).getTime() < Date.now()).length

  const save = (next: ChecklistItem[]) => patchCustom({ checklist: next })
  const update = (idx: number, patch: Partial<ChecklistItem>) =>
    save(items.map((i, n) => (n === idx ? { ...i, ...patch } : i)))
  const add = () => {
    if (!draft.trim()) return
    save([...items, { text: draft.trim(), type: newType, done: false, added_at: nowIso(), due_at: newWhen || undefined, reminder_at: newReminder || undefined, created_by: creatorName }])
    setDraft(''); setNewWhen(''); setNewReminder('')
  }
  const WHEN_LABEL: Record<string, string> = {
    meeting: 'Meeting time', reminder: 'Remind at', followup: 'Follow-up on',
    call: 'Call at', email: 'Send by', task: 'Due',
  }
  const toggle = (idx: number) => update(idx, { done: !items[idx].done, done_at: !items[idx].done ? nowIso() : undefined })
  const remove = (idx: number) => save(items.filter((_, n) => n !== idx))
  const openNote = (idx: number) => {
    if (noteEditing === idx) { setNoteEditing(null); return }
    setNoteEditing(idx); setNoteDraft(items[idx].note || '')
  }
  const commitNote = (idx: number) => { update(idx, { note: noteDraft.trim() || undefined }); setNoteEditing(null); setNoteDraft('') }
  const openAssign = (idx: number) => {
    if (assignEditing === idx) { setAssignEditing(null); return }
    setAssignEditing(idx); setAssignDraft(items[idx].assignee || '')
  }
  const commitAssign = (idx: number) => { update(idx, { assignee: assignDraft.trim() || undefined }); setAssignEditing(null); setAssignDraft('') }
  const openDue = (idx: number) => {
    if (dueEditing === idx) { setDueEditing(null); return }
    setDueEditing(idx); setDueDraft(items[idx].due_at || '')
  }
  const commitDue = (idx: number) => { update(idx, { due_at: dueDraft || undefined }); setDueEditing(null); setDueDraft('') }
  const openRem = (idx: number) => {
    if (remEditing === idx) { setRemEditing(null); return }
    setRemEditing(idx); setRemDraft(items[idx].reminder_at || '')
  }
  const commitRem = (idx: number) => { update(idx, { reminder_at: remDraft || undefined }); setRemEditing(null); setRemDraft('') }

  const pickFile = (idx: number) => { attachIdx.current = idx; fileRef.current?.click() }
  const onAttach = async (files: FileList | null) => {
    const idx = attachIdx.current
    if (idx == null || !files?.length) return
    setUploadingIdx(idx)
    try {
      const added: StepAttachment[] = []
      for (const f of Array.from(files)) {
        const d = await crmApi.uploadDocument(f)
        added.push({ url: d.url, filename: d.filename })
      }
      update(idx, { attachments: [...(items[idx].attachments || []), ...added] })
    } finally {
      setUploadingIdx(null); attachIdx.current = null
      if (fileRef.current) fileRef.current.value = ''
    }
  }
  const removeAttachment = (idx: number, url: string) =>
    update(idx, { attachments: (items[idx].attachments || []).filter(a => a.url !== url) })

  return (
    <div className="rounded-xl border p-4">
      <SectionTitle icon={ListTodo} right={items.length ? (
        <span className="text-xs text-gray-400">
          {done}/{items.length} done{overdue > 0 ? <span className="text-rose-600 font-medium"> • {overdue} overdue</span> : null}
        </span>
      ) : undefined}>
        Action items &amp; activities
      </SectionTitle>
      <input ref={fileRef} type="file" multiple className="hidden"
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" onChange={e => onAttach(e.target.files)} />
      <ul className="space-y-1.5 mb-3">
        {items.map((i, idx) => {
          const Meta = stepMeta(i.type)
          const TypeIcon = Meta.icon
          return (
            <li key={idx} className="rounded-lg border p-2 group">
              <div className="flex items-start gap-2">
                <button type="button" onClick={() => toggle(idx)} className="shrink-0 mt-0.5 text-gray-500 hover:text-emerald-600">
                  {i.done ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Circle className="w-4 h-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                      <TypeIcon className="w-3 h-3" />{Meta.label}
                    </span>
                    <p className={`text-sm ${i.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{i.text}</p>
                    {i.assignee ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                        <User className="w-3 h-3" />{i.assignee}
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-amber-600">unassigned</span>
                    )}
                    {i.due_at && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700">
                        <Clock className="w-3 h-3" />{formatDateTime(i.due_at)}
                      </span>
                    )}
                    {i.reminder_at && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700">
                        <Bell className="w-3 h-3" />{formatDateTime(i.reminder_at)}
                      </span>
                    )}
                    {(() => { const st = itemStatus(i); return (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.label}</span>
                    ) })()}
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {i.added_at ? `Added ${formatDateTime(i.added_at)}` : ''}
                    {i.created_by ? ` by ${i.created_by}` : ''}
                    {i.done && i.done_at ? `${i.added_at ? ' • ' : ''}✓ Done ${formatDateTime(i.done_at)}` : ''}
                  </p>

                  {assignEditing === idx && (
                    <div className="mt-1 flex items-center gap-1">
                      <select autoFocus value={assignDraft} onChange={e => setAssignDraft(e.target.value)}
                        className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs">
                        <option value="">— Unassigned —</option>
                        {assignDraft && !employees.some(e => empName(e) === assignDraft) && (
                          <option value={assignDraft}>{assignDraft}</option>
                        )}
                        {employees.map(e => <option key={e.id} value={empName(e)}>{empName(e)}</option>)}
                      </select>
                      <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" onClick={() => commitAssign(idx)}>Save</Button>
                    </div>
                  )}
                  {dueEditing === idx && (
                    <div className="mt-1 flex items-center gap-1">
                      <span className="text-[11px] text-gray-400 w-10">Due</span>
                      <Input autoFocus type="datetime-local" value={dueDraft} onChange={e => setDueDraft(e.target.value)} className="h-8 text-xs" />
                      <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" onClick={() => commitDue(idx)}>Save</Button>
                    </div>
                  )}
                  {remEditing === idx && (
                    <div className="mt-1 flex items-center gap-1">
                      <span className="text-[11px] text-gray-400 w-10">Remind</span>
                      <Input autoFocus type="datetime-local" value={remDraft} onChange={e => setRemDraft(e.target.value)} className="h-8 text-xs" />
                      <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" onClick={() => commitRem(idx)}>Save</Button>
                    </div>
                  )}
                  {noteEditing === idx ? (
                    <div className="mt-1 flex items-start gap-1">
                      <Textarea autoFocus value={noteDraft} onChange={e => setNoteDraft(e.target.value)}
                        placeholder="Add a note for this step…" className="min-h-[36px] text-xs"
                        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commitNote(idx) } }} />
                      <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" onClick={() => commitNote(idx)}>Save</Button>
                    </div>
                  ) : i.note ? (
                    <p className="mt-0.5 text-[11px] text-gray-500 flex items-start gap-1">
                      <StickyNote className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                      <span className="whitespace-pre-wrap">{i.note}</span>
                    </p>
                  ) : null}

                  {!!i.attachments?.length && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {i.attachments.map(a => (
                        <span key={a.url} className="inline-flex items-center gap-1 rounded-full border bg-gray-50 px-2 py-0.5 text-[11px] text-gray-700">
                          <Paperclip className="w-3 h-3 text-gray-500" />
                          <a href={a.url} target="_blank" rel="noreferrer" className="max-w-[140px] truncate text-blue-600 hover:underline">{a.filename}</a>
                          <button type="button" onClick={() => removeAttachment(idx, a.url)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" title="Responsible person" onClick={() => openAssign(idx)}
                    className={`${i.assignee ? 'text-blue-600' : 'text-gray-500'} hover:text-blue-700`}>
                    <User className="w-4 h-4" />
                  </button>
                  <button type="button" title="Due date" onClick={() => openDue(idx)}
                    className={`${i.due_at ? 'text-purple-600' : 'text-gray-500'} hover:text-purple-700`}>
                    <Clock className="w-4 h-4" />
                  </button>
                  <button type="button" title="Reminder" onClick={() => openRem(idx)}
                    className={`${i.reminder_at ? 'text-orange-600' : 'text-gray-500'} hover:text-orange-700`}>
                    <Bell className="w-4 h-4" />
                  </button>
                  <button type="button" title="Add note" onClick={() => openNote(idx)}
                    className={`${i.note ? 'text-amber-600' : 'text-gray-500'} hover:text-amber-700`}>
                    <StickyNote className="w-4 h-4" />
                  </button>
                  <button type="button" title="Pin attachment" onClick={() => pickFile(idx)} disabled={uploadingIdx === idx}
                    className={`${i.attachments?.length ? 'text-indigo-600' : 'text-gray-500'} hover:text-indigo-700`}>
                    {uploadingIdx === idx ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                  </button>
                  <button type="button" title="Delete" onClick={() => remove(idx)} className="text-gray-500 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="space-y-2 rounded-lg border border-dashed p-2">
        <div className="flex flex-wrap gap-2">
          <select value={newType} onChange={e => setNewType(e.target.value)}
            className="h-9 w-[160px] rounded-md border border-input bg-background px-2 text-sm">
            {STEP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <Input value={draft} onChange={e => setDraft(e.target.value)}
            placeholder={`Add ${stepMeta(newType).label.toLowerCase()}…`} className="h-9 flex-1 min-w-[160px]"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {newType !== 'note' && (
            <label className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock className="w-3.5 h-3.5" />{WHEN_LABEL[newType] || 'When'}
              <Input type="datetime-local" value={newWhen} onChange={e => setNewWhen(e.target.value)} className="h-9 w-[185px]" />
            </label>
          )}
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            <Bell className="w-3.5 h-3.5" />Reminder
            <Input type="datetime-local" value={newReminder} onChange={e => setNewReminder(e.target.value)} className="h-9 w-[185px]" />
          </label>
          <Button type="button" variant="outline" size="sm" className="h-9 ml-auto" onClick={add}><Plus className="w-4 h-4 mr-1" /> Add</Button>
        </div>
      </div>
    </div>
  )
}

function StageHistory({ dealId, stageName }: { dealId: string; stageName: (id?: string | null) => string }) {
  const { data } = useAuditLog({ entity: 'crm_deal', entity_id: dealId, size: 100 })
  const events = (data?.items || []).filter((a: AuditLog) => ['create', 'stage_change', 'convert'].includes(a.action))
  return (
    <div className="rounded-xl border p-4">
      <SectionTitle icon={GitBranch}>Stage history</SectionTitle>
      {events.length === 0 ? (
        <p className="text-sm text-gray-400">No stage changes recorded yet.</p>
      ) : (
        <ol className="relative border-l border-gray-200 ml-1.5 space-y-3">
          {events.map((a: AuditLog) => {
            const after = (a.after || {}) as Record<string, unknown>
            const toStage = after.stage_id ? stageName(s(after.stage_id)) : null
            return (
              <li key={a.id} className="ml-4">
                <span className="absolute -left-[5px] mt-1 w-2.5 h-2.5 rounded-full bg-blue-500" />
                <p className="text-sm text-gray-700">
                  {a.action === 'create' ? 'Deal created' : a.action === 'convert' ? 'Created from lead' : `Moved to ${toStage || 'new stage'}`}
                </p>
                <p className="text-xs text-gray-400">{formatDateTime(a.created_at)}</p>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

function Conversations({ dealId }: { dealId: string }) {
  const { data } = useCommunications({ related_type: 'deal', related_id: dealId, size: 50 })
  const log = useLogCommunication()
  const [channel, setChannel] = useState('note')
  const [direction, setDirection] = useState('outbound')
  const [body, setBody] = useState('')

  const items = (data?.items || []) as Communication[]
  const add = () => {
    if (!body.trim()) return
    log.mutate(
      { channel, direction, body: body.trim(), related_type: 'deal', related_id: dealId },
      { onSuccess: () => setBody('') },
    )
  }

  return (
    <div className="rounded-xl border p-4">
      <SectionTitle icon={MessageSquare}>Conversations</SectionTitle>
      <div className="flex flex-wrap gap-2 mb-2">
        <select value={channel} onChange={e => setChannel(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="note">Note</option>
          <option value="email">Email</option>
          <option value="call">Call</option>
          <option value="sms">SMS</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
        <select value={direction} onChange={e => setDirection(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="outbound">Outbound</option>
          <option value="inbound">Inbound</option>
        </select>
      </div>
      <div className="flex gap-2 mb-3">
        <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Log what was discussed…" className="min-h-[40px]" />
        <Button type="button" variant="outline" size="sm" className="h-9 self-end" disabled={log.isPending} onClick={add}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">No conversations logged yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map(c => (
            <li key={c.id} className="rounded-lg border px-3 py-2">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Badge variant="secondary">{c.channel}</Badge>
                <span>{c.direction}</span>
                <span className="ml-auto">{formatDateTime(c.occurred_at)}</span>
              </div>
              {c.body && <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{c.body}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Attachments({ dealId: _dealId, cf, patchCustom }: { dealId: string; cf: Record<string, unknown>; patchCustom: (p: Record<string, unknown>) => void }) {
  const docs = asObjArray(cf.documents).map(d => ({ url: s(d.url), filename: s(d.filename) || 'document' })).filter(d => d.url)
  const photos = asObjArray(cf.photos).map(p => ({ url: s(p.url), caption: s(p.caption) })).filter(p => p.url)
  const [uploading, setUploading] = useState(false)
  const docRef = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)

  const onDocs = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      const added: { url: string; filename: string; content_type: string }[] = []
      for (const f of Array.from(files)) {
        const d = await crmApi.uploadDocument(f)
        added.push({ url: d.url, filename: d.filename, content_type: d.content_type || '' })
      }
      patchCustom({ documents: [...asObjArray(cf.documents), ...added] })
    } finally { setUploading(false); if (docRef.current) docRef.current.value = '' }
  }
  const onPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      const added: { url: string; caption: string }[] = []
      for (const f of Array.from(files)) {
        const { url } = await vendorApi.uploadVendorBrandingAsset(f)
        added.push({ url, caption: '' })
      }
      patchCustom({ photos: [...asObjArray(cf.photos), ...added] })
    } finally { setUploading(false); if (photoRef.current) photoRef.current.value = '' }
  }
  const removeDoc = (url: string) => patchCustom({ documents: asObjArray(cf.documents).filter(d => s(d.url) !== url) })
  const removePhoto = (url: string) => patchCustom({ photos: asObjArray(cf.photos).filter(p => s(p.url) !== url) })

  return (
    <div className="rounded-xl border p-4">
      <SectionTitle icon={Paperclip} right={uploading ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : undefined}>Attachments</SectionTitle>
      {docs.length > 0 && (
        <ul className="space-y-1.5 mb-2">
          {docs.map((d, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg border px-3 py-2">
              <FileText className="w-4 h-4 text-gray-400 shrink-0" />
              <a href={d.url} target="_blank" rel="noreferrer" className="flex-1 min-w-0 truncate text-sm text-blue-600 hover:underline">{d.filename}</a>
              <button type="button" onClick={() => removeDoc(d.url)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </li>
          ))}
        </ul>
      )}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {photos.map((p, i) => (
            <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg border bg-gray-50 group">
              <img src={p.url} alt={p.caption || 'photo'} className="h-full w-full object-cover" />
              <button type="button" onClick={() => removePhoto(p.url)}
                className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input ref={docRef} type="file" multiple className="hidden"
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" onChange={e => onDocs(e.target.files)} />
        <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={e => onPhotos(e.target.files)} />
        <Button type="button" variant="outline" size="sm" className="flex-1" disabled={uploading} onClick={() => docRef.current?.click()}>
          <Paperclip className="w-4 h-4 mr-2" /> Attach document
        </Button>
        <Button type="button" variant="outline" size="sm" className="flex-1" disabled={uploading} onClick={() => photoRef.current?.click()}>
          <ImagePlus className="w-4 h-4 mr-2" /> Upload photo
        </Button>
      </div>
    </div>
  )
}

function AiSummary({ dealId }: { dealId: string }) {
  const { data: insights, refetch } = useAiInsights('deal', dealId)
  const summarise = useAiSummarise()
  const latest = (insights || [])[0]
  const summaryText = useMemo(() => {
    const content = (latest?.content || {}) as Record<string, unknown>
    return s(content.summary || content.text || content.message)
  }, [latest])

  return (
    <div className="rounded-xl border p-4">
      <SectionTitle icon={Sparkles} right={
        <Button type="button" variant="outline" size="sm" className="h-8" disabled={summarise.isPending}
          onClick={() => summarise.mutate({ entityType: 'deal', entityId: dealId }, { onSuccess: () => refetch() })}>
          {summarise.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
          Generate
        </Button>
      }>AI summary</SectionTitle>
      {summaryText ? (
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{summaryText}</p>
      ) : (
        <p className="text-sm text-gray-400">No AI summary yet. Click Generate to create one from this deal's activity.</p>
      )}
    </div>
  )
}
