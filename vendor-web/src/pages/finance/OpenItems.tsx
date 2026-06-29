import { useState, useMemo } from 'react'
import {
  Check, X, RefreshCw, AlertCircle, CheckCircle2, Circle,
  ChevronDown, Search, Filter, Trash2, ListChecks, BookOpen,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useAccounts, useOpenItems, useClearOpenItems, useResetClearing, useClearingBatches } from '@/hooks/useFinance'
import type { OpenItem, ClearingBatch } from '@/api/finance'

const fmtAmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

const SOURCE_LABELS: Record<string, string> = {
  invoice: 'Invoice', payment: 'Payment', pos: 'POS', vendor_bill: 'Bill',
  vendor_payment: 'Vendor Pay', payroll: 'Payroll', expense: 'Expense',
  asset: 'Asset', depreciation: 'Depreciation', loan: 'Loan', manual: 'Manual',
  opening: 'Opening', closing: 'Closing', commission_accrual: 'Commission',
}

type Tab = 'open' | 'history'

export default function OpenItems() {
  const [tab, setTab] = useState<Tab>('open')
  const [accountId, setAccountId] = useState('')
  const [partyTypeFilter, setPartyTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [clearingDate, setClearingDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const { data: allAccounts = [] } = useAccounts()
  const reconcilableAccounts = useMemo(
    () => (allAccounts as any[]).filter(a => a.is_reconcilable || a.is_reconciliation_account),
    [allAccounts],
  )

  const { data: openItems = [], isLoading, refetch } = useOpenItems(
    { account_id: accountId, party_type: partyTypeFilter || undefined },
    !!accountId,
  )
  const items = openItems as OpenItem[]

  const { data: batches = [] } = useClearingBatches(
    accountId ? { account_id: accountId } : undefined,
  )

  const clearMut = useClearOpenItems()
  const resetMut = useResetClearing()

  const selectedItems = items.filter(i => selected.has(i.id))
  const totalDebit  = selectedItems.reduce((s, i) => s + i.debit, 0)
  const totalCredit = selectedItems.reduce((s, i) => s + i.credit, 0)
  const isBalanced  = selectedItems.length >= 2 && Math.abs(totalDebit - totalCredit) < 0.001

  const filteredItems = useMemo(() =>
    items.filter(i =>
      !search ||
      i.entry_no.toLowerCase().includes(search.toLowerCase()) ||
      (i.narration || '').toLowerCase().includes(search.toLowerCase()) ||
      (i.ref_doc_no || '').toLowerCase().includes(search.toLowerCase()),
    ),
    [items, search],
  )

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === filteredItems.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredItems.map(i => i.id)))
    }
  }

  const handleClear = () => {
    setError('')
    setSuccess('')
    clearMut.mutate(
      { line_ids: [...selected], clearing_date: clearingDate, notes: notes || undefined },
      {
        onSuccess: () => {
          setSuccess('Items cleared successfully.')
          setSelected(new Set())
          refetch()
        },
        onError: (e: any) => setError(e?.response?.data?.detail || 'Clearing failed.'),
      },
    )
  }

  const handleReset = (batchId: string) => {
    setError('')
    setSuccess('')
    resetMut.mutate(batchId, {
      onSuccess: () => { setSuccess('Clearing reversed.'); refetch() },
      onError: (e: any) => setError(e?.response?.data?.detail || 'Reset failed.'),
    })
  }

  const selectedAccount = reconcilableAccounts.find((a: any) => a.id === accountId) as any

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">GL Open-Item Management</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          View, select, and clear matching debit / credit items on reconcilable accounts.
        </p>
      </div>

      {/* Account picker */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">Account</label>
          <select
            value={accountId}
            onChange={e => { setAccountId(e.target.value); setSelected(new Set()) }}
            className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— Select reconcilable account —</option>
            {reconcilableAccounts.map((a: any) => (
              <option key={a.id} value={a.id}>{a.code} – {a.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">Party Type</label>
          <select
            value={partyTypeFilter}
            onChange={e => setPartyTypeFilter(e.target.value)}
            className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All parties</option>
            <option value="customer">Customer</option>
            <option value="supplier">Supplier</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={() => refetch()}
            disabled={!accountId}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted/30 disabled:opacity-40"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Selected account info */}
      {selectedAccount && (
        <div className="flex items-center gap-2.5 p-3 bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 rounded-xl">
          <BookOpen className="w-4 h-4 text-violet-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">
              {selectedAccount.code} – {selectedAccount.name}
            </p>
            <p className="text-xs text-violet-600 dark:text-violet-400">
              {selectedAccount.is_reconciliation_account
                ? `Reconciliation account — ${selectedAccount.reconciliation_subledger ?? 'control'} subledger`
                : 'Reconcilable account'
              } · {items.length} open items
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      {accountId && (
        <div className="flex border-b border-border">
          {([
            { id: 'open', label: 'Open Items', count: items.length },
            { id: 'history', label: 'Clearing History', count: (batches as ClearingBatch[]).length },
          ] as { id: Tab; label: string; count: number }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{t.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Feedback banners */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 rounded-xl">
          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
          <p className="text-sm text-green-700 dark:text-green-300">{success}</p>
          <button onClick={() => setSuccess('')} className="ml-auto text-green-400 hover:text-green-600"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* ── Open Items tab ── */}
      {tab === 'open' && accountId && (
        <div className="space-y-3">
          {/* Search + selection summary */}
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search entry no, narration, ref…"
                className="pl-8 bg-background"
              />
            </div>
            {selected.size > 0 && (
              <span className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full font-medium">
                {selected.size} selected · Dr {fmtAmt(totalDebit)} · Cr {fmtAmt(totalCredit)}
                {isBalanced
                  ? <span className="ml-1.5 text-green-600 font-semibold">✓ Balanced</span>
                  : <span className="ml-1.5 text-orange-500">Net {fmtAmt(Math.abs(totalDebit - totalCredit))}</span>}
              </span>
            )}
          </div>

          {/* Table */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="px-3 py-2.5 w-8">
                    <button onClick={toggleAll} className="p-0.5">
                      {selected.size === filteredItems.length && filteredItems.length > 0
                        ? <CheckCircle2 className="w-4 h-4 text-primary" />
                        : <Circle className="w-4 h-4 text-muted-foreground" />}
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Date</th>
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Entry No</th>
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground uppercase tracking-wide">Narration</th>
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Source</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Debit</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Credit</th>
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Loading…
                  </td></tr>
                ) : filteredItems.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <ListChecks className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>{accountId ? 'No open items for this account.' : 'Select an account to view open items.'}</p>
                  </td></tr>
                ) : filteredItems.map(item => {
                  const isSel = selected.has(item.id)
                  return (
                    <tr
                      key={item.id}
                      onClick={() => toggleSelect(item.id)}
                      className={`cursor-pointer transition-colors ${isSel ? 'bg-primary/5' : 'hover:bg-muted/20'}`}
                    >
                      <td className="px-3 py-2.5 text-center">
                        {isSel
                          ? <CheckCircle2 className="w-4 h-4 text-primary inline" />
                          : <Circle className="w-4 h-4 text-muted-foreground/40 inline" />}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground font-mono whitespace-nowrap">{item.entry_date}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="font-mono font-semibold text-primary">{item.entry_no}</span>
                      </td>
                      <td className="px-3 py-2.5 max-w-[200px]">
                        <p className="line-clamp-2 text-foreground leading-snug">{item.narration || '—'}</p>
                        {item.ref_doc_no && (
                          <p className="text-muted-foreground/60 text-xs">{item.ref_doc_type}: {item.ref_doc_no}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground whitespace-nowrap">
                          {SOURCE_LABELS[item.source_type] || item.source_type}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-foreground">
                        {item.debit > 0 ? fmtAmt(item.debit) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-foreground">
                        {item.credit > 0 ? fmtAmt(item.credit) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          item.open_item_status === 'open'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                            : 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
                        }`}>
                          {item.open_item_status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Clear panel */}
          {selected.size >= 2 && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Clear Selected Items</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Clearing Date</label>
                  <input
                    type="date" value={clearingDate}
                    onChange={e => setClearingDate(e.target.value)}
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Notes (optional)</label>
                  <input
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. Customer payment clearing for Invoice INV-001"
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              {!isBalanced && (
                <div className="flex items-start gap-2 p-2.5 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-orange-700 dark:text-orange-300">
                    Selected items do not balance (Dr {fmtAmt(totalDebit)} ≠ Cr {fmtAmt(totalCredit)}).
                    Add or remove items until the net difference is zero.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  Clear selection
                </button>
                <button
                  onClick={handleClear}
                  disabled={!isBalanced || clearMut.isPending}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg font-medium transition-all ${
                    isBalanced && !clearMut.isPending
                      ? 'bg-primary text-white hover:bg-primary/90'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }`}
                >
                  {clearMut.isPending
                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Clearing…</>
                    : <><Check className="w-3.5 h-3.5" /> Clear {selected.size} items</>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Clearing History tab ── */}
      {tab === 'history' && accountId && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Clearing Ref</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Date</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground uppercase tracking-wide">Notes</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground uppercase tracking-wide">Lines</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Total Dr</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Total Cr</th>
                <th className="px-3 py-2.5 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(batches as ClearingBatch[]).length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No clearing history for this account.
                  </td>
                </tr>
              ) : (batches as ClearingBatch[]).map(b => (
                <tr key={b.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5">
                    <span className="font-mono font-semibold text-primary">{b.clearing_ref}</span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground font-mono whitespace-nowrap">{b.clearing_date}</td>
                  <td className="px-3 py-2.5 text-foreground max-w-[200px]">
                    <span className="line-clamp-1">{b.notes || '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{b.line_count}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-foreground">{fmtAmt(b.total_debit)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-foreground">{fmtAmt(b.total_credit)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <button
                      onClick={() => handleReset(b.id)}
                      title="Reverse clearing"
                      className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!accountId && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Filter className="w-10 h-10 opacity-25" />
          <p className="text-sm">Select a reconcilable account above to view its open items.</p>
        </div>
      )}
    </div>
  )
}
