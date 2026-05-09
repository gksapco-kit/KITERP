import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStorefront } from '@/storefront/StorefrontContext'
import type {
  Address,
  Cart,
  Customer,
  PaymentSelection,
  ShippingMethod,
} from '../types'

export type { CheckoutState, CheckoutActions } from './useCheckoutDemo'

const SHIPPING_METHODS: ShippingMethod[] = [
  { id: 'standard', label: 'Standard shipping', description: '5–7 business days', price: { amount: 499, currency: 'USD' }, estimatedDays: { min: 5, max: 7 } },
  { id: 'express', label: 'Express shipping', description: '2–3 business days', price: { amount: 1299, currency: 'USD' }, estimatedDays: { min: 2, max: 3 } },
  { id: 'overnight', label: 'Overnight', description: 'Next business day', price: { amount: 2499, currency: 'USD' }, estimatedDays: { min: 1, max: 1 } },
  { id: 'pickup', label: 'Store pickup', description: 'Ready in 2 hours', price: { amount: 0, currency: 'USD' }, estimatedDays: { min: 0, max: 0 } },
]

function computeTotal(subtotal: { amount: number; currency: string }, shippingId?: string): { amount: number; currency: string } {
  const shipping = SHIPPING_METHODS.find((m) => m.id === shippingId)
  const shippingAmount = shipping?.price.amount ?? 0
  const tax = Math.round(subtotal.amount * 0.08875)
  return { amount: subtotal.amount + shippingAmount + tax, currency: subtotal.currency }
}

/** Bridges the storefront cart (StorefrontContext) to the checkout template's { state, actions } shape. */
export function useStorefrontCheckout(confirmationBasePath: string, siteId?: string) {
  const navigate = useNavigate()
  const { cart: sfCart, updateLine, removeLine } = useStorefront()

  const [customer, setCustomer] = useState<Partial<Customer>>({ email: '', isGuest: true })
  const [shippingAddress, setShippingAddressState] = useState<Address | undefined>()
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string | undefined>()
  const [shippingMethodId, setShippingMethodId] = useState<string | undefined>('standard')
  const [payment, setPayment] = useState<PaymentSelection | undefined>({ kind: 'tab', tab: 'card' })
  const [notes, setNotes] = useState('')
  const [giftMessage, setGiftMessage] = useState('')
  const [isPlacing, setIsPlacing] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const currency = sfCart?.subtotal.currency ?? 'USD'
  const shippingMethod = SHIPPING_METHODS.find((m) => m.id === shippingMethodId)
  const shippingAmount = shippingMethod?.price.amount ?? 0
  const subtotalAmount = sfCart?.subtotal.amount ?? 0
  const taxAmount = Math.round(subtotalAmount * 0.08875)

  const checkoutCart: Cart = useMemo(() => ({
    id: sfCart?.id ?? 'cart_empty',
    items: (sfCart?.lines ?? []).map((l) => ({
      id: l.id,
      productId: l.productId,
      variantId: l.variantId,
      name: l.name,
      variantLabel: l.variantLabel,
      imageUrl: l.imageUrl,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      inStock: l.inStock ?? true,
      maxQuantity: l.maxQuantity ?? 99,
    })),
    subtotal: sfCart?.subtotal ?? { amount: 0, currency },
    shipping: { amount: shippingAmount, currency },
    discounts: [],
    taxes: [{ label: 'Sales tax (8.875%)', amount: { amount: taxAmount, currency } }],
    total: { amount: subtotalAmount + shippingAmount + taxAmount, currency },
  }), [sfCart, shippingAmount, taxAmount, currency, subtotalAmount])

  const actions = useMemo(() => ({
    setCustomer,
    setShippingAddress: (a: Address) => {
      setShippingAddressState(a)
      setSelectedSavedAddressId(undefined)
    },
    selectSavedAddress: (id: string) => setSelectedSavedAddressId(id),
    clearSavedAddress: () => setSelectedSavedAddressId(undefined),
    setShippingMethod: setShippingMethodId,
    setPayment,
    setNotes,
    setGiftMessage,

    updateQuantity: (itemId: string, q: number) => {
      if (q <= 0) removeLine(itemId)
      else updateLine(itemId, q)
    },
    removeItem: (itemId: string) => removeLine(itemId),

    applyCoupon: async (_code: string): Promise<{ ok: boolean; message?: string }> => {
      return { ok: false, message: 'Coupons not available in demo mode.' }
    },
    removeCoupon: (_code: string) => {},

    placeOrder: async () => {
      setIsPlacing(true)
      setError(undefined)
      try {
        let orderId: string
        let orderNumber: string

        if (siteId) {
          // Real backend order placement
          const res = await fetch(`/api/v1/public/sites/${siteId}/storefront/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customer: {
                email: customer.email ?? '',
                first_name: customer.firstName,
                last_name: customer.lastName,
                phone: customer.phone,
                is_guest: true,
              },
              shipping_address: shippingAddress ? {
                full_name: shippingAddress.fullName,
                line1: shippingAddress.line1,
                line2: shippingAddress.line2,
                city: shippingAddress.city,
                region: shippingAddress.region,
                postal_code: shippingAddress.postalCode,
                country: shippingAddress.country,
                phone: shippingAddress.phone,
              } : {},
              items: checkoutCart.items.map(i => ({
                id: i.id,
                product_id: i.productId,
                variant_id: i.variantId,
                name: i.name,
                variant_label: i.variantLabel,
                image_url: i.imageUrl,
                unit_price: { amount: i.unitPrice.amount, currency: i.unitPrice.currency },
                quantity: i.quantity,
              })),
              shipping_method_id: shippingMethodId ?? 'standard',
              shipping_amount: shippingMethod?.price.amount ?? 499,
              payment_method: payment?.kind === 'tab' ? payment.tab : payment?.kind === 'provider' ? payment.provider : 'card',
              notes,
            }),
          })
          if (!res.ok) throw new Error('Order placement failed')
          const data = await res.json()
          orderId = data.order_id
          orderNumber = data.order_number
        } else {
          // Demo/mock mode — persist to sessionStorage
          await new Promise((r) => setTimeout(r, 1200))
          orderId = `order_${Date.now()}`
          orderNumber = `ORD-${Math.floor(10000 + Math.random() * 90000)}`
        }

        const orderData = {
          id: orderId,
          number: orderNumber,
          placedAt: new Date().toISOString(),
          status: 'placed',
          customer: { ...customer, isGuest: true },
          shippingAddress,
          shippingMethod: shippingMethod ?? SHIPPING_METHODS[0],
          cart: checkoutCart,
          paymentSummary: {
            method:
              payment?.kind === 'provider'
                ? payment.provider
                : payment?.kind === 'tab'
                  ? `${payment.tab} card`
                  : 'unknown',
            provider: payment?.kind === 'provider' ? payment.provider : undefined,
          },
          notes,
          giftMessage,
          timeline: [
            { status: 'placed', label: 'Order placed', occurredAt: new Date().toISOString() },
          ],
        }
        sessionStorage.setItem(`sf_order_${orderId}`, JSON.stringify(orderData))

        navigate(`${confirmationBasePath}/${orderId}/confirmation`)
        return { ok: true, orderId }
      } catch {
        const msg = 'Failed to place order. Please try again.'
        setError(msg)
        return { ok: false, error: msg }
      } finally {
        setIsPlacing(false)
      }
    },
  }), [
    customer, shippingAddress, shippingMethod, shippingMethodId,
    payment, notes, giftMessage, checkoutCart, confirmationBasePath,
    navigate, updateLine, removeLine,
  ])

  return {
    state: {
      cart: checkoutCart,
      customer,
      shippingAddress,
      selectedSavedAddressId,
      shippingMethodId,
      shippingMethods: SHIPPING_METHODS,
      payment,
      notes,
      giftMessage,
      isPlacing,
      error,
    },
    actions,
  }
}
