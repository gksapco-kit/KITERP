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
import { useCreateHRDesignation, useUpdateHRDesignation, useHRDesignations } from '@/hooks/useVendor'
import type { HRDesignation } from '@/types'
import { extractApiError } from '@/lib/errorMessages'

interface DesigModalProps {
  desig?: HRDesignation | null
  onClose: () => void
  onCreated?: (desig: HRDesignation) => void
}

export function DesigModal({
 desig, onClose, onCreated }: DesigModalProps) {
  useEscapeToClose(onClose)

  const { data: designations = [] } = useHRDesignations()
  const create = useCreateHRDesignation()
  const update = useUpdateHRDesignation()
  const [form, setForm] = useState({ name: desig?.name ?? '', level: desig?.level ?? 1 })
  const [errors, setErrors] = useState<{ name?: string; level?: string }>({})
  const busy = create.isPending || update.isPending

  function validate(): boolean {
    const name = form.name.trim()
    const level = form.level
    const next: { name?: string; level?: string } = {}

    if (!name) {
      next.name = 'Title is required'
    } else if (name.length < 2) {
      next.name = 'Title must be at least 2 characters'
    }

    if (level < 1 || level > 20) {
      next.level = 'Level must be between 1 and 20'
    }

    const duplicate = designations.some(
      d =>
        d.id !== desig?.id &&
        d.name.trim().toLowerCase() === name.toLowerCase() &&
        d.level === level,
    )
    if (!next.name && duplicate) {
      next.name = `Designation "${name}" at level L${level} already exists`
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    const payload = { name: form.name.trim(), level: form.level }
    try {
      if (desig) {
        await update.mutateAsync({ id: desig.id, data: payload })
        onClose()
      } else {
        const created = await create.mutateAsync(payload) as HRDesignation
        onCreated?.(created)
        onClose()
      }
    } catch (err) {
      const msg = extractApiError(err, desig ? 'Could not update designation' : 'Could not create designation')
      const detail = msg.replace(/^[^:]+:\s*/i, '')
      const lower = detail.toLowerCase()
      if (lower.includes('level')) setErrors(p => ({ ...p, level: detail }))
      if (lower.includes('title') || lower.includes('name') || lower.includes('already exists') || lower.includes('characters')) {
        setErrors(p => ({ ...p, name: detail }))
      }
    }
  }

  return (
    <div data-kiterp-modal className={dialogOverlayClassZ60} onClick={onModalBackdropClick(onClose)}>
      <div className={cn(dialogPanelClass, 'max-w-sm')} onClick={e => e.stopPropagation()}>
        <div className={cn(dialogHeaderClass, 'flex items-start justify-between gap-3')}>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{desig ? 'Edit Designation' : 'New Designation'}</h2>
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
              <Label className="block text-sm font-medium text-gray-700 mb-1" required>Title</Label>
              <input
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none${errors.name ? ' border-red-500 bg-red-50' : ''}`}
                value={form.name}
                onChange={e => {
                  setForm(f => ({ ...f, name: e.target.value }))
                  setErrors(p => ({ ...p, name: undefined }))
                }}
                required
                minLength={2}
                maxLength={100}
              />
              {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
            </div>
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-1" required>Seniority Level</Label>
              <input
                type="number"
                min={1}
                max={20}
                required
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none${errors.level ? ' border-red-500 bg-red-50' : ''}`}
                value={form.level}
                onChange={e => {
                  setForm(f => ({ ...f, level: parseInt(e.target.value, 10) || 1 }))
                  setErrors(p => ({ ...p, level: undefined }))
                }}
              />
              {errors.level && <p className="text-xs text-red-600 mt-1">{errors.level}</p>}
              <p className="text-xs text-gray-400 mt-1">Higher number = more senior (e.g. L1 = junior, L10 = VP)</p>
            </div>
          </div>
          <div className={cn(dialogFooterClass, 'gap-3')}>
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
