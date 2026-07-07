import { useEffect, useRef, useState } from 'react'
import { Loader2, Save, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useUpdateVendor } from '@/hooks/useVendor'
import type { Vendor } from '@/types'
import { toast } from 'sonner'

type ExpressDelivery = {
  enabled: boolean
  amount: string
  label: string
  description: string
}

function readExpressDelivery(vendor: Vendor | null): ExpressDelivery {
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

export function ExpressDeliverySettings({ vendor }: { vendor: Vendor | null }) {
  const onSave = useUpdateVendor()
  const savingRef = useRef(false)
  const [form, setForm] = useState<ExpressDelivery>(readExpressDelivery(vendor))

  useEffect(() => {
    if (vendor && !savingRef.current) setForm(readExpressDelivery(vendor))
  }, [vendor])

  const set = <K extends keyof ExpressDelivery>(key: K, value: ExpressDelivery[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    const amount = Number(form.amount)
    if (form.enabled && (!Number.isFinite(amount) || amount < 0)) {
      toast.error('Enter a valid express delivery fee (0 or more).')
      return
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
    savingRef.current = true
    onSave.mutate({ theme_config: theme } as Partial<Vendor>, {
      onSuccess: () => toast.success('Express delivery settings saved'),
      onSettled: () => { savingRef.current = false },
    })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
            <Truck className="h-5 w-5" strokeWidth={2} />
          </div>
          <div>
            <CardTitle className="text-base">Express delivery at checkout</CardTitle>
            <p className="text-xs text-muted-foreground">
              When enabled, customers can choose express delivery during checkout and the fee is added to their order total.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
          <div>
            <Label htmlFor="express-enabled" className="text-sm font-medium">
              Offer express delivery
            </Label>
            <p className="text-xs text-muted-foreground">
              Shows an express option alongside free delivery on the checkout shipping step.
            </p>
          </div>
          <Switch
            id="express-enabled"
            checked={form.enabled}
            onCheckedChange={enabled => set('enabled', enabled)}
          />
        </div>

        {form.enabled && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="express-amount">Express delivery fee</Label>
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
                  onChange={(e) => set('amount', e.target.value)}
                  placeholder="99"
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="express-label">Option label</Label>
              <Input
                id="express-label"
                value={form.label}
                onChange={(e) => set('label', e.target.value)}
                placeholder="Express Delivery"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="express-desc">Description</Label>
              <Input
                id="express-desc"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="1–2 business days"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button type="button" onClick={handleSave} disabled={onSave.isPending} className="gap-2">
            {onSave.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save express delivery
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
