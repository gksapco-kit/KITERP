import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, Quote, ToggleLeft, ToggleRight, X, ImagePlus, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { ResizableTable } from '@/components/table/ResizableTable'
import { InlineEditCell } from '@/components/table/InlineEditCell'
import { TableToolbar } from '@/components/table/TableToolbar'
import { useInlineFieldPatch, INLINE_EDIT_HINT } from '@/hooks/useInlineFieldPatch'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { isLikelyImageFile, mediaUrl } from '@/lib/utils'
import { processRows, type SortDir } from '@/lib/tableList'
import { onClickableTableRow } from '@/lib/clickableTableRow'
import {
  useTestimonials,
  useCreateTestimonial,
  useUpdateTestimonial,
  useDeleteTestimonial,
  useToggleTestimonialActive,
} from '@/hooks/useTestimonials'
import { testimonialsApi } from '@/api/testimonials'
import type { VendorTestimonial, VendorTestimonialCreate } from '@/api/testimonials'

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
      ))}
    </div>
  )
}

function TestimonialModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial?: VendorTestimonial
  onClose: () => void
  onSave: (data: VendorTestimonialCreate) => void
  saving: boolean
}) {
  useEscapeToClose(onClose)
  const [name, setName] = useState(initial?.name ?? '')
  const [role, setRole] = useState(initial?.role ?? '')
  const [company, setCompany] = useState(initial?.company ?? '')
  const [quote, setQuote] = useState(initial?.quote ?? '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial?.avatar_url ?? null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const localPreviewRef = useRef<string | null>(null)
  const [rating, setRating] = useState(initial?.rating ?? 5)
  const [sortOrder, setSortOrder] = useState(String(initial?.sort_order ?? 0))
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)

  const clearLocalPreview = () => {
    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current)
      localPreviewRef.current = null
    }
  }

  const handleAvatarFile = async (file: File) => {
    if (!isLikelyImageFile(file)) {
      toast.error('Please choose an image file (JPEG, PNG, WebP, or GIF)')
      return
    }
    clearLocalPreview()
    const localPreview = URL.createObjectURL(file)
    localPreviewRef.current = localPreview
    setAvatarUrl(localPreview)
    setAvatarUploading(true)
    try {
      const data = await testimonialsApi.uploadAvatar(file)
      const saved = data.image_url || data.url
      if (!saved) throw new Error('No image URL returned')
      clearLocalPreview()
      setAvatarUrl(saved)
      toast.success('Photo uploaded')
    } catch {
      clearLocalPreview()
      setAvatarUrl(initial?.avatar_url ?? null)
      toast.error('Upload failed — try again or pick another image')
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !quote.trim()) return
    if (avatarUrl?.startsWith('blob:')) {
      toast.error('Photo is still uploading — wait a moment and try again')
      return
    }
    onSave({
      name: name.trim(),
      role: role.trim() || undefined,
      company: company.trim() || undefined,
      quote: quote.trim(),
      avatar_url: avatarUrl || undefined,
      rating,
      sort_order: Number(sortOrder) || 0,
      is_active: isActive,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-lg max-h-[90vh] flex-col rounded-xl border border-border bg-card shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">{initial ? 'Edit testimonial' : 'New testimonial'}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-1 min-h-0 flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 p-5">
            <div className="flex items-center gap-4">
              <label className="flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-input bg-muted/40 hover:bg-muted/60">
                {avatarUrl ? (
                  <img src={avatarUrl.startsWith('blob:') ? avatarUrl : mediaUrl(avatarUrl)} alt="" className="h-full w-full object-cover" />
                ) : avatarUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4 text-muted-foreground" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) void handleAvatarFile(file)
                  }}
                />
              </label>
              <div className="flex-1">
                <Label>Customer photo</Label>
                <p className="text-xs text-muted-foreground">Optional — shown next to the quote.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Customer name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} required placeholder="Jane Cooper" />
              </div>
              <div>
                <Label>Role</Label>
                <Input value={role} onChange={e => setRole(e.target.value)} placeholder="Marketing Lead" />
              </div>
            </div>
            <div>
              <Label>Company</Label>
              <Input value={company} onChange={e => setCompany(e.target.value)} placeholder="Acme Inc." />
            </div>
            <div>
              <Label>Quote</Label>
              <Textarea value={quote} onChange={e => setQuote(e.target.value)} required rows={4} placeholder="Working with this team was a game changer for our business..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Rating</Label>
                <div className="mt-1 flex items-center gap-1">
                  {Array.from({ length: 5 }, (_, i) => (
                    <button key={i} type="button" onClick={() => setRating(i + 1)} className="p-0.5">
                      <Star className={`h-5 w-5 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Sort order</Label>
                <Input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
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

export default function SalesTestimonialsPage() {
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; testimonial?: VendorTestimonial } | null>(null)
  const [sortKey, setSortKey] = useState('sort_order')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const { data, isLoading } = useTestimonials({ size: 100, search: search.trim() || undefined })
  const createTestimonial = useCreateTestimonial()
  const updateTestimonial = useUpdateTestimonial()
  const deleteTestimonial = useDeleteTestimonial()
  const toggleActive = useToggleTestimonialActive()

  const rows = useMemo(() => {
    const items = data?.items ?? []
    return processRows(
      items,
      search,
      (t) => [t.name, t.company ?? ''],
      sortKey,
      sortDir,
      {
        sort_order: (t) => t.sort_order,
        name: (t) => t.name,
        rating: (t) => t.rating,
        is_active: (t) => (t.is_active ? 1 : 0),
      },
    )
  }, [data?.items, search, sortKey, sortDir])

  const saving = createTestimonial.isPending || updateTestimonial.isPending
  const { isSaving, patchField } = useInlineFieldPatch(updateTestimonial)

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Quote className="h-5 w-5 text-primary" />
            Testimonials
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Curate customer quotes shown on your storefront. Testimonials sync automatically to Testimonials sections in the
            website builder — if none are added, verified 4★+ reviews are shown instead.
          </p>
        </div>
        <Button onClick={() => setModal({ mode: 'create' })} className="gap-2">
          <Plus className="h-4 w-4" /> Add testimonial
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search testimonials…"
            sortOptions={[
              { value: 'sort_order', label: 'Order' },
              { value: 'name', label: 'Name' },
              { value: 'rating', label: 'Rating' },
              { value: 'is_active', label: 'Active' },
            ]}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKeyChange={setSortKey}
            onSortDirChange={setSortDir}
            hint={INLINE_EDIT_HINT}
          />
          <div className="overflow-x-auto">
            <ResizableTable tableId="sales-testimonials-v1" defaultWidths={[64, 220, 320, 100, 90, 120]}>
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Order</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Customer</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Quote</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Rating</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Active</TableColumnLabel></th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Actions</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={6} className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">No testimonials yet. Add your first one to sync with the website builder.</td></tr>
                ) : rows.map(testimonial => (
                  <tr
                    key={testimonial.id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={onClickableTableRow(() => setModal({ mode: 'edit', testimonial }))}
                  >
                    <td className="px-4 py-3 text-sm">
                      <InlineEditCell type="number" value={testimonial.sort_order} readOnly readOnlyMessage="Use the full editor to change sort order" title="Order">
                        {testimonial.sort_order}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        {testimonial.avatar_url ? (
                          <img src={mediaUrl(testimonial.avatar_url)} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
                        )}
                        <div className="min-w-0 space-y-0.5">
                          <InlineEditCell
                            value={testimonial.name}
                            saving={isSaving(testimonial.id, 'name')}
                            validate={(v) => String(v).trim().length < 1 ? 'Name is required' : null}
                            onSave={(v) => patchField(testimonial.id, 'name', String(v).trim())}
                            title="Edit customer name"
                          >
                            <div className="line-clamp-1">{testimonial.name}</div>
                          </InlineEditCell>
                          <InlineEditCell
                            value={testimonial.role || ''}
                            saving={isSaving(testimonial.id, 'role')}
                            onSave={(v) => patchField(testimonial.id, 'role', String(v).trim() || null)}
                            title="Edit role"
                          >
                            <div className="text-xs text-muted-foreground line-clamp-1">{testimonial.role || '—'}</div>
                          </InlineEditCell>
                          <InlineEditCell
                            value={testimonial.company || ''}
                            saving={isSaving(testimonial.id, 'company')}
                            onSave={(v) => patchField(testimonial.id, 'company', String(v).trim() || null)}
                            title="Edit company"
                          >
                            <div className="text-xs text-muted-foreground line-clamp-1">{testimonial.company || '—'}</div>
                          </InlineEditCell>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground line-clamp-2 max-w-xs">
                      <InlineEditCell
                        value={testimonial.quote}
                        saving={isSaving(testimonial.id, 'quote')}
                        validate={(v) => String(v).trim().length < 1 ? 'Quote is required' : null}
                        onSave={(v) => patchField(testimonial.id, 'quote', String(v).trim())}
                        title="Edit quote"
                      >
                        {testimonial.quote}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <InlineEditCell
                        type="number"
                        value={testimonial.rating}
                        readOnly
                        readOnlyMessage="Edit rating in the full editor"
                        title="Rating"
                      >
                        <StarRow rating={testimonial.rating} />
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <InlineEditCell
                        type="select"
                        value={testimonial.is_active ? 'true' : 'false'}
                        options={[
                          { value: 'true', label: 'Active' },
                          { value: 'false', label: 'Hidden' },
                        ]}
                        saving={isSaving(testimonial.id, 'is_active')}
                        onSave={(v) => patchField(testimonial.id, 'is_active', v === 'true')}
                        title="Edit active status"
                      >
                        {testimonial.is_active ? <span className="text-green-700 font-medium">Active</span> : <span className="text-muted-foreground">Hidden</span>}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title={testimonial.is_active ? 'Deactivate' : 'Activate'}
                          onClick={e => {
                            e.stopPropagation()
                            toggleActive.mutate({ id: testimonial.id, is_active: !testimonial.is_active })
                          }}
                          className="rounded p-1 hover:bg-muted"
                        >
                          {testimonial.is_active ? <ToggleRight className="h-4 w-4 text-primary" /> : <ToggleLeft className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          title="Edit"
                          onClick={e => { e.stopPropagation(); setModal({ mode: 'edit', testimonial }) }}
                          className="rounded p-1 hover:bg-muted"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={e => {
                            e.stopPropagation()
                            if (window.confirm(`Delete testimonial from "${testimonial.name}"?`)) deleteTestimonial.mutate(testimonial.id)
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
        <TestimonialModal
          initial={modal.mode === 'edit' ? modal.testimonial : undefined}
          onClose={() => setModal(null)}
          saving={saving}
          onSave={data => {
            if (modal.mode === 'edit' && modal.testimonial) {
              updateTestimonial.mutate({ id: modal.testimonial.id, data }, { onSuccess: () => setModal(null) })
            } else {
              createTestimonial.mutate(data, { onSuccess: () => setModal(null) })
            }
          }}
        />
      )}
    </div>
  )
}
