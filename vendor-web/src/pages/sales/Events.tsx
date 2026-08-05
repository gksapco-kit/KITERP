import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, Ticket, ToggleLeft, ToggleRight, ImagePlus, Star } from 'lucide-react'
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
import { ImageSourcePicker } from '@/components/common/ImageSourcePicker'
import { resolveBusinessGalleryDisplayUrl } from '@/data/businessImagePack'
import { cn, formatCurrency, isLikelyImageFile, mediaUrl } from '@/lib/utils'
import { modalWidthLg } from '@/lib/modalUi'
import { processRows, type SortDir } from '@/lib/tableList'
import { onClickableTableRow } from '@/lib/clickableTableRow'
import {
  useEvents,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  useToggleEventActive,
} from '@/hooks/useEvents'
import { eventsApi } from '@/api/events'
import type { VendorEvent, VendorEventCreate, VendorTicketTier } from '@/api/events'

import { askConfirm } from '@/components/common/ConfirmProvider'
/** "2026-07-24" → "Fri, Jul 24, 2026" for display; falls back to the raw value for older free-text entries. */
function formatEventDate(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

/** "18:30" → "6:30 PM" for display; falls back to the raw value for older free-text entries. */
function formatEventTime(hhmm?: string | null): string {
  if (!hhmm) return ''
  const [hStr, mStr] = hhmm.split(':')
  const h = Number(hStr)
  if (Number.isNaN(h)) return hhmm
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mStr ?? '00'} ${period}`
}

function emptyTier(): VendorTicketTier {
  return { name: '', price: 0, currency: 'USD', perks: [], remaining: 0, popular: false }
}

function TierEditor({
  tiers,
  onChange,
}: {
  tiers: VendorTicketTier[]
  onChange: (tiers: VendorTicketTier[]) => void
}) {
  const update = (idx: number, patch: Partial<VendorTicketTier>) => {
    onChange(tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t)))
  }
  const remove = (idx: number) => onChange(tiers.filter((_, i) => i !== idx))

  return (
    <div className="space-y-1.5">
      {tiers.length === 0 && (
        <p className="text-[10px] text-muted-foreground">No tiers yet — add at least one so guests can buy tickets.</p>
      )}
      {/* Column headers */}
      {tiers.length > 0 && (
        <div className="grid grid-cols-[minmax(0,1.4fr)_4.5rem_3.5rem_4rem_auto_auto] gap-1 px-0.5">
          {['Tier Name', 'Price', 'Currency', 'Remaining', '', ''].map(h => (
            <p key={h} className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{h}</p>
          ))}
        </div>
      )}
      {tiers.map((t, idx) => (
        <div key={idx} className="space-y-1 rounded-md bg-muted/20 p-1.5">
          <div className="grid grid-cols-[minmax(0,1.4fr)_4.5rem_3.5rem_4rem_auto_auto] gap-1 items-center">
            <Input
              className="h-7 text-xs"
              value={t.name}
              onChange={e => update(idx, { name: e.target.value })}
              placeholder="General Admission"
              aria-label="Tier name"
            />
            <Input
              className="h-7 text-xs"
              type="number"
              min={0}
              step="0.01"
              value={t.price}
              onChange={e => update(idx, { price: Number(e.target.value) || 0 })}
              placeholder="0.00"
              aria-label="Price"
            />
            <Input
              className="h-7 text-xs"
              value={t.currency}
              onChange={e => update(idx, { currency: e.target.value })}
              placeholder="INR"
              aria-label="Currency"
            />
            <Input
              className="h-7 text-xs"
              type="number"
              min={0}
              value={t.remaining}
              onChange={e => update(idx, { remaining: Number(e.target.value) || 0 })}
              placeholder="0"
              aria-label="Remaining tickets"
            />
            <button
              type="button"
              onClick={() => update(idx, { popular: !t.popular })}
              title={t.popular ? 'Popular' : 'Mark popular'}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md border transition-colors',
                t.popular
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/40',
              )}
            >
              <Star className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => remove(idx)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-destructive hover:bg-destructive/10"
              title="Remove tier"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <textarea
            value={(t.perks ?? []).join('\n')}
            onChange={e => update(idx, { perks: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
            rows={1}
            className="w-full resize-none rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Perks, one per line"
          />
        </div>
      ))}
      <Button type="button" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => onChange([...tiers, emptyTier()])}>
        <Plus className="h-3 w-3" /> Add tier
      </Button>
    </div>
  )
}

function EventModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial?: VendorEvent
  onClose: () => void
  onSave: (data: VendorEventCreate) => void
  saving: boolean
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [tagline, setTagline] = useState(initial?.tagline ?? '')
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.image_url ?? null)
  const [imageUploading, setImageUploading] = useState(false)
  const localPreviewRef = useRef<string | null>(null)
  const [eventDate, setEventDate] = useState(initial?.event_date ?? '')
  const [doorsTime, setDoorsTime] = useState(initial?.doors_time ?? '')
  const [startTime, setStartTime] = useState(initial?.start_time ?? '')
  const [endTime, setEndTime] = useState(initial?.end_time ?? '')
  const [venue, setVenue] = useState(initial?.venue ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [venueCapacity, setVenueCapacity] = useState(initial?.venue_capacity != null ? String(initial.venue_capacity) : '')
  const [ageNote, setAgeNote] = useState(initial?.age_note ?? '')
  const [orderTitle, setOrderTitle] = useState(initial?.order_title ?? 'Your order')
  const [seatingTitle, setSeatingTitle] = useState(initial?.seating_title ?? 'Seating chart')
  const [showSeating, setShowSeating] = useState(initial?.show_seating ?? true)
  const [maxPerOrder, setMaxPerOrder] = useState(String(initial?.max_per_order ?? 8))
  const [ctaLabel, setCtaLabel] = useState(initial?.cta_label ?? 'Continue to checkout')
  const [tiers, setTiers] = useState<VendorTicketTier[]>(initial?.tiers ?? [])
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
      const data = await eventsApi.uploadImage(file)
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

  const handleImageUrl = async (url: string) => {
    const trimmed = url.trim()
    if (!trimmed) return
    clearLocalPreview()
    setImageUrl(trimmed)
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
      tagline: tagline.trim() || undefined,
      image_url: imageUrl || undefined,
      event_date: eventDate.trim() || undefined,
      doors_time: doorsTime.trim() || undefined,
      start_time: startTime.trim() || undefined,
      end_time: endTime.trim() || undefined,
      venue: venue.trim() || undefined,
      address: address.trim() || undefined,
      venue_capacity: venueCapacity.trim() ? Number(venueCapacity) || undefined : undefined,
      age_note: ageNote.trim() || undefined,
      order_title: orderTitle.trim() || 'Your order',
      seating_title: seatingTitle.trim() || 'Seating chart',
      show_seating: showSeating,
      max_per_order: Number(maxPerOrder) || 8,
      cta_label: ctaLabel.trim() || 'Continue to checkout',
      tiers: tiers.filter(t => t.name.trim()),
      sort_order: Number(sortOrder) || 0,
      is_active: isActive,
    })
  }

  const labelCls = 'text-[10px] leading-none'
  const fieldGap = 'space-y-0.5'
  const inputCls = 'h-7 text-xs'
  const checkoutOpen = !!ageNote.trim() || orderTitle !== 'Your order' || ctaLabel !== 'Continue to checkout' || maxPerOrder !== '8'
  const tiersOpen = tiers.length > 0

  return (
    <ModalOverlay onClose={onClose} className="z-[100] bg-black/60 p-1.5">
      <ModalPanel className={cn(modalWidthLg, 'max-h-[calc(100dvh-0.75rem)]')}>
        <ModalHeader
          title={initial ? 'Edit event' : 'New event'}
          onClose={onClose}
          className="border-0 px-3 py-2 [&>div>h2]:text-sm"
        />
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <ModalBody className="space-y-1.5 overflow-y-auto px-3 pb-2 pt-0">
            <div className="grid grid-cols-[3.75rem_minmax(0,1.3fr)_minmax(0,1fr)] gap-1.5 items-end">
              <ImageSourcePicker
                title="Event banner"
                uploading={imageUploading}
                onFile={handleImageFile}
                onUrl={handleImageUrl}
              >
                {({ open, uploading }) => (
                  <button
                    type="button"
                    onClick={open}
                    disabled={uploading}
                    aria-label="Add event banner"
                    title="Event banner"
                    className="flex h-7 w-full cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed border-input bg-muted/40 hover:bg-muted/60 disabled:pointer-events-none"
                  >
                    {imageUrl ? (
                      <img
                        src={
                          imageUrl.startsWith('blob:')
                            ? imageUrl
                            : mediaUrl(resolveBusinessGalleryDisplayUrl(imageUrl))
                        }
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : <ImagePlus className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                )}
              </ImageSourcePicker>
              <div className={fieldGap}>
                <Label className={labelCls}>Event title *</Label>
                <Input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} required autoFocus placeholder="Field Notes — A Night of Ambient" />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Tagline</Label>
                <Input className={inputCls} value={tagline} onChange={e => setTagline(e.target.value)} placeholder="Live electronic & strings" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              <div className={fieldGap}>
                <Label className={labelCls}>Date</Label>
                <Input className={inputCls} type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Doors</Label>
                <Input className={inputCls} type="time" value={doorsTime} onChange={e => setDoorsTime(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Start</Label>
                <Input className={inputCls} type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>End</Label>
                <Input className={inputCls} type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-[1fr_1fr_5rem_5rem]">
              <div className={fieldGap}>
                <Label className={labelCls}>Venue</Label>
                <Input className={inputCls} value={venue} onChange={e => setVenue(e.target.value)} placeholder="The Greene Room" />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Address</Label>
                <Input className={inputCls} value={address} onChange={e => setAddress(e.target.value)} placeholder="418 Atlantic Ave, Brooklyn" />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Max seats</Label>
                <Input className={inputCls} type="number" min={0} value={venueCapacity} onChange={e => setVenueCapacity(e.target.value)} placeholder="500" />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Sort</Label>
                <Input className={inputCls} type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
              </div>
            </div>

            <details className="rounded-md bg-muted/15 px-2 py-1" open={checkoutOpen}>
              <summary className="cursor-pointer list-none text-[10px] font-medium text-muted-foreground hover:text-foreground">
                Checkout &amp; seating {checkoutOpen ? '' : '· optional'}
              </summary>
              <div className="mt-1.5 space-y-1.5">
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  <div className={cn(fieldGap, 'sm:col-span-2')}>
                    <Label className={labelCls}>Age / entry note</Label>
                    <Input className={inputCls} value={ageNote} onChange={e => setAgeNote(e.target.value)} placeholder="21+ · ID required" />
                  </div>
                  <div className={fieldGap}>
                    <Label className={labelCls}>Order title</Label>
                    <Input className={inputCls} value={orderTitle} onChange={e => setOrderTitle(e.target.value)} />
                  </div>
                  <div className={fieldGap}>
                    <Label className={labelCls}>Max / order</Label>
                    <Input className={inputCls} type="number" min={1} value={maxPerOrder} onChange={e => setMaxPerOrder(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[1fr_auto_1fr] items-end">
                  <div className={fieldGap}>
                    <Label className={labelCls}>Checkout button</Label>
                    <Input className={inputCls} value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} />
                  </div>
                  <CheckboxFieldLabel
                    label="Show seating"
                    checked={showSeating}
                    onChange={setShowSeating}
                    labelClassName="text-xs pb-1"
                  />
                  <div className={fieldGap}>
                    <Label className={labelCls}>Seating title</Label>
                    <Input className={inputCls} value={seatingTitle} onChange={e => setSeatingTitle(e.target.value)} disabled={!showSeating} />
                  </div>
                </div>
              </div>
            </details>

            <details className="rounded-md bg-muted/15 px-2 py-1" open={tiersOpen}>
              <summary className="cursor-pointer list-none text-[10px] font-medium text-muted-foreground hover:text-foreground">
                Ticket tiers {tiersOpen ? `(${tiers.length})` : '· optional'}
              </summary>
              <div className="mt-1.5">
                <TierEditor tiers={tiers} onChange={setTiers} />
              </div>
            </details>
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
              <Button type="submit" className="h-7 px-2.5 text-xs" disabled={saving || !title.trim()}>
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

export default function SalesEventsPage() {
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; event?: VendorEvent } | null>(null)
  const [sortKey, setSortKey] = useState('sort_order')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const { data, isLoading } = useEvents({ size: 100, search: search.trim() || undefined })
  const createEvent = useCreateEvent()
  const updateEvent = useUpdateEvent()
  const deleteEvent = useDeleteEvent()
  const toggleActive = useToggleEventActive()

  const rows = useMemo(() => {
    const items = data?.items ?? []
    return processRows(
      items,
      search,
      (e) => [e.title, e.venue ?? '', e.tagline ?? ''],
      sortKey,
      sortDir,
      {
        sort_order: (e) => e.sort_order,
        title: (e) => e.title,
        tiers: (e) => e.tiers.length,
        is_active: (e) => (e.is_active ? 1 : 0),
      },
    )
  }, [data?.items, search, sortKey, sortDir])

  const saving = createEvent.isPending || updateEvent.isPending
  const { isSaving, patchField } = useInlineFieldPatch(updateEvent)

  return (
    <div className="space-y-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="flex items-center gap-1.5 text-lg font-semibold leading-tight">
            <Ticket className="h-4 w-4 shrink-0 text-primary" />
            Ticketed Events
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Storefront events &amp; tiers · syncs to Website Builder
          </p>
        </div>
        <Button onClick={() => setModal({ mode: 'create' })} className="h-8 gap-1.5 px-3 text-sm shrink-0">
          <Plus className="h-3.5 w-3.5" /> Add event
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search events…"
            sortOptions={[
              { value: 'sort_order', label: 'Order' },
              { value: 'title', label: 'Title' },
              { value: 'tiers', label: 'Ticket tiers' },
              { value: 'is_active', label: 'Active' },
            ]}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKeyChange={setSortKey}
            onSortDirChange={setSortDir}
            hint={INLINE_EDIT_HINT}
          />
          <div className="overflow-x-auto">
            <ResizableTable tableId="sales-events-v1" defaultWidths={[64, 240, 160, 130, 90, 120]}>
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Order</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Event</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Date / venue</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Ticket tiers</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Active</TableColumnLabel></th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Actions</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={6} className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">No events yet. Add your first event to sync with the website builder.</td></tr>
                ) : rows.map(event => (
                  <tr
                    key={event.id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={onClickableTableRow(() => setModal({ mode: 'edit', event }))}
                  >
                    <td className="px-4 py-3 text-sm">
                      <InlineEditCell type="number" value={event.sort_order} readOnly readOnlyMessage="Use the full editor to change sort order" title="Order">
                        {event.sort_order}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        {event.image_url ? (
                          <img src={mediaUrl(event.image_url)} alt="" className="h-8 w-10 rounded object-cover shrink-0" />
                        ) : (
                          <div className="h-8 w-10 rounded bg-muted shrink-0" />
                        )}
                        <InlineEditCell
                          value={event.title}
                          saving={isSaving(event.id, 'title')}
                          validate={(v) => String(v).trim().length < 1 ? 'Title is required' : null}
                          onSave={(v) => patchField(event.id, 'title', String(v).trim())}
                          title="Edit event title"
                          className="-mx-1.5 min-w-0 flex-1"
                        >
                          <span className="line-clamp-1">{event.title}</span>
                        </InlineEditCell>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <div className="space-y-0.5">
                        <InlineEditCell
                          value={event.event_date || ''}
                          saving={isSaving(event.id, 'event_date')}
                          onSave={(v) => patchField(event.id, 'event_date', String(v).trim() || null)}
                          title="Edit date (YYYY-MM-DD)"
                        >
                          {event.event_date ? formatEventDate(event.event_date) : '—'}
                        </InlineEditCell>
                        <InlineEditCell
                          value={event.venue || ''}
                          saving={isSaving(event.id, 'venue')}
                          onSave={(v) => patchField(event.id, 'venue', String(v).trim() || null)}
                          title="Edit venue"
                        >
                          <span className="text-xs">
                            {[
                              [formatEventTime(event.start_time), formatEventTime(event.end_time)].filter(Boolean).join(' – '),
                              event.venue,
                            ].filter(Boolean).join(' · ') || '—'}
                          </span>
                        </InlineEditCell>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <InlineEditCell
                        readOnly
                        readOnlyMessage="Edit ticket tiers in the full editor"
                        title="Ticket tiers"
                      >
                        {event.tiers.length > 0 ? (
                          <span>{event.tiers.length} tier{event.tiers.length === 1 ? '' : 's'} · from {formatCurrency(Math.min(...event.tiers.map(t => t.price)), event.tiers[0]?.currency ?? 'USD')}</span>
                        ) : (
                          <span className="text-muted-foreground">No tiers</span>
                        )}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <InlineEditCell
                        type="select"
                        value={event.is_active ? 'true' : 'false'}
                        options={[
                          { value: 'true', label: 'Active' },
                          { value: 'false', label: 'Hidden' },
                        ]}
                        saving={isSaving(event.id, 'is_active')}
                        onSave={(v) => patchField(event.id, 'is_active', v === 'true')}
                        title="Edit active status"
                      >
                        {event.is_active ? <span className="text-green-700 font-medium">Active</span> : <span className="text-muted-foreground">Hidden</span>}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title={event.is_active ? 'Deactivate' : 'Activate'}
                          onClick={e => {
                            e.stopPropagation()
                            toggleActive.mutate({ id: event.id, is_active: !event.is_active })
                          }}
                          className="rounded p-1 hover:bg-muted"
                        >
                          {event.is_active ? <ToggleRight className="h-4 w-4 text-primary" /> : <ToggleLeft className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          title="Edit"
                          onClick={e => { e.stopPropagation(); setModal({ mode: 'edit', event }) }}
                          className="rounded p-1 hover:bg-muted"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={async e => {
                            e.stopPropagation()
                            if (await askConfirm(`Delete "${event.title}"?`)) deleteEvent.mutate(event.id)
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
        <EventModal
          initial={modal.mode === 'edit' ? modal.event : undefined}
          onClose={() => setModal(null)}
          saving={saving}
          onSave={data => {
            if (modal.mode === 'edit' && modal.event) {
              updateEvent.mutate({ id: modal.event.id, data }, { onSuccess: () => setModal(null) })
            } else {
              createEvent.mutate(data, { onSuccess: () => setModal(null) })
            }
          }}
        />
      )}
    </div>
  )
}
