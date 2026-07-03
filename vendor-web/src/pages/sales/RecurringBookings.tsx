import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, RefreshCw, ToggleLeft, ToggleRight, X, ImagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { ResizableTable } from '@/components/table/ResizableTable'
import { TableToolbar } from '@/components/table/TableToolbar'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { formatCurrency, isLikelyImageFile, mediaUrl } from '@/lib/utils'
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
    <div className="space-y-3">
      {presets.length === 0 && (
        <p className="text-xs text-muted-foreground">No frequency options yet. Add at least one (e.g. Weekly) so guests can choose how often to book.</p>
      )}
      {presets.map((p, idx) => (
        <div key={idx} className="rounded-lg border border-border p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="grid flex-1 grid-cols-2 gap-2">
              <Input
                value={p.name}
                onChange={e => update(idx, { name: e.target.value })}
                placeholder="Frequency name (Weekly)"
              />
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="1"
                  value={p.discount_pct}
                  onChange={e => update(idx, { discount_pct: Number(e.target.value) || 0 })}
                  placeholder="Discount %"
                />
                <span className="text-xs text-muted-foreground shrink-0">% off</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => remove(idx)}
              className="mt-1 shrink-0 rounded p-1.5 text-destructive hover:bg-destructive/10"
              title="Remove frequency option"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <Input
            value={p.description ?? ''}
            onChange={e => update(idx, { description: e.target.value })}
            placeholder="Description (Every week, same day)"
          />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...presets, emptyPreset()])} className="gap-2">
        <Plus className="h-3.5 w-3.5" /> Add frequency option
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
  useEscapeToClose(onClose)
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-xl max-h-[90vh] flex-col rounded-xl border border-border bg-card shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">{initial ? 'Edit recurring plan' : 'New recurring plan'}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-1 min-h-0 flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 p-5">
          <div>
            <Label>Plan banner</Label>
            <label className="mt-1 flex h-32 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-input bg-muted/40 hover:bg-muted/60">
              {imageUrl ? (
                <img src={imageUrl.startsWith('blob:') ? imageUrl : mediaUrl(imageUrl)} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
                  {imageUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                  Upload banner
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
          <div>
            <Label>Service name</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} required placeholder="Weekly Yoga · Vinyasa Flow" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Start date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>Time</Label>
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div>
              <Label>Duration (min)</Label>
              <Input type="number" min={0} value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Price per session</Label>
              <Input type="number" min={0} step="0.01" value={pricePerSession} onChange={e => setPricePerSession(e.target.value)} />
            </div>
            <div>
              <Label>Currency</Label>
              <Input value={currency} onChange={e => setCurrency(e.target.value)} placeholder="USD" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Default sessions</Label>
              <Input type="number" min={1} value={defaultSessionCount} onChange={e => setDefaultSessionCount(e.target.value)} />
            </div>
            <div>
              <Label>Min sessions</Label>
              <Input type="number" min={1} value={minSessions} onChange={e => setMinSessions(e.target.value)} />
            </div>
            <div>
              <Label>Max sessions</Label>
              <Input type="number" min={1} value={maxSessions} onChange={e => setMaxSessions(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Confirm button label</Label>
              <Input value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} />
            </div>
            <div>
              <Label>Sort order</Label>
              <Input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showUpcoming} onChange={e => setShowUpcoming(e.target.checked)} />
            Show upcoming sessions list
          </label>
          <div>
            <Label>Frequency options</Label>
            <div className="mt-1">
              <PresetEditor presets={presets} onChange={setPresets} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
            Active on storefront
          </label>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-3">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initial ? 'Save' : 'Create'}
            </Button>
        </div>
        </form>
      </div>
    </div>
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

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Recurring Bookings
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Manage weekly / bi-weekly / monthly session plans shown on your storefront. Plans sync automatically to the Recurring Booking section in the website builder.
          </p>
        </div>
        <Button onClick={() => setModal({ mode: 'create' })} className="gap-2">
          <Plus className="h-4 w-4" /> Add plan
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
          />
          <div className="overflow-x-auto">
            <ResizableTable tableId="sales-recurring-plans-v1" defaultWidths={[64, 240, 200, 140, 90, 120]}>
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Order</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Service</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Starts</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Price / session</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Active</TableColumnLabel></th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Actions</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody className="divide-y">
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
                    <td className="px-4 py-3 text-sm">{plan.sort_order}</td>
                    <td className="px-4 py-3 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        {plan.image_url ? (
                          <img src={mediaUrl(plan.image_url)} alt="" className="h-8 w-10 rounded object-cover shrink-0" />
                        ) : (
                          <div className="h-8 w-10 rounded bg-muted shrink-0" />
                        )}
                        <span className="line-clamp-1">{plan.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {plan.start_date && <div>{formatPlanDate(plan.start_date)}</div>}
                      <div className="text-xs">{formatPlanTime(plan.start_time) || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">{formatCurrency(plan.price_per_session, plan.currency)}</td>
                    <td className="px-4 py-3 text-sm">{plan.is_active ? <span className="text-green-700 font-medium">Active</span> : <span className="text-muted-foreground">Hidden</span>}</td>
                    <td className="px-4 py-3">
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
                          onClick={e => {
                            e.stopPropagation()
                            if (window.confirm(`Delete "${plan.title}"?`)) deletePlan.mutate(plan.id)
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
