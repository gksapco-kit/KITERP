import { useEffect, useState } from 'react'
import { PackageSearch, Save, Loader2, Info, IndianRupee, LogIn } from 'lucide-react'
import { useUpdateVendor } from '@/hooks/useVendor'
import { useVendorStore } from '@/stores/vendorStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { formatCurrency } from '@/lib/utils'
import { ExpressDeliverySettings } from '@/components/settings/ExpressDeliverySettings'
import {
  readDeliveryConditions,
  writeDeliveryConditions,
  type DeliveryConditionsSettings,
} from '@/lib/deliveryConditions'
import type { Vendor } from '@/types'
import { toast } from 'sonner'

export default function DeliveryConditionsPage() {
  const { vendor } = useVendorStore()
  const updateVendor = useUpdateVendor()
  const [form, setForm] = useState<DeliveryConditionsSettings>({
    enabled: true,
    free_delivery_threshold: null,
    minimum_delivery_charge: null,
    calculate_gst: true,
    sign_in_mandatory: false,
  })

  useEffect(() => {
    if (!vendor) return
    setForm(readDeliveryConditions(vendor.settings as Record<string, unknown>))
  }, [vendor])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!vendor) return

    if (form.enabled) {
      const hasThreshold = form.free_delivery_threshold != null && form.free_delivery_threshold > 0
      const hasMinCharge = form.minimum_delivery_charge != null && form.minimum_delivery_charge >= 0
      if (!hasThreshold && !hasMinCharge) {
        toast.error('Set a free delivery threshold and/or minimum delivery charge.')
        return
      }
    }

    const existingSettings = (vendor.settings || {}) as Record<string, unknown>
    const payload = writeDeliveryConditions(existingSettings, form)
    updateVendor.mutate({ settings: payload } as Partial<Vendor>, {
      onSuccess: () => toast.success('Delivery conditions saved'),
    })
  }

  const previewThreshold = form.free_delivery_threshold
  const previewMinCharge = form.minimum_delivery_charge

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Delivery Conditions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure delivery charges and GST calculation for your storefront cart and checkout.
          </p>
        </div>
        <div className="shrink-0 self-end sm:self-start">
          <Button type="submit" disabled={updateVendor.isPending} className="gap-2">
            {updateVendor.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
                <PackageSearch className="h-5 w-5" strokeWidth={2} />
              </div>
              <div>
                <CardTitle className="text-base">Delivery charges</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Set a minimum delivery fee and a cart threshold for free delivery.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div>
                <Label htmlFor="delivery-enabled" className="text-sm font-medium">
                  Enable delivery rules
                </Label>
                <p className="text-xs text-muted-foreground">
                  Turn off to use your default shipping method charges only.
                </p>
              </div>
              <Switch
                id="delivery-enabled"
                checked={form.enabled}
                onCheckedChange={enabled => setForm(prev => ({ ...prev, enabled }))}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="minimum-delivery-charge">Minimum delivery charge</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    id="minimum-delivery-charge"
                    type="number"
                    min={0}
                    step={1}
                    disabled={!form.enabled}
                    placeholder="e.g. 49"
                    value={form.minimum_delivery_charge ?? ''}
                    onChange={e => {
                      const raw = e.target.value.trim()
                      setForm(prev => ({
                        ...prev,
                        minimum_delivery_charge: raw === '' ? null : Number(raw),
                      }))
                    }}
                    className="pl-8"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Charged when the cart is below the free delivery threshold.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="free-delivery-threshold">Free delivery threshold</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    id="free-delivery-threshold"
                    type="number"
                    min={1}
                    step={1}
                    disabled={!form.enabled}
                    placeholder="e.g. 499"
                    value={form.free_delivery_threshold ?? ''}
                    onChange={e => {
                      const raw = e.target.value.trim()
                      setForm(prev => ({
                        ...prev,
                        free_delivery_threshold: raw === '' ? null : Number(raw),
                      }))
                    }}
                    className="pl-8"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Cart at this value or above gets free delivery.
                </p>
              </div>
            </div>

            {form.enabled ? (
              <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  {previewThreshold != null && previewThreshold > 0 ? (
                    <>
                      Cart below {formatCurrency(previewThreshold)}
                      {previewMinCharge != null ? ` → delivery charge ${formatCurrency(previewMinCharge)}.` : ' → standard delivery charge applies.'}
                      {' '}
                      Cart at {formatCurrency(previewThreshold)} or above → delivery fee is {formatCurrency(0)}.
                    </>
                  ) : previewMinCharge != null ? (
                    <>Every order will include a delivery charge of {formatCurrency(previewMinCharge)}.</>
                  ) : (
                    <>Set a minimum delivery charge and/or free delivery threshold.</>
                  )}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
                <LogIn className="h-5 w-5" strokeWidth={2} />
              </div>
              <div>
                <CardTitle className="text-base">Checkout sign-in</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Control whether customers must sign in before checkout or Buy Now.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div>
                <Label htmlFor="sign-in-mandatory" className="text-sm font-medium">
                  Sign in mandatory
                </Label>
                <p className="text-xs text-muted-foreground">
                  When on, guests are asked to sign in before checkout and Buy Now. When off, guest checkout is allowed.
                </p>
              </div>
              <Switch
                id="sign-in-mandatory"
                checked={form.sign_in_mandatory}
                onCheckedChange={sign_in_mandatory => setForm(prev => ({ ...prev, sign_in_mandatory }))}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
                <IndianRupee className="h-5 w-5" strokeWidth={2} />
              </div>
              <div>
                <CardTitle className="text-base">GST calculation</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Control whether GST is added on the cart and checkout totals.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div>
                <Label htmlFor="calculate-gst" className="text-sm font-medium">
                  Calculate GST
                </Label>
                <p className="text-xs text-muted-foreground">
                  When off, cart and checkout totals exclude GST even if products have tax rates.
                </p>
              </div>
              <Switch
                id="calculate-gst"
                checked={form.calculate_gst}
                onCheckedChange={calculate_gst => setForm(prev => ({ ...prev, calculate_gst }))}
              />
            </div>
          </CardContent>
        </Card>

        <ExpressDeliverySettings vendor={vendor} />

        <div className="flex justify-end">
          <Button type="submit" disabled={updateVendor.isPending} className="gap-2">
            {updateVendor.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>
      </div>
    </form>
  )
}
