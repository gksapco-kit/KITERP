import { useState } from 'react'
import { Receipt, Check, X as XIcon, DollarSign, Trash2 } from 'lucide-react'
import {
  useHRExpenses, useDecideExpense, useMarkExpensePaid, useDeleteExpense,
} from '@/hooks/useVendor'
import type { ExpenseClaim } from '@/types'

const STATUS: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',     color: 'bg-gray-100 text-gray-600' },
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700' },
  approved:  { label: 'Approved',  color: 'bg-green-100 text-green-700' },
  rejected:  { label: 'Rejected',  color: 'bg-red-100 text-red-700' },
  paid:      { label: 'Paid',      color: 'bg-emerald-100 text-emerald-700' },
}

export default function ExpensesPage() {
  const [statusFilter, setStatusFilter] = useState<string>('')
  const { data: claims = [], isLoading } = useHRExpenses(statusFilter ? { status: statusFilter } : undefined)
  const decide  = useDecideExpense()
  const markPaid = useMarkExpensePaid()
  const del      = useDeleteExpense()

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expense Claims</h1>
          <p className="text-sm text-gray-500 mt-1">Approve, reject and pay employee expense claims</p>
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border rounded px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (claims as ExpenseClaim[]).length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No claims found.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
              <tr>{['Claim #', 'Employee', 'Title', 'Category', 'Amount', 'Date', 'Status', 'Actions'].map(h =>
                <th key={h} className="text-left py-2 px-4 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {(claims as ExpenseClaim[]).map(c => {
                const st = STATUS[c.status] ?? STATUS.draft
                return (
                  <tr key={c.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4 text-sm font-mono text-gray-700">{c.claim_number ?? '—'}</td>
                    <td className="py-2 px-4 text-xs font-mono text-gray-500">{c.employee_id.slice(0, 8)}</td>
                    <td className="py-2 px-4 text-sm">{c.title}</td>
                    <td className="py-2 px-4 text-xs text-gray-500">{c.category ?? '—'}</td>
                    <td className="py-2 px-4 text-sm font-semibold">
                      {c.currency ?? 'INR'} {Number(c.amount).toFixed(2)}
                    </td>
                    <td className="py-2 px-4 text-xs text-gray-500">{c.expense_date ?? '—'}</td>
                    <td className="py-2 px-4">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${st.color}`}>{st.label}</span>
                    </td>
                    <td className="py-2 px-4 text-sm">
                      <div className="flex items-center gap-1">
                        {c.status === 'submitted' && (
                          <>
                            <button onClick={() => decide.mutate({ id: c.id, decision: 'approved' })}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Approve">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => {
                              const note = prompt('Reason for rejection?') ?? undefined
                              decide.mutate({ id: c.id, decision: 'rejected', note })
                            }} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Reject">
                              <XIcon className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {c.status === 'approved' && (
                          <button onClick={() => {
                            const ref = prompt('Payment reference (e.g. UTR / cheque #)?') ?? undefined
                            markPaid.mutate({ id: c.id, payment_reference: ref })
                          }} className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded" title="Mark paid">
                            <DollarSign className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => { if (confirm('Delete claim?')) del.mutate(c.id) }}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
