import { useState } from 'react'
import { useBalanceSheet } from '@/hooks/useFinance'

/** Signed: negatives (e.g. accumulated depreciation, deficits) are shown in parentheses. */
function fmt(n: number) {
  const s = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.abs(n))
  return Math.round(n) < 0 ? `(${s})` : s
}

function Section({ title, lines, total, color }: { title: string; lines: any[]; total: number; color: string }) {
  return (
    <>
      <tr className={color}><td colSpan={2} className="px-4 py-2 text-xs font-bold uppercase">{title}</td></tr>
      {lines.map((l: any, i: number) => (
        <tr key={i} className="hover:bg-muted/50">
          <td className="px-8 py-1.5 text-sm text-foreground">{l.name}</td>
          <td className="px-4 py-1.5 text-right font-mono text-sm text-foreground">{fmt(l.amount)}</td>
        </tr>
      ))}
      <tr className="border-t border-border font-semibold">
        <td className="px-4 py-2 text-sm text-foreground">Total {title}</td>
        <td className="px-4 py-2 text-right font-mono text-sm text-foreground">{fmt(total)}</td>
      </tr>
    </>
  )
}

export default function BalanceSheet() {
  const today = new Date().toISOString().slice(0, 10)
  const [asOf, setAsOf] = useState(today)
  const [appliedAsOf, setAppliedAsOf] = useState(today)
  const { data, isLoading } = useBalanceSheet({ as_of: appliedAsOf })

  // Cumulative profit is part of equity but is not a ledger account, so show it as its own row
  // so that the Equity lines add up to Total Equity.
  const equityLines = [
    ...(data?.equity || []),
    ...(Math.abs(data?.retained_earnings || 0) >= 0.005
      ? [{ name: 'Retained Earnings (Cumulative Profit / Loss)', amount: data.retained_earnings }]
      : []),
  ]

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Balance Sheet</h1>

      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">As of</label>
          <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground" />
        </div>
        <button onClick={() => asOf && setAppliedAsOf(asOf)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90">Apply</button>
      </div>

      {isLoading ? <p className="text-muted-foreground">Loading…</p> :
       !data ? <p className="text-muted-foreground">No data yet.</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="bg-blue-700 text-white px-4 py-3 font-semibold">Assets</div>
            <table className="w-full text-sm">
              <tbody>
                <Section title="Current Assets" lines={data.current_assets || []} total={data.total_current_assets || 0} color="bg-blue-50 dark:bg-blue-500/10" />
                <Section title="Non-Current Assets" lines={data.non_current_assets || []} total={data.total_non_current_assets || 0} color="bg-blue-50 dark:bg-blue-500/10" />
                <tr className="bg-blue-100 dark:bg-blue-500/15 border-t-2 border-blue-300 dark:border-blue-500/30">
                  <td className="px-4 py-3 font-bold text-blue-800 dark:text-blue-300">Total Assets</td>
                  <td className="px-4 py-3 text-right font-bold font-mono text-blue-800 dark:text-blue-300">{fmt(data.total_assets || 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="bg-red-700 text-white px-4 py-3 font-semibold">Liabilities & Equity</div>
            <table className="w-full text-sm">
              <tbody>
                <Section title="Current Liabilities" lines={data.current_liabilities || []} total={data.total_current_liabilities || 0} color="bg-red-50 dark:bg-red-500/10" />
                <Section title="Non-Current Liabilities" lines={data.non_current_liabilities || []} total={data.total_non_current_liabilities || 0} color="bg-red-50 dark:bg-red-500/10" />
                <Section title="Equity" lines={equityLines} total={data.total_equity || 0} color="bg-accent" />
                <tr className="bg-red-100 dark:bg-red-500/15 border-t-2 border-red-300 dark:border-red-500/30">
                  <td className="px-4 py-3 font-bold text-red-800 dark:text-red-300">Total Liabilities + Equity</td>
                  <td className="px-4 py-3 text-right font-bold font-mono text-red-800 dark:text-red-300">{fmt((data.total_liabilities || 0) + (data.total_equity || 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className={`col-span-2 text-center py-3 rounded-xl font-semibold text-sm ${Math.abs((data.total_assets || 0) - ((data.total_liabilities || 0) + (data.total_equity || 0))) < 1 ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'}`}>
            {Math.abs((data.total_assets || 0) - ((data.total_liabilities || 0) + (data.total_equity || 0))) < 1
              ? '✓ Balance sheet is balanced'
              : `⚠ Imbalance: ${fmt(Math.abs((data.total_assets || 0) - ((data.total_liabilities || 0) + (data.total_equity || 0))))}`}
          </div>
        </div>
      )}
    </div>
  )
}
