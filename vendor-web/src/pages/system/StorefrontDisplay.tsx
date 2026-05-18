import { useState, useEffect, useRef } from 'react'
import { useUpdateVendor } from '@/hooks/useVendor'
import { useVendorStore } from '@/stores/vendorStore'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Save, Loader2, Package, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import type { Vendor } from '@/types'

const PRODUCT_DISPLAY_FIELDS = [
  { key: 'brand', label: 'Brand' },
  { key: 'short_description', label: 'Short Description' },
  { key: 'specifications', label: 'Specifications' },
  { key: 'warranty', label: 'Warranty Info' },
  { key: 'return_policy', label: 'Return Policy' },
  { key: 'shipping_info', label: 'Shipping Info' },
  { key: 'offer_label', label: 'Offer / Sale Label' },
  { key: 'sku', label: 'SKU / Barcode' },
  { key: 'stock_status', label: 'Stock Status' },
  { key: 'tags', label: 'Tags' },
]

const SERVICE_DISPLAY_FIELDS = [
  { key: 'brand', label: 'Brand' },
  { key: 'short_description', label: 'Short Description' },
  { key: 'whats_included', label: "What's Included" },
  { key: 'whats_not_included', label: "What's Not Included" },
  { key: 'prerequisites', label: 'Prerequisites' },
  { key: 'service_areas', label: 'Service Areas' },
  { key: 'cancellation_policy', label: 'Cancellation Policy' },
  { key: 'offer_label', label: 'Offer / Sale Label' },
  { key: 'service_mode', label: 'Service Mode' },
  { key: 'tags', label: 'Tags' },
]

function SaveButton({ loading }: { loading: boolean }) {
  return (
    <Button type="submit" disabled={loading} className="gap-2">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
      Save Changes
    </Button>
  )
}

export default function StorefrontDisplayPage() {
  const { vendor } = useVendorStore()
  const updateVendor = useUpdateVendor()

  const [productFields, setProductFields] = useState<Record<string, boolean>>({})
  const [serviceFields, setServiceFields] = useState<Record<string, boolean>>({})
  const savingRef = useRef(false)

  useEffect(() => {
    if (vendor && !savingRef.current) {
      const df = (vendor.settings as Record<string, unknown>)?.display_fields as Record<string, Record<string, boolean>> | undefined

      const pf: Record<string, boolean> = {}
      for (const f of PRODUCT_DISPLAY_FIELDS) pf[f.key] = df?.product?.[f.key] ?? true
      setProductFields(pf)

      const sf: Record<string, boolean> = {}
      for (const f of SERVICE_DISPLAY_FIELDS) sf[f.key] = df?.service?.[f.key] ?? true
      setServiceFields(sf)
    }
  }, [vendor])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const existingSettings = (vendor?.settings || {}) as Record<string, unknown>
    savingRef.current = true
    updateVendor.mutate({
      settings: {
        ...existingSettings,
        display_fields: { product: productFields, service: serviceFields },
      },
    } as Partial<Vendor>, {
      onSuccess: () => toast.success('Storefront display updated'),
      onSettled: () => { savingRef.current = false },
    })
  }

  const toggleAll = (type: 'product' | 'service', value: boolean) => {
    if (type === 'product') {
      const updated: Record<string, boolean> = {}
      for (const f of PRODUCT_DISPLAY_FIELDS) updated[f.key] = value
      setProductFields(updated)
    } else {
      const updated: Record<string, boolean> = {}
      for (const f of SERVICE_DISPLAY_FIELDS) updated[f.key] = value
      setServiceFields(updated)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Storefront Display</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Control which fields are visible to customers on your product and service pages.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Product fields */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
                  <Package className="h-5 w-5" strokeWidth={2} />
                </div>
                <CardTitle className="text-base">Product Fields</CardTitle>
              </div>
              <div className="flex gap-3 text-xs">
                <button type="button" onClick={() => toggleAll('product', true)} className="text-primary hover:underline">Show All</button>
                <span className="text-border">|</span>
                <button type="button" onClick={() => toggleAll('product', false)} className="text-muted-foreground hover:underline">Hide All</button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {PRODUCT_DISPLAY_FIELDS.map((f) => (
                <label key={f.key} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent/70 dark:hover:bg-secondary/50">
                  <input
                    type="checkbox"
                    checked={productFields[f.key] ?? true}
                    onChange={(e) => setProductFields({ ...productFields, [f.key]: e.target.checked })}
                    className="w-4 h-4 rounded border-input text-primary"
                  />
                  <span className="text-sm text-foreground">{f.label}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Service fields */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
                  <Wrench className="h-5 w-5" strokeWidth={2} />
                </div>
                <CardTitle className="text-base">Service Fields</CardTitle>
              </div>
              <div className="flex gap-3 text-xs">
                <button type="button" onClick={() => toggleAll('service', true)} className="text-primary hover:underline">Show All</button>
                <span className="text-border">|</span>
                <button type="button" onClick={() => toggleAll('service', false)} className="text-muted-foreground hover:underline">Hide All</button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {SERVICE_DISPLAY_FIELDS.map((f) => (
                <label key={f.key} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent/70 dark:hover:bg-secondary/50">
                  <input
                    type="checkbox"
                    checked={serviceFields[f.key] ?? true}
                    onChange={(e) => setServiceFields({ ...serviceFields, [f.key]: e.target.checked })}
                    className="w-4 h-4 rounded border-input text-primary"
                  />
                  <span className="text-sm text-foreground">{f.label}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <SaveButton loading={updateVendor.isPending} />
        </div>
      </form>
    </div>
  )
}
