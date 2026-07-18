import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, Quote, ToggleLeft, ToggleRight, ImagePlus, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { ResizableTable } from '@/components/table/ResizableTable'
import { InlineEditCell } from '@/components/table/InlineEditCell'
import { TableToolbar } from '@/components/table/TableToolbar'
import { useInlineFieldPatch, INLINE_EDIT_HINT } from '@/hooks/useInlineFieldPatch'
import { CheckboxFieldLabel, TableColumnLabel } from '@/components/common/FieldLabel'
import { cn, isLikelyImageFile, mediaUrl } from '@/lib/utils'
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

import { askConfirm } from '@/components/common/ConfirmProvider'
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

  const labelCls = 'text-[10px] leading-none'
  const fieldGap = 'space-y-0.5'
  const inputCls = 'h-7 text-xs'

  return (
    <ModalOverlay onClose={onClose} className="z-[100] bg-black/60 p-3">
      <ModalPanel className="max-w-md min-h-[28rem] max-h-[calc(100dvh-1.5rem)] !rounded-lg">
        <ModalHeader
          title={initial ? 'Edit testimonial' : 'New testimonial'}
          onClose={onClose}
          className="border-0 px-4 py-3 [&>div>h2]:text-base"
        />
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <ModalBody className="flex flex-1 flex-col space-y-2.5 overflow-y-auto px-4 pb-3 pt-0">
            <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2.5 items-start">
              <div className={fieldGap}>
                <Label className={labelCls}>Photo</Label>
                <label
                  className={cn(
                    'relative flex size-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden',
                    'rounded border border-dashed border-input bg-muted/30',
                    'transition-colors hover:border-primary/40 hover:bg-muted/50',
                    avatarUrl && 'border-solid border-border',
                  )}
                  title="Customer photo"
                  aria-label="Add customer photo"
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl.startsWith('blob:') ? avatarUrl : mediaUrl(avatarUrl)}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : avatarUploading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <span className="flex flex-col items-center gap-0.5 text-muted-foreground">
                      <ImagePlus className="h-5 w-5" />
                      <span className="text-[10px] leading-none">Add</span>
                    </span>
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
              </div>
              <div className="min-w-0 space-y-2">
                <div className={fieldGap}>
                  <Label className={labelCls}>Customer name *</Label>
                  <Input className={inputCls} value={name} onChange={e => setName(e.target.value)} required autoFocus placeholder="Jane Cooper" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className={fieldGap}>
                    <Label className={labelCls}>Role</Label>
                    <Input className={inputCls} value={role} onChange={e => setRole(e.target.value)} placeholder="Marketing Lead" />
                  </div>
                  <div className={fieldGap}>
                    <Label className={labelCls}>Company</Label>
                    <Input className={inputCls} value={company} onChange={e => setCompany(e.target.value)} placeholder="Acme Inc." />
                  </div>
                </div>
              </div>
            </div>

            <div className={cn(fieldGap, 'flex min-h-0 flex-1 flex-col')}>
              <Label className={labelCls}>Quote *</Label>
              <Textarea
                value={quote}
                onChange={e => setQuote(e.target.value)}
                required
                rows={8}
                className="min-h-[11rem] flex-1 resize-y px-2.5 py-2 text-xs"
                placeholder="Working with this team was a game changer for our business..."
              />
            </div>

            <div className="grid grid-cols-[1fr_5rem] gap-2">
              <div className={fieldGap}>
                <Label className={labelCls}>Rating</Label>
                <div className="flex h-7 items-center gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <button key={i} type="button" onClick={() => setRating(i + 1)} className="p-0.5" aria-label={`${i + 1} stars`}>
                      <Star className={cn('h-4 w-4', i < rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
                    </button>
                  ))}
                </div>
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Sort</Label>
                <Input className={inputCls} type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
              </div>
            </div>
          </ModalBody>
          <ModalFooter className="items-center justify-between gap-2 border-0 bg-transparent px-4 py-3">
            <CheckboxFieldLabel
              label="Active on storefront"
              checked={isActive}
              onChange={setIsActive}
              labelClassName="text-xs"
              inputClassName="h-3.5 w-3.5 rounded-sm accent-foreground"
            />
            <div className="flex gap-2">
              <Button type="button" variant="cancel" className="h-7 px-2.5 text-xs" onClick={onClose}>Cancel</Button>
              <Button type="submit" className="h-7 px-2.5 text-xs" disabled={saving || !name.trim() || !quote.trim()}>
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
    <div className="space-y-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="flex items-center gap-1.5 text-lg font-semibold leading-tight">
            <Quote className="h-4 w-4 shrink-0 text-primary" />
            Testimonials
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Storefront quotes · syncs to Website Builder
          </p>
        </div>
        <Button onClick={() => setModal({ mode: 'create' })} className="h-8 gap-1.5 px-3 text-sm shrink-0">
          <Plus className="h-3.5 w-3.5" /> Add testimonial
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
                          onClick={async e => {
                            e.stopPropagation()
                            if (await askConfirm(`Delete testimonial from "${testimonial.name}"?`)) deleteTestimonial.mutate(testimonial.id)
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
