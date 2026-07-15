import { cn, onModalBackdropClick } from '@/lib/utils'
import {
  dialogOverlayClassZ60,
  dialogPanelClass,
  dialogHeaderClass,
  dialogBodyClass,
  dialogFooterClass,
} from '@/lib/modalUi'
import { Label } from '@/components/ui/label'
import { useState } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { X } from 'lucide-react'
import { useCreateHRDepartment, useUpdateHRDepartment } from '@/hooks/useVendor'
import type { HRDepartment } from '@/types'

interface DeptModalProps {
  dept?: HRDepartment | null
  departments: HRDepartment[]
  onClose: () => void
  onCreated?: (dept: HRDepartment) => void
}

export function DeptModal({
 dept, departments: _departments, onClose, onCreated }: DeptModalProps) {
  useEscapeToClose(onClose)

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
    <div data-kiterp-modal className={dialogOverlayClassZ60} onClick={onModalBackdropClick(onClose)}>
      <div className={cn(dialogPanelClass, 'max-w-md')} onClick={e => e.stopPropagation()}>
        <div className={cn(dialogHeaderClass, 'flex items-start justify-between gap-3')}>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{dept ? 'Edit Department' : 'New Department'}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className={cn(dialogBodyClass, 'space-y-4')}>
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-1" required>Name</Label>
              <input
                autoFocus
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-1">Code</Label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. ENG, HR, FIN"
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
              />
            </div>
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-1">Description</Label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                rows={2}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <div className={cn(dialogFooterClass, 'gap-3')}>
            <button type="button" onClick={onClose} className="btn-cancel px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button type="submit" disabled={busy} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
              {busy ? 'Saving…' : dept ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
