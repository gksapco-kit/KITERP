import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { useAssetReconciliationReport } from '@/hooks/useFinance'
import { fmt } from './assetReportShared'

export default function AssetGlReconciliation() {
  const today = new Date().toISOString().slice(0, 10)
  const [asOf, setAsOf] = useState(today)

  const reconQ = useAssetReconciliationReport({ as_of: asOf })
  const recon = reconQ.data as any

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">GL Reconciliation</h1>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <div>
          <Label className="sr-only">As of</Label>
          <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
        </div>
      </div>

      {reconQ.isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : !recon || recon.lines.length === 0 ? (
        <p className="text-sm text-gray-500">No mapped Fixed Asset / Accumulated Depreciation GL accounts to reconcile yet — map them under Fixed Assets → Categories.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b text-xs font-bold text-gray-500 uppercase">
            Subledger vs GL as of {recon.as_of}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Account', 'Role', 'Subledger Balance', 'GL Balance', 'Variance'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recon.lines.map((l: any, i: number) => {
                const balanced = Math.abs(l.variance) < 1
                return (
                  <tr key={`${l.account_id}-${l.role}-${i}`} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-800">{l.account_code} — {l.account_name}</td>
                    <td className="px-4 py-2 text-xs text-gray-500 capitalize">{l.role.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(l.subledger_balance)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(l.gl_balance)}</td>
                    <td className={`px-4 py-2 text-right font-mono font-semibold ${balanced ? 'text-green-600' : 'text-red-600'}`}>
                      {balanced ? '✓ Matched' : fmt(l.variance)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
