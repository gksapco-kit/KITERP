import { useBalanceSheet } from '@/hooks/useFinance'

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.abs(n))
}

function Section({ title, lines, total, color }: { title: string; lines: any[]; total: number; color: string }) {
  return (
    <>
      <tr className={color}><td colSpan={2} className="px-4 py-2 text-xs font-bold uppercase">{title}</td></tr>
      {lines.map((l: any, i: number) => (
        <tr key={i} className="hover:bg-gray-50">
          <td className="px-8 py-1.5 text-sm text-gray-700">{l.name}</td>
          <td className="px-4 py-1.5 text-right font-mono text-sm">{fmt(l.amount)}</td>
        </tr>
      ))}
      <tr className="border-t border-gray-200 font-semibold">
        <td className="px-4 py-2 text-sm">Total {title}</td>
        <td className="px-4 py-2 text-right font-mono text-sm">{fmt(total)}</td>
      </tr>
    </>
  )
}

export default function BalanceSheet() {
  const { data, isLoading } = useBalanceSheet()

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Balance Sheet</h1>

      {isLoading ? <p className="text-gray-500">Loading…</p> :
       !data ? <p className="text-gray-500">No data yet.</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-blue-700 text-white px-4 py-3 font-semibold">Assets</div>
            <table className="w-full text-sm">
              <tbody>
                <Section title="Current Assets" lines={data.current_assets || []} total={data.total_current_assets || 0} color="bg-blue-50" />
                <Section title="Non-Current Assets" lines={data.non_current_assets || []} total={data.total_non_current_assets || 0} color="bg-blue-50" />
                <tr className="bg-blue-100 border-t-2 border-blue-300">
                  <td className="px-4 py-3 font-bold text-blue-800">Total Assets</td>
                  <td className="px-4 py-3 text-right font-bold font-mono text-blue-800">{fmt(data.total_assets || 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-red-700 text-white px-4 py-3 font-semibold">Liabilities & Equity</div>
            <table className="w-full text-sm">
              <tbody>
                <Section title="Current Liabilities" lines={data.current_liabilities || []} total={data.total_current_liabilities || 0} color="bg-red-50" />
                <Section title="Non-Current Liabilities" lines={data.non_current_liabilities || []} total={data.total_non_current_liabilities || 0} color="bg-red-50" />
                <Section title="Equity" lines={data.equity || []} total={data.total_equity || 0} color="bg-purple-50" />
                <tr className="bg-red-100 border-t-2 border-red-300">
                  <td className="px-4 py-3 font-bold text-red-800">Total Liabilities + Equity</td>
                  <td className="px-4 py-3 text-right font-bold font-mono text-red-800">{fmt((data.total_liabilities || 0) + (data.total_equity || 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className={`col-span-2 text-center py-3 rounded-xl font-semibold text-sm ${Math.abs((data.total_assets || 0) - ((data.total_liabilities || 0) + (data.total_equity || 0))) < 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {Math.abs((data.total_assets || 0) - ((data.total_liabilities || 0) + (data.total_equity || 0))) < 1
              ? '✓ Balance sheet is balanced'
              : `⚠ Imbalance: ${fmt(Math.abs((data.total_assets || 0) - ((data.total_liabilities || 0) + (data.total_equity || 0))))}`}
          </div>
        </div>
      )}
    </div>
  )
}
