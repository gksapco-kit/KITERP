import { useState, useMemo } from 'react'
import { Plus, Edit2, X, Filter, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import {
  useAssignments, useCreateAssignment, useUpdateAssignment, useDeleteAssignment,
  usePlans, usePayees,
} from '@/hooks/useCommission'
import { useStores } from '@/hooks/useVendor'
import { PayeeSelector } from '@/components/commission/PayeeSelector'
import { CollapsibleSection } from '@/components/commission/CollapsibleSection'
import type { CommissionAssignment, CommissionPayee } from '@/types/commission'
import { extractApiError } from '@/lib/errorMessages'

const LINK_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All payee types' },
  { value: 'vendor_user', label: 'Staff' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'customer', label: 'Customer' },
  { value: 'external', label: 'External' },
]

export default function AssignmentsPage() {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<CommissionAssignment | null>(null)
  const [selectedPayee, setSelectedPayee] = useState<CommissionPayee | null>(null)
  const [form, setForm] = useState<Record<string, unknown>>({
    plan_id: '', weight_percent: 100, is_active: true,
    valid_from: '', valid_to: '',
    store_id: '', team_id: '', location: '', group_name: '', notes: '',
  })

  const [page, setPage] = useState(1)
  const [showFilters, setShowFilters] = useState(true)
  const [filters, setFilters] = useState<Record<string, string>>({
    search: '',
    payee_id: '',
    plan_id: '',
    store_id: '',
    is_active: '',
    link_type: '',
    plan_code: '',
    plan_name: '',
    location: '',
    group_name: '',
  })

  const apiParams = useMemo(() => {
    const p: Record<string, unknown> = { page, size: 20 }
    const s = filters.search.trim()
    if (s) p.search = s
    if (filters.payee_id) p.payee_id = filters.payee_id
    if (filters.plan_id) p.plan_id = filters.plan_id
    if (filters.store_id) p.store_id = filters.store_id
    if (filters.is_active === 'true') p.is_active = true
    if (filters.is_active === 'false') p.is_active = false
    if (filters.link_type) p.link_type = filters.link_type
    if (filters.plan_code.trim()) p.plan_code = filters.plan_code.trim()
    if (filters.plan_name.trim()) p.plan_name = filters.plan_name.trim()
    if (filters.location.trim()) p.location = filters.location.trim()
    if (filters.group_name.trim()) p.group_name = filters.group_name.trim()
    return p
  }, [page, filters])

  const { data: assignData, isLoading } = useAssignments(apiParams)
  const { data: planData } = usePlans()
  const { data: storesData } = useStores()
  const { data: payeeListData } = usePayees({ size: 500, status: 'active' })

  const create = useCreateAssignment()
  const update = useUpdateAssignment()
  const remove = useDeleteAssignment()

  const assignments = assignData?.items || []
  const total = assignData?.total ?? 0
  const pages = assignData?.pages ?? 1
  const plans = planData?.items || []
  const stores = storesData?.stores || []
  const payeeOptions = payeeListData?.items || []

  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }))

  const clearFilters = () => {
    setFilters({
      search: '', payee_id: '', plan_id: '', store_id: '', is_active: '',
      link_type: '', plan_code: '', plan_name: '', location: '', group_name: '',
    })
    setPage(1)
  }

  const openCreate = () => {
    setEditing(null)
    setSelectedPayee(null)
    setForm({ plan_id: '', weight_percent: 100, is_active: true, valid_from: '', valid_to: '', store_id: '', team_id: '', location: '', group_name: '', notes: '' })
    setShowForm(true)
  }

  const openEdit = (a: CommissionAssignment) => {
    setEditing(a)
    setForm({
      plan_id: a.plan_id,
      weight_percent: a.weight_percent,
      is_active: a.is_active,
      valid_from: a.valid_from || '',
      valid_to: a.valid_to || '',
      store_id: (a as unknown as Record<string, string>).store_id || '',
      team_id: (a as unknown as Record<string, string>).team_id || '',
      location: a.location || '',
      group_name: a.group_name || '',
      notes: a.notes || '',
    })
    setShowForm(true)
  }

  const closeForm = () => setShowForm(false)

  const handleSave = async () => {
    if (!form.plan_id) return toast.error('Plan is required')
    if (!editing && !selectedPayee) return toast.error('Payee is required')
    const payload = {
      ...form,
      payee_id: editing ? editing.payee_id : selectedPayee!.id,
      valid_from: form.valid_from || null,
      valid_to: form.valid_to || null,
      store_id: form.store_id || null,
      team_id: form.team_id || null,
      location: form.location || null,
      group_name: form.group_name || null,
      notes: form.notes || null,
    }
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, data: payload })
        toast.success('Assignment updated')
      } else {
        await create.mutateAsync(payload)
        toast.success('Assignment created')
      }
      setShowForm(false)
    } catch (err) {
      toast.error(extractApiError(err, 'Failed to save assignment'))
    }
  }

  const handleDeactivate = async (id: string) => {
    if (!confirm('Deactivate this assignment?')) return
    try {
      await remove.mutateAsync(id)
      toast.success('Assignment deactivated')
    } catch (err) {
      toast.error(extractApiError(err, 'Failed to deactivate'))
    }
  }

  const planNameFallback = (id: string) => plans.find(p => p.id === id)?.name || id.slice(0, 8) + '…'
  const storeName = (id: string) => stores.find(s => s.id === id)?.name || id

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Assignments</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Link payees to commission plans with scope and weighting · {total} match{total === 1 ? '' : 'es'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowFilters(s => !s)}
            className="flex items-center gap-2 border border-gray-200 px-3 py-2 rounded-lg text-sm hover:bg-gray-50"
          >
            <Filter className="h-4 w-4" /> Filters <ChevronDown className="h-3 w-3" />
          </button>
          <button type="button" onClick={openCreate} className="btn-brand">
            <Plus className="h-4 w-4" /> Assign
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
              <input
                value={filters.search}
                onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1) }}
                placeholder="Payee name, email, phone, or employee code"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Payee</label>
              <select
                value={filters.payee_id}
                onChange={e => { setFilters(f => ({ ...f, payee_id: e.target.value })); setPage(1) }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="">All payees</option>
                {payeeOptions.map(p => (
                  <option key={p.id} value={p.id}>{p.display_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Plan</label>
              <select
                value={filters.plan_id}
                onChange={e => { setFilters(f => ({ ...f, plan_id: e.target.value })); setPage(1) }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="">All plans</option>
                {plans.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Store / branch</label>
              <select
                value={filters.store_id}
                onChange={e => { setFilters(f => ({ ...f, store_id: e.target.value })); setPage(1) }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="">Any store</option>
                {stores.map(s => (
                  <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.is_active}
                onChange={e => { setFilters(f => ({ ...f, is_active: e.target.value })); setPage(1) }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="">Active &amp; inactive</option>
                <option value="true">Active only</option>
                <option value="false">Inactive only</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Payee type</label>
              <select
                value={filters.link_type}
                onChange={e => { setFilters(f => ({ ...f, link_type: e.target.value })); setPage(1) }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                {LINK_TYPE_OPTIONS.map(o => (
                  <option key={o.value || 'all'} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Plan code</label>
              <input
                value={filters.plan_code}
                onChange={e => { setFilters(f => ({ ...f, plan_code: e.target.value })); setPage(1) }}
                placeholder="e.g. DEFAULT"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Plan name</label>
              <input
                value={filters.plan_name}
                onChange={e => { setFilters(f => ({ ...f, plan_name: e.target.value })); setPage(1) }}
                placeholder="Contains…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
              <input
                value={filters.location}
                onChange={e => { setFilters(f => ({ ...f, location: e.target.value })); setPage(1) }}
                placeholder="Assignment location"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Group</label>
              <input
                value={filters.group_name}
                onChange={e => { setFilters(f => ({ ...f, group_name: e.target.value })); setPage(1) }}
                placeholder="Group name"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm text-primary hover:text-primary/80 font-medium"
            >
              Clear all filters
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Payee', 'Employee ID', 'Plan', 'Weight', 'Valid period', 'Scope', 'Status', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : assignments.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">No assignments match your filters</td></tr>
            ) : assignments.map(a => {
              const sId = (a as unknown as Record<string, string>).store_id
              const scope = [
                sId ? storeName(sId) : null,
                a.location,
                a.group_name,
              ].filter(Boolean).join(' / ')
              const displayName = a.payee_display_name || `${a.payee_id.slice(0, 8)}…`
              const planLabel = a.plan_name || planNameFallback(a.plan_id)
              const planSub = a.plan_code ? (
                <span className="text-xs text-gray-400 font-mono">{a.plan_code}</span>
              ) : null
              return (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{displayName}</div>
                    <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                      {a.payee_email && <span>{a.payee_email}</span>}
                      {a.payee_phone && <span>{a.payee_phone}</span>}
                      {a.payee_link_type && (
                        <span className="text-[10px] uppercase tracking-wide text-gray-400 border border-gray-200 rounded px-1">
                          {a.payee_link_type.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-mono text-xs">
                    {a.employee_id ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-800">{planLabel}</div>
                    {planSub}
                  </td>
                  <td className="px-4 py-3">{a.weight_percent}%</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {a.valid_from || '—'} → {a.valid_to || '∞'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{scope || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {a.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => openEdit(a)} className="text-gray-400 hover:text-primary"><Edit2 className="h-4 w-4" /></button>
                      <button type="button" aria-label="Close" type="button" onClick={() => handleDeactivate(a.id)} className="text-gray-400 hover:text-red-600">
                <X className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-4 flex-wrap">
          {Array.from({ length: Math.min(pages, 15) }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPage(i + 1)}
              className={`px-3 py-1 rounded text-sm ${page === i + 1 ? 'bg-primary text-white' : 'border border-gray-200 hover:bg-gray-50'}`}
            >
              {i + 1}
            </button>
          ))}
          {pages > 15 && <span className="text-xs text-gray-500 self-center px-2">… {pages} pages</span>}
        </div>
      )}

      {showForm && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto"
          onClick={closeForm}
        >
          <div
            className="bg-white rounded-xl w-full max-w-md shadow-xl my-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-semibold text-gray-900">{editing ? 'Edit Assignment' : 'New Assignment'}</h2>
                <p className="text-xs text-gray-400 mt-0.5">Fields marked <span className="text-red-500">*</span> are required</p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">

              {!editing && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Payee <span className="text-red-500">*</span></label>
                  <PayeeSelector onChange={p => setSelectedPayee(p)} />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Commission Plan <span className="text-red-500">*</span></label>
                <select value={String(form.plan_id)} onChange={e => set('plan_id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">Select plan…</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Weight (%)</label>
                <input type="number" min="0" max="100" step="0.01"
                  value={Number(form.weight_percent)}
                  onChange={e => set('weight_percent', parseFloat(e.target.value) || 100)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <p className="text-xs text-gray-400 mt-1">100% means this payee earns the full commission. Split assignments should sum to 100.</p>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="assign-active" checked={Boolean(form.is_active)}
                  onChange={e => set('is_active', e.target.checked)}
                  className="rounded" />
                <label htmlFor="assign-active" className="text-sm text-gray-700">Active</label>
              </div>

              <CollapsibleSection title="Scope & Validity">
                <div className="grid grid-cols-2 gap-4">
                  {[{ k: 'valid_from', l: 'Valid From' }, { k: 'valid_to', l: 'Valid To' }].map(f => (
                    <div key={f.k}>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{f.l}</label>
                      <input type="date" value={String(form[f.k] || '')} onChange={e => set(f.k, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Store / Branch</label>
                  <select value={String(form.store_id || '')} onChange={e => set('store_id', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">All stores (no restriction)</option>
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Team ID</label>
                  <input value={String(form.team_id || '')} onChange={e => set('team_id', e.target.value)}
                    placeholder="Team UUID (optional)"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[{ k: 'location', l: 'Location' }, { k: 'group_name', l: 'Group' }].map(f => (
                    <div key={f.k}>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{f.l}</label>
                      <input value={String(form[f.k] || '')} onChange={e => set(f.k, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                  <textarea rows={2} value={String(form.notes || '')} onChange={e => set('notes', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </CollapsibleSection>
            </div>

            <div className="p-4 border-t border-gray-100 flex gap-3 justify-end">
              <button type="button" onClick={closeForm} className="btn-cancel px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancel</button>
              <button type="button" onClick={handleSave} disabled={create.isPending || update.isPending}
                className="btn-brand disabled:opacity-50">
                {create.isPending || update.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
