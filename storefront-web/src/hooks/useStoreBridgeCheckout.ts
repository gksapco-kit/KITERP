/**
 * Bridges the existing store API (useCart, useCheckout, useAuthStore)
 * to the checkout template's { state, actions } shape.
 */
import { useMemo, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useCart, useUpdateCartItem, useRemoveCartItem, useCheckout, useStoreInfo, resetCartAfterOrder, storeKeys, buildGuestCart } from './useStore'
import { useAuthStore } from '@/stores/authStore'
import { useVendor } from '@/contexts/VendorContext'
import { useBranch } from '@/contexts/BranchContext'
import { branchCodeForStore, pickDefaultOpenBranch } from '@/lib/branchMatching'
import { storeApi } from '@/api/store'
import { ensureCustomerSessionActive } from '@/lib/subscribeCheckout'
import { payOrderWithRazorpay, verifyRazorpayOrderPayment } from '@/lib/payOrderWithRazorpay'
import { isAxiosError } from 'axios'
import { extractApiError } from '@/lib/errorMessages'
import {
  checkoutSelectionToPaymentMethod,
  isHostedCheckoutGateway,
  isOnlineCheckoutPayment,
  isManualProofPayment,
  validateCheckoutPaymentMethod,
} from '@/lib/checkoutPayment'
import { validateCheckoutFields, scrollToFirstCheckoutField, type CheckoutFieldErrors } from '@/checkout/validateCheckout'
import { useCheckoutConfig } from '@/checkout/config'
import {
  buildCheckoutNotesFromIntent,
  cartHasIntentLine,
  formatBookingCheckoutSummary,
  formatSubscriptionCheckoutSummary,
  peekPendingCheckoutIntent,
} from '@/lib/pendingCheckoutIntent'
import { fulfillPendingCheckoutIntent } from '@/lib/fulfillCheckoutIntent'
import { keepSingleServiceIndexed, keepSingleServiceLines, pruneServerServiceLines } from '@/lib/serviceCart'
import { useGuestCartStore } from '@/stores/guestCartStore'
import { useCartStore } from '@/stores/cartStore'
import type { Address, Cart, Customer, PaymentSelection, PaymentProvider, ShippingMethod } from '@/checkout/types'

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

function isSignInRequiredPreviewError(error: unknown): boolean {
  if (!isAxiosError(error)) return false
  if (error.response?.status === 401) return true
  const detail = error.response?.data?.detail
  return typeof detail === 'string' && /sign in/i.test(detail)
}

export function useStoreBridgeCheckout() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { storePath } = useBranch()
  const { customer, isAuthenticated, setTokens, setCustomer } = useAuthStore()
  const { vendorSlug } = useVendor()
  const { branchCode, isBranchClosed, selectedBranch, branches } = useBranch()
  const { allowGuest } = useCheckoutConfig()
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
  const [payment, setPayment] = useState<PaymentSelection | undefined>(undefined)
  const [notes, setNotes] = useState('')
  const [giftMessage, setGiftMessage] = useState('')
  const [couponCode, setCouponCode] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | undefined>()
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({})
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [processingMessage, setProcessingMessage] = useState<string | null>(null)
  const [serverPreview, setServerPreview] = useState<Awaited<ReturnType<typeof storeApi.checkoutPreview>> | null>(null)
  const [notesPrefillDone, setNotesPrefillDone] = useState(false)

  // Stabilize intent for the session so the banner does not flash in/out on cart refetch.
  const [pendingIntent, setPendingIntent] = useState(
    () => (vendorSlug ? peekPendingCheckoutIntent(vendorSlug) : null),
  )
  useEffect(() => {
    if (!vendorSlug) return
    const next = peekPendingCheckoutIntent(vendorSlug)
    if (next) setPendingIntent(next)
  }, [vendorSlug, cart?.items?.length, cart?.item_count])
  const checkoutIntentKind = pendingIntent?.kind ?? null
  const checkoutIntentSummary = useMemo(() => {
    if (!pendingIntent) return null
    if (pendingIntent.kind === 'subscription') return formatSubscriptionCheckoutSummary(pendingIntent)
    return formatBookingCheckoutSummary(pendingIntent)
  }, [pendingIntent])

  // Drop leftover booking/subscription lines so checkout and the cart badge stay on one service.
  useEffect(() => {
    if (!vendorSlug || !pendingIntent) return
    if (pendingIntent.kind !== 'booking' && pendingIntent.kind !== 'subscription') return
    const items = (cart?.items ?? []) as Array<{
      service_id?: string | null
      product_id?: string | null
      item_type?: string | null
    }>
    if (!items.length) return
    const kept = keepSingleServiceLines(items, pendingIntent)
    if (kept.length === items.length) return
    if (isGuest) {
      const next = keepSingleServiceLines(useGuestCartStore.getState().getItems(vendorSlug), pendingIntent)
      useGuestCartStore.getState().setItems(vendorSlug, next)
      const guestCart = buildGuestCart(next)
      qc.setQueryData(storeKeys.cart, guestCart)
      useCartStore.getState().setCart(guestCart)
      return
    }
    let cancelled = false
    void pruneServerServiceLines(pendingIntent).then((next) => {
      if (cancelled) return
      qc.setQueryData(storeKeys.cart, next)
      useCartStore.getState().setCart(next)
    }).catch(() => { /* checkout can still filter locally */ })
    return () => { cancelled = true }
  }, [vendorSlug, pendingIntent, cart?.items, isGuest, qc])
  const placeOrderLabel = checkoutIntentKind === 'subscription'
    ? 'Subscribe & pay'
    : checkoutIntentKind === 'booking'
      ? 'Confirm booking & pay'
      : 'Place order'

  /** No physical delivery only when every line is a service (booking/subscription alone or service-only cart). */
  const requiresShipping = useMemo(() => {
    const items = (cart?.items ?? []) as Record<string, unknown>[]
    if (!items.length) {
      // Empty cart but booking/subscription intent → no shipping until/unless a product is added
      return !(checkoutIntentKind === 'booking' || checkoutIntentKind === 'subscription')
    }
    return items.some((item) => {
      const itemType = (item.item_type as string | undefined)
        || (item.service_id && !item.product_id ? 'service' : 'product')
      return itemType !== 'service'
    })
  }, [checkoutIntentKind, cart?.items])

  useEffect(() => {
    if (notesPrefillDone || !pendingIntent) return
    setNotes((prev) => (prev.trim() ? prev : buildCheckoutNotesFromIntent(pendingIntent)))
    setNotesPrefillDone(true)
  }, [pendingIntent, notesPrefillDone])

  // Keep contact fields in sync when the logged-in customer profile is available
  useEffect(() => {
    if (!customer || isGuest) return
    setCustomerInfo((prev) => ({
      ...prev,
      email: customer.email ?? prev.email ?? '',
      firstName: customer.full_name?.split(' ')[0] || prev.firstName,
      lastName: customer.full_name?.split(' ').slice(1).join(' ') || prev.lastName,
      phone: customer.phone ?? prev.phone,
      isGuest: false,
    }))
  }, [customer, isGuest])

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

  const checkoutLines = useMemo(() => {
    const items = (cart?.items ?? []) as Array<Record<string, unknown>>
    const restrict = pendingIntent?.kind === 'booking' || pendingIntent?.kind === 'subscription'
    return restrict ? keepSingleServiceIndexed(items, pendingIntent) : items.map((item, index) => ({ item, index }))
  }, [cart?.items, pendingIntent])

  const cartItemsPayload = useMemo(
    () => checkoutLines.map(({ item }) => ({
      product_id: item.product_id ? String(item.product_id) : undefined,
      service_id: item.service_id ? String(item.service_id) : undefined,
      item_type: (item.item_type as string | undefined)
        || (item.service_id && !item.product_id ? 'service' : 'product'),
      variant_id: item.variant_id ? String(item.variant_id) : undefined,
      name: String(item.name ?? ''),
      qty: Number(item.qty),
      price: Number(item.price),
      image_url: item.image_url ? String(item.image_url) : undefined,
    })),
    [checkoutLines],
  )

  const refreshPreview = useCallback(async (options?: { coupon?: string | null; shippingMethodId?: string }) => {
    if (!cartItemsPayload.length) {
      setServerPreview(null)
      setPreviewError(undefined)
      return
    }
    // Guest preview is blocked server-side when sign-in is mandatory — use local totals instead.
    if (isGuest && !allowGuest) {
      setServerPreview(null)
      setPreviewError(undefined)
      return
    }
    const methodId = options?.shippingMethodId ?? shippingMethodId
    const coupon = options?.coupon !== undefined ? options.coupon : couponCode
    const checkoutBranch = selectedBranch ?? pickDefaultOpenBranch(branches)
    const orderBranchCode = checkoutBranch ? branchCodeForStore(checkoutBranch) : branchCode ?? undefined
    const previewBody = {
      shipping_method_id: methodId,
      coupon_code: coupon ?? undefined,
      shipping_state: resolvedAddress?.region,
      store_id: checkoutBranch?.id ?? undefined,
      branch_code: orderBranchCode,
    }

    const applyPreview = (data: Awaited<ReturnType<typeof storeApi.checkoutPreview>>) => {
      setServerPreview(data)
      if (data.shipping_methods?.length && !data.shipping_methods.some(m => m.id === methodId)) {
        setShippingMethodId(data.shipping_methods[0].id)
      }
      const connected = data.connected_payments ?? []
      const codOk = (data.payment_methods ?? []).includes('cod')
      const manualUpi = data.manual_upi ?? null
      const preferUpi = !!peekPendingCheckoutIntent(vendorSlug)
      if (connected.length > 0 || codOk || manualUpi?.enabled) {
        setPayment(prev => {
          if (prev) return prev
          if (preferUpi && manualUpi?.enabled) {
            return { kind: 'tab', tab: 'upi' }
          }
          const razorpay = connected.find(p => p.provider === 'razorpay')
          if (preferUpi && razorpay) {
            return { kind: 'provider', provider: 'razorpay' }
          }
          if (connected.length > 0) {
            return { kind: 'provider', provider: connected[0].provider as PaymentProvider }
          }
          if (manualUpi?.enabled) {
            return { kind: 'tab', tab: 'upi' }
          }
          return { kind: 'tab', tab: 'bnpl' }
        })
      }
    }

    setPreviewLoading(true)
    setPreviewError(undefined)
    try {
      if (isGuest) {
        applyPreview(await storeApi.guestCheckoutPreview({ ...previewBody, items: cartItemsPayload }))
        return
      }
      try {
        applyPreview(await storeApi.checkoutPreview(previewBody))
      } catch (authErr) {
        // Server cart may be empty while local lines exist (booking/subscription seed).
        try {
          applyPreview(await storeApi.guestCheckoutPreview({ ...previewBody, items: cartItemsPayload }))
        } catch (guestErr) {
          if (!isSignInRequiredPreviewError(guestErr) && !isSignInRequiredPreviewError(authErr)) {
            setServerPreview(null)
          }
        }
      }
    } catch {
      setServerPreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }, [cartItemsPayload, shippingMethodId, couponCode, resolvedAddress?.region, isGuest, allowGuest, selectedBranch, branches, branchCode, vendorSlug])

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

  // Prefer server preview; fall back to cart line totals so summary does not jump from ₹0.
  const localSubtotal = useMemo(
    () => checkoutLines.reduce((s, { item }) => s + Number(item.price) * Number(item.qty), 0),
    [checkoutLines],
  )
  const subtotalAmount = Math.round((serverPreview?.subtotal ?? localSubtotal) * 100)
  const shippingAmount = Math.round(
    (requiresShipping ? (serverPreview?.shipping_amount ?? 0) : 0) * 100,
  )
  const taxAmount = Math.round((serverPreview?.tax_amount ?? 0) * 100)
  const discountAmount = Math.round((serverPreview?.discount_amount ?? 0) * 100)
  const totalRupees =
    serverPreview?.total != null
      ? serverPreview.total
      : Math.max(
          0,
          localSubtotal
            + (requiresShipping ? (serverPreview?.shipping_amount ?? 0) : 0)
            + (serverPreview?.tax_amount ?? 0)
            - (serverPreview?.discount_amount ?? 0),
        )
  const totalAmount = Math.round(totalRupees * 100)

  const checkoutCart: Cart = useMemo(() => ({
    id: 'store_cart',
    items: checkoutLines.map(({ item, index }) => {
      const isIntentLine = pendingIntent && (
        (pendingIntent.kind === 'subscription' && (
          (pendingIntent.payload.service_id && String(item.service_id ?? '') === pendingIntent.payload.service_id)
          || (pendingIntent.payload.product_id && String(item.product_id ?? '') === pendingIntent.payload.product_id)
        ))
        || (pendingIntent.kind === 'booking' && String(item.service_id ?? '') === pendingIntent.payload.service_id)
      )
      const intentLabel = isIntentLine ? checkoutIntentSummary : null
      return {
      id: String(index),
      productId: String(item.product_id ?? item.service_id ?? index),
      variantId: item.variant_id ? String(item.variant_id) : undefined,
      name: String(item.name ?? ''),
      variantLabel: intentLabel
        || (item.variant_label ? String(item.variant_label) : undefined),
      imageUrl: item.image_url ? String(item.image_url) : undefined,
      unitPrice: { amount: Math.round(Number(item.price) * 100), currency },
      quantity: Number(item.qty),
      inStock: true,
    }}),
    subtotal: { amount: subtotalAmount, currency },
    shipping: { amount: shippingAmount, currency },
    discounts: discountAmount > 0 && couponCode
      ? [{ code: couponCode, label: couponCode, amount: { amount: discountAmount, currency } }]
      : [],
    taxes: (serverPreview?.tax_lines ?? (taxAmount > 0 ? [{ label: 'GST', amount: taxAmount / 100 }] : [])).map(t => ({
      label: t.label,
      amount: { amount: Math.round((typeof t.amount === 'number' ? t.amount : 0) * 100), currency },
    })),
    total: {
      amount: totalAmount,
      currency,
    },
  }), [checkoutLines, subtotalAmount, shippingAmount, taxAmount, discountAmount, totalAmount, couponCode, serverPreview, currency, pendingIntent, checkoutIntentSummary])

  const prefetchOrderConfirmation = useCallback(async (orderId: string) => {
    setProcessingMessage('Loading order confirmation…')
    try {
      await qc.fetchQuery({
        queryKey: storeKeys.order(orderId),
        queryFn: () => storeApi.getOrder(orderId),
      })
    } catch {
      // Confirmation page will retry; still navigate after payment succeeds.
    }
  }, [qc])

  const completeOnlinePayment = useCallback(async (orderId: string, paymentMethod: string) => {
    const paymentResult = await payOrderWithRazorpay({
      orderId,
      storeName,
      onStage: setProcessingMessage,
    })

    setProcessingMessage('Confirming your payment…')
    await verifyRazorpayOrderPayment(orderId, paymentResult)
    const pending = vendorSlug ? peekPendingCheckoutIntent(vendorSlug) : null
    setProcessingMessage(
      pending?.kind === 'booking' ? 'Confirming your booking…' : 'Activating your subscription…',
    )
    await fulfillPendingCheckoutIntent(vendorSlug, orderId, paymentMethod)
    await prefetchOrderConfirmation(orderId)
    await resetCartAfterOrder(qc, vendorSlug)
    setProcessingMessage(null)
    setIsPlacingOrder(false)
    navigate(storePath(`/order/${orderId}/confirmation`))
  }, [navigate, storePath, storeName, qc, vendorSlug, prefetchOrderConfirmation])

  const setPaymentSelection = useCallback((p: PaymentSelection) => setPayment(p), [])
  const setNotesValue = useCallback((s: string) => setNotes(s), [])
  const setGiftMessageValue = useCallback((s: string) => setGiftMessage(s), [])

  const actions = useMemo(() => ({
    setCustomer: (c: Partial<Customer>) => {
      setCustomerInfo(c)
      clearFieldErrors(['email', 'firstName', 'lastName', 'phone'])
      if (c.phone) {
        setShippingAddressState(prev => prev ? { ...prev, phone: c.phone } : prev)
      }
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

    setShippingMethod: (id: string) => {
      setShippingMethodId(id)
      void refreshPreview({ shippingMethodId: id })
    },
    setPayment: setPaymentSelection,
    setNotes: setNotesValue,
    setGiftMessage: setGiftMessageValue,

    updateQuantity: (id: string, q: number) => {
      const idx = Number(id)
      if (q <= 0) removeItem.mutate(idx)
      else updateItem.mutate({ index: idx, qty: q })
    },
    removeItem: (id: string) => removeItem.mutate(Number(id)),

    applyCoupon: async (code: string): Promise<{ ok: boolean; message?: string }> => {
      try {
        const checkoutBranch = selectedBranch ?? pickDefaultOpenBranch(branches)
        const orderBranchCode = checkoutBranch ? branchCodeForStore(checkoutBranch) : branchCode ?? undefined
        const previewBody = {
          shipping_method_id: shippingMethodId,
          coupon_code: code,
          shipping_state: resolvedAddress?.region,
          store_id: checkoutBranch?.id ?? undefined,
          branch_code: orderBranchCode,
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
      void refreshPreview({ coupon: null })
    },

    placeOrder: async (): Promise<{ ok: boolean; orderId?: string; error?: string; fieldErrors?: CheckoutFieldErrors }> => {
      if (!allowGuest && isGuest) {
        return { ok: false, error: 'Please sign in to place your order.' }
      }
      if (isBranchClosed) {
        return {
          ok: false,
          error: 'This store is currently closed. Please check back later or choose another location.',
        }
      }

      const checkoutBranch = selectedBranch ?? pickDefaultOpenBranch(branches)
      const orderBranchCode = checkoutBranch ? branchCodeForStore(checkoutBranch) : branchCode ?? undefined

      const usingSavedAddress = !isGuest && !!selectedSavedAddressId && !!savedAddresses.length
      const validationErrors = validateCheckoutFields({
        customer: customerInfo,
        shippingAddress: resolvedAddress,
        isGuest,
        usingSavedAddress,
        requirePhone: true,
        requireShippingAddress: requiresShipping,
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

      const connected = serverPreview?.connected_payments ?? []
      const effectivePayment: PaymentSelection | undefined = payment ?? (
        connected.length > 0
          ? { kind: 'provider', provider: connected[0].provider as PaymentProvider }
          : undefined
      )
      const paymentMethod = checkoutSelectionToPaymentMethod(effectivePayment)
      const paymentValidationError = validateCheckoutPaymentMethod(paymentMethod)
      if (paymentValidationError) {
        return { ok: false, error: paymentValidationError }
      }

      const wantsHostedRazorpay =
        effectivePayment?.kind === 'provider' && effectivePayment.provider === 'razorpay'
      const orderPaymentMethod = wantsHostedRazorpay ? 'razorpay' : paymentMethod
      if (wantsHostedRazorpay && totalAmount < 100) {
        return {
          ok: false,
          error: 'Online payment requires a minimum order total of ₹1. Choose Cash on Delivery or contact the store if this service should be free.',
        }
      }
      const checkoutPhone = (
        resolvedAddress?.phone
        || customerInfo.phone
        || customer?.phone
        || ''
      ).trim()
      const shippingPayload = requiresShipping
        ? {
            street_address: resolvedAddress?.line1 ?? '',
            city: resolvedAddress?.city ?? '',
            state: resolvedAddress?.region ?? '',
            postal_code: resolvedAddress?.postalCode ?? '',
            country: resolvedAddress?.country || 'India',
            ...(checkoutPhone ? { phone: checkoutPhone } : {}),
          }
        : {
            street_address: 'N/A',
            city: 'N/A',
            state: 'N/A',
            postal_code: '000000',
            country: 'India',
            ...(checkoutPhone ? { phone: checkoutPhone } : {}),
          }

      if (isGuest) {
        const email = customerInfo.email?.trim()
        const name = [customerInfo.firstName, customerInfo.lastName].filter(Boolean).join(' ').trim()
        if (!email) return { ok: false, error: 'Please enter your email address.' }
        if (!name) return { ok: false, error: 'Please enter your name.' }
        if (!customerInfo.phone?.trim()) {
          return { ok: false, error: 'Please enter your phone number.' }
        }
        if (requiresShipping && !resolvedAddress?.line1) {
          return { ok: false, error: 'Please enter a delivery address.' }
        }
      } else if (requiresShipping && !resolvedAddress) {
        return { ok: false, error: 'Please select a delivery address.' }
      }

      setIsPlacingOrder(true)
      setProcessingMessage('Placing your order…')
      let leavingForConfirmation = false
      try {
        // Ensure subscription/booking line is on the server cart before authenticated checkout.
        const intent = vendorSlug ? peekPendingCheckoutIntent(vendorSlug) : null
        if (!isGuest && intent?.cartItem && !cartHasIntentLine(cart?.items, intent.cartItem)) {
          setProcessingMessage('Preparing your cart…')
          const synced = await storeApi.addToCart({
            product_id: intent.cartItem.product_id,
            service_id: intent.cartItem.service_id,
            item_type: intent.cartItem.item_type,
            variant_id: intent.cartItem.variant_id,
            name: intent.cartItem.name,
            qty: intent.cartItem.qty,
            price: intent.cartItem.price,
            image_url: intent.cartItem.image_url,
          })
          qc.setQueryData(storeKeys.cart, synced)
        }

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
            payment_method: orderPaymentMethod,
            shipping_method_id: shippingMethodId,
            notes: notes || undefined,
            coupon_code: couponCode ?? undefined,
            branch_code: orderBranchCode,
            store_id: checkoutBranch?.id ?? undefined,
          })
          if (result.access_token && result.refresh_token) {
            setTokens({ access_token: result.access_token, refresh_token: result.refresh_token, token_type: 'bearer' })
            if (result.customer) setCustomer(result.customer as any)
            ensureCustomerSessionActive()
          }
          orderId = result.id
        } else {
          const order = await checkoutMutation.mutateAsync({
            shipping_address: shippingPayload,
            payment_method: orderPaymentMethod,
            shipping_method_id: shippingMethodId,
            notes: notes || undefined,
            coupon_code: couponCode ?? undefined,
            branch_code: orderBranchCode,
            store_id: checkoutBranch?.id ?? undefined,
          })
          orderId = order.id
        }

        if (isOnlineCheckoutPayment(orderPaymentMethod, effectivePayment)) {
          try {
            if (isHostedCheckoutGateway(orderPaymentMethod)) {
              if (orderPaymentMethod !== 'razorpay') {
                navigate(storePath(`/order/${orderId}/status`))
                return {
                  ok: false,
                  error: `Order created. Complete payment with ${paymentMethod} on your order page — full checkout for this gateway is coming soon.`,
                  orderId,
                }
              }
              setProcessingMessage('Opening Razorpay secure checkout…')
              await completeOnlinePayment(orderId, orderPaymentMethod)
              leavingForConfirmation = true
              return { ok: true, orderId }
            } else {
              navigate(storePath(`/order/${orderId}/status`))
              return {
                ok: false,
                error: `Order created. Complete payment with ${paymentMethod} on your order page.`,
                orderId,
              }
            }
          } catch (payErr) {
            setIsPlacingOrder(false)
            setProcessingMessage(null)
            const cancelled =
              payErr instanceof Error && payErr.message === 'Payment cancelled'
            if (cancelled) {
              return {
                ok: false,
                error: 'Payment cancelled. Your order was saved — tap Confirm booking & pay again when ready.',
                orderId,
              }
            }
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
        } else if (wantsHostedRazorpay) {
          // Razorpay was selected but payment method did not resolve as online — do not skip the gateway.
          navigate(storePath(`/order/${orderId}/status`))
          return {
            ok: false,
            error: 'Could not open Razorpay checkout. Open your order page to retry payment.',
            orderId,
          }
        } else if (isManualProofPayment(effectivePayment)) {
          // Fulfill after UPI proof is submitted (see UpiPaymentProofPage)
          leavingForConfirmation = true
          navigate(storePath(`/order/${orderId}/payment`))
          return { ok: true, orderId }
        } else {
          // COD / offline — activate subscription/booking with the order
          setProcessingMessage(
            intent?.kind === 'subscription'
              ? 'Activating your subscription…'
              : intent?.kind === 'booking'
                ? 'Confirming your booking…'
                : 'Confirming your order…',
          )
          await fulfillPendingCheckoutIntent(vendorSlug, orderId, orderPaymentMethod)
          await prefetchOrderConfirmation(orderId)
          await resetCartAfterOrder(qc, vendorSlug)
          leavingForConfirmation = true
          navigate(storePath(`/order/${orderId}/confirmation`))
        }
        leavingForConfirmation = true
        return { ok: true, orderId }
      } catch (err) {
        return {
          ok: false,
          error: extractApiError(err, 'Order placement failed. Please check your details and try again.'),
        }
      } finally {
        if (!leavingForConfirmation) {
          setIsPlacingOrder(false)
          setProcessingMessage(null)
        }
      }
    },
  }), [
    resolvedAddress, payment, notes, couponCode, shippingMethodId,
    checkoutMutation, navigate, storePath, removeItem, updateItem,
    completeOnlinePayment, refreshPreview, isGuest, customerInfo,
    cartItemsPayload, cart?.items, setTokens, setCustomer, vendorSlug, qc,
    branchCode, isBranchClosed, branches, clearFieldErrors, selectedSavedAddressId, savedAddresses, isPlacingOrder,
    setPaymentSelection, setNotesValue, setGiftMessageValue, customer?.phone, requiresShipping,
    totalAmount, serverPreview,
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
      processingMessage,
      previewLoading,
      error: previewError,
      fieldErrors,
      isBranchClosed,
      connectedPayments: serverPreview?.connected_payments ?? [],
      codEnabled: (serverPreview?.payment_methods ?? []).includes('cod'),
      manualUpi: serverPreview?.manual_upi ?? null,
      checkoutIntentKind,
      checkoutIntentSummary,
      placeOrderLabel,
      requiresShipping,
    },
    actions,
  }
}
