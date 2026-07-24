import { useState, useMemo } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { Link } from 'react-router-dom'
import { Plus, RotateCcw, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import { useCompanies } from '@/hooks/useFinance'
import {
  useGoodsMovements,
  useCreateGoodsMovement,
  useReverseGoodsMovement,
  useManufacturingOrders,
} from '@/hooks/useControlling'
import { formatCurrency } from '@/lib/utils'
import type { GoodsMovementOut } from '@/api/controlling'

const MOVEMENT_TYPES = [
  { value: 'component_issue', label: 'Goods Issue — Component → Order', icon: ArrowDownToLine, color: 'red' },
  { value: 'component_return', label: 'GI Return — Component ← Order', icon: ArrowUpFromLine, color: 'amber' },
  { value: 'fg_receipt', label: 'Goods Receipt — FG ← Order', icon: ArrowUpFromLine, color: 'emerald' },
  { value: 'fg_receipt_reversal', label: 'GR Return — FG → Order', icon: ArrowDownToLine, color: 'gray' },
]

const typeLabel = (mt: string) => MOVEMENT_TYPES.find(t => t.value === mt)?.label ?? mt

const typeColor = (mt: string) => {
  const m: Record<string, string> = {
    component_issue: 'bg-red-100 text-red-700',
    component_return: 'bg-amber-100 text-amber-700',
    fg_receipt: 'bg-emerald-100 text-emerald-700',
    fg_receipt_reversal: 'bg-gray-100 text-gray-700',
  }
  return m[mt] ?? 'bg-gray-100 text-gray-600'
}

interface CreateForm {
  company_id: string
  order_id: string
  movement_type: string
  posting_date: string
  product_id: string
  description: string
  uom: string
  qty: string
  unit_cost: string
  storage_location: string
  batch_no: string
}

export default function GoodsMovementsPage() {
  const { data: companies = [] } = useCompanies()
  const [companyId, setCompanyId] = useState('')
  const [movTypeFilter, setMovTypeFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [reverseId, setReverseId] = useState<string | null>(null)
  const [reverseReason, setReverseReason] = useState('')
  const [error, setError] = useState('')

  const activeCo = useMemo(
    () => companyId || companies.find(c => c.is_default)?.id || companies[0]?.id || '',
    [companyId, companies],
  )

  const { data: movements = [], isLoading } = useGoodsMovements({
    company_id: activeCo || undefined,
    movement_type: movTypeFilter || undefined,
    from_date: fromDate || undefined,
    to_date: toDate || undefined,
  })

  const { data: orders = [] } = useManufacturingOrders({
    company_id: activeCo || undefined,
  })

  const createMut = useCreateGoodsMovement()
  const reverseMut = useReverseGoodsMovement()

  const [form, setForm] = useState<CreateForm>({
    company_id: '',
    order_id: '',
    movement_type: 'component_issue',
    posting_date: new Date().toISOString().split('T')[0],
    product_id: '',
    description: '',
    uom: 'EA',
    qty: '',
    unit_cost: '',
    storage_location: '',
    batch_no: '',
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await createMut.mutateAsync({
        ...form,
        company_id: activeCo,
        qty: parseFloat(form.qty),
        unit_cost: parseFloat(form.unit_cost || '0'),
        product_id: form.product_id || undefined,
      })
      setShowCreate(false)
      setForm(f => ({ ...f, qty: '', description: '', batch_no: '' }))
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { detail?: string } } }
      setError(e2?.response?.data?.detail ?? 'Failed to create goods movement')
    }
  }

  const handleReverse = async () => {
    if (!reverseId || !reverseReason.trim()) return
    try {
      await reverseMut.mutateAsync({ id: reverseId, reason: reverseReason })
      setReverseId(null)
      setReverseReason('')
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { detail?: string } } }
      setError(e2?.response?.data?.detail ?? 'Failed to reverse')
    }
  }

  const total261 = movements.filter(m => m.movement_type === 'component_issue').reduce((s, m) => s + parseFloat(m.total_cost), 0)
  const total101 = movements.filter(m => m.movement_type === 'fg_receipt').reduce((s, m) => s + parseFloat(m.total_cost), 0)

  return (
    <div className="mx-auto max-w-7xl space-y-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-xs text-muted-foreground">
          Component issues, FG receipts, and returns
          {' · '}
          <Link to="/controlling" className="text-primary hover:underline">Controlling</Link>
        </p>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" /> Post Movement
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 mb-1">Total movements</p>
          <p className="text-2xl font-bold text-gray-900">{movements.length}</p>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
          <p className="text-xs text-red-600 mb-1">Component issues cost</p>
          <p className="text-2xl font-bold text-red-700">{formatCurrency(total261)}</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="text-xs text-emerald-600 mb-1">FG receipts cost</p>
          <p className="text-2xl font-bold text-emerald-700">{formatCurrency(total101)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {companies.length > 1 && (
          <Select
            value={activeCo}
            onChange={setCompanyId}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
            options={companies.map(c => ({ value: String(c.id), label: String(c.code) }))}
          />
        )}
        <Select
          value={movTypeFilter}
          onChange={setMovTypeFilter}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
          placeholder="All types"
          options={[
            { value: '', label: 'All types' },
            ...MOVEMENT_TYPES.map(t => ({ value: t.value, label: t.label })),
          ]}
        />
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white" placeholder="From" />
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white" placeholder="To" />
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm p-3">{error}</div>}

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Doc No</TableColumnLabel></th>
              <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Type</TableColumnLabel></th>
              <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Date</TableColumnLabel></th>
              <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Description</TableColumnLabel></th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right"><TableColumnLabel>Qty</TableColumnLabel></th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right"><TableColumnLabel>Unit Cost</TableColumnLabel></th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right"><TableColumnLabel>Total</TableColumnLabel></th>
              <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Status</TableColumnLabel></th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            )}
            {!isLoading && movements.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No goods movements. Post your first movement above.</td></tr>
            )}
            {movements.map((gm: GoodsMovementOut) => (
              <tr key={gm.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{gm.document_no}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${typeColor(gm.movement_type)}`}>
                    {typeLabel(gm.movement_type)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700">{gm.posting_date}</td>
                <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{gm.description}</td>
                <td className="px-4 py-3 text-right text-gray-700">{parseFloat(gm.qty).toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(parseFloat(gm.unit_cost))}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(parseFloat(gm.total_cost))}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${gm.status === 'reversed' ? 'bg-gray-100 text-gray-500' : 'bg-emerald-100 text-emerald-700'}`}>
                    {gm.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {gm.status === 'posted' && (
                    <button
                      onClick={() => { setReverseId(gm.id); setReverseReason('') }}
                      className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" /> Reverse
                    </button>
                  )}
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
              title="Post Goods Movement"
              onClose={() => setShowCreate(false)}
              className="border-0 px-4 py-2.5 [&>div>h2]:text-base [&>div>h2]:leading-none"
            />
            <form onSubmit={handleCreate} className="flex min-h-0 flex-1 flex-col">
              <ModalBody className="space-y-2 overflow-y-auto px-4 pb-1 pt-0">
                <div>
                  <Label className="mb-0.5 block text-[11px] font-medium text-muted-foreground" required>Movement Type</Label>
                  <Select
                    value={form.movement_type}
                    onChange={v => setForm(f => ({ ...f, movement_type: v }))}
                    className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                    options={MOVEMENT_TYPES.map(t => ({ value: t.value, label: t.label }))}
                  />
                </div>
                <div>
                  <Label className="mb-0.5 block text-[11px] font-medium text-muted-foreground" required>CO Order</Label>
                  <Select
                    value={form.order_id}
                    onChange={v => setForm(f => ({ ...f, order_id: v }))}
                    className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                    placeholder="— select order —"
                    options={[
                      { value: '', label: '— select order —' },
                      ...(orders as Array<{ id: string; order_no: string; title?: string }>).map(o => ({
                        value: o.id,
                        label: `${o.order_no}${o.title ? ` — ${o.title}` : ''}`,
                      })),
                    ]}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="mb-0.5 block text-[11px] font-medium text-muted-foreground" required>Posting Date</Label>
                    <input type="date" value={form.posting_date}
                      onChange={e => setForm(f => ({ ...f, posting_date: e.target.value }))}
                      className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm" required />
                  </div>
                  <div>
                    <Label className="mb-0.5 block text-[11px] font-medium text-muted-foreground">UoM</Label>
                    <input value={form.uom} onChange={e => setForm(f => ({ ...f, uom: e.target.value }))}
                      className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm" />
                  </div>
                </div>
                <div>
                  <Label className="mb-0.5 block text-[11px] font-medium text-muted-foreground">Description</Label>
                  <input value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                    placeholder="Component name / item description" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="mb-0.5 block text-[11px] font-medium text-muted-foreground" required>Quantity</Label>
                    <input type="number" step="0.0001" value={form.qty}
                      onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}
                      className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm" required />
                  </div>
                  <div>
                    <Label className="mb-0.5 block text-[11px] font-medium text-muted-foreground">Unit Cost</Label>
                    <input type="number" step="0.0001" value={form.unit_cost}
                      onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))}
                      className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm" />
                  </div>
                  <div>
                    <Label className="mb-0.5 block text-[11px] font-medium text-muted-foreground">Storage Location</Label>
                    <input value={form.storage_location}
                      onChange={e => setForm(f => ({ ...f, storage_location: e.target.value }))}
                      className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm" />
                  </div>
                  <div>
                    <Label className="mb-0.5 block text-[11px] font-medium text-muted-foreground">Batch / Lot No</Label>
                    <input value={form.batch_no}
                      onChange={e => setForm(f => ({ ...f, batch_no: e.target.value }))}
                      className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm" />
                  </div>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
              </ModalBody>
              <ModalFooter className="border-0 px-4 py-2.5">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="btn-cancel h-8 rounded-md border border-border px-3 text-sm font-medium">
                  Cancel
                </button>
                <button type="submit" disabled={createMut.isPending}
                  className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60">
                  {createMut.isPending ? 'Posting…' : 'Post Movement'}
                </button>
              </ModalFooter>
            </form>
          </ModalPanel>
        </ModalOverlay>
      )}

      {/* Reverse modal */}
      {reverseId && (
        <ModalOverlay onClose={() => setReverseId(null)} className="z-[100] bg-black/60 p-3">
          <ModalPanel className="max-w-md max-h-[calc(100dvh-1.5rem)] !rounded-lg overflow-hidden">
            <ModalHeader
              title="Reverse Goods Movement"
              onClose={() => setReverseId(null)}
              className="border-0 px-4 py-2.5 [&>div>h2]:text-base [&>div>h2]:leading-none"
            />
            <ModalBody className="space-y-2 px-4 pb-1 pt-0">
              <p className="text-sm text-muted-foreground">
                This will mark the movement as reversed. Please provide a reason.
              </p>
              <textarea
                value={reverseReason}
                onChange={e => setReverseReason(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm"
                placeholder="Reason for reversal…"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
            </ModalBody>
            <ModalFooter className="border-0 px-4 py-2.5">
              <button type="button" onClick={() => setReverseId(null)}
                className="btn-cancel h-8 rounded-md border border-border px-3 text-sm font-medium">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReverse}
                disabled={!reverseReason.trim() || reverseMut.isPending}
                className="h-8 rounded-md bg-amber-600 px-3 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {reverseMut.isPending ? 'Reversing…' : 'Confirm Reversal'}
              </button>
            </ModalFooter>
          </ModalPanel>
        </ModalOverlay>
      )}
    </div>
  )
}
