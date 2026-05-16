import { useState } from 'react'
import { useCashFlow } from '@/hooks/useFinance'

function fmt(n: number) {
  const abs = Math.abs(n)
  const val = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(abs)
  return n < 0 ? `(${val})` : val
}

interface CashSection {
  title: string
  inflows: number
  outflows: number
  net: number
  color: string
  netColor: string
}

export default function CashFlow() {
  const today = new Date().toISOString().slice(0, 10)
  const fyStart = `${today.slice(0, 4)}-04-01`
  const [from, setFrom] = useState(fyStart)
  const [to, setTo] = useState(today)
  const [applied, setApplied] = useState({ from_date: fyStart, to_date: today })

  const { data, isLoading } = useCashFlow({ ...applied })

  const sections: CashSection[] = data
    ? [
        { title: 'Operating Activities', ...data.operating, color: 'bg-green-50 text-green-800', netColor: 'text-green-700' },
        { title: 'Investing Activities', ...data.investing, color: 'bg-blue-50 text-blue-800', netColor: 'text-blue-700' },
        { title: 'Financing Activities', ...data.financing, color: 'bg-accent text-primary', netColor: 'text-primary' },
      ]
    : []

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Cash Flow Statement</h1>

      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <button
          onClick={() => setApplied({ from_date: from, to_date: to })}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90"
        >
          Apply
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <p className="p-8 text-center text-gray-500">Loading…</p>
        ) : !data ? (
          <p className="p-8 text-center text-gray-500">No data.</p>
        ) : 'error' in data ? (
          <p className="p-8 text-center text-amber-600">{(data as any).error}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-xs text-gray-500 uppercase">
                <th className="px-4 py-2 text-left">Activity</th>
                <th className="px-4 py-2 text-right">Inflows</th>
                <th className="px-4 py-2 text-right">Outflows</th>
                <th className="px-4 py-2 text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {sections.map(({ title, inflows, outflows, net, color, netColor }) => (
                <tr key={title} className={`border-t border-gray-100 ${color}`}>
                  <td className="px-4 py-3 font-semibold">{title}</td>
                  <td className="px-4 py-3 text-right font-mono text-green-700">{fmt(inflows)}</td>
                  <td className="px-4 py-3 text-right font-mono text-red-600">{fmt(outflows)}</td>
                  <td className={`px-4 py-3 text-right font-mono font-bold ${net < 0 ? 'text-red-700' : netColor}`}>{fmt(net)}</td>
                </tr>
              ))}
              <tr className="bg-primary/25 border-t-2 border-primary">
                <td colSpan={3} className="px-4 py-3 font-bold text-primary/90 text-base">Net Change in Cash</td>
                <td className={`px-4 py-3 text-right font-bold font-mono text-base ${(data.net_change || 0) < 0 ? 'text-red-700' : 'text-primary/90'}`}>
                  {fmt(data.net_change || 0)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {data && !('error' in data) && (
        <p className="text-xs text-gray-400">Period: {data.period}</p>
      )}
    </div>
  )
}
