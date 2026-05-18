import { useState, useMemo } from 'react'
import {
  useFieldRules, useCreateFieldRule, useDeleteFieldRule, useCompanies,
} from '@/hooks/useFinance'
import { JOURNAL_FIELD_OPTIONS, fieldLabelForKey } from '@/lib/glFieldCatalog'
import type { Company } from '@/types/finance'
import { vendorApi } from '@/api/vendor'
import { useQuery } from '@tanstack/react-query'
import { ListChecks, Plus, Trash2, Building2, User, LayoutGrid, Loader2, Info } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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
  { value: 'company', label: 'Company code' },
  { value: 'user', label: 'User' },
] as const

const REQ = [
  { value: 'optional', label: 'Optional' },
  { value: 'mandatory', label: 'Mandatory' },
  { value: 'hidden', label: 'Hidden' },
] as const

export default function FieldRuleConfig() {
  const [entityFilter, setEntityFilter] = useState('journal_entry')
  const { data: rules = [], isLoading, refetch } = useFieldRules({ entity_type: entityFilter })
  const { data: companies = [] } = useCompanies()
  const createMut = useCreateFieldRule()
  const delMut = useDeleteFieldRule()

  const { data: team } = useQuery({
    queryKey: ['team-members-field-rules'],
    queryFn: () => vendorApi.listTeamMembers({ size: 200 }),
  })
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    scope: 'gl' as 'gl' | 'company' | 'user',
    company_id: '',
    vendor_user_id: '',
    field_key: 'header.reference',
    requirement: 'mandatory' as 'optional' | 'mandatory' | 'hidden',
  })

  const members = useMemo(
    () => (team as { items: { id: string; name?: string; email?: string }[] } | undefined)?.items || [],
    [team],
  )

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
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ListChecks className="w-7 h-7 text-primary" />
          GL field configuration
        </h1>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Define whether journal header fields are <strong>optional</strong>, <strong>mandatory</strong>, or <strong>hidden</strong>.
          Rules merge as: <em>GL default → company code → user</em> (the most specific scope wins).
        </p>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/10/50 p-4 flex gap-3 text-sm text-primary/90 mb-4">
        <Info className="w-5 h-5 shrink-0" />
        <p>
          Scope <strong>GL</strong> applies to all users until overridden. <strong>Company</strong> refines the rule when posting to that company.
          <strong>User</strong> is for a specific team member. Combine with the Journal Entry screen: mandatory fields are enforced on save.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-500 uppercase">Entity</label>
          <select
            value={entityFilter}
            onChange={e => { setEntityFilter(e.target.value) }}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
          >
            <option value="journal_entry">Journal entry</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" /> Add rule
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase border-b">
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
              <div className="col-span-3 text-xs text-gray-600 truncate" title={r.company_id || r.vendor_user_id || '—'}>
                {r.scope === 'gl' && '—'}
                {r.scope === 'company' && (companyMap.get(r.company_id || '') || r.company_id || '—')}
                {r.scope === 'user' && (members.find(m => m.id === r.vendor_user_id)?.name || r.vendor_user_id?.slice(0, 8) || '—')}
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
                  onClick={() => {
                    if (!confirm('Delete this rule?')) return
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold text-lg">Add field rule</h2>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Scope</label>
              <select
                value={form.scope}
                onChange={e => setForm(f => ({ ...f, scope: e.target.value as 'gl' | 'company' | 'user' }))}
                className="w-full border rounded-lg mt-1 px-2 py-2 text-sm"
              >
                {SCOPE.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            {form.scope === 'company' && (
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Company</label>
                <select
                  value={form.company_id}
                  onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))}
                  className="w-full border rounded-lg mt-1 px-2 py-2 text-sm"
                >
                  <option value="">— Select —</option>
                  {(companies as Company[]).map(c => (
                    <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
                  ))}
                </select>
              </div>
            )}
            {form.scope === 'user' && (
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Team user</label>
                <select
                  value={form.vendor_user_id}
                  onChange={e => setForm(f => ({ ...f, vendor_user_id: e.target.value }))}
                  className="w-full border rounded-lg mt-1 px-2 py-2 text-sm"
                >
                  <option value="">— Select —</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name || m.email || m.id}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Field</label>
              <select
                value={form.field_key}
                onChange={e => setForm(f => ({ ...f, field_key: e.target.value }))}
                className="w-full border rounded-lg mt-1 px-2 py-2 text-sm"
              >
                {JOURNAL_FIELD_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Requirement</label>
              <select
                value={form.requirement}
                onChange={e => setForm(f => ({ ...f, requirement: e.target.value as 'optional' | 'mandatory' | 'hidden' }))}
                className="w-full border rounded-lg mt-1 px-2 py-2 text-sm"
              >
                {REQ.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
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
