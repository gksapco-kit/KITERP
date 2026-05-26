import { onModalBackdropClick } from '@/lib/utils'
import { useState } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Plus, Pencil, Shield, X } from 'lucide-react'
import { useHRLeavePolicies, useCreateHRLeavePolicy, useUpdateHRLeavePolicy } from '@/hooks/useVendor'
import type { LeavePolicy } from '@/types'

function PolicyModal({
 policy, onClose }: { policy?: LeavePolicy | null; onClose: () => void }) {
  const create = useCreateHRLeavePolicy()
  const update = useUpdateHRLeavePolicy()
  const [form, setForm] = useState({
    name: policy?.name ?? '',
    code: policy?.code ?? '',
    days_per_year: policy?.days_per_year ?? 12,
    carry_forward: policy?.carry_forward ?? false,
    max_carry_forward_days: policy?.max_carry_forward_days ?? 0,
    is_paid: policy?.is_paid ?? true,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (policy) { await update.mutateAsync({ id: policy.id, data: form }) }
    else { await create.mutateAsync(form) }
    onClose()
  }

  const busy = create.isPending || update.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onModalBackdropClick(onClose)}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
              <h2 className="text-lg font-semibold mb-4">{policy ? 'Edit Policy' : 'New Leave Policy'}</h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
              <input required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Casual Leave" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Code *</label>
              <input required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. CL" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Days/Year</label>
              <input type="number" min={0} step={0.5} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.days_per_year} onChange={e => setForm(f => ({ ...f, days_per_year: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Max Carry Forward</label>
              <input type="number" min={0} step={0.5} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.max_carry_forward_days} onChange={e => setForm(f => ({ ...f, max_carry_forward_days: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.carry_forward} onChange={e => setForm(f => ({ ...f, carry_forward: e.target.checked }))} className="rounded" />
              Carry Forward
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.is_paid} onChange={e => setForm(f => ({ ...f, is_paid: e.target.checked }))} className="rounded" />
              Paid Leave
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-cancel px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button type="submit" disabled={busy} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
              {busy ? 'Saving…' : policy ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function LeavePoliciesPage() {
  const { data: policies = [], isLoading } = useHRLeavePolicies()
  const [modal, setModal] = useState<{ open: boolean; policy?: LeavePolicy | null }>({ open: false })

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave Policies</h1>
          <p className="text-sm text-gray-500 mt-1">Configure leave types and rules</p>
        </div>
        <button onClick={() => setModal({ open: true, policy: null })} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium">
          <Plus className="w-4 h-4" /> Add Policy
        </button>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : policies.length === 0 ? (
          <div className="p-12 text-center">
            <Shield className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No leave policies configured.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Name', 'Code', 'Days/Year', 'Carry Forward', 'Type', 'Status', ''].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {policies.map((p: LeavePolicy) => (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-sm text-gray-900">{p.name}</td>
                  <td className="py-3 px-4"><span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-mono">{p.code}</span></td>
                  <td className="py-3 px-4 text-sm text-gray-600">{Number(p.days_per_year).toFixed(1)}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{p.carry_forward ? `Yes (max ${Number(p.max_carry_forward_days).toFixed(0)})` : 'No'}</td>
                  <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.is_paid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{p.is_paid ? 'Paid' : 'Unpaid'}</span></td>
                  <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{p.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => setModal({ open: true, policy: p })} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal.open && <PolicyModal policy={modal.policy} onClose={() => setModal({ open: false })} />}
    </div>
  )
}
