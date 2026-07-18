import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, QrCode, Save, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BusinessUnitSelect } from '@/components/common/BusinessUnitSelect'
import { UpiCheckoutModeToggle } from '@/components/business-units/UpiCheckoutModeToggle'
import { useStores, useUpdateStore, useUpdateVendor } from '@/hooks/useVendor'
import {
  EMPTY_MANUAL_UPI,
  resolveManualUpi,
  resolveUpiCheckoutMode,
  storeHasManualUpiOverride,
  toManualUpiPayload,
  UPI_CHECKOUT_MODE_KEY,
  type ManualUpiSettings,
  type UpiCheckoutMode,
  vendorManualUpi,
} from '@/lib/upiCheckoutMode'
import type { Vendor } from '@/types'
import { toast } from 'sonner'

import { askConfirm } from '@/components/common/ConfirmProvider'
export function UpiCheckoutSettings({ vendor }: { vendor: Vendor | null }) {
  const updateVendor = useUpdateVendor()
  const updateStore = useUpdateStore()
  const { data: storesData } = useStores()
  const stores = useMemo(
    () => (storesData?.stores ?? []).filter((s) => s.is_active && s.unit_type !== 'branch'),
    [storesData],
  )

  const mode = resolveUpiCheckoutMode(vendor?.settings as Record<string, unknown> | undefined)
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [form, setForm] = useState<ManualUpiSettings>({ ...EMPTY_MANUAL_UPI })
  const savingRef = useRef(false)
  const formDirtyRef = useRef(false)

  const activeStore = useMemo(
    () => stores.find((s) => s.id === selectedStoreId) ?? null,
    [stores, selectedStoreId],
  )

  useEffect(() => {
    if (!selectedStoreId && stores.length > 0) {
      const def = stores.find((s) => s.is_default) ?? stores[0]
      setSelectedStoreId(def.id)
    }
  }, [stores, selectedStoreId])

  useEffect(() => {
    if (!vendor || savingRef.current || formDirtyRef.current) return
    setForm(
      resolveManualUpi({
        mode,
        themeConfig: vendor.theme_config as Record<string, unknown> | undefined,
        storeSettings: activeStore?.settings as Record<string, unknown> | undefined,
      }),
    )
  }, [vendor, mode, activeStore])

  const set = <K extends keyof ManualUpiSettings>(key: K, value: ManualUpiSettings[K]) => {
    formDirtyRef.current = true
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleQrUpload = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => set('qr_code_url', String(ev.target?.result ?? ''))
    reader.readAsDataURL(file)
  }

  const handleSetMode = (next: UpiCheckoutMode) => {
    const current = vendor
    if (!current) return
    if (resolveUpiCheckoutMode(current.settings as Record<string, unknown> | undefined) === next) return
    formDirtyRef.current = false
    updateVendor.mutate({
      settings: { ...(current.settings ?? {}), [UPI_CHECKOUT_MODE_KEY]: next },
    })
  }

  const handleStoreChange = async (storeId: string) => {
    if (formDirtyRef.current && !await askConfirm('You have unsaved changes. Switch business unit anyway?')) return
    formDirtyRef.current = false
    setSelectedStoreId(storeId)
  }

  const handleSave = () => {
    if (form.enabled && !form.upi_id.trim() && !form.qr_code_url.trim()) {
      toast.error('Add a UPI ID or upload a QR code to enable UPI checkout.')
      return
    }

    const payload = toManualUpiPayload(form)
    savingRef.current = true
    formDirtyRef.current = false

    if (mode === 'shared') {
      const theme = { ...(vendor?.theme_config ?? {}) } as Record<string, unknown>
      const checkout = { ...((theme.checkout ?? {}) as Record<string, unknown>) }
      checkout.manual_upi = payload
      theme.checkout = checkout
      updateVendor.mutate({ theme_config: theme } as Partial<Vendor>, {
        onSuccess: () => toast.success('Shared UPI checkout settings saved'),
        onSettled: () => { savingRef.current = false },
      })
      return
    }

    if (!activeStore) {
      toast.error('Select a business unit first')
      savingRef.current = false
      return
    }

    const settings = {
      ...(activeStore.settings ?? {}),
      manual_upi: payload,
    }
    updateStore.mutate(
      { id: activeStore.id, data: { settings } },
      {
        onSuccess: () => toast.success(`${activeStore.name} UPI settings saved`),
        onSettled: () => { savingRef.current = false },
      },
    )
  }

  const handleClearOverride = async () => {
    if (!activeStore || mode !== 'per_unit') return
    if (!await askConfirm(`Clear ${activeStore.name} UPI override and use the shared UPI instead?`)) return
    savingRef.current = true
    formDirtyRef.current = false
    const settings = { ...(activeStore.settings ?? {}) }
    delete settings.manual_upi
    updateStore.mutate(
      { id: activeStore.id, data: { settings } },
      {
        onSuccess: () => {
          toast.success(`${activeStore.name} now uses shared UPI`)
          setForm(
            vendorManualUpi(vendor?.theme_config as Record<string, unknown> | undefined),
          )
        },
        onSettled: () => { savingRef.current = false },
      },
    )
  }

  const isSaving = updateVendor.isPending || updateStore.isPending
  const hasOverride =
    mode === 'per_unit' && storeHasManualUpiOverride(activeStore?.settings as Record<string, unknown> | undefined)
  const shared = vendorManualUpi(vendor?.theme_config as Record<string, unknown> | undefined)

  const editingHint =
    mode === 'shared'
      ? 'These UPI details apply to every business unit at checkout.'
      : activeStore
        ? hasOverride
          ? `Editing UPI for ${activeStore.code ? `${activeStore.code} — ` : ''}${activeStore.name}.`
          : `No override yet for ${activeStore.name} — showing shared UPI. Save to create a unit-specific override.`
        : 'Select a business unit to edit its UPI.'

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-xs text-muted-foreground sm:max-w-md">{editingHint}</p>
        <UpiCheckoutModeToggle
          mode={mode}
          onConfirm={handleSetMode}
          pending={updateVendor.isPending}
        />
      </div>

      {mode === 'per_unit' && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <Label className="mb-1.5 block text-xs text-muted-foreground">Business unit</Label>
            <BusinessUnitSelect
              value={selectedStoreId}
              onChange={handleStoreChange}
            />
          </div>
          {hasOverride && (
            <Button type="button" variant="outline" size="sm" onClick={handleClearOverride} disabled={isSaving}>
              Use shared UPI
            </Button>
          )}
        </div>
      )}

      {mode === 'per_unit' && !hasOverride && (shared.upi_id || shared.qr_code_url) && (
        <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Inherited from shared UPI
          {shared.upi_id ? `: ${shared.upi_id}` : ''}
          {!shared.enabled ? ' (currently disabled on shared settings)' : ''}
        </p>
      )}

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
          <Button type="button" size="sm" onClick={handleSave} disabled={isSaving} className="gap-1.5">
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save UPI settings
          </Button>
        </div>
      </div>
    </div>
  )
}
