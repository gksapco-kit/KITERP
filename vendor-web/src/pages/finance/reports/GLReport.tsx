import { useState, useMemo, useCallback } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import {
  useAccountLedger, usePartyLedger, useCostCenterLedger, useLedgerSummary,
  useCompanies, useCostCenters,
} from '@/hooks/useFinance'
import * as finApi from '@/api/finance'
import { useAccounts } from '@/hooks/useFinance'
import {
  Search, Download, RefreshCw, CalendarDays, Filter,
  BookOpen, Users, User, Building2, Briefcase, Layers,
  ArrowUpRight, ArrowDownLeft, Activity, TrendingUp,
  ChevronDown, X, BarChart3, List, SlidersHorizontal,
  FileText, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Select } from '@/components/ui/select'
import * as api from '@/api/client'
import axios from '@/lib/axios'

// ─── Types ───────────────────────────────────────────────────────────────────
interface LedgerRow {
  date: string
  entry_no: string
  account_code?: string
  account_name?: string
  account_type?: string
  narration: string
  debit: number
  credit: number
  balance: number
  source_type: string
  source_id?: string
  ref_doc_type?: string
  ref_doc_no?: string
}

interface MasterRecord {
  id: string
  code?: string
  name: string
  label?: string
}

// ─── Dimension definitions ────────────────────────────────────────────────────
type DimId = 'gl_account' | 'customer' | 'supplier' | 'employee' | 'contractor' | 'freelancer' | 'cost_center'

interface Dimension {
  id: DimId
  label: string
  icon: React.ElementType
  partyType?: string          // maps to FinJournalLine.party_type
  color: string
  description: string
}

const DIMENSIONS: Dimension[] = [
  {
    id: 'gl_account',
    label: 'GL Account',
    icon: BookOpen,
    color: 'bg-primary/15 text-primary border-primary/30',
    description: 'All posted lines by general ledger account code',
  },
  {
    id: 'customer',
    label: 'Customer',
    icon: Users,
    partyType: 'customer',
    color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
    description: 'Receivables and revenue lines by customer',
  },
  {
    id: 'supplier',
    label: 'Supplier / Vendor',
    icon: Briefcase,
    partyType: 'supplier',
    color: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30',
    description: 'Payables and expense lines by supplier',
  },
  {
    id: 'employee',
    label: 'Employee',
    icon: User,
    partyType: 'employee',
    color: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30',
    description: 'Payroll, salary, and expense reimbursement lines by employee',
  },
  {
    id: 'contractor',
    label: 'Contractor',
    icon: FileText,
    partyType: 'contractor',
    color: 'bg-primary/12 text-primary border-primary/30',
    description: 'Lines posted against contract workers',
  },
  {
    id: 'freelancer',
    label: 'Freelancer',
    icon: Activity,
    partyType: 'freelancer',
    color: 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-500/15 dark:text-pink-300 dark:border-pink-500/30',
    description: 'Lines posted against freelance engagements',
  },
  {
    id: 'cost_center',
    label: 'Cost Centre',
    icon: Layers,
    color: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30',
    description: 'All posted lines for a profit / cost centre',
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
const SOURCE_LABELS: Record<string, string> = {
  invoice: 'Invoice', payment: 'Payment', pos: 'POS', vendor_bill: 'Bill',
  vendor_payment: 'Vendor Pay', payroll: 'Payroll', expense: 'Expense',
  asset: 'Asset', depreciation: 'Depreciation', disposal: 'Disposal',
  loan: 'Loan', investment: 'Investment', manual: 'Manual',
  opening: 'Opening', closing: 'Closing', fx: 'FX Reval',
}

const TYPE_COLORS: Record<string, string> = {
  Asset: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  Liability: 'bg-red-500/15 text-red-700 dark:text-red-300',
  Equity: 'bg-primary/15 text-primary',
  Income: 'bg-green-500/15 text-green-700 dark:text-green-300',
  Expense: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
}

const filterControlClass =
  'h-10 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring [color-scheme:dark]'

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function today() { return new Date().toISOString().slice(0, 10) }
function fyStart() {
  const d = new Date()
  // Indian FY: April 1
  const year = d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear()
  return `${year}-04-01`
}

// ─── Master record search box ─────────────────────────────────────────────────
function MasterSearch({
  dim, onSelect, selected,
}: {
  dim: Dimension
  onSelect: (r: MasterRecord | null) => void
  selected: MasterRecord | null
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<MasterRecord[]>([])
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (query: string) => {
    if (!query && dim.id !== 'gl_account') { setResults([]); return }
    setLoading(true)
    try {
      if (dim.id === 'gl_account') {
        const data = await finApi.searchAccounts({ q: query, limit: 20 })
        setResults(data.map((a: any) => ({ id: a.id, code: a.code, name: a.name, label: `${a.code} · ${a.name}` })))
      } else if (dim.id === 'customer') {
        const res = await axios.get('/vendors/me/customers', { params: { q: query, limit: 20 } })
        const list = res.data?.items ?? res.data ?? []
        setResults(list.map((c: any) => ({ id: c.id, name: c.name || c.email, label: c.name || c.email })))
      } else if (dim.id === 'supplier') {
        const res = await axios.get('/vendors/me/procurement/suppliers', { params: { q: query, limit: 20 } })
        const list = res.data?.items ?? res.data ?? []
        setResults(list.map((s: any) => ({ id: s.id, name: s.name, label: s.name })))
      } else if (dim.id === 'employee') {
        const res = await axios.get('/vendors/me/hr/employees', { params: { q: query, limit: 20 } })
        const list = res.data?.items ?? res.data ?? []
        setResults(list.map((e: any) => ({
          id: e.id,
          name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || e.employee_id,
          code: e.employee_id,
          label: `${e.employee_id} · ${e.first_name || ''} ${e.last_name || ''}`.trim(),
        })))
      } else {
        // contractor / freelancer — party lookup via journal lines
        setResults([])
      }
    } catch { setResults([]) }
    setLoading(false)
  }, [dim.id])

  const handleInput = (val: string) => {
    setQ(val)
    if (selected) { onSelect(null) }
    setOpen(true)
    const t = setTimeout(() => search(val), 250)
    return () => clearTimeout(t)
  }

  const select = (r: MasterRecord) => {
    onSelect(r); setQ(r.label || r.name); setOpen(false)
  }

  if (dim.id === 'contractor' || dim.id === 'freelancer') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        <AlertCircle className="h-4 w-4 shrink-0" />
        Enter the party ID directly — contractor/freelancer records are posted manually via journal entries.
        <input
          placeholder="Paste party UUID…"
          className={cn(filterControlClass, 'ml-2 min-w-0 flex-1')}
          onChange={e => {
            const v = e.target.value.trim()
            if (v.length === 36) onSelect({ id: v, name: v })
          }}
        />
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={selected ? (selected.label || selected.name) : q}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => { setOpen(true); if (!results.length) search(q) }}
          placeholder={`Search ${dim.label}…`}
          className={cn(filterControlClass, 'w-full rounded-xl pl-9 pr-9 text-sm')}
        />
        {(selected || q) && (
          <button onClick={() => { onSelect(null); setQ(''); setResults([]) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {open && !selected && (results.length > 0 || loading) && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl max-h-56 overflow-y-auto">
          {loading && <p className="px-4 py-3 text-xs text-muted-foreground">Searching…</p>}
          {results.map(r => (
            <button
              key={r.id}
              onClick={() => select(r)}
              className="flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left transition-colors last:border-0 hover:bg-accent"
            >
              {r.code && <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{r.code}</span>}
              <span className="flex-1 text-sm text-foreground">{r.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPI({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string
  icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', color)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className="font-mono font-bold text-xl text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Ledger Table ─────────────────────────────────────────────────────────────
function LedgerTable({
  rows, showAccount, isLoading,
}: {
  rows: LedgerRow[]
  showAccount: boolean
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-500 text-sm gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Loading transactions…
      </div>
    )
  }
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
        <List className="w-10 h-10 opacity-20" />
        <p className="text-sm font-medium">No posted transactions found</p>
        <p className="text-xs">Try adjusting the date range or selecting a different record</p>
      </div>
    )
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-xs whitespace-nowrap">
        <thead className="bg-muted border-b border-border sticky top-0 z-10">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"><TableColumnLabel>Date</TableColumnLabel></th>
            <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"><TableColumnLabel>Entry No</TableColumnLabel></th>
            {showAccount && (
              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"><TableColumnLabel>Account</TableColumnLabel></th>
            )}
            <th className="max-w-[200px] px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"><TableColumnLabel>Narration</TableColumnLabel></th>
            <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"><TableColumnLabel>Ref Doc</TableColumnLabel></th>
            <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"><TableColumnLabel>Source</TableColumnLabel></th>
            <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground"><TableColumnLabel>Debit</TableColumnLabel></th>
            <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground"><TableColumnLabel>Credit</TableColumnLabel></th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground"><TableColumnLabel>Balance</TableColumnLabel></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, i) => (
            <tr
              key={i}
              className={cn(
                'group transition-colors hover:bg-muted/30',
                row.debit > 0 ? '' : 'bg-muted/15',
              )}
            >
              <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{row.date}</td>
              <td className="px-3 py-2.5">
                <span className="font-mono font-semibold text-primary">{row.entry_no}</span>
              </td>
              {showAccount && (
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs text-muted-foreground">{row.account_code}</span>
                    <span className="max-w-[120px] truncate text-foreground">{row.account_name}</span>
                    {row.account_type && (
                      <span className={cn('hidden rounded-full px-1.5 py-0.5 text-xs font-semibold group-hover:inline',
                        TYPE_COLORS[row.account_type] || 'bg-muted text-muted-foreground')}>
                        {row.account_type}
                      </span>
                    )}
                  </div>
                </td>
              )}
              <td className="max-w-[200px] px-3 py-2.5">
                <span className="line-clamp-2 whitespace-normal leading-snug text-foreground">{row.narration || '—'}</span>
              </td>
              <td className="px-3 py-2.5">
                {row.ref_doc_type
                  ? <span className="text-xs text-muted-foreground">{row.ref_doc_type}: {row.ref_doc_no || '—'}</span>
                  : <span className="text-muted-foreground/40">—</span>}
              </td>
              <td className="px-3 py-2.5 text-center">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {SOURCE_LABELS[row.source_type] || row.source_type}
                </span>
              </td>
              <td className="px-3 py-2.5 text-right font-mono">
                {row.debit > 0
                  ? <span className="font-semibold text-foreground">{fmt(row.debit)}</span>
                  : <span className="text-muted-foreground/40">—</span>}
              </td>
              <td className="px-3 py-2.5 text-right font-mono">
                {row.credit > 0
                  ? <span className="font-semibold text-foreground">{fmt(row.credit)}</span>
                  : <span className="text-muted-foreground/40">—</span>}
              </td>
              <td className="px-4 py-2.5 text-right font-mono">
                <span className={cn('font-semibold', row.balance < 0 ? 'text-destructive' : 'text-foreground')}>
                  {fmt(Math.abs(row.balance))}
                  {row.balance < 0 && <span className="ml-0.5 text-xs opacity-70">Cr</span>}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="sticky bottom-0 border-t-2 border-border bg-muted/40">
          <tr>
            <td colSpan={showAccount ? 6 : 5} className="px-4 py-3 text-right text-xs font-bold text-muted-foreground">
              Totals ({rows.length} entries)
            </td>
            <td className="px-3 py-3 text-right font-mono font-bold text-foreground">
              {fmt(rows.reduce((s, r) => s + r.debit, 0))}
            </td>
            <td className="px-3 py-3 text-right font-mono font-bold text-foreground">
              {fmt(rows.reduce((s, r) => s + r.credit, 0))}
            </td>
            <td className="px-4 py-3 text-right font-mono font-bold">
              {(() => {
                const bal = rows.length ? rows[rows.length - 1].balance : 0
                return (
                  <span className={bal < 0 ? 'text-destructive' : 'text-foreground'}>
                    {fmt(Math.abs(bal))}{bal < 0 && <span className="ml-0.5 text-xs">Cr</span>}
                  </span>
                )
              })()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── Summary Tab ─────────────────────────────────────────────────────────────
function SummaryView({ fromDate, toDate }: { fromDate: string; toDate: string }) {
  const [typeFilter, setTypeFilter] = useState('All')
  const { data: summaryData = [], isLoading } = useLedgerSummary({
    from_date: fromDate,
    to_date: toDate,
    account_type: typeFilter === 'All' ? undefined : typeFilter,
  })
  const rows = summaryData as any[]

  const totalDebit = rows.reduce((s: number, r: any) => s + r.total_debit, 0)
  const totalCredit = rows.reduce((s: number, r: any) => s + r.total_credit, 0)

  return (
    <div className="space-y-4">
      {/* Type filter pills */}
      <div className="flex gap-2 flex-wrap">
        {['All', 'Asset', 'Liability', 'Equity', 'Income', 'Expense'].map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              typeFilter === t ? 'bg-primary text-white border-primary' : 'border-gray-300 text-muted-foreground hover:bg-accent'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-gray-500 text-sm gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading summary…
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"><TableColumnLabel>Code</TableColumnLabel></th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"><TableColumnLabel>Account Name</TableColumnLabel></th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"><TableColumnLabel>Type</TableColumnLabel></th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"><TableColumnLabel>Subtype</TableColumnLabel></th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"><TableColumnLabel>Total Debit</TableColumnLabel></th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"><TableColumnLabel>Total Credit</TableColumnLabel></th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"><TableColumnLabel>Net</TableColumnLabel></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.length === 0
                ? <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No data in this period</td></tr>
                : rows.map((r: any) => (
                  <tr key={r.account_id} className="hover:bg-accent transition-colors">
                    <td className="px-4 py-2.5 font-mono text-gray-500">{r.code}</td>
                    <td className="px-3 py-2.5 text-gray-800 font-medium max-w-[200px] truncate">{r.name}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold', TYPE_COLORS[r.account_type] || 'bg-gray-100 text-gray-500')}>
                        {r.account_type}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-400">{r.account_subtype || '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{r.total_debit > 0 ? fmt(r.total_debit) : <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{r.total_credit > 0 ? fmt(r.total_credit) : <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      <span className={r.net < 0 ? 'text-red-600 font-semibold' : 'font-semibold text-gray-900'}>
                        {r.net < 0 ? `(${fmt(Math.abs(r.net))})` : fmt(r.net)}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-gray-50 border-t-2 border-gray-200 sticky bottom-0">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-xs font-bold text-gray-600 text-right">Grand Total</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-gray-900">{fmt(totalDebit)}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-gray-900">{fmt(totalCredit)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">
                    <span className={totalDebit - totalCredit < 0 ? 'text-red-600' : 'text-gray-900'}>
                      {fmt(Math.abs(totalDebit - totalCredit))}
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function GLReport() {
  const [activeDim, setActiveDim] = useState<DimId>('gl_account')
  const [selectedRecord, setSelectedRecord] = useState<MasterRecord | null>(null)
  const [fromDate, setFromDate] = useState(fyStart)
  const [toDate, setToDate] = useState(today)
  const [view, setView] = useState<'ledger' | 'summary'>('ledger')

  const dim = DIMENSIONS.find(d => d.id === activeDim)!

  // Switch dimension → clear selection
  const switchDim = (id: DimId) => { setActiveDim(id); setSelectedRecord(null) }

  // Ledger queries
  const glParams = { from_date: fromDate, to_date: toDate }
  const {
    data: glLedger = [], isLoading: glLoading, refetch: refetchGl,
  } = useAccountLedger(
    activeDim === 'gl_account' && selectedRecord ? selectedRecord.id : '',
    glParams,
  )
  const {
    data: partyLedger = [], isLoading: partyLoading, refetch: refetchParty,
  } = usePartyLedger(
    dim.partyType ?? '',
    activeDim !== 'gl_account' && activeDim !== 'cost_center' && selectedRecord ? selectedRecord.id : '',
    glParams,
  )
  const {
    data: ccLedger = [], isLoading: ccLoading, refetch: refetchCC,
  } = useCostCenterLedger(
    activeDim === 'cost_center' && selectedRecord ? selectedRecord.id : '',
    glParams,
  )

  const rows: LedgerRow[] = useMemo(() => {
    if (!selectedRecord) return []
    if (activeDim === 'gl_account') return glLedger as LedgerRow[]
    if (activeDim === 'cost_center') return ccLedger as LedgerRow[]
    return partyLedger as LedgerRow[]
  }, [activeDim, selectedRecord, glLedger, partyLedger, ccLedger])

  const isLoading = activeDim === 'gl_account' ? glLoading : activeDim === 'cost_center' ? ccLoading : partyLoading
  const refetch = activeDim === 'gl_account' ? refetchGl : activeDim === 'cost_center' ? refetchCC : refetchParty

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0)
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0)
  const closingBalance = rows.length ? rows[rows.length - 1].balance : 0

  // Show account column only for non-GL ledgers (so you can see which GL account each line hits)
  const showAccountCol = activeDim !== 'gl_account'

  const exportCSV = () => {
    const cols = ['Date', 'Entry No', ...(showAccountCol ? ['Account Code', 'Account Name'] : []),
      'Narration', 'Ref Doc', 'Source', 'Debit', 'Credit', 'Balance']
    const header = cols.join(',') + '\n'
    const body = rows.map(r => [
      r.date, r.entry_no,
      ...(showAccountCol ? [r.account_code ?? '', r.account_name ?? ''] : []),
      `"${(r.narration || '').replace(/"/g, '""')}"`,
      r.ref_doc_type ? `${r.ref_doc_type}:${r.ref_doc_no}` : '',
      r.source_type, r.debit, r.credit, r.balance,
    ].join(',')).join('\n')
    const blob = new Blob([header + body], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `gl_report_${activeDim}_${selectedRecord?.name || 'all'}_${fromDate}_${toDate}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full min-h-screen bg-background">
      {/* ── Page header ── */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">GL Report — Line Items</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Posted journal entries by GL account, customer, supplier, employee or other master data
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex border border-border rounded-lg overflow-hidden">
              {[
                { id: 'ledger', icon: List, label: 'Ledger' },
                { id: 'summary', icon: BarChart3, label: 'Summary' },
              ].map(v => (
                <button
                  key={v.id}
                  onClick={() => setView(v.id as any)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
                    view === v.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
                  )}
                >
                  <v.icon className="w-3.5 h-3.5" /> {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left sidebar: dimension picker ── */}
        <div className="w-56 bg-card border-r border-border flex flex-col shrink-0 overflow-y-auto">
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Report By</p>
          </div>
          <nav className="space-y-0.5 px-2 py-2">
            {DIMENSIONS.map(d => (
              <button
                key={d.id}
                onClick={() => switchDim(d.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all',
                  activeDim === d.id
                    ? 'bg-primary/10 font-semibold text-primary'
                    : 'text-muted-foreground hover:bg-accent',
                )}
              >
                <d.icon className={cn('h-4 w-4 shrink-0', activeDim === d.id ? 'text-primary' : 'text-muted-foreground')} />
                {d.label}
              </button>
            ))}
          </nav>
          <div className="mt-auto border-t border-border px-4 py-3">
            <p className="text-xs leading-snug text-muted-foreground">{dim.description}</p>
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="flex-1 overflow-auto flex flex-col">

          {/* ── Controls bar ── */}
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card px-6 py-3">
            {/* Dimension badge */}
            <span className={cn('rounded-full border px-2.5 py-1 text-xs font-bold', dim.color)}>
              {dim.label}
            </span>

            {/* Master search */}
            <div className="min-w-64 flex-1">
              <MasterSearch dim={dim} selected={selectedRecord} onSelect={setSelectedRecord} />
            </div>

            {/* Date range */}
            <div className="flex shrink-0 items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="date" value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className={filterControlClass}
              />
              <span className="text-xs text-muted-foreground">→</span>
              <input
                type="date" value={toDate}
                onChange={e => setToDate(e.target.value)}
                className={filterControlClass}
              />
            </div>

            {/* Quick presets */}
            <Select
              className="w-32"
              triggerClassName="text-xs"
              value=""
              onChange={v => {
                const d = new Date()
                if (v === 'this_month') {
                  setFromDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`)
                  setToDate(today())
                } else if (v === 'last_month') {
                  const lm = new Date(d.getFullYear(), d.getMonth() - 1, 1)
                  const le = new Date(d.getFullYear(), d.getMonth(), 0)
                  setFromDate(lm.toISOString().slice(0, 10))
                  setToDate(le.toISOString().slice(0, 10))
                } else if (v === 'this_fy') {
                  setFromDate(fyStart()); setToDate(today())
                } else if (v === 'last_fy') {
                  const yr = parseInt(fyStart().slice(0, 4)) - 1
                  setFromDate(`${yr}-04-01`); setToDate(`${yr + 1}-03-31`)
                } else if (v === 'this_q') {
                  const q = Math.floor(d.getMonth() / 3)
                  const qStart = new Date(d.getFullYear(), q * 3, 1)
                  setFromDate(qStart.toISOString().slice(0, 10)); setToDate(today())
                }
              }}
              placeholder="Preset…"
              options={[
                { value: 'this_month', label: 'This Month' },
                { value: 'last_month', label: 'Last Month' },
                { value: 'this_q', label: 'This Quarter' },
                { value: 'this_fy', label: 'This FY' },
                { value: 'last_fy', label: 'Last FY' },
              ]}
            />

            <button
              onClick={() => refetch()}
              className="flex h-10 items-center gap-1.5 rounded-lg border border-input px-3 text-xs text-muted-foreground hover:bg-accent"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>

            {rows.length > 0 && (
              <button
                onClick={exportCSV}
                className="flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Download className="w-3 h-3" /> Export CSV
              </button>
            )}
          </div>

          {/* ── KPIs ── */}
          {view === 'ledger' && selectedRecord && rows.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 py-4 shrink-0">
              <KPI
                label="Total Debit"
                value={fmt(totalDebit)}
                sub={`${rows.filter(r => r.debit > 0).length} entries`}
                icon={ArrowUpRight}
                color="bg-primary/15 text-primary"
              />
              <KPI
                label="Total Credit"
                value={fmt(totalCredit)}
                sub={`${rows.filter(r => r.credit > 0).length} entries`}
                icon={ArrowDownLeft}
                color="bg-primary/12 text-primary"
              />
              <KPI
                label="Closing Balance"
                value={fmt(Math.abs(closingBalance))}
                sub={closingBalance < 0 ? 'Credit side' : closingBalance > 0 ? 'Debit side' : 'Nil'}
                icon={TrendingUp}
                color={closingBalance < 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}
              />
              <KPI
                label="Transactions"
                value={String(rows.length)}
                sub={`${fromDate} → ${toDate}`}
                icon={List}
                color="bg-gray-100 text-gray-600"
              />
            </div>
          )}

          {/* ── Content area ── */}
          <div className="flex-1 px-6 pb-6 overflow-auto">
            {view === 'summary' ? (
              <div className="pt-4">
                <SummaryView fromDate={fromDate} toDate={toDate} />
              </div>
            ) : !selectedRecord ? (
              <div className="flex flex-col items-center justify-center h-80 text-center text-muted-foreground gap-3 mt-8">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                  <dim.icon className="w-8 h-8 opacity-40" />
                </div>
                <p className="text-base font-medium text-foreground">Select a {dim.label}</p>
                <p className="text-sm max-w-xs leading-relaxed text-muted-foreground">
                  Use the search box above to pick a {dim.label.toLowerCase()} and see all posted GL line items.
                </p>
                {/* Quick-start: show all dimensions as clickable pills */}
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  {DIMENSIONS.filter(d => d.id !== activeDim).map(d => (
                    <button
                      key={d.id}
                      onClick={() => switchDim(d.id)}
                      className={cn('text-xs px-3 py-1.5 rounded-full border font-medium transition-all', d.color)}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden mt-4">
                {/* Selected record header */}
                <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-3">
                  <dim.icon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedRecord.code && <span className="mr-2 font-mono text-muted-foreground">{selectedRecord.code}</span>}
                      {selectedRecord.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{dim.label} · {rows.length} posted transactions</p>
                  </div>
                </div>
                <LedgerTable rows={rows} showAccount={showAccountCol} isLoading={isLoading} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
