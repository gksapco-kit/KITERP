import { useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Layers, Hash } from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import type { VariantDetail, VariantPatchFields } from '@/api/vendor'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { VariantMediaUpload, type VariantMediaItem } from '@/components/common/ImageUpload'
import { UOM_OPTIONS } from '@/lib/uomOptions'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'
import { cn } from '@/lib/utils'
import { Select } from '@/components/ui/select'

interface Props {
  productId: string
  variantId: string
  onClose: () => void
  /** Open a specific tab (e.g. "media" when launched from the Fast-edit thumbnail). */
  initialTab?: 'general' | 'pricing' | 'promotion' | 'inventory' | 'attributes' | 'media'
}

const selectCls =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

function dateInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  return String(iso).slice(0, 10)
}

export function VariantDetailsDrawer({ productId, variantId, onClose, initialTab = 'general' }: Props) {
  const qc = useQueryClient()
  const detailKey = ['variant-detail', productId, variantId]

  const { data: variant, isLoading } = useQuery({
    queryKey: detailKey,
    queryFn: () => vendorApi.productGetVariant(productId, variantId),
  })

  const patchMutation = useMutation({
    mutationFn: (fields: VariantPatchFields) => vendorApi.productPatchVariant(productId, variantId, fields),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: detailKey })
      qc.invalidateQueries({ queryKey: ['product-variants', productId] })
    },
    onError: () => toast.error('Could not save change'),
  })

  const save = (fields: VariantPatchFields) => patchMutation.mutate(fields)

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" className="overflow-y-auto sm:max-w-2xl">
        {isLoading || !variant ? (
          <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
        ) : (
          <VariantDetailsBody
            productId={productId}
            variant={variant}
            onSave={save}
            saving={patchMutation.isPending}
            initialTab={initialTab}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function VariantDetailsBody({
  productId, variant, onSave, saving, initialTab,
}: {
  productId: string
  variant: VariantDetail
  onSave: (fields: VariantPatchFields) => void
  saving: boolean
  initialTab: NonNullable<Props['initialTab']>
}) {
  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          {variant.name}
          {!variant.is_active && <Badge variant="secondary">Inactive</Badge>}
        </SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-2">
          <span className="font-mono">{variant.sku || 'No SKU'}</span>
          {variant.variant_hash && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Hash className="h-3 w-3" /> {variant.variant_hash.slice(0, 12)}
            </span>
          )}
          {saving && <Loader2 className="h-3 w-3 animate-spin" />}
        </SheetDescription>
      </SheetHeader>

      <Tabs defaultValue={initialTab} className="mt-2">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="pricing">Pricing &amp; Tax</TabsTrigger>
          <TabsTrigger value="promotion">Promotion</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="attributes">Attributes</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-3">
          <Field label="Name" defaultValue={variant.name} onCommit={v => onSave({ name: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU" defaultValue={variant.sku ?? ''} onCommit={v => onSave({ sku: v })} />
            <Field label="Barcode" defaultValue={variant.barcode ?? ''} onCommit={v => onSave({ barcode: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Color" defaultValue={variant.color ?? ''} onCommit={v => onSave({ color: v })} />
            <Field
              label="Qty (UOM)"
              type="number"
              defaultValue={variant.uom_quantity ?? ''}
              onCommit={v => onSave({ uom_quantity: v === '' ? undefined : Number(v) })}
            />
          </div>
          <SelectField
            label="UOM"
            value={variant.uom || 'piece'}
            onChange={v => onSave({ uom: v })}
            options={UOM_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
          />
          <ToggleRow label="Active" checked={variant.is_active} onChange={v => onSave({ is_active: v })} />
        </TabsContent>

        <TabsContent value="pricing" className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Price" type="number" defaultValue={variant.price} onCommit={v => onSave({ price: Number(v) || 0 })} />
            <Field label="Compare-at" type="number" defaultValue={variant.compare_at_price ?? ''} onCommit={v => onSave({ compare_at_price: v === '' ? undefined : Number(v) })} />
            <Field label="Cost" type="number" defaultValue={variant.cost_price ?? ''} onCommit={v => onSave({ cost_price: v === '' ? undefined : Number(v) })} />
          </div>
          <SelectField
            label="Currency"
            value={variant.currency || 'INR'}
            onChange={v => onSave({ currency: v })}
            options={[
              { value: 'INR', label: '₹ INR' },
              { value: 'USD', label: '$ USD' },
              { value: 'EUR', label: '€ EUR' },
              { value: 'GBP', label: '£ GBP' },
            ]}
          />
          <ToggleRow label="Taxable" checked={variant.is_taxable} onChange={v => onSave({ is_taxable: v })} />
          <div className="grid grid-cols-3 gap-3">
            <Field label="Tax rate %" type="number" defaultValue={variant.tax_rate ?? ''} onCommit={v => onSave({ tax_rate: v === '' ? undefined : Number(v) })} />
            <Field label="HSN code" defaultValue={variant.hsn_code ?? ''} onCommit={v => onSave({ hsn_code: v })} />
            <Field label="GST rate %" type="number" defaultValue={variant.gst_rate ?? ''} onCommit={v => onSave({ gst_rate: v === '' ? undefined : Number(v) })} />
          </div>
        </TabsContent>

        <TabsContent value="promotion" className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Disc %"
              type="number"
              defaultValue={variant.discount_percentage ?? ''}
              onCommit={v => onSave({ discount_percentage: v === '' ? undefined : Number(v) })}
            />
            <Field
              label="Disc Amt"
              type="number"
              defaultValue={variant.discount_amount ?? ''}
              onCommit={v => onSave({ discount_amount: v === '' ? undefined : Number(v) })}
            />
          </div>
          <Field
            label="Offer label"
            defaultValue={variant.offer_label ?? ''}
            onCommit={v => onSave({ offer_label: v })}
          />
          <ToggleRow label="On Sale" checked={variant.is_on_sale} onChange={v => onSave({ is_on_sale: v })} />
        </TabsContent>

        <TabsContent value="inventory" className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity on hand" type="number" defaultValue={variant.quantity} onCommit={v => onSave({ quantity: Number(v) || 0 })} />
            <Field label="Low stock threshold" type="number" defaultValue={variant.low_stock_threshold} onCommit={v => onSave({ low_stock_threshold: Number(v) || 0 })} />
          </div>
          <SelectField
            label="Stock status"
            value={variant.stock_status || 'in_stock'}
            onChange={v => onSave({ stock_status: v })}
            options={[
              { value: 'in_stock', label: 'In Stock' },
              { value: 'out_of_stock', label: 'Out of Stock' },
              { value: 'backorder', label: 'Backorder' },
              { value: 'discontinued', label: 'Discontinued' },
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Reorder point" type="number" defaultValue={variant.reorder_point ?? ''} onCommit={v => onSave({ reorder_point: v === '' ? undefined : Number(v) })} />
            <Field label="Reorder quantity" type="number" defaultValue={variant.reorder_quantity ?? ''} onCommit={v => onSave({ reorder_quantity: v === '' ? undefined : Number(v) })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Max per order"
              type="number"
              defaultValue={variant.max_quantity_per_order ?? ''}
              onCommit={v => onSave({ max_quantity_per_order: v === '' ? undefined : Number(v) })}
            />
            <Field
              label="Min per order"
              type="number"
              defaultValue={variant.min_quantity_per_order ?? ''}
              onCommit={v => onSave({ min_quantity_per_order: v === '' ? undefined : Number(v) })}
            />
          </div>
          <Field label="Weight (kg)" type="number" defaultValue={variant.weight_kg ?? ''} onCommit={v => onSave({ weight_kg: v === '' ? undefined : Number(v) })} />
          <ToggleRow label="Track inventory" checked={variant.track_inventory} onChange={v => onSave({ track_inventory: v })} />
          <ToggleRow label="Allow backorders" checked={variant.allow_backorders} onChange={v => onSave({ allow_backorders: v })} />

          <SectionLabel>Lifecycle</SectionLabel>
          <div className="grid grid-cols-3 gap-3">
            <DateField
              label="Manufactured"
              value={dateInputValue(variant.manufacture_date)}
              onCommit={v => onSave({ manufacture_date: v || null })}
            />
            <DateField
              label="Expires"
              value={dateInputValue(variant.expiration_date)}
              onCommit={v => onSave({ expiration_date: v || null })}
            />
            <DateField
              label="Best before"
              value={dateInputValue(variant.best_before_date)}
              onCommit={v => onSave({ best_before_date: v || null })}
            />
          </div>

          <SectionLabel>Return &amp; warranty</SectionLabel>
          <ToggleRow label="Returnable" checked={variant.is_returnable} onChange={v => onSave({ is_returnable: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Return window (days)"
              type="number"
              defaultValue={variant.return_days ?? ''}
              onCommit={v => onSave({ return_days: v === '' ? undefined : Number(v) })}
            />
            <SelectField
              label="Refund policy"
              value={variant.refund_policy ?? ''}
              onChange={v => onSave({ refund_policy: v })}
              options={[
                { value: '', label: 'Select…' },
                { value: 'full_refund', label: 'Full Refund' },
                { value: 'store_credit', label: 'Store Credit' },
                { value: 'exchange_only', label: 'Exchange Only' },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Warranty (days)"
              type="number"
              defaultValue={variant.warranty_period_days ?? ''}
              onCommit={v => onSave({ warranty_period_days: v === '' ? undefined : Number(v) })}
            />
            <Field
              label="Warranty type"
              defaultValue={variant.warranty_type ?? ''}
              onCommit={v => onSave({ warranty_type: v })}
            />
          </div>
        </TabsContent>

        <TabsContent value="attributes" className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attributes</p>
            {Object.keys(variant.attributes || {}).length === 0 ? (
              <p className="text-sm text-muted-foreground">No attributes recorded for this variant.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(variant.attributes).map(([k, v]) => (
                  <Badge key={k} variant="soft">{k}: {String(v)}</Badge>
                ))}
              </div>
            )}
          </div>
          {variant.config_selection && (
            <div>
              <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Layers className="h-3 w-3" /> Configuration Engine selection
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(variant.config_selection).map(([k, v]) => (
                  <Badge key={k} variant="outline">{k} = {String(v)}</Badge>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Auto-generated from the product&apos;s configuration attributes and rules — edit on the
                Attributes &amp; Options / Rules tabs, then use &quot;Delete invalid variants&quot; to clean up.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="media">
          <VariantMediaTab
            productId={productId}
            variantId={variant.id}
            initialMedia={variant.media as unknown as VariantMediaItem[]}
          />
        </TabsContent>
      </Tabs>
    </>
  )
}

function VariantMediaTab({
  productId, variantId, initialMedia,
}: {
  productId: string
  variantId: string
  initialMedia: VariantMediaItem[]
}) {
  const qc = useQueryClient()
  const [media, setMedia] = useState(initialMedia)
  useEffect(() => { setMedia(initialMedia) }, [initialMedia])

  const refreshLists = () => {
    qc.invalidateQueries({ queryKey: ['variant-detail', productId, variantId] })
    qc.invalidateQueries({ queryKey: ['product-variants', productId] })
  }

  const uploadFile = async (file: File) => {
    try {
      const result = await vendorApi.uploadVariantMedia(variantId, file)
      setMedia(result.media)
      refreshLists()
      toast.success('Media uploaded')
    } catch (err: unknown) {
      toast.error(extractApiError(err, 'Image upload failed'))
    }
  }
  const handleDelete = async (url: string) => {
    try {
      const result = await vendorApi.deleteVariantMedia(variantId, url)
      setMedia(result.media)
      refreshLists()
      toast.success('Media removed')
    } catch {
      toast.error('Failed to delete media')
    }
  }
  const handleSetPrimary = async (url: string) => {
    try {
      const result = await vendorApi.setPrimaryVariantMedia(variantId, url)
      setMedia(result.media)
      refreshLists()
      toast.success('Primary image updated')
    } catch {
      toast.error('Failed to set primary')
    }
  }
  const handleReorder = async (urls: string[]) => {
    try {
      const result = await vendorApi.reorderVariantMedia(variantId, urls)
      setMedia(result.media)
      refreshLists()
    } catch {
      toast.error('Failed to reorder media')
    }
  }

  return (
    <VariantMediaUpload
      media={media}
      onUpload={uploadFile}
      onDelete={handleDelete}
      onSetPrimary={handleSetPrimary}
      onReorder={handleReorder}
      layout="stacked"
    />
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  )
}

function Field({
  label, defaultValue, onCommit, type = 'text',
}: {
  label: string
  defaultValue: string | number
  onCommit: (value: string) => void
  type?: 'text' | 'number'
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <Input
        key={String(defaultValue)}
        type={type}
        defaultValue={defaultValue}
        onBlur={e => { if (e.target.value !== String(defaultValue)) onCommit(e.target.value) }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        step={type === 'number' ? '0.01' : undefined}
      />
    </div>
  )
}

function DateField({
  label, value, onCommit,
}: {
  label: string
  value: string
  onCommit: (value: string) => void
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <Input
        key={value || 'empty'}
        type="date"
        defaultValue={value}
        onBlur={e => { if (e.target.value !== value) onCommit(e.target.value) }}
      />
    </div>
  )
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <Select
        className={selectCls}
        value={value}
        onChange={(v) => {
          if (v !== value) onChange(v)
        }}
        options={options}
      />
    </div>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className={cn('flex items-center justify-between rounded-md border px-3 py-2')}>
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
