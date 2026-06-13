import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Save, Trash2, X } from 'lucide-react'
import { vendorApi, type SchemaFieldMappingRecord } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { applyFieldMappings } from '@/lib/fieldMappingRuntime'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { toast } from 'sonner'

export type FieldMappingFormState = {
  table_name: string
  column_name: string
  ui_label: string
  help_short: string
  help_full: string
  screens: string
  note: string
}

type Props = {
  open: boolean
  onClose: () => void
  initial?: Partial<FieldMappingFormState> & { id?: string }
  mode: 'create' | 'edit'
}

function toScreensArray(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export default function FieldMappingModal({ open, onClose, initial, mode }: Props) {
  useEscapeToClose(onClose, open)
  const qc = useQueryClient()

  const [form, setForm] = useState<FieldMappingFormState>({
    table_name: '',
    column_name: '',
    ui_label: '',
    help_short: '',
    help_full: '',
    screens: '',
    note: '',
  })

  useEffect(() => {
    if (!open) return
    setForm({
      table_name: initial?.table_name ?? '',
      column_name: initial?.column_name ?? '',
      ui_label: initial?.ui_label ?? '',
      help_short: initial?.help_short ?? '',
      help_full: initial?.help_full ?? '',
      screens: initial?.screens ?? '',
      note: initial?.note ?? '',
    })
  }, [open, initial])

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['schema-models'] })
    await qc.invalidateQueries({ queryKey: ['schema-field-mappings'] })
    const fresh = await vendorApi.listSchemaFieldMappings()
    applyFieldMappings(fresh.items)
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        table_name: form.table_name.trim(),
        column_name: form.column_name.trim(),
        ui_label: form.ui_label.trim(),
        help_short: form.help_short.trim() || undefined,
        help_full: form.help_full.trim() || undefined,
        screens: toScreensArray(form.screens),
        note: form.note.trim() || undefined,
      }
      if (mode === 'edit' && initial?.id) {
        return vendorApi.updateSchemaFieldMapping(initial.id, payload)
      }
      return vendorApi.createSchemaFieldMapping(payload)
    },
    onSuccess: async () => {
      await invalidate()
      toast.success(mode === 'edit' ? 'Mapping updated' : 'Mapping created')
      onClose()
    },
    onError: (err: unknown) => {
      const raw =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Could not save mapping'
      const msg = typeof raw === 'string' ? raw : 'Could not save mapping'
      if (msg.includes('schema_field_mapping') && msg.includes('does not exist')) {
        toast.error(
          'Database migration required. Run: cd backend && venv\\Scripts\\alembic upgrade head',
          { duration: 8000 },
        )
        return
      }
      toast.error(msg.length > 180 ? 'Could not save mapping. Check backend logs.' : msg)
    },
  })

  const deleteMut = useMutation({
    mutationFn: () => vendorApi.deleteSchemaFieldMapping(initial!.id!),
    onSuccess: async () => {
      await invalidate()
      toast.success('Mapping removed')
      onClose()
    },
    onError: () => toast.error('Could not remove mapping'),
  })

  if (!open) return null

  const readOnlyKeys = mode === 'edit'

  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="field-mapping-title"
        className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-background shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="field-mapping-title" className="text-base font-semibold">
            {mode === 'edit' ? 'Edit field mapping' : 'Add field mapping'}
          </h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto px-4 py-4">
          <p className="text-xs text-muted-foreground">
            Map a database column to a UI label and help text. Use the same label on forms (e.g.{' '}
            <code className="rounded bg-muted px-1">&lt;Label&gt;{form.ui_label || 'Landmark'}&lt;/Label&gt;</code>
            ) to activate hover, F1, and wrench details without editing code registries.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Table</Label>
              <Input
                value={form.table_name}
                readOnly={readOnlyKeys}
                onChange={(e) => setForm((f) => ({ ...f, table_name: e.target.value }))}
                placeholder="vendor"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label>Column</Label>
              <Input
                value={form.column_name}
                readOnly={readOnlyKeys}
                onChange={(e) => setForm((f) => ({ ...f, column_name: e.target.value }))}
                placeholder="landmark"
                className="font-mono text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label required>UI label</Label>
            <Input
              value={form.ui_label}
              onChange={(e) => setForm((f) => ({ ...f, ui_label: e.target.value }))}
              placeholder="Landmark"
            />
          </div>

          <div className="space-y-1">
            <Label>Short help (hover)</Label>
            <Input
              value={form.help_short}
              onChange={(e) => setForm((f) => ({ ...f, help_short: e.target.value }))}
              placeholder="Nearby landmark for deliveries"
            />
          </div>

          <div className="space-y-1">
            <Label>Full help (F1 popup)</Label>
            <textarea
              value={form.help_full}
              onChange={(e) => setForm((f) => ({ ...f, help_full: e.target.value }))}
              placeholder="Longer explanation for staff…"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label>Screens (comma-separated)</Label>
            <Input
              value={form.screens}
              onChange={(e) => setForm((f) => ({ ...f, screens: e.target.value }))}
              placeholder="Settings · Addresses, Invoices"
            />
          </div>

          <div className="space-y-1">
            <Label>Note (optional)</Label>
            <Input
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="FK hint, JSONB path, etc."
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
          {mode === 'edit' && initial?.id ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={deleteMut.isPending}
              onClick={() => deleteMut.mutate()}
            >
              {deleteMut.isPending ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1 h-3.5 w-3.5" />
              )}
              Remove
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saveMut.isPending || !form.table_name || !form.column_name || !form.ui_label}
              onClick={() => saveMut.mutate()}
            >
              {saveMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save mapping
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function mappingRecordToForm(m: SchemaFieldMappingRecord): FieldMappingFormState & { id: string } {
  return {
    id: m.id,
    table_name: m.table_name,
    column_name: m.column_name,
    ui_label: m.ui_label,
    help_short: m.help_short ?? '',
    help_full: m.help_full ?? '',
    screens: (m.screens ?? []).join(', '),
    note: m.note ?? '',
  }
}
