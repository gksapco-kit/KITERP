import { useMemo, useState } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { useSearchParams } from 'react-router-dom'
import { Receipt, Check, X as XIcon, DollarSign, Trash2 } from 'lucide-react'
import {
  useHRExpenses, useDecideExpense, useMarkExpensePaid, useDeleteExpense, useHREmployees,
} from '@/hooks/useVendor'
import { employeeDisplayName } from '@/lib/hrEmployeeDisplay'
import type { EmployeeProfile, ExpenseClaim } from '@/types'
import ExpenseClaimDetailDrawer from './ExpenseClaimDetailDrawer'

const STATUS: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',     color: 'bg-gray-100 text-gray-600' },
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700' },
  approved:  { label: 'Approved',  color: 'bg-green-100 text-green-700' },
  rejected:  { label: 'Rejected',  color: 'bg-red-100 text-red-700' },
  paid:      { label: 'Paid',      color: 'bg-emerald-100 text-emerald-700' },
}

export default function ExpensesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('claim')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [openRejectForm, setOpenRejectForm] = useState(false)

  function openClaim(id: string, rejectForm = false) {
    setOpenRejectForm(rejectForm)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('claim', id)
      return next
    }, { replace: true })
  }

  function closeClaim() {
    setOpenRejectForm(false)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('claim')
      return next
    }, { replace: true })
  }
  const { data: claims = [], isLoading, refetch } = useHRExpenses(statusFilter ? { status: statusFilter } : undefined)
  const { data: empData } = useHREmployees({ limit: 500 })
  const decide  = useDecideExpense()
  const markPaid = useMarkExpensePaid()
  const del      = useDeleteExpense()

  const empMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of (empData?.items ?? []) as EmployeeProfile[]) {
      m.set(e.id, employeeDisplayName(e))
    }
    return m
  }, [empData])

  const thCell = 'text-left py-2 px-3 font-medium whitespace-nowrap'
  const tdCell = 'py-2 px-3 align-middle'
  const stickyActionsTh = `${thCell} sticky right-0 z-20 bg-gray-50 border-l border-gray-200 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)]`
  const stickyActionsTd = (selected: boolean) =>
    `${tdCell} sticky right-0 z-10 border-l border-gray-100 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)] ${
      selected ? 'bg-blue-50' : 'bg-white group-hover:bg-gray-50'
    }`

  return (
    <div className="p-4 sm:p-6 w-full min-w-0 max-w-full mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expense Claims</h1>
          <p className="text-sm text-gray-500 mt-1">
            Click a row for employee documents, receipts, and claims. Rejection comments are shown in ESS.
          </p>
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border rounded px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className="bg-white border rounded-xl shadow-sm min-w-0 max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (claims as ExpenseClaim[]).length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No claims found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[920px] text-sm border-collapse">
            <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
              <tr>
                <th className={thCell}><TableColumnLabel>Claim #</TableColumnLabel></th>
                <th className={thCell}><TableColumnLabel>Employee</TableColumnLabel></th>
                <th className={`${thCell} max-w-[140px]`}><TableColumnLabel>Title</TableColumnLabel></th>
                <th className={thCell}><TableColumnLabel>Category</TableColumnLabel></th>
                <th className={thCell}><TableColumnLabel>Amount</TableColumnLabel></th>
                <th className={thCell}><TableColumnLabel>Date</TableColumnLabel></th>
                <th className={`${thCell} min-w-[100px]`}><TableColumnLabel>Status</TableColumnLabel></th>
                <th className={stickyActionsTh}><TableColumnLabel>Actions</TableColumnLabel></th>
              </tr>
            </thead>
            <tbody>
              {(claims as ExpenseClaim[]).map(c => {
                const st = STATUS[c.status] ?? STATUS.draft
                const selected = selectedId === c.id
                return (
                  <tr
                    key={c.id}
                    onClick={() => openClaim(c.id)}
                    className={`group border-b cursor-pointer transition-colors ${
                      selected ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className={`${tdCell} font-mono text-gray-700 whitespace-nowrap`}>{c.claim_number ?? '—'}</td>
                    <td className={`${tdCell} font-medium text-gray-900 max-w-[120px] truncate`} title={empMap.get(c.employee_id)}>
                      {empMap.get(c.employee_id) ?? c.employee_id.slice(0, 8)}
                    </td>
                    <td className={`${tdCell} max-w-[140px] truncate`} title={c.title}>{c.title}</td>
                    <td className={`${tdCell} text-xs text-gray-500 capitalize whitespace-nowrap`}>{c.category ?? '—'}</td>
                    <td className={`${tdCell} font-semibold whitespace-nowrap`}>
                      {c.currency ?? 'INR'} {Number(c.amount).toFixed(2)}
                    </td>
                    <td className={`${tdCell} text-xs text-gray-500 whitespace-nowrap`}>{c.expense_date ?? '—'}</td>
                    <td className={tdCell}>
                      <span className={`text-xs px-1.5 py-0.5 rounded whitespace-nowrap ${st.color}`}>{st.label}</span>
                      {c.status === 'rejected' && c.decision_note && (
                        <p className="text-xs text-red-600 mt-1 max-w-[140px] truncate" title={c.decision_note}>
                          {c.decision_note}
                        </p>
                      )}
                    </td>
                    <td className={stickyActionsTd(selected)} onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-0.5 flex-nowrap shrink-0 min-w-[88px] justify-end">
                        {c.status === 'submitted' && (
                          <>
                            <button
                              type="button"
                              onClick={() => decide.mutate({ id: c.id, decision: 'approved' })}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                              title="Approve"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openClaim(c.id, true)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="Reject (opens detail — reason required)"
                            >
                              <XIcon className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {c.status === 'approved' && (
                          <button
                            type="button"
                            onClick={() => {
                              const ref = prompt('Payment reference (e.g. UTR / cheque #)?') ?? undefined
                              markPaid.mutate({ id: c.id, payment_reference: ref })
                            }}
                            className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded"
                            title="Mark paid"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => { if (confirm('Delete claim?')) del.mutate(c.id) }}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {selectedId && (
        <ExpenseClaimDetailDrawer
          claimId={selectedId}
          onClose={closeClaim}
          onSelectClaim={id => openClaim(id)}
          onUpdated={() => refetch()}
          openRejectForm={openRejectForm}
        />
      )}
    </div>
  )
}
