import { useState, useMemo, useCallback } from 'react'
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
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    description: 'Receivables and revenue lines by customer',
  },
  {
    id: 'supplier',
    label: 'Supplier / Vendor',
    icon: Briefcase,
    partyType: 'supplier',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    description: 'Payables and expense lines by supplier',
  },
  {
    id: 'employee',
    label: 'Employee',
    icon: User,
    partyType: 'employee',
    color: 'bg-green-100 text-green-700 border-green-200',
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
    color: 'bg-pink-100 text-pink-700 border-pink-200',
    description: 'Lines posted against freelance engagements',
  },
  {
    id: 'cost_center',
    label: 'Cost Centre',
    icon: Layers,
    color: 'bg-teal-100 text-teal-700 border-teal-200',
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
  Asset: 'bg-blue-50 text-blue-700',
  Liability: 'bg-red-50 text-red-700',
  Equity: 'bg-accent text-primary',
  Income: 'bg-green-50 text-green-700',
  Expense: 'bg-orange-50 text-orange-700',
}

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
      <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
        <AlertCircle className="w-4 h-4 shrink-0" />
        Enter the party ID directly — contractor/freelancer records are posted manually via journal entries.
        <input
          placeholder="Paste party UUID…"
          className="ml-2 flex-1 border border-amber-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          value={selected ? (selected.label || selected.name) : q}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => { setOpen(true); if (!results.length) search(q) }}
          placeholder={`Search ${dim.label}…`}
          className="w-full border border-gray-300 rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {(selected || q) && (
          <button onClick={() => { onSelect(null); setQ(''); setResults([]) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {open && !selected && (results.length > 0 || loading) && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-56 overflow-y-auto">
          {loading && <p className="px-4 py-3 text-xs text-gray-400">Searching…</p>}
          {results.map(r => (
            <button
              key={r.id}
              onClick={() => select(r)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-primary/10 text-left transition-colors border-b border-gray-50 last:border-0"
            >
              {r.code && <span className="font-mono text-xs text-gray-400 w-16 shrink-0">{r.code}</span>}
              <span className="flex-1 text-sm text-gray-800">{r.name}</span>
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
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', color)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className="font-mono font-bold text-xl text-gray-900">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
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
        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
          <tr>
            <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Date</th>
            <th className="px-3 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Entry No</th>
            {showAccount && (
              <th className="px-3 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Account</th>
            )}
            <th className="px-3 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide max-w-[200px]">Narration</th>
            <th className="px-3 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Ref Doc</th>
            <th className="px-3 py-3 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Source</th>
            <th className="px-3 py-3 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Debit</th>
            <th className="px-3 py-3 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Credit</th>
            <th className="px-4 py-3 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Balance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row, i) => (
            <tr
              key={i}
              className={cn(
                'transition-colors hover:bg-primary/10/30 group',
                row.debit > 0 ? '' : 'bg-accent/10',
              )}
            >
              <td className="px-4 py-2.5 font-mono text-gray-500 text-[11px]">{row.date}</td>
              <td className="px-3 py-2.5">
                <span className="font-mono font-semibold text-primary">{row.entry_no}</span>
              </td>
              {showAccount && (
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] text-gray-400">{row.account_code}</span>
                    <span className="text-gray-700 max-w-[120px] truncate">{row.account_name}</span>
                    {row.account_type && (
                      <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-semibold hidden group-hover:inline',
                        TYPE_COLORS[row.account_type] || 'bg-gray-100 text-gray-500')}>
                        {row.account_type}
                      </span>
                    )}
                  </div>
                </td>
              )}
              <td className="px-3 py-2.5 max-w-[200px]">
                <span className="text-gray-700 line-clamp-2 leading-snug whitespace-normal">{row.narration || '—'}</span>
              </td>
              <td className="px-3 py-2.5">
                {row.ref_doc_type
                  ? <span className="text-[10px] text-gray-500">{row.ref_doc_type}: {row.ref_doc_no || '—'}</span>
                  : <span className="text-gray-200">—</span>}
              </td>
              <td className="px-3 py-2.5 text-center">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                  {SOURCE_LABELS[row.source_type] || row.source_type}
                </span>
              </td>
              <td className="px-3 py-2.5 text-right font-mono">
                {row.debit > 0
                  ? <span className="font-semibold text-gray-900">{fmt(row.debit)}</span>
                  : <span className="text-gray-200">—</span>}
              </td>
              <td className="px-3 py-2.5 text-right font-mono">
                {row.credit > 0
                  ? <span className="font-semibold text-gray-900">{fmt(row.credit)}</span>
                  : <span className="text-gray-200">—</span>}
              </td>
              <td className="px-4 py-2.5 text-right font-mono">
                <span className={cn('font-semibold', row.balance < 0 ? 'text-red-600' : 'text-gray-900')}>
                  {fmt(Math.abs(row.balance))}
                  {row.balance < 0 && <span className="text-[9px] ml-0.5 opacity-70">Cr</span>}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-50 border-t-2 border-gray-300 sticky bottom-0">
          <tr>
            <td colSpan={showAccount ? 6 : 5} className="px-4 py-3 text-xs font-bold text-gray-600 text-right">
              Totals ({rows.length} entries)
            </td>
            <td className="px-3 py-3 text-right font-mono font-bold text-gray-900">
              {fmt(rows.reduce((s, r) => s + r.debit, 0))}
            </td>
            <td className="px-3 py-3 text-right font-mono font-bold text-gray-900">
              {fmt(rows.reduce((s, r) => s + r.credit, 0))}
            </td>
            <td className="px-4 py-3 text-right font-mono font-bold">
              {(() => {
                const bal = rows.length ? rows[rows.length - 1].balance : 0
                return (
                  <span className={bal < 0 ? 'text-red-600' : 'text-gray-900'}>
                    {fmt(Math.abs(bal))}{bal < 0 && <span className="text-[9px] ml-0.5">Cr</span>}
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
              typeFilter === t ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
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
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Code</th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Account Name</th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Subtype</th>
                <th className="px-3 py-3 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Total Debit</th>
                <th className="px-3 py-3 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Total Credit</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.length === 0
                ? <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No data in this period</td></tr>
                : rows.map((r: any) => (
                  <tr key={r.account_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-gray-500">{r.code}</td>
                    <td className="px-3 py-2.5 text-gray-800 font-medium max-w-[200px] truncate">{r.name}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold', TYPE_COLORS[r.account_type] || 'bg-gray-100 text-gray-500')}>
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
    <div className="flex flex-col h-full min-h-screen bg-gray-50">
      {/* ── Page header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">GL Report — Line Items</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Posted journal entries by GL account, customer, supplier, employee or other master data
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              {[
                { id: 'ledger', icon: List, label: 'Ledger' },
                { id: 'summary', icon: BarChart3, label: 'Summary' },
              ].map(v => (
                <button
                  key={v.id}
                  onClick={() => setView(v.id as any)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
                    view === v.id ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50',
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
        <div className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0 overflow-y-auto">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Report By</p>
          </div>
          <nav className="py-2 space-y-0.5 px-2">
            {DIMENSIONS.map(d => (
              <button
                key={d.id}
                onClick={() => switchDim(d.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-all',
                  activeDim === d.id
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-gray-600 hover:bg-gray-50',
                )}
              >
                <d.icon className={cn('w-4 h-4 shrink-0', activeDim === d.id ? 'text-primary' : 'text-gray-400')} />
                {d.label}
              </button>
            ))}
          </nav>
          <div className="mt-auto px-4 py-3 border-t border-gray-100">
            <p className="text-[10px] text-gray-400 leading-snug">{dim.description}</p>
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="flex-1 overflow-auto flex flex-col">

          {/* ── Controls bar ── */}
          <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 flex-wrap shrink-0">
            {/* Dimension badge */}
            <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full border', dim.color)}>
              {dim.label}
            </span>

            {/* Master search */}
            <div className="flex-1 min-w-64">
              <MasterSearch dim={dim} selected={selectedRecord} onSelect={setSelectedRecord} />
            </div>

            {/* Date range */}
            <div className="flex items-center gap-2 shrink-0">
              <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
              <input
                type="date" value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="text-gray-400 text-xs">→</span>
              <input
                type="date" value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Quick presets */}
            <select
              onChange={e => {
                const v = e.target.value
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
              defaultValue=""
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none bg-white text-gray-600"
            >
              <option value="" disabled>Preset…</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_q">This Quarter</option>
              <option value="this_fy">This FY</option>
              <option value="last_fy">Last FY</option>
            </select>

            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>

            {rows.length > 0 && (
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90"
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
              <div className="flex flex-col items-center justify-center h-80 text-center text-gray-400 gap-3 mt-8">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                  <dim.icon className="w-8 h-8 opacity-40" />
                </div>
                <p className="text-base font-medium text-gray-500">Select a {dim.label}</p>
                <p className="text-sm max-w-xs leading-relaxed">
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
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mt-4">
                {/* Selected record header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <dim.icon className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {selectedRecord.code && <span className="font-mono text-gray-400 mr-2">{selectedRecord.code}</span>}
                      {selectedRecord.name}
                    </p>
                    <p className="text-[11px] text-gray-400">{dim.label} · {rows.length} posted transactions</p>
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
