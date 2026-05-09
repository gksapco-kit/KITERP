import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  Plus, TrendingUp, TrendingDown, Wallet,
  ArrowLeftRight, Search, Filter, Pencil, Trash2, X,
  Receipt, DollarSign,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import axios from '@/lib/axios'

const BASE = '/vendors/me/finance/basic-transactions'

export type TxnType = 'income' | 'expense' | 'salary' | 'transfer'

export interface BasicTransaction {
  id: string
  txn_type: TxnType
  category: string
  amount: number
  txn_date: string
  description?: string
  payment_method?: string
  reference?: string
  created_at: string
}

interface BasicTransactionCreate {
  txn_type: TxnType
  category: string
  amount: number
  txn_date: string
  description?: string
  payment_method?: string
  reference?: string
}

const txnApi = {
  list: (params?: Record<string, unknown>) =>
    axios.get(BASE, { params }).then(r => r.data as BasicTransaction[]),
  create: (data: BasicTransactionCreate) =>
    axios.post(BASE, data).then(r => r.data as BasicTransaction),
  update: (id: string, data: Partial<BasicTransactionCreate>) =>
    axios.patch(`${BASE}/${id}`, data).then(r => r.data as BasicTransaction),
  remove: (id: string) => axios.delete(`${BASE}/${id}`),
}

const TXN_TYPES: { value: TxnType; label: string; color: string; bg: string; icon: React.ElementType }[] = [
  { value: 'income',   label: 'Income',   color: 'text-emerald-700', bg: 'bg-emerald-100', icon: TrendingUp },
  { value: 'expense',  label: 'Expense',  color: 'text-red-700',     bg: 'bg-red-100',     icon: TrendingDown },
  { value: 'salary',   label: 'Salary',   color: 'text-blue-700',    bg: 'bg-blue-100',    icon: Wallet },
  { value: 'transfer', label: 'Transfer', color: 'text-amber-700',   bg: 'bg-amber-100',   icon: ArrowLeftRight },
]

const CATEGORIES: Record<TxnType, string[]> = {
  income:   ['Sales Revenue', 'Service Revenue', 'Commission', 'Rent Received', 'Interest', 'Other Income'],
  expense:  ['Rent', 'Utilities', 'Office Supplies', 'Travel', 'Marketing', 'Maintenance', 'Insurance', 'Miscellaneous'],
  salary:   ['Staff Salary', 'Wages', 'Bonus', 'Contractor Payment', 'Director Remuneration'],
  transfer: ['Bank Transfer', 'Cash Withdrawal', 'Cash Deposit', 'Inter-account Transfer'],
}

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'UPI', 'Credit Card', 'Debit Card', 'Cheque']

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

function getTxnMeta(type: TxnType) {
  return TXN_TYPES.find(t => t.value === type) ?? TXN_TYPES[0]
}

// ── Transaction Form Modal ────────────────────────────────────────────────────

const EMPTY_FORM: BasicTransactionCreate = {
  txn_type: 'expense',
  category: '',
  amount: 0,
  txn_date: format(new Date(), 'yyyy-MM-dd'),
  description: '',
  payment_method: 'Cash',
  reference: '',
}

function TransactionModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial?: Partial<BasicTransactionCreate>
  onClose: () => void
  onSave: (data: BasicTransactionCreate) => void
  saving: boolean
}) {
  const [form, setForm] = useState<BasicTransactionCreate>({ ...EMPTY_FORM, ...initial })
  const set = (k: keyof BasicTransactionCreate, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.category) { toast.error('Please select a category'); return }
    if (!form.amount || form.amount <= 0) { toast.error('Amount must be positive'); return }
    onSave(form)
  }

  const selectedMeta = getTxnMeta(form.txn_type)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className={cn('px-6 py-4 flex items-center justify-between', selectedMeta.bg)}>
          <div className="flex items-center gap-2">
            <selectedMeta.icon className={cn('w-5 h-5', selectedMeta.color)} />
            <span className={cn('font-semibold', selectedMeta.color)}>
              {initial?.txn_type ? 'Edit' : 'New'} {selectedMeta.label}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/10 transition-colors">
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Type */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Type</label>
            <div className="grid grid-cols-4 gap-2">
              {TXN_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => { set('txn_type', t.value); set('category', '') }}
                  className={cn(
                    'flex flex-col items-center gap-1 py-2 rounded-xl border-2 text-xs font-medium transition-all',
                    form.txn_type === t.value
                      ? `${t.bg} border-current ${t.color}`
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  )}
                >
                  <t.icon className="w-4 h-4" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Category</label>
            <select
              value={form.category}
              onChange={e => set('category', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select category…</option>
              {CATEGORIES[form.txn_type].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="__other">Other…</option>
            </select>
            {form.category === '__other' && (
              <input
                className="w-full mt-2 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter custom category"
                onChange={e => set('category', e.target.value)}
                autoFocus
              />
            )}
          </div>

          {/* Amount + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Amount (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount || ''}
                onChange={e => set('amount', parseFloat(e.target.value) || 0)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Date</label>
              <input
                type="date"
                value={form.txn_date}
                onChange={e => set('txn_date', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Description</label>
            <input
              value={form.description || ''}
              onChange={e => set('description', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional note…"
            />
          </div>

          {/* Payment Method + Reference */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Payment</label>
              <select
                value={form.payment_method || ''}
                onChange={e => set('payment_method', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">–</option>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Reference #</label>
              <input
                value={form.reference || ''}
                onChange={e => set('reference', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Invoice / receipt…"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={cn(
                'flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors',
                selectedMeta.bg.replace('100', '600').replace('bg-', 'bg-'),
                saving && 'opacity-50 cursor-not-allowed'
              )}
            >
              {saving ? 'Saving…' : 'Save Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type FilterType = 'all' | TxnType

export default function BasicFinancePage() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<FilterType>('all')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<BasicTransaction | null>(null)

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['finance', 'basic-transactions'],
    queryFn: () => txnApi.list(),
  })

  const createMutation = useMutation({
    mutationFn: txnApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance', 'basic-transactions'] })
      setShowModal(false)
      toast.success('Transaction added')
    },
    onError: () => toast.error('Could not save transaction'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BasicTransactionCreate> }) =>
      txnApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance', 'basic-transactions'] })
      setEditing(null)
      toast.success('Transaction updated')
    },
    onError: () => toast.error('Could not update transaction'),
  })

  const deleteMutation = useMutation({
    mutationFn: txnApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance', 'basic-transactions'] })
      toast.success('Transaction deleted')
    },
    onError: () => toast.error('Could not delete transaction'),
  })

  // Filtered list
  const visible = transactions.filter(t => {
    if (filter !== 'all' && t.txn_type !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        t.category.toLowerCase().includes(q) ||
        (t.description?.toLowerCase().includes(q) ?? false) ||
        (t.reference?.toLowerCase().includes(q) ?? false)
      )
    }
    return true
  })

  // Summary stats
  const totalIncome   = transactions.filter(t => t.txn_type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense  = transactions.filter(t => t.txn_type === 'expense').reduce((s, t) => s + t.amount, 0)
  const totalSalary   = transactions.filter(t => t.txn_type === 'salary').reduce((s, t) => s + t.amount, 0)
  const netBalance    = totalIncome - totalExpense - totalSalary

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Basic Finance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track your income, expenses, salaries and transfers</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Transaction
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Income',    value: fmt(totalIncome),   icon: TrendingUp,    bg: 'bg-emerald-50',  iconColor: 'text-emerald-600', border: 'border-emerald-100' },
          { label: 'Total Expenses',  value: fmt(totalExpense),  icon: TrendingDown,  bg: 'bg-red-50',      iconColor: 'text-red-600',     border: 'border-red-100' },
          { label: 'Salaries Paid',   value: fmt(totalSalary),   icon: Wallet,        bg: 'bg-blue-50',     iconColor: 'text-blue-600',    border: 'border-blue-100' },
          { label: 'Net Balance',     value: fmt(netBalance),    icon: DollarSign,    bg: netBalance >= 0 ? 'bg-gray-50' : 'bg-red-50', iconColor: netBalance >= 0 ? 'text-gray-600' : 'text-red-600', border: 'border-gray-100' },
        ].map(card => (
          <div key={card.label} className={cn('rounded-xl border p-4 flex items-center gap-3', card.bg, card.border)}>
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center bg-white shadow-sm shrink-0')}>
              <card.icon className={cn('w-5 h-5', card.iconColor)} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 truncate">{card.label}</p>
              <p className={cn('text-base font-bold truncate', netBalance < 0 && card.label === 'Net Balance' ? 'text-red-600' : 'text-gray-900')}>
                {card.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter + Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Type filter tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {(['all', ...TXN_TYPES.map(t => t.value)] as FilterType[]).map(type => {
            const meta = type === 'all' ? null : getTxnMeta(type as TxnType)
            return (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                  filter === type
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {type === 'all' ? 'All' : meta?.label}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search transactions…"
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Transaction List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Loading transactions…</div>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center">
            <Receipt className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm font-medium">No transactions found</p>
            <p className="text-gray-300 text-xs mt-1">
              {search || filter !== 'all' ? 'Try adjusting your filters' : 'Click "Add Transaction" to get started'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {/* List header */}
            <div className="px-4 py-2.5 bg-gray-50 grid grid-cols-[1fr_auto_auto] sm:grid-cols-[120px_1fr_auto_auto_auto] gap-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              <span className="hidden sm:block">Date</span>
              <span>Category / Description</span>
              <span className="hidden sm:block text-right">Method</span>
              <span className="text-right">Amount</span>
              <span />
            </div>

            {visible.map(txn => {
              const meta = getTxnMeta(txn.txn_type)
              return (
                <div
                  key={txn.id}
                  className="px-4 py-3 grid grid-cols-[1fr_auto_auto] sm:grid-cols-[120px_1fr_auto_auto_auto] gap-3 items-center hover:bg-gray-50 transition-colors group"
                >
                  {/* Date */}
                  <span className="hidden sm:block text-xs text-gray-400">
                    {format(new Date(txn.txn_date), 'dd MMM yyyy')}
                  </span>

                  {/* Category + description */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0', meta.bg, meta.color)}>
                      <meta.icon className="w-3 h-3" />
                      {meta.label}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{txn.category}</p>
                      {txn.description && (
                        <p className="text-xs text-gray-400 truncate">{txn.description}</p>
                      )}
                      <span className="text-[10px] text-gray-300 sm:hidden">
                        {format(new Date(txn.txn_date), 'dd MMM yyyy')}
                      </span>
                    </div>
                  </div>

                  {/* Payment method */}
                  <span className="hidden sm:block text-xs text-gray-400 text-right">
                    {txn.payment_method || '—'}
                  </span>

                  {/* Amount */}
                  <span className={cn(
                    'text-sm font-bold tabular-nums text-right',
                    txn.txn_type === 'income' ? 'text-emerald-600' :
                    txn.txn_type === 'expense' ? 'text-red-600' :
                    txn.txn_type === 'salary' ? 'text-blue-600' :
                    'text-amber-600'
                  )}>
                    {txn.txn_type === 'income' ? '+' : '-'}{fmt(txn.amount)}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditing(txn)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this transaction?')) deleteMutation.mutate(txn.id)
                      }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Count */}
      {visible.length > 0 && (
        <p className="text-xs text-gray-400 text-right">
          {visible.length} transaction{visible.length !== 1 ? 's' : ''}
          {filter !== 'all' || search ? ` (filtered from ${transactions.length} total)` : ''}
        </p>
      )}

      {/* Add Modal */}
      {showModal && (
        <TransactionModal
          onClose={() => setShowModal(false)}
          onSave={data => createMutation.mutate(data)}
          saving={createMutation.isPending}
        />
      )}

      {/* Edit Modal */}
      {editing && (
        <TransactionModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={data => updateMutation.mutate({ id: editing.id, data })}
          saving={updateMutation.isPending}
        />
      )}
    </div>
  )
}
