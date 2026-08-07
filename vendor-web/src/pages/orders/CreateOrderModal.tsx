import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { BusinessUnitSelect } from '@/components/common/BusinessUnitSelect'
import { BranchSelect } from '@/components/common/BranchSelect'
import { CustomerPicker, type CustomerPickerValue } from '@/components/commission/CustomerPicker'
import { CatalogItemPicker, type CatalogPickerItem } from '@/components/common/CatalogItemPicker'
import { vendorApi } from '@/api/vendor'
import { cn } from '@/lib/utils'
import { modalWidthMd } from '@/lib/modalUi'
import { Loader2, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'

const ORDER_TYPES = [
  { value: 'standard', label: 'Standard Order' },
  { value: 'quotation', label: 'Quotation' },
  { value: 'return', label: 'Return Order' },
  { value: 'credit_note', label: 'Credit Note' },
  { value: 'debit_note', label: 'Debit Note' },
  { value: 'sample', label: 'Sample / Free of Charge' },
]

const PAYMENT_METHODS = [
  { value: 'cod', label: 'Cash on Delivery' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'netbanking', label: 'Netbanking' },
  { value: 'pay_later', label: 'Pay Later' },
  { value: 'wallet', label: 'Wallet' },
]

interface OrderItem {
  catalogItem: CatalogPickerItem
  qty: number
  price: number
}

interface Props {
  onClose: () => void
  onCreated: (orderId: string) => void
}

export function CreateOrderModal({ onClose, onCreated }: Props) {
  const queryClient = useQueryClient()

  // Customer
  const [customer, setCustomer] = useState<CustomerPickerValue | null>(null)
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [useExistingCustomer, setUseExistingCustomer] = useState(true)

  // Scope
  const [storeId, setStoreId] = useState('')
  const [branchId, setBranchId] = useState('')
  const effectiveStoreId = branchId || storeId

  // Items
  const [catalogItems, setCatalogItems] = useState<CatalogPickerItem[]>([])
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])

  // When catalog picker changes, sync new items into orderItems (preserving existing qtys/prices)
  const handleCatalogChange = (picked: CatalogPickerItem[]) => {
    setCatalogItems(picked)
    setOrderItems((prev) => {
      const prevMap = new Map(prev.map((oi) => [oi.catalogItem.id + (oi.catalogItem.variant_id ?? ''), oi]))
      return picked.map((ci) => {
        const key = ci.id + (ci.variant_id ?? '')
        return prevMap.get(key) ?? { catalogItem: ci, qty: 1, price: ci.price ?? 0 }
      })
    })
  }

  // Payment
  const [paymentMethod, setPaymentMethod] = useState('cod')
  const [notes, setNotes] = useState('')

  // Order terms (collapsible)
  const [showTerms, setShowTerms] = useState(false)
  const [orderType, setOrderType] = useState('standard')
  const [paymentTermsCode, setPaymentTermsCode] = useState('')
  const [paymentTermsDays, setPaymentTermsDays] = useState('')
  const [shippingTerms, setShippingTerms] = useState('')
  const [orderReason, setOrderReason] = useState('')
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState('')

  // Shipping (collapsible)
  const [showShipping, setShowShipping] = useState(false)
  const [shippingStreet, setShippingStreet] = useState('')
  const [shippingCity, setShippingCity] = useState('')
  const [shippingState, setShippingState] = useState('')
  const [shippingPostal, setShippingPostal] = useState('')

  const createOrder = useMutation({
    mutationFn: () => {
      const items = orderItems.map((oi) => ({
        product_id: oi.catalogItem.item_type === 'product' ? oi.catalogItem.id : undefined,
        service_id: oi.catalogItem.item_type === 'service' ? oi.catalogItem.id : undefined,
        item_type: oi.catalogItem.item_type,
        variant_id: oi.catalogItem.variant_id,
        name: oi.catalogItem.name,
        qty: oi.qty,
        price: oi.price,
      }))

      return vendorApi.createVendorOrder({
        ...(useExistingCustomer && customer
          ? { customer_id: customer.id }
          : { customer_name: guestName.trim(), customer_email: guestEmail.trim(), customer_phone: guestPhone.trim() || undefined }),
        items,
        payment_method: paymentMethod,
        notes: notes.trim() || undefined,
        store_id: effectiveStoreId || undefined,
        order_type: orderType || 'standard',
        payment_terms_code: paymentTermsCode.trim() || undefined,
        payment_terms_days: paymentTermsDays ? parseInt(paymentTermsDays) : undefined,
        shipping_terms: shippingTerms.trim() || undefined,
        order_reason: orderReason.trim() || undefined,
        requested_delivery_date: requestedDeliveryDate || undefined,
        shipping_street: shippingStreet.trim() || undefined,
        shipping_city: shippingCity.trim() || undefined,
        shipping_state: shippingState.trim() || undefined,
        shipping_postal_code: shippingPostal.trim() || undefined,
      })
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      onCreated(order.id)
    },
  })

  const canSubmit = (() => {
    if (orderItems.length === 0) return false
    if (useExistingCustomer) return !!customer
    return !!guestName.trim() && !!guestEmail.trim()
  })()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    createOrder.mutate()
  }

  const labelCls = 'text-xs font-medium'
  const fieldGap = 'space-y-1'

  return (
    <ModalOverlay onClose={onClose} className="p-2">
      <ModalPanel className={cn(modalWidthMd, 'max-h-[calc(100dvh-1rem)]')}>
        <ModalHeader
          title="Create Order"
          onClose={onClose}
          className="border-0 px-4 py-2.5 [&>div>h2]:text-base"
        />
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <ModalBody className="space-y-3 overflow-y-auto px-4 pb-3 pt-0">

            {/* Business unit */}
            <div className={fieldGap}>
              <Label className={labelCls}>Business unit / Branch</Label>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                <BusinessUnitSelect
                  value={storeId}
                  onChange={(id) => { setStoreId(id); setBranchId(''); setCatalogItems([]); setOrderItems([]) }}
                  allowAll
                  className="min-w-0"
                  triggerClassName="h-8 text-sm"
                />
                <BranchSelect
                  businessUnitId={storeId || null}
                  value={branchId}
                  onChange={(id) => { setBranchId(id); setCatalogItems([]); setOrderItems([]) }}
                  allowAll
                  className="min-w-0"
                  triggerClassName="h-8 text-sm"
                />
              </div>
            </div>

            {/* Customer */}
            <div className={fieldGap}>
              <div className="flex items-center justify-between">
                <Label className={labelCls}>Customer</Label>
                <button
                  type="button"
                  className="text-[11px] text-primary hover:underline"
                  onClick={() => { setUseExistingCustomer((v) => !v); setCustomer(null); setGuestName(''); setGuestEmail(''); setGuestPhone('') }}
                >
                  {useExistingCustomer ? 'Enter new customer instead' : 'Pick existing customer'}
                </button>
              </div>
              {useExistingCustomer ? (
                <CustomerPicker
                  selected={customer}
                  onSelect={setCustomer}
                  compact
                  placeholder="Search customers…"
                />
              ) : (
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                  <div className={fieldGap}>
                    <Label className="text-[11px]">Name *</Label>
                    <Input
                      className="h-8 text-sm"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Full name"
                    />
                  </div>
                  <div className={fieldGap}>
                    <Label className="text-[11px]">Email *</Label>
                    <Input
                      type="email"
                      className="h-8 text-sm"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className={fieldGap}>
                    <Label className="text-[11px]">Phone</Label>
                    <Input
                      className="h-8 text-sm"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      placeholder="+91 XXXXX XXXXX"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Items */}
            <div className={fieldGap}>
              <Label className={labelCls}>Products & Services *</Label>
              <CatalogItemPicker
                storeId={effectiveStoreId}
                value={catalogItems}
                onChange={handleCatalogChange}
                placeholder={effectiveStoreId ? 'Search products & services…' : 'Select a business unit first…'}
                disabled={!effectiveStoreId}
              />
              {orderItems.length > 0 && (
                <div className="mt-1.5 space-y-1.5 rounded-md border border-border bg-muted/30 p-2">
                  {orderItems.map((oi, idx) => (
                    <div key={oi.catalogItem.id + (oi.catalogItem.variant_id ?? '')} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{oi.catalogItem.name}</span>
                      <div className="flex shrink-0 items-center gap-1">
                        <Label className="sr-only">Qty</Label>
                        <Input
                          type="number"
                          min={1}
                          className="h-7 w-14 px-1.5 text-center text-xs"
                          value={oi.qty}
                          onChange={(e) => {
                            const v = Math.max(1, parseInt(e.target.value) || 1)
                            setOrderItems((prev) => prev.map((x, i) => i === idx ? { ...x, qty: v } : x))
                          }}
                          aria-label="Quantity"
                        />
                        <span className="text-xs text-muted-foreground">×</span>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          className="h-7 w-20 px-1.5 text-right text-xs"
                          value={oi.price}
                          onChange={(e) => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0)
                            setOrderItems((prev) => prev.map((x, i) => i === idx ? { ...x, price: v } : x))
                          }}
                          aria-label="Price"
                        />
                        <button
                          type="button"
                          className="ml-0.5 rounded p-0.5 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            const newItems = orderItems.filter((_, i) => i !== idx)
                            setOrderItems(newItems)
                            setCatalogItems(newItems.map((x) => x.catalogItem))
                          }}
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-end pt-0.5 text-xs font-medium text-foreground">
                    Total: ₹{orderItems.reduce((s, oi) => s + oi.qty * oi.price, 0).toFixed(2)}
                  </div>
                </div>
              )}
            </div>

            {/* Payment + Notes */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
              <div className={fieldGap}>
                <Label className={labelCls}>Payment method</Label>
                <Select
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  options={PAYMENT_METHODS}
                  aria-label="Payment method"
                  triggerClassName="h-8 text-sm"
                />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Notes (optional)</Label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-[4.25rem] w-full resize-none rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Order notes or instructions…"
                />
              </div>
            </div>

            {/* Order terms + Shipping — side by side */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
              <div className="rounded-md border border-border/60">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setShowTerms((v) => !v)}
                >
                  Order terms
                  {showTerms ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {showTerms && (
                  <div className="grid grid-cols-1 gap-2 border-t border-border/60 p-3">
                    <div className={fieldGap}>
                      <Label className="text-[11px]">Order type</Label>
                      <Select
                        value={orderType}
                        onChange={setOrderType}
                        options={ORDER_TYPES}
                        aria-label="Order type"
                        triggerClassName="h-8 text-sm"
                      />
                    </div>
                    <div className={fieldGap}>
                      <Label className="text-[11px]">Requested delivery date</Label>
                      <Input type="date" className="h-8 text-sm" value={requestedDeliveryDate} onChange={(e) => setRequestedDeliveryDate(e.target.value)} />
                    </div>
                    <div className={fieldGap}>
                      <Label className="text-[11px]">Payment terms</Label>
                      <Input className="h-8 text-sm" value={paymentTermsCode} onChange={(e) => setPaymentTermsCode(e.target.value)} placeholder="e.g. NET30, IMMEDIATE" />
                    </div>
                    <div className={fieldGap}>
                      <Label className="text-[11px]">Net days</Label>
                      <Input type="number" min={0} className="h-8 text-sm" value={paymentTermsDays} onChange={(e) => setPaymentTermsDays(e.target.value)} placeholder="0" />
                    </div>
                    <div className={fieldGap}>
                      <Label className="text-[11px]">Shipping terms</Label>
                      <Input className="h-8 text-sm" value={shippingTerms} onChange={(e) => setShippingTerms(e.target.value)} placeholder="e.g. FOB Mumbai" />
                    </div>
                    <div className={fieldGap}>
                      <Label className="text-[11px]">Order reason</Label>
                      <Input className="h-8 text-sm" value={orderReason} onChange={(e) => setOrderReason(e.target.value)} placeholder="e.g. promotional, replacement" />
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-md border border-border/60">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setShowShipping((v) => !v)}
                >
                  Shipping address (optional)
                  {showShipping ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {showShipping && (
                  <div className="grid grid-cols-1 gap-2 border-t border-border/60 p-3">
                    <div className={fieldGap}>
                      <Label className="text-[11px]">Street address</Label>
                      <Input className="h-8 text-sm" value={shippingStreet} onChange={(e) => setShippingStreet(e.target.value)} placeholder="123 Main St" />
                    </div>
                    <div className={fieldGap}>
                      <Label className="text-[11px]">City</Label>
                      <Input className="h-8 text-sm" value={shippingCity} onChange={(e) => setShippingCity(e.target.value)} placeholder="Mumbai" />
                    </div>
                    <div className={fieldGap}>
                      <Label className="text-[11px]">State</Label>
                      <Input className="h-8 text-sm" value={shippingState} onChange={(e) => setShippingState(e.target.value)} placeholder="Maharashtra" />
                    </div>
                    <div className={fieldGap}>
                      <Label className="text-[11px]">Postal code</Label>
                      <Input className="h-8 text-sm" value={shippingPostal} onChange={(e) => setShippingPostal(e.target.value)} placeholder="400001" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {createOrder.isError && (
              <p className="text-xs text-destructive">
                {(createOrder.error as Error)?.message || 'Failed to create order. Please try again.'}
              </p>
            )}
          </ModalBody>

          <ModalFooter className="justify-end gap-2 border-0 bg-transparent px-4 py-2.5">
            <Button type="button" variant="cancel" className="h-8 px-3 text-sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="h-8 px-3 text-sm" disabled={!canSubmit || createOrder.isPending}>
              {createOrder.isPending
                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                : <Plus className="mr-1.5 h-3.5 w-3.5" />}
              Create Order
            </Button>
          </ModalFooter>
        </form>
      </ModalPanel>
    </ModalOverlay>
  )
}
