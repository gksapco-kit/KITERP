import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { useLoans, useCreateLoan, useGenerateLoanSchedule, useInvestments, useCreateInvestment, useInvestmentROI } from '@/hooks/useFinance'
import { Plus, BarChart3 } from 'lucide-react'

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

const TABS = ['Loans', 'Investments'] as const

const inputCls =
  'h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring'
const labelCls = 'mb-0.5 block text-[11px] font-medium text-muted-foreground'

export default function Capital() {
  const [tab, setTab] = useState<'Loans' | 'Investments'>('Loans')
  const [showNewLoan, setShowNewLoan] = useState(false)
  const [showNewInv, setShowNewInv] = useState(false)
  const [selectedInv, setSelectedInv] = useState<string | null>(null)
  const [loanForm, setLoanForm] = useState({
    lender_name: '',
    loan_type: 'term',
    principal: '',
    interest_rate: '',
    tenure_months: '12',
    disbursement_date: new Date().toISOString().slice(0, 10),
  })
  const [invForm, setInvForm] = useState({
    name: '',
    investment_type: 'equity',
    invested_amount: '',
    investment_date: new Date().toISOString().slice(0, 10),
  })

  const { data: loans = [], isLoading: loansLoading } = useLoans()
  const { data: investments = [], isLoading: invsLoading } = useInvestments()
  const { data: roi } = useInvestmentROI(selectedInv || '')
  const createLoanMut = useCreateLoan()
  const genScheduleMut = useGenerateLoanSchedule()
  const createInvMut = useCreateInvestment()

  const closeNewLoan = () => setShowNewLoan(false)
  const closeNewInv = () => setShowNewInv(false)

  return (
    <div className="mx-auto max-w-7xl space-y-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-xs text-muted-foreground">
          Loans, repayment schedules, and investments
        </p>
        {tab === 'Loans' && (
          <button
            type="button"
            onClick={() => setShowNewLoan(true)}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> New Loan
          </button>
        )}
        {tab === 'Investments' && (
          <button
            type="button"
            onClick={() => setShowNewInv(true)}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> New Investment
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {TABS.map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg border px-4 py-2 text-sm ${tab === t ? 'border-primary bg-primary text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Loans' && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                {['Lender', 'Type', 'Principal', 'Interest %', 'Tenure', 'Outstanding', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{h}</th>
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
                  <td className="px-4 py-2 capitalize text-gray-500">{l.loan_type}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmt(l.principal)}</td>
                  <td className="px-4 py-2 text-right font-mono">{l.interest_rate}%</td>
                  <td className="px-4 py-2 text-center">{l.tenure_months}m</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-red-600">{fmt(l.outstanding_balance || l.principal)}</td>
                  <td className="px-4 py-2"><span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs capitalize text-blue-700">{l.status}</span></td>
                  <td className="px-4 py-2">
                    {!l.schedule_generated && (
                      <button
                        type="button"
                        onClick={() => genScheduleMut.mutate(l.id)}
                        disabled={genScheduleMut.isPending}
                        className="text-xs text-primary hover:underline disabled:opacity-50"
                      >
                        Generate Schedule
                      </button>
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
            <div className="grid grid-cols-3 gap-4 rounded-xl border border-primary/30 bg-primary/10 p-4">
              <div><p className="text-xs text-indigo-500">Invested</p><p className="font-bold text-primary/80">{fmt(roi.invested_amount || 0)}</p></div>
              <div><p className="text-xs text-indigo-500">Current Value</p><p className="font-bold text-primary/80">{fmt(roi.current_value || 0)}</p></div>
              <div><p className="text-xs text-indigo-500">ROI</p><p className={`text-xl font-bold ${(roi.roi_pct || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>{(roi.roi_pct || 0).toFixed(2)}%</p></div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {invsLoading ? <p className="text-sm text-gray-500">Loading…</p> :
             (investments as any[]).length === 0 ? (
              <div className="col-span-3 rounded-xl border border-gray-200 bg-white py-12 text-center text-sm text-gray-500">No investments recorded.</div>
            ) : (investments as any[]).map((inv: any) => (
              <div
                key={inv.id}
                onClick={() => setSelectedInv(inv.id)}
                className={`cursor-pointer rounded-xl border bg-white p-4 hover:border-primary/40 ${selectedInv === inv.id ? 'border-primary/60 shadow-sm' : 'border-gray-200'}`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-800">{inv.name}</p>
                  <BarChart3 className="h-4 w-4 text-gray-400" />
                </div>
                <p className="mt-1 text-xs capitalize text-gray-500">{inv.investment_type} · {inv.status}</p>
                <p className="mt-2 text-xl font-bold text-primary">{fmt(inv.current_value || inv.invested_amount)}</p>
                <p className="text-xs text-gray-400">Invested: {fmt(inv.invested_amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {showNewLoan && (
        <ModalOverlay onClose={closeNewLoan} className="z-[100] bg-black/60 p-3">
          <ModalPanel className="max-w-md max-h-[calc(100dvh-1.5rem)] !rounded-lg overflow-hidden">
            <ModalHeader
              title="Record New Loan"
              onClose={closeNewLoan}
              className="border-0 px-4 py-2.5 [&>div>h2]:text-base [&>div>h2]:leading-none"
            />
            <ModalBody className="space-y-2 overflow-y-auto px-4 pb-1 pt-0">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Lender Name', key: 'lender_name', span: 'col-span-2' },
                  { label: 'Principal Amount', key: 'principal', type: 'number' },
                  { label: 'Interest Rate (%)', key: 'interest_rate', type: 'number' },
                  { label: 'Tenure (months)', key: 'tenure_months', type: 'number' },
                  { label: 'Disbursement Date', key: 'disbursement_date', type: 'date' },
                ].map(({ label, key, type, span }) => (
                  <div key={key} className={span}>
                    <Label className={labelCls}>{label}</Label>
                    <input
                      type={type || 'text'}
                      value={(loanForm as any)[key]}
                      onChange={e => setLoanForm(f => ({ ...f, [key]: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                ))}
                <div className="col-span-2">
                  <Label className={labelCls}>Loan Type</Label>
                  <Select
                    value={loanForm.loan_type}
                    onChange={v => setLoanForm(f => ({ ...f, loan_type: v }))}
                    options={['term', 'overdraft', 'revolving', 'equipment'].map(t => ({ value: t, label: t }))}
                  />
                </div>
              </div>
            </ModalBody>
            <ModalFooter className="border-0 px-4 py-2.5">
              <button type="button" onClick={closeNewLoan} className="btn-cancel h-8 rounded-md border border-border px-3 text-sm">Cancel</button>
              <button
                type="button"
                onClick={() => createLoanMut.mutate(
                  {
                    ...loanForm,
                    principal: Number(loanForm.principal),
                    interest_rate: Number(loanForm.interest_rate),
                    tenure_months: Number(loanForm.tenure_months),
                  },
                  { onSuccess: closeNewLoan },
                )}
                disabled={createLoanMut.isPending}
                className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {createLoanMut.isPending ? 'Saving…' : 'Save'}
              </button>
            </ModalFooter>
          </ModalPanel>
        </ModalOverlay>
      )}

      {showNewInv && (
        <ModalOverlay onClose={closeNewInv} className="z-[100] bg-black/60 p-3">
          <ModalPanel className="max-w-md max-h-[calc(100dvh-1.5rem)] !rounded-lg overflow-hidden">
            <ModalHeader
              title="New Investment"
              onClose={closeNewInv}
              className="border-0 px-4 py-2.5 [&>div>h2]:text-base [&>div>h2]:leading-none"
            />
            <ModalBody className="space-y-2 overflow-y-auto px-4 pb-1 pt-0">
              {[
                { label: 'Name', key: 'name' },
                { label: 'Invested Amount', key: 'invested_amount', type: 'number' },
                { label: 'Investment Date', key: 'investment_date', type: 'date' },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <Label className={labelCls}>{label}</Label>
                  <input
                    type={type || 'text'}
                    value={(invForm as any)[key]}
                    onChange={e => setInvForm(f => ({ ...f, [key]: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              ))}
              <div>
                <Label className={labelCls}>Type</Label>
                <Select
                  value={invForm.investment_type}
                  onChange={v => setInvForm(f => ({ ...f, investment_type: v }))}
                  options={['equity', 'debt', 'mutual_fund', 'real_estate', 'other'].map(t => ({ value: t, label: t }))}
                />
              </div>
            </ModalBody>
            <ModalFooter className="border-0 px-4 py-2.5">
              <button type="button" onClick={closeNewInv} className="btn-cancel h-8 rounded-md border border-border px-3 text-sm">Cancel</button>
              <button
                type="button"
                onClick={() => createInvMut.mutate(
                  { ...invForm, invested_amount: Number(invForm.invested_amount) },
                  { onSuccess: closeNewInv },
                )}
                disabled={createInvMut.isPending}
                className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {createInvMut.isPending ? 'Saving…' : 'Save'}
              </button>
            </ModalFooter>
          </ModalPanel>
        </ModalOverlay>
      )}
    </div>
  )
}
