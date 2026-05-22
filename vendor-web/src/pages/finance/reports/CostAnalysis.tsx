import { useState } from 'react'
import { useCostAnalysis } from '@/hooks/useFinance'

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

export default function CostAnalysis() {
  const today = new Date().toISOString().slice(0, 10)
  const fyStart = `${today.slice(0, 4)}-04-01`
  const [from, setFrom] = useState(fyStart)
  const [to, setTo] = useState(today)
  const [applied, setApplied] = useState({ from_date: fyStart, to_date: today })

  const { data, isLoading } = useCostAnalysis(applied)

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Cost Analysis</h1>

      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <button onClick={() => setApplied({ from_date: from, to_date: to })} className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90">Apply</button>
      </div>

      {isLoading ? <p className="text-gray-500">Loading…</p> : !data ? <p className="text-gray-500">No data.</p> : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Total Revenue', value: data.total_revenue || 0, color: 'bg-green-50 border-green-200 text-green-800' },
              { label: 'Total Costs', value: data.total_costs || 0, color: 'bg-red-50 border-red-200 text-red-800' },
              { label: 'Gross Margin', value: data.gross_margin_pct || 0, suffix: '%', color: 'bg-primary/10 border-primary/30 text-primary/80' },
            ].map(({ label, value, suffix, color }) => (
              <div key={label} className={`rounded-xl border p-4 ${color}`}>
                <p className="text-xs font-medium">{label}</p>
                <p className="text-2xl font-bold mt-1">{suffix ? `${value.toFixed(1)}${suffix}` : fmt(value)}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card rounded-xl border border-border p-5">
              <h2 className="font-semibold text-gray-800 mb-3">Fixed vs Variable Costs</h2>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Fixed Costs</span>
                  <span className="font-medium">{fmt(data.fixed_costs || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Variable Costs</span>
                  <span className="font-medium">{fmt(data.variable_costs || 0)}</span>
                </div>
                <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${data.total_costs ? ((data.fixed_costs || 0) / data.total_costs * 100) : 0}%` }} />
                </div>
                <p className="text-xs text-gray-400">{data.total_costs ? ((data.fixed_costs || 0) / data.total_costs * 100).toFixed(0) : 0}% fixed · {data.total_costs ? ((data.variable_costs || 0) / data.total_costs * 100).toFixed(0) : 0}% variable</p>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-5">
              <h2 className="font-semibold text-gray-800 mb-3">Cost Reduction Opportunities</h2>
              <ul className="space-y-2">
                {(data.recommendations || []).length === 0 ? (
                  <li className="text-sm text-gray-500">No recommendations generated yet.</li>
                ) : (data.recommendations || []).map((r: string, i: number) => (
                  <li key={i} className="text-sm text-gray-700 flex gap-2">
                    <span className="text-amber-500 mt-0.5">→</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-800">Cost by Account</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  {['Account', 'Type', 'Classification', 'Amount', '% of Total'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(data.cost_lines || []).map((c: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700">{c.name}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{c.account_type}</td>
                    <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${c.classification === 'fixed' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{c.classification}</span></td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(c.amount)}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{data.total_costs ? (c.amount / data.total_costs * 100).toFixed(1) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
