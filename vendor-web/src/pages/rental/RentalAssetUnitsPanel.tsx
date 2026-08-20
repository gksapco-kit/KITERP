import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2, AlertTriangle, Layers, Loader2, Pencil,
  Plus, Search, Trash2, WrenchIcon, XCircle, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { FieldLabel } from '@/components/common/FieldLabel'
import { extractApiError } from '@/lib/errorMessages'
import { cn } from '@/lib/utils'
import { rentalApi } from './api'
import type { RentalAssetUnit } from './rentalConstants'

// ── Options ───────────────────────────────────────────────────────────────────

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

/** Fixed column widths so header + rows stay aligned */
const COL = {
  check: 'w-8',
  condition: 'w-[5.5rem]',
  status: 'w-[5.5rem]',
  actions: 'w-[4.25rem]',
} as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function conditionIcon(condition: string) {
  if (condition === 'good') return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
  if (condition === 'damaged') return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
  if (condition === 'lost') return <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
  return <WrenchIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    available: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800',
    rented: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-800',
    maintenance: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800',
    retired: 'bg-muted text-muted-foreground border-border',
  }
  return cn(
    'inline-flex max-w-full items-center truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium capitalize',
    map[status] ?? map.retired,
  )
}

function conditionBadge(condition: string) {
  const map: Record<string, string> = {
    good: 'bg-transparent text-muted-foreground border-border',
    damaged: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800',
    lost: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800',
    retired: 'bg-muted text-muted-foreground border-border',
  }
  return cn(
    'inline-flex max-w-full items-center truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium capitalize',
    map[condition] ?? map.good,
  )
}

// ── Rollup chip ───────────────────────────────────────────────────────────────

function RollupChip({
  label, count, dotClass, active, onClick, title,
}: {
  label: string
  count: number
  dotClass: string
  active: boolean
  onClick: () => void
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? `Filter by ${label}`}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors',
        active
          ? 'border-foreground/25 bg-foreground text-background font-semibold shadow-sm'
          : 'border-transparent bg-muted/60 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground font-medium',
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', active ? 'bg-background/80' : dotClass)} />
      <span className="tabular-nums">{count}</span>
      <span>{label}</span>
    </button>
  )
}

// ── Bulk action bar ───────────────────────────────────────────────────────────

function BulkActionBar({
  count,
  onSetStatus,
  onSetCondition,
  onDeselect,
  isPending,
}: {
  count: number
  onSetStatus: (v: string) => void
  onSetCondition: (v: string) => void
  onDeselect: () => void
  isPending: boolean
}) {
  const [bulkStatus, setBulkStatus] = useState('')
  const [bulkCondition, setBulkCondition] = useState('')

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-200 bg-sky-500/8 px-3 py-2 dark:border-sky-800/60 dark:bg-sky-950/30">
      <span className="shrink-0 text-xs font-semibold text-sky-700 dark:text-sky-300">
        {count} selected
      </span>
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <Select
          value={bulkStatus}
          onChange={(v) => { setBulkStatus(v); if (v) { onSetStatus(v); setBulkStatus('') } }}
          options={[{ value: '', label: 'Set status…' }, ...STATUS_OPTIONS]}
          wrapperClassName="w-40"
          disabled={isPending}
        />
        <Select
          value={bulkCondition}
          onChange={(v) => { setBulkCondition(v); if (v) { onSetCondition(v); setBulkCondition('') } }}
          options={[{ value: '', label: 'Set condition…' }, ...CONDITION_OPTIONS]}
          wrapperClassName="w-40"
          disabled={isPending}
        />
        {isPending && <Loader2 className="h-4 w-4 animate-spin text-sky-600" />}
      </div>
      <button
        type="button"
        onClick={onDeselect}
        className="ml-auto shrink-0 rounded p-1 text-sky-600 hover:bg-sky-200/60 dark:hover:bg-sky-900/40"
        title="Clear selection"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ── Form types ────────────────────────────────────────────────────────────────

type AddUnitForm = { serial_no: string; label: string; condition: string; notes: string }
const emptySingle = (): AddUnitForm => ({ serial_no: '', label: '', condition: 'good', notes: '' })

type BulkForm = {
  prefix: string
  count: string
  padding: string
  suffix: string
  condition: string
  /** When true, start continues from the last existing serial; false = manual override */
  autoContinue: boolean
  manualStart: string
}
const emptyBulk = (): BulkForm => ({
  prefix: '', count: '10', padding: '3', suffix: '',
  condition: 'good', autoContinue: true, manualStart: '1',
})

/** Scan existing units and return the highest numeric value matching prefix/suffix */
function nextAutoStart(units: RentalAssetUnit[], prefix: string, suffix: string): number {
  if (!prefix && !suffix) return 1
  const escPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escSuffix = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`^${escPrefix}(\\d+)${escSuffix}$`)
  let max = 0
  for (const u of units) {
    const m = re.exec(u.serial_no)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max + 1
}

function buildBulkPreview(start: number, count: number, pad: number, prefix: string, suffix: string): string[] {
  const n = Math.min(Math.max(0, count), 500)
  return Array.from({ length: n }, (_, i) => {
    const num = pad > 0 ? String(start + i).padStart(pad, '0') : String(start + i)
    return `${prefix}${num}${suffix}`
  })
}

type EditState = { unitId: string; form: { condition: string; status: string; notes: string } } | null
type AddMode = 'none' | 'single' | 'bulk'

// ── Main panel ────────────────────────────────────────────────────────────────

export default function RentalAssetUnitsPanel({
  assetId,
  readOnly = false,
}: {
  assetId: string
  /** View-only: hide add / edit / delete / bulk selection */
  readOnly?: boolean
}) {
  const qc = useQueryClient()
  const [addMode, setAddMode] = useState<AddMode>('none')
  const [singleForm, setSingleForm] = useState<AddUnitForm>(emptySingle())
  const [bulkForm, setBulkForm] = useState<BulkForm>(emptyBulk())
  const [editing, setEditing] = useState<EditState>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCondition, setFilterCondition] = useState('')

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkPending, setBulkPending] = useState(false)

  const { data: units = [], isLoading } = useQuery<RentalAssetUnit[]>({
    queryKey: ['rental-asset-units', assetId],
    queryFn: () => rentalApi.listAssetUnits(assetId),
    enabled: Boolean(assetId),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['rental-asset-units', assetId] })
    setSelected(new Set())
  }

  // ── Rollup counts ──────────────────────────────────────────────────────────
  const rollup = useMemo(() => {
    const counts: Record<string, number> = { available: 0, rented: 0, maintenance: 0, damaged: 0, retired: 0 }
    for (const u of units) {
      if (u.status in counts) counts[u.status]++
      if (u.condition === 'damaged' || u.condition === 'lost') counts.damaged++
    }
    return counts
  }, [units])

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return units.filter((u) => {
      if (filterStatus && u.status !== filterStatus) return false
      if (filterCondition === 'damaged_lost') {
        if (u.condition !== 'damaged' && u.condition !== 'lost') return false
      } else if (filterCondition && u.condition !== filterCondition) {
        return false
      }
      if (q && !`${u.serial_no} ${u.label ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [units, search, filterStatus, filterCondition])

  const allFilteredSelected = filtered.length > 0 && filtered.every((u) => selected.has(u.id))

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected((s) => { const n = new Set(s); filtered.forEach((u) => n.delete(u.id)); return n })
    } else {
      setSelected((s) => { const n = new Set(s); filtered.forEach((u) => n.add(u.id)); return n })
    }
  }

  const toggleOne = (id: string) => {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const clearFilters = () => { setSearch(''); setFilterStatus(''); setFilterCondition('') }
  const hasFilters = Boolean(search || filterStatus || filterCondition)

  const toggleStatusFilter = (status: string) => {
    setFilterStatus((v) => (v === status ? '' : status))
  }

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createUnit = useMutation({
    mutationFn: (body: Record<string, unknown>) => rentalApi.createAssetUnit(assetId, body),
    onSuccess: () => { toast.success('Unit added'); setSingleForm(emptySingle()); setAddMode('none'); invalidate() },
    onError: (e) => toast.error(extractApiError(e, 'Add unit')),
  })

  const bulkCreate = useMutation({
    mutationFn: (body: Record<string, unknown>) => rentalApi.bulkCreateAssetUnits(assetId, body),
    onSuccess: (data) => {
      toast.success(`${data.length} unit${data.length !== 1 ? 's' : ''} created`)
      setBulkForm(emptyBulk()); setAddMode('none'); invalidate()
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

  // ── Bulk update (optimistic parallel patch) ────────────────────────────────
  const handleBulkUpdate = async (patch: { status?: string; condition?: string }) => {
    if (selected.size === 0) return
    setBulkPending(true)
    try {
      await Promise.all(
        [...selected].map((id) => rentalApi.updateAssetUnit(assetId, id, patch)),
      )
      toast.success(`${selected.size} unit${selected.size > 1 ? 's' : ''} updated`)
      invalidate()
    } catch (e) {
      toast.error(extractApiError(e, 'Bulk update'))
    } finally {
      setBulkPending(false)
    }
  }

  // ── Form helpers ───────────────────────────────────────────────────────────
  const bulkStart = useMemo(() => {
    if (!bulkForm.autoContinue) return Math.max(1, Number(bulkForm.manualStart) || 1)
    return nextAutoStart(units, bulkForm.prefix, bulkForm.suffix)
  }, [units, bulkForm.autoContinue, bulkForm.manualStart, bulkForm.prefix, bulkForm.suffix])

  const bulkPreview = useMemo(() => buildBulkPreview(
    bulkStart,
    Math.max(0, Number(bulkForm.count) || 0),
    Math.max(0, Number(bulkForm.padding) || 0),
    bulkForm.prefix,
    bulkForm.suffix,
  ), [bulkStart, bulkForm.count, bulkForm.padding, bulkForm.prefix, bulkForm.suffix])

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
    const count = Number(bulkForm.count)
    if (!count || count < 1) { toast.error('Quantity must be at least 1'); return }
    if (count > 500) { toast.error('Cannot create more than 500 units at once'); return }
    const end = bulkStart + count - 1
    bulkCreate.mutate({
      prefix: bulkForm.prefix,
      suffix: bulkForm.suffix || undefined,
      start: bulkStart,
      end,
      padding: Number(bulkForm.padding) || 0,
      condition: bulkForm.condition,
    })
  }

  const cancelAdd = () => { setAddMode('none'); setSingleForm(emptySingle()); setBulkForm(emptyBulk()) }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-baseline gap-2">
          <h4 className="text-sm font-semibold text-foreground">Serial units</h4>
          {units.length > 0 && (
            <span className="tabular-nums text-xs text-muted-foreground">
              {hasFilters ? `${filtered.length} of ${units.length}` : units.length}
            </span>
          )}
        </div>
        {addMode === 'none' ? (
          !readOnly ? (
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="h-8" onClick={() => setAddMode('single')}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setAddMode('bulk')}>
              <Layers className="mr-1 h-3.5 w-3.5" /> Bulk sequence
            </Button>
          </div>
          ) : null
        ) : (
          <button
            type="button"
            onClick={cancelAdd}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
        )}
      </div>

      {/* ── Single add form ─────────────────────────────────────── */}
      {!readOnly && addMode === 'single' && (
        <div className="space-y-3 border-t border-border bg-muted/20 px-3 py-3 sm:px-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Serial No <span className="text-destructive">*</span></FieldLabel>
              <Input
                placeholder="e.g. AST-001"
                value={singleForm.serial_no}
                onChange={(e) => setSingleForm((f) => ({ ...f, serial_no: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') submitSingle() }}
                autoFocus
              />
            </div>
            <div>
              <FieldLabel>Label</FieldLabel>
              <Input placeholder="Optional display name" value={singleForm.label} onChange={(e) => setSingleForm((f) => ({ ...f, label: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Initial Condition</FieldLabel>
              <Select value={singleForm.condition} onChange={(v) => setSingleForm((f) => ({ ...f, condition: v }))} options={CONDITION_OPTIONS} />
            </div>
            <div>
              <FieldLabel>Notes</FieldLabel>
              <Input placeholder="Optional" value={singleForm.notes} onChange={(e) => setSingleForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={createUnit.isPending} onClick={submitSingle}>
              {createUnit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Unit'}
            </Button>
            <Button size="sm" variant="outline" onClick={cancelAdd}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ── Bulk add form ────────────────────────────────────────── */}
      {!readOnly && addMode === 'bulk' && (
        <div className="space-y-4 border-t border-border bg-muted/20 px-3 py-3 sm:px-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <FieldLabel>Prefix</FieldLabel>
              <Input placeholder="e.g. CRATE" value={bulkForm.prefix} onChange={(e) => setBulkForm((f) => ({ ...f, prefix: e.target.value }))} autoFocus />
            </div>
            <div>
              <FieldLabel>Suffix (optional)</FieldLabel>
              <Input placeholder="e.g. -A" value={bulkForm.suffix} onChange={(e) => setBulkForm((f) => ({ ...f, suffix: e.target.value }))} />
            </div>
            <div>
              <FieldLabel>Quantity</FieldLabel>
              <Input type="number" min={1} max={500} placeholder="e.g. 10" value={bulkForm.count} onChange={(e) => setBulkForm((f) => ({ ...f, count: e.target.value }))} />
            </div>
            <div>
              <FieldLabel>Digit padding</FieldLabel>
              <Input type="number" min={0} max={6} placeholder="3 → 001" value={bulkForm.padding} onChange={(e) => setBulkForm((f) => ({ ...f, padding: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Starting number</FieldLabel>
              <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={bulkForm.autoContinue}
                  onChange={(e) => setBulkForm((f) => ({ ...f, autoContinue: e.target.checked }))}
                  className="accent-primary"
                />
                Auto-continue from {bulkStart}
              </label>
              {!bulkForm.autoContinue && (
                <Input type="number" min={1} className="mt-1.5" placeholder="Start from" value={bulkForm.manualStart} onChange={(e) => setBulkForm((f) => ({ ...f, manualStart: e.target.value }))} />
              )}
            </div>
            <div>
              <FieldLabel>Initial Condition</FieldLabel>
              <Select value={bulkForm.condition} onChange={(v) => setBulkForm((f) => ({ ...f, condition: v }))} options={CONDITION_OPTIONS} />
            </div>
          </div>
          {bulkCount > 0 && (
            <div className="space-y-1 rounded-md border border-border bg-background px-3 py-2 text-xs">
              <p className="font-semibold text-foreground">{bulkCount} unit{bulkCount !== 1 ? 's' : ''} will be created:</p>
              <p className="break-all font-mono leading-relaxed text-muted-foreground">
                {bulkPreview.slice(0, 8).join(', ')}
                {bulkCount > 8 && <span className="text-muted-foreground/60"> … {bulkPreview[bulkCount - 1]}</span>}
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" disabled={bulkCreate.isPending || bulkCount === 0 || bulkCount > 500} onClick={submitBulk}>
              {bulkCreate.isPending
                ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Creating…</>
                : `Create ${bulkCount} Unit${bulkCount !== 1 ? 's' : ''}`}
            </Button>
            <Button size="sm" variant="outline" onClick={cancelAdd}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ── Filters + search (one control strip) ─────────────────── */}
      {units.length > 0 && (
        <div className="space-y-2 border-t border-border px-3 py-2.5 sm:px-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <RollupChip
              label="available"
              count={rollup.available}
              dotClass="bg-emerald-500"
              active={filterStatus === 'available'}
              onClick={() => toggleStatusFilter('available')}
            />
            <RollupChip
              label="rented"
              count={rollup.rented}
              dotClass="bg-sky-500"
              active={filterStatus === 'rented'}
              onClick={() => toggleStatusFilter('rented')}
            />
            <RollupChip
              label="maintenance"
              count={rollup.maintenance}
              dotClass="bg-amber-500"
              active={filterStatus === 'maintenance'}
              onClick={() => toggleStatusFilter('maintenance')}
            />
            {(rollup.damaged > 0 || filterCondition === 'damaged_lost') && (
              <RollupChip
                label="damaged/lost"
                count={rollup.damaged}
                dotClass="bg-orange-500"
                active={filterCondition === 'damaged_lost'}
                onClick={() => setFilterCondition((v) => (v === 'damaged_lost' ? '' : 'damaged_lost'))}
                title="Filter damaged or lost units"
              />
            )}
            {(rollup.retired > 0 || filterStatus === 'retired') && (
              <RollupChip
                label="retired"
                count={rollup.retired}
                dotClass="bg-muted-foreground/50"
                active={filterStatus === 'retired'}
                onClick={() => toggleStatusFilter('retired')}
              />
            )}
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-0.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[10rem] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-8 pl-8 text-xs"
                placeholder="Search serial no or label…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              value={filterStatus || '__all__'}
              onChange={(v) => setFilterStatus(v === '__all__' ? '' : v)}
              options={[{ value: '__all__', label: 'All statuses' }, ...STATUS_OPTIONS]}
              wrapperClassName="w-[8.5rem]"
            />
            <Select
              value={filterCondition === 'damaged_lost' ? '__all__' : (filterCondition || '__all__')}
              onChange={(v) => setFilterCondition(v === '__all__' ? '' : v)}
              options={[{ value: '__all__', label: 'All conditions' }, ...CONDITION_OPTIONS]}
              wrapperClassName="w-[8.5rem]"
            />
          </div>
        </div>
      )}

      {/* ── Bulk action bar ─────────────────────────────────────── */}
      {!readOnly && selected.size > 0 && (
        <div className="border-t border-border px-3 py-2 sm:px-4">
          <BulkActionBar
            count={selected.size}
            onSetStatus={(v) => handleBulkUpdate({ status: v })}
            onSetCondition={(v) => handleBulkUpdate({ condition: v })}
            onDeselect={() => setSelected(new Set())}
            isPending={bulkPending}
          />
        </div>
      )}

      {/* ── Unit list ───────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center gap-2 border-t border-border px-4 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading units…
        </div>
      ) : units.length === 0 ? (
        <div className="border-t border-border py-10 text-center">
          <Layers className="mx-auto mb-2 h-7 w-7 text-muted-foreground/35" />
          <p className="text-sm font-medium text-foreground">No units yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {readOnly
              ? 'Add serialized units from Edit Asset.'
              : 'Add a single serial or generate a bulk sequence.'}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="border-t border-border py-8 text-center">
          <p className="text-sm text-muted-foreground">No units match the current filters.</p>
          <button type="button" onClick={clearFilters} className="mt-1 text-xs text-primary hover:underline">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="border-t border-border">
          {/* Sticky column header */}
          <div className="sticky top-0 z-[1] flex items-center gap-2 border-b border-border bg-muted/50 px-3 py-1.5 sm:px-4">
            {!readOnly && (
              <div className={cn(COL.check, 'flex justify-center')}>
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleAll}
                  className="h-3.5 w-3.5 rounded border-border"
                  title="Select all visible"
                />
              </div>
            )}
            <span className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Serial / Label
            </span>
            <span className={cn(COL.condition, 'text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground')}>
              Condition
            </span>
            <span className={cn(COL.status, 'text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground')}>
              Status
            </span>
            {!readOnly && <span className={COL.actions} aria-hidden />}
          </div>

          {/* Scrollable body — keeps the form usable with hundreds of units */}
          <div className="max-h-[min(28rem,55vh)] divide-y divide-border overflow-y-auto">
            {filtered.map((u) => (
              <div key={u.id}>
                <div
                  className={cn(
                    'group flex items-center gap-2 px-3 py-2 transition-colors hover:bg-muted/30 sm:px-4',
                    !readOnly && selected.has(u.id) && 'bg-sky-500/5',
                    !readOnly && editing?.unitId === u.id && 'bg-muted/20',
                  )}
                >
                  {!readOnly && (
                    <div className={cn(COL.check, 'flex justify-center')}>
                      <input
                        type="checkbox"
                        checked={selected.has(u.id)}
                        onChange={() => toggleOne(u.id)}
                        className="h-3.5 w-3.5 rounded border-border"
                      />
                    </div>
                  )}
                  {conditionIcon(u.condition)}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight">
                      {u.serial_no}
                      {u.label ? <span className="font-normal text-muted-foreground"> · {u.label}</span> : null}
                    </p>
                    {u.notes ? <p className="truncate text-[11px] text-muted-foreground">{u.notes}</p> : null}
                  </div>
                  <div className={cn(COL.condition, 'flex justify-end')}>
                    <span className={conditionBadge(u.condition)}>{u.condition}</span>
                  </div>
                  <div className={cn(COL.status, 'flex justify-end')}>
                    <span className={statusBadge(u.status)}>{u.status}</span>
                  </div>
                  {!readOnly && (
                    <div className={cn(COL.actions, 'flex justify-end gap-0.5 opacity-70 group-hover:opacity-100')}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setEditing({
                          unitId: u.id,
                          form: { condition: u.condition, status: u.status, notes: u.notes ?? '' },
                        })}
                        title="Edit unit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        disabled={deleteUnit.isPending}
                        onClick={() => deleteUnit.mutate(u.id)}
                        title="Delete unit"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {!readOnly && editing?.unitId === u.id && (
                  <div className="space-y-2 border-t border-border/60 bg-muted/15 px-3 py-3 sm:px-4 sm:pl-12">
                    <p className="text-xs font-semibold text-foreground">Edit · {u.serial_no}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <FieldLabel>Condition</FieldLabel>
                        <Select
                          value={editing.form.condition}
                          onChange={(v) => setEditing((e) => e && { ...e, form: { ...e.form, condition: v } })}
                          options={CONDITION_OPTIONS}
                        />
                      </div>
                      <div>
                        <FieldLabel>Status</FieldLabel>
                        <Select
                          value={editing.form.status}
                          onChange={(v) => setEditing((e) => e && { ...e, form: { ...e.form, status: v } })}
                          options={STATUS_OPTIONS}
                        />
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Notes</FieldLabel>
                      <Input
                        placeholder="Optional notes"
                        value={editing.form.notes}
                        onChange={(e) => setEditing((s) => s && { ...s, form: { ...s.form, notes: e.target.value } })}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={updateUnit.isPending}
                        onClick={() => updateUnit.mutate({ unitId: editing.unitId, body: editing.form })}
                      >
                        {updateUnit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
