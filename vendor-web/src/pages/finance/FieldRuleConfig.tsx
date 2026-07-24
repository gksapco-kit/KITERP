import { useState, useMemo } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import {
  useFieldRules, useCreateFieldRule, useDeleteFieldRule, useCompanies,
} from '@/hooks/useFinance'
import { JOURNAL_FIELD_OPTIONS, fieldLabelForKey } from '@/lib/glFieldCatalog'
import type { Company } from '@/types/finance'
import type { TeamMember } from '@/types'
import { useTeamMembers } from '@/hooks/useVendor'
import { StaffPicker, type StaffPickerValue } from '@/components/commission/StaffPicker'
import { ListChecks, Plus, Trash2, Building2, User, LayoutGrid, Loader2, Info, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'

import { askConfirm } from '@/components/common/ConfirmProvider'
type RuleRow = {
  id: string
  scope: string
  company_id?: string | null
  vendor_user_id?: string | null
  entity_type: string
  field_key: string
  requirement: string
}

const SCOPE = [
  { value: 'gl', label: 'GL (tenant default)' },
  { value: 'company', label: 'Business unit' },
  { value: 'user', label: 'User' },
] as const

const REQ = [
  { value: 'optional', label: 'Optional' },
  { value: 'mandatory', label: 'Mandatory' },
  { value: 'hidden', label: 'Hidden' },
] as const

function teamMemberLabel(m?: TeamMember | null): string {
  if (!m) return '—'
  const name = m.user?.full_name || m.role_name
  const contact = [m.user?.email, m.user?.phone].filter(Boolean).join(' · ')
  if (name && contact) return `${name} · ${contact}`
  return name || contact || m.id.slice(0, 8)
}

export default function FieldRuleConfig() {
  const [entityFilter, setEntityFilter] = useState('journal_entry')
  const { data: rules = [], isLoading, refetch } = useFieldRules({ entity_type: entityFilter })
  const { data: companies = [] } = useCompanies()
  const createMut = useCreateFieldRule()
  const delMut = useDeleteFieldRule()

  const { data: teamData } = useTeamMembers({ size: 200 })
  const [showAdd, setShowAdd] = useState(false)
  const [selectedTeamUser, setSelectedTeamUser] = useState<StaffPickerValue | null>(null)
  useEscapeToClose(() => setShowAdd(false), showAdd)
  const [form, setForm] = useState({
    scope: 'gl' as 'gl' | 'company' | 'user',
    company_id: '',
    vendor_user_id: '',
    field_key: 'header.reference',
    requirement: 'mandatory' as 'optional' | 'mandatory' | 'hidden',
  })

  const members = useMemo(() => teamData?.items ?? [], [teamData])

  const companyMap = useMemo(() => {
    const m = new Map<string, string>()
    ;(companies as Company[]).forEach(c => m.set(c.id, `${c.code} · ${c.name}`))
    return m
  }, [companies])

  const submit = () => {
    const body: Record<string, unknown> = {
      scope: form.scope,
      entity_type: entityFilter,
      field_key: form.field_key,
      requirement: form.requirement,
    }
    if (form.scope === 'company') {
      if (!form.company_id) { toast.error('Select a company'); return }
      body.company_id = form.company_id
    }
    if (form.scope === 'user') {
      if (!form.vendor_user_id) { toast.error('Select a user'); return }
      body.vendor_user_id = form.vendor_user_id
    }
    createMut.mutate(body, {
      onSuccess: () => { toast.success('Rule saved'); setShowAdd(false); refetch() },
      onError: (e: any) => toast.error(e?.response?.data?.detail || 'Save failed'),
    })
  }

  if (isLoading) return <div className="p-8 text-sm text-gray-500">Loading field rules…</div>

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ListChecks className="w-7 h-7 text-primary" />
          GL Field Configuration
        </h1>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Define whether journal header fields are <strong>optional</strong>, <strong>mandatory</strong>, or <strong>hidden</strong>.
          Rules merge as: <em>GL default → business unit → user</em> (the most specific scope wins).
        </p>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/10/50 p-4 flex gap-3 text-sm text-primary/90 mb-4">
        <Info className="w-5 h-5 shrink-0" />
        <p>
          Scope <strong>GL</strong> applies to all users until overridden. <strong>Business unit</strong> refines the rule when posting to that unit.
          <strong>User</strong> is for a specific team member. Combine with the Journal Entry screen: mandatory fields are enforced on save.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-500 uppercase">Entity</label>
          <Select
            value={entityFilter}
            onChange={setEntityFilter}
            className="border border-gray-200 rounded-lg text-sm"
            options={[{ value: 'journal_entry', label: 'Journal entry' }]}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setForm({
              scope: 'gl',
              company_id: '',
              vendor_user_id: '',
              field_key: 'header.reference',
              requirement: 'mandatory',
            })
            setSelectedTeamUser(null)
            setShowAdd(true)
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" /> Add rule
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-50 text-xs font-bold text-gray-500 uppercase border-b">
          <span className="col-span-2">Scope</span>
          <span className="col-span-3">Target</span>
          <span className="col-span-3">Field</span>
          <span className="col-span-2">Requirement</span>
          <span className="col-span-2 text-right" />
        </div>
        <ul className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
          {(rules as RuleRow[]).map(r => (
            <li key={r.id} className="grid grid-cols-12 gap-2 px-3 py-2.5 text-sm items-center">
              <div className="col-span-2 flex items-center gap-1.5 text-gray-800">
                {r.scope === 'gl' && <LayoutGrid className="w-3.5 h-3.5 text-gray-400" />}
                {r.scope === 'company' && <Building2 className="w-3.5 h-3.5 text-gray-400" />}
                {r.scope === 'user' && <User className="w-3.5 h-3.5 text-gray-400" />}
                {SCOPE.find(s => s.value === r.scope)?.label || r.scope}
              </div>
              <div className="col-span-3 text-xs text-gray-600 truncate" title={r.company_id || teamMemberLabel(members.find(m => m.id === r.vendor_user_id))}>
                {r.scope === 'gl' && '—'}
                {r.scope === 'company' && (companyMap.get(r.company_id || '') || r.company_id || '—')}
                {r.scope === 'user' && teamMemberLabel(members.find(m => m.id === r.vendor_user_id))}
              </div>
              <div className="col-span-3 text-gray-800">{fieldLabelForKey(r.field_key)}</div>
              <div className="col-span-2">
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full font-medium',
                  r.requirement === 'mandatory' && 'bg-rose-100 text-rose-800',
                  r.requirement === 'optional' && 'bg-slate-100 text-slate-700',
                  r.requirement === 'hidden' && 'bg-gray-200 text-gray-700',
                )}>{r.requirement}</span>
              </div>
              <div className="col-span-2 flex justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    if (!await askConfirm('Delete this rule?')) return
                    delMut.mutate(r.id, {
                      onSuccess: () => { toast.success('Removed'); refetch() },
                      onError: (e: any) => toast.error(e?.response?.data?.detail || 'Failed'),
                    })
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                >
                  {delMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </li>
          ))}
          {!(rules as RuleRow[]).length && (
            <li className="px-3 py-10 text-center text-sm text-gray-500">No rules — defaults apply (only obvious required fields from the form).</li>
          )}
        </ul>
      </div>

      {showAdd && (
        <div data-kiterp-modal className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            <div className="flex items-start justify-between gap-3 mb-4">

              <div className="min-w-0"><h2 className="font-semibold text-lg">Add field rule</h2></div>

              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Scope</label>
              <Select
                value={form.scope}
                onChange={scope => {
                  const nextScope = scope as 'gl' | 'company' | 'user'
                  if (nextScope !== 'user') setSelectedTeamUser(null)
                  setForm(f => ({
                    ...f,
                    scope: nextScope,
                    vendor_user_id: nextScope === 'user' ? f.vendor_user_id : '',
                  }))
                }}
                className="mt-1 w-full border rounded-lg text-sm"
                options={SCOPE.map(s => ({ value: s.value, label: s.label }))}
              />
            </div>
            {form.scope === 'company' && (
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Business unit</label>
                <Select
                  value={form.company_id}
                  onChange={v => setForm(f => ({ ...f, company_id: v }))}
                  placeholder="— Select —"
                  className="mt-1 w-full border rounded-lg text-sm"
                  options={selectOptionsWithBlank(
                    '— Select —',
                    (companies as Company[]).map(c => ({ value: c.id, label: `${c.code} · ${c.name}` })),
                  )}
                />
              </div>
            )}
            {form.scope === 'user' && (
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Team user</label>
                <div className="mt-1">
                  <StaffPicker
                    selected={selectedTeamUser}
                    onSelect={v => {
                      setSelectedTeamUser(v)
                      setForm(f => ({ ...f, vendor_user_id: v?.id || '' }))
                    }}
                    placeholder="Search by name, email or phone…"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Field</label>
              <Select
                value={form.field_key}
                onChange={v => setForm(f => ({ ...f, field_key: v }))}
                className="mt-1 w-full border rounded-lg text-sm"
                options={JOURNAL_FIELD_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Requirement</label>
              <Select
                value={form.requirement}
                onChange={v => setForm(f => ({ ...f, requirement: v as 'optional' | 'mandatory' | 'hidden' }))}
                className="mt-1 w-full border rounded-lg text-sm"
                options={REQ.map(s => ({ value: s.value, label: s.label }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowAdd(false)} className="btn-cancel px-3 py-2 text-sm border rounded-lg">Cancel</button>
              <button
                type="button"
                onClick={submit}
                disabled={createMut.isPending}
                className="px-3 py-2 text-sm font-semibold bg-primary text-white rounded-lg disabled:opacity-50"
              >
                {createMut.isPending ? 'Saving…' : 'Save rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
