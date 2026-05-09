import { useState } from 'react'
import { useProfitLoss } from '@/hooks/useFinance'

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.abs(n))
}

function Row({ label, value, indent = 0, bold = false }: { label: string; value: number; indent?: number; bold?: boolean }) {
  const negative = value < 0
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-2 text-gray-700" style={{ paddingLeft: `${16 + indent * 20}px` }}>
        <span className={bold ? 'font-semibold' : ''}>{label}</span>
      </td>
      <td className={`px-4 py-2 text-right font-mono ${bold ? 'font-bold' : ''} ${negative ? 'text-red-600' : ''}`}>
        {negative ? `(${fmt(value)})` : fmt(value)}
      </td>
    </tr>
  )
}

export default function ProfitLoss() {
  const today = new Date().toISOString().slice(0, 10)
  const fyStart = `${today.slice(0, 4)}-04-01`
  const [from, setFrom] = useState(fyStart)
  const [to, setTo] = useState(today)
  const [applied, setApplied] = useState({ from_date: fyStart, to_date: today })

  const { data, isLoading } = useProfitLoss(applied)

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Profit & Loss Statement</h1>

      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <button onClick={() => setApplied({ from_date: from, to_date: to })}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">Apply</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <p className="p-8 text-center text-gray-500">Loading…</p>
        ) : !data ? (
          <p className="p-8 text-center text-gray-500">No data. Post transactions first.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className="bg-green-50"><td colSpan={2} className="px-4 py-2 text-xs font-semibold text-green-700 uppercase">Revenue</td></tr>
              {(data.revenue_lines || []).map((l: any, i: number) => <Row key={i} label={l.name} value={l.amount} indent={1} />)}
              <Row label="Total Revenue" value={data.total_revenue || 0} bold />
              <tr className="bg-red-50"><td colSpan={2} className="px-4 py-2 text-xs font-semibold text-red-700 uppercase">Cost of Goods Sold</td></tr>
              {(data.cogs_lines || []).map((l: any, i: number) => <Row key={i} label={l.name} value={l.amount} indent={1} />)}
              <Row label="Total COGS" value={data.total_cogs || 0} bold />
              <tr className="bg-blue-50 border-t-2 border-blue-300"><td className="px-4 py-2 font-bold text-blue-700">Gross Profit</td><td className={`px-4 py-2 text-right font-bold font-mono ${(data.gross_profit || 0) < 0 ? 'text-red-600' : 'text-blue-700'}`}>{fmt(data.gross_profit || 0)}</td></tr>
              <tr className="bg-orange-50"><td colSpan={2} className="px-4 py-2 text-xs font-semibold text-orange-700 uppercase">Operating Expenses</td></tr>
              {(data.opex_lines || []).map((l: any, i: number) => <Row key={i} label={l.name} value={l.amount} indent={1} />)}
              <Row label="Total Operating Expenses" value={data.total_opex || 0} bold />
              <tr className="bg-indigo-50 border-t-2 border-indigo-300"><td className="px-4 py-2 font-bold text-indigo-700">Operating Profit (EBIT)</td><td className={`px-4 py-2 text-right font-bold font-mono ${(data.operating_profit || 0) < 0 ? 'text-red-600' : 'text-indigo-700'}`}>{fmt(data.operating_profit || 0)}</td></tr>
              {(data.other_income_lines || []).length > 0 && <>
                <tr className="bg-teal-50"><td colSpan={2} className="px-4 py-2 text-xs font-semibold text-teal-700 uppercase">Other Income / Expenses</td></tr>
                {data.other_income_lines.map((l: any, i: number) => <Row key={i} label={l.name} value={l.amount} indent={1} />)}
              </>}
              <tr className="bg-gray-100 border-t-2 border-gray-400">
                <td className="px-4 py-3 font-bold text-gray-800 text-base">Net Profit / (Loss)</td>
                <td className={`px-4 py-3 text-right font-bold font-mono text-base ${(data.net_profit || 0) < 0 ? 'text-red-600' : 'text-green-700'}`}>
                  {(data.net_profit || 0) < 0 ? `(${fmt(data.net_profit || 0)})` : fmt(data.net_profit || 0)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
