import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { useBudgets, useCreateBudget, useBudgetVariance, useForecasts, useCreateForecast } from '@/hooks/useFinance'
import { Plus, BarChart3 } from 'lucide-react'

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

const TABS = ['Budgets', 'Variance', 'Forecasts'] as const
type Tab = typeof TABS[number]

export default function BudgetsForecast() {
  const [tab, setTab] = useState<Tab>('Budgets')
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null)
  const [showNewBudget, setShowNewBudget] = useState(false)
  const [budgetForm, setBudgetForm] = useState({ name: '', fiscal_year_id: '', scope: 'company', notes: '' })

  const { data: budgets = [], isLoading: budgetsLoading } = useBudgets()
  const { data: variance = [], isLoading: varLoading } = useBudgetVariance(selectedBudgetId || '')
  const { data: forecasts = [], isLoading: forecastsLoading } = useForecasts()
  const createBudgetMut = useCreateBudget()
  const createForecastMut = useCreateForecast()

  const closeNewBudget = () => setShowNewBudget(false)

  return (
    <div className="mx-auto max-w-7xl space-y-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-xs text-muted-foreground">
          Budgets, variance analysis, and forecasts
        </p>
        {tab === 'Budgets' && (
          <button
            type="button"
            onClick={() => setShowNewBudget(true)}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> New Budget
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {TABS.map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`rounded-lg border px-4 py-2 text-sm ${tab === t ? 'border-primary bg-primary text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Budgets' && (
        <div className="space-y-3">
          {budgetsLoading ? <p className="text-sm text-gray-500">Loading…</p> :
           (budgets as any[]).length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white py-12 text-center text-sm text-gray-500">No budgets yet.</div>
          ) : (budgets as any[]).map((b: any) => (
            <div key={b.id} className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-200 bg-white p-4 hover:border-primary/40"
              onClick={() => { setSelectedBudgetId(b.id); setTab('Variance') }}>
              <div>
                <p className="font-semibold text-gray-800">{b.name}</p>
                <p className="text-xs text-gray-500 capitalize">{b.scope} · {b.status}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-green-600">Income: {fmt(b.total_income || 0)}</p>
                <p className="text-sm font-medium text-red-600">Expense: {fmt(b.total_expense || 0)}</p>
              </div>
              <BarChart3 className="ml-4 h-5 w-5 text-gray-400" />
            </div>
          ))}
        </div>
      )}

      {tab === 'Variance' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(budgets as any[]).map((b: any) => (
              <button key={b.id} type="button" onClick={() => setSelectedBudgetId(b.id)}
                className={`rounded-full border px-3 py-1.5 text-xs ${selectedBudgetId === b.id ? 'border-primary/60 bg-primary/15 text-primary' : 'border-gray-300 text-gray-600'}`}>
                {b.name}
              </button>
            ))}
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  {['Account', 'Budget', 'Actual', 'Variance', 'Var %'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {varLoading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
                ) : !selectedBudgetId ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Select a budget above.</td></tr>
                ) : (variance as any[]).length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No variance data.</td></tr>
                ) : (variance as any[]).map((v: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{v.account_id?.slice(0,8)}…</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(v.budget)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(v.actual)}</td>
                    <td className={`px-4 py-2 text-right font-mono font-semibold ${v.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {fmt(Math.abs(v.variance))} {v.variance < 0 ? '▼' : '▲'}
                    </td>
                    <td className={`px-4 py-2 text-right text-sm ${v.variance_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {v.variance_pct?.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'Forecasts' && (
        <div className="space-y-3">
          {forecastsLoading ? <p className="text-sm text-gray-500">Loading…</p> :
           (forecasts as any[]).length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white py-12 text-center text-sm text-gray-500">No forecasts yet.</div>
          ) : (forecasts as any[]).map((f: any) => (
            <div key={f.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="font-semibold text-gray-800">{f.name}</p>
              <p className="text-xs text-gray-500 capitalize">{f.forecast_type} · {f.method} · {f.status}</p>
              <p className="mt-1 text-xs text-gray-400">Base: {f.base_date} · {f.months_ahead} months ahead</p>
            </div>
          ))}
        </div>
      )}

      {showNewBudget && (
        <ModalOverlay onClose={closeNewBudget} className="z-[100] bg-black/60 p-3">
          <ModalPanel className="max-w-md max-h-[calc(100dvh-1.5rem)] !rounded-lg overflow-hidden">
            <ModalHeader
              title="New Budget"
              onClose={closeNewBudget}
              className="border-0 px-4 py-2.5 [&>div>h2]:text-base [&>div>h2]:leading-none"
            />
            <ModalBody className="space-y-2 overflow-y-auto px-4 pb-1 pt-0">
              {[
                { label: 'Budget Name', key: 'name' },
                { label: 'Fiscal Year ID', key: 'fiscal_year_id' },
                { label: 'Notes', key: 'notes' },
              ].map(({ label, key }) => (
                <div key={key}>
                  <Label className="mb-0.5 block text-[11px] font-medium text-muted-foreground">{label}</Label>
                  <input
                    value={(budgetForm as any)[key]}
                    onChange={e => setBudgetForm(f => ({ ...f, [key]: e.target.value }))}
                    className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              ))}
              <div>
                <Label className="mb-0.5 block text-[11px] font-medium text-muted-foreground">Scope</Label>
                <Select
                  value={budgetForm.scope}
                  onChange={v => setBudgetForm(f => ({ ...f, scope: v }))}
                  options={['company', 'store', 'department'].map(s => ({ value: s, label: s }))}
                />
              </div>
            </ModalBody>
            <ModalFooter className="border-0 px-4 py-2.5">
              <button type="button" onClick={closeNewBudget} className="btn-cancel h-8 rounded-md border border-border px-3 text-sm">Cancel</button>
              <button
                type="button"
                onClick={() => createBudgetMut.mutate(budgetForm, { onSuccess: closeNewBudget })}
                disabled={createBudgetMut.isPending}
                className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {createBudgetMut.isPending ? 'Saving…' : 'Save'}
              </button>
            </ModalFooter>
          </ModalPanel>
        </ModalOverlay>
      )}
    </div>
  )
}
