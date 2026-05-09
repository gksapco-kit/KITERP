/**
 * Bridges the existing store API (useCart, useCheckout, useAuthStore)
 * to the checkout template's { state, actions } shape.
 *
 * Drop-in replacement for useCheckoutDemo() in the deployed storefront context.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart, useUpdateCartItem, useRemoveCartItem, useCheckout } from './useStore'
import { useAuthStore } from '@/stores/authStore'
import { useVendor } from '@/contexts/VendorContext'
import { storeApi } from '@/api/store'
import type { Address, Cart, Customer, PaymentSelection, ShippingMethod } from '@/checkout/types'

const SHIPPING_METHODS: ShippingMethod[] = [
  {
    id: 'free',
    label: 'Free Delivery',
    description: '3–7 business days',
    price: { amount: 0, currency: 'INR' },
    estimatedDays: { min: 3, max: 7 },
  },
  {
    id: 'express',
    label: 'Express Delivery',
    description: '1–2 business days',
    price: { amount: 9900, currency: 'INR' },
    estimatedDays: { min: 1, max: 2 },
  },
]

/** Map store payment method id → checkout PaymentSelection */
function paymentToCheckout(method: 'cod' | 'upi' | 'card'): PaymentSelection {
  if (method === 'upi')  return { kind: 'provider', provider: 'paypal' }
  if (method === 'cod')  return { kind: 'tab', tab: 'bank_transfer' }
  return { kind: 'tab', tab: 'card' }
}

/** Map checkout PaymentSelection → store payment_method */
function checkoutToPayment(sel?: PaymentSelection): 'cod' | 'upi' | 'card' {
  if (!sel) return 'card'
  if (sel.kind === 'provider') return 'upi'
  if (sel.kind === 'tab' && sel.tab === 'bank_transfer') return 'cod'
  return 'card'
}

export function useStoreBridgeCheckout() {
  const navigate = useNavigate()
  const { storePath } = useVendor()
  const { customer } = useAuthStore()
  const { data: cart } = useCart()
  const updateItem = useUpdateCartItem()
  const removeItem = useRemoveCartItem()
  const checkoutMutation = useCheckout()

  const currency = 'INR'

  // ── Convert saved addresses ─────────────────────────────────────────────────
  const savedAddresses: Address[] = ((customer?.shipping_addresses ?? []) as unknown as Record<string, string>[]).map((a, i) => ({
    id: String(i),
    label: a.label || 'home',
    fullName: customer?.full_name ?? '',
    line1: a.street_address ?? '',
    city: a.city ?? '',
    region: a.state ?? '',
    postalCode: a.postal_code ?? '',
    country: a.country || 'India',
    phone: customer?.phone,
    isDefault: i === (customer?.default_address_index ?? 0),
  }))

  // ── Local form state ────────────────────────────────────────────────────────
  const [customerInfo, setCustomerInfo] = useState<Partial<Customer>>({
    email: customer?.email ?? '',
    firstName: customer?.full_name?.split(' ')[0],
    lastName: customer?.full_name?.split(' ').slice(1).join(' ') || undefined,
    isGuest: false,
    savedAddresses,
  })
  const [shippingAddress, setShippingAddressState] = useState<Address | undefined>(savedAddresses[0])
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string | undefined>(
    savedAddresses.length > 0 ? String(customer?.default_address_index ?? 0) : undefined
  )
  const [shippingMethodId, setShippingMethodId] = useState<string>('free')
  const [payment, setPayment] = useState<PaymentSelection | undefined>({ kind: 'tab', tab: 'card' })
  const [notes, setNotes] = useState('')
  const [giftMessage, setGiftMessage] = useState('')
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [couponCode, setCouponCode] = useState<string | null>(null)

  // ── Map store cart → checkout Cart ─────────────────────────────────────────
  const subtotalAmount = Math.round(
    ((cart?.items ?? []) as any[]).reduce((s: number, i: any) => s + i.price * i.qty, 0) * 100
  )
  const shippingMethod = SHIPPING_METHODS.find(m => m.id === shippingMethodId)
  const shippingAmount = shippingMethod?.price.amount ?? 0
  const taxAmount = Math.round(subtotalAmount * 0.18)
  const discountAmount = Math.round(couponDiscount * 100)

  const checkoutCart: Cart = useMemo(() => ({
    id: 'store_cart',
    items: ((cart?.items ?? []) as any[]).map((item: Record<string, unknown>, i: number) => ({
      id: String(i),
      productId: String(item.product_id ?? i),
      variantId: String(item.variant_id ?? i),
      name: String(item.name ?? ''),
      variantLabel: item.variant_label ? String(item.variant_label) : undefined,
      imageUrl: item.image_url ? String(item.image_url) : undefined,
      unitPrice: { amount: Math.round(Number(item.price) * 100), currency },
      quantity: Number(item.qty),
      inStock: true,
    })),
    subtotal: { amount: subtotalAmount, currency },
    shipping: { amount: shippingAmount, currency },
    discounts: discountAmount > 0 && couponCode
      ? [{ code: couponCode, label: couponCode, amount: { amount: discountAmount, currency } }]
      : [],
    taxes: [{ label: 'GST (18%)', amount: { amount: taxAmount, currency } }],
    total: { amount: subtotalAmount + shippingAmount + taxAmount - discountAmount, currency },
  }), [cart, subtotalAmount, shippingAmount, taxAmount, discountAmount, couponCode, currency])

  // ── Resolve selected address ────────────────────────────────────────────────
  const resolvedAddress: Address | undefined = shippingAddress
    ?? (selectedSavedAddressId !== undefined
      ? savedAddresses.find(a => a.id === selectedSavedAddressId)
      : savedAddresses[0])

  // ── Actions ─────────────────────────────────────────────────────────────────
  const actions = useMemo(() => ({
    setCustomer: (c: Partial<Customer>) => setCustomerInfo(c),

    setShippingAddress: (a: Address) => {
      setShippingAddressState(a)
      setSelectedSavedAddressId(undefined)
    },
    selectSavedAddress: (id: string) => {
      setSelectedSavedAddressId(id)
      setShippingAddressState(undefined)
    },
    clearSavedAddress: () => {
      setSelectedSavedAddressId(undefined)
      setShippingAddressState(undefined)
    },

    setShippingMethod: (id: string) => setShippingMethodId(id),
    setPayment: (p: PaymentSelection) => setPayment(p),
    setNotes: (s: string) => setNotes(s),
    setGiftMessage: (s: string) => setGiftMessage(s),

    updateQuantity: (id: string, q: number) => {
      const idx = Number(id)
      if (q <= 0) removeItem.mutate(idx)
      else updateItem.mutate({ index: idx, qty: q })
    },
    removeItem: (id: string) => removeItem.mutate(Number(id)),

    applyCoupon: async (code: string): Promise<{ ok: boolean; message?: string }> => {
      try {
        const result = await storeApi.validateCoupon(code, subtotalAmount / 100)
        if (result.valid) {
          setCouponDiscount(result.discount_amount)
          setCouponCode(code)
          return { ok: true }
        }
        return { ok: false, message: result.message }
      } catch {
        return { ok: false, message: 'Could not validate coupon — check the code and try again.' }
      }
    },
    removeCoupon: (_code: string) => {
      setCouponDiscount(0)
      setCouponCode(null)
    },

    placeOrder: async (): Promise<{ ok: boolean; orderId?: string; error?: string }> => {
      if (!resolvedAddress) {
        return { ok: false, error: 'Please select a delivery address.' }
      }
      try {
        const order = await checkoutMutation.mutateAsync({
          shipping_address: {
            street_address: resolvedAddress.line1,
            city: resolvedAddress.city,
            state: resolvedAddress.region,
            postal_code: resolvedAddress.postalCode,
            country: resolvedAddress.country || 'India',
          },
          payment_method: checkoutToPayment(payment),
          notes: notes || undefined,
          coupon_code: couponCode ?? undefined,
        })
        navigate(storePath(`/account/orders/${order.id}`))
        return { ok: true, orderId: order.id }
      } catch {
        return { ok: false, error: 'Order placement failed. Please check your details and try again.' }
      }
    },
  }), [
    resolvedAddress, payment, notes, couponCode, subtotalAmount,
    checkoutMutation, navigate, storePath, removeItem, updateItem,
  ])

  return {
    state: {
      cart: checkoutCart,
      customer: {
        ...customerInfo,
        email: customerInfo.email ?? customer?.email ?? '',
        isGuest: false,
        savedAddresses,
      } as Customer,
      shippingAddress: resolvedAddress,
      selectedSavedAddressId,
      shippingMethodId,
      shippingMethods: SHIPPING_METHODS,
      payment,
      notes,
      giftMessage,
      isPlacing: checkoutMutation.isPending,
      error: undefined as string | undefined,
    },
    actions,
  }
}
