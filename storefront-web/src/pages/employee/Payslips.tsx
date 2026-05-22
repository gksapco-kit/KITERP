import { useState } from 'react'
import { CreditCard, Eye, X } from 'lucide-react'
import { useESSPayslips, useESSPayslip } from '@/hooks/useESS'

function PayslipModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: slip, isLoading } = useESSPayslip(id)
  const s = slip as any

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">Payslip Detail</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : !s ? (
          <div className="p-8 text-center text-gray-400">Not found.</div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-xs text-gray-500">Period</p><p className="font-semibold">{s.period_label ?? `${s.month}/${s.year}`}</p></div>
              <div><p className="text-xs text-gray-500">Status</p><p className="font-semibold capitalize">{s.status}</p></div>
              <div><p className="text-xs text-gray-500">Gross Pay</p><p className="font-semibold text-green-700">{s.currency ?? 'INR'} {Number(s.gross_pay ?? 0).toFixed(2)}</p></div>
              <div><p className="text-xs text-gray-500">Net Pay</p><p className="font-semibold text-blue-700">{s.currency ?? 'INR'} {Number(s.net_pay ?? 0).toFixed(2)}</p></div>
            </div>
            {(s.earnings ?? []).length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase text-gray-500 mb-2">Earnings</p>
                <div className="bg-green-50 rounded-lg divide-y">
                  {(s.earnings as any[]).map((e: any, i: number) => (
                    <div key={i} className="flex justify-between px-3 py-2 text-sm">
                      <span className="text-gray-700">{e.component}</span>
                      <span className="font-medium">{Number(e.amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(s.deductions ?? []).length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase text-gray-500 mb-2">Deductions</p>
                <div className="bg-red-50 rounded-lg divide-y">
                  {(s.deductions as any[]).map((d: any, i: number) => (
                    <div key={i} className="flex justify-between px-3 py-2 text-sm">
                      <span className="text-gray-700">{d.component}</span>
                      <span className="font-medium text-red-700">-{Number(d.amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="border-t pt-3 flex justify-between text-sm font-bold">
              <span>Net Pay</span>
              <span className="text-blue-700">{s.currency ?? 'INR'} {Number(s.net_pay ?? 0).toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ESSPayslipsPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const { data, isLoading } = useESSPayslips({ year })
  const slips: any[] = (data?.items ?? data) || []
  const [viewId, setViewId] = useState<string | null>(null)

  const STATUS_COLOR: Record<string, string> = {
    draft:     'bg-gray-100 text-gray-600',
    generated: 'bg-blue-100 text-blue-700',
    approved:  'bg-green-100 text-green-700',
    paid:      'bg-emerald-100 text-emerald-700',
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Payslips</h1>
          <p className="text-sm text-gray-500 mt-1">View and download your salary slips</p>
        </div>
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
          className="border rounded-lg px-3 py-1.5 text-sm"
        >
          {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : slips.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No payslips found for {year}.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
              <tr>
                {['Period', 'Gross Pay', 'Deductions', 'Net Pay', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left py-2 px-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slips.map((s: any) => (
                <tr key={s.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm font-medium">
                    {s.period_label ?? `${String(s.month ?? '').padStart(2, '0')}/${s.year}`}
                  </td>
                  <td className="py-3 px-4 text-sm text-green-700 font-medium">
                    {s.currency ?? 'INR'} {Number(s.gross_pay ?? 0).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-sm text-red-600">
                    -{Number(s.total_deductions ?? 0).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-sm text-blue-700 font-bold">
                    {s.currency ?? 'INR'} {Number(s.net_pay ?? 0).toFixed(2)}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLOR[s.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => setViewId(s.id)}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <Eye className="w-3.5 h-3.5" /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {viewId && <PayslipModal id={viewId} onClose={() => setViewId(null)} />}
    </div>
  )
}
