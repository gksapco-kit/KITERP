import { onModalBackdropClick } from '@/lib/utils'
import { InlineFieldLabel } from '@/components/common/InlineFieldLabel'
import { useState } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Receipt, Plus, X, Send, Trash2, Pencil } from 'lucide-react'
import { useMyExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense } from '@/hooks/useVendor'
import { ExpenseReceiptUpload, type ExpenseReceipt } from '@/components/hr/ExpenseReceiptUpload'
import { vendorApi } from '@/api/vendor'
import type { ExpenseClaim } from '@/types'

const STATUS: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',     color: 'bg-gray-100 text-gray-600' },
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700' },
  approved:  { label: 'Approved',  color: 'bg-green-100 text-green-700' },
  rejected:  { label: 'Rejected',  color: 'bg-red-100 text-red-700' },
  paid:      { label: 'Paid',      color: 'bg-emerald-100 text-emerald-700' },
}

export default function MyExpensesPage() {
  const { data: claims = [], isLoading } = useMyExpenses()
  const del = useDeleteExpense()
  const [editing, setEditing] = useState<ExpenseClaim | null>(null)
  const [showNew, setShowNew] = useState(false)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Expense Claims</h1>
          <p className="text-sm text-gray-500 mt-1">Submit Expenses For Reimbursement</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium">
          <Plus className="w-4 h-4" /> New Claim
        </button>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (claims as ExpenseClaim[]).length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">You have no claims yet.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
              <tr>{['Claim #', 'Title', 'Category', 'Amount', 'Date', 'Status', 'Actions'].map(h =>
                <th key={h} className="text-left py-2 px-4 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {(claims as ExpenseClaim[]).map(c => {
                const st = STATUS[c.status] ?? STATUS.draft
                return (
                  <tr key={c.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4 text-sm font-mono text-gray-700">{c.claim_number ?? '—'}</td>
                    <td className="py-2 px-4 text-sm">{c.title}</td>
                    <td className="py-2 px-4 text-xs text-gray-500">{c.category ?? '—'}</td>
                    <td className="py-2 px-4 text-sm font-semibold">
                      {c.currency ?? 'INR'} {Number(c.amount).toFixed(2)}
                    </td>
                    <td className="py-2 px-4 text-xs text-gray-500">{c.expense_date ?? '—'}</td>
                    <td className="py-2 px-4">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${st.color}`}>{st.label}</span>
                    </td>
                    <td className="py-2 px-4 text-sm">
                      <div className="flex items-center gap-1">
                        {(c.status === 'draft' || c.status === 'rejected') && (
                          <button onClick={() => setEditing(c)}
                            className="p-1.5 text-gray-400 hover:text-blue-600" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {c.status === 'draft' && (
                          <button onClick={() => del.mutate(c.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {(showNew || editing) && (
        <ExpenseModal claim={editing} onClose={() => { setShowNew(false); setEditing(null) }} />
      )}
    </div>
  )
}

function ExpenseModal({
 claim, onClose }: { claim: ExpenseClaim | null; onClose: () => void }) {
  const create = useCreateExpense()
  const update = useUpdateExpense()
  const [receipts, setReceipts] = useState<ExpenseReceipt[]>(
    () => (claim?.receipts ?? []).map((r) => ({ url: r.url, name: r.name })),
  )
  const [form, setForm] = useState<{
    title: string; category: string; expense_date: string; currency: string;
    amount: string; description: string; status: ExpenseClaim['status'];
  }>({
    title:        claim?.title ?? '',
    category:     claim?.category ?? 'travel',
    expense_date: claim?.expense_date ?? new Date().toISOString().slice(0, 10),
    currency:     claim?.currency ?? 'INR',
    amount:       claim?.amount != null ? String(claim.amount) : '',
    description:  claim?.description ?? '',
    status:       claim?.status ?? 'draft',
  })

  const submit = (status: 'draft' | 'submitted') => {
    const payload: Record<string, unknown> = {
      title: form.title,
      category: form.category,
      expense_date: form.expense_date,
      currency: form.currency,
      amount: Number(form.amount),
      description: form.description,
      receipts: receipts.map((r) => ({ url: r.url, name: r.name })),
      status,
    }
    if (claim) update.mutate({ id: claim.id, data: payload }, { onSuccess: onClose })
    else       create.mutate(payload, { onSuccess: onClose })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={onModalBackdropClick(onClose)}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">{claim ? 'Edit Claim' : 'New Claim'}</h2>
          <button type="button" aria-label="Close" onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-4 space-y-3">
          <Field label="Title *">
            <input className="w-full border rounded px-3 py-2 text-sm" value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select className="w-full border rounded px-3 py-2 text-sm" value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="travel">Travel</option>
                <option value="meals">Meals</option>
                <option value="lodging">Lodging</option>
                <option value="supplies">Supplies</option>
                <option value="training">Training</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Date">
              <input type="date" className="w-full border rounded px-3 py-2 text-sm"
                value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Currency">
              <input className="w-full border rounded px-3 py-2 text-sm" value={form.currency}
                onChange={e => setForm({ ...form, currency: e.target.value })} />
            </Field>
            <Field label="Amount *">
              <input type="number" step="0.01" className="w-full border rounded px-3 py-2 text-sm col-span-2"
                value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            </Field>
          </div>
          <Field label="Description">
            <textarea className="w-full border rounded px-3 py-2 text-sm" rows={3} value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })} />
          </Field>
          <ExpenseReceiptUpload
            receipts={receipts}
            onChange={setReceipts}
            uploadFile={(file) => vendorApi.hrUploadExpenseReceipt(file)}
          />
        </div>
        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
          <button onClick={onClose} className="btn-cancel px-3 py-2 text-sm border rounded-lg text-gray-700">Cancel</button>
          <button onClick={() => submit('draft')} disabled={!form.title || !form.amount}
            className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-100 disabled:opacity-50">
            Save draft
          </button>
          <button onClick={() => submit('submitted')} disabled={!form.title || !form.amount}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1">
            <Send className="w-4 h-4" /> Submit
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <InlineFieldLabel label={label} className="block text-xs font-medium text-gray-700 mb-1" />
      {children}
    </div>
  )
}
