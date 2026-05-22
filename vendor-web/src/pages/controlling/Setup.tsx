import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccounts, useCompanies } from '@/hooks/useFinance'
import {
  useActivityTypes,
  useCreateActivityType,
  useOverheadPools,
  useCreateOverheadPool,
  useOverheadRates,
  useCreateOverheadRate,
  useCoGlMapping,
  usePutCoGlMapping,
} from '@/hooks/useControlling'
import { toast } from 'sonner'
import { ArrowLeft, Layers, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

const BASES = [
  'labor_hours',
  'machine_hours',
  'material_cost',
  'units_produced',
  'direct_labor_cost',
]

const FORMULA_TYPES = [
  { value: 'fixed_rate',        label: 'Fixed rate × qty' },
  { value: 'pct_of_base',       label: '% of allocation base' },
  { value: 'per_machine_hour',  label: 'Rate per machine hour' },
  { value: 'per_labor_hour',    label: 'Rate per labor hour' },
  { value: 'per_unit',          label: 'Rate per unit produced' },
]

export default function ControllingSetupPage() {
  const { data: companies = [] } = useCompanies()
  const [companyId, setCompanyId] = useState('')
  const activeCo = useMemo(
    () => companyId || companies.find(c => c.is_default)?.id || companies[0]?.id || '',
    [companyId, companies],
  )

  const { data: activities = [], refetch: refA } = useActivityTypes(activeCo || undefined)
  const { data: pools = [], refetch: refP } = useOverheadPools(activeCo || undefined)

  const [poolForRates, setPoolForRates] = useState<string>('')
  const { data: rates = [], refetch: refR } = useOverheadRates(poolForRates || undefined)

  const createAct = useCreateActivityType()
  const createPool = useCreateOverheadPool()
  const createRate = useCreateOverheadRate()
  const { data: accounts = [] } = useAccounts()
  const { data: glMap, refetch: refGl } = useCoGlMapping(activeCo || undefined)
  const putGl = usePutCoGlMapping()

  const [actForm, setActForm] = useState({ code: '', name: '', uom: 'H' })
  const [poolForm, setPoolForm] = useState({
    code: '', name: '', allocation_base: 'labor_hours',
    overhead_type: 'indirect', formula_type: 'fixed_rate', formula_value: '0',
  })
  const [rateForm, setRateForm] = useState({
    effective_from: new Date().toISOString().slice(0, 10),
    rate_per_unit: '0',
  })
  const [glForm, setGlForm] = useState({
    wip_account_id: '',
    finished_goods_account_id: '',
    cogs_account_id: '',
    production_variance_account_id: '',
    raw_material_account_id: '',
  })

  useEffect(() => {
    if (!glMap) return
    setGlForm({
      wip_account_id: glMap.wip_account_id ?? '',
      finished_goods_account_id: glMap.finished_goods_account_id ?? '',
      cogs_account_id: glMap.cogs_account_id ?? '',
      production_variance_account_id: glMap.production_variance_account_id ?? '',
      raw_material_account_id: glMap.raw_material_account_id ?? '',
    })
  }, [glMap])

  const addActivity = async () => {
    if (!activeCo || !actForm.code) return
    try {
      await createAct.mutateAsync({
        company_id: activeCo,
        code: actForm.code,
        name: actForm.name || actForm.code,
        uom: actForm.uom,
      })
      toast.success('Activity type saved')
      setActForm({ code: '', name: '', uom: 'H' })
      refA()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      toast.error(err.response?.data?.detail || 'Failed')
    }
  }

  const addPool = async () => {
    if (!activeCo || !poolForm.code) return
    try {
      await createPool.mutateAsync({
        company_id: activeCo,
        code: poolForm.code,
        name: poolForm.name || poolForm.code,
        allocation_base: poolForm.allocation_base,
        overhead_type: poolForm.overhead_type,
        formula_type: poolForm.formula_type,
        formula_value: poolForm.formula_value,
      })
      toast.success('Overhead pool saved')
      setPoolForm({ code: '', name: '', allocation_base: 'labor_hours', overhead_type: 'indirect', formula_type: 'fixed_rate', formula_value: '0' })
      refP()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      toast.error(err.response?.data?.detail || 'Failed')
    }
  }

  const addRate = async () => {
    if (!poolForRates) return
    try {
      await createRate.mutateAsync({
        poolId: poolForRates,
        data: {
          effective_from: rateForm.effective_from,
          rate_per_unit: rateForm.rate_per_unit,
        },
      })
      toast.success('Rate added')
      refR()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      toast.error(err.response?.data?.detail || 'Failed')
    }
  }

  const saveGlMapping = async () => {
    if (!activeCo) return
    const payload: Record<string, unknown> = { company_id: activeCo }
    if (glForm.wip_account_id) payload.wip_account_id = glForm.wip_account_id
    if (glForm.finished_goods_account_id) payload.finished_goods_account_id = glForm.finished_goods_account_id
    if (glForm.cogs_account_id) payload.cogs_account_id = glForm.cogs_account_id
    if (glForm.production_variance_account_id) payload.production_variance_account_id = glForm.production_variance_account_id
    if (glForm.raw_material_account_id) payload.raw_material_account_id = glForm.raw_material_account_id
    try {
      await putGl.mutateAsync(payload)
      toast.success('CO GL mapping saved')
      refGl()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      toast.error(err.response?.data?.detail || 'Failed')
    }
  }

  return (
    <div className="p-6 max-w-6xl space-y-8">
      <div className="flex items-center gap-4">
        <Link to="/controlling" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> CO Dashboard
        </Link>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="w-7 h-7 text-primary" /> Activities &amp; Overhead Setup
          </h1>
          <p className="text-sm text-gray-500 mt-1">Drivers For Activity-Based Costing And Overhead Absorption.</p>
        </div>
        {companies.length > 0 && (
          <label className="flex flex-col gap-1 text-xs text-gray-600">
            Company
            <select
              value={activeCo}
              onChange={e => setCompanyId(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white min-w-[200px]"
            >
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.code}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <h2 className="font-semibold text-gray-800">Activity types</h2>
          <div className="flex flex-wrap gap-2 items-end">
            <input
              placeholder="Code"
              value={actForm.code}
              onChange={e => setActForm(f => ({ ...f, code: e.target.value }))}
              className="rounded-lg border border-gray-200 px-2 py-2 text-sm w-28"
            />
            <input
              placeholder="Name"
              value={actForm.name}
              onChange={e => setActForm(f => ({ ...f, name: e.target.value }))}
              className="rounded-lg border border-gray-200 px-2 py-2 text-sm flex-1 min-w-[120px]"
            />
            <select
              value={actForm.uom}
              onChange={e => setActForm(f => ({ ...f, uom: e.target.value }))}
              className="rounded-lg border border-gray-200 px-2 py-2 text-sm"
            >
              <option value="H">Hours</option>
              <option value="MH">Machine hrs</option>
              <option value="EA">Each</option>
            </select>
            <Button type="button" size="sm" onClick={addActivity} className="gap-1">
              <Plus className="w-3 h-3" /> Add
            </Button>
          </div>
          <ul className="text-sm divide-y divide-gray-100 max-h-64 overflow-auto">
            {activities.length === 0 ? (
              <li className="py-3 text-gray-500">No activity types.</li>
            ) : (
              activities.map((a: { id: string; code: string; name: string; uom: string }) => (
                <li key={a.id} className="py-2 flex justify-between gap-2">
                  <span className="font-mono text-primary">{a.code}</span>
                  <span className="text-gray-800">{a.name}</span>
                  <span className="text-gray-500 text-xs">{a.uom}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div>
            <h2 className="font-semibold text-gray-800">Overhead pools</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Define both <strong>direct</strong> (machine/operation-driven) and <strong>indirect</strong>
              (period allocation) overhead pools with their absorption formula.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <input
              placeholder="Code"
              value={poolForm.code}
              onChange={e => setPoolForm(f => ({ ...f, code: e.target.value }))}
              className="rounded-lg border border-gray-200 px-2 py-2 text-sm"
            />
            <input
              placeholder="Name"
              value={poolForm.name}
              onChange={e => setPoolForm(f => ({ ...f, name: e.target.value }))}
              className="rounded-lg border border-gray-200 px-2 py-2 text-sm"
            />
            <select
              value={poolForm.overhead_type}
              onChange={e => setPoolForm(f => ({ ...f, overhead_type: e.target.value }))}
              className="rounded-lg border border-gray-200 px-2 py-2 text-sm"
            >
              <option value="direct">Direct overhead</option>
              <option value="indirect">Indirect overhead</option>
            </select>
            <select
              value={poolForm.allocation_base}
              onChange={e => setPoolForm(f => ({ ...f, allocation_base: e.target.value }))}
              className="rounded-lg border border-gray-200 px-2 py-2 text-sm"
            >
              {BASES.map(b => <option key={b} value={b}>{b.replace(/_/g, ' ')}</option>)}
            </select>
            <select
              value={poolForm.formula_type}
              onChange={e => setPoolForm(f => ({ ...f, formula_type: e.target.value }))}
              className="rounded-lg border border-gray-200 px-2 py-2 text-sm"
            >
              {FORMULA_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
            </select>
            <div className="flex gap-1">
              <input
                type="number"
                placeholder={poolForm.formula_type === 'pct_of_base' ? '% value' : 'Rate value'}
                value={poolForm.formula_value}
                onChange={e => setPoolForm(f => ({ ...f, formula_value: e.target.value }))}
                className="rounded-lg border border-gray-200 px-2 py-2 text-sm flex-1"
                min="0" step="0.01"
              />
              <Button type="button" size="sm" onClick={addPool} className="gap-1 whitespace-nowrap">
                <Plus className="w-3 h-3" /> Add
              </Button>
            </div>
          </div>
          <ul className="text-sm divide-y divide-gray-100 max-h-56 overflow-auto">
            {pools.length === 0 ? (
              <li className="py-3 text-gray-500 text-sm">No overhead pools yet.</li>
            ) : (
              pools.map((p: { id: string; code: string; name: string; allocation_base: string; overhead_type?: string; formula_type?: string; formula_value?: string }) => (
                <li key={p.id} className="py-2">
                  <button
                    type="button"
                    className={`w-full text-left flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 -mx-2 ${
                      poolForRates === p.id ? 'bg-primary/10' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setPoolForRates(p.id)}
                  >
                    <span className="font-mono text-primary font-semibold">{p.code}</span>
                    <span className="text-gray-700 flex-1 min-w-[100px]">{p.name}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      p.overhead_type === 'direct' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                    }`}>{p.overhead_type ?? 'indirect'}</span>
                    <span className="text-gray-400 text-xs">{(p.formula_type ?? 'fixed_rate').replace(/_/g, ' ')}</span>
                    <span className="text-gray-500 text-xs font-mono">{p.formula_value ?? '0'}</span>
                  </button>
                </li>
              ))
            )}
          </ul>

          {poolForRates && (
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Rates for selected pool</h3>
              <div className="flex flex-wrap gap-2 items-end">
                <input
                  type="date"
                  value={rateForm.effective_from}
                  onChange={e => setRateForm(f => ({ ...f, effective_from: e.target.value }))}
                  className="rounded-lg border border-gray-200 px-2 py-2 text-sm"
                />
                <input
                  placeholder="Rate / unit"
                  value={rateForm.rate_per_unit}
                  onChange={e => setRateForm(f => ({ ...f, rate_per_unit: e.target.value }))}
                  className="rounded-lg border border-gray-200 px-2 py-2 text-sm w-32"
                />
                <Button type="button" size="sm" onClick={addRate}>Add rate</Button>
              </div>
              <ul className="text-xs text-gray-600 space-y-1 max-h-32 overflow-auto">
                {rates.map((r: { id: string; effective_from: string; rate_per_unit: string | number }) => (
                  <li key={r.id} className="flex justify-between">
                    <span>{r.effective_from}</span>
                    <span className="tabular-nums">{r.rate_per_unit}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-800">CO — GL accounts (settlement)</h2>
          <p className="text-sm text-gray-500 mt-1">
            Map WIP, Finished Goods, And COGS For Production Completion And Cost-Of-Goods Postings.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          {(
            [
              ['wip_account_id', 'WIP / production'],
              ['finished_goods_account_id', 'Finished goods'],
              ['cogs_account_id', 'Cost of goods sold'],
              ['production_variance_account_id', 'Production variance (optional)'],
              ['raw_material_account_id', 'Raw material (optional)'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex flex-col gap-1 text-xs text-gray-600">
              {label}
              <select
                value={glForm[key]}
                onChange={e => setGlForm(f => ({ ...f, [key]: e.target.value }))}
                className="rounded-lg border border-gray-200 px-2 py-2 text-sm bg-white"
              >
                <option value="">—</option>
                {(accounts as { id: string; code: string; name: string }[]).map(a => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <Button type="button" size="sm" onClick={saveGlMapping} disabled={!activeCo || putGl.isPending}>
          Save GL mapping
        </Button>
      </div>
    </div>
  )
}
