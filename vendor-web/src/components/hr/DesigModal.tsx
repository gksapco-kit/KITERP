import { onModalBackdropClick } from '@/lib/utils'
import { useState } from 'react'
import { X } from 'lucide-react'
import { useCreateHRDesignation, useUpdateHRDesignation } from '@/hooks/useVendor'
import type { HRDesignation } from '@/types'

interface DesigModalProps {
  desig?: HRDesignation | null
  onClose: () => void
  onCreated?: (desig: HRDesignation) => void
}

export function DesigModal({ desig, onClose, onCreated }: DesigModalProps) {
  const create = useCreateHRDesignation()
  const update = useUpdateHRDesignation()
  const [form, setForm] = useState({ name: desig?.name ?? '', level: desig?.level ?? 1 })
  const busy = create.isPending || update.isPending

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (desig) {
      await update.mutateAsync({ id: desig.id, data: form })
      onClose()
    } else {
      const created = await create.mutateAsync(form) as HRDesignation
      onCreated?.(created)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onModalBackdropClick(onClose)}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold mb-4">{desig ? 'Edit Designation' : 'New Designation'}</h2>
              </div>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Seniority Level</label>
            <input
              type="number"
              min={1}
              max={20}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={form.level}
              onChange={e => setForm(f => ({ ...f, level: parseInt(e.target.value) || 1 }))}
            />
            <p className="text-xs text-gray-400 mt-1">Higher number = more senior (e.g. L1 = junior, L10 = VP)</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-cancel px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button type="submit" disabled={busy} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
              {busy ? 'Saving…' : desig ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
