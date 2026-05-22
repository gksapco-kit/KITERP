import { useState } from 'react'
import { useProfitLoss } from '@/hooks/useFinance'

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.abs(n))
}

function Row({ label, value, indent = 0, bold = false }: { label: string; value: number; indent?: number; bold?: boolean }) {
  const negative = value < 0
  return (
    <tr className="hover:bg-muted/50">
      <td className="px-4 py-2 text-foreground" style={{ paddingLeft: `${16 + indent * 20}px` }}>
        <span className={bold ? 'font-semibold' : ''}>{label}</span>
      </td>
      <td className={`px-4 py-2 text-right font-mono ${bold ? 'font-bold' : ''} ${negative ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
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
      <h1 className="text-2xl font-bold text-foreground">Profit & Loss Statement</h1>

      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground" />
        </div>
        <button onClick={() => setApplied({ from_date: from, to_date: to })}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90">Apply</button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <p className="p-8 text-center text-muted-foreground">Loading…</p>
        ) : !data ? (
          <p className="p-8 text-center text-muted-foreground">No data. Post transactions first.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Description</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr className="bg-green-50 dark:bg-green-500/10"><td colSpan={2} className="px-4 py-2 text-xs font-medium text-green-700 dark:text-green-300 uppercase">Revenue</td></tr>
              {(data.revenue_lines || []).map((l: any, i: number) => <Row key={i} label={l.name} value={l.amount} indent={1} />)}
              <Row label="Total Revenue" value={data.total_revenue || 0} bold />
              <tr className="bg-red-50 dark:bg-red-500/10"><td colSpan={2} className="px-4 py-2 text-xs font-medium text-red-700 dark:text-red-300 uppercase">Cost of Goods Sold</td></tr>
              {(data.cogs_lines || []).map((l: any, i: number) => <Row key={i} label={l.name} value={l.amount} indent={1} />)}
              <Row label="Total COGS" value={data.total_cogs || 0} bold />
              <tr className="bg-blue-50 dark:bg-blue-500/10 border-t-2 border-blue-300 dark:border-blue-500/30"><td className="px-4 py-2 font-bold text-blue-700 dark:text-blue-300">Gross Profit</td><td className={`px-4 py-2 text-right font-bold font-mono ${(data.gross_profit || 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-700 dark:text-blue-300'}`}>{fmt(data.gross_profit || 0)}</td></tr>
              <tr className="bg-orange-50 dark:bg-orange-500/10"><td colSpan={2} className="px-4 py-2 text-xs font-medium text-orange-700 dark:text-orange-300 uppercase">Operating Expenses</td></tr>
              {(data.opex_lines || []).map((l: any, i: number) => <Row key={i} label={l.name} value={l.amount} indent={1} />)}
              <Row label="Total Operating Expenses" value={data.total_opex || 0} bold />
              <tr className="bg-primary/10 border-t-2 border-primary/40"><td className="px-4 py-2 font-bold text-primary">Operating Profit (EBIT)</td><td className={`px-4 py-2 text-right font-bold font-mono ${(data.operating_profit || 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-primary'}`}>{fmt(data.operating_profit || 0)}</td></tr>
              {(data.other_income_lines || []).length > 0 && <>
                <tr className="bg-teal-50 dark:bg-teal-500/10"><td colSpan={2} className="px-4 py-2 text-xs font-medium text-teal-700 dark:text-teal-300 uppercase">Other Income / Expenses</td></tr>
                {data.other_income_lines.map((l: any, i: number) => <Row key={i} label={l.name} value={l.amount} indent={1} />)}
              </>}
              <tr className="bg-muted border-t-2 border-border">
                <td className="px-4 py-3 font-bold text-foreground text-base">Net Profit / (Loss)</td>
                <td className={`px-4 py-3 text-right font-bold font-mono text-base ${(data.net_profit || 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-300'}`}>
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
