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
import { cn } from '@/lib/utils'

const fieldClass =
  'h-10 rounded-lg border border-input bg-background px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring [color-scheme:dark]'
const labelClass = 'flex flex-col gap-1 text-xs text-muted-foreground'
const cardClass = 'rounded-xl border border-border bg-card p-4 space-y-3'

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
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Layers className="w-7 h-7 text-primary" /> Activities &amp; Overhead Setup
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Drivers For Activity-Based Costing And Overhead Absorption.</p>
        </div>
        {companies.length > 0 && (
          <label className={labelClass}>
            Company
            <select
              value={activeCo}
              onChange={e => setCompanyId(e.target.value)}
              className={cn(fieldClass, 'min-w-[200px]')}
            >
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.code}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className={cardClass}>
          <h2 className="font-semibold text-foreground">Activity Types</h2>
          <div className="flex flex-wrap items-end gap-2">
            <input
              placeholder="Code"
              value={actForm.code}
              onChange={e => setActForm(f => ({ ...f, code: e.target.value }))}
              className={cn(fieldClass, 'w-28')}
            />
            <input
              placeholder="Name"
              value={actForm.name}
              onChange={e => setActForm(f => ({ ...f, name: e.target.value }))}
              className={cn(fieldClass, 'min-w-[120px] flex-1')}
            />
            <select
              value={actForm.uom}
              onChange={e => setActForm(f => ({ ...f, uom: e.target.value }))}
              className={fieldClass}
            >
              <option value="H">Hours</option>
              <option value="MH">Machine hrs</option>
              <option value="EA">Each</option>
            </select>
            <Button type="button" size="sm" onClick={addActivity} className="h-10 gap-1">
              <Plus className="w-3 h-3" /> Add
            </Button>
          </div>
          <ul className="max-h-64 divide-y divide-border overflow-auto text-sm">
            {activities.length === 0 ? (
              <li className="py-3 text-center text-muted-foreground">No activity types.</li>
            ) : (
              activities.map((a: { id: string; code: string; name: string; uom: string }) => (
                <li key={a.id} className="flex justify-between gap-2 py-2">
                  <span className="font-mono text-primary">{a.code}</span>
                  <span className="text-foreground">{a.name}</span>
                  <span className="text-xs text-muted-foreground">{a.uom}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className={cardClass}>
          <div>
            <h2 className="font-semibold text-foreground">Overhead Pools</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Define both <strong className="text-foreground">direct</strong> (machine/operation-driven) and <strong className="text-foreground">indirect</strong>
              {' '}(period allocation) overhead pools with their absorption formula.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <input
              placeholder="Code"
              value={poolForm.code}
              onChange={e => setPoolForm(f => ({ ...f, code: e.target.value }))}
              className={fieldClass}
            />
            <input
              placeholder="Name"
              value={poolForm.name}
              onChange={e => setPoolForm(f => ({ ...f, name: e.target.value }))}
              className={fieldClass}
            />
            <select
              value={poolForm.overhead_type}
              onChange={e => setPoolForm(f => ({ ...f, overhead_type: e.target.value }))}
              className={fieldClass}
            >
              <option value="direct">Direct overhead</option>
              <option value="indirect">Indirect overhead</option>
            </select>
            <select
              value={poolForm.allocation_base}
              onChange={e => setPoolForm(f => ({ ...f, allocation_base: e.target.value }))}
              className={fieldClass}
            >
              {BASES.map(b => <option key={b} value={b}>{b.replace(/_/g, ' ')}</option>)}
            </select>
            <select
              value={poolForm.formula_type}
              onChange={e => setPoolForm(f => ({ ...f, formula_type: e.target.value }))}
              className={fieldClass}
            >
              {FORMULA_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
            </select>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
              <input
                type="number"
                placeholder={poolForm.formula_type === 'pct_of_base' ? '% value' : 'Rate value'}
                value={poolForm.formula_value}
                onChange={e => setPoolForm(f => ({ ...f, formula_value: e.target.value }))}
                className={cn(fieldClass, 'min-w-0 flex-1')}
                min="0" step="0.01"
              />
              <Button type="button" size="sm" onClick={addPool} className="h-10 shrink-0 gap-1 whitespace-nowrap">
                <Plus className="w-3 h-3" /> Add
              </Button>
            </div>
          </div>
          <ul className="max-h-56 divide-y divide-border overflow-auto text-sm">
            {pools.length === 0 ? (
              <li className="py-3 text-center text-muted-foreground">No overhead pools yet.</li>
            ) : (
              pools.map((p: { id: string; code: string; name: string; allocation_base: string; overhead_type?: string; formula_type?: string; formula_value?: string }) => (
                <li key={p.id} className="py-2">
                  <button
                    type="button"
                    className={cn(
                      '-mx-2 flex w-full flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 text-left',
                      poolForRates === p.id ? 'bg-primary/10' : 'hover:bg-muted/30',
                    )}
                    onClick={() => setPoolForRates(p.id)}
                  >
                    <span className="font-mono font-semibold text-primary">{p.code}</span>
                    <span className="min-w-[100px] flex-1 text-foreground">{p.name}</span>
                    <span className={cn(
                      'rounded-full px-1.5 py-0.5 text-xs font-bold',
                      p.overhead_type === 'direct'
                        ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
                    )}>{p.overhead_type ?? 'indirect'}</span>
                    <span className="text-xs text-muted-foreground">{(p.formula_type ?? 'fixed_rate').replace(/_/g, ' ')}</span>
                    <span className="font-mono text-xs text-muted-foreground">{p.formula_value ?? '0'}</span>
                  </button>
                </li>
              ))
            )}
          </ul>

          {poolForRates && (
            <div className="space-y-2 border-t border-border bg-muted/20 pt-3">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rates for selected pool</h3>
              <div className="flex flex-wrap items-end gap-2">
                <input
                  type="date"
                  value={rateForm.effective_from}
                  onChange={e => setRateForm(f => ({ ...f, effective_from: e.target.value }))}
                  className={fieldClass}
                />
                <input
                  placeholder="Rate / unit"
                  value={rateForm.rate_per_unit}
                  onChange={e => setRateForm(f => ({ ...f, rate_per_unit: e.target.value }))}
                  className={cn(fieldClass, 'w-32')}
                />
                <Button type="button" size="sm" onClick={addRate} className="h-10">Add rate</Button>
              </div>
              <ul className="max-h-32 space-y-1 overflow-auto text-xs text-muted-foreground">
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

      <div className={cn(cardClass, 'space-y-4')}>
        <div>
          <h2 className="font-semibold text-foreground">CO — GL Accounts (Settlement)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Map WIP, Finished Goods, And COGS For Production Completion And Cost-Of-Goods Postings.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ['wip_account_id', 'WIP / production'],
              ['finished_goods_account_id', 'Finished goods'],
              ['cogs_account_id', 'Cost of goods sold'],
              ['production_variance_account_id', 'Production variance (optional)'],
              ['raw_material_account_id', 'Raw material (optional)'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className={labelClass}>
              {label}
              <select
                value={glForm[key]}
                onChange={e => setGlForm(f => ({ ...f, [key]: e.target.value }))}
                className={fieldClass}
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
