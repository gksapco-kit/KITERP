import { useState } from 'react'
import { Info, Save, Loader2, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useVendorStore } from '@/stores/vendorStore'
import { useUpdateVendor } from '@/hooks/useVendor'
import { toast } from 'sonner'
import { RENTAL_CATEGORIES, DEFAULT_ASSET_CODE_PREFIX } from './rentalConstants'

type RentalSettings = {
  default_category: string
  default_pricing_plan: string
  require_deposit: boolean
  credit_gate_enabled: boolean
  auto_approve_storefront: boolean
  storefront_show_rates: boolean
  storefront_enabled: boolean
  booking_number_prefix: string
  /** Generic master ID prefix for assets (e.g. AST-001). */
  asset_code_prefix: string
  // Feature toggles — control which sections show in the asset form
  feature_categories: boolean
  feature_media_gallery: boolean
  feature_capacity_tracking: boolean
  feature_unit_tracking: boolean
  feature_extended_rates: boolean
  feature_per_unit_pricing: boolean
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
    asset_code_prefix: (r.asset_code_prefix as string) || DEFAULT_ASSET_CODE_PREFIX,
    feature_categories: r.feature_categories !== false,
    feature_media_gallery: r.feature_media_gallery !== false,
    feature_capacity_tracking: r.feature_capacity_tracking !== false,
    feature_unit_tracking: r.feature_unit_tracking !== false,
    feature_extended_rates: r.feature_extended_rates !== false,
    feature_per_unit_pricing: r.feature_per_unit_pricing !== false,
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

          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">Asset Master ID Prefix</label>
            <Input
              value={form.asset_code_prefix}
              onChange={(e) => set('asset_code_prefix', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder={DEFAULT_ASSET_CODE_PREFIX}
              maxLength={6}
              className="max-w-[120px] font-mono tracking-wide"
            />
            <p className="text-xs text-muted-foreground">
              Generic asset code — Example: {form.asset_code_prefix || DEFAULT_ASSET_CODE_PREFIX}-001
            </p>
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

        {/* Feature toggles */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Asset Form Features</h2>
          <p className="text-xs text-muted-foreground">
            Enable or disable sections of the rental asset form to keep it focused for your use case.
          </p>
          <Toggle
            label="Merchandising categories"
            hint="Show a category picker in the asset form, letting you assign assets to your category tree for storefront browsing."
            checked={form.feature_categories}
            onChange={(v) => set('feature_categories', v)}
          />
          <Toggle
            label="Media gallery"
            hint="Show the photo and video upload section on each rental asset."
            checked={form.feature_media_gallery}
            onChange={(v) => set('feature_media_gallery', v)}
          />
          <Toggle
            label="Capacity tracking"
            hint="Show max capacity and UOM fields on the asset form."
            checked={form.feature_capacity_tracking}
            onChange={(v) => set('feature_capacity_tracking', v)}
          />
          <Toggle
            label="Unit tracking (hierarchy & serialized)"
            hint="Show the sub-asset and serialized unit tracking section."
            checked={form.feature_unit_tracking}
            onChange={(v) => set('feature_unit_tracking', v)}
          />
          <Toggle
            label="Extended rates (hourly / yearly / per-minute)"
            hint="Show a “More rates” section for hourly, per-minute, and yearly pricing."
            checked={form.feature_extended_rates}
            onChange={(v) => set('feature_extended_rates', v)}
          />
          <Toggle
            label="Per-unit pricing"
            hint="Allow pricing by capacity unit (e.g. per packet / per chair) in addition to period rates."
            checked={form.feature_per_unit_pricing}
            onChange={(v) => set('feature_per_unit_pricing', v)}
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
