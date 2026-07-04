import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, Ticket, ToggleLeft, ToggleRight, X, ImagePlus, Star } from 'lucide-react'
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
  useEvents,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  useToggleEventActive,
} from '@/hooks/useEvents'
import { eventsApi } from '@/api/events'
import type { VendorEvent, VendorEventCreate, VendorTicketTier } from '@/api/events'

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
    <div className="space-y-3">
      {tiers.length === 0 && (
        <p className="text-xs text-muted-foreground">No ticket tiers yet. Add at least one so guests can buy tickets.</p>
      )}
      {tiers.map((t, idx) => (
        <div key={idx} className="rounded-lg border border-border p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="grid flex-1 grid-cols-2 gap-2">
              <Input
                value={t.name}
                onChange={e => update(idx, { name: e.target.value })}
                placeholder="Tier name (General Admission)"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={t.price}
                  onChange={e => update(idx, { price: Number(e.target.value) || 0 })}
                  placeholder="Price"
                />
                <Input
                  value={t.currency}
                  onChange={e => update(idx, { currency: e.target.value })}
                  placeholder="USD"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => remove(idx)}
              className="mt-1 shrink-0 rounded p-1.5 text-destructive hover:bg-destructive/10"
              title="Remove tier"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              min={0}
              value={t.remaining}
              onChange={e => update(idx, { remaining: Number(e.target.value) || 0 })}
              placeholder="Remaining"
            />
            <button
              type="button"
              onClick={() => update(idx, { popular: !t.popular })}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${
                t.popular ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40'
              }`}
            >
              <Star className="h-3.5 w-3.5" /> Mark as popular
            </button>
          </div>
          <textarea
            value={(t.perks ?? []).join('\n')}
            onChange={e => update(idx, { perks: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
            rows={2}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            placeholder={'Perks, one per line\nReserved seat\nDrink ticket included'}
          />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...tiers, emptyTier()])} className="gap-2">
        <Plus className="h-3.5 w-3.5" /> Add ticket tier
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
  useEscapeToClose(onClose)
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-xl max-h-[90vh] flex-col rounded-xl border border-border bg-card shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">{initial ? 'Edit event' : 'New event'}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-1 min-h-0 flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 p-5">
          <div>
            <Label>Event banner</Label>
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
            <Label>Event title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} required placeholder="Field Notes — A Night of Ambient" />
          </div>
          <div>
            <Label>Tagline</Label>
            <Input value={tagline} onChange={e => setTagline(e.target.value)} placeholder="An intimate evening of live electronic & strings" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
            </div>
            <div>
              <Label>Doors</Label>
              <Input type="time" value={doorsTime} onChange={e => setDoorsTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start</Label>
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div>
              <Label>End time</Label>
              <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Venue</Label>
              <Input value={venue} onChange={e => setVenue(e.target.value)} placeholder="The Greene Room" />
            </div>
            <div>
              <Label>Address</Label>
              <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="418 Atlantic Ave, Brooklyn" />
            </div>
          </div>
          <div>
            <Label>Maximum seats (venue allotment)</Label>
            <Input
              type="number"
              min={0}
              value={venueCapacity}
              onChange={e => setVenueCapacity(e.target.value)}
              placeholder="e.g. 500"
            />
          </div>
          <div>
            <Label>Age / entry note</Label>
            <Input value={ageNote} onChange={e => setAgeNote(e.target.value)} placeholder="21+ event · ID required at door" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Order panel title</Label>
              <Input value={orderTitle} onChange={e => setOrderTitle(e.target.value)} />
            </div>
            <div>
              <Label>Max tickets per order</Label>
              <Input type="number" min={1} value={maxPerOrder} onChange={e => setMaxPerOrder(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Checkout button label</Label>
              <Input value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} />
            </div>
            <div>
              <Label>Sort order</Label>
              <Input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
            </div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showSeating} onChange={e => setShowSeating(e.target.checked)} />
              Show seating chart
            </label>
            {showSeating && (
              <div className="mt-2">
                <Label>Seating chart title</Label>
                <Input value={seatingTitle} onChange={e => setSeatingTitle(e.target.value)} />
              </div>
            )}
          </div>
          <div>
            <Label>Ticket tiers</Label>
            <div className="mt-1">
              <TierEditor tiers={tiers} onChange={setTiers} />
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

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Ticket className="h-5 w-5 text-primary" />
            Ticketed Events
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Manage events and ticket tiers shown on your storefront. Events sync automatically to the Ticket Picker section in the website builder.
          </p>
        </div>
        <Button onClick={() => setModal({ mode: 'create' })} className="gap-2">
          <Plus className="h-4 w-4" /> Add event
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
                    <td className="px-4 py-3 text-sm">{event.sort_order}</td>
                    <td className="px-4 py-3 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        {event.image_url ? (
                          <img src={mediaUrl(event.image_url)} alt="" className="h-8 w-10 rounded object-cover shrink-0" />
                        ) : (
                          <div className="h-8 w-10 rounded bg-muted shrink-0" />
                        )}
                        <span className="line-clamp-1">{event.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {event.event_date && <div>{formatEventDate(event.event_date)}</div>}
                      <div className="text-xs">
                        {[
                          [formatEventTime(event.start_time), formatEventTime(event.end_time)].filter(Boolean).join(' – '),
                          event.venue,
                        ].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {event.tiers.length > 0 ? (
                        <span>{event.tiers.length} tier{event.tiers.length === 1 ? '' : 's'} · from {formatCurrency(Math.min(...event.tiers.map(t => t.price)), event.tiers[0]?.currency ?? 'USD')}</span>
                      ) : (
                        <span className="text-muted-foreground">No tiers</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">{event.is_active ? <span className="text-green-700 font-medium">Active</span> : <span className="text-muted-foreground">Hidden</span>}</td>
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
                          onClick={e => {
                            e.stopPropagation()
                            if (window.confirm(`Delete "${event.title}"?`)) deleteEvent.mutate(event.id)
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
