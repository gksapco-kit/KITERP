import { useEffect, useRef, useState } from 'react'
import { Loader2, QrCode, Save, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUpdateVendor } from '@/hooks/useVendor'
import type { Vendor } from '@/types'
import { toast } from 'sonner'

type ManualUpi = {
  enabled: boolean
  upi_id: string
  qr_code_url: string
  label: string
}

function readManualUpi(vendor: Vendor | null): ManualUpi {
  const theme = (vendor?.theme_config ?? {}) as Record<string, unknown>
  const checkout = (theme.checkout ?? {}) as Record<string, unknown>
  const raw = (checkout.manual_upi ?? {}) as Record<string, unknown>
  return {
    enabled: Boolean(raw.enabled),
    upi_id: String(raw.upi_id ?? ''),
    qr_code_url: String(raw.qr_code_url ?? ''),
    label: String(raw.label ?? 'UPI'),
  }
}

export function UpiCheckoutSettings({ vendor }: { vendor: Vendor | null }) {
  const onSave = useUpdateVendor()
  const savingRef = useRef(false)
  const [form, setForm] = useState<ManualUpi>(readManualUpi(vendor))

  useEffect(() => {
    if (vendor && !savingRef.current) setForm(readManualUpi(vendor))
  }, [vendor])

  const set = <K extends keyof ManualUpi>(key: K, value: ManualUpi[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleQrUpload = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => set('qr_code_url', String(ev.target?.result ?? ''))
    reader.readAsDataURL(file)
  }

  const handleSave = () => {
    if (form.enabled && !form.upi_id.trim() && !form.qr_code_url.trim()) {
      toast.error('Add a UPI ID or upload a QR code to enable UPI checkout.')
      return
    }
    const theme = { ...(vendor?.theme_config ?? {}) } as Record<string, unknown>
    const checkout = { ...((theme.checkout ?? {}) as Record<string, unknown>) }
    checkout.manual_upi = {
      enabled: form.enabled,
      upi_id: form.upi_id.trim() || null,
      qr_code_url: form.qr_code_url.trim() || null,
      label: form.label.trim() || 'UPI',
    }
    theme.checkout = checkout
    savingRef.current = true
    onSave.mutate({ theme_config: theme } as Partial<Vendor>, {
      onSuccess: () => toast.success('UPI checkout settings saved'),
      onSettled: () => { savingRef.current = false },
    })
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-center gap-2">
        <QrCode className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">UPI checkout (QR + proof)</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Customers can pay via your UPI QR at checkout, then upload a payment screenshot for you to verify.
      </p>

      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => set('enabled', e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600"
        />
        <span className="text-sm font-medium">Enable UPI payment at checkout</span>
      </label>

      {form.enabled && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="upi-id">UPI ID</Label>
            <Input
              id="upi-id"
              value={form.upi_id}
              onChange={(e) => set('upi_id', e.target.value)}
              placeholder="yourstore@upi"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="upi-label">Label (optional)</Label>
            <Input
              id="upi-label"
              value={form.label}
              onChange={(e) => set('label', e.target.value)}
              placeholder="UPI"
              className="mt-1"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Business UPI QR image</Label>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {form.qr_code_url ? (
                <img src={form.qr_code_url} alt="UPI QR" className="h-24 w-24 rounded border object-contain" />
              ) : null}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50">
                <Upload className="h-4 w-4" />
                {form.qr_code_url ? 'Change QR' : 'Upload QR'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handleQrUpload(e.target.files?.[0] ?? null)}
                />
              </label>
              {form.qr_code_url && (
                <Button type="button" variant="ghost" size="sm" onClick={() => set('qr_code_url', '')}>
                  Remove
                </Button>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload your static UPI QR from GPay/PhonePe, or leave blank to auto-generate from UPI ID + order amount.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={handleSave} disabled={onSave.isPending} className="gap-1.5">
          {onSave.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save UPI settings
        </Button>
      </div>
    </div>
  )
}
