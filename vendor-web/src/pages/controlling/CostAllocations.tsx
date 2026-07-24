import { useState, useMemo } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { Link } from 'react-router-dom'
import { Plus, SendHorizonal, Trash2 } from 'lucide-react'
import { useCompanies } from '@/hooks/useFinance'
import {
  useCostAllocations,
  useCreateCostAllocation,
  usePostCostAllocation,
  useDeleteCostAllocation,
} from '@/hooks/useControlling'
import { formatCurrency } from '@/lib/utils'
import type { CostAllocationOut } from '@/api/controlling'

import { askConfirm } from '@/components/common/ConfirmProvider'
const METHODS = ['percentage', 'fixed_amount', 'quantity_based', 'headcount']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const statusColor = (s: string) => {
  if (s === 'posted') return 'bg-emerald-100 text-emerald-700'
  if (s === 'reversed') return 'bg-gray-100 text-gray-500'
  return 'bg-amber-100 text-amber-700'
}

interface CreateForm {
  allocation_cycle: string
  period_year: string
  period_month: string
  allocation_method: string
  allocation_value: string
  allocated_amount: string
  narration: string
}

export default function CostAllocationsPage() {
  const { data: companies = [] } = useCompanies()
  const [companyId, setCompanyId] = useState('')
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth)
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState('')

  const activeCo = useMemo(
    () => companyId || companies.find(c => c.is_default)?.id || companies[0]?.id || '',
    [companyId, companies],
  )

  const { data: allocations = [], isLoading } = useCostAllocations({
    company_id: activeCo || undefined,
    period_year: year,
    period_month: month,
    status: statusFilter || undefined,
  })

  const createMut = useCreateCostAllocation()
  const postMut = usePostCostAllocation()
  const deleteMut = useDeleteCostAllocation()

  const [form, setForm] = useState<CreateForm>({
    allocation_cycle: '',
    period_year: String(currentYear),
    period_month: String(currentMonth),
    allocation_method: 'percentage',
    allocation_value: '',
    allocated_amount: '',
    narration: '',
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await createMut.mutateAsync({
        company_id: activeCo,
        period_year: parseInt(form.period_year),
        period_month: parseInt(form.period_month),
        allocation_cycle: form.allocation_cycle || undefined,
        allocation_method: form.allocation_method,
        allocation_value: parseFloat(form.allocation_value || '0'),
        allocated_amount: parseFloat(form.allocated_amount || '0'),
        narration: form.narration || undefined,
      })
      setShowCreate(false)
      setForm(f => ({ ...f, allocation_cycle: '', allocated_amount: '', narration: '' }))
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { detail?: string } } }
      setError(e2?.response?.data?.detail ?? 'Failed to create')
    }
  }

  const handlePost = async (id: string) => {
    try {
      await postMut.mutateAsync({ id })
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { detail?: string } } }
      setError(e2?.response?.data?.detail ?? 'Failed to post')
    }
  }

  const handleDelete = async (id: string) => {
    if (!await askConfirm('Delete this allocation?')) return
    try {
      await deleteMut.mutateAsync(id)
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { detail?: string } } }
      setError(e2?.response?.data?.detail ?? 'Failed to delete')
    }
  }

  const totalAllocated = (allocations as CostAllocationOut[]).reduce(
    (s, a) => s + parseFloat(a.allocated_amount),
    0,
  )

  return (
    <div className="mx-auto max-w-7xl space-y-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-xs text-muted-foreground">
          Period-end cost center to cost center allocations
          {' · '}
          <Link to="/controlling" className="text-primary hover:underline">Controlling</Link>
        </p>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" /> New Allocation
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 mb-1">Allocations this period</p>
          <p className="text-2xl font-bold text-gray-900">{allocations.length}</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <p className="text-xs text-amber-600 mb-1">Pending (not yet posted)</p>
          <p className="text-2xl font-bold text-amber-700">
            {(allocations as CostAllocationOut[]).filter(a => a.status === 'planned').length}
          </p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-accent p-4">
          <p className="text-xs text-primary mb-1">Total allocated amount</p>
          <p className="text-2xl font-bold text-primary">{formatCurrency(totalAllocated)}</p>
        </div>
      </div>

      {/* Period filter */}
      <div className="flex flex-wrap gap-3 items-center">
        {companies.length > 1 && (
          <Select
            value={activeCo}
            onChange={setCompanyId}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
            options={companies.map(c => ({ value: String(c.id), label: String(c.code) }))}
          />
        )}
        <Select
          value={String(year)}
          onChange={v => setYear(Number(v))}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
          options={[currentYear - 1, currentYear, currentYear + 1].map(y => ({
            value: String(y),
            label: String(y),
          }))}
        />
        <Select
          value={String(month)}
          onChange={v => setMonth(Number(v))}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
          options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
          placeholder="All statuses"
          options={[
            { value: '', label: 'All statuses' },
            { value: 'planned', label: 'Planned' },
            { value: 'posted', label: 'Posted' },
            { value: 'reversed', label: 'Reversed' },
          ]}
        />
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm p-3">{error}</div>}

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Cycle</TableColumnLabel></th>
              <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Period</TableColumnLabel></th>
              <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Method</TableColumnLabel></th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right"><TableColumnLabel>Allocation Value</TableColumnLabel></th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right"><TableColumnLabel>Allocated Amount</TableColumnLabel></th>
              <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Status</TableColumnLabel></th>
              <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Posting Date</TableColumnLabel></th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            )}
            {!isLoading && allocations.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No allocations for {MONTHS[month - 1]} {year}. Create one above.
                </td>
              </tr>
            )}
            {(allocations as CostAllocationOut[]).map(a => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{a.allocation_cycle || '—'}</td>
                <td className="px-4 py-3 text-gray-700">{MONTHS[a.period_month - 1]} {a.period_year}</td>
                <td className="px-4 py-3 text-gray-600">{a.allocation_method}</td>
                <td className="px-4 py-3 text-right text-gray-700">{parseFloat(a.allocation_value).toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(parseFloat(a.allocated_amount))}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(a.status)}`}>{a.status}</span>
                </td>
                <td className="px-4 py-3 text-gray-600">{a.posting_date ?? '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {a.status === 'planned' && (
                      <>
                        <button
                          onClick={() => handlePost(a.id)}
                          disabled={postMut.isPending}
                          className="text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1"
                        >
                          <SendHorizonal className="w-3 h-3" /> Post
                        </button>
                        <button onClick={() => handleDelete(a.id)} className="text-red-400 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      {showCreate && (
        <ModalOverlay onClose={() => setShowCreate(false)} className="z-[100] bg-black/60 p-3">
          <ModalPanel className="max-w-lg max-h-[calc(100dvh-1.5rem)] !rounded-lg overflow-hidden">
            <ModalHeader
              title="New Cost Allocation"
              onClose={() => setShowCreate(false)}
              className="border-0 px-4 py-2.5 [&>div>h2]:text-base [&>div>h2]:leading-none"
            />
            <form onSubmit={handleCreate} className="flex min-h-0 flex-1 flex-col">
              <ModalBody className="space-y-2 overflow-y-auto px-4 pb-1 pt-0">
                <div>
                  <Label className="mb-0.5 block text-[11px] font-medium text-muted-foreground">Allocation Cycle Name</Label>
                  <input value={form.allocation_cycle}
                    onChange={e => setForm(f => ({ ...f, allocation_cycle: e.target.value }))}
                    className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                    placeholder="e.g. ADMIN-ALLOC, FACILITY-COST" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="mb-0.5 block text-[11px] font-medium text-muted-foreground" required>Year</Label>
                    <input type="number" value={form.period_year}
                      onChange={e => setForm(f => ({ ...f, period_year: e.target.value }))}
                      className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm" required />
                  </div>
                  <div>
                    <Label className="mb-0.5 block text-[11px] font-medium text-muted-foreground" required>Month</Label>
                    <Select
                      value={form.period_month}
                      onChange={v => setForm(f => ({ ...f, period_month: v }))}
                      className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                      options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
                    />
                  </div>
                </div>
                <div>
                  <Label className="mb-0.5 block text-[11px] font-medium text-muted-foreground">Allocation Method</Label>
                  <Select
                    value={form.allocation_method}
                    onChange={v => setForm(f => ({ ...f, allocation_method: v }))}
                    className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                    options={METHODS.map(m => ({ value: m, label: m }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="mb-0.5 block text-[11px] font-medium text-muted-foreground">{form.allocation_method === 'percentage' ? 'Percentage (%)' : 'Driver Value'}</Label>
                    <input type="number" step="0.000001" value={form.allocation_value}
                      onChange={e => setForm(f => ({ ...f, allocation_value: e.target.value }))}
                      className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm" />
                  </div>
                  <div>
                    <Label className="mb-0.5 block text-[11px] font-medium text-muted-foreground">Allocated Amount</Label>
                    <input type="number" step="0.0001" value={form.allocated_amount}
                      onChange={e => setForm(f => ({ ...f, allocated_amount: e.target.value }))}
                      className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm" />
                  </div>
                </div>
                <div>
                  <Label className="mb-0.5 block text-[11px] font-medium text-muted-foreground">Narration</Label>
                  <input value={form.narration} onChange={e => setForm(f => ({ ...f, narration: e.target.value }))}
                    className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                    placeholder="Description…" />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
              </ModalBody>
              <ModalFooter className="border-0 px-4 py-2.5">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="btn-cancel h-8 rounded-md border border-border px-3 text-sm font-medium">Cancel</button>
                <button type="submit" disabled={createMut.isPending}
                  className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60">
                  {createMut.isPending ? 'Saving…' : 'Create Allocation'}
                </button>
              </ModalFooter>
            </form>
          </ModalPanel>
        </ModalOverlay>
      )}
    </div>
  )
}
