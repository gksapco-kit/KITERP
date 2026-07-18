import { useState, useEffect, useMemo } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { Label } from '@/components/ui/label'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { useAccounts, useCreateAccount, useUpdateAccount, useSeedCOA, useAccountLedger } from '@/hooks/useFinance'
import {
  Plus, ChevronRight, ChevronDown, Pencil, Settings2, X,
  GripVertical, Trash2, PlusCircle, Info, ChevronUp,
  Filter, BarChart2, BookOpen, Tag, Activity, ArrowRight,
  CheckCircle2, XCircle, Shield, TrendingUp, TrendingDown,
  SlidersHorizontal, Eye, List, Download, RefreshCw,
  ArrowUpRight, ArrowDownLeft, CalendarDays,
} from 'lucide-react'
import { Input } from '@/components/ui/input'

// ─── Types ────────────────────────────────────────────────────────────────────
type Account = {
  id: string; code: string; name: string
  account_type: string; account_subtype: string
  parent_id: string | null; is_active: boolean; is_system: boolean
  currency?: string; description?: string
  opening_balance?: number; is_reconcilable?: boolean
  is_reconciliation_account?: boolean
  reconciliation_subledger?: string | null
}

type NormalBalance = 'Debit' | 'Credit'
type Statement = 'Balance Sheet' | 'Income Statement' | 'None'

interface AccountTypeConfig {
  type: string
  color: string          // tailwind bg+text combo for the badge
  normalBalance: NormalBalance
  statement: Statement
  codeRangeStart: number
  codeRangeEnd: number
  subtypes: string[]
}

// ─── Defaults ────────────────────────────────────────────────────────────────
const DEFAULT_CONFIG: AccountTypeConfig[] = [
  {
    type: 'Asset',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
    normalBalance: 'Debit',
    statement: 'Balance Sheet',
    codeRangeStart: 1000,
    codeRangeEnd: 1999,
    subtypes: ['Current Assets', 'Fixed Assets', 'Investments', 'Other Assets'],
  },
  {
    type: 'Liability',
    color: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
    normalBalance: 'Credit',
    statement: 'Balance Sheet',
    codeRangeStart: 2000,
    codeRangeEnd: 2999,
    subtypes: ['Current Liabilities', 'Long-term Liabilities', 'Other Liabilities'],
  },
  {
    type: 'Equity',
    color: 'bg-primary/12 text-primary dark:bg-primary/20 dark:text-primary',
    normalBalance: 'Credit',
    statement: 'Balance Sheet',
    codeRangeStart: 3000,
    codeRangeEnd: 3999,
    subtypes: ['Common Stock', 'Retained Earnings', "Owner's Equity"],
  },
  {
    type: 'Income',
    color: 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300',
    normalBalance: 'Credit',
    statement: 'Income Statement',
    codeRangeStart: 4000,
    codeRangeEnd: 4999,
    subtypes: ['Sales Revenue', 'Service Revenue', 'Other Income'],
  },
  {
    type: 'Expense',
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
    normalBalance: 'Debit',
    statement: 'Income Statement',
    codeRangeStart: 5000,
    codeRangeEnd: 5999,
    subtypes: ['Cost of Goods Sold', 'Operating Expenses', 'Administrative Expenses', 'Other Expenses'],
  },
]

const STORAGE_KEY = 'coa_type_config'

function loadConfig(): AccountTypeConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as AccountTypeConfig[]
  } catch { /* ignore */ }
  return DEFAULT_CONFIG
}

function saveConfig(cfg: AccountTypeConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
}

const BADGE_OPTIONS = [
  { label: 'Blue',   value: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' },
  { label: 'Red',    value: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300' },
  { label: 'Brand', value: 'bg-primary/12 text-primary dark:bg-primary/20' },
  { label: 'Green',  value: 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300' },
  { label: 'Orange', value: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300' },
  { label: 'Yellow', value: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-300' },
  { label: 'Teal',   value: 'bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300' },
  { label: 'Gray',   value: 'bg-muted text-muted-foreground' },
]

// ─── Account tree rendering ───────────────────────────────────────────────────
function AccountRow({
  acc, depth, children, onEdit, onView, config,
}: {
  acc: Account; depth: number; children?: React.ReactNode
  onEdit: (a: Account) => void
  onView: (a: Account) => void
  config: AccountTypeConfig[]
}) {
  const [open, setOpen] = useState(depth < 2)
  const hasChildren = !!children
  const cfg = config.find(c => c.type === acc.account_type)
  const badgeClass = cfg?.color ?? 'bg-muted text-muted-foreground'

  return (
    <div>
      <div
        className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/30 rounded-lg cursor-pointer group transition-colors"
        style={{ paddingLeft: `${12 + depth * 20}px` }}
        onClick={() => onView(acc)}
      >
        <span className="w-5 shrink-0" onClick={e => { e.stopPropagation(); hasChildren && setOpen(o => !o) }}>
          {hasChildren
            ? open
              ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
              : <ChevronRight className="w-4 h-4 text-muted-foreground" />
            : <span className="w-4 inline-block" />}
        </span>
        <span className="font-mono text-xs text-muted-foreground w-14 shrink-0">{acc.code}</span>
        <span className="flex-1 text-sm text-foreground font-medium">{acc.name}</span>
        {acc.account_subtype && (
          <span className="text-xs text-muted-foreground hidden sm:block shrink-0">{acc.account_subtype}</span>
        )}
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${badgeClass}`}>
          {acc.account_type}
        </span>
        {!acc.is_active && (
          <span className="text-xs text-red-400 bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded-full shrink-0">Inactive</span>
        )}
        {acc.is_system && (
          <Shield className="w-3 h-3 text-muted-foreground/50 shrink-0" />
        )}
        {acc.is_reconciliation_account && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 shrink-0 font-medium">
            Recon
          </span>
        )}
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onView(acc) }}
            className="p-1 text-muted-foreground hover:text-primary rounded"
            title="View details"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onEdit(acc) }}
            className="p-1 text-muted-foreground hover:text-primary rounded"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {open && children && <div>{children}</div>}
    </div>
  )
}

function buildTree(accounts: Account[]) {
  const children: Record<string, Account[]> = {}
  accounts.forEach(a => { if (!children[a.id]) children[a.id] = [] })
  accounts.forEach(a => { if (a.parent_id && children[a.parent_id]) children[a.parent_id].push(a) })
  const roots = accounts.filter(a => !a.parent_id)
  return { roots, children }
}

function renderTree(
  accounts: Account[],
  children: Record<string, Account[]>,
  onEdit: (a: Account) => void,
  onView: (a: Account) => void,
  config: AccountTypeConfig[],
  depth = 0,
): React.ReactNode {
  return accounts.map(acc => (
    <AccountRow
      key={acc.id} acc={acc} depth={depth} onEdit={onEdit} onView={onView} config={config}
      children={children[acc.id]?.length ? renderTree(children[acc.id], children, onEdit, onView, config, depth + 1) : undefined}
    />
  ))
}

// ─── Account Detail Drawer ────────────────────────────────────────────────────
const fmtCcy = (n: number, ccy = 'INR') =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

function AccountDetailDrawer({
  account, allAccounts, config, onClose, onEdit,
}: {
  account: Account
  allAccounts: Account[]
  config: AccountTypeConfig[]
  onClose: () => void
  onEdit: (a: Account) => void
}) {
  const [tab, setTab] = useState<'details' | 'transactions'>('details')
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setMonth(0); d.setDate(1); return d.toISOString().slice(0, 10)
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10))

  const { data: ledgerData = [], isLoading: ledgerLoading, refetch: refetchLedger } =
    useAccountLedger(account.id, { from_date: fromDate, to_date: toDate })
  const ledger = ledgerData as {
    date: string; entry_no: string; narration: string
    debit: number; credit: number; balance: number; source_type: string
  }[]

  const cfg = config.find(c => c.type === account.account_type)
  const badgeClass = cfg?.color ?? 'bg-muted text-muted-foreground'
  const parent = allAccounts.find(a => a.id === account.parent_id)
  const childAccounts = allAccounts.filter(a => a.parent_id === account.id)
  const statLabel = cfg?.statement === 'Balance Sheet' ? 'Balance Sheet'
    : cfg?.statement === 'Income Statement' ? 'Income Statement (P&L)' : '—'
  const normBal = cfg?.normalBalance ?? '—'
  const siblings = allAccounts.filter(a =>
    a.id !== account.id && a.parent_id === account.parent_id && a.account_type === account.account_type
  ).slice(0, 5)
  const sameTypeAccounts = allAccounts.filter(a => a.account_type === account.account_type).length

  // Ledger summary
  const totalDebit = ledger.reduce((s, r) => s + r.debit, 0)
  const totalCredit = ledger.reduce((s, r) => s + r.credit, 0)
  const closingBalance = ledger.length ? ledger[ledger.length - 1].balance : 0

  const exportCSV = () => {
    const header = 'Date,Entry No,Narration,Source,Debit,Credit,Balance\n'
    const rows = ledger.map(r =>
      `${r.date},${r.entry_no},"${(r.narration || '').replace(/"/g, '""')}",${r.source_type},${r.debit},${r.credit},${r.balance}`
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `ledger_${account.code}_${fromDate}_${toDate}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const SOURCE_LABELS: Record<string, string> = {
    invoice: 'Invoice', payment: 'Payment', pos: 'POS', vendor_bill: 'Bill',
    vendor_payment: 'Vendor Pay', payroll: 'Payroll', expense: 'Expense',
    asset: 'Asset', depreciation: 'Depreciation', loan: 'Loan', manual: 'Manual',
    opening: 'Opening', closing: 'Closing',
  }

  const DetailRow = ({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) => (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0 w-40">{label}</span>
      <span className={`text-xs text-right font-medium text-foreground ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</span>
    </div>
  )

  return (
    <div data-kiterp-modal className="fixed inset-0 z-[100] flex">
      <div className="flex-1 bg-black/25" onClick={onClose} />
      <div className="w-full max-w-2xl bg-card border-l border-border text-foreground h-full shadow-2xl flex flex-col overflow-hidden">

        {/* ── Drawer header ── */}
        <div className="px-6 py-4 border-b bg-card flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badgeClass}`}>
                {account.account_type}
              </span>
              {account.account_subtype && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {account.account_subtype}
                </span>
              )}
              {account.is_system && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  <Shield className="w-2.5 h-2.5" /> System
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="font-mono text-sm text-muted-foreground shrink-0">{account.code}</span>
              <h2 className="font-bold text-xl text-foreground leading-tight">{account.name}</h2>
            </div>
            <div className="flex items-center gap-2 mt-1">
              {account.is_active
                ? <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="w-3 h-3" /> Active</span>
                : <span className="flex items-center gap-1 text-xs text-red-500"><XCircle className="w-3 h-3" /> Inactive</span>}
              <span className="text-muted-foreground/50">·</span>
              <span className="text-xs text-muted-foreground">{account.currency || 'INR'}</span>
              <span className="text-muted-foreground/50">·</span>
              <span className="text-xs text-muted-foreground">{normBal} Normal</span>
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => { onEdit(account); onClose() }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
            <button type="button" aria-label="Close" onClick={onClose} className="p-1.5 text-muted-foreground hover:text-muted-foreground rounded-lg hover:bg-muted/50">
                <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-border px-6 bg-card shrink-0">
          {[
            { id: 'details', label: 'Account Details', icon: BookOpen },
            { id: 'transactions', label: 'Ledger / Transactions', icon: List },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ══ DETAILS TAB ══ */}
          {tab === 'details' && (
            <div className="space-y-1 pb-6">
              {account.description && (
                <div className="px-6 py-3 bg-muted/30 border-b border-border">
                  <p className="text-xs text-muted-foreground leading-relaxed">{account.description}</p>
                </div>
              )}

              {/* Account Details */}
              <div className="px-6 pt-4 pb-1">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Account Details</h3>
                </div>
                <div className="rounded-xl border border-border overflow-hidden bg-card">
                  <DetailRow label="Account Code" value={account.code} mono />
                  <DetailRow label="Account Name" value={account.name} />
                  <DetailRow label="Type" value={
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>{account.account_type}</span>
                  } />
                  <DetailRow label="Subtype" value={account.account_subtype} />
                  <DetailRow label="Currency" value={account.currency || 'INR'} mono />
                  <DetailRow label="Opening Balance" value={
                    <span className="font-mono">{fmtCcy(account.opening_balance ?? 0, account.currency)}</span>
                  } />
                  <DetailRow label="Reconcilable" value={
                    account.is_reconcilable
                      ? <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Yes</span>
                      : <span className="text-muted-foreground">No</span>
                  } />
                  <DetailRow label="Reconciliation Account" value={
                    account.is_reconciliation_account
                      ? (
                        <span className="flex items-center gap-1.5">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 font-semibold">
                            Yes — {account.reconciliation_subledger ?? 'subledger'} control
                          </span>
                        </span>
                      )
                      : <span className="text-muted-foreground">No</span>
                  } />
                  <DetailRow label="Parent Account" value={
                    parent
                      ? <span className="flex items-center gap-1.5">
                          <span className="font-mono text-muted-foreground text-xs">{parent.code}</span>
                          <span>{parent.name}</span>
                        </span>
                      : <span className="text-muted-foreground italic">Root account</span>
                  } />
                </div>
              </div>

              {/* Reporting */}
              <div className="px-6 pt-3 pb-1">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart2 className="w-3.5 h-3.5 text-indigo-500" />
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Reporting</h3>
                </div>
                <div className="rounded-xl border border-border overflow-hidden bg-card">
                  <DetailRow label="Financial Statement" value={
                    <span className="flex items-center gap-1.5">
                      {cfg?.statement === 'Balance Sheet'
                        ? <Activity className="w-3 h-3 text-blue-500" />
                        : <TrendingUp className="w-3 h-3 text-green-500" />}
                      {statLabel}
                    </span>
                  } />
                  <DetailRow label="Normal Balance" value={
                    <span className="flex items-center gap-1.5">
                      {normBal === 'Debit'
                        ? <TrendingDown className="w-3 h-3 text-orange-500" />
                        : <TrendingUp className="w-3 h-3 text-blue-500" />}
                      {normBal}
                    </span>
                  } />
                  <DetailRow label="Code Range" value={cfg ? `${cfg.codeRangeStart} – ${cfg.codeRangeEnd}` : '—'} mono />
                  <DetailRow label="Position in Range" value={
                    cfg && !isNaN(Number(account.code))
                      ? `${Math.round(((Number(account.code) - cfg.codeRangeStart) / (cfg.codeRangeEnd - cfg.codeRangeStart)) * 100)}% of range`
                      : '—'
                  } />
                  <DetailRow label="Accounts in Type" value={`${sameTypeAccounts} total`} />
                  <DetailRow label="Direct Sub-accounts" value={String(childAccounts.length)} />
                </div>
              </div>

              {/* Classification tags */}
              <div className="px-6 pt-3 pb-1">
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="w-3.5 h-3.5 text-indigo-500" />
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Classification</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${badgeClass}`}>{account.account_type}</span>
                  {account.account_subtype && (
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-muted text-muted-foreground">{account.account_subtype}</span>
                  )}
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${normBal === 'Debit' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                    {normBal} Normal
                  </span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    cfg?.statement === 'Balance Sheet' ? 'bg-accent text-primary'
                      : cfg?.statement === 'Income Statement' ? 'bg-green-50 text-green-700'
                      : 'bg-muted/30 text-muted-foreground'
                  }`}>
                    {cfg?.statement === 'Balance Sheet' ? 'Balance Sheet' : cfg?.statement === 'Income Statement' ? 'P&L' : 'None'}
                  </span>
                  {account.is_reconcilable && <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-teal-50 text-teal-700">Reconcilable</span>}
                  {account.is_reconciliation_account && (
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                      Recon – {account.reconciliation_subledger ?? 'control'}
                    </span>
                  )}
                  {account.is_system && <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-muted text-muted-foreground">System</span>}
                </div>
              </div>

              {/* Sub-accounts */}
              {childAccounts.length > 0 && (
                <div className="px-6 pt-3 pb-1">
                  <div className="flex items-center gap-2 mb-3">
                    <ChevronRight className="w-3.5 h-3.5 text-indigo-500" />
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Sub-Accounts ({childAccounts.length})</h3>
                  </div>
                  <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                    {childAccounts.map(ch => {
                      const chCfg = config.find(c => c.type === ch.account_type)
                      return (
                        <div key={ch.id} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/30">
                          <span className="font-mono text-xs text-muted-foreground w-14">{ch.code}</span>
                          <span className="flex-1 text-xs text-foreground">{ch.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${chCfg?.color ?? 'bg-muted text-muted-foreground'}`}>
                            {ch.account_subtype || ch.account_type}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Sibling accounts */}
              {siblings.length > 0 && (
                <div className="px-6 pt-3 pb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-3.5 h-3.5 text-indigo-500" />
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Related Accounts</h3>
                  </div>
                  <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                    {siblings.map(sib => (
                      <div key={sib.id} className="flex items-center gap-3 px-4 py-2 text-xs text-muted-foreground">
                        <span className="font-mono text-muted-foreground w-14">{sib.code}</span>
                        <span className="flex-1">{sib.name}</span>
                      </div>
                    ))}
                    {siblings.length === 5 && <p className="px-4 py-1.5 text-xs text-muted-foreground italic">…and more</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ TRANSACTIONS / LEDGER TAB ══ */}
          {tab === 'transactions' && (
            <div className="flex flex-col h-full">
              {/* Date range + actions bar */}
              <div className="px-6 py-3 bg-muted/30 border-b border-border flex items-center gap-3 flex-wrap shrink-0">
                <CalendarDays className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">From</label>
                  <input
                    type="date" value={fromDate}
                    onChange={e => setFromDate(e.target.value)}
                    className="border border-input rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">To</label>
                  <input
                    type="date" value={toDate}
                    onChange={e => setToDate(e.target.value)}
                    className="border border-input rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground"
                  />
                </div>
                <button
                  onClick={() => refetchLedger()}
                  className="flex items-center gap-1 px-2.5 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:bg-card"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
                <div className="flex-1" />
                <button
                  onClick={exportCSV}
                  disabled={ledger.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-lg text-xs text-muted-foreground hover:bg-muted/30 disabled:opacity-40"
                >
                  <Download className="w-3 h-3" /> Export CSV
                </button>
              </div>

              {/* Summary KPI row */}
              {ledger.length > 0 && (
                <div className="px-6 py-3 grid grid-cols-3 gap-3 border-b border-border shrink-0">
                  <div className="rounded-xl border border-border bg-card p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <ArrowUpRight className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Total Debit</span>
                    </div>
                    <p className="font-mono font-bold text-sm text-foreground">{fmtCcy(totalDebit)}</p>
                    <p className="text-xs text-muted-foreground">{ledger.filter(r => r.debit > 0).length} entries</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <ArrowDownLeft className="w-3.5 h-3.5 text-primary/80" />
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Total Credit</span>
                    </div>
                    <p className="font-mono font-bold text-sm text-foreground">{fmtCcy(totalCredit)}</p>
                    <p className="text-xs text-muted-foreground">{ledger.filter(r => r.credit > 0).length} entries</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Activity className="w-3.5 h-3.5 text-green-500" />
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Closing Bal.</span>
                    </div>
                    <p className={`font-mono font-bold text-sm ${closingBalance >= 0 ? 'text-foreground' : 'text-red-600'}`}>
                      {fmtCcy(Math.abs(closingBalance))}
                      {closingBalance < 0 && <span className="text-xs ml-1 text-red-400">Cr</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{ledger.length} transactions</p>
                  </div>
                </div>
              )}

              {/* Transactions table */}
              <div className="flex-1 overflow-auto">
                {ledgerLoading ? (
                  <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading transactions…
                  </div>
                ) : ledger.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                    <List className="w-8 h-8 opacity-30" />
                    <p className="text-sm">No posted transactions in this period</p>
                    <p className="text-xs">Adjust the date range or post journal entries to this account</p>
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-muted/30 border-b border-border sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap"><TableColumnLabel>Date</TableColumnLabel></th>
                        <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap"><TableColumnLabel>Entry No</TableColumnLabel></th>
                        <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide"><TableColumnLabel>Narration</TableColumnLabel></th>
                        <th className="px-3 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap"><TableColumnLabel>Source</TableColumnLabel></th>
                        <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap"><TableColumnLabel>Debit</TableColumnLabel></th>
                        <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap"><TableColumnLabel>Credit</TableColumnLabel></th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap"><TableColumnLabel>Balance</TableColumnLabel></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {ledger.map((row, i) => (
                        <tr key={i} className={`hover:bg-primary/10/30 transition-colors ${row.debit > 0 ? '' : 'bg-accent/20'}`}>
                          <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap font-mono text-xs">{row.date}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="font-mono font-semibold text-primary">{row.entry_no}</span>
                          </td>
                          <td className="px-3 py-2.5 text-foreground max-w-[160px]">
                            <span className="line-clamp-2 leading-snug">{row.narration || '—'}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground whitespace-nowrap">
                              {SOURCE_LABELS[row.source_type] || row.source_type}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono">
                            {row.debit > 0
                              ? <span className="text-foreground font-medium">{fmtCcy(row.debit)}</span>
                              : <span className="text-muted-foreground/50">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono">
                            {row.credit > 0
                              ? <span className="text-foreground font-medium">{fmtCcy(row.credit)}</span>
                              : <span className="text-muted-foreground/50">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono whitespace-nowrap">
                            <span className={row.balance < 0 ? 'text-red-600' : 'text-foreground'}>
                              {fmtCcy(Math.abs(row.balance))}
                              {row.balance < 0 && <span className="text-xs ml-0.5 text-red-400">Cr</span>}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {/* Totals footer */}
                    <tfoot className="bg-muted/30 border-t-2 border-border sticky bottom-0">
                      <tr>
                        <td colSpan={4} className="px-4 py-2.5 text-xs font-bold text-foreground text-right">Totals</td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-foreground">{fmtCcy(totalDebit)}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-foreground">{fmtCcy(totalCredit)}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold">
                          <span className={closingBalance < 0 ? 'text-red-600' : 'text-foreground'}>
                            {fmtCcy(Math.abs(closingBalance))}
                            {closingBalance < 0 && <span className="text-xs ml-0.5">Cr</span>}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Configuration panel ──────────────────────────────────────────────────────
function ConfigPanel({
  config, onChange, onClose,
}: {
  config: AccountTypeConfig[]
  onChange: (cfg: AccountTypeConfig[]) => void
  onClose: () => void
}) {
  const [local, setLocal] = useState<AccountTypeConfig[]>(JSON.parse(JSON.stringify(config)))
  const [expandedType, setExpandedType] = useState<string | null>(local[0]?.type ?? null)

  const update = (type: string, patch: Partial<AccountTypeConfig>) => {
    setLocal(prev => prev.map(c => c.type === type ? { ...c, ...patch } : c))
  }

  const addSubtype = (type: string) => {
    const cfg = local.find(c => c.type === type)
    if (!cfg) return
    update(type, { subtypes: [...cfg.subtypes, ''] })
  }

  const updateSubtype = (type: string, idx: number, value: string) => {
    const cfg = local.find(c => c.type === type)
    if (!cfg) return
    const next = [...cfg.subtypes]
    next[idx] = value
    update(type, { subtypes: next })
  }

  const removeSubtype = (type: string, idx: number) => {
    const cfg = local.find(c => c.type === type)
    if (!cfg) return
    update(type, { subtypes: cfg.subtypes.filter((_, i) => i !== idx) })
  }

  const moveSubtype = (type: string, from: number, to: number) => {
    const cfg = local.find(c => c.type === type)
    if (!cfg) return
    const arr = [...cfg.subtypes]
    const [item] = arr.splice(from, 1)
    arr.splice(to, 0, item)
    update(type, { subtypes: arr })
  }

  // ── Overlap detection ─────────────────────────────────────────────────────
  const overlapErrors = useMemo(() => {
    const errors: Record<string, string> = {}
    for (let i = 0; i < local.length; i++) {
      const a = local[i]
      if (a.codeRangeStart >= a.codeRangeEnd) {
        errors[a.type] = 'Start must be less than End'
        continue
      }
      for (let j = 0; j < local.length; j++) {
        if (i === j) continue
        const b = local[j]
        const overlaps = a.codeRangeStart <= b.codeRangeEnd && a.codeRangeEnd >= b.codeRangeStart
        if (overlaps) {
          errors[a.type] = `Overlaps with ${b.type} (${b.codeRangeStart}–${b.codeRangeEnd})`
        }
      }
    }
    return errors
  }, [local])

  const hasErrors = Object.keys(overlapErrors).length > 0

  const handleSave = () => {
    if (hasErrors) return
    onChange(local)
    onClose()
  }
  const handleReset = () => { setLocal(JSON.parse(JSON.stringify(DEFAULT_CONFIG))) }

  return (
    <div data-kiterp-modal className="fixed inset-0 z-[100] flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="w-full max-w-xl bg-card border-l border-border text-foreground h-full shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            <div>
              <h2 className="font-semibold text-foreground">Account Type Configuration</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Define subtypes, code ranges and accounting rules per type</p>
            </div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1.5 text-muted-foreground hover:text-muted-foreground rounded-lg hover:bg-muted/50">
                <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">

          {/* Info banner */}
          <div className="flex items-start gap-2.5 p-3 bg-primary/10 rounded-xl border border-primary/20">
            <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <p className="text-xs text-primary leading-snug">
              Configuration is saved locally. Changes affect badge colours, available subtypes when creating
              accounts, and how types appear in the tree. Code ranges are for reference only.
            </p>
          </div>

          {local.map(cfg => {
            const isExpanded = expandedType === cfg.type
            return (
              <div key={cfg.type} className="border border-border rounded-xl overflow-hidden">
                {/* Type header row */}
                <button
                  onClick={() => setExpandedType(isExpanded ? null : cfg.type)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors ${overlapErrors[cfg.type] ? 'bg-red-50 hover:bg-red-50' : ''}`}
                >
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
                    {cfg.type}
                  </span>
                  <span className="flex-1 text-xs text-muted-foreground">
                    {cfg.codeRangeStart}–{cfg.codeRangeEnd} &nbsp;·&nbsp; {cfg.normalBalance} &nbsp;·&nbsp; {cfg.statement}
                  </span>
                  {overlapErrors[cfg.type] && (
                    <span className="text-xs text-red-600 font-medium bg-red-100 px-2 py-0.5 rounded-full shrink-0 max-w-[160px] truncate">
                      ⚠ {overlapErrors[cfg.type]}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{cfg.subtypes.length} subtypes</span>
                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-border space-y-4">

                    {/* Range overlap error banner */}
                    {overlapErrors[cfg.type] && (
                      <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                        <span className="text-red-500 text-sm shrink-0">⚠</span>
                        <p className="text-xs text-red-700 leading-snug">
                          <strong>Range conflict:</strong> {overlapErrors[cfg.type]}. Each account type must have a unique, non-overlapping code range.
                        </p>
                      </div>
                    )}

                    {/* Row 1: code range + normal balance + statement */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Code Range Start</label>
                        <input
                          type="number"
                          value={cfg.codeRangeStart}
                          onChange={e => update(cfg.type, { codeRangeStart: Number(e.target.value) })}
                          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${overlapErrors[cfg.type] ? 'border-red-300 focus:ring-red-300 bg-red-50' : 'border-border focus:ring-primary'}`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Code Range End</label>
                        <input
                          type="number"
                          value={cfg.codeRangeEnd}
                          onChange={e => update(cfg.type, { codeRangeEnd: Number(e.target.value) })}
                          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${overlapErrors[cfg.type] ? 'border-red-300 focus:ring-red-300 bg-red-50' : 'border-border focus:ring-primary'}`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Normal Balance</label>
                        <select
                          value={cfg.normalBalance}
                          onChange={e => update(cfg.type, { normalBalance: e.target.value as NormalBalance })}
                          className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option>Debit</option>
                          <option>Credit</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Financial Statement</label>
                        <select
                          value={cfg.statement}
                          onChange={e => update(cfg.type, { statement: e.target.value as Statement })}
                          className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option>Balance Sheet</option>
                          <option>Income Statement</option>
                          <option>None</option>
                        </select>
                      </div>
                    </div>

                    {/* Badge colour */}
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Badge Colour</label>
                      <div className="flex flex-wrap gap-2">
                        {BADGE_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => update(cfg.type, { color: opt.value })}
                            className={`text-xs px-2.5 py-1 rounded-full font-medium border-2 transition-all ${opt.value} ${cfg.color === opt.value ? 'border-foreground scale-110' : 'border-transparent'}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Subtypes */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subtypes</Label>
                        <button
                          onClick={() => addSubtype(cfg.type)}
                          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium"
                        >
                          <PlusCircle className="w-3.5 h-3.5" /> Add subtype
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {cfg.subtypes.length === 0 && (
                          <p className="text-xs text-muted-foreground italic">No subtypes defined. Add one above.</p>
                        )}
                        {cfg.subtypes.map((st, idx) => (
                          <div key={idx} className="flex items-center gap-2 group">
                            <div className="flex flex-col gap-0.5">
                              <button
                                onClick={() => idx > 0 && moveSubtype(cfg.type, idx, idx - 1)}
                                disabled={idx === 0}
                                className="p-0.5 text-muted-foreground/50 hover:text-muted-foreground disabled:opacity-20"
                              >
                                <ChevronUp className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => idx < cfg.subtypes.length - 1 && moveSubtype(cfg.type, idx, idx + 1)}
                                disabled={idx === cfg.subtypes.length - 1}
                                className="p-0.5 text-muted-foreground/50 hover:text-muted-foreground disabled:opacity-20"
                              >
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            </div>
                            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50" />
                            <input
                              value={st}
                              onChange={e => updateSubtype(cfg.type, idx, e.target.value)}
                              className="flex-1 border border-border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              placeholder="Subtype name"
                            />
                            <button
                              onClick={() => removeSubtype(cfg.type, idx)}
                              className="p-1 text-muted-foreground/50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-muted/30 space-y-3">
          {hasErrors && (
            <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
              <span className="text-red-500 text-sm">⚠</span>
              <p className="text-xs text-red-700">
                Fix all range conflicts before saving. Each account type must have a unique, non-overlapping code range.
              </p>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={handleReset}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Reset to defaults
            </button>
            <div className="flex gap-2">
              <button onClick={onClose} className="btn-cancel px-4 py-2 text-sm border border-border rounded-lg text-muted-foreground">Cancel</button>
              <button
                onClick={handleSave}
                disabled={hasErrors}
                title={hasErrors ? 'Fix range conflicts first' : undefined}
                className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${
                  hasErrors
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'bg-primary text-white hover:bg-primary/90'
                }`}
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
const BLANK = {
  code: '', name: '', account_type: 'Asset', account_subtype: '', description: '',
  is_reconciliation_account: false, reconciliation_subledger: '',
}

export default function ChartOfAccounts() {
  const { data: accounts = [], isLoading } = useAccounts()
  const createMut = useCreateAccount()
  const updateMut = useUpdateAccount()
  const seedMut = useSeedCOA()

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('All')
  const [subtypeFilter, setSubtypeFilter] = useState<string>('All')
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All')
  const [statementFilter, setStatementFilter] = useState<string>('All')
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [viewing, setViewing] = useState<Account | null>(null)
  const [form, setForm] = useState(BLANK)
  const [config, setConfig] = useState<AccountTypeConfig[]>(loadConfig)

  useEffect(() => { saveConfig(config) }, [config])

  const openNew = () => { setEditing(null); setForm(BLANK); setShowModal(true) }
  const openEdit = (a: Account) => {
    setEditing(a)
    setForm({
      code: a.code, name: a.name, account_type: a.account_type,
      account_subtype: a.account_subtype || '', description: (a as any).description || '',
      is_reconciliation_account: a.is_reconciliation_account ?? false,
      reconciliation_subledger: a.reconciliation_subledger ?? '',
    })
    setShowModal(true)
  }
  const openView = (a: Account) => setViewing(a)

  useEscapeToClose(() => setShowModal(false), showModal)

  const save = () => {
    if (editing) {
      updateMut.mutate({ id: editing.id, data: form }, { onSuccess: () => setShowModal(false) })
    } else {
      createMut.mutate(form, { onSuccess: () => setShowModal(false) })
    }
  }

  const allAccounts = accounts as Account[]

  // Collect available subtypes for the selected type
  const availableSubtypes = useMemo(() => {
    const base = config.find(c => c.type === typeFilter)?.subtypes ?? []
    const live = [...new Set(allAccounts.filter(a => typeFilter === 'All' || a.account_type === typeFilter).map(a => a.account_subtype).filter(Boolean))]
    return [...new Set([...base, ...live])]
  }, [typeFilter, allAccounts, config])

  const filtered = useMemo(() => allAccounts
    .filter(a => typeFilter === 'All' || a.account_type === typeFilter)
    .filter(a => subtypeFilter === 'All' || a.account_subtype === subtypeFilter)
    .filter(a => statusFilter === 'All' || (statusFilter === 'Active' ? a.is_active : !a.is_active))
    .filter(a => {
      if (statementFilter === 'All') return true
      const cfg = config.find(c => c.type === a.account_type)
      return statementFilter === 'BS' ? cfg?.statement === 'Balance Sheet'
        : statementFilter === 'PL' ? cfg?.statement === 'Income Statement'
        : true
    })
    .filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.code.includes(search))
  , [allAccounts, typeFilter, subtypeFilter, statusFilter, statementFilter, search, config])

  const { roots, children } = buildTree(filtered)

  // Count active non-default filters
  const activeFilters = [
    subtypeFilter !== 'All', statusFilter !== 'All', statementFilter !== 'All'
  ].filter(Boolean).length

  // Summary counts per type
  const typeCounts = config.map(c => ({
    ...c,
    count: allAccounts.filter(a => a.account_type === c.type).length,
  }))

  const activeSubtypes = config.find(c => c.type === form.account_type)?.subtypes ?? []

  return (
    <div className="p-6 space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Chart of Accounts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{allAccounts.length} accounts · {filtered.length} shown</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowConfig(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted/30"
          >
            <Settings2 className="w-4 h-4" /> Configure
          </button>
          <button
            onClick={() => seedMut.mutate(undefined)} disabled={seedMut.isPending}
            className="px-3 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted/30 disabled:opacity-50"
          >
            {seedMut.isPending ? 'Seeding…' : 'Seed Default COA'}
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 font-medium"
          >
            <Plus className="w-4 h-4" /> Add Account
          </button>
        </div>
      </div>

      {/* ── Type summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {typeCounts.map(c => (
          <button
            key={c.type}
            onClick={() => { setTypeFilter(typeFilter === c.type ? 'All' : c.type); setSubtypeFilter('All') }}
            className={`rounded-xl border p-3 text-left transition-all ${
              typeFilter === c.type
                ? 'border-primary/60 bg-primary/10 shadow-sm'
                : 'border-border bg-card hover:border-border hover:bg-muted/30'
            }`}
          >
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.color}`}>{c.type}</span>
            <p className="mt-2 text-xl font-bold text-foreground">{c.count}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{c.codeRangeStart}–{c.codeRangeEnd}</p>
            <p className="text-xs text-muted-foreground">{c.normalBalance} · {c.statement === 'Balance Sheet' ? 'BS' : c.statement === 'Income Statement' ? 'P&L' : '—'}</p>
          </button>
        ))}
      </div>

      {/* ── Search + filter bar ── */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap">
          <div className="flex-1 min-w-48 relative">
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or code…"
              className="pr-8 bg-background"
            />
            {search && (
              <button type="button" aria-label="Close" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-[1]">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {/* Type quick filters */}
          <div className="flex gap-1 flex-wrap">
            {['All', ...config.map(c => c.type)].map(t => (
              <button
                key={t}
                onClick={() => { setTypeFilter(t); setSubtypeFilter('All') }}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  typeFilter === t
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/35'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {/* Advanced filter toggle */}
          <button
            onClick={() => setShowAdvancedFilter(x => !x)}
            className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm transition-colors ${
              showAdvancedFilter || activeFilters > 0
                ? 'border-primary/60 bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:bg-muted/30'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFilters > 0 && (
              <span className="bg-primary text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {/* Advanced filter row */}
        {showAdvancedFilter && (
          <div className="flex gap-3 flex-wrap items-center p-3 bg-muted/30 rounded-xl border border-border">
            <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />

            {/* Subtype */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Subtype</label>
              <select
                value={subtypeFilter}
                onChange={e => setSubtypeFilter(e.target.value)}
                className="border border-input rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground"
              >
                <option value="All">All subtypes</option>
                {availableSubtypes.map(st => <option key={st} value={st}>{st}</option>)}
              </select>
            </div>

            {/* Status */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground">Status</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="border border-input rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground"
              >
                <option value="All">All</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            {/* Financial statement */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Statement</label>
              <select
                value={statementFilter}
                onChange={e => setStatementFilter(e.target.value)}
                className="border border-input rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground"
              >
                <option value="All">All</option>
                <option value="BS">Balance Sheet</option>
                <option value="PL">Income Statement (P&L)</option>
              </select>
            </div>

            {activeFilters > 0 && (
              <button
                onClick={() => { setSubtypeFilter('All'); setStatusFilter('All'); setStatementFilter('All') }}
                className="text-xs text-red-500 hover:text-red-700 ml-auto"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Account tree ── */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Column headers */}
        <div className="grid text-xs font-medium text-muted-foreground uppercase tracking-wide px-3 py-2 bg-muted/30 border-b border-border"
          style={{ gridTemplateColumns: '20px 56px 1fr auto auto auto' }}>
          <span />
          <span>Code</span>
          <span>Name</span>
          <span className="hidden sm:block pr-4">Subtype</span>
          <span>Type</span>
          <span className="w-16" />
        </div>
        <div className="p-2">
          {isLoading
            ? <p className="text-sm text-muted-foreground p-4">Loading…</p>
            : filtered.length === 0
              ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">
                    {allAccounts.length === 0
                      ? 'No accounts yet. Seed the default COA or add accounts manually.'
                      : 'No accounts match your filters.'}
                  </p>
                  {activeFilters > 0 && (
                    <button
                      onClick={() => { setSubtypeFilter('All'); setStatusFilter('All'); setStatementFilter('All'); setSearch('') }}
                      className="mt-2 text-xs text-primary hover:underline"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              )
              : renderTree(roots, children, openEdit, openView, config)}
        </div>
      </div>

      {/* ── Add / Edit modal ── */}
      {showModal && (
        <div data-kiterp-modal className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={() => setShowModal(false)}>
          <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">{editing ? 'Edit Account' : 'New Account'}</h2>
              <button type="button" aria-label="Close" onClick={() => setShowModal(false)} className="p-1 text-muted-foreground hover:text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Type first — drives subtype list */}
            <div>
              <Label className="block text-xs font-medium text-muted-foreground mb-1">Type</Label>
              <div className="grid grid-cols-5 gap-1">
                {config.map(c => (
                  <button
                    key={c.type}
                    onClick={() => setForm(f => ({ ...f, account_type: c.type, account_subtype: '' }))}
                    className={`py-1.5 rounded-lg text-xs font-medium border-2 transition-all ${c.color} ${
                      form.account_type === c.type ? 'border-foreground' : 'border-transparent'
                    }`}
                  >
                    {c.type}
                  </button>
                ))}
              </div>
            </div>

            {/* Subtype dropdown — options come from config */}
            <div>
              <Label className="block text-xs font-medium text-muted-foreground mb-1">Subtype</Label>
              <select
                value={form.account_subtype}
                onChange={e => setForm(f => ({ ...f, account_subtype: e.target.value }))}
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— None —</option>
                {activeSubtypes.map(st => <option key={st} value={st}>{st}</option>)}
              </select>
            </div>

            {/* Code + Name */}
            {[
              { label: 'Code', key: 'code', placeholder: `e.g. ${config.find(c => c.type === form.account_type)?.codeRangeStart ?? 1000}` },
              { label: 'Name', key: 'name', placeholder: 'Account name' },
              { label: 'Description', key: 'description', placeholder: 'Optional description' },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <Label className="block text-xs font-medium text-muted-foreground mb-1">{label}</Label>
                <input
                  value={(form as Record<string, string>)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            ))}

            {/* Code range hint */}
            {(() => {
              const c = config.find(cc => cc.type === form.account_type)
              return c ? (
                <p className="text-xs text-muted-foreground">
                  Suggested range for <strong>{c.type}</strong>: {c.codeRangeStart}–{c.codeRangeEnd} · Normal balance: {c.normalBalance}
                </p>
              ) : null
            })()}

            {/* Reconciliation account toggle */}
            <div className="rounded-xl border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-foreground">Reconciliation (Control) Account</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    When enabled, manual journal entries cannot post to this account.
                    Only subledger auto-posting (AR, AP, Assets) may write to it.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({
                    ...f,
                    is_reconciliation_account: !(f as any).is_reconciliation_account,
                    reconciliation_subledger: (f as any).is_reconciliation_account ? '' : (f as any).reconciliation_subledger,
                  }))}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    (form as any).is_reconciliation_account ? 'bg-violet-600' : 'bg-muted'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                    (form as any).is_reconciliation_account ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
              </div>
              {(form as any).is_reconciliation_account && (
                <div>
                  <Label className="block text-xs font-medium text-muted-foreground mb-1">Subledger</Label>
                  <select
                    value={(form as any).reconciliation_subledger || ''}
                    onChange={e => setForm(f => ({ ...f, reconciliation_subledger: e.target.value }))}
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">— Select subledger —</option>
                    <option value="customer">Customer (AR)</option>
                    <option value="supplier">Supplier (AP)</option>
                    <option value="asset">Fixed Asset</option>
                    <option value="bank">Bank / Cash</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowModal(false)} className="btn-cancel px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg">
                Cancel
              </button>
              <button
                onClick={save}
                disabled={createMut.isPending || updateMut.isPending}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 font-medium"
              >
                {createMut.isPending || updateMut.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Account detail drawer ── */}
      {viewing && (
        <AccountDetailDrawer
          account={viewing}
          allAccounts={allAccounts}
          config={config}
          onClose={() => setViewing(null)}
          onEdit={a => { setViewing(null); openEdit(a) }}
        />
      )}

      {/* ── Configuration drawer ── */}
      {showConfig && (
        <ConfigPanel
          config={config}
          onChange={cfg => { setConfig(cfg); saveConfig(cfg) }}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  )
}
