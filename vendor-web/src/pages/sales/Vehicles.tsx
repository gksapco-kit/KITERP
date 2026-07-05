import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, Car, ToggleLeft, ToggleRight, X, ImagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { ResizableTable } from '@/components/table/ResizableTable'
import { TableToolbar } from '@/components/table/TableToolbar'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { ImageSourcePicker } from '@/components/common/ImageSourcePicker'
import { resolveBusinessGalleryDisplayUrl } from '@/data/businessImagePack'
import { formatCurrency, isLikelyImageFile, mediaUrl } from '@/lib/utils'
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
  useEscapeToClose(onClose)
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-lg max-h-[90vh] flex-col rounded-xl border border-border bg-card shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">{initial ? 'Edit vehicle' : 'New vehicle'}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-1 min-h-0 flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 p-5">
          <div>
            <Label>Vehicle photo</Label>
            <ImageSourcePicker
              title="Vehicle photo"
              uploading={imageUploading}
              onFile={handleImageFile}
              onUrl={handleImageUrl}
              className="mt-1"
            >
              {({ open, uploading }) => (
                <button
                  type="button"
                  onClick={open}
                  disabled={uploading}
                  className="flex h-32 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-input bg-muted/40 hover:bg-muted/60 disabled:pointer-events-none"
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
                    <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
                      {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                      Add photo
                    </span>
                  )}
                </button>
              )}
            </ImageSourcePicker>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Year</Label>
              <Input type="number" value={year} onChange={e => setYear(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Make</Label>
              <Input value={make} onChange={e => setMake(e.target.value)} required placeholder="Rivian" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Model</Label>
              <Input value={model} onChange={e => setModel(e.target.value)} required placeholder="R1S" />
            </div>
            <div>
              <Label>Trim</Label>
              <Input value={trim} onChange={e => setTrim(e.target.value)} placeholder="Adventure" />
            </div>
          </div>
          <div>
            <Label>Condition</Label>
            <div className="mt-1 flex gap-1.5">
              {CONDITIONS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCondition(c)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${
                    condition === c ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40'
                  }`}
                >{c}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label>Price</Label>
              <Input type="number" min={0} step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
            </div>
            <div>
              <Label>Currency</Label>
              <Input value={currency} onChange={e => setCurrency(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Mileage</Label>
              <Input type="number" min={0} value={mileage} onChange={e => setMileage(e.target.value)} />
            </div>
            <div>
              <Label>Body style</Label>
              <Input value={bodyStyle} onChange={e => setBodyStyle(e.target.value)} placeholder="SUV" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fuel type</Label>
              <select
                value={fuel}
                onChange={e => setFuel(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                {FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <Label>Transmission</Label>
              <select
                value={transmission}
                onChange={e => setTransmission(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                {TRANSMISSIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label>Exterior color</Label>
            <Input value={exteriorColor} onChange={e => setExteriorColor(e.target.value)} placeholder="Forest Green" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Stock number</Label>
              <Input value={stockNumber} onChange={e => setStockNumber(e.target.value)} placeholder="AC-V1-2025" />
            </div>
            <div>
              <Label>Button label</Label>
              <Input value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Location note</Label>
            <Input value={locationNote} onChange={e => setLocationNote(e.target.value)} placeholder="Located at our Williamsburg showroom · Available for delivery" />
          </div>
          <div>
            <Label>Highlights (one per line)</Label>
            <textarea
              value={highlightsText}
              onChange={e => setHighlightsText(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder={'One-owner, clean title\nFree CARFAX history report'}
            />
          </div>
          <div>
            <Label>Sort order</Label>
            <Input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
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

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" />
            Vehicle Inventory
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Manage vehicles shown on your storefront. Vehicles sync automatically to Auto Inventory and Vehicle Detail sections in the website builder.
          </p>
        </div>
        <Button onClick={() => setModal({ mode: 'create' })} className="gap-2">
          <Plus className="h-4 w-4" /> Add vehicle
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
                    <td className="px-4 py-3 text-sm">{vehicle.sort_order}</td>
                    <td className="px-4 py-3 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        {vehicle.image_url ? (
                          <img src={mediaUrl(vehicle.image_url)} alt="" className="h-8 w-10 rounded object-cover shrink-0" />
                        ) : (
                          <div className="h-8 w-10 rounded bg-muted shrink-0" />
                        )}
                        <span className="line-clamp-1">{vehicle.year} {vehicle.make} {vehicle.model}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{vehicle.price != null ? formatCurrency(vehicle.price, vehicle.currency) : '—'}</td>
                    <td className="px-4 py-3 text-sm">{vehicle.mileage.toLocaleString()} mi</td>
                    <td className="px-4 py-3 text-sm">{vehicle.condition}</td>
                    <td className="px-4 py-3 text-sm">{vehicle.is_active ? <span className="text-green-700 font-medium">Active</span> : <span className="text-muted-foreground">Hidden</span>}</td>
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
                          onClick={e => {
                            e.stopPropagation()
                            if (window.confirm(`Delete "${vehicle.year} ${vehicle.make} ${vehicle.model}"?`)) deleteVehicle.mutate(vehicle.id)
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
