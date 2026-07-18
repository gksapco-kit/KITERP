import { useState, useRef } from 'react'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { useBankAccounts, useCreateBankAccount, useStatements, useUploadStatementCSV, useReconciliations, useCreateReconciliation, useAutoMatch } from '@/hooks/useFinance'
import { Plus, Upload, Shuffle } from 'lucide-react'
import { Button } from '@/components/ui/button'

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

  const closeNewAccount = () => setShowNewAccount(false)

  return (
    <div className="mx-auto max-w-7xl space-y-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-xs text-muted-foreground">
          Bank accounts, statement import, and reconciliation
        </p>
        {tab === 'Accounts' && (
          <button
            type="button"
            onClick={() => setShowNewAccount(true)}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> Add Account
          </button>
        )}
        {tab === 'Statements' && selectedBankId && (
          <>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleUpload} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadMut.isPending}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" /> {uploadMut.isPending ? 'Uploading…' : 'Upload CSV'}
            </button>
          </>
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

      {(tab === 'Statements' || tab === 'Reconciliation') && (
        <div className="flex gap-2 flex-wrap">
          {(accounts as any[]).map((a: any) => (
            <button key={a.id} onClick={() => setSelectedBankId(a.id)}
              className={`px-3 py-1.5 rounded-full text-xs border ${selectedBankId === a.id ? 'bg-primary/15 border-primary/60 text-primary' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
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
            <Button
              onClick={() => createReconMut.mutate({ bank_account_id: selectedBankId, reconciliation_date: new Date().toISOString().slice(0,10) })}
              disabled={!selectedBankId || createReconMut.isPending}
              className="gap-1"
            >
              <Plus className="w-4 h-4" /> {createReconMut.isPending ? 'Creating…' : 'New Reconciliation'}
            </Button>
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
                          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 disabled:opacity-50">
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
        <ModalOverlay onClose={closeNewAccount} className="z-[100] bg-black/60 p-3">
          <ModalPanel className="max-w-md max-h-[calc(100dvh-1.5rem)] !rounded-lg overflow-hidden">
            <ModalHeader
              title="Add Bank Account"
              onClose={closeNewAccount}
              className="border-0 px-4 py-2.5 [&>div>h2]:text-base [&>div>h2]:leading-none"
            />
            <ModalBody className="space-y-2 overflow-y-auto px-4 pb-1 pt-0">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Account Name', key: 'name', span: 'col-span-2' },
                  { label: 'Bank Name', key: 'bank_name', span: 'col-span-2' },
                  { label: 'Account Number', key: 'account_number' },
                  { label: 'IFSC Code', key: 'ifsc_code' },
                  { label: 'Opening Balance', key: 'opening_balance', type: 'number', span: 'col-span-2' },
                ].map(({ label, key, type, span }) => (
                  <div key={key} className={span}>
                    <Label className="mb-0.5 block text-[11px] font-medium text-muted-foreground">{label}</Label>
                    <input
                      type={type || 'text'}
                      value={(accountForm as any)[key]}
                      onChange={e => setAccountForm(f => ({ ...f, [key]: e.target.value }))}
                      className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                ))}
                <div className="col-span-2">
                  <Label className="mb-0.5 block text-[11px] font-medium text-muted-foreground">Type</Label>
                  <Select
                    value={accountForm.account_type}
                    onChange={v => setAccountForm(f => ({ ...f, account_type: v }))}
                    options={['bank', 'cash', 'credit_card', 'wallet'].map(t => ({ value: t, label: t }))}
                  />
                </div>
              </div>
            </ModalBody>
            <ModalFooter className="border-0 px-4 py-2.5">
              <button type="button" onClick={closeNewAccount} className="btn-cancel h-8 rounded-md border border-border px-3 text-sm">Cancel</button>
              <button
                type="button"
                onClick={() => createAccountMut.mutate(accountForm, { onSuccess: closeNewAccount })}
                disabled={createAccountMut.isPending}
                className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {createAccountMut.isPending ? 'Saving…' : 'Save'}
              </button>
            </ModalFooter>
          </ModalPanel>
        </ModalOverlay>
      )}
    </div>
  )
}
