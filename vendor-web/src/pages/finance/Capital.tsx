import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { useLoans, useCreateLoan, useGenerateLoanSchedule, useInvestments, useCreateInvestment, useInvestmentROI } from '@/hooks/useFinance'
import { Plus, BarChart3, X } from 'lucide-react'

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

const TABS = ['Loans', 'Investments'] as const

export default function Capital() {
  const [tab, setTab] = useState<'Loans' | 'Investments'>('Loans')
  const [showNewLoan, setShowNewLoan] = useState(false)
  const [showNewInv, setShowNewInv] = useState(false)
  const [selectedInv, setSelectedInv] = useState<string | null>(null)
  const [loanForm, setLoanForm] = useState({ lender_name: '', loan_type: 'term', principal: '', interest_rate: '', tenure_months: '12', disbursement_date: new Date().toISOString().slice(0,10) })
  const [invForm, setInvForm] = useState({ name: '', investment_type: 'equity', invested_amount: '', investment_date: new Date().toISOString().slice(0,10) })

  const { data: loans = [], isLoading: loansLoading } = useLoans()
  const { data: investments = [], isLoading: invsLoading } = useInvestments()
  const { data: roi } = useInvestmentROI(selectedInv || '')
  const createLoanMut = useCreateLoan()
  const genScheduleMut = useGenerateLoanSchedule()
  const createInvMut = useCreateInvestment()

  useEscapeToClose(() => setShowNewLoan(false), showNewLoan)
  useEscapeToClose(() => setShowNewInv(false), showNewInv)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Capital Management</h1>
        {tab === 'Loans' && (
          <button onClick={() => setShowNewLoan(true)} className="flex items-center gap-1 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90">
            <Plus className="w-4 h-4" /> New Loan
          </button>
        )}
        {tab === 'Investments' && (
          <button onClick={() => setShowNewInv(true)} className="flex items-center gap-1 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90">
            <Plus className="w-4 h-4" /> New Investment
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

      {tab === 'Loans' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Lender', 'Type', 'Principal', 'Interest %', 'Tenure', 'Outstanding', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loansLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
              ) : (loans as any[]).length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No loans recorded.</td></tr>
              ) : (loans as any[]).map((l: any) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-800">{l.lender_name}</td>
                  <td className="px-4 py-2 text-gray-500 capitalize">{l.loan_type}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmt(l.principal)}</td>
                  <td className="px-4 py-2 text-right font-mono">{l.interest_rate}%</td>
                  <td className="px-4 py-2 text-center">{l.tenure_months}m</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-red-600">{fmt(l.outstanding_balance || l.principal)}</td>
                  <td className="px-4 py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 capitalize">{l.status}</span></td>
                  <td className="px-4 py-2">
                    {!l.schedule_generated && (
                      <button onClick={() => genScheduleMut.mutate(l.id)} disabled={genScheduleMut.isPending}
                        className="text-xs text-primary hover:underline disabled:opacity-50">Generate Schedule</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Investments' && (
        <div className="space-y-4">
          {selectedInv && roi && (
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 grid grid-cols-3 gap-4">
              <div><p className="text-xs text-indigo-500">Invested</p><p className="font-bold text-primary/80">{fmt(roi.invested_amount || 0)}</p></div>
              <div><p className="text-xs text-indigo-500">Current Value</p><p className="font-bold text-primary/80">{fmt(roi.current_value || 0)}</p></div>
              <div><p className="text-xs text-indigo-500">ROI</p><p className={`font-bold text-xl ${(roi.roi_pct || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>{(roi.roi_pct || 0).toFixed(2)}%</p></div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {invsLoading ? <p className="text-sm text-gray-500">Loading…</p> :
             (investments as any[]).length === 0 ? (
              <div className="col-span-3 text-center py-12 text-gray-500 text-sm bg-white rounded-xl border border-gray-200">No investments recorded.</div>
            ) : (investments as any[]).map((inv: any) => (
              <div key={inv.id} onClick={() => setSelectedInv(inv.id)}
                className={`bg-white rounded-xl border p-4 cursor-pointer hover:border-primary/40 ${selectedInv === inv.id ? 'border-primary/60 shadow-sm' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-800">{inv.name}</p>
                  <BarChart3 className="w-4 h-4 text-gray-400" />
                </div>
                <p className="text-xs text-gray-500 capitalize mt-1">{inv.investment_type} · {inv.status}</p>
                <p className="text-xl font-bold text-primary mt-2">{fmt(inv.current_value || inv.invested_amount)}</p>
                <p className="text-xs text-gray-400">Invested: {fmt(inv.invested_amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {showNewLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto" onClick={() => setShowNewLoan(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            <div className="flex items-start justify-between gap-3 mb-4">

              <div className="min-w-0"><h2 className="font-semibold text-lg">Record New Loan</h2></div>

              <button type="button" aria-label="Close"
                type="button"
                onClick={() => setShowNewLoan(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

            </div>
            {[
              { label: 'Lender Name', key: 'lender_name' },
              { label: 'Principal Amount', key: 'principal', type: 'number' },
              { label: 'Interest Rate (%)', key: 'interest_rate', type: 'number' },
              { label: 'Tenure (months)', key: 'tenure_months', type: 'number' },
              { label: 'Disbursement Date', key: 'disbursement_date', type: 'date' },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <Label className="block text-xs font-medium text-gray-600 mb-1">{label}</Label>
                <input type={type || 'text'} value={(loanForm as any)[key]}
                  onChange={e => setLoanForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            ))}
            <div>
              <Label className="block text-xs font-medium text-gray-600 mb-1">Loan Type</Label>
              <select value={loanForm.loan_type} onChange={e => setLoanForm(f => ({ ...f, loan_type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {['term', 'overdraft', 'revolving', 'equipment'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNewLoan(false)} className="btn-cancel px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancel</button>
              <button onClick={() => createLoanMut.mutate({ ...loanForm, principal: Number(loanForm.principal), interest_rate: Number(loanForm.interest_rate), tenure_months: Number(loanForm.tenure_months) }, { onSuccess: () => setShowNewLoan(false) })}
                disabled={createLoanMut.isPending}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
                {createLoanMut.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto" onClick={() => setShowNewInv(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            <div className="flex items-start justify-between gap-3 mb-4">

              <div className="min-w-0"><h2 className="font-semibold text-lg">New Investment</h2></div>

              <button type="button" aria-label="Close"
                type="button"
                onClick={() => setShowNewInv(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

            </div>
            {[
              { label: 'Name', key: 'name' },
              { label: 'Invested Amount', key: 'invested_amount', type: 'number' },
              { label: 'Investment Date', key: 'investment_date', type: 'date' },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <Label className="block text-xs font-medium text-gray-600 mb-1">{label}</Label>
                <input type={type || 'text'} value={(invForm as any)[key]}
                  onChange={e => setInvForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            ))}
            <div>
              <Label className="block text-xs font-medium text-gray-600 mb-1">Type</Label>
              <select value={invForm.investment_type} onChange={e => setInvForm(f => ({ ...f, investment_type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {['equity', 'debt', 'mutual_fund', 'real_estate', 'other'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNewInv(false)} className="btn-cancel px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancel</button>
              <button onClick={() => createInvMut.mutate({ ...invForm, invested_amount: Number(invForm.invested_amount) }, { onSuccess: () => setShowNewInv(false) })}
                disabled={createInvMut.isPending}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
                {createInvMut.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
