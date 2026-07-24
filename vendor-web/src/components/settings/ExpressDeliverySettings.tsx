import { useEffect, useRef, useState } from 'react'
import { Loader2, Save, Truck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useUpdateVendor } from '@/hooks/useVendor'
import type { Vendor } from '@/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export type ExpressDeliveryForm = {
  enabled: boolean
  amount: string
  label: string
  description: string
}

export function readExpressDelivery(vendor: Vendor | null): ExpressDeliveryForm {
  const theme = (vendor?.theme_config ?? {}) as Record<string, unknown>
  const checkout = (theme.checkout ?? {}) as Record<string, unknown>
  const raw = (checkout.express_delivery ?? {}) as Record<string, unknown>
  return {
    enabled: Boolean(raw.enabled),
    amount: raw.amount != null ? String(raw.amount) : '99',
    label: String(raw.label ?? 'Express Delivery'),
    description: String(raw.description ?? '1–2 business days'),
  }
}

export function buildExpressDeliveryTheme(
  vendor: Vendor | null,
  form: ExpressDeliveryForm,
): Record<string, unknown> | null {
  const amount = Number(form.amount)
  if (form.enabled && (!Number.isFinite(amount) || amount < 0)) {
    return null
  }
  const theme = { ...(vendor?.theme_config ?? {}) } as Record<string, unknown>
  const checkout = { ...((theme.checkout ?? {}) as Record<string, unknown>) }
  checkout.express_delivery = {
    enabled: form.enabled,
    amount: form.enabled ? amount : 0,
    label: form.label.trim() || 'Express Delivery',
    description: form.description.trim() || '1–2 business days',
    estimated_days_min: 1,
    estimated_days_max: 2,
  }
  theme.checkout = checkout
  return theme
}

type Props = {
  form: ExpressDeliveryForm
  onChange: (next: ExpressDeliveryForm) => void
  className?: string
}

/** Compact express-delivery fields for Delivery Conditions (parent owns save). */
export function ExpressDeliverySettings({ form, onChange, className }: Props) {
  const set = <K extends keyof ExpressDeliveryForm>(key: K, value: ExpressDeliveryForm[K]) => {
    onChange({ ...form, [key]: value })
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-0.5">
          <Label htmlFor="express-enabled" className="text-sm font-medium leading-none">
            Offer express delivery
          </Label>
          <p className="text-xs leading-snug text-muted-foreground">
            Shows an express option on checkout; fee is added to the order total.
          </p>
        </div>
        <Switch
          id="express-enabled"
          checked={form.enabled}
          onCheckedChange={enabled => set('enabled', enabled)}
          className="mt-0.5 shrink-0"
        />
      </div>

      {form.enabled ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="express-amount" className="text-xs font-medium">
              Express fee
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                ₹
              </span>
              <Input
                id="express-amount"
                type="number"
                min={0}
                step={1}
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
                placeholder="99"
                className="h-9 pl-8"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="express-label" className="text-xs font-medium">
              Option label
            </Label>
            <Input
              id="express-label"
              value={form.label}
              onChange={e => set('label', e.target.value)}
              placeholder="Express Delivery"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="express-desc" className="text-xs font-medium">
              Description
            </Label>
            <Input
              id="express-desc"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="1–2 business days"
              className="h-9"
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Standalone card with its own save — kept for reuse outside Delivery Conditions. */
export function ExpressDeliverySettingsCard({ vendor }: { vendor: Vendor | null }) {
  const onSave = useUpdateVendor()
  const savingRef = useRef(false)
  const [form, setForm] = useState<ExpressDeliveryForm>(readExpressDelivery(vendor))

  useEffect(() => {
    if (vendor && !savingRef.current) setForm(readExpressDelivery(vendor))
  }, [vendor])

  const handleSave = () => {
    const theme = buildExpressDeliveryTheme(vendor, form)
    if (!theme) {
      toast.error('Enter a valid express delivery fee (0 or more).')
      return
    }
    savingRef.current = true
    onSave.mutate({ theme_config: theme } as Partial<Vendor>, {
      onSuccess: () => toast.success('Express delivery settings saved'),
      onSettled: () => { savingRef.current = false },
    })
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="mb-2.5 flex items-center gap-2">
        <Truck className="h-4 w-4 text-primary" />
        <div>
          <p className="text-sm font-semibold">Express delivery at checkout</p>
          <p className="text-xs text-muted-foreground">Customers can choose express delivery at checkout.</p>
        </div>
      </div>
      <ExpressDeliverySettings form={form} onChange={setForm} />
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={onSave.isPending}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {onSave.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save express delivery
        </button>
      </div>
    </div>
  )
}
