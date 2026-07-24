import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, Home, ToggleLeft, ToggleRight, ImagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { AiDescriptionTextarea } from '@/components/common/AiDescriptionTextarea'
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
  useProperties,
  useCreateProperty,
  useUpdateProperty,
  useDeleteProperty,
  useTogglePropertyActive,
} from '@/hooks/useProperties'
import { propertiesApi } from '@/api/properties'
import type { VendorProperty, VendorPropertyCreate } from '@/api/properties'

import { ThemeSelect } from '@/components/common/ThemeSelect'
import { askConfirm } from '@/components/common/ConfirmProvider'
const PROPERTY_TYPES = ['house', 'condo', 'loft', 'townhouse', 'pg']
const CURRENCIES = ['USD', 'INR', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY']
const PROPERTY_STATUSES = [
  { value: 'for-sale', label: 'For sale' },
  { value: 'for-rent', label: 'For rent' },
  { value: 'new', label: 'New' },
  { value: 'open-house', label: 'Open house' },
  { value: 'pending', label: 'Pending' },
]

function PropertyModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial?: VendorProperty
  onClose: () => void
  onSave: (data: VendorPropertyCreate) => void
  saving: boolean
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [price, setPrice] = useState(initial?.price != null ? String(initial.price) : '')
  const [currency, setCurrency] = useState(initial?.currency ?? 'USD')
  const [beds, setBeds] = useState(String(initial?.beds ?? 3))
  const [baths, setBaths] = useState(String(initial?.baths ?? 2))
  const [sqft, setSqft] = useState(String(initial?.sqft ?? 1500))
  const [type, setType] = useState(initial?.type ?? 'house')
  const [status, setStatus] = useState(initial?.status ?? 'for-sale')
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.image_url ?? null)
  const [imageUploading, setImageUploading] = useState(false)
  const localPreviewRef = useRef<string | null>(null)
  const [agentName, setAgentName] = useState(initial?.agent_name ?? '')
  const [agentPhone, setAgentPhone] = useState(initial?.agent_phone ?? '')
  const [agentEmail, setAgentEmail] = useState(initial?.agent_email ?? '')
  const [ctaLabel, setCtaLabel] = useState(initial?.cta_label ?? 'Schedule tour')
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
      const data = await propertiesApi.uploadImage(file)
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
      address: address.trim() || undefined,
      description: description.trim() || undefined,
      price: price.trim() ? Number(price) : null,
      currency: currency.trim() || 'USD',
      beds: Number(beds) || 0,
      baths: Number(baths) || 0,
      sqft: Number(sqft) || 0,
      type,
      status,
      image_url: imageUrl || null,
      agent_name: agentName.trim() || undefined,
      agent_phone: agentPhone.trim() || undefined,
      agent_email: agentEmail.trim() || undefined,
      cta_label: ctaLabel.trim() || 'Schedule tour',
      sort_order: Number(sortOrder) || 0,
      is_active: isActive,
    })
  }

  const labelCls = 'text-xs'
  const fieldGap = 'space-y-1'
  const selectCls = 'h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm'

  return (
    <ModalOverlay onClose={onClose} className="z-[100] bg-black/60 p-2">
      <ModalPanel className={cn(modalWidthLg, 'max-h-[calc(100dvh-1rem)]')}>
        <ModalHeader
          title={initial ? 'Edit listing' : 'New listing'}
          onClose={onClose}
          className="border-0 px-4 py-2.5 [&>div>h2]:text-base"
        />
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <ModalBody className="space-y-2.5 overflow-y-auto px-4 pb-3 pt-0">
            <div className="grid grid-cols-[5.5rem_1fr] gap-2.5 items-start">
              <div className={fieldGap}>
                <Label className={labelCls}>Photo</Label>
                <ImageSourcePicker
                  title="Listing photo"
                  uploading={imageUploading}
                  onFile={handleImageFile}
                  onUrl={handleImageUrl}
                >
                  {({ open, uploading }) => (
                    <button
                      type="button"
                      onClick={open}
                      disabled={uploading}
                      className="flex h-14 w-full cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed border-input bg-muted/40 hover:bg-muted/60 disabled:pointer-events-none"
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
                        <span className="flex flex-col items-center gap-0.5 text-[10px] text-muted-foreground">
                          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                          Add
                        </span>
                      )}
                    </button>
                  )}
                </ImageSourcePicker>
              </div>
              <div className="space-y-2">
                <div className={fieldGap}>
                  <Label className={labelCls}>Title *</Label>
                  <Input className="h-8 text-sm" value={title} onChange={e => setTitle(e.target.value)} required autoFocus placeholder="Sunlit Park Slope Brownstone" />
                </div>
                <div className={fieldGap}>
                  <Label className={labelCls}>Address</Label>
                  <Input className="h-8 text-sm" value={address} onChange={e => setAddress(e.target.value)} placeholder="127 Carroll St, Brooklyn, NY" />
                </div>
              </div>
            </div>

            <div className={fieldGap}>
              <Label className={labelCls}>Description (optional)</Label>
              <AiDescriptionTextarea
                value={description}
                onChange={setDescription}
                rows={2}
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                placeholder="About this home…"
                maxLength={2000}
                context={{
                  field_kind: 'property_description',
                  name: title,
                  category: type,
                  extra_context: { address, beds, baths, sqft, status },
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
              <div className={cn(fieldGap, 'sm:col-span-2')}>
                <Label className={labelCls}>Price</Label>
                <Input className="h-8 text-sm" type="number" min={0} step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Currency</Label>
                <ThemeSelect
                  value={currency}
                  onChange={setCurrency}
                  options={(CURRENCIES.includes(currency) ? CURRENCIES : [currency, ...CURRENCIES]).map(c => ({ value: c, label: c }))}
                  className={selectCls}
                />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Beds</Label>
                <Input className="h-8 text-sm" type="number" min={0} value={beds} onChange={e => setBeds(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Baths</Label>
                <Input className="h-8 text-sm" type="number" min={0} value={baths} onChange={e => setBaths(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Sq ft</Label>
                <Input className="h-8 text-sm" type="number" min={0} value={sqft} onChange={e => setSqft(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className={fieldGap}>
                <Label className={labelCls}>Type</Label>
                <ThemeSelect
                  value={type}
                  onChange={setType}
                  options={PROPERTY_TYPES.map(t => ({
                    value: t,
                    label: t === 'pg' ? 'PG' : t.charAt(0).toUpperCase() + t.slice(1),
                  }))}
                  className={selectCls}
                />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Status</Label>
                <ThemeSelect
                  value={status}
                  onChange={setStatus}
                  options={PROPERTY_STATUSES}
                  className={selectCls}
                />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>CTA label</Label>
                <Input className="h-8 text-sm" value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Sort order</Label>
                <Input className="h-8 text-sm" type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className={fieldGap}>
                <Label className={labelCls}>Listing agent</Label>
                <Input className="h-8 text-sm" value={agentName} onChange={e => setAgentName(e.target.value)} placeholder="Sasha Reed" />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Agent phone</Label>
                <Input className="h-8 text-sm" value={agentPhone} onChange={e => setAgentPhone(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Agent email</Label>
                <Input className="h-8 text-sm" value={agentEmail} onChange={e => setAgentEmail(e.target.value)} />
              </div>
            </div>

            <CheckboxFieldLabel
              label="Active on storefront"
              checked={isActive}
              onChange={setIsActive}
              labelClassName="text-xs"
            />
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

export default function SalesPropertiesPage() {
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; property?: VendorProperty } | null>(null)
  const [sortKey, setSortKey] = useState('sort_order')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const { data, isLoading } = useProperties({ size: 100, search: search.trim() || undefined })
  const createProperty = useCreateProperty()
  const updateProperty = useUpdateProperty()
  const deleteProperty = useDeleteProperty()
  const toggleActive = useTogglePropertyActive()

  const rows = useMemo(() => {
    const items = data?.items ?? []
    return processRows(
      items,
      search,
      (p) => [p.title, p.address ?? '', p.type, p.status],
      sortKey,
      sortDir,
      {
        sort_order: (p) => p.sort_order,
        title: (p) => p.title,
        price: (p) => p.price ?? 0,
        beds: (p) => p.beds,
        status: (p) => p.status,
        is_active: (p) => (p.is_active ? 1 : 0),
      },
    )
  }, [data?.items, search, sortKey, sortDir])

  const saving = createProperty.isPending || updateProperty.isPending
  const { isSaving, patchField } = useInlineFieldPatch(updateProperty)

  return (
    <div className="space-y-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="flex items-center gap-1.5 text-lg font-semibold leading-tight">
            <Home className="h-4 w-4 shrink-0 text-primary" />
            Property Listings
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Storefront listings · syncs to Website Builder
          </p>
        </div>
        <Button onClick={() => setModal({ mode: 'create' })} className="h-8 gap-1.5 px-3 text-sm shrink-0">
          <Plus className="h-3.5 w-3.5" /> Add listing
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search listings…"
            sortOptions={[
              { value: 'sort_order', label: 'Order' },
              { value: 'title', label: 'Title' },
              { value: 'price', label: 'Price' },
              { value: 'beds', label: 'Beds' },
              { value: 'status', label: 'Status' },
              { value: 'is_active', label: 'Active' },
            ]}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKeyChange={setSortKey}
            onSortDirChange={setSortDir}
            hint={INLINE_EDIT_HINT}
          />
          <div className="overflow-x-auto">
            <ResizableTable tableId="sales-properties-v1" defaultWidths={[64, 220, 160, 120, 80, 110, 90, 120]}>
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Order</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Listing</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Address</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Price</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Beds/Baths</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Status</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Active</TableColumnLabel></th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Actions</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={8} className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">No listings yet. Add your first property to sync with the website builder.</td></tr>
                ) : rows.map(property => (
                  <tr
                    key={property.id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={onClickableTableRow(() => setModal({ mode: 'edit', property }))}
                  >
                    <td className="px-4 py-3 text-sm">
                      <InlineEditCell type="number" value={property.sort_order} readOnly readOnlyMessage="Use the full editor to change sort order" title="Order">
                        {property.sort_order}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        {property.image_url ? (
                          <img src={mediaUrl(property.image_url)} alt="" className="h-8 w-10 rounded object-cover shrink-0" />
                        ) : (
                          <div className="h-8 w-10 rounded bg-muted shrink-0" />
                        )}
                        <InlineEditCell
                          value={property.title}
                          saving={isSaving(property.id, 'title')}
                          validate={(v) => String(v).trim().length < 1 ? 'Title is required' : null}
                          onSave={(v) => patchField(property.id, 'title', String(v).trim())}
                          title="Edit listing title"
                          className="-mx-1.5 min-w-0 flex-1"
                        >
                          <span className="line-clamp-1">{property.title}</span>
                        </InlineEditCell>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <InlineEditCell
                        value={property.address || ''}
                        saving={isSaving(property.id, 'address')}
                        onSave={(v) => patchField(property.id, 'address', String(v).trim() || null)}
                        title="Edit address"
                      >
                        {property.address || '—'}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <InlineEditCell
                        type="number"
                        value={property.price ?? 0}
                        min={0}
                        step="0.01"
                        saving={isSaving(property.id, 'price')}
                        validate={(v) => Number(v) < 0 ? 'Price must be 0 or more' : null}
                        onSave={(v) => patchField(property.id, 'price', Number(v) || null)}
                        title="Edit price"
                      >
                        {property.price != null ? formatCurrency(property.price, property.currency) : '—'}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-1">
                        <InlineEditCell
                          type="number"
                          value={property.beds}
                          min={0}
                          step="1"
                          saving={isSaving(property.id, 'beds')}
                          onSave={(v) => patchField(property.id, 'beds', Number(v) || 0)}
                          title="Edit beds"
                        >
                          {property.beds}
                        </InlineEditCell>
                        <span>/</span>
                        <InlineEditCell
                          type="number"
                          value={property.baths}
                          min={0}
                          step="1"
                          saving={isSaving(property.id, 'baths')}
                          onSave={(v) => patchField(property.id, 'baths', Number(v) || 0)}
                          title="Edit baths"
                        >
                          {property.baths}
                        </InlineEditCell>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm capitalize">
                      <InlineEditCell
                        type="select"
                        value={property.status}
                        options={PROPERTY_STATUSES}
                        saving={isSaving(property.id, 'status')}
                        onSave={(v) => patchField(property.id, 'status', v)}
                        title="Edit status"
                      >
                        {property.status.replace('-', ' ')}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <InlineEditCell
                        type="select"
                        value={property.is_active ? 'true' : 'false'}
                        options={[
                          { value: 'true', label: 'Active' },
                          { value: 'false', label: 'Hidden' },
                        ]}
                        saving={isSaving(property.id, 'is_active')}
                        onSave={(v) => patchField(property.id, 'is_active', v === 'true')}
                        title="Edit active status"
                      >
                        {property.is_active ? <span className="text-green-700 font-medium">Active</span> : <span className="text-muted-foreground">Hidden</span>}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title={property.is_active ? 'Deactivate' : 'Activate'}
                          onClick={e => {
                            e.stopPropagation()
                            toggleActive.mutate({ id: property.id, is_active: !property.is_active })
                          }}
                          className="rounded p-1 hover:bg-muted"
                        >
                          {property.is_active ? <ToggleRight className="h-4 w-4 text-primary" /> : <ToggleLeft className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          title="Edit"
                          onClick={e => { e.stopPropagation(); setModal({ mode: 'edit', property }) }}
                          className="rounded p-1 hover:bg-muted"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={async e => {
                            e.stopPropagation()
                            if (await askConfirm(`Delete listing "${property.title}"?`)) deleteProperty.mutate(property.id)
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
        <PropertyModal
          initial={modal.mode === 'edit' ? modal.property : undefined}
          onClose={() => setModal(null)}
          saving={saving}
          onSave={data => {
            if (modal.mode === 'edit' && modal.property) {
              updateProperty.mutate({ id: modal.property.id, data }, { onSuccess: () => setModal(null) })
            } else {
              createProperty.mutate(data, { onSuccess: () => setModal(null) })
            }
          }}
        />
      )}
    </div>
  )
}
