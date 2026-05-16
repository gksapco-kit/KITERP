import { useState } from 'react'
import { useTrialBalance } from '@/hooks/useFinance'

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(Math.abs(n))
}

const TYPE_COLORS: Record<string, string> = {
  Asset: 'text-blue-700', Liability: 'text-red-700',
  Equity: 'text-primary', Income: 'text-green-700', Expense: 'text-orange-700',
}

export default function TrialBalance() {
  const today = new Date().toISOString().slice(0, 10)
  const fyStart = `${today.slice(0, 4)}-04-01`
  const [from, setFrom] = useState(fyStart)
  const [to, setTo] = useState(today)
  const [applied, setApplied] = useState({ from_date: fyStart, to_date: today })

  const { data = [], isLoading } = useTrialBalance(applied)

  const totalDr = data.reduce((s: number, r: any) => s + (r.total_debit || 0), 0)
  const totalCr = data.reduce((s: number, r: any) => s + (r.total_credit || 0), 0)

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Trial Balance</h1>

      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <button onClick={() => setApplied({ from_date: from, to_date: to })}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90">Apply</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Debit</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credit</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No posted transactions in this period.</td></tr>
            ) : data.map((r: any) => (
              <tr key={r.account_id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-mono text-xs text-gray-500">{r.code}</td>
                <td className={`px-4 py-2 font-medium ${TYPE_COLORS[r.account_type] || 'text-gray-800'}`}>{r.name}</td>
                <td className="px-4 py-2 text-gray-500 text-xs">{r.account_type}</td>
                <td className="px-4 py-2 text-right font-mono text-gray-700">{fmt(r.total_debit)}</td>
                <td className="px-4 py-2 text-right font-mono text-gray-700">{fmt(r.total_credit)}</td>
                <td className={`px-4 py-2 text-right font-mono font-semibold ${r.balance >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                  {r.balance >= 0 ? fmt(r.balance) : `(${fmt(r.balance)})`}
                </td>
              </tr>
            ))}
          </tbody>
          {data.length > 0 && (
            <tfoot className="bg-gray-50 border-t-2 border-gray-300 font-semibold">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-sm">Total</td>
                <td className="px-4 py-3 text-right font-mono">{fmt(totalDr)}</td>
                <td className="px-4 py-3 text-right font-mono">{fmt(totalCr)}</td>
                <td className={`px-4 py-3 text-right font-mono ${Math.abs(totalDr - totalCr) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                  {Math.abs(totalDr - totalCr) < 0.01 ? '✓ Balanced' : fmt(totalDr - totalCr)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
