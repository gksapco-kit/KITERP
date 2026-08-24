import { useEffect, useState, type ReactNode } from 'react'
import {
  PackageSearch,
  Save,
  Loader2,
  Info,
  IndianRupee,
  Truck,
} from 'lucide-react'
import { useUpdateVendor } from '@/hooks/useVendor'
import { useVendorStore } from '@/stores/vendorStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { formatCurrency, cn } from '@/lib/utils'
import {
  ExpressDeliverySettings,
  readExpressDelivery,
  buildExpressDeliveryTheme,
  type ExpressDeliveryForm,
} from '@/components/settings/ExpressDeliverySettings'
import {
  readDeliveryConditions,
  writeDeliveryConditions,
  type DeliveryConditionsSettings,
} from '@/lib/deliveryConditions'
import type { Vendor } from '@/types'
import { toast } from 'sonner'

function SectionTitle({
  icon: Icon,
  title,
  hint,
}: {
  icon: typeof PackageSearch
  title: string
  hint: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold leading-none text-foreground">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  )
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id} className="text-sm font-medium leading-none">
          {label}
        </Label>
        <p className="text-xs leading-snug text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="mt-0.5 shrink-0"
      />
    </div>
  )
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-foreground">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function MoneyInput({
  id,
  value,
  disabled,
  min = 0,
  placeholder,
  onChange,
}: {
  id: string
  value: number | null
  disabled?: boolean
  min?: number
  placeholder?: string
  onChange: (v: number | null) => void
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
        ₹
      </span>
      <Input
        id={id}
        type="number"
        min={min}
        step={1}
        disabled={disabled}
        placeholder={placeholder}
        value={value ?? ''}
        onChange={e => {
          const raw = e.target.value.trim()
          onChange(raw === '' ? null : Number(raw))
        }}
        className="h-9 pl-8"
      />
    </div>
  )
}

export default function DeliveryConditionsPage() {
  const { vendor } = useVendorStore()
  const updateVendor = useUpdateVendor()
  const [form, setForm] = useState<DeliveryConditionsSettings>({
    enabled: true,
    free_delivery_threshold: null,
    minimum_delivery_charge: null,
    calculate_gst: true,
  })
  const [express, setExpress] = useState<ExpressDeliveryForm>(readExpressDelivery(null))

  useEffect(() => {
    if (!vendor) return
    setForm(readDeliveryConditions(vendor.settings as Record<string, unknown>))
    setExpress(readExpressDelivery(vendor))
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

    const theme = buildExpressDeliveryTheme(vendor, express)
    if (!theme) {
      toast.error('Enter a valid express delivery fee (0 or more).')
      return
    }

    const existingSettings = (vendor.settings || {}) as Record<string, unknown>
    const payload = writeDeliveryConditions(existingSettings, form)
    updateVendor.mutate(
      { settings: payload, theme_config: theme } as Partial<Vendor>,
      { onSuccess: () => toast.success('Delivery conditions saved') },
    )
  }

  const previewThreshold = form.free_delivery_threshold
  const previewMinCharge = form.minimum_delivery_charge

  return (
    <form onSubmit={handleSubmit} className="w-full p-4 md:p-5 lg:p-6">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-5 py-3.5 lg:px-6">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Delivery Conditions
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              Delivery charges, GST, and express delivery.
            </p>
          </div>
          <Button type="submit" disabled={updateVendor.isPending} className="h-9 shrink-0 gap-2">
            {updateVendor.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        </header>

        {/* Two columns on lg+ — uses left/right space so the page stays short */}
        <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-border">
          {/* LEFT — Delivery charges */}
          <section className="flex flex-col gap-4 border-b border-border p-5 lg:border-b-0 lg:p-6">
            <SectionTitle
              icon={PackageSearch}
              title="Delivery charges"
              hint="Minimum fee and free-delivery cart threshold"
            />

            <ToggleRow
              id="delivery-enabled"
              label="Enable delivery rules"
              description="When off, only default shipping method charges apply."
              checked={form.enabled}
              onCheckedChange={enabled => setForm(prev => ({ ...prev, enabled }))}
            />

            <div
              className={cn(
                'grid gap-4 sm:grid-cols-2',
                !form.enabled && 'pointer-events-none opacity-50',
              )}
            >
              <Field
                id="minimum-delivery-charge"
                label="Minimum delivery charge"
                hint="Charged when cart is below the free threshold"
              >
                <MoneyInput
                  id="minimum-delivery-charge"
                  value={form.minimum_delivery_charge}
                  disabled={!form.enabled}
                  placeholder="e.g. 49"
                  onChange={minimum_delivery_charge =>
                    setForm(prev => ({ ...prev, minimum_delivery_charge }))
                  }
                />
              </Field>
              <Field
                id="free-delivery-threshold"
                label="Free delivery threshold"
                hint="Cart at this value or above → free delivery"
              >
                <MoneyInput
                  id="free-delivery-threshold"
                  value={form.free_delivery_threshold}
                  disabled={!form.enabled}
                  min={1}
                  placeholder="e.g. 499"
                  onChange={free_delivery_threshold =>
                    setForm(prev => ({ ...prev, free_delivery_threshold }))
                  }
                />
              </Field>
            </div>

            {form.enabled ? (
              <div className="mt-auto flex gap-2.5 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100 sm:text-sm">
                <Info className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                <p className="leading-relaxed">
                  {previewThreshold != null && previewThreshold > 0 ? (
                    <>
                      Cart below {formatCurrency(previewThreshold)}
                      {previewMinCharge != null
                        ? ` → delivery ${formatCurrency(previewMinCharge)}.`
                        : ' → standard delivery applies.'}{' '}
                      Cart at {formatCurrency(previewThreshold)} or above → {formatCurrency(0)}.
                    </>
                  ) : previewMinCharge != null ? (
                    <>Every order includes delivery of {formatCurrency(previewMinCharge)}.</>
                  ) : (
                    <>Set a minimum delivery charge and/or free delivery threshold.</>
                  )}
                </p>
              </div>
            ) : null}
          </section>

          {/* RIGHT — GST, Express */}
          <div className="flex flex-col divide-y divide-border">
            <section className="p-5 lg:p-6">
              <div className="space-y-3">
                <SectionTitle
                  icon={IndianRupee}
                  title="GST calculation"
                  hint="GST on cart and checkout totals"
                />
                <ToggleRow
                  id="calculate-gst"
                  label="Calculate GST"
                  description="Off excludes GST even with tax rates."
                  checked={form.calculate_gst}
                  onCheckedChange={calculate_gst => setForm(prev => ({ ...prev, calculate_gst }))}
                />
              </div>
            </section>

            <section className="flex flex-1 flex-col gap-4 p-5 lg:p-6">
              <SectionTitle
                icon={Truck}
                title="Express delivery at checkout"
                hint="Optional paid express option alongside free delivery"
              />
              <ExpressDeliverySettings form={express} onChange={setExpress} />
            </section>
          </div>
        </div>
      </div>
    </form>
  )
}
