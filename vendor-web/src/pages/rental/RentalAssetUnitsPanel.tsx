import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, AlertTriangle, Layers, Loader2, Pencil, Plus, Trash2, WrenchIcon, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { FieldLabel } from '@/components/common/FieldLabel'
import { extractApiError } from '@/lib/errorMessages'
import { cn } from '@/lib/utils'
import { rentalApi } from './api'
import type { RentalAssetUnit } from './rentalConstants'

const CONDITION_OPTIONS = [
  { value: 'good', label: 'Good' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'lost', label: 'Lost' },
  { value: 'retired', label: 'Retired' },
]

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'rented', label: 'Rented' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'retired', label: 'Retired' },
]

function conditionIcon(condition: string) {
  if (condition === 'good') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
  if (condition === 'damaged') return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
  if (condition === 'lost') return <XCircle className="h-3.5 w-3.5 text-rose-500" />
  return <WrenchIcon className="h-3.5 w-3.5 text-gray-400" />
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    available: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300',
    rented: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300',
    maintenance: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300',
    retired: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800/40 dark:text-gray-400',
  }
  return cn(
    'inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium capitalize',
    map[status] ?? map.retired,
  )
}

// ── Single add form ───────────────────────────────────────────────────────────
type AddUnitForm = { serial_no: string; label: string; condition: string; notes: string }
const emptySingle = (): AddUnitForm => ({ serial_no: '', label: '', condition: 'good', notes: '' })

// ── Bulk add form ─────────────────────────────────────────────────────────────
type BulkForm = { prefix: string; start: string; end: string; padding: string; suffix: string; condition: string }
const emptyBulk = (): BulkForm => ({ prefix: '', start: '1', end: '10', padding: '3', suffix: '', condition: 'good' })

function buildPreview(f: BulkForm): string[] {
  const start = Math.max(1, Number(f.start) || 1)
  const end = Math.max(start, Number(f.end) || start)
  const pad = Math.max(0, Number(f.padding) || 0)
  const count = Math.min(end - start + 1, 500)
  return Array.from({ length: count }, (_, i) => {
    const n = start + i
    const num = pad > 0 ? String(n).padStart(pad, '0') : String(n)
    return `${f.prefix}${num}${f.suffix}`
  })
}

// ── Edit state ────────────────────────────────────────────────────────────────
type EditState = { unitId: string; form: { condition: string; status: string; notes: string } } | null

type Props = { assetId: string }
type AddMode = 'none' | 'single' | 'bulk'

export default function RentalAssetUnitsPanel({ assetId }: Props) {
  const qc = useQueryClient()
  const [addMode, setAddMode] = useState<AddMode>('none')
  const [singleForm, setSingleForm] = useState<AddUnitForm>(emptySingle())
  const [bulkForm, setBulkForm] = useState<BulkForm>(emptyBulk())
  const [editing, setEditing] = useState<EditState>(null)

  const { data: units = [], isLoading } = useQuery<RentalAssetUnit[]>({
    queryKey: ['rental-asset-units', assetId],
    queryFn: () => rentalApi.listAssetUnits(assetId),
    enabled: Boolean(assetId),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['rental-asset-units', assetId] })

  const createUnit = useMutation({
    mutationFn: (body: Record<string, unknown>) => rentalApi.createAssetUnit(assetId, body),
    onSuccess: () => {
      toast.success('Unit added')
      setSingleForm(emptySingle())
      setAddMode('none')
      invalidate()
    },
    onError: (e) => toast.error(extractApiError(e, 'Add unit')),
  })

  const bulkCreate = useMutation({
    mutationFn: (body: Record<string, unknown>) => rentalApi.bulkCreateAssetUnits(assetId, body),
    onSuccess: (data) => {
      toast.success(`${data.length} unit${data.length !== 1 ? 's' : ''} created`)
      setBulkForm(emptyBulk())
      setAddMode('none')
      invalidate()
    },
    onError: (e) => toast.error(extractApiError(e, 'Bulk create units')),
  })

  const updateUnit = useMutation({
    mutationFn: ({ unitId, body }: { unitId: string; body: Record<string, unknown> }) =>
      rentalApi.updateAssetUnit(assetId, unitId, body),
    onSuccess: () => { toast.success('Unit updated'); setEditing(null); invalidate() },
    onError: (e) => toast.error(extractApiError(e, 'Update unit')),
  })

  const deleteUnit = useMutation({
    mutationFn: (unitId: string) => rentalApi.deleteAssetUnit(assetId, unitId),
    onSuccess: () => { toast.success('Unit removed'); invalidate() },
    onError: (e) => toast.error(extractApiError(e, 'Remove unit')),
  })

  // Live preview for bulk mode
  const bulkPreview = useMemo(() => buildPreview(bulkForm), [bulkForm])
  const bulkCount = bulkPreview.length

  const submitSingle = () => {
    if (!singleForm.serial_no.trim()) { toast.error('Serial number is required'); return }
    createUnit.mutate({
      serial_no: singleForm.serial_no.trim(),
      label: singleForm.label.trim() || undefined,
      condition: singleForm.condition,
      notes: singleForm.notes.trim() || undefined,
    })
  }

  const submitBulk = () => {
    const start = Number(bulkForm.start)
    const end = Number(bulkForm.end)
    if (!start || start < 1) { toast.error('Start must be ≥ 1'); return }
    if (end < start) { toast.error('End must be ≥ start'); return }
    if (end - start + 1 > 500) { toast.error('Cannot create more than 500 units at once'); return }
    bulkCreate.mutate({
      prefix: bulkForm.prefix,
      suffix: bulkForm.suffix || undefined,
      start,
      end,
      padding: Number(bulkForm.padding) || 0,
      condition: bulkForm.condition,
    })
  }

  const cancelAdd = () => { setAddMode('none'); setSingleForm(emptySingle()); setBulkForm(emptyBulk()) }

  return (
    <div className="space-y-3">
      {/* ── Unit list ── */}
      {isLoading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading units…
        </div>
      ) : units.length === 0 && addMode === 'none' ? (
        <p className="py-2 text-center text-xs text-muted-foreground">No units added yet.</p>
      ) : units.length > 0 ? (
        <div className="divide-y divide-border rounded-lg border">
          {units.map((u) => (
            <div key={u.id} className="flex items-center gap-2 px-3 py-2">
              {conditionIcon(u.condition)}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{u.serial_no}{u.label ? ` · ${u.label}` : ''}</p>
                {u.notes && <p className="truncate text-xs text-muted-foreground">{u.notes}</p>}
              </div>
              <span className={statusBadge(u.status)}>{u.status}</span>
              <Button
                variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                onClick={() => setEditing({ unitId: u.id, form: { condition: u.condition, status: u.status, notes: u.notes ?? '' } })}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost" size="icon"
                className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                disabled={deleteUnit.isPending}
                onClick={() => deleteUnit.mutate(u.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {/* ── Edit inline form ── */}
      {editing && (
        <div className="rounded-lg border border-sky-200 bg-sky-500/5 p-3 space-y-2">
          <p className="text-xs font-medium text-sky-700 dark:text-sky-300">Edit unit</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel className="text-xs">Condition</FieldLabel>
              <Select
                value={editing.form.condition}
                onChange={(v) => setEditing((e) => e && { ...e, form: { ...e.form, condition: v } })}
                options={CONDITION_OPTIONS}
              />
            </div>
            <div>
              <FieldLabel className="text-xs">Status</FieldLabel>
              <Select
                value={editing.form.status}
                onChange={(v) => setEditing((e) => e && { ...e, form: { ...e.form, status: v } })}
                options={STATUS_OPTIONS}
              />
            </div>
          </div>
          <div>
            <FieldLabel className="text-xs">Notes</FieldLabel>
            <Input
              placeholder="Optional notes"
              value={editing.form.notes}
              onChange={(e) => setEditing((s) => s && { ...s, form: { ...s.form, notes: e.target.value } })}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={updateUnit.isPending} onClick={() => updateUnit.mutate({ unitId: editing.unitId, body: editing.form })}>
              {updateUnit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ── Single add form ── */}
      {addMode === 'single' && (
        <div className="rounded-lg border border-dashed p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">New unit</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel className="text-xs">Serial No <span className="text-destructive">*</span></FieldLabel>
              <Input
                placeholder="e.g. RACK-001"
                value={singleForm.serial_no}
                onChange={(e) => setSingleForm((f) => ({ ...f, serial_no: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel className="text-xs">Label</FieldLabel>
              <Input
                placeholder="Optional display name"
                value={singleForm.label}
                onChange={(e) => setSingleForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <FieldLabel className="text-xs">Initial Condition</FieldLabel>
            <Select value={singleForm.condition} onChange={(v) => setSingleForm((f) => ({ ...f, condition: v }))} options={CONDITION_OPTIONS} />
          </div>
          <div>
            <FieldLabel className="text-xs">Notes</FieldLabel>
            <Input placeholder="Optional notes" value={singleForm.notes} onChange={(e) => setSingleForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={createUnit.isPending} onClick={submitSingle}>
              {createUnit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Unit'}
            </Button>
            <Button size="sm" variant="outline" onClick={cancelAdd}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ── Bulk add form ── */}
      {addMode === 'bulk' && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <p className="text-xs font-semibold text-primary">Bulk create with sequence</p>
          </div>

          {/* Sequence builder */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <FieldLabel className="text-xs">Prefix</FieldLabel>
              <Input
                placeholder="e.g. RACK-"
                value={bulkForm.prefix}
                onChange={(e) => setBulkForm((f) => ({ ...f, prefix: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel className="text-xs">Start №</FieldLabel>
              <Input
                type="number" min={1}
                value={bulkForm.start}
                onChange={(e) => setBulkForm((f) => ({ ...f, start: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel className="text-xs">End №</FieldLabel>
              <Input
                type="number" min={bulkForm.start || 1}
                value={bulkForm.end}
                onChange={(e) => setBulkForm((f) => ({ ...f, end: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel className="text-xs">Digit padding</FieldLabel>
              <Input
                type="number" min={0} max={6} placeholder="3 → 001"
                value={bulkForm.padding}
                onChange={(e) => setBulkForm((f) => ({ ...f, padding: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel className="text-xs">Suffix (optional)</FieldLabel>
              <Input
                placeholder="e.g. -A or empty"
                value={bulkForm.suffix}
                onChange={(e) => setBulkForm((f) => ({ ...f, suffix: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel className="text-xs">Initial Condition</FieldLabel>
              <Select value={bulkForm.condition} onChange={(v) => setBulkForm((f) => ({ ...f, condition: v }))} options={CONDITION_OPTIONS} />
            </div>
          </div>

          {/* Live preview */}
          {bulkCount > 0 && (
            <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs space-y-1">
              <p className="font-medium text-foreground">
                Preview — {bulkCount} unit{bulkCount !== 1 ? 's' : ''} will be created:
              </p>
              <p className="text-muted-foreground font-mono break-all leading-relaxed">
                {bulkPreview.slice(0, 6).join(', ')}
                {bulkCount > 6 && (
                  <span className="text-muted-foreground/60">
                    {' '}… {bulkPreview[bulkCount - 1]}
                  </span>
                )}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={bulkCreate.isPending || bulkCount === 0 || bulkCount > 500}
              onClick={submitBulk}
            >
              {bulkCreate.isPending
                ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Creating…</>
                : `Create ${bulkCount} Unit${bulkCount !== 1 ? 's' : ''}`}
            </Button>
            <Button size="sm" variant="outline" onClick={cancelAdd}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ── Add buttons (shown only when no form is open) ── */}
      {addMode === 'none' && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => setAddMode('single')}>
            <Plus className="mr-1.5 h-4 w-4" /> Add Single
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAddMode('bulk')}>
            <Layers className="mr-1.5 h-4 w-4" /> Bulk Add (Sequence)
          </Button>
        </div>
      )}
    </div>
  )
}
