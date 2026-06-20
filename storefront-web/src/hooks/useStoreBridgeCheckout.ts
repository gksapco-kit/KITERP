/**
 * Bridges the existing store API (useCart, useCheckout, useAuthStore)
 * to the checkout template's { state, actions } shape.
 */
import { useMemo, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useCart, useUpdateCartItem, useRemoveCartItem, useCheckout, useStoreInfo, resetCartAfterOrder } from './useStore'
import { useAuthStore } from '@/stores/authStore'
import { useVendor } from '@/contexts/VendorContext'
import { useBranch } from '@/contexts/BranchContext'
import { storeApi } from '@/api/store'
import { openRazorpayCheckout, mockRazorpayPay } from '@/lib/razorpay'
import { extractApiError } from '@/lib/errorMessages'
import { validateCheckoutFields, scrollToFirstCheckoutField, type CheckoutFieldErrors } from '@/checkout/validateCheckout'
import type { Address, Cart, Customer, PaymentSelection, ShippingMethod } from '@/checkout/types'

const FALLBACK_SHIPPING: ShippingMethod[] = [
  {
    id: 'free',
    label: 'Free Delivery',
    description: '3–7 business days',
    price: { amount: 0, currency: 'INR' },
    estimatedDays: { min: 3, max: 7 },
  },
]

function paymentToCheckout(method: 'cod' | 'upi' | 'card'): PaymentSelection {
  if (method === 'upi') return { kind: 'provider', provider: 'paypal' }
  if (method === 'cod') return { kind: 'tab', tab: 'bank_transfer' }
  return { kind: 'tab', tab: 'card' }
}

function checkoutToPayment(sel?: PaymentSelection): 'cod' | 'upi' | 'card' {
  if (!sel) return 'card'
  if (sel.kind === 'provider') return 'upi'
  if (sel.kind === 'tab' && sel.tab === 'bank_transfer') return 'cod'
  return 'card'
}

function isOnlinePayment(method: 'cod' | 'upi' | 'card'): boolean {
  return method !== 'cod'
}

export function useStoreBridgeCheckout() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { storePath } = useBranch()
  const { customer, isAuthenticated, setTokens, setCustomer } = useAuthStore()
  const { vendorSlug } = useVendor()
  const { branchCode, isBranchClosed, selectedBranch } = useBranch()
  const isGuest = !isAuthenticated
  const { data: cart } = useCart()
  const { data: storeInfo } = useStoreInfo()
  const updateItem = useUpdateCartItem()
  const removeItem = useRemoveCartItem()
  const checkoutMutation = useCheckout()

  const currency = 'INR'
  const storeName =
    (storeInfo as { display_name?: string; business_name?: string } | undefined)?.display_name
    ?? (storeInfo as { business_name?: string } | undefined)?.business_name
    ?? 'Store'

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

  const [customerInfo, setCustomerInfo] = useState<Partial<Customer>>({
    email: customer?.email ?? '',
    firstName: customer?.full_name?.split(' ')[0],
    lastName: customer?.full_name?.split(' ').slice(1).join(' ') || undefined,
    phone: customer?.phone ?? undefined,
    isGuest,
    savedAddresses: isGuest ? [] : savedAddresses,
  })
  const [shippingAddress, setShippingAddressState] = useState<Address | undefined>(savedAddresses[0])
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string | undefined>(
    savedAddresses.length > 0 ? String(customer?.default_address_index ?? 0) : undefined,
  )
  const [shippingMethodId, setShippingMethodId] = useState<string>('free')
  const [payment, setPayment] = useState<PaymentSelection | undefined>({ kind: 'tab', tab: 'card' })
  const [notes, setNotes] = useState('')
  const [giftMessage, setGiftMessage] = useState('')
  const [couponCode, setCouponCode] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | undefined>()
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({})
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [serverPreview, setServerPreview] = useState<Awaited<ReturnType<typeof storeApi.checkoutPreview>> | null>(null)

  const clearFieldErrors = useCallback((keys: string[]) => {
    setFieldErrors(prev => {
      if (!keys.length || !Object.keys(prev).length) return prev
      const next = { ...prev }
      for (const key of keys) delete next[key]
      return next
    })
  }, [])

  const resolvedAddress: Address | undefined = shippingAddress
    ?? (selectedSavedAddressId !== undefined
      ? savedAddresses.find(a => a.id === selectedSavedAddressId)
      : savedAddresses[0])

  const cartItemsPayload = useMemo(
    () => ((cart?.items ?? []) as Record<string, unknown>[]).map(item => ({
      product_id: String(item.product_id ?? ''),
      variant_id: item.variant_id ? String(item.variant_id) : undefined,
      name: String(item.name ?? ''),
      qty: Number(item.qty),
      price: Number(item.price),
      image_url: item.image_url ? String(item.image_url) : undefined,
    })),
    [cart?.items],
  )

  const refreshPreview = useCallback(async (coupon?: string | null) => {
    if (!cartItemsPayload.length) {
      setServerPreview(null)
      return
    }
    setPreviewLoading(true)
    setPreviewError(undefined)
    try {
      const previewBody = {
        shipping_method_id: shippingMethodId,
        coupon_code: coupon ?? couponCode ?? undefined,
        shipping_state: resolvedAddress?.region,
      }
      const data = isGuest
        ? await storeApi.guestCheckoutPreview({ ...previewBody, items: cartItemsPayload })
        : await storeApi.checkoutPreview(previewBody)
      setServerPreview(data)
      if (data.shipping_methods?.length && !data.shipping_methods.some(m => m.id === shippingMethodId)) {
        setShippingMethodId(data.shipping_methods[0].id)
      }
    } catch {
      setPreviewError('Could not load checkout totals')
    } finally {
      setPreviewLoading(false)
    }
  }, [cartItemsPayload, shippingMethodId, couponCode, resolvedAddress?.region, isGuest])

  useEffect(() => {
    void refreshPreview()
  }, [refreshPreview])

  const shippingMethods: ShippingMethod[] = useMemo(() => {
    const methods = serverPreview?.shipping_methods
    if (!methods?.length) return FALLBACK_SHIPPING
    return methods.map(m => ({
      id: m.id,
      label: m.label,
      description: m.description,
      price: { amount: Math.round((m.amount ?? 0) * 100), currency },
      estimatedDays: {
        min: m.estimated_days_min ?? 0,
        max: m.estimated_days_max ?? 0,
      },
    }))
  }, [serverPreview, currency])

  const subtotalAmount = Math.round((serverPreview?.subtotal ?? 0) * 100)
  const shippingAmount = Math.round((serverPreview?.shipping_amount ?? 0) * 100)
  const taxAmount = Math.round((serverPreview?.tax_amount ?? 0) * 100)
  const discountAmount = Math.round((serverPreview?.discount_amount ?? 0) * 100)

  const checkoutCart: Cart = useMemo(() => ({
    id: 'store_cart',
    items: ((cart?.items ?? []) as Record<string, unknown>[]).map((item, i) => ({
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
    taxes: (serverPreview?.tax_lines ?? [{ label: 'GST', amount: serverPreview?.tax_amount ?? 0 }]).map(t => ({
      label: t.label,
      amount: { amount: Math.round((typeof t.amount === 'number' ? t.amount : 0) * 100), currency },
    })),
    total: {
      amount: Math.round((serverPreview?.total ?? 0) * 100),
      currency,
    },
  }), [cart, subtotalAmount, shippingAmount, taxAmount, discountAmount, couponCode, serverPreview, currency])

  const completeOnlinePayment = useCallback(async (orderId: string) => {
    const rzp = await storeApi.createRazorpayOrder(orderId)

    const finish = async (payment: {
      razorpay_payment_id: string
      razorpay_order_id: string
      razorpay_signature: string
    }) => {
      await storeApi.verifyRazorpayPayment({
        order_id: orderId,
        ...payment,
      })
      await resetCartAfterOrder(qc, vendorSlug)
      navigate(storePath(`/order/${orderId}/confirmation`))
    }

    if (rzp.dev_mode) {
      const mock = await mockRazorpayPay(rzp.razorpay_order_id)
      await finish(mock)
      return
    }

    await openRazorpayCheckout({
      key: rzp.key_id,
      amount: rzp.amount,
      currency: rzp.currency,
      name: storeName,
      description: `Order payment`,
      order_id: rzp.razorpay_order_id,
      prefill: rzp.prefill,
      handler: (response) => {
        void finish(response)
      },
    })
  }, [navigate, storePath, storeName, qc, vendorSlug])

  const actions = useMemo(() => ({
    setCustomer: (c: Partial<Customer>) => {
      setCustomerInfo(c)
      clearFieldErrors(['email', 'firstName', 'lastName'])
    },

    setShippingAddress: (a: Address) => {
      setShippingAddressState(a)
      setSelectedSavedAddressId(undefined)
      clearFieldErrors(['fullName', 'line1', 'city', 'region', 'postalCode', 'country', 'phone', 'shippingAddress'])
    },
    selectSavedAddress: (id: string) => {
      setSelectedSavedAddressId(id)
      setShippingAddressState(undefined)
      clearFieldErrors(['fullName', 'line1', 'city', 'region', 'postalCode', 'country', 'phone', 'shippingAddress'])
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
        const previewBody = {
          shipping_method_id: shippingMethodId,
          coupon_code: code,
          shipping_state: resolvedAddress?.region,
        }
        const result = isGuest
          ? await storeApi.guestCheckoutPreview({ ...previewBody, items: cartItemsPayload })
          : await storeApi.checkoutPreview(previewBody)
        if (result.coupon_valid !== false && result.discount_amount >= 0) {
          setCouponCode(code)
          setServerPreview(result)
          return { ok: true }
        }
        return { ok: false, message: result.coupon_message ?? 'Invalid coupon' }
      } catch {
        return { ok: false, message: 'Could not validate coupon — check the code and try again.' }
      }
    },
    removeCoupon: (_code: string) => {
      setCouponCode(null)
      void refreshPreview(null)
    },

    placeOrder: async (): Promise<{ ok: boolean; orderId?: string; error?: string; fieldErrors?: CheckoutFieldErrors }> => {
      if (isBranchClosed) {
        return { ok: false, error: 'This store is currently closed. Please check back later or choose another location.' }
      }

      const usingSavedAddress = !isGuest && !!selectedSavedAddressId && !!savedAddresses.length
      const validationErrors = validateCheckoutFields({
        customer: customerInfo,
        shippingAddress: resolvedAddress,
        isGuest,
        usingSavedAddress,
      })

      if (Object.keys(validationErrors).length > 0) {
        setFieldErrors(validationErrors)
        scrollToFirstCheckoutField(validationErrors)
        return {
          ok: false,
          error: 'Please fill in all required fields highlighted below.',
          fieldErrors: validationErrors,
        }
      }
      setFieldErrors({})

      const paymentMethod = checkoutToPayment(payment)
      const checkoutPhone = (
        resolvedAddress?.phone
        || customerInfo.phone
        || customer?.phone
        || ''
      ).trim()
      const shippingPayload = {
        street_address: resolvedAddress?.line1 ?? '',
        city: resolvedAddress?.city ?? '',
        state: resolvedAddress?.region ?? '',
        postal_code: resolvedAddress?.postalCode ?? '',
        country: resolvedAddress?.country || 'India',
        ...(checkoutPhone ? { phone: checkoutPhone } : {}),
      }

      if (isGuest) {
        const email = customerInfo.email?.trim()
        const name = [customerInfo.firstName, customerInfo.lastName].filter(Boolean).join(' ').trim()
        if (!email) return { ok: false, error: 'Please enter your email address.' }
        if (!name) return { ok: false, error: 'Please enter your name.' }
        if (!resolvedAddress?.line1) return { ok: false, error: 'Please enter a delivery address.' }
      } else if (!resolvedAddress) {
        return { ok: false, error: 'Please select a delivery address.' }
      }

      setIsPlacingOrder(true)
      try {
        let orderId: string

        if (isGuest) {
          const guestName = [customerInfo.firstName, customerInfo.lastName].filter(Boolean).join(' ').trim()
          const guestPhone = customerInfo.phone?.trim() || undefined
          const result = await storeApi.guestCheckout({
            customer: {
              full_name: guestName,
              email: customerInfo.email!.trim(),
              phone: guestPhone,
            },
            items: cartItemsPayload,
            shipping_address: shippingPayload,
            payment_method: paymentMethod,
            shipping_method_id: shippingMethodId,
            notes: notes || undefined,
            coupon_code: couponCode ?? undefined,
            branch_code: branchCode ?? undefined,
            store_id: selectedBranch?.id ?? undefined,
          })
          if (result.access_token && result.refresh_token) {
            setTokens({ access_token: result.access_token, refresh_token: result.refresh_token, token_type: 'bearer' })
            if (result.customer) setCustomer(result.customer as any)
          }
          orderId = result.id
        } else {
          const order = await checkoutMutation.mutateAsync({
            shipping_address: shippingPayload,
            payment_method: paymentMethod,
            shipping_method_id: shippingMethodId,
            notes: notes || undefined,
            coupon_code: couponCode ?? undefined,
            branch_code: branchCode ?? undefined,
            store_id: selectedBranch?.id ?? undefined,
          })
          orderId = order.id
        }

        await resetCartAfterOrder(qc, vendorSlug)

        if (isOnlinePayment(paymentMethod)) {
          try {
            await completeOnlinePayment(orderId)
          } catch (payErr) {
            navigate(storePath(`/order/${orderId}/status`))
            return {
              ok: false,
              error: extractApiError(
                payErr,
                'Your order was created but payment could not be completed. Open your order page to retry.',
              ),
              orderId,
            }
          }
        } else {
          navigate(storePath(`/order/${orderId}/confirmation`))
        }
        return { ok: true, orderId }
      } catch (err) {
        return {
          ok: false,
          error: extractApiError(err, 'Order placement failed. Please check your details and try again.'),
        }
      } finally {
        setIsPlacingOrder(false)
      }
    },
  }), [
    resolvedAddress, payment, notes, couponCode, shippingMethodId,
    checkoutMutation, navigate, storePath, removeItem, updateItem,
    completeOnlinePayment, refreshPreview, isGuest, customerInfo,
    cartItemsPayload, setTokens, setCustomer, vendorSlug, qc,
    branchCode, isBranchClosed, clearFieldErrors, selectedSavedAddressId, savedAddresses, isPlacingOrder,
  ])

  return {
    state: {
      cart: checkoutCart,
      customer: {
        ...customerInfo,
        email: customerInfo.email ?? customer?.email ?? '',
        isGuest,
        savedAddresses: isGuest ? [] : savedAddresses,
      } as Customer,
      shippingAddress: resolvedAddress,
      selectedSavedAddressId,
      shippingMethodId,
      shippingMethods,
      payment,
      notes,
      giftMessage,
      isPlacing: isPlacingOrder || checkoutMutation.isPending,
      error: previewError,
      fieldErrors,
      isBranchClosed,
    },
    actions,
  }
}
