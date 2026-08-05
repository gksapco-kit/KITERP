import { useState } from 'react'
import { Info, Save, Loader2, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useVendorStore } from '@/stores/vendorStore'
import { useUpdateVendor } from '@/hooks/useVendor'
import { toast } from 'sonner'
import { RENTAL_CATEGORIES } from './rentalConstants'

type RentalSettings = {
  default_category: string
  default_pricing_plan: string
  require_deposit: boolean
  credit_gate_enabled: boolean
  auto_approve_storefront: boolean
  storefront_show_rates: boolean
  storefront_enabled: boolean
  booking_number_prefix: string
}

const PRICING_PLAN_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

function readRentalSettings(settings: Record<string, unknown> | undefined): RentalSettings {
  const r = (settings?.rental_settings as Record<string, unknown> | undefined) ?? {}
  return {
    default_category: (r.default_category as string) || 'milk_dairy',
    default_pricing_plan: (r.default_pricing_plan as string) || 'daily',
    require_deposit: r.require_deposit !== false,
    credit_gate_enabled: r.credit_gate_enabled !== false,
    auto_approve_storefront: Boolean(r.auto_approve_storefront),
    storefront_show_rates: r.storefront_show_rates !== false,
    storefront_enabled: r.storefront_enabled !== false,
    booking_number_prefix: (r.booking_number_prefix as string) || 'RNT',
  }
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
    </div>
  )
}

export default function RentalSettingsPage() {
  const { vendor } = useVendorStore()
  const updateVendor = useUpdateVendor()
  const vendorSettings = vendor?.settings as Record<string, unknown> | undefined

  const saved = readRentalSettings(vendorSettings)
  const [form, setForm] = useState<RentalSettings>(saved)

  const set = <K extends keyof RentalSettings>(key: K, value: RentalSettings[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!vendor) return
    updateVendor.mutate(
      {
        settings: {
          ...(vendorSettings || {}),
          rental_settings: { ...form },
          features: {
            ...((vendorSettings?.features as Record<string, unknown>) || {}),
            rentals: form.storefront_enabled,
          },
        },
      },
      {
        onSuccess: () => toast.success('Rental settings saved'),
        onError: () => toast.error('Failed to save settings'),
      },
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Truck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Rental Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure defaults, booking behaviour, credit control, and storefront visibility.
          </p>
        </div>
      </div>

      <form id="rental-settings-form" onSubmit={handleSave} className="space-y-8">
        {/* Defaults section */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Defaults</h2>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">Default Category</label>
            <select
              value={form.default_category}
              onChange={(e) => set('default_category', e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {RENTAL_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">Default Pricing Plan</label>
            <select
              value={form.default_pricing_plan}
              onChange={(e) => set('default_pricing_plan', e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {PRICING_PLAN_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">Booking Number Prefix</label>
            <Input
              value={form.booking_number_prefix}
              onChange={(e) => set('booking_number_prefix', e.target.value.toUpperCase())}
              placeholder="RNT"
              maxLength={6}
              className="max-w-[120px]"
            />
            <p className="text-xs text-muted-foreground">Example: {form.booking_number_prefix}-0001</p>
          </div>
        </section>

        {/* Booking behaviour */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Booking Behaviour</h2>
          <Toggle
            label="Require deposit on all bookings"
            hint="New bookings must have a non-zero deposit amount."
            checked={form.require_deposit}
            onChange={(v) => set('require_deposit', v)}
          />
          <Toggle
            label="Enable credit gate"
            hint="Block new bookings for customers with outstanding unpaid balances (uses CRM credit control)."
            checked={form.credit_gate_enabled}
            onChange={(v) => set('credit_gate_enabled', v)}
          />
          <Toggle
            label="Auto-approve storefront bookings"
            hint="Bookings placed on the public storefront are automatically approved. Turn off to require manual review."
            checked={form.auto_approve_storefront}
            onChange={(v) => set('auto_approve_storefront', v)}
          />
        </section>

        {/* Storefront */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Storefront</h2>
          <Toggle
            label="Show Rentals on storefront"
            hint="Display the Rentals page and nav link on your public business front."
            checked={form.storefront_enabled}
            onChange={(v) => set('storefront_enabled', v)}
          />
          <Toggle
            label="Show pricing rates on storefront"
            hint="Display daily / weekly / monthly rates on the public asset cards."
            checked={form.storefront_show_rates}
            onChange={(v) => set('storefront_show_rates', v)}
          />
        </section>

        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950">
          <Info className="h-4 w-4 shrink-0 text-blue-600" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Changes to credit gate and deposit settings apply to new bookings only. Existing bookings are not affected.
          </p>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={updateVendor.isPending} className="gap-2">
            {updateVendor.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save settings
          </Button>
        </div>
      </form>
    </div>
  )
}
