/**
 * Routing — Work Centres & Routing Management
 *
 * Three-panel page:
 *  1. Work Centres — labour/machine stations with direct cost rates
 *  2. Routing Headers — product-linked sequences
 *  3. Routing Operations — step-by-step detail for selected routing
 */
import { useState, useMemo } from 'react'
import {
  Plus, Trash2, Pencil, ChevronDown, ChevronRight,
  Cpu, GitBranch, Clock, Wrench, Check, X,
} from 'lucide-react'
import { useCompanies } from '@/hooks/useFinance'
import {
  useWorkCenters, useCreateWorkCenter, useUpdateWorkCenter, useDeleteWorkCenter,
  useRoutings, useCreateRouting, useUpdateRouting, useDeleteRouting,
  useAddRoutingOperation, useUpdateRoutingOperation, useDeleteRoutingOperation,
  useActivityTypes,
} from '@/hooks/useControlling'
import { useProducts } from '@/hooks/useVendor'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

// ── Types ─────────────────────────────────────────────────────────────────────

interface WorkCenter {
  id: string; code: string; name: string; wc_type: string
  capacity_uom: string
  labor_rate_per_hour: string; machine_rate_per_hour: string; direct_overhead_rate: string
  capacity_hours_per_period: string; is_active: boolean; notes?: string
}

interface RoutingOp {
  id: string; seq_no: number; operation_code?: string; description?: string
  work_center_id?: string; work_center_name?: string; activity_type_id?: string
  setup_hrs: string; run_hrs_per_unit: string; teardown_hrs: string; machine_hrs_per_unit: string
  labor_rate_override?: string; machine_rate_override?: string; direct_overhead_pct: string; notes?: string
}

interface Routing {
  id: string; code: string; name: string; version: string; status: string
  product_id?: string; uom: string; lot_size: string; valid_from?: string; valid_to?: string
  notes?: string; operations: RoutingOp[]
}

const WC_TYPES = ['machine', 'labor', 'outsource']
const ROUTING_STATUSES = ['draft', 'active', 'obsolete']

const statusBadge = (s: string) => {
  const m: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    active: 'bg-emerald-100 text-emerald-700',
    obsolete: 'bg-red-100 text-red-500',
  }
  return m[s] ?? 'bg-gray-100 text-gray-500'
}

const wcTypeBadge = (t: string) => {
  const m: Record<string, string> = {
    machine: 'bg-blue-100 text-blue-700',
    labor: 'bg-violet-100 text-violet-700',
    outsource: 'bg-amber-100 text-amber-700',
  }
  return m[t] ?? 'bg-gray-100 text-gray-500'
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-gray-800">{children}</h2>
    </div>
  )
}

// ── Work Center panel ─────────────────────────────────────────────────────────

function WorkCentersPanel({ companyId }: { companyId: string }) {
  const { data: rawWcs = [], isLoading } = useWorkCenters({ company_id: companyId || undefined })
  const wcs = rawWcs as WorkCenter[]
  const createWc = useCreateWorkCenter()
  const updateWc = useUpdateWorkCenter()
  const deleteWc = useDeleteWorkCenter()

  const blank = { code: '', name: '', wc_type: 'machine', capacity_uom: 'H',
    labor_rate_per_hour: '0', machine_rate_per_hour: '0', direct_overhead_rate: '0',
    capacity_hours_per_period: '0', notes: '' }
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const save = async () => {
    if (!form.code) { toast.error('Code required'); return }
    try {
      if (editing) {
        await updateWc.mutateAsync({ id: editing, data: { ...form, company_id: companyId } })
        toast.success('Work centre updated')
        setEditing(null)
      } else {
        await createWc.mutateAsync({ ...form, company_id: companyId })
        toast.success('Work centre created')
      }
      setForm(blank); setShowForm(false)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      toast.error(err.response?.data?.detail ?? 'Failed')
    }
  }

  const edit = (wc: WorkCenter) => {
    setForm({
      code: wc.code, name: wc.name, wc_type: wc.wc_type,
      capacity_uom: wc.capacity_uom,
      labor_rate_per_hour: wc.labor_rate_per_hour,
      machine_rate_per_hour: wc.machine_rate_per_hour,
      direct_overhead_rate: wc.direct_overhead_rate,
      capacity_hours_per_period: wc.capacity_hours_per_period,
      notes: wc.notes ?? '',
    })
    setEditing(wc.id); setShowForm(true)
  }

  const del = async (id: string) => {
    if (!confirm('Delete this work centre?')) return
    try { await deleteWc.mutateAsync(id); toast.success('Deleted') }
    catch { toast.error('Delete failed') }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-blue-500" />
          <h2 className="text-sm font-semibold text-gray-800">Work Centres</h2>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setForm(blank); setShowForm(v => !v) }}
          className="gap-1 text-xs">
          <Plus className="w-3 h-3" /> Add
        </Button>
      </div>

      {showForm && (
        <div className="p-4 border-b border-gray-100 bg-blue-50/40 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              Code *
              <input value={form.code} onChange={f('code')} placeholder="MC-01"
                className="rounded-lg border border-gray-200 px-2 py-2 bg-white" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-600 col-span-2">
              Name
              <input value={form.name} onChange={f('name')} placeholder="CNC Machine 1"
                className="rounded-lg border border-gray-200 px-2 py-2 bg-white" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              Type
              <select value={form.wc_type} onChange={f('wc_type')}
                className="rounded-lg border border-gray-200 px-2 py-2 bg-white">
                {WC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              Labor rate/hr
              <input type="number" value={form.labor_rate_per_hour} onChange={f('labor_rate_per_hour')} min="0" step="0.01"
                className="rounded-lg border border-gray-200 px-2 py-2 bg-white" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              Machine rate/hr
              <input type="number" value={form.machine_rate_per_hour} onChange={f('machine_rate_per_hour')} min="0" step="0.01"
                className="rounded-lg border border-gray-200 px-2 py-2 bg-white" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              Direct OH rate/hr
              <input type="number" value={form.direct_overhead_rate} onChange={f('direct_overhead_rate')} min="0" step="0.01"
                className="rounded-lg border border-gray-200 px-2 py-2 bg-white" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              Capacity hrs/period
              <input type="number" value={form.capacity_hours_per_period} onChange={f('capacity_hours_per_period')} min="0"
                className="rounded-lg border border-gray-200 px-2 py-2 bg-white" />
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={createWc.isPending || updateWc.isPending}>
              <Check className="w-3 h-3 mr-1" /> {editing ? 'Update' : 'Save'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setEditing(null); setForm(blank) }}>
              <X className="w-3 h-3 mr-1" /> Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-[11px] text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Code</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium text-right">Labor/hr</th>
              <th className="px-4 py-2 font-medium text-right">Machine/hr</th>
              <th className="px-4 py-2 font-medium text-right">Direct OH/hr</th>
              <th className="px-4 py-2 font-medium text-right">Cap. hrs</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">Loading…</td></tr>}
            {!isLoading && wcs.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                No work centres yet — add the machines and labour stations used in production.
              </td></tr>
            )}
            {wcs.map(wc => (
              <tr key={wc.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-mono text-xs font-bold text-gray-900">{wc.code}</td>
                <td className="px-4 py-2 text-gray-700">{wc.name}</td>
                <td className="px-4 py-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${wcTypeBadge(wc.wc_type)}`}>
                    {wc.wc_type}
                  </span>
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-700">{formatCurrency(+wc.labor_rate_per_hour)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-700">{formatCurrency(+wc.machine_rate_per_hour)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-blue-700 font-medium">{formatCurrency(+wc.direct_overhead_rate)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-500">{(+wc.capacity_hours_per_period).toFixed(1)}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => edit(wc)} className="p-1 text-gray-400 hover:text-violet-600 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => del(wc.id)} className="p-1 text-gray-400 hover:text-red-500 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Routing Operations inline editor ─────────────────────────────────────────

function RoutingOperationsEditor({ routing, companyId }: { routing: Routing; companyId: string }) {
  const { data: rawWcs = [] } = useWorkCenters({ company_id: companyId })
  const wcs = rawWcs as WorkCenter[]
  const { data: rawActs = [] } = useActivityTypes(companyId)
  const acts = rawActs as { id: string; code: string; name: string }[]

  const addOp = useAddRoutingOperation()
  const updOp = useUpdateRoutingOperation()
  const delOp = useDeleteRoutingOperation()

  const blankOp = {
    seq_no: ((routing.operations?.length ?? 0) + 1) * 10,
    operation_code: '', description: '',
    work_center_id: '', activity_type_id: '',
    setup_hrs: '0', run_hrs_per_unit: '0', teardown_hrs: '0', machine_hrs_per_unit: '0',
    labor_rate_override: '', machine_rate_override: '',
    direct_overhead_pct: '0', notes: '',
  }
  const [opForm, setOpForm] = useState(blankOp)
  const [editingOp, setEditingOp] = useState<string | null>(null)
  const [showOpForm, setShowOpForm] = useState(false)

  const of = (k: keyof typeof blankOp) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setOpForm(p => ({ ...p, [k]: e.target.value }))

  const saveOp = async () => {
    const payload: Record<string, unknown> = {
      seq_no: +opForm.seq_no,
      operation_code: opForm.operation_code || undefined,
      description: opForm.description || undefined,
      work_center_id: opForm.work_center_id || undefined,
      activity_type_id: opForm.activity_type_id || undefined,
      setup_hrs: +opForm.setup_hrs,
      run_hrs_per_unit: +opForm.run_hrs_per_unit,
      teardown_hrs: +opForm.teardown_hrs,
      machine_hrs_per_unit: +opForm.machine_hrs_per_unit,
      direct_overhead_pct: +opForm.direct_overhead_pct,
      notes: opForm.notes || undefined,
    }
    if (opForm.labor_rate_override) payload.labor_rate_override = +opForm.labor_rate_override
    if (opForm.machine_rate_override) payload.machine_rate_override = +opForm.machine_rate_override
    try {
      if (editingOp) {
        await updOp.mutateAsync({ routingId: routing.id, opId: editingOp, data: payload })
        toast.success('Operation updated')
      } else {
        await addOp.mutateAsync({ routingId: routing.id, data: payload })
        toast.success('Operation added')
      }
      setOpForm(blankOp); setShowOpForm(false); setEditingOp(null)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      toast.error(err.response?.data?.detail ?? 'Failed')
    }
  }

  const editOp = (op: RoutingOp) => {
    setOpForm({
      seq_no: op.seq_no,
      operation_code: op.operation_code ?? '',
      description: op.description ?? '',
      work_center_id: op.work_center_id ?? '',
      activity_type_id: op.activity_type_id ?? '',
      setup_hrs: op.setup_hrs,
      run_hrs_per_unit: op.run_hrs_per_unit,
      teardown_hrs: op.teardown_hrs,
      machine_hrs_per_unit: op.machine_hrs_per_unit,
      labor_rate_override: op.labor_rate_override ?? '',
      machine_rate_override: op.machine_rate_override ?? '',
      direct_overhead_pct: op.direct_overhead_pct,
      notes: op.notes ?? '',
    })
    setEditingOp(op.id); setShowOpForm(true)
  }

  const delOp2 = async (opId: string) => {
    if (!confirm('Remove this operation?')) return
    try { await delOp.mutateAsync({ routingId: routing.id, opId }); toast.success('Removed') }
    catch { toast.error('Failed') }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Wrench className="w-4 h-4 text-violet-500" />
          Operations for: <span className="font-mono text-violet-700">{routing.code} v{routing.version}</span>
          <span className="text-gray-400">({routing.lot_size} {routing.uom} lot)</span>
        </h3>
        <Button size="sm" onClick={() => { setEditingOp(null); setOpForm(blankOp); setShowOpForm(v => !v) }}
          className="gap-1 text-xs">
          <Plus className="w-3 h-3" /> Add operation
        </Button>
      </div>

      {showOpForm && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/30 p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <label className="flex flex-col gap-1 text-gray-600">
              Seq no
              <input type="number" value={opForm.seq_no} onChange={of('seq_no')} min="1"
                className="rounded-lg border border-gray-200 px-2 py-2 bg-white text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-gray-600">
              Op code
              <input value={opForm.operation_code} onChange={of('operation_code')} placeholder="OP-010"
                className="rounded-lg border border-gray-200 px-2 py-2 bg-white text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-gray-600 col-span-2">
              Description
              <input value={opForm.description} onChange={of('description')} placeholder="e.g. CNC Milling"
                className="rounded-lg border border-gray-200 px-2 py-2 bg-white text-sm" />
            </label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <label className="flex flex-col gap-1 text-gray-600">
              Work centre
              <select value={opForm.work_center_id} onChange={of('work_center_id')}
                className="rounded-lg border border-gray-200 px-2 py-2 bg-white text-sm">
                <option value="">— none —</option>
                {wcs.map(wc => <option key={wc.id} value={wc.id}>{wc.code} — {wc.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-gray-600">
              Activity type
              <select value={opForm.activity_type_id} onChange={of('activity_type_id')}
                className="rounded-lg border border-gray-200 px-2 py-2 bg-white text-sm">
                <option value="">— none —</option>
                {acts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-gray-600">
              Direct OH %
              <input type="number" value={opForm.direct_overhead_pct} onChange={of('direct_overhead_pct')} min="0" step="0.01"
                className="rounded-lg border border-gray-200 px-2 py-2 bg-white text-sm" />
            </label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {(['setup_hrs', 'run_hrs_per_unit', 'teardown_hrs', 'machine_hrs_per_unit'] as const).map(k => (
              <label key={k} className="flex flex-col gap-1 text-gray-600">
                {k.replace(/_/g, ' ')}
                <input type="number" value={opForm[k]} onChange={of(k)} min="0" step="0.001"
                  className="rounded-lg border border-gray-200 px-2 py-2 bg-white text-sm" />
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <label className="flex flex-col gap-1 text-gray-600">
              Labor rate override (blank = from WC)
              <input type="number" value={opForm.labor_rate_override} onChange={of('labor_rate_override')} min="0" step="0.01" placeholder="—"
                className="rounded-lg border border-gray-200 px-2 py-2 bg-white text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-gray-600">
              Machine rate override (blank = from WC)
              <input type="number" value={opForm.machine_rate_override} onChange={of('machine_rate_override')} min="0" step="0.01" placeholder="—"
                className="rounded-lg border border-gray-200 px-2 py-2 bg-white text-sm" />
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveOp}><Check className="w-3 h-3 mr-1" />{editingOp ? 'Update' : 'Add'}</Button>
            <Button size="sm" variant="outline" onClick={() => { setShowOpForm(false); setEditingOp(null) }}>
              <X className="w-3 h-3 mr-1" />Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-3 py-2 font-medium">Seq</th>
              <th className="px-3 py-2 font-medium">Code / Description</th>
              <th className="px-3 py-2 font-medium">Work Centre</th>
              <th className="px-3 py-2 font-medium text-right">Setup hrs</th>
              <th className="px-3 py-2 font-medium text-right">Run hrs/unit</th>
              <th className="px-3 py-2 font-medium text-right">Machine hrs/unit</th>
              <th className="px-3 py-2 font-medium text-right">Direct OH%</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {routing.operations.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400">
                No operations. Add the production steps above.
              </td></tr>
            )}
            {routing.operations.map(op => (
              <tr key={op.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono font-bold text-gray-700">{op.seq_no}</td>
                <td className="px-3 py-2">
                  <p className="font-medium text-gray-800">{op.description ?? op.operation_code ?? '—'}</p>
                  {op.operation_code && op.description && <p className="text-gray-400 text-[10px]">{op.operation_code}</p>}
                </td>
                <td className="px-3 py-2 text-gray-600">{op.work_center_name ?? '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{(+op.setup_hrs).toFixed(3)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{(+op.run_hrs_per_unit).toFixed(4)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{(+op.machine_hrs_per_unit).toFixed(4)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-blue-700 font-medium">
                  {(+op.direct_overhead_pct).toFixed(2)}%
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => editOp(op)} className="p-1 text-gray-400 hover:text-violet-600 rounded"><Pencil className="w-3 h-3" /></button>
                    <button onClick={() => delOp2(op.id)} className="p-1 text-gray-400 hover:text-red-500 rounded"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RoutingPage() {
  const { data: companies = [] } = useCompanies()
  const [companyId, setCompanyId] = useState('')
  const activeCo = useMemo(
    () => companyId || companies.find((c: { is_default?: boolean }) => c.is_default)?.id || companies[0]?.id || '',
    [companyId, companies],
  )

  const { data: productsData } = useProducts({ page: 1, size: 300 })
  const products = productsData?.items ?? []

  const { data: rawRoutings = [], isLoading: loadingR } = useRoutings({ company_id: activeCo || undefined })
  const routings = rawRoutings as Routing[]

  const createR = useCreateRouting()
  const updateR = useUpdateRouting()
  const deleteR = useDeleteRouting()

  const [selectedRouting, setSelectedRouting] = useState<string | null>(null)
  const [showRForm, setShowRForm] = useState(false)
  const [editingR, setEditingR] = useState<string | null>(null)
  const blankR = { code: '', name: '', version: '1', status: 'draft', product_id: '', uom: 'EA', lot_size: '1', valid_from: '', notes: '' }
  const [rForm, setRForm] = useState(blankR)

  const rf = (k: keyof typeof blankR) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setRForm(p => ({ ...p, [k]: e.target.value }))

  const saveRouting = async () => {
    if (!rForm.code) { toast.error('Code required'); return }
    const payload: Record<string, unknown> = {
      ...rForm, company_id: activeCo,
      product_id: rForm.product_id || undefined,
      valid_from: rForm.valid_from || undefined,
      lot_size: +rForm.lot_size,
    }
    try {
      if (editingR) {
        await updateR.mutateAsync({ id: editingR, data: payload })
        toast.success('Routing updated'); setEditingR(null)
      } else {
        const res = await createR.mutateAsync(payload) as { id: string }
        toast.success('Routing created'); setSelectedRouting(res.id)
      }
      setRForm(blankR); setShowRForm(false)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      toast.error(err.response?.data?.detail ?? 'Failed')
    }
  }

  const editRouting = (r: Routing) => {
    setRForm({
      code: r.code, name: r.name, version: r.version, status: r.status,
      product_id: r.product_id ?? '', uom: r.uom, lot_size: r.lot_size,
      valid_from: r.valid_from ?? '', notes: r.notes ?? '',
    })
    setEditingR(r.id); setShowRForm(true)
  }

  const delRouting = async (id: string) => {
    if (!confirm('Delete this routing and all its operations?')) return
    try {
      await deleteR.mutateAsync(id)
      toast.success('Routing deleted')
      if (selectedRouting === id) setSelectedRouting(null)
    } catch { toast.error('Delete failed') }
  }

  const activeRouting = routings.find(r => r.id === selectedRouting)

  return (
    <div className="p-6 max-w-full space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Work Centres &amp; Routing</h1>
        <p className="text-sm text-gray-500 mt-1">
          Define machines and labour stations with their rates, then build production routings
          with step-by-step operations linked to work centres.
        </p>
      </div>

      {/* Company selector */}
      {companies.length > 1 && (
        <select value={activeCo} onChange={e => setCompanyId(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
          {companies.map((c: { id: string; code: string; name: string }) =>
            <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
          )}
        </select>
      )}

      {/* ── Work centres ─────────────────────────────────────────────── */}
      <WorkCentersPanel companyId={activeCo} />

      {/* ── Routing headers ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-violet-500" />
            <h2 className="text-sm font-semibold text-gray-800">Routings</h2>
          </div>
          <Button size="sm" onClick={() => { setEditingR(null); setRForm(blankR); setShowRForm(v => !v) }}
            className="gap-1 text-xs">
            <Plus className="w-3 h-3" /> New routing
          </Button>
        </div>

        {showRForm && (
          <div className="p-4 border-b border-gray-100 bg-violet-50/30 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <label className="flex flex-col gap-1 text-gray-600">
                Code *
                <input value={rForm.code} onChange={rf('code')} placeholder="RT-001"
                  className="rounded-lg border border-gray-200 px-2 py-2 bg-white text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-gray-600 col-span-2">
                Name
                <input value={rForm.name} onChange={rf('name')} placeholder="Standard assembly route"
                  className="rounded-lg border border-gray-200 px-2 py-2 bg-white text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-gray-600">
                Version
                <input value={rForm.version} onChange={rf('version')}
                  className="rounded-lg border border-gray-200 px-2 py-2 bg-white text-sm" />
              </label>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <label className="flex flex-col gap-1 text-gray-600 col-span-2">
                Product (optional)
                <select value={rForm.product_id} onChange={rf('product_id')}
                  className="rounded-lg border border-gray-200 px-2 py-2 bg-white text-sm">
                  <option value="">— not assigned —</option>
                  {products.map((p: { id: string; name: string }) =>
                    <option key={p.id} value={p.id}>{p.name}</option>
                  )}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-gray-600">
                Lot size
                <input type="number" value={rForm.lot_size} onChange={rf('lot_size')} min="0.001" step="0.001"
                  className="rounded-lg border border-gray-200 px-2 py-2 bg-white text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-gray-600">
                Status
                <select value={rForm.status} onChange={rf('status')}
                  className="rounded-lg border border-gray-200 px-2 py-2 bg-white text-sm">
                  {ROUTING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveRouting}><Check className="w-3 h-3 mr-1" />{editingR ? 'Update' : 'Create'}</Button>
              <Button size="sm" variant="outline" onClick={() => { setShowRForm(false); setEditingR(null) }}>
                <X className="w-3 h-3 mr-1" />Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-[11px] text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium" />
                <th className="px-4 py-2 font-medium">Code / Version</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Product</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Lot size</th>
                <th className="px-4 py-2 font-medium text-right">Ops</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loadingR && <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">Loading…</td></tr>}
              {!loadingR && routings.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No routings yet. Create one above and then add operations to it.
                </td></tr>
              )}
              {routings.map(r => {
                const pname = products.find((p: { id: string; name: string }) => p.id === r.product_id)?.name
                const isSelected = selectedRouting === r.id
                return (
                  <tr key={r.id} className={`cursor-pointer ${isSelected ? 'bg-violet-50' : 'hover:bg-gray-50'}`}
                    onClick={() => setSelectedRouting(isSelected ? null : r.id)}>
                    <td className="px-4 py-2 text-gray-400">
                      {isSelected ? <ChevronDown className="w-4 h-4 text-violet-500" /> : <ChevronRight className="w-4 h-4" />}
                    </td>
                    <td className="px-4 py-2">
                      <p className="font-mono text-xs font-bold text-gray-900">{r.code}</p>
                      <p className="text-[10px] text-gray-400">v{r.version}</p>
                    </td>
                    <td className="px-4 py-2 text-gray-700">{r.name}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{pname ?? '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${statusBadge(r.status)}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-700">{(+r.lot_size).toFixed(2)} {r.uom}</td>
                    <td className="px-4 py-2 text-right text-gray-600 font-medium">{r.operations.length}</td>
                    <td className="px-4 py-2" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => editRouting(r)} className="p-1 text-gray-400 hover:text-violet-600 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => delRouting(r.id)} className="p-1 text-gray-400 hover:text-red-500 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Operations detail ─────────────────────────────────────────── */}
      {activeRouting && (
        <div className="rounded-xl border border-violet-200 bg-white p-5">
          <RoutingOperationsEditor routing={activeRouting} companyId={activeCo} />
        </div>
      )}

      {/* Info card */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-800 space-y-2">
        <div className="flex items-center gap-2 font-semibold">
          <Clock className="w-4 h-4" /> How routing costing works
        </div>
        <ul className="space-y-1 text-[13px] list-disc list-inside text-blue-700">
          <li><strong>Setup hrs</strong> — one-off per lot (amortised over lot size)</li>
          <li><strong>Run hrs/unit</strong> — labour hours per finished unit produced</li>
          <li><strong>Machine hrs/unit</strong> — machine time per finished unit</li>
          <li><strong>Direct OH %</strong> — % applied on top of direct labor+machine cost at this operation</li>
          <li>Rate overrides at operation level take priority over work centre rates</li>
          <li>Assign the routing to a Product Cost Version to auto-calculate activity and direct overhead lines</li>
        </ul>
      </div>
    </div>
  )
}
