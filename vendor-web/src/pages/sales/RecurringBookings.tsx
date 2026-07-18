import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, RefreshCw, ToggleLeft, ToggleRight, ImagePlus } from 'lucide-react'
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
import { cn, formatCurrency, isLikelyImageFile, mediaUrl } from '@/lib/utils'
import { modalWidthLg } from '@/lib/modalUi'
import { processRows, type SortDir } from '@/lib/tableList'
import { onClickableTableRow } from '@/lib/clickableTableRow'
import {
  useRecurringPlans,
  useCreateRecurringPlan,
  useUpdateRecurringPlan,
  useDeleteRecurringPlan,
  useToggleRecurringPlanActive,
} from '@/hooks/useRecurringPlans'
import { recurringPlansApi } from '@/api/recurringPlans'
import type { VendorRecurringPlan, VendorRecurringPlanCreate, VendorRecurringPreset } from '@/api/recurringPlans'

import { askConfirm } from '@/components/common/ConfirmProvider'
/** "2026-05-04" → "Mon, May 4, 2026" for display; falls back to the raw value for older free-text entries. */
function formatPlanDate(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

/** "07:30" → "7:30 AM" for display; falls back to the raw value for older free-text entries. */
function formatPlanTime(hhmm?: string | null): string {
  if (!hhmm) return ''
  const [hStr, mStr] = hhmm.split(':')
  const h = Number(hStr)
  if (Number.isNaN(h)) return hhmm
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mStr ?? '00'} ${period}`
}

function emptyPreset(): VendorRecurringPreset {
  return { name: '', description: '', discount_pct: 0 }
}

function PresetEditor({
  presets,
  onChange,
}: {
  presets: VendorRecurringPreset[]
  onChange: (presets: VendorRecurringPreset[]) => void
}) {
  const update = (idx: number, patch: Partial<VendorRecurringPreset>) => {
    onChange(presets.map((p, i) => (i === idx ? { ...p, ...patch } : p)))
  }
  const remove = (idx: number) => onChange(presets.filter((_, i) => i !== idx))

  return (
    <div className="space-y-1.5">
      {presets.length === 0 && (
        <p className="text-[11px] text-muted-foreground italic">Optional — add Weekly / Monthly options for guests.</p>
      )}
      {presets.map((p, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_4.5rem_1fr_auto] items-center gap-1.5">
          <Input
            className="h-8 text-sm"
            value={p.name}
            onChange={e => update(idx, { name: e.target.value })}
            placeholder="Weekly"
          />
          <div className="flex items-center gap-1">
            <Input
              className="h-8 text-sm"
              type="number"
              min={0}
              max={100}
              step="1"
              value={p.discount_pct}
              onChange={e => update(idx, { discount_pct: Number(e.target.value) || 0 })}
              placeholder="%"
            />
            <span className="text-[10px] text-muted-foreground shrink-0">%</span>
          </div>
          <Input
            className="h-8 text-sm"
            value={p.description ?? ''}
            onChange={e => update(idx, { description: e.target.value })}
            placeholder="Every week, same day"
          />
          <button
            type="button"
            onClick={() => remove(idx)}
            className="shrink-0 rounded-md p-1 text-destructive hover:bg-destructive/10"
            title="Remove"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...presets, emptyPreset()])} className="h-7 gap-1 px-2 text-xs">
        <Plus className="h-3 w-3" /> Add frequency
      </Button>
    </div>
  )
}

function RecurringPlanModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial?: VendorRecurringPlan
  onClose: () => void
  onSave: (data: VendorRecurringPlanCreate) => void
  saving: boolean
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.image_url ?? null)
  const [imageUploading, setImageUploading] = useState(false)
  const localPreviewRef = useRef<string | null>(null)
  const [startDate, setStartDate] = useState(initial?.start_date ?? '')
  const [startTime, setStartTime] = useState(initial?.start_time ?? '')
  const [durationMinutes, setDurationMinutes] = useState(String(initial?.duration_minutes ?? 60))
  const [pricePerSession, setPricePerSession] = useState(String(initial?.price_per_session ?? 0))
  const [currency, setCurrency] = useState(initial?.currency ?? 'USD')
  const [defaultSessionCount, setDefaultSessionCount] = useState(String(initial?.default_session_count ?? 8))
  const [minSessions, setMinSessions] = useState(String(initial?.min_sessions ?? 2))
  const [maxSessions, setMaxSessions] = useState(String(initial?.max_sessions ?? 24))
  const [showUpcoming, setShowUpcoming] = useState(initial?.show_upcoming ?? true)
  const [ctaLabel, setCtaLabel] = useState(initial?.cta_label ?? 'Confirm series')
  const [presets, setPresets] = useState<VendorRecurringPreset[]>(initial?.presets ?? [])
  const [sortOrder, setSortOrder] = useState(String(initial?.sort_order ?? 0))
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)

  const clearLocalPreview = () => {
    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current)
      localPreviewRef.current = null
    }
  }

  const handleImageFile = async (file: File) => {
    if (!isLikelyImageFile(file)) {
      toast.error('Please choose an image file (JPEG, PNG, WebP, or GIF)')
      return
    }
    clearLocalPreview()
    const localPreview = URL.createObjectURL(file)
    localPreviewRef.current = localPreview
    setImageUrl(localPreview)
    setImageUploading(true)
    try {
      const data = await recurringPlansApi.uploadImage(file)
      const saved = data.image_url || data.url
      if (!saved) throw new Error('No image URL returned')
      clearLocalPreview()
      setImageUrl(saved)
      toast.success('Image uploaded')
    } catch {
      clearLocalPreview()
      setImageUrl(initial?.image_url ?? null)
      toast.error('Upload failed — try again or pick another image')
    } finally {
      setImageUploading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    if (imageUrl?.startsWith('blob:')) {
      toast.error('Image is still uploading — wait a moment and try again')
      return
    }
    onSave({
      title: title.trim(),
      image_url: imageUrl || undefined,
      start_date: startDate.trim() || undefined,
      start_time: startTime.trim() || undefined,
      duration_minutes: Number(durationMinutes) || undefined,
      price_per_session: Number(pricePerSession) || 0,
      currency: currency.trim() || 'USD',
      default_session_count: Number(defaultSessionCount) || 8,
      min_sessions: Number(minSessions) || 2,
      max_sessions: Number(maxSessions) || 24,
      show_upcoming: showUpcoming,
      cta_label: ctaLabel.trim() || 'Confirm series',
      presets: presets.filter(p => p.name.trim()),
      sort_order: Number(sortOrder) || 0,
      is_active: isActive,
    })
  }

  const labelCls = 'text-xs'
  const fieldGap = 'space-y-1'

  return (
    <ModalOverlay onClose={onClose} className="z-[100] bg-black/60 p-2">
      <ModalPanel className={cn(modalWidthLg, 'max-h-[calc(100dvh-1rem)]')}>
        <ModalHeader
          title={initial ? 'Edit recurring plan' : 'New recurring plan'}
          onClose={onClose}
          className="border-0 px-4 py-2.5 [&>div>h2]:text-base"
        />
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <ModalBody className="space-y-2.5 overflow-y-auto px-4 pb-3 pt-0">
            <div className="grid grid-cols-[5.5rem_1fr] gap-2.5 items-start">
              <div className={fieldGap}>
                <Label className={labelCls}>Banner</Label>
                <label className="relative flex h-14 w-full cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed border-input bg-muted/40 hover:bg-muted/60">
                  {imageUrl ? (
                    <img src={imageUrl.startsWith('blob:') ? imageUrl : mediaUrl(imageUrl)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex flex-col items-center gap-0.5 text-[10px] text-muted-foreground">
                      {imageUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                      Upload
                    </span>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) void handleImageFile(file)
                    }}
                  />
                </label>
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Service name *</Label>
                <Input
                  className="h-8 text-sm"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                  autoFocus
                  placeholder="Weekly Yoga · Vinyasa Flow"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <div className={fieldGap}>
                <Label className={labelCls}>Start date</Label>
                <Input className="h-8 text-sm" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Time</Label>
                <Input className="h-8 text-sm" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Duration (min)</Label>
                <Input className="h-8 text-sm" type="number" min={0} value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Price / session</Label>
                <Input className="h-8 text-sm" type="number" min={0} step="0.01" value={pricePerSession} onChange={e => setPricePerSession(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Currency</Label>
                <Input className="h-8 text-sm" value={currency} onChange={e => setCurrency(e.target.value)} placeholder="USD" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <div className={fieldGap}>
                <Label className={labelCls}>Default sessions</Label>
                <Input className="h-8 text-sm" type="number" min={1} value={defaultSessionCount} onChange={e => setDefaultSessionCount(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Min</Label>
                <Input className="h-8 text-sm" type="number" min={1} value={minSessions} onChange={e => setMinSessions(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Max</Label>
                <Input className="h-8 text-sm" type="number" min={1} value={maxSessions} onChange={e => setMaxSessions(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Confirm label</Label>
                <Input className="h-8 text-sm" value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Sort order</Label>
                <Input className="h-8 text-sm" type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
              </div>
            </div>

            <div className={fieldGap}>
              <Label className={labelCls}>Frequency options</Label>
              <PresetEditor presets={presets} onChange={setPresets} />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <CheckboxFieldLabel
                label="Show upcoming sessions"
                checked={showUpcoming}
                onChange={setShowUpcoming}
                labelClassName="text-xs"
              />
              <CheckboxFieldLabel
                label="Active on storefront"
                checked={isActive}
                onChange={setIsActive}
                labelClassName="text-xs"
              />
            </div>
          </ModalBody>
          <ModalFooter className="justify-end gap-2 border-0 bg-transparent px-4 py-2.5">
            <Button type="button" variant="cancel" className="h-8 px-3 text-sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="h-8 px-3 text-sm" disabled={saving || !title.trim()}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {initial ? 'Save' : 'Create'}
            </Button>
          </ModalFooter>
        </form>
      </ModalPanel>
    </ModalOverlay>
  )
}

export default function SalesRecurringBookingsPage() {
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; plan?: VendorRecurringPlan } | null>(null)
  const [sortKey, setSortKey] = useState('sort_order')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const { data, isLoading } = useRecurringPlans({ size: 100, search: search.trim() || undefined })
  const createPlan = useCreateRecurringPlan()
  const updatePlan = useUpdateRecurringPlan()
  const deletePlan = useDeleteRecurringPlan()
  const toggleActive = useToggleRecurringPlanActive()

  const rows = useMemo(() => {
    const items = data?.items ?? []
    return processRows(
      items,
      search,
      (p) => [p.title],
      sortKey,
      sortDir,
      {
        sort_order: (p) => p.sort_order,
        title: (p) => p.title,
        price: (p) => p.price_per_session,
        is_active: (p) => (p.is_active ? 1 : 0),
      },
    )
  }, [data?.items, search, sortKey, sortDir])

  const saving = createPlan.isPending || updatePlan.isPending
  const { isSaving, patchField } = useInlineFieldPatch(updatePlan)

  return (
    <div className="space-y-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="flex items-center gap-1.5 text-lg font-semibold leading-tight">
            <RefreshCw className="h-4 w-4 shrink-0 text-primary" />
            Recurring Bookings
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Weekly / monthly session plans · syncs to Website Builder
          </p>
        </div>
        <Button onClick={() => setModal({ mode: 'create' })} className="h-8 gap-1.5 px-3 text-sm shrink-0">
          <Plus className="h-3.5 w-3.5" /> Add plan
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search plans…"
            sortOptions={[
              { value: 'sort_order', label: 'Order' },
              { value: 'title', label: 'Title' },
              { value: 'price', label: 'Price per session' },
              { value: 'is_active', label: 'Active' },
            ]}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKeyChange={setSortKey}
            onSortDirChange={setSortDir}
            hint={INLINE_EDIT_HINT}
          />
          <div className="overflow-x-auto">
            <ResizableTable tableId="sales-recurring-plans-v1" defaultWidths={[64, 240, 200, 140, 90, 120]}>
              <thead>
                <tr className="bg-muted/30">
                  <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide"><TableColumnLabel>Order</TableColumnLabel></th>
                  <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide"><TableColumnLabel>Service</TableColumnLabel></th>
                  <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide"><TableColumnLabel>Starts</TableColumnLabel></th>
                  <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide"><TableColumnLabel>Price / session</TableColumnLabel></th>
                  <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide"><TableColumnLabel>Active</TableColumnLabel></th>
                  <th className="text-right px-3 py-2 text-[10px] font-medium uppercase tracking-wide"><TableColumnLabel>Actions</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">No recurring plans yet. Add your first plan to sync with the website builder.</td></tr>
                ) : rows.map(plan => (
                  <tr
                    key={plan.id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={onClickableTableRow(() => setModal({ mode: 'edit', plan }))}
                  >
                    <td className="px-3 py-2 text-sm">
                      <InlineEditCell type="number" value={plan.sort_order} readOnly readOnlyMessage="Use the full editor to change sort order" title="Order">
                        {plan.sort_order}
                      </InlineEditCell>
                    </td>
                    <td className="px-3 py-2 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        {plan.image_url ? (
                          <img src={mediaUrl(plan.image_url)} alt="" className="h-8 w-10 rounded object-cover shrink-0" />
                        ) : (
                          <div className="h-8 w-10 rounded bg-muted shrink-0" />
                        )}
                        <InlineEditCell
                          value={plan.title}
                          saving={isSaving(plan.id, 'title')}
                          validate={(v) => String(v).trim().length < 1 ? 'Title is required' : null}
                          onSave={(v) => patchField(plan.id, 'title', String(v).trim())}
                          title="Edit service name"
                          className="-mx-1.5 min-w-0 flex-1"
                        >
                          <span className="line-clamp-1">{plan.title}</span>
                        </InlineEditCell>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm text-muted-foreground">
                      <div className="space-y-0.5">
                        <InlineEditCell
                          value={plan.start_date || ''}
                          saving={isSaving(plan.id, 'start_date')}
                          onSave={(v) => patchField(plan.id, 'start_date', String(v).trim() || null)}
                          title="Edit start date (YYYY-MM-DD)"
                        >
                          {plan.start_date ? formatPlanDate(plan.start_date) : '—'}
                        </InlineEditCell>
                        <InlineEditCell
                          value={plan.start_time || ''}
                          saving={isSaving(plan.id, 'start_time')}
                          onSave={(v) => patchField(plan.id, 'start_time', String(v).trim() || null)}
                          title="Edit start time (HH:MM)"
                        >
                          <div className="text-xs">{formatPlanTime(plan.start_time) || '—'}</div>
                        </InlineEditCell>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <InlineEditCell
                        type="number"
                        value={plan.price_per_session}
                        min={0}
                        step="0.01"
                        saving={isSaving(plan.id, 'price_per_session')}
                        validate={(v) => Number(v) < 0 ? 'Price must be 0 or more' : null}
                        onSave={(v) => patchField(plan.id, 'price_per_session', Number(v) || 0)}
                        title="Edit price per session"
                      >
                        {formatCurrency(plan.price_per_session, plan.currency)}
                      </InlineEditCell>
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <InlineEditCell
                        type="select"
                        value={plan.is_active ? 'true' : 'false'}
                        options={[
                          { value: 'true', label: 'Active' },
                          { value: 'false', label: 'Hidden' },
                        ]}
                        saving={isSaving(plan.id, 'is_active')}
                        onSave={(v) => patchField(plan.id, 'is_active', v === 'true')}
                        title="Edit active status"
                      >
                        {plan.is_active ? <span className="text-green-700 font-medium">Active</span> : <span className="text-muted-foreground">Hidden</span>}
                      </InlineEditCell>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title={plan.is_active ? 'Deactivate' : 'Activate'}
                          onClick={e => {
                            e.stopPropagation()
                            toggleActive.mutate({ id: plan.id, is_active: !plan.is_active })
                          }}
                          className="rounded p-1 hover:bg-muted"
                        >
                          {plan.is_active ? <ToggleRight className="h-4 w-4 text-primary" /> : <ToggleLeft className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          title="Edit"
                          onClick={e => { e.stopPropagation(); setModal({ mode: 'edit', plan }) }}
                          className="rounded p-1 hover:bg-muted"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={async e => {
                            e.stopPropagation()
                            if (await askConfirm(`Delete "${plan.title}"?`)) deletePlan.mutate(plan.id)
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
        <RecurringPlanModal
          initial={modal.mode === 'edit' ? modal.plan : undefined}
          onClose={() => setModal(null)}
          saving={saving}
          onSave={data => {
            if (modal.mode === 'edit' && modal.plan) {
              updatePlan.mutate({ id: modal.plan.id, data }, { onSuccess: () => setModal(null) })
            } else {
              createPlan.mutate(data, { onSuccess: () => setModal(null) })
            }
          }}
        />
      )}
    </div>
  )
}
