import { useState, useRef } from 'react'
import { useBankAccounts, useCreateBankAccount, useStatements, useUploadStatementCSV, useReconciliations, useCreateReconciliation, useAutoMatch } from '@/hooks/useFinance'
import { Plus, Upload, Shuffle } from 'lucide-react'

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

const TABS = ['Accounts', 'Statements', 'Reconciliation'] as const
type Tab = typeof TABS[number]

export default function BankCash() {
  const [tab, setTab] = useState<Tab>('Accounts')
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null)
  const [showNewAccount, setShowNewAccount] = useState(false)
  const [accountForm, setAccountForm] = useState({ name: '', account_type: 'bank', bank_name: '', account_number: '', ifsc_code: '', opening_balance: '' })
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: accounts = [], isLoading: accountsLoading } = useBankAccounts()
  const { data: statements = [], isLoading: stmtsLoading } = useStatements(selectedBankId ? { bank_account_id: selectedBankId } : {})
  const { data: reconciliations = [], isLoading: recLoading } = useReconciliations(selectedBankId ? { bank_account_id: selectedBankId } : {})

  const createAccountMut = useCreateBankAccount()
  const uploadMut = useUploadStatementCSV()
  const createReconMut = useCreateReconciliation()
  const autoMatchMut = useAutoMatch()

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedBankId) return
    uploadMut.mutate({ bankAccountId: selectedBankId, file })
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Bank & Cash</h1>
        {tab === 'Accounts' && (
          <button onClick={() => setShowNewAccount(true)} className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Add Account
          </button>
        )}
        {tab === 'Statements' && selectedBankId && (
          <>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleUpload} />
            <button onClick={() => fileRef.current?.click()} disabled={uploadMut.isPending}
              className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
              <Upload className="w-4 h-4" /> {uploadMut.isPending ? 'Uploading…' : 'Upload CSV'}
            </button>
          </>
        )}
      </div>

      <div className="flex gap-2">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm border ${tab === t ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {t}
          </button>
        ))}
      </div>

      {(tab === 'Statements' || tab === 'Reconciliation') && (
        <div className="flex gap-2 flex-wrap">
          {(accounts as any[]).map((a: any) => (
            <button key={a.id} onClick={() => setSelectedBankId(a.id)}
              className={`px-3 py-1.5 rounded-full text-xs border ${selectedBankId === a.id ? 'bg-indigo-100 border-indigo-400 text-indigo-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              {a.name}
            </button>
          ))}
        </div>
      )}

      {tab === 'Accounts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {accountsLoading ? <p className="text-gray-500 text-sm">Loading…</p> :
           (accounts as any[]).length === 0 ? (
            <div className="col-span-3 text-center py-12 text-gray-500 text-sm">No bank accounts yet. Add your first account.</div>
          ) : (accounts as any[]).map((a: any) => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-800">{a.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 capitalize">{a.account_type}</span>
              </div>
              <p className="text-xs text-gray-500">{a.bank_name} · {a.account_number}</p>
              <p className="text-xl font-bold text-gray-900">{fmt(a.current_balance || a.opening_balance || 0)}</p>
              {a.last_reconciled_date && <p className="text-xs text-gray-400">Last reconciled: {a.last_reconciled_date}</p>}
            </div>
          ))}
        </div>
      )}

      {tab === 'Statements' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Date', 'Description', 'Debit', 'Credit', 'Balance', 'Reconciled'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stmtsLoading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
              ) : !selectedBankId ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Select a bank account above.</td></tr>
              ) : (statements as any[]).length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No statements. Upload a CSV to import.</td></tr>
              ) : (statements as any[]).map((s: any) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">{s.statement_date}</td>
                  <td className="px-4 py-2 text-gray-600">{s.source} statement</td>
                  <td className="px-4 py-2 text-right font-mono">—</td>
                  <td className="px-4 py-2 text-right font-mono">—</td>
                  <td className="px-4 py-2 text-right font-mono">{fmt(s.closing_balance || 0)}</td>
                  <td className="px-4 py-2"><span className="text-xs text-gray-400">{s.source}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Reconciliation' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button onClick={() => createReconMut.mutate({ bank_account_id: selectedBankId, reconciliation_date: new Date().toISOString().slice(0,10) })}
              disabled={!selectedBankId || createReconMut.isPending}
              className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
              <Plus className="w-4 h-4" /> {createReconMut.isPending ? 'Creating…' : 'New Reconciliation'}
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Date', 'Statement Balance', 'Book Balance', 'Difference', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recLoading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
                ) : !selectedBankId ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Select a bank account above.</td></tr>
                ) : (reconciliations as any[]).length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No reconciliations yet.</td></tr>
                ) : (reconciliations as any[]).map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">{r.reconciliation_date}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(r.statement_balance || 0)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(r.book_balance || 0)}</td>
                    <td className={`px-4 py-2 text-right font-mono font-semibold ${Math.abs(r.difference) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                      {fmt(r.difference || 0)}
                    </td>
                    <td className="px-4 py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{r.status}</span></td>
                    <td className="px-4 py-2">
                      {r.status === 'open' && (
                        <button onClick={() => autoMatchMut.mutate({ id: r.id, data: { bank_account_id: selectedBankId } })}
                          disabled={autoMatchMut.isPending}
                          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50">
                          <Shuffle className="w-3 h-3" /> Auto-Match
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showNewAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="font-semibold text-lg">Add Bank Account</h2>
            {[
              { label: 'Account Name', key: 'name' },
              { label: 'Bank Name', key: 'bank_name' },
              { label: 'Account Number', key: 'account_number' },
              { label: 'IFSC Code', key: 'ifsc_code' },
              { label: 'Opening Balance', key: 'opening_balance', type: 'number' },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input type={type || 'text'} value={(accountForm as any)[key]}
                  onChange={e => setAccountForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select value={accountForm.account_type} onChange={e => setAccountForm(f => ({ ...f, account_type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {['bank', 'cash', 'credit_card', 'wallet'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNewAccount(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => createAccountMut.mutate(accountForm, { onSuccess: () => setShowNewAccount(false) })}
                disabled={createAccountMut.isPending}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {createAccountMut.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
