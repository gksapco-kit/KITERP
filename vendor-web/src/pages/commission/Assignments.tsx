import { useState, useMemo } from 'react'
import { formLabelClass } from '@/components/common/FormSectionNav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Plus, Edit2, X, Filter, ChevronDown, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
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
import {
  commissionEmptyCell,
  commissionFieldInput,
  commissionFilterBtn,
  commissionFilterPanel,
  commissionPageSub,
  commissionPageTitle,
  commissionPaginationActive,
  commissionPaginationInactive,
  commissionRowHover,
  commissionTableIconBtn,
  commissionTableShellScroll,
  commissionTbody,
  commissionThead,
  commissionTh,
} from '@/pages/commission/commissionUi'

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
  const pageWindowStart = Math.max(1, Math.min(page - 2, pages - 4))
  const pageNumbers = Array.from(
    { length: Math.min(5, pages) },
    (_, i) => pageWindowStart + i,
  ).filter(pg => pg >= 1 && pg <= pages)
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

  useEscapeToClose(closeForm, showForm)

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

  const handleToggleStatus = async (a: CommissionAssignment) => {
    const nextActive = !a.is_active
    const label = nextActive ? 'activate' : 'deactivate'
    if (!confirm(`${nextActive ? 'Activate' : 'Deactivate'} this assignment?`)) return
    try {
      await update.mutateAsync({ id: a.id, data: { is_active: nextActive } })
      toast.success(`Assignment ${label}d`)
    } catch (err) {
      toast.error(extractApiError(err, `Failed to ${label} assignment`))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this assignment permanently? This cannot be undone.')) return
    try {
      await remove.mutateAsync(id)
      toast.success('Assignment deleted')
    } catch (err) {
      toast.error(extractApiError(err, 'Failed to delete assignment'))
    }
  }

  const planNameFallback = (id: string) => plans.find(p => p.id === id)?.name || id.slice(0, 8) + '…'
  const storeName = (id: string) => stores.find(s => s.id === id)?.name || id

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className={commissionPageTitle}>Assignments</h1>
          <p className={commissionPageSub}>
            Link payees to commission plans with scope and weighting · {total} match{total === 1 ? '' : 'es'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowFilters(s => !s)}
            className={commissionFilterBtn}
          >
            <Filter className="h-4 w-4" /> Filters <ChevronDown className="h-3 w-3" />
          </button>
          <Button type="button" onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Assign
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className={commissionFilterPanel}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <div className="lg:col-span-2">
              <Label className={`block mb-1 ${formLabelClass}`}>Search</Label>
              <Input
                value={filters.search}
                onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1) }}
                placeholder="Payee name, email, phone, or employee code"
              />
            </div>
            <div>
              <Label className={`block mb-1 ${formLabelClass}`}>Payee</Label>
              <Select
                value={filters.payee_id}
                onChange={(v) => { setFilters(f => ({ ...f, payee_id: v })); setPage(1) }}
                options={selectOptionsWithBlank('All payees', payeeOptions.map(p => ({
                  value: p.id,
                  label: p.display_name,
                })))}
                placeholder="All payees"
                aria-label="Payee filter"
                className="w-full"
              />
            </div>
            <div>
              <Label className={`block mb-1 ${formLabelClass}`}>Plan</Label>
              <Select
                value={filters.plan_id}
                onChange={(v) => { setFilters(f => ({ ...f, plan_id: v })); setPage(1) }}
                options={selectOptionsWithBlank('All plans', plans.map(p => ({
                  value: p.id,
                  label: `${p.name} (${p.code})`,
                })))}
                placeholder="All plans"
                aria-label="Plan filter"
                className="w-full"
              />
            </div>
            <div>
              <Label className={`block mb-1 ${formLabelClass}`}>Store / branch</Label>
              <Select
                value={filters.store_id}
                onChange={(v) => { setFilters(f => ({ ...f, store_id: v })); setPage(1) }}
                options={selectOptionsWithBlank('Any store', stores.map(s => ({
                  value: s.id,
                  label: `${s.name}${s.code ? ` (${s.code})` : ''}`,
                })))}
                placeholder="Any store"
                aria-label="Store filter"
                className="w-full"
              />
            </div>
            <div>
              <Label className={`block mb-1 ${formLabelClass}`}>Status</Label>
              <Select
                value={filters.is_active}
                onChange={(v) => { setFilters(f => ({ ...f, is_active: v })); setPage(1) }}
                options={[
                  { value: '', label: 'Active & inactive' },
                  { value: 'true', label: 'Active only' },
                  { value: 'false', label: 'Inactive only' },
                ]}
                aria-label="Status filter"
                className="w-full"
              />
            </div>
            <div>
              <Label className={`block mb-1 ${formLabelClass}`}>Payee type</Label>
              <Select
                value={filters.link_type}
                onChange={(v) => { setFilters(f => ({ ...f, link_type: v })); setPage(1) }}
                options={LINK_TYPE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                aria-label="Payee type filter"
                className="w-full"
              />
            </div>
            <div>
              <Label className={`block mb-1 ${formLabelClass}`}>Plan code</Label>
              <Input
                value={filters.plan_code}
                onChange={e => { setFilters(f => ({ ...f, plan_code: e.target.value })); setPage(1) }}
                placeholder="e.g. DEFAULT"
              />
            </div>
            <div>
              <Label className={`block mb-1 ${formLabelClass}`}>Plan name</Label>
              <Input
                value={filters.plan_name}
                onChange={e => { setFilters(f => ({ ...f, plan_name: e.target.value })); setPage(1) }}
                placeholder="Contains…"
              />
            </div>
            <div>
              <Label className={`block mb-1 ${formLabelClass}`}>Location</Label>
              <Input
                value={filters.location}
                onChange={e => { setFilters(f => ({ ...f, location: e.target.value })); setPage(1) }}
                placeholder="Assignment location"
              />
            </div>
            <div>
              <Label className={`block mb-1 ${formLabelClass}`}>Group</Label>
              <Input
                value={filters.group_name}
                onChange={e => { setFilters(f => ({ ...f, group_name: e.target.value })); setPage(1) }}
                placeholder="Group name"
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

      <div className={commissionTableShellScroll}>
        <table className="w-full text-sm min-w-[900px]">
          <thead className={commissionThead}>
            <tr>
              {['Payee', 'Employee ID', 'Plan', 'Weight', 'Valid period', 'Scope', 'Status', ''].map(h => (
                <th key={h} className={commissionTh}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className={commissionTbody}>
            {isLoading ? (
              <tr><td colSpan={8} className={commissionEmptyCell}>Loading…</td></tr>
            ) : assignments.length === 0 ? (
              <tr><td colSpan={8} className={commissionEmptyCell}>No assignments match your filters</td></tr>
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
                <span className="text-xs text-muted-foreground font-mono">{a.plan_code}</span>
              ) : null
              return (
                <tr key={a.id} className={commissionRowHover}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{displayName}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                      {a.payee_email && <span>{a.payee_email}</span>}
                      {a.payee_phone && <span>{a.payee_phone}</span>}
                      {a.payee_link_type && (
                        <span className="text-xs uppercase tracking-wide text-muted-foreground border border-border rounded px-1">
                          {a.payee_link_type.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground font-mono text-xs">
                    {a.employee_id ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-foreground">{planLabel}</div>
                    {planSub}
                  </td>
                  <td className="px-4 py-3 text-foreground">{a.weight_percent}%</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {a.valid_from || '—'} → {a.valid_to || '∞'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{scope || '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(a)}
                      title={a.is_active ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                      className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={a.is_active ? 'Deactivate assignment' : 'Activate assignment'}
                    >
                      {a.is_active
                        ? <ToggleRight className="h-6 w-6 text-emerald-500 dark:text-emerald-400" />
                        : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button type="button" onClick={() => openEdit(a)} className={`${commissionTableIconBtn} hover:text-primary`} aria-label="Edit assignment">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => handleDelete(a.id)} className={`${commissionTableIconBtn} hover:text-red-500 dark:hover:text-red-400`} aria-label="Delete assignment">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!isLoading && total > 0 && (
        <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
          <span className="text-xs text-muted-foreground">
            Page {page} of {pages} · {total} assignment{total === 1 ? '' : 's'}
            {filters.search.trim() ? ` matching "${filters.search.trim()}"` : ''}
          </span>
          {pages > 1 && (
            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className={`${commissionPaginationInactive} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                ← Prev
              </button>
              {pageWindowStart > 1 && (
                <>
                  <button type="button" onClick={() => setPage(1)} className={commissionPaginationInactive}>1</button>
                  {pageWindowStart > 2 && <span className="px-1 text-xs text-muted-foreground">…</span>}
                </>
              )}
              {pageNumbers.map(pg => (
                <button
                  key={pg}
                  type="button"
                  onClick={() => setPage(pg)}
                  className={page === pg ? commissionPaginationActive : commissionPaginationInactive}
                >
                  {pg}
                </button>
              ))}
              {pageWindowStart + 4 < pages && (
                <>
                  {pageWindowStart + 5 < pages && <span className="px-1 text-xs text-muted-foreground">…</span>}
                  <button type="button" onClick={() => setPage(pages)} className={commissionPaginationInactive}>{pages}</button>
                </>
              )}
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage(p => p + 1)}
                className={`${commissionPaginationInactive} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div data-kiterp-modal
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={closeForm}
        >
          <div
            className="bg-card border border-border text-foreground rounded-xl w-full max-w-md shadow-2xl my-auto max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-border flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-semibold text-foreground">{editing ? 'Edit Assignment' : 'New Assignment'}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Fields marked <span className="text-red-500">*</span> are required</p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">

              {!editing && (
                <div>
                  <Label className={`block mb-1 ${formLabelClass}`} required>Payee</Label>
                  <PayeeSelector onChange={p => setSelectedPayee(p)} />
                </div>
              )}

              <div>
                <Label className={`block mb-1 ${formLabelClass}`} required>Commission Plan</Label>
                <Select
                  value={String(form.plan_id)}
                  onChange={(v) => set('plan_id', v)}
                  options={selectOptionsWithBlank('Select plan…', plans.map(p => ({ value: p.id, label: p.name })))}
                  placeholder="Select plan…"
                  aria-label="Commission plan"
                  className="w-full"
                />
              </div>

              <div>
                <Label className={`block mb-1 ${formLabelClass}`}>Weight (%)</Label>
                <Input type="number" min="0" max="100" step="0.01"
                  value={Number(form.weight_percent)}
                  onChange={e => set('weight_percent', parseFloat(e.target.value) || 100)}
                  className="h-9" />
                <p className="text-xs text-muted-foreground mt-1">100% means this payee earns the full commission. Split assignments should sum to 100.</p>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="assign-active" checked={Boolean(form.is_active)}
                  onChange={e => set('is_active', e.target.checked)}
                  className="rounded border-input accent-primary" />
                <label htmlFor="assign-active" className="text-sm text-muted-foreground">Active</label>
              </div>

              <CollapsibleSection title="Scope & Validity">
                <div className="grid grid-cols-2 gap-4">
                  {[{ k: 'valid_from', l: 'Valid From' }, { k: 'valid_to', l: 'Valid To' }].map(f => (
                    <div key={f.k}>
                      <Label className={`block mb-1 ${formLabelClass}`}>{f.l}</Label>
                      <Input type="date" value={String(form[f.k] || '')} onChange={e => set(f.k, e.target.value)} className="h-9" />
                    </div>
                  ))}
                </div>

                <div>
                  <Label className={`block mb-1 ${formLabelClass}`}>Store / Branch</Label>
                  <Select
                    value={String(form.store_id || '')}
                    onChange={(v) => set('store_id', v)}
                    options={selectOptionsWithBlank('All stores (no restriction)', stores.map(s => ({
                      value: s.id,
                      label: `${s.name}${s.code ? ` (${s.code})` : ''}`,
                    })))}
                    placeholder="All stores (no restriction)"
                    aria-label="Store or branch"
                    className="w-full"
                  />
                </div>

                <div>
                  <Label className={`block mb-1 ${formLabelClass}`}>Team ID</Label>
                  <Input value={String(form.team_id || '')} onChange={e => set('team_id', e.target.value)}
                    placeholder="Team UUID (optional)" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[{ k: 'location', l: 'Location' }, { k: 'group_name', l: 'Group' }].map(f => (
                    <div key={f.k}>
                      <Label className={`block mb-1 ${formLabelClass}`}>{f.l}</Label>
                      <Input value={String(form[f.k] || '')} onChange={e => set(f.k, e.target.value)} />
                    </div>
                  ))}
                </div>

                <div>
                  <Label className={`block mb-1 ${formLabelClass}`}>Notes</Label>
                  <textarea rows={2} value={String(form.notes || '')} onChange={e => set('notes', e.target.value)}
                    className={commissionFieldInput} />
                </div>
              </CollapsibleSection>
            </div>

            <div className="p-4 border-t border-border bg-muted/25 flex gap-3 justify-end">
              <Button type="button" variant="cancel" onClick={closeForm}>Cancel</Button>
              <Button type="button" onClick={handleSave} disabled={create.isPending || update.isPending}>
                {create.isPending || update.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
