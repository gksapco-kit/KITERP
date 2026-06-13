import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { useBudgets, useCreateBudget, useBudgetVariance, useForecasts, useCreateForecast } from '@/hooks/useFinance'
import { Plus, BarChart3, X } from 'lucide-react'

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

  useEscapeToClose(closeNewBudget, showNewBudget)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Budgets & Forecasts</h1>
        {tab === 'Budgets' && (
          <button onClick={() => setShowNewBudget(true)} className="flex items-center gap-1 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90">
            <Plus className="w-4 h-4" /> New Budget
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm border ${tab === t ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Budgets' && (
        <div className="space-y-3">
          {budgetsLoading ? <p className="text-sm text-gray-500">Loading…</p> :
           (budgets as any[]).length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm bg-white rounded-xl border border-gray-200">No budgets yet.</div>
          ) : (budgets as any[]).map((b: any) => (
            <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:border-primary/40 cursor-pointer"
              onClick={() => { setSelectedBudgetId(b.id); setTab('Variance') }}>
              <div>
                <p className="font-semibold text-gray-800">{b.name}</p>
                <p className="text-xs text-gray-500 capitalize">{b.scope} · {b.status}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-green-600">Income: {fmt(b.total_income || 0)}</p>
                <p className="text-sm font-medium text-red-600">Expense: {fmt(b.total_expense || 0)}</p>
              </div>
              <BarChart3 className="w-5 h-5 text-gray-400 ml-4" />
            </div>
          ))}
        </div>
      )}

      {tab === 'Variance' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {(budgets as any[]).map((b: any) => (
              <button key={b.id} onClick={() => setSelectedBudgetId(b.id)}
                className={`px-3 py-1.5 rounded-full text-xs border ${selectedBudgetId === b.id ? 'bg-primary/15 border-primary/60 text-primary' : 'border-gray-300 text-gray-600'}`}>
                {b.name}
              </button>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Account', 'Budget', 'Actual', 'Variance', 'Var %'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
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
            <div className="text-center py-12 text-gray-500 text-sm bg-white rounded-xl border border-gray-200">No forecasts yet.</div>
          ) : (forecasts as any[]).map((f: any) => (
            <div key={f.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="font-semibold text-gray-800">{f.name}</p>
              <p className="text-xs text-gray-500 capitalize">{f.forecast_type} · {f.method} · {f.status}</p>
              <p className="text-xs text-gray-400 mt-1">Base: {f.base_date} · {f.months_ahead} months ahead</p>
            </div>
          ))}
        </div>
      )}

      {showNewBudget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto"
          onClick={closeNewBudget}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold text-lg">New Budget</h2>
              <button
                type="button"
                onClick={closeNewBudget}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {[
              { label: 'Budget Name', key: 'name' },
              { label: 'Fiscal Year ID', key: 'fiscal_year_id' },
              { label: 'Notes', key: 'notes' },
            ].map(({ label, key }) => (
              <div key={key}>
                <Label className="block text-xs font-medium text-gray-600 mb-1">{label}</Label>
                <input value={(budgetForm as any)[key]} onChange={e => setBudgetForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            ))}
            <div>
              <Label className="block text-xs font-medium text-gray-600 mb-1">Scope</Label>
              <select value={budgetForm.scope} onChange={e => setBudgetForm(f => ({ ...f, scope: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {['company', 'store', 'department'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={closeNewBudget} className="btn-cancel px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancel</button>
              <button onClick={() => createBudgetMut.mutate(budgetForm, { onSuccess: closeNewBudget })}
                disabled={createBudgetMut.isPending}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
                {createBudgetMut.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
