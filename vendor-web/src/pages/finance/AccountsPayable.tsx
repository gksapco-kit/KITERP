import { useState } from 'react'
import { useBills, useApAging, useCreateBill, usePostBill, useRecordVendorPayment, usePaymentRuns } from '@/hooks/useFinance'
import { Plus, CheckCircle } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  open: 'bg-blue-100 text-blue-700',
  partially_paid: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  void: 'bg-red-100 text-red-600',
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

const TABS = ['Bills', 'AP Aging', 'Payment Runs'] as const
type Tab = typeof TABS[number]

export default function AccountsPayable() {
  const [tab, setTab] = useState<Tab>('Bills')
  const [showNewBill, setShowNewBill] = useState(false)
  const [billForm, setBillForm] = useState({ supplier_id: '', bill_no: '', bill_date: new Date().toISOString().slice(0, 10), total: '', tax_amount: '', subtotal: '', due_date: '', notes: '' })

  const { data: billsData, isLoading: billsLoading } = useBills()
  const { data: aging = [], isLoading: agingLoading } = useApAging()
  const { data: runs = [], isLoading: runsLoading } = usePaymentRuns()
  const createBillMut = useCreateBill()
  const postBillMut = usePostBill()
  const paymentMut = useRecordVendorPayment()

  const bills = Array.isArray(billsData) ? billsData : (billsData?.items || [])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Accounts Payable</h1>
        {tab === 'Bills' && (
          <button onClick={() => setShowNewBill(true)} className="flex items-center gap-1 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90">
            <Plus className="w-4 h-4" /> New Bill
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm border ${tab === t ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Bills' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Bill No', 'Supplier', 'Date', 'Due', 'Total', 'Balance', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {billsLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
              ) : bills.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No bills yet.</td></tr>
              ) : bills.map((b: any) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs">{b.bill_no}</td>
                  <td className="px-4 py-2 text-gray-600 font-mono text-xs">{b.supplier_id?.slice(0, 8)}…</td>
                  <td className="px-4 py-2 text-gray-600">{b.bill_date}</td>
                  <td className="px-4 py-2 text-gray-600">{b.due_date || '—'}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmt(b.total || 0)}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-red-600">{fmt(b.balance_due || 0)}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[b.status] || ''}`}>{b.status}</span>
                  </td>
                  <td className="px-4 py-2">
                    {b.status === 'draft' && (
                      <button onClick={() => postBillMut.mutate(b.id)} title="Post Bill"
                        className="p-1 text-green-600 hover:text-green-800"><CheckCircle className="w-4 h-4" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'AP Aging' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Supplier', 'Current', '1-30', '31-60', '61-90', '90+', 'Total'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {agingLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
              ) : aging.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No outstanding payables.</td></tr>
              ) : (aging as any[]).map((r: any) => (
                <tr key={r.supplier_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{r.supplier_id?.slice(0, 8)}…</td>
                  <td className="px-4 py-2 text-right text-green-700">{fmt(r.current || 0)}</td>
                  <td className="px-4 py-2 text-right text-yellow-700">{fmt(r['1_30'] || 0)}</td>
                  <td className="px-4 py-2 text-right text-orange-700">{fmt(r['31_60'] || 0)}</td>
                  <td className="px-4 py-2 text-right text-red-600">{fmt(r['61_90'] || 0)}</td>
                  <td className="px-4 py-2 text-right text-red-800 font-semibold">{fmt(r['90_plus'] || 0)}</td>
                  <td className="px-4 py-2 text-right font-semibold">
                    {fmt((r.current||0)+(r['1_30']||0)+(r['31_60']||0)+(r['61_90']||0)+(r['90_plus']||0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Payment Runs' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Name', 'Payment Date', 'Total Amount', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {runsLoading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
              ) : (runs as any[]).length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No payment runs.</td></tr>
              ) : (runs as any[]).map((r: any) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-800">{r.name || '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{r.payment_date}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmt(r.total_amount || 0)}</td>
                  <td className="px-4 py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNewBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="font-semibold text-lg">New Vendor Bill</h2>
            {[
              { label: 'Supplier ID', key: 'supplier_id' },
              { label: 'Bill Number', key: 'bill_no' },
              { label: 'Bill Date', key: 'bill_date', type: 'date' },
              { label: 'Due Date', key: 'due_date', type: 'date' },
              { label: 'Subtotal', key: 'subtotal', type: 'number' },
              { label: 'Tax Amount', key: 'tax_amount', type: 'number' },
              { label: 'Total', key: 'total', type: 'number' },
              { label: 'Notes', key: 'notes' },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input type={type || 'text'} value={(billForm as any)[key]}
                  onChange={e => setBillForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNewBill(false)} className="btn-cancel px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancel</button>
              <button onClick={() => createBillMut.mutate(billForm, { onSuccess: () => setShowNewBill(false) })}
                disabled={createBillMut.isPending}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
                {createBillMut.isPending ? 'Saving…' : 'Save Bill'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
