import { useState } from 'react'
import { useArAging, useApplyPayment } from '@/hooks/useFinance'
import { AlertCircle } from 'lucide-react'

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

function AgingBar({ current, d30, d60, d90, d90p }: Record<string, number>) {
  const total = current + d30 + d60 + d90 + d90p || 1
  return (
    <div className="flex h-2 rounded-full overflow-hidden w-32">
      <div style={{ width: `${current / total * 100}%` }} className="bg-green-400" />
      <div style={{ width: `${d30 / total * 100}%` }} className="bg-yellow-400" />
      <div style={{ width: `${d60 / total * 100}%` }} className="bg-orange-400" />
      <div style={{ width: `${d90 / total * 100}%` }} className="bg-red-400" />
      <div style={{ width: `${d90p / total * 100}%` }} className="bg-red-700" />
    </div>
  )
}

export default function AccountsReceivable() {
  const { data: aging = [], isLoading } = useArAging()
  const applyMut = useApplyPayment()
  const [tab, setTab] = useState<'aging' | 'apply'>('aging')
  const [payForm, setPayForm] = useState({ payment_id: '', invoice_id: '', amount_applied: '' })

  const totals = aging.reduce((acc: Record<string, number>, r: any) => {
    acc.current = (acc.current || 0) + (r.current || 0)
    acc.d30 = (acc.d30 || 0) + (r['1_30'] || 0)
    acc.d60 = (acc.d60 || 0) + (r['31_60'] || 0)
    acc.d90 = (acc.d90 || 0) + (r['61_90'] || 0)
    acc.d90p = (acc.d90p || 0) + (r['90_plus'] || 0)
    return acc
  }, {})

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Accounts Receivable</h1>
        <div className="flex gap-2">
          {(['aging', 'apply'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm ${tab === t ? 'bg-primary text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              {t === 'aging' ? 'AR Aging' : 'Apply Payment'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'aging' && (
        <>
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Current', value: totals.current || 0, color: 'bg-green-50 border-green-200 text-green-700' },
              { label: '1–30 days', value: totals.d30 || 0, color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
              { label: '31–60 days', value: totals.d60 || 0, color: 'bg-orange-50 border-orange-200 text-orange-700' },
              { label: '61–90 days', value: totals.d90 || 0, color: 'bg-red-50 border-red-200 text-red-600' },
              { label: '90+ days', value: totals.d90p || 0, color: 'bg-red-100 border-red-300 text-red-800' },
            ].map(({ label, value, color }) => (
              <div key={label} className={`rounded-xl border p-4 ${color}`}>
                <p className="text-xs font-medium">{label}</p>
                <p className="text-xl font-bold mt-1">{fmt(value)}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Customer', 'Current', '1-30', '31-60', '61-90', '90+', 'Aging'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
                ) : aging.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No outstanding receivables.</td></tr>
                ) : (aging as any[]).map((r: any) => (
                  <tr key={r.customer_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{r.customer_id?.slice(0, 8)}…</td>
                    <td className="px-4 py-2 text-right text-green-700">{fmt(r.current || 0)}</td>
                    <td className="px-4 py-2 text-right text-yellow-700">{fmt(r['1_30'] || 0)}</td>
                    <td className="px-4 py-2 text-right text-orange-700">{fmt(r['31_60'] || 0)}</td>
                    <td className="px-4 py-2 text-right text-red-600">{fmt(r['61_90'] || 0)}</td>
                    <td className="px-4 py-2 text-right text-red-800 font-semibold">{fmt(r['90_plus'] || 0)}</td>
                    <td className="px-4 py-2">
                      <AgingBar current={r.current||0} d30={r['1_30']||0} d60={r['31_60']||0} d90={r['61_90']||0} d90p={r['90_plus']||0} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'apply' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
          <h2 className="font-semibold text-gray-800">Apply Payment to Invoice</h2>
          {[
            { label: 'Payment ID', key: 'payment_id' },
            { label: 'Invoice ID', key: 'invoice_id' },
            { label: 'Amount Applied', key: 'amount_applied', type: 'number' },
          ].map(({ label, key, type }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input type={type || 'text'} value={(payForm as any)[key]}
                onChange={e => setPayForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          ))}
          <button onClick={() => applyMut.mutate(payForm)} disabled={applyMut.isPending}
            className="w-full py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50">
            {applyMut.isPending ? 'Applying…' : 'Apply Payment'}
          </button>
        </div>
      )}
    </div>
  )
}
