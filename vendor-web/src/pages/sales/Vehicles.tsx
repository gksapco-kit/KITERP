import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, Car, ToggleLeft, ToggleRight, ImagePlus } from 'lucide-react'
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
  useVehicles,
  useCreateVehicle,
  useUpdateVehicle,
  useDeleteVehicle,
  useToggleVehicleActive,
} from '@/hooks/useVehicles'
import { vehiclesApi } from '@/api/vehicles'
import type { VendorVehicle, VendorVehicleCreate } from '@/api/vehicles'

import { ThemeSelect } from '@/components/common/ThemeSelect'
import { askConfirm } from '@/components/common/ConfirmProvider'
const CONDITIONS = ['New', 'Certified', 'Used']
const FUEL_TYPES = ['Gas', 'Hybrid', 'Electric', 'Diesel']
const TRANSMISSIONS = ['Auto', 'Manual']

function VehicleModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial?: VendorVehicle
  onClose: () => void
  onSave: (data: VendorVehicleCreate) => void
  saving: boolean
}) {
  const [year, setYear] = useState(String(initial?.year ?? 2024))
  const [make, setMake] = useState(initial?.make ?? '')
  const [model, setModel] = useState(initial?.model ?? '')
  const [trim, setTrim] = useState(initial?.trim ?? '')
  const [condition, setCondition] = useState(initial?.condition ?? 'Used')
  const [price, setPrice] = useState(initial?.price != null ? String(initial.price) : '')
  const [currency, setCurrency] = useState(initial?.currency ?? 'USD')
  const [mileage, setMileage] = useState(String(initial?.mileage ?? 0))
  const [fuel, setFuel] = useState(initial?.fuel ?? 'Gas')
  const [transmission, setTransmission] = useState(initial?.transmission ?? 'Auto')
  const [bodyStyle, setBodyStyle] = useState(initial?.body_style ?? '')
  const [exteriorColor, setExteriorColor] = useState(initial?.exterior_color ?? '')
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.image_url ?? null)
  const [imageUploading, setImageUploading] = useState(false)
  const localPreviewRef = useRef<string | null>(null)
  const [stockNumber, setStockNumber] = useState(initial?.stock_number ?? '')
  const [locationNote, setLocationNote] = useState(initial?.location_note ?? '')
  const [ctaLabel, setCtaLabel] = useState(initial?.cta_label ?? 'Schedule test drive')
  const [highlightsText, setHighlightsText] = useState((initial?.highlights ?? []).join('\n'))
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
      const data = await vehiclesApi.uploadImage(file)
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
    if (!make.trim() || !model.trim()) return
    if (imageUrl?.startsWith('blob:')) {
      toast.error('Image is still uploading — wait a moment and try again')
      return
    }
    onSave({
      year: Number(year) || 2024,
      make: make.trim(),
      model: model.trim(),
      trim: trim.trim() || undefined,
      condition,
      price: price.trim() ? Number(price) : 0,
      currency: currency.trim() || 'USD',
      mileage: Number(mileage) || 0,
      fuel,
      transmission,
      body_style: bodyStyle.trim() || undefined,
      exterior_color: exteriorColor.trim() || undefined,
      image_url: imageUrl || undefined,
      stock_number: stockNumber.trim() || undefined,
      location_note: locationNote.trim() || undefined,
      cta_label: ctaLabel.trim() || 'Schedule test drive',
      highlights: highlightsText.split('\n').map(s => s.trim()).filter(Boolean),
      sort_order: Number(sortOrder) || 0,
      is_active: isActive,
    })
  }

  const labelCls = 'text-[10px] leading-none'
  const fieldGap = 'space-y-0.5'
  const inputCls = 'h-7 text-xs'
  const selectCls = 'h-7 w-full rounded-md border border-input bg-background px-2 text-xs'
  const moreOpen = !!highlightsText.trim() || !!locationNote.trim()

  return (
    <ModalOverlay onClose={onClose} className="z-[100] bg-black/60 p-1.5">
      <ModalPanel className={cn(modalWidthLg, 'max-h-[calc(100dvh-0.75rem)]')}>
        <ModalHeader
          title={initial ? 'Edit vehicle' : 'New vehicle'}
          onClose={onClose}
          className="border-0 px-3 py-2 [&>div>h2]:text-sm"
        />
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <ModalBody className="space-y-1.5 overflow-y-auto px-3 pb-2 pt-0">
            <div className="grid grid-cols-[3.75rem_4.5rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-1.5 items-end">
              <ImageSourcePicker
                title="Vehicle photo"
                uploading={imageUploading}
                onFile={handleImageFile}
                onUrl={handleImageUrl}
              >
                {({ open, uploading }) => (
                  <button
                    type="button"
                    onClick={open}
                    disabled={uploading}
                    aria-label="Add vehicle photo"
                    title="Vehicle photo"
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
                <Label className={labelCls}>Year</Label>
                <Input className={inputCls} type="number" value={year} onChange={e => setYear(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Make *</Label>
                <Input className={inputCls} value={make} onChange={e => setMake(e.target.value)} required autoFocus placeholder="Rivian" />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Model *</Label>
                <Input className={inputCls} value={model} onChange={e => setModel(e.target.value)} required placeholder="R1S" />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Trim</Label>
                <Input className={inputCls} value={trim} onChange={e => setTrim(e.target.value)} placeholder="Adventure" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-[1fr_1fr_5.5rem_5.5rem]">
              <div className={fieldGap}>
                <Label className={labelCls}>Condition</Label>
                <div className="flex h-7 gap-0.5">
                  {CONDITIONS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCondition(c)}
                      className={cn(
                        'flex-1 rounded-md border text-[10px] font-semibold transition-colors',
                        condition === c
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-muted-foreground hover:border-primary/40',
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Price</Label>
                <Input className={inputCls} type="number" min={0} step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Currency</Label>
                <Input className={inputCls} value={currency} onChange={e => setCurrency(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Mileage</Label>
                <Input className={inputCls} type="number" min={0} value={mileage} onChange={e => setMileage(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
              <div className={fieldGap}>
                <Label className={labelCls}>Body style</Label>
                <Input className={inputCls} value={bodyStyle} onChange={e => setBodyStyle(e.target.value)} placeholder="SUV" />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Fuel</Label>
                <ThemeSelect
                  value={fuel}
                  onChange={setFuel}
                  options={FUEL_TYPES.map(f => ({ value: f, label: f }))}
                  className={selectCls}
                />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Transmission</Label>
                <ThemeSelect
                  value={transmission}
                  onChange={setTransmission}
                  options={TRANSMISSIONS.map(t => ({ value: t, label: t }))}
                  className={selectCls}
                />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Color</Label>
                <Input className={inputCls} value={exteriorColor} onChange={e => setExteriorColor(e.target.value)} placeholder="Forest Green" />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Stock #</Label>
                <Input className={inputCls} value={stockNumber} onChange={e => setStockNumber(e.target.value)} placeholder="AC-V1-2025" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-[1fr_5.5rem]">
              <div className={fieldGap}>
                <Label className={labelCls}>Button label</Label>
                <Input className={inputCls} value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Sort</Label>
                <Input className={inputCls} type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
              </div>
            </div>

            <details className="rounded-md bg-muted/15 px-2 py-1" open={moreOpen}>
              <summary className="cursor-pointer list-none text-[10px] font-medium text-muted-foreground hover:text-foreground">
                Location &amp; highlights {moreOpen ? '' : '· optional'}
              </summary>
              <div className="mt-1.5 space-y-1.5">
                <div className={fieldGap}>
                  <Label className={labelCls}>Location note</Label>
                  <Input
                    className={inputCls}
                    value={locationNote}
                    onChange={e => setLocationNote(e.target.value)}
                    placeholder="Williamsburg showroom · Available for delivery"
                  />
                </div>
                <div className={fieldGap}>
                  <Label className={labelCls}>Highlights (one per line)</Label>
                  <textarea
                    value={highlightsText}
                    onChange={e => setHighlightsText(e.target.value)}
                    rows={2}
                    className="w-full resize-none rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder={'One-owner, clean title\nFree CARFAX history report'}
                  />
                </div>
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
              <Button type="submit" className="h-7 px-2.5 text-xs" disabled={saving || !make.trim() || !model.trim()}>
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

export default function SalesVehiclesPage() {
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; vehicle?: VendorVehicle } | null>(null)
  const [sortKey, setSortKey] = useState('sort_order')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const { data, isLoading } = useVehicles({ size: 100, search: search.trim() || undefined })
  const createVehicle = useCreateVehicle()
  const updateVehicle = useUpdateVehicle()
  const deleteVehicle = useDeleteVehicle()
  const toggleActive = useToggleVehicleActive()

  const rows = useMemo(() => {
    const items = data?.items ?? []
    return processRows(
      items,
      search,
      (v) => [v.make, v.model, v.trim ?? '', v.condition],
      sortKey,
      sortDir,
      {
        sort_order: (v) => v.sort_order,
        make: (v) => `${v.make} ${v.model}`,
        price: (v) => v.price ?? 0,
        mileage: (v) => v.mileage,
        condition: (v) => v.condition,
        is_active: (v) => (v.is_active ? 1 : 0),
      },
    )
  }, [data?.items, search, sortKey, sortDir])

  const saving = createVehicle.isPending || updateVehicle.isPending
  const { isSaving, patchField } = useInlineFieldPatch(updateVehicle)

  return (
    <div className="space-y-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="flex items-center gap-1.5 text-lg font-semibold leading-tight">
            <Car className="h-4 w-4 shrink-0 text-primary" />
            Vehicle Inventory
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Storefront vehicles · syncs to Website Builder
          </p>
        </div>
        <Button onClick={() => setModal({ mode: 'create' })} className="h-8 gap-1.5 px-3 text-sm shrink-0">
          <Plus className="h-3.5 w-3.5" /> Add vehicle
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search vehicles…"
            sortOptions={[
              { value: 'sort_order', label: 'Order' },
              { value: 'make', label: 'Make/Model' },
              { value: 'price', label: 'Price' },
              { value: 'mileage', label: 'Mileage' },
              { value: 'condition', label: 'Condition' },
              { value: 'is_active', label: 'Active' },
            ]}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKeyChange={setSortKey}
            onSortDirChange={setSortDir}
            hint={INLINE_EDIT_HINT}
          />
          <div className="overflow-x-auto">
            <ResizableTable tableId="sales-vehicles-v1" defaultWidths={[64, 220, 130, 100, 110, 90, 120]}>
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Order</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Vehicle</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Price</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Mileage</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Condition</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Active</TableColumnLabel></th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Actions</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={7} className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">No vehicles yet. Add your first vehicle to sync with the website builder.</td></tr>
                ) : rows.map(vehicle => (
                  <tr
                    key={vehicle.id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={onClickableTableRow(() => setModal({ mode: 'edit', vehicle }))}
                  >
                    <td className="px-4 py-3 text-sm">
                      <InlineEditCell type="number" value={vehicle.sort_order} readOnly readOnlyMessage="Use the full editor to change sort order" title="Order">
                        {vehicle.sort_order}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        {vehicle.image_url ? (
                          <img src={mediaUrl(vehicle.image_url)} alt="" className="h-8 w-10 rounded object-cover shrink-0" />
                        ) : (
                          <div className="h-8 w-10 rounded bg-muted shrink-0" />
                        )}
                        <div className="min-w-0 flex flex-wrap items-center gap-1">
                          <InlineEditCell
                            type="number"
                            value={vehicle.year}
                            min={1900}
                            step="1"
                            saving={isSaving(vehicle.id, 'year')}
                            onSave={(v) => patchField(vehicle.id, 'year', Number(v) || vehicle.year)}
                            title="Edit year"
                          >
                            <span>{vehicle.year}</span>
                          </InlineEditCell>
                          <InlineEditCell
                            value={vehicle.make}
                            saving={isSaving(vehicle.id, 'make')}
                            validate={(v) => String(v).trim().length < 1 ? 'Make is required' : null}
                            onSave={(v) => patchField(vehicle.id, 'make', String(v).trim())}
                            title="Edit make"
                          >
                            <span>{vehicle.make}</span>
                          </InlineEditCell>
                          <InlineEditCell
                            value={vehicle.model}
                            saving={isSaving(vehicle.id, 'model')}
                            validate={(v) => String(v).trim().length < 1 ? 'Model is required' : null}
                            onSave={(v) => patchField(vehicle.id, 'model', String(v).trim())}
                            title="Edit model"
                          >
                            <span className="line-clamp-1">{vehicle.model}</span>
                          </InlineEditCell>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <InlineEditCell
                        type="number"
                        value={vehicle.price ?? 0}
                        min={0}
                        step="0.01"
                        saving={isSaving(vehicle.id, 'price')}
                        validate={(v) => Number(v) < 0 ? 'Price must be 0 or more' : null}
                        onSave={(v) => patchField(vehicle.id, 'price', Number(v) || null)}
                        title="Edit price"
                      >
                        {vehicle.price != null ? formatCurrency(vehicle.price, vehicle.currency) : '—'}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <InlineEditCell
                        type="number"
                        value={vehicle.mileage}
                        min={0}
                        step="1"
                        saving={isSaving(vehicle.id, 'mileage')}
                        onSave={(v) => patchField(vehicle.id, 'mileage', Number(v) || 0)}
                        title="Edit mileage"
                      >
                        {vehicle.mileage.toLocaleString()} mi
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <InlineEditCell
                        type="select"
                        value={vehicle.condition}
                        options={CONDITIONS.map(c => ({ value: c, label: c }))}
                        saving={isSaving(vehicle.id, 'condition')}
                        onSave={(v) => patchField(vehicle.id, 'condition', v)}
                        title="Edit condition"
                      >
                        {vehicle.condition}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <InlineEditCell
                        type="select"
                        value={vehicle.is_active ? 'true' : 'false'}
                        options={[
                          { value: 'true', label: 'Active' },
                          { value: 'false', label: 'Hidden' },
                        ]}
                        saving={isSaving(vehicle.id, 'is_active')}
                        onSave={(v) => patchField(vehicle.id, 'is_active', v === 'true')}
                        title="Edit active status"
                      >
                        {vehicle.is_active ? <span className="text-green-700 font-medium">Active</span> : <span className="text-muted-foreground">Hidden</span>}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title={vehicle.is_active ? 'Deactivate' : 'Activate'}
                          onClick={e => {
                            e.stopPropagation()
                            toggleActive.mutate({ id: vehicle.id, is_active: !vehicle.is_active })
                          }}
                          className="rounded p-1 hover:bg-muted"
                        >
                          {vehicle.is_active ? <ToggleRight className="h-4 w-4 text-primary" /> : <ToggleLeft className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          title="Edit"
                          onClick={e => { e.stopPropagation(); setModal({ mode: 'edit', vehicle }) }}
                          className="rounded p-1 hover:bg-muted"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={async e => {
                            e.stopPropagation()
                            if (await askConfirm(`Delete "${vehicle.year} ${vehicle.make} ${vehicle.model}"?`)) deleteVehicle.mutate(vehicle.id)
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
        <VehicleModal
          initial={modal.mode === 'edit' ? modal.vehicle : undefined}
          onClose={() => setModal(null)}
          saving={saving}
          onSave={data => {
            if (modal.mode === 'edit' && modal.vehicle) {
              updateVehicle.mutate({ id: modal.vehicle.id, data }, { onSuccess: () => setModal(null) })
            } else {
              createVehicle.mutate(data, { onSuccess: () => setModal(null) })
            }
          }}
        />
      )}
    </div>
  )
}
