import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Loader2, Dumbbell, ToggleLeft, ToggleRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { ResizableTable } from '@/components/table/ResizableTable'
import { InlineEditCell } from '@/components/table/InlineEditCell'
import { TableToolbar } from '@/components/table/TableToolbar'
import { useInlineFieldPatch, INLINE_EDIT_HINT } from '@/hooks/useInlineFieldPatch'
import { CheckboxFieldLabel, TableColumnLabel } from '@/components/common/FieldLabel'
import { cn, formatCurrency } from '@/lib/utils'
import { modalWidthMd } from '@/lib/modalUi'
import { processRows, type SortDir } from '@/lib/tableList'
import { onClickableTableRow } from '@/lib/clickableTableRow'
import {
  useFitnessClasses,
  useCreateFitnessClass,
  useUpdateFitnessClass,
  useDeleteFitnessClass,
  useToggleFitnessClassActive,
} from '@/hooks/useFitnessClasses'
import type { VendorFitnessClass, VendorFitnessClassCreate } from '@/api/fitnessClasses'

import { ThemeSelect } from '@/components/common/ThemeSelect'
import { askConfirm } from '@/components/common/ConfirmProvider'
const CLASS_TYPES = ['Yoga', 'HIIT', 'Cycle', 'Pilates', 'Strength', 'Boxing']
const INTENSITY_LEVELS = [1, 2, 3, 4, 5]

/** "2026-07-24" → "Fri, Jul 24" for display; falls back to the raw value for older free-text entries. */
function formatClassDate(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** "18:30" → "6:30 PM" for display; falls back to the raw value for older free-text entries. */
function formatClassTime(hhmm?: string | null): string {
  if (!hhmm) return ''
  const [hStr, mStr] = hhmm.split(':')
  const h = Number(hStr)
  if (Number.isNaN(h)) return hhmm
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mStr ?? '00'} ${period}`
}

function FitnessClassModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial?: VendorFitnessClass
  onClose: () => void
  onSave: (data: VendorFitnessClassCreate) => void
  saving: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [instructor, setInstructor] = useState(initial?.instructor ?? '')
  const [type, setType] = useState(initial?.type ?? 'Yoga')
  const [duration, setDuration] = useState(String(initial?.duration ?? 60))
  const [intensity, setIntensity] = useState(initial?.intensity ?? 3)
  const [date, setDate] = useState(initial?.date ?? '')
  const [time, setTime] = useState(initial?.time ?? '')
  const [capacity, setCapacity] = useState(String(initial?.capacity ?? 20))
  const [booked, setBooked] = useState(String(initial?.booked ?? 0))
  const [studio, setStudio] = useState(initial?.studio ?? '')
  const [price, setPrice] = useState(initial?.price != null ? String(initial.price) : '')
  const [currency, setCurrency] = useState(initial?.currency ?? 'USD')
  const [ctaLabel, setCtaLabel] = useState(initial?.cta_label ?? 'Reserve')
  const [sortOrder, setSortOrder] = useState(String(initial?.sort_order ?? 0))
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      instructor: instructor.trim() || undefined,
      type,
      duration: Number(duration) || 0,
      intensity,
      date: date.trim() || undefined,
      time: time.trim() || undefined,
      capacity: Number(capacity) || 0,
      booked: Number(booked) || 0,
      studio: studio.trim() || undefined,
      price: price.trim() ? Number(price) : null,
      currency: currency.trim() || 'USD',
      cta_label: ctaLabel.trim() || 'Reserve',
      sort_order: Number(sortOrder) || 0,
      is_active: isActive,
    })
  }

  const labelCls = 'text-[10px] leading-none'
  const fieldGap = 'space-y-0.5'
  const inputCls = 'h-7 text-xs'
  const selectCls = 'h-7 w-full rounded-md border border-input bg-background px-2 text-xs'

  return (
    <ModalOverlay onClose={onClose} className="z-[100] bg-black/60 p-2">
      <ModalPanel className={cn(modalWidthMd, 'max-h-[calc(100dvh-1rem)]')}>
        <ModalHeader
          title={initial ? 'Edit class' : 'New class'}
          onClose={onClose}
          className="border-0 px-3 py-2 [&>div>h2]:text-sm"
        />
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <ModalBody className="space-y-1.5 overflow-y-auto px-3 pb-2 pt-0">
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[1.4fr_1fr_7.5rem]">
              <div className={fieldGap}>
                <Label className={labelCls}>Class name *</Label>
                <Input className={inputCls} value={name} onChange={e => setName(e.target.value)} required autoFocus placeholder="Sunrise Vinyasa" />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Instructor</Label>
                <Input className={inputCls} value={instructor} onChange={e => setInstructor(e.target.value)} placeholder="Maya Lin" />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Type</Label>
                <ThemeSelect
                  value={type}
                  onChange={setType}
                  options={CLASS_TYPES.map(t => ({ value: t, label: t }))}
                  className={selectCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              <div className={fieldGap}>
                <Label className={labelCls}>Date</Label>
                <Input className={inputCls} type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Time</Label>
                <Input className={inputCls} type="time" value={time} onChange={e => setTime(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Duration (min)</Label>
                <Input className={inputCls} type="number" min={0} value={duration} onChange={e => setDuration(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Intensity</Label>
                <div className="flex h-7 gap-0.5">
                  {INTENSITY_LEVELS.map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setIntensity(lvl)}
                      className={cn(
                        'flex-1 rounded-md border text-[10px] font-semibold transition-colors',
                        intensity === lvl
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-muted-foreground hover:border-primary/40',
                      )}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              <div className={fieldGap}>
                <Label className={labelCls}>Capacity</Label>
                <Input className={inputCls} type="number" min={0} value={capacity} onChange={e => setCapacity(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Booked</Label>
                <Input className={inputCls} type="number" min={0} value={booked} onChange={e => setBooked(e.target.value)} />
              </div>
              <div className={cn(fieldGap, 'col-span-2')}>
                <Label className={labelCls}>Studio / room</Label>
                <Input className={inputCls} value={studio} onChange={e => setStudio(e.target.value)} placeholder="Studio A" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              <div className={fieldGap}>
                <Label className={labelCls}>Price</Label>
                <Input className={inputCls} type="number" min={0} step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Currency</Label>
                <Input className={inputCls} value={currency} onChange={e => setCurrency(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Button label</Label>
                <Input className={inputCls} value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Sort order</Label>
                <Input className={inputCls} type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
              </div>
            </div>
          </ModalBody>
          <ModalFooter className="items-center justify-between gap-2 border-0 bg-transparent px-3 py-2">
            <CheckboxFieldLabel
              label="Active on storefront"
              checked={isActive}
              onChange={setIsActive}
              labelClassName="text-xs"
            />
            <div className="flex gap-2">
              <Button type="button" variant="cancel" className="h-7 px-2.5 text-xs" onClick={onClose}>Cancel</Button>
              <Button type="submit" className="h-7 px-2.5 text-xs" disabled={saving || !name.trim()}>
                {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                {initial ? 'Save' : 'Create'}
              </Button>
            </div>
          </ModalFooter>
        </form>
      </ModalPanel>
    </ModalOverlay>
  )
}

export default function SalesFitnessClassesPage() {
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; cls?: VendorFitnessClass } | null>(null)
  const [sortKey, setSortKey] = useState('sort_order')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const { data, isLoading } = useFitnessClasses({ size: 100, search: search.trim() || undefined })
  const createClass = useCreateFitnessClass()
  const updateClass = useUpdateFitnessClass()
  const deleteClass = useDeleteFitnessClass()
  const toggleActive = useToggleFitnessClassActive()

  const rows = useMemo(() => {
    const items = data?.items ?? []
    return processRows(
      items,
      search,
      (c) => [c.name, c.instructor ?? '', c.type, c.studio ?? ''],
      sortKey,
      sortDir,
      {
        sort_order: (c) => c.sort_order,
        name: (c) => c.name,
        price: (c) => c.price ?? 0,
        capacity: (c) => c.capacity,
        type: (c) => c.type,
        is_active: (c) => (c.is_active ? 1 : 0),
      },
    )
  }, [data?.items, search, sortKey, sortDir])

  const saving = createClass.isPending || updateClass.isPending
  const { isSaving, patchField } = useInlineFieldPatch(updateClass)

  return (
    <div className="space-y-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="flex items-center gap-1.5 text-lg font-semibold leading-tight">
            <Dumbbell className="h-4 w-4 shrink-0 text-primary" />
            Fitness Schedule
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Storefront classes · syncs to Website Builder
          </p>
        </div>
        <Button onClick={() => setModal({ mode: 'create' })} className="h-8 gap-1.5 px-3 text-sm shrink-0">
          <Plus className="h-3.5 w-3.5" /> Add class
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search classes…"
            sortOptions={[
              { value: 'sort_order', label: 'Order' },
              { value: 'name', label: 'Name' },
              { value: 'price', label: 'Price' },
              { value: 'capacity', label: 'Capacity' },
              { value: 'type', label: 'Type' },
              { value: 'is_active', label: 'Active' },
            ]}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKeyChange={setSortKey}
            onSortDirChange={setSortDir}
            hint={INLINE_EDIT_HINT}
          />
          <div className="overflow-x-auto">
            <ResizableTable tableId="sales-fitness-classes-v1" defaultWidths={[64, 200, 130, 100, 130, 100, 90, 120]}>
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Order</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Class</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Instructor</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Type</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Time</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Spots</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Active</TableColumnLabel></th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Actions</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={8} className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">No classes yet. Add your first class to sync with the website builder.</td></tr>
                ) : rows.map(cls => (
                  <tr
                    key={cls.id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={onClickableTableRow(() => setModal({ mode: 'edit', cls }))}
                  >
                    <td className="px-4 py-3 text-sm">
                      <InlineEditCell type="number" value={cls.sort_order} readOnly readOnlyMessage="Use the full editor to change sort order" title="Order">
                        {cls.sort_order}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      <div>
                        <InlineEditCell
                          value={cls.name}
                          saving={isSaving(cls.id, 'name')}
                          validate={(v) => String(v).trim().length < 1 ? 'Name is required' : null}
                          onSave={(v) => patchField(cls.id, 'name', String(v).trim())}
                          title="Edit class name"
                        >
                          <div className="line-clamp-1">{cls.name}</div>
                        </InlineEditCell>
                        <InlineEditCell
                          type="number"
                          value={cls.price ?? 0}
                          min={0}
                          step="0.01"
                          saving={isSaving(cls.id, 'price')}
                          validate={(v) => Number(v) < 0 ? 'Price must be 0 or more' : null}
                          onSave={(v) => patchField(cls.id, 'price', Number(v) || null)}
                          title="Edit price"
                        >
                          <div className="text-xs text-muted-foreground">{cls.price != null ? formatCurrency(cls.price, cls.currency) : '—'}</div>
                        </InlineEditCell>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <InlineEditCell
                        value={cls.instructor || ''}
                        saving={isSaving(cls.id, 'instructor')}
                        onSave={(v) => patchField(cls.id, 'instructor', String(v).trim() || null)}
                        title="Edit instructor"
                      >
                        {cls.instructor || '—'}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <InlineEditCell
                        type="select"
                        value={cls.type}
                        options={CLASS_TYPES.map(t => ({ value: t, label: t }))}
                        saving={isSaving(cls.id, 'type')}
                        onSave={(v) => patchField(cls.id, 'type', v)}
                        title="Edit class type"
                      >
                        {cls.type}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <div className="space-y-0.5">
                        <InlineEditCell
                          value={cls.time || ''}
                          saving={isSaving(cls.id, 'time')}
                          onSave={(v) => patchField(cls.id, 'time', String(v).trim() || null)}
                          title="Edit time (HH:MM)"
                        >
                          {cls.time ? formatClassTime(cls.time) : '—'}
                        </InlineEditCell>
                        <InlineEditCell
                          value={cls.date || ''}
                          saving={isSaving(cls.id, 'date')}
                          onSave={(v) => patchField(cls.id, 'date', String(v).trim() || null)}
                          title="Edit date (YYYY-MM-DD)"
                        >
                          <div className="text-xs">{cls.date ? formatClassDate(cls.date) : '—'}</div>
                        </InlineEditCell>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-0.5">
                        <InlineEditCell
                          type="number"
                          value={cls.booked}
                          readOnly
                          readOnlyMessage="Booked count is automatic"
                          title="Booked"
                        >
                          {cls.booked}
                        </InlineEditCell>
                        <span>/</span>
                        <InlineEditCell
                          type="number"
                          value={cls.capacity}
                          min={1}
                          step="1"
                          saving={isSaving(cls.id, 'capacity')}
                          validate={(v) => Number(v) < 1 ? 'Capacity must be at least 1' : null}
                          onSave={(v) => patchField(cls.id, 'capacity', Number(v) || 1)}
                          title="Edit capacity"
                        >
                          {cls.capacity}
                        </InlineEditCell>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <InlineEditCell
                        type="select"
                        value={cls.is_active ? 'true' : 'false'}
                        options={[
                          { value: 'true', label: 'Active' },
                          { value: 'false', label: 'Hidden' },
                        ]}
                        saving={isSaving(cls.id, 'is_active')}
                        onSave={(v) => patchField(cls.id, 'is_active', v === 'true')}
                        title="Edit active status"
                      >
                        {cls.is_active ? <span className="text-green-700 font-medium">Active</span> : <span className="text-muted-foreground">Hidden</span>}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title={cls.is_active ? 'Deactivate' : 'Activate'}
                          onClick={e => {
                            e.stopPropagation()
                            toggleActive.mutate({ id: cls.id, is_active: !cls.is_active })
                          }}
                          className="rounded p-1 hover:bg-muted"
                        >
                          {cls.is_active ? <ToggleRight className="h-4 w-4 text-primary" /> : <ToggleLeft className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          title="Edit"
                          onClick={e => { e.stopPropagation(); setModal({ mode: 'edit', cls }) }}
                          className="rounded p-1 hover:bg-muted"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={async e => {
                            e.stopPropagation()
                            if (await askConfirm(`Delete class "${cls.name}"?`)) deleteClass.mutate(cls.id)
                          }}
                          className="rounded p-1 hover:bg-muted text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </ResizableTable>
          </div>
        </CardContent>
      </Card>

      {modal && (
        <FitnessClassModal
          initial={modal.mode === 'edit' ? modal.cls : undefined}
          onClose={() => setModal(null)}
          saving={saving}
          onSave={data => {
            if (modal.mode === 'edit' && modal.cls) {
              updateClass.mutate({ id: modal.cls.id, data }, { onSuccess: () => setModal(null) })
            } else {
              createClass.mutate(data, { onSuccess: () => setModal(null) })
            }
          }}
        />
      )}
    </div>
  )
}
