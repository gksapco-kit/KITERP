import { useState } from 'react'
import { useCreateHRDepartment, useUpdateHRDepartment } from '@/hooks/useVendor'
import type { HRDepartment } from '@/types'

interface DeptModalProps {
  dept?: HRDepartment | null
  departments: HRDepartment[]
  onClose: () => void
  onCreated?: (dept: HRDepartment) => void
}

export function DeptModal({ dept, departments: _departments, onClose, onCreated }: DeptModalProps) {
  const create = useCreateHRDepartment()
  const update = useUpdateHRDepartment()
  const [form, setForm] = useState({
    name: dept?.name ?? '',
    code: dept?.code ?? '',
    description: dept?.description ?? '',
  })

  const busy = create.isPending || update.isPending

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const data: Record<string, unknown> = {
      name: form.name,
      code: form.code || undefined,
      description: form.description || undefined,
    }
    if (dept) {
      await update.mutateAsync({ id: dept.id, data })
      onClose()
    } else {
      const created = await create.mutateAsync(data) as HRDepartment
      onCreated?.(created)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">{dept ? 'Edit Department' : 'New Department'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              autoFocus
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="e.g. ENG, HR, FIN"
              value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              rows={2}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={busy} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
              {busy ? 'Saving…' : dept ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
