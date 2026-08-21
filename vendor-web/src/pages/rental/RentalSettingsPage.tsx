import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Info, Save, Loader2, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useVendorStore } from '@/stores/vendorStore'
import { useUpdateVendor } from '@/hooks/useVendor'
import { toast } from 'sonner'
import { DEFAULT_ASSET_CODE_PREFIX } from './rentalConstants'
import { cn } from '@/lib/utils'

type RentalSettings = {
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

function readRentalSettings(settings: Record<string, unknown> | undefined): RentalSettings {
  const r = (settings?.rental_settings as Record<string, unknown> | undefined) ?? {}
  return {
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
  className,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-3 py-2.5', className)}>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-snug text-foreground">{label}</p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          checked ? 'bg-primary' : 'bg-muted-foreground/30',
        )}
      >
        <span
          className={cn(
            'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[1.125rem]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  )
}

function SettingsPanel({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border bg-muted/30 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  )
}

export default function RentalSettingsPage() {
  const navigate = useNavigate()
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
    const existingRental = (vendorSettings?.rental_settings as Record<string, unknown> | undefined) ?? {}
    updateVendor.mutate(
      {
        settings: {
          ...(vendorSettings || {}),
          rental_settings: { ...existingRental, ...form },
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
    <div className="mx-auto max-w-6xl">
      <form id="rental-settings-form" onSubmit={handleSave} className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Truck className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight text-foreground">Rental Settings</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Numbering, booking behaviour, credit control, and storefront visibility.
              </p>
            </div>
          </div>
          <Button type="submit" size="sm" disabled={updateVendor.isPending} className="gap-1.5">
            {updateVendor.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>
        </div>

        {/* Numbering — side by side */}
        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="border-b border-border bg-muted/30 px-3 py-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Numbering</h2>
          </div>
          <div className="grid gap-3 p-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">Booking Number Prefix</label>
              <Input
                value={form.booking_number_prefix}
                onChange={(e) => set('booking_number_prefix', e.target.value.toUpperCase())}
                placeholder="RNT"
                maxLength={6}
                className="h-8 max-w-[7.5rem]"
              />
              <p className="text-[11px] text-muted-foreground">Example: {form.booking_number_prefix}-0001</p>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">Asset Master ID Prefix</label>
              <Input
                value={form.asset_code_prefix}
                onChange={(e) =>
                  set(
                    'asset_code_prefix',
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, '')
                      .slice(0, 6),
                  )
                }
                placeholder={DEFAULT_ASSET_CODE_PREFIX}
                maxLength={6}
                className="h-8 max-w-[7.5rem] font-mono tracking-wide"
              />
              <p className="text-[11px] text-muted-foreground">
                Example: {form.asset_code_prefix || DEFAULT_ASSET_CODE_PREFIX}-001
              </p>
            </div>
          </div>
        </section>

        {/* Booking + Storefront in two columns on wide screens */}
        <div className="grid gap-4 lg:grid-cols-2">
          <SettingsPanel title="Booking Behaviour">
            <Toggle
              label="Require deposit on all bookings"
              hint="New bookings must have a non-zero deposit amount."
              checked={form.require_deposit}
              onChange={(v) => set('require_deposit', v)}
            />
            <Toggle
              label="Enable credit gate"
              hint="Block bookings for customers with unpaid balances (CRM credit control)."
              checked={form.credit_gate_enabled}
              onChange={(v) => set('credit_gate_enabled', v)}
            />
            <Toggle
              label="Auto-approve storefront bookings"
              hint="Approve storefront bookings automatically. Off = manual review."
              checked={form.auto_approve_storefront}
              onChange={(v) => set('auto_approve_storefront', v)}
            />
          </SettingsPanel>

          <SettingsPanel title="Storefront">
            <Toggle
              label="Show Rentals on storefront"
              hint="Display the Rentals page and nav link on your public front."
              checked={form.storefront_enabled}
              onChange={(v) => set('storefront_enabled', v)}
            />
            <Toggle
              label="Show pricing rates on storefront"
              hint="Display daily / weekly / monthly rates on asset cards."
              checked={form.storefront_show_rates}
              onChange={(v) => set('storefront_show_rates', v)}
            />
            <div className="flex items-start justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium leading-snug text-foreground">Registration form</p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  Published forms show <strong>Register & Book</strong>; otherwise Booking only.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/rental/registration-forms')}
                className="shrink-0 text-xs font-medium text-primary hover:underline"
              >
                Design →
              </button>
            </div>
          </SettingsPanel>
        </div>

        {/* Feature toggles — compact 2-col grid */}
        <SettingsPanel
          title="Asset Form Features"
          description="Enable or disable sections of the rental asset form."
        >
          <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-y-0">
            <div className="divide-y divide-border sm:border-r sm:border-border">
              <Toggle
                label="Merchandising categories"
                hint="Category picker for storefront browsing."
                checked={form.feature_categories}
                onChange={(v) => set('feature_categories', v)}
              />
              <Toggle
                label="Media gallery"
                hint="Photo and video upload on each asset."
                checked={form.feature_media_gallery}
                onChange={(v) => set('feature_media_gallery', v)}
              />
              <Toggle
                label="Capacity tracking"
                hint="Max capacity and UOM fields."
                checked={form.feature_capacity_tracking}
                onChange={(v) => set('feature_capacity_tracking', v)}
              />
            </div>
            <div className="divide-y divide-border">
              <Toggle
                label="Unit tracking"
                hint="Sub-asset and serialized unit tracking."
                checked={form.feature_unit_tracking}
                onChange={(v) => set('feature_unit_tracking', v)}
              />
              <Toggle
                label="Extended rates"
                hint="Hourly, per-minute, and yearly pricing."
                checked={form.feature_extended_rates}
                onChange={(v) => set('feature_extended_rates', v)}
              />
              <Toggle
                label="Per-unit pricing"
                hint="Price by capacity unit in addition to period rates."
                checked={form.feature_per_unit_pricing}
                onChange={(v) => set('feature_per_unit_pricing', v)}
              />
            </div>
          </div>
        </SettingsPanel>

        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-900 dark:bg-blue-950">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
          <p className="text-[11px] leading-snug text-blue-700 dark:text-blue-300">
            Credit gate and deposit changes apply to new bookings only. Existing bookings are unaffected.
          </p>
        </div>
      </form>
    </div>
  )
}
