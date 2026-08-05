import { useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { FieldLabel, CheckboxFieldLabel } from '@/components/common/FieldLabel'
import { crmApi } from '@/api/crm'
import { extractApiError } from '@/lib/errorMessages'
import { formatCurrency } from '@/lib/utils'
import { rentalApi } from './api'
import { formatCardDate, toDateInputValue, todayLocalYMD, addDaysYMD } from './rentalDates'
import type { RentalAsset, RentalBooking } from './rentalConstants'

type Customer = { id: string; full_name?: string; phone?: string; email?: string }
type SelectOpt = { value: string; label: string }

function emptyForm() {
  const start = todayLocalYMD()
  return {
    asset_id: '',
    customer_id: '',
    sales_area_id: '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    quantity: '1',
    start_date: start,
    end_date: addDaysYMD(start, 7),
    pricing_plan: 'daily',
    notes: '',
    needs_delivery: false,
    delivery_address: '',
    auto_approve: true,
  }
}

type Props = {
  open: boolean
  onClose: () => void
  assets: RentalAsset[]
  customers: Customer[]
  salesAreaOptions: SelectOpt[]
  onCreated: (booking: RentalBooking) => void
}

export default function RentalBookingCreateSheet({ open, onClose, assets, customers, salesAreaOptions, onCreated }: Props) {
  const [form, setForm] = useState(emptyForm)
  const [creditHint, setCreditHint] = useState<{ allowed: boolean; text: string } | null>(null)
  const today = todayLocalYMD()

  const bookableAssetOptions = useMemo(() => {
    return assets
      .filter((a) => !['maintenance', 'unavailable', 'retired'].includes(a.status || ''))
      .map((a) => ({ value: a.id, label: `${a.name}${a.location ? ` · ${a.location}` : ''}` }))
  }, [assets])

  useEffect(() => {
    if (!open) return
    const first = assets.find((a) => !['maintenance', 'unavailable', 'retired'].includes(a.status || ''))
    const defaultPlan = (() => {
      if (!first) return 'daily'
      if (Number(first.per_minute_rate) > 0) return 'per_minute'
      if (Number(first.hourly_rate) > 0) return 'hourly'
      if (Number(first.daily_rate) > 0) return 'daily'
      if (Number(first.weekly_rate) > 0) return 'weekly'
      if (Number(first.monthly_rate) > 0) return 'monthly'
      if (Number(first.yearly_rate) > 0) return 'yearly'
      return 'daily'
    })()
    setForm({
      ...emptyForm(),
      asset_id: first?.id || '',
      pricing_plan: defaultPlan,
    })
    setCreditHint(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const selectedAsset = useMemo(() => assets.find((a) => a.id === form.asset_id) || null, [assets, form.asset_id])

  useEffect(() => {
    if (!open || !form.customer_name.trim()) {
      setCreditHint(null)
      return
    }
    const qty = Number(form.quantity) || 1
    const estimate = Math.max(1, (Number(selectedAsset?.daily_rate || 0) * qty) + Number(selectedAsset?.deposit_amount || 0))
    let cancelled = false
    const t = window.setTimeout(() => {
      crmApi.checkCreditControl({
        customer_id: form.customer_id || undefined,
        party_name: form.customer_name.trim(),
        amount: estimate,
        require_zero_outstanding: true,
      }).then((res) => {
        if (cancelled) return
        const due = Number(res.current_outstanding || 0)
        if (!res.allowed) {
          setCreditHint({
            allowed: false,
            text: res.reason || (due > 0 ? `₹${due.toLocaleString('en-IN')} DUE — clear before booking` : 'Not eligible'),
          })
        } else {
          setCreditHint({
            allowed: true,
            text: due > 0 ? `₹${due.toLocaleString('en-IN')} outstanding` : '₹0 CLEAR — eligible to book',
          })
        }
      }).catch(() => { if (!cancelled) setCreditHint(null) })
    }, 350)
    return () => { cancelled = true; window.clearTimeout(t) }
  }, [open, form.customer_id, form.customer_name, form.asset_id, form.quantity, selectedAsset])

  const createBooking = useMutation({
    mutationFn: (body: Record<string, unknown>) => rentalApi.createBooking(body),
    onSuccess: (data) => {
      toast.success(
        data.status === 'approved'
          ? `Booking ${data.booking_number || ''} created and approved`
          : `Booking ${data.booking_number || ''} created`,
      )
      onCreated(data)
    },
    onError: (e) => toast.error(extractApiError(e, 'Create booking')),
  })

  const save = () => {
    if (!form.asset_id) {
      toast.error('Select a rental asset')
      return
    }
    if (!form.customer_name.trim()) {
      toast.error('Customer name is required')
      return
    }
    if (creditHint && !creditHint.allowed) {
      toast.error(creditHint.text)
      return
    }
    const start = toDateInputValue(form.start_date)
    const end = toDateInputValue(form.end_date)
    if (!start || !end) {
      toast.error('Start and end dates are required')
      return
    }
    if (end < start) {
      toast.error('End date must be on or after start date')
      return
    }
    const qty = Number(form.quantity) || 0
    if (qty <= 0) {
      toast.error('Quantity must be greater than zero')
      return
    }
    createBooking.mutate({
      asset_id: form.asset_id,
      customer_id: form.customer_id || undefined,
      sales_area_id: form.sales_area_id || selectedAsset?.sales_area_id || undefined,
      customer_name: form.customer_name.trim(),
      customer_phone: form.customer_phone.trim() || undefined,
      customer_email: form.customer_email.trim() || undefined,
      quantity: qty,
      start_date: start,
      end_date: end,
      pricing_plan: form.pricing_plan,
      notes: form.notes.trim() || undefined,
      needs_delivery: form.needs_delivery,
      delivery_address: form.needs_delivery ? form.delivery_address.trim() || undefined : undefined,
      created_by_vendor: true,
      auto_approve: form.auto_approve,
    })
  }

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next && !createBooking.isPending) onClose() }}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle>Add Booking</SheetTitle>
          <SheetDescription>Create a rental booking for a customer.</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel required>Asset</FieldLabel>
              <Select
                value={form.asset_id || '__none__'}
                onChange={(v) => {
                  const id = v === '__none__' ? '' : v
                  const asset = assets.find((a) => a.id === id)
                  // Pick the best default plan for this asset
                  const bestPlan = (a: typeof asset) => {
                    if (!a) return 'daily'
                    if (Number(a.per_minute_rate) > 0) return 'per_minute'
                    if (Number(a.hourly_rate) > 0) return 'hourly'
                    if (Number(a.daily_rate) > 0) return 'daily'
                    if (Number(a.weekly_rate) > 0) return 'weekly'
                    if (Number(a.monthly_rate) > 0) return 'monthly'
                    if (Number(a.yearly_rate) > 0) return 'yearly'
                    return 'daily'
                  }
                  setForm((f) => ({
                    ...f,
                    asset_id: id,
                    sales_area_id: asset?.sales_area_id || f.sales_area_id,
                    pricing_plan: bestPlan(asset),
                    quantity: f.quantity || '1',
                  }))
                }}
                options={[{ value: '__none__', label: 'Select rack / asset…' }, ...bookableAssetOptions]}
              />
            </div>
            <div>
              <FieldLabel>Customer (outlet)</FieldLabel>
              <Select
                value={form.customer_id || '__manual__'}
                onChange={(v) => {
                  if (v === '__manual__') {
                    setForm((f) => ({ ...f, customer_id: '' }))
                    return
                  }
                  const c = customers.find((x) => x.id === v)
                  if (!c) return
                  setForm((f) => ({
                    ...f,
                    customer_id: c.id,
                    customer_name: c.full_name || '',
                    customer_phone: c.phone || '',
                    customer_email: c.email || '',
                  }))
                }}
                options={[
                  { value: '__manual__', label: 'Type manually / pick…' },
                  ...customers.map((c) => ({ value: c.id, label: c.full_name + (c.phone ? ` · ${c.phone}` : '') })),
                ]}
              />
            </div>
            <div>
              <FieldLabel required>Customer name</FieldLabel>
              <Input
                value={form.customer_name}
                onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value, customer_id: '' }))}
                placeholder="Customer / shop name"
              />
            </div>
            <div>
              <FieldLabel>Sales Area / Route</FieldLabel>
              <Select
                value={form.sales_area_id || '__none__'}
                onChange={(v) => setForm((f) => ({ ...f, sales_area_id: v === '__none__' ? '' : v }))}
                options={[{ value: '__none__', label: 'From rack / none' }, ...salesAreaOptions]}
              />
            </div>
            <div>
              <FieldLabel>Phone</FieldLabel>
              <Input
                value={form.customer_phone}
                onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))}
                placeholder="Mobile number"
              />
            </div>
            <div>
              <FieldLabel>Email</FieldLabel>
              <Input
                type="email"
                value={form.customer_email}
                onChange={(e) => setForm((f) => ({ ...f, customer_email: e.target.value }))}
                placeholder="email@example.com"
              />
            </div>
            <div>
              <FieldLabel>Quantity</FieldLabel>
              <Input
                type="number"
                min={1}
                max={selectedAsset?.available_capacity ?? undefined}
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              />
              {selectedAsset && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Available: <strong className="text-foreground">{selectedAsset.available_capacity ?? '—'}</strong>
                  {selectedAsset.capacity_unit ? ` ${selectedAsset.capacity_unit}` : ''}
                  {' · '}Max: {selectedAsset.capacity_max ?? '—'}
                </p>
              )}
            </div>
            <div>
              <FieldLabel>Pricing plan</FieldLabel>
              <Select
                value={form.pricing_plan}
                onChange={(v) => setForm((f) => ({ ...f, pricing_plan: v }))}
                options={[
                  ...(Number(selectedAsset?.per_minute_rate) > 0
                    ? [{ value: 'per_minute', label: `Per Minute · ₹${selectedAsset!.per_minute_rate}/min` }] : []),
                  ...(Number(selectedAsset?.hourly_rate) > 0
                    ? [{ value: 'hourly', label: `Hourly · ₹${selectedAsset!.hourly_rate}/hr` }] : []),
                  { value: 'daily', label: `Daily · ₹${selectedAsset?.daily_rate ?? 0}/day` },
                  ...(Number(selectedAsset?.weekly_rate) > 0
                    ? [{ value: 'weekly', label: `Weekly · ₹${selectedAsset!.weekly_rate}/wk` }] : []),
                  ...(Number(selectedAsset?.monthly_rate) > 0
                    ? [{ value: 'monthly', label: `Monthly · ₹${selectedAsset!.monthly_rate}/mo` }] : []),
                  ...(Number(selectedAsset?.yearly_rate) > 0
                    ? [{ value: 'yearly', label: `Yearly · ₹${selectedAsset!.yearly_rate}/yr` }] : []),
                ]}
              />
            </div>
            <div>
              <FieldLabel required>Start date</FieldLabel>
              <Input
                type="date"
                value={form.start_date}
                min={today}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel required>End date</FieldLabel>
              <Input
                type="date"
                value={form.end_date}
                min={form.start_date || today}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>Notes</FieldLabel>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes"
              />
            </div>
          </div>

          <CheckboxFieldLabel
            label="Needs delivery"
            checked={form.needs_delivery}
            onChange={(checked) => setForm((f) => ({ ...f, needs_delivery: checked }))}
          />
          {form.needs_delivery && (
            <Input
              value={form.delivery_address}
              onChange={(e) => setForm((f) => ({ ...f, delivery_address: e.target.value }))}
              placeholder="Delivery address"
            />
          )}

          <CheckboxFieldLabel
            label="Approve immediately"
            checked={form.auto_approve}
            onChange={(checked) => setForm((f) => ({ ...f, auto_approve: checked }))}
          />

          {selectedAsset && (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {selectedAsset.name}
              {' · '}
              {formatCurrency(Number(selectedAsset.daily_rate || 0))}/day
              {Number(selectedAsset.monthly_rate) > 0 && <> · {formatCurrency(Number(selectedAsset.monthly_rate))}/mo</>}
              {' · '}deposit {formatCurrency(Number(selectedAsset.deposit_amount || 0))}
              {(selectedAsset.display_start_date || selectedAsset.display_end_date) && (
                <>
                  {' · '}available{' '}
                  {formatCardDate(selectedAsset.display_start_date) || '…'}
                  {' → '}
                  {formatCardDate(selectedAsset.display_end_date) || '…'}
                </>
              )}
            </p>
          )}

          {creditHint && (
            <p className={`rounded-lg border px-3 py-2 text-sm ${
              creditHint.allowed
                ? 'border-emerald-200 bg-emerald-500/10 text-emerald-800 dark:border-emerald-800/60 dark:text-emerald-300'
                : 'border-rose-200 bg-rose-500/10 text-rose-700 dark:border-rose-800/60 dark:text-rose-300'
            }`}>
              {creditHint.text}
            </p>
          )}
        </div>

        <SheetFooter className="border-t border-border px-5 py-3">
          <Button variant="outline" disabled={createBooking.isPending} onClick={onClose}>Cancel</Button>
          <Button disabled={createBooking.isPending || (!!creditHint && !creditHint.allowed)} onClick={save}>
            {createBooking.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Create Booking
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
