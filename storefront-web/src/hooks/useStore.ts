import { useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { storeApi } from '@/api/store'
import { useAuthStore } from '@/stores/authStore'
import { useCartStore } from '@/stores/cartStore'
import { useGuestCartStore, type GuestCartItem } from '@/stores/guestCartStore'
import { useVendor } from '@/contexts/VendorContext'
import { apiError, extractApiError } from '@/lib/errorMessages'
import type { Cart, Product } from '@/types'

export const storeKeys = {
  info: ['store-info'] as const,
  categories: (p?: Record<string, unknown>) => ['store-categories', p] as const,
  products: (p?: Record<string, unknown>) => ['products', p] as const,
  product: (slug: string) => ['product', slug] as const,
  services: (p?: Record<string, unknown>) => ['services', p] as const,
  service: (slug: string) => ['service', slug] as const,
  cart: ['cart'] as const,
  orders: (p?: Record<string, unknown>) => ['orders', p] as const,
  order: (id: string) => ['order', id] as const,
  me: ['customer-me'] as const,
  productReviews: (id: string, p?: Record<string, unknown>) => ['product-reviews', id, p] as const,
  serviceReviews: (id: string, p?: Record<string, unknown>) => ['service-reviews', id, p] as const,
  blogs: (p?: Record<string, unknown>) => ['blog-posts', p] as const,
  blog: (slug: string) => ['blog-post', slug] as const,
  notificationStats: ['store-notification-stats'] as const,
  notifications: (p?: { limit?: number; unread_only?: boolean }) => ['store-notifications', p] as const,
  wishlist: ['wishlist'] as const,
  subscriptions: ['subscriptions'] as const,
  marketplaceLeads: ['marketplace-leads'] as const,
  rentalAssets: ['store-rentals'] as const,
}

const EMPTY_GUEST_CART_ITEMS: GuestCartItem[] = []

export function buildGuestCart(items: GuestCartItem[]): Cart {
  const list = items ?? []
  const subtotal = list.reduce((s, i) => s + i.price * i.qty, 0)
  return {
    id: 'guest_cart',
    vendor_id: '',
    customer_id: '',
    items: list,
    item_count: list.reduce((s, i) => s + i.qty, 0),
    subtotal,
    coupon_code: null,
    discount_amount: 0,
  } as Cart
}

export function useStoreInfo() {
  return useQuery({ queryKey: storeKeys.info, queryFn: storeApi.getStoreInfo, staleTime: 10 * 60 * 1000, retry: false })
}

export function useStoreCategories(params?: Record<string, unknown>) {
  return useQuery({ queryKey: storeKeys.categories(params), queryFn: () => storeApi.listCategories(params), staleTime: 5 * 60 * 1000 })
}

export function useProducts(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: storeKeys.products(params),
    queryFn: () => storeApi.listProducts(params),
    placeholderData: (previous) => previous,
  })
}

export function useProduct(slug: string) {
  return useQuery({ queryKey: storeKeys.product(slug), queryFn: () => storeApi.getProduct(slug), enabled: !!slug })
}

export function useServices(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: storeKeys.services(params),
    queryFn: () => storeApi.listServices(params),
    placeholderData: (previous) => previous,
  })
}

export function useService(slug: string) {
  return useQuery({ queryKey: storeKeys.service(slug), queryFn: () => storeApi.getService(slug), enabled: !!slug })
}

function syncCartStore(cart: Cart) {
  useCartStore.getState().setCart(cart)
}

function applyCartMutation(qc: QueryClient, cart: Cart) {
  syncCartStore(cart)
  qc.setQueryData(storeKeys.cart, cart)
}

function emptyCart(): Cart {
  return buildGuestCart(EMPTY_GUEST_CART_ITEMS)
}

/** Clears guest + zustand cart and server cart after checkout. */
export async function resetCartAfterOrder(qc: QueryClient, vendorSlug?: string) {
  if (vendorSlug) {
    useGuestCartStore.getState().clear(vendorSlug)
  }

  await qc.cancelQueries({ queryKey: storeKeys.cart })

  let cleared = emptyCart()
  if (useAuthStore.getState().isAuthenticated) {
    try {
      cleared = await storeApi.clearCart()
    } catch {
      // Keep local empty cart when server clear is unavailable.
    }
  }

  syncCartStore(cleared)
  qc.setQueryData(storeKeys.cart, cleared)
  void qc.invalidateQueries({
    predicate: (q) => {
      const key = q.queryKey[0]
      return key === 'products' || key === 'services' || key === 'product'
    },
  })
}

// Cart
export function useCart() {
  const { isAuthenticated } = useAuthStore()
  const { vendorSlug } = useVendor()
  const guestItems = useGuestCartStore(s => s.byVendor[vendorSlug] ?? EMPTY_GUEST_CART_ITEMS)
  const guestCart = useMemo(() => buildGuestCart(guestItems), [guestItems])

  useEffect(() => {
    if (!isAuthenticated) {
      syncCartStore(guestCart)
    }
  }, [isAuthenticated, guestCart])

  const server = useQuery({
    queryKey: storeKeys.cart,
    queryFn: async () => {
      const cart = await storeApi.getCart()
      syncCartStore(cart)
      return cart
    },
    enabled: isAuthenticated,
  })

  const cartFromStore = useCartStore((s) => s.cart)

  if (!isAuthenticated) {
    return {
      ...server,
      data: guestCart,
      isLoading: false,
      isFetching: false,
      isFetched: true,
      isSuccess: true,
      status: 'success' as const,
    }
  }
  return {
    ...server,
    data: cartFromStore ?? server.data,
  }
}

export function useAddToCart() {
  const qc = useQueryClient()
  const { vendorSlug } = useVendor()
  return useMutation({
    mutationFn: async (item: GuestCartItem) => {
      if (!useAuthStore.getState().isAuthenticated) {
        useGuestCartStore.getState().addItem(vendorSlug, item)
        return buildGuestCart(useGuestCartStore.getState().getItems(vendorSlug))
      }
      const { variant_label: _vl, slug: _slug, ...apiItem } = item
      return storeApi.addToCart(apiItem)
    },
    onSuccess: (cart) => {
      applyCartMutation(qc, cart)
    },
    onError: apiError('Could not add item to cart — it may be out of stock'),
  })
}

export function useCartProducts(cartItems: Array<{ product_id?: string; slug?: string }>) {
  const uniqueEntries = useMemo(() => {
    const map = new Map<string, string | undefined>()
    for (const item of cartItems) {
      const id = item.product_id ? String(item.product_id) : ''
      if (!id) continue
      map.set(id, item.slug ?? map.get(id))
    }
    return [...map.entries()]
  }, [cartItems])

  return useQuery({
    queryKey: ['cart-products', uniqueEntries.map(([id, slug]) => `${id}:${slug ?? ''}`).sort().join(',')],
    queryFn: async () => {
      const result: Record<string, Product> = {}
      if (uniqueEntries.length === 0) return result

      const missingIds: string[] = []
      await Promise.all(
        uniqueEntries.map(async ([id, slug]) => {
          if (slug) {
            try {
              result[id] = await storeApi.getProduct(slug)
              return
            } catch {
              /* fall back to catalog list */
            }
          }
          missingIds.push(id)
        }),
      )

      if (missingIds.length > 0) {
        let page = 1
        let pages = 1
        while (page <= pages && missingIds.some((id) => !result[id])) {
          const res = await storeApi.listProducts({ page, size: 100 })
          pages = res.pages || 1
          for (const product of res.items) {
            if (missingIds.includes(product.id)) result[product.id] = product
          }
          page += 1
        }
      }

      return result
    },
    enabled: uniqueEntries.length > 0,
    staleTime: 60_000,
  })
}

export function useChangeCartVariant() {
  const qc = useQueryClient()
  const { vendorSlug } = useVendor()
  return useMutation({
    mutationFn: async ({ index, item }: { index: number; item: GuestCartItem }) => {
      if (!useAuthStore.getState().isAuthenticated) {
        const store = useGuestCartStore.getState()
        const items = [...store.getItems(vendorSlug)]
        const current = items[index]
        if (!current) throw new Error('Cart item not found')
        const mergeIdx = items.findIndex(
          (i, idx) =>
            idx !== index &&
            i.product_id === item.product_id &&
            i.variant_id === item.variant_id,
        )
        if (mergeIdx >= 0) {
          items[mergeIdx] = {
            ...items[mergeIdx],
            qty: items[mergeIdx].qty + current.qty,
            price: item.price,
          }
          items.splice(index, 1)
        } else {
          items[index] = { ...current, ...item }
        }
        useGuestCartStore.setState((state) => ({
          byVendor: { ...state.byVendor, [vendorSlug]: items },
        }))
        return buildGuestCart(items)
      }
      const cart = qc.getQueryData<Cart>(storeKeys.cart) ?? useCartStore.getState().cart
      const current = cart?.items?.[index]
      if (!current) throw new Error('Cart item not found')
      const qty = current.qty
      const { variant_label: _vl, slug: _slug, ...apiItem } = item
      await storeApi.removeCartItem(index)
      return storeApi.addToCart({ ...apiItem, qty })
    },
    onSuccess: (cart) => {
      applyCartMutation(qc, cart)
    },
    onError: apiError('Could not update product option'),
  })
}

export function useUpdateCartItem() {
  const qc = useQueryClient()
  const { vendorSlug } = useVendor()
  return useMutation({
    mutationFn: async ({ index, qty }: { index: number; qty: number }) => {
      if (!useAuthStore.getState().isAuthenticated) {
        const items = useGuestCartStore.getState().getItems(vendorSlug)
        if (index < 0 || index >= items.length) {
          throw new Error('Cart item not found')
        }
        return buildGuestCart(items)
      }
      return storeApi.updateCartItem(index, qty)
    },
    onMutate: async ({ index, qty }) => {
      await qc.cancelQueries({ queryKey: storeKeys.cart })

      if (!useAuthStore.getState().isAuthenticated) {
        const store = useGuestCartStore.getState()
        const before = store.getItems(vendorSlug)
        if (index < 0 || index >= before.length) return {}
        const snap = before.map((i) => ({ ...i }))
        store.updateQty(vendorSlug, index, qty)
        applyCartMutation(qc, buildGuestCart(store.getItems(vendorSlug)))
        return { guestSnap: snap, vendorSlug }
      }

      const previous = qc.getQueryData<Cart>(storeKeys.cart) ?? useCartStore.getState().cart ?? null
      if (previous?.items && index >= 0 && index < previous.items.length) {
        const items = previous.items.map((item, i) =>
          i === index ? { ...item, qty } : item,
        )
        applyCartMutation(qc, { ...previous, items } as Cart)
      }
      return { previous }
    },
    onSuccess: (cart) => {
      applyCartMutation(qc, cart)
    },
    onError: (err, _vars, context) => {
      if (context?.guestSnap && context.vendorSlug) {
        useGuestCartStore.setState((state) => ({
          byVendor: { ...state.byVendor, [context.vendorSlug]: context.guestSnap },
        }))
        applyCartMutation(qc, buildGuestCart(context.guestSnap))
      } else if (context?.previous) {
        applyCartMutation(qc, context.previous)
      }
      apiError('Could not update cart quantity')(err)
    },
  })
}

export function useRemoveCartItem() {
  const qc = useQueryClient()
  const { vendorSlug } = useVendor()
  return useMutation({
    mutationFn: async (index: number) => {
      if (!useAuthStore.getState().isAuthenticated) {
        const store = useGuestCartStore.getState()
        if (index < 0 || index >= store.getItems(vendorSlug).length) {
          throw new Error('Cart item not found')
        }
        store.removeItem(vendorSlug, index)
        return buildGuestCart(store.getItems(vendorSlug))
      }
      return storeApi.removeCartItem(index)
    },
    onSuccess: (cart) => {
      applyCartMutation(qc, cart)
      toast.success('Item removed')
    },
    onError: apiError('Could not remove item from cart'),
  })
}

// Orders
export function useCheckout() {
  return useMutation({
    mutationFn: storeApi.checkout,
  })
}

export function useRequestQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      service_id?: string; service_name?: string
      product_id?: string; product_name?: string
      item_type?: 'service' | 'product'
      form_data?: Record<string, string>
      message?: string; preferred_date?: string; preferred_time?: string
    }) => storeApi.requestQuote(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      toast.success('Quote request submitted! The vendor will respond shortly.')
    },
    onError: apiError('Could not submit quote request — please check your details and try again'),
  })
}

export function useOrders(params?: Record<string, unknown>) {
  return useQuery({ queryKey: storeKeys.orders(params), queryFn: () => storeApi.listOrders(params) })
}

export function useOrder(id: string) {
  return useQuery({ queryKey: storeKeys.order(id), queryFn: () => storeApi.getOrder(id), enabled: !!id })
}

export function useCancelOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { id: string; reason: string; attachments?: { url: string; kind: 'image' | 'video' }[] }) =>
      storeApi.cancelOrder(payload.id, { reason: payload.reason, attachments: payload.attachments }),
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: storeKeys.order(order.id) })
      toast.success('Order cancelled')
    },
    onError: apiError('Could not cancel order — it may already be shipped or processed'),
  })
}

export function useRequestReturn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      id: string
      return_type: 'return' | 'exchange'
      reason: string
      attachments?: { url: string; kind: 'image' | 'video' }[]
    }) => storeApi.requestReturn(payload.id, payload),
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: storeKeys.order(order.id) })
      toast.success('Request submitted successfully')
    },
    onError: apiError('Could not submit return/exchange request — the order may not be eligible for returns'),
  })
}

export function useOrderInvoice(orderId: string) {
  return useQuery({
    queryKey: ['order-invoice', orderId],
    queryFn: () => storeApi.getOrderInvoice(orderId),
    enabled: !!orderId,
    retry: false,
  })
}

export function useStoreNotificationStats() {
  const { isAuthenticated } = useAuthStore()
  return useQuery({
    queryKey: storeKeys.notificationStats,
    queryFn: storeApi.getNotificationStats,
    enabled: isAuthenticated,
    refetchInterval: 30_000,
    retry: 1,
  })
}

export function useStoreNotificationsPreview(limit = 8) {
  const { isAuthenticated } = useAuthStore()
  return useQuery({
    queryKey: storeKeys.notifications({ limit, unread_only: false }),
    queryFn: () => storeApi.listNotifications({ limit }),
    enabled: isAuthenticated,
    staleTime: 15_000,
  })
}

// Auth
export function useCustomerMe() {
  const { setCustomer, accessToken } = useAuthStore()
  return useQuery({
    queryKey: storeKeys.me,
    queryFn: async () => { const c = await storeApi.getMe(); setCustomer(c); return c },
    enabled: !!accessToken,
    retry: false,
  })
}

export function useCustomerLogin() {
  const qc = useQueryClient()
  const { setTokens, setCustomer } = useAuthStore()
  return useMutation({
    mutationFn: ({ login, password }: { login: string; password: string }) => storeApi.login(login, password),
    onSuccess: async (tokens) => {
      setTokens(tokens)
      // Immediately fetch and set customer profile so UI updates
      try {
        const customer = await storeApi.getMe()
        setCustomer(customer)
        qc.setQueryData(storeKeys.me, customer)
      } catch {
        // will be re-fetched by useCustomerMe in layout
      }
      qc.invalidateQueries({ queryKey: storeKeys.me })
      toast.success('Welcome!')
      // Navigation handled by the calling component using vendor context
    },
    onError: apiError('Login failed — invalid email/phone or password'),
  })
}

export function useCustomerRegister() {
  return useMutation({
    mutationFn: (data: { full_name: string; email?: string; password: string; phone?: string }) => storeApi.register(data),
    onSuccess: () => { toast.success('Account created!') },
    onError: apiError('Registration failed — this email or phone may already be registered'),
  })
}

// Reviews
export function useProductReviews(productId: string, params?: Record<string, unknown>) {
  return useQuery({
    queryKey: storeKeys.productReviews(productId, params),
    queryFn: () => storeApi.getProductReviews(productId, params),
    enabled: !!productId,
  })
}

export function useServiceReviews(serviceId: string, params?: Record<string, unknown>) {
  return useQuery({
    queryKey: storeKeys.serviceReviews(serviceId, params),
    queryFn: () => storeApi.getServiceReviews(serviceId, params),
    enabled: !!serviceId,
  })
}

export function useSubmitReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: storeApi.submitReview,
    onSuccess: (_data, variables) => {
      if (variables.product_id) {
        qc.invalidateQueries({ queryKey: ['product-reviews', variables.product_id] })
        qc.invalidateQueries({ queryKey: ['product'] })
      }
      if (variables.service_id) {
        qc.invalidateQueries({ queryKey: ['service-reviews', variables.service_id] })
        qc.invalidateQueries({ queryKey: ['service'] })
      }
      toast.success('Review submitted! Thank you for your feedback.')
    },
    onError: apiError('Could not submit review — you may have already reviewed this item'),
  })
}

// ── Bookings ────────────────────────────────────────────────────

export function useBookings(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['bookings', params],
    queryFn: () => storeApi.listBookings(params),
  })
}

export function useBooking(id: string) {
  return useQuery({
    queryKey: ['booking', id],
    queryFn: () => storeApi.getBooking(id),
    enabled: !!id,
  })
}

export function useBookingSlots(serviceId: string | undefined, bookingDate: string | undefined, planId?: string) {
  return useQuery({
    queryKey: ['booking-slots', serviceId, bookingDate, planId],
    queryFn: () => storeApi.getBookingSlots(serviceId!, bookingDate!, planId),
    enabled: !!serviceId && !!bookingDate,
    staleTime: 60_000,
  })
}

export function useCreateBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      service_id: string; plan_id?: string; booking_date: string; start_time?: string
      notes?: string; payment_method?: string
    }) => storeApi.createBooking(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] })
      toast.success('Booking confirmed! You will be notified once the vendor confirms.')
    },
    onError: apiError('Could not create booking — the selected date/time may be unavailable'),
  })
}

export function useCancelBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => storeApi.cancelBooking(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] })
      toast.success('Booking cancelled')
    },
    onError: apiError('Could not cancel booking — it may already be completed or too close to the appointment time'),
  })
}

export function useCustomerLogout() {
  const qc = useQueryClient()
  const { logout } = useAuthStore()
  return () => {
    logout()
    // NOTE: Do NOT remove vendor_id / vendor_slug — the user stays on the same vendor business front
    qc.clear()
    toast.success('Logged out')
    // Navigation is handled by the calling component
  }
}

function mapWishlistItems(raw: { items?: Array<Record<string, unknown>> }) {
  return (raw.items ?? []).map((i) => ({
    id: String(i.product_id),
    slug: String(i.slug || i.product_id),
    name: String(i.name || ''),
    price: Number(i.price || 0),
    image: String(i.image_url || ''),
    savedAt: String(i.saved_at || new Date().toISOString()),
  }))
}

export function useWishlist() {
  const { isAuthenticated } = useAuthStore()
  return useQuery({
    queryKey: storeKeys.wishlist,
    queryFn: async () => mapWishlistItems(await storeApi.getWishlist()),
    enabled: isAuthenticated,
  })
}

export function useToggleWishlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: storeApi.toggleWishlistItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: storeKeys.wishlist }),
    onError: apiError('Could not update wishlist'),
  })
}

export function useRemoveWishlistItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: storeApi.removeWishlistItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: storeKeys.wishlist }),
    onError: apiError('Could not remove from wishlist'),
  })
}

export function useSyncWishlistOnLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (localItems: Array<Record<string, unknown>>) => {
      const synced = await storeApi.syncWishlist(localItems)
      return mapWishlistItems(synced)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: storeKeys.wishlist }),
  })
}

export function useSubscriptions() {
  const { isAuthenticated } = useAuthStore()
  return useQuery({
    queryKey: storeKeys.subscriptions,
    queryFn: storeApi.listSubscriptions,
    enabled: isAuthenticated,
  })
}

export function useCreateSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: storeApi.createSubscription,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: storeKeys.subscriptions })
      toast.success('Subscription started')
    },
    onError: apiError('Could not start subscription'),
  })
}

export function useUpdateSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'paused' | 'active' | 'cancelled' }) =>
      storeApi.updateSubscription(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: storeKeys.subscriptions })
      toast.success('Subscription updated')
    },
    onError: apiError('Could not update subscription'),
  })
}

export function useMarketplaceLeads() {
  const { isAuthenticated } = useAuthStore()
  return useQuery({
    queryKey: storeKeys.marketplaceLeads,
    queryFn: storeApi.listMarketplaceLeads,
    enabled: isAuthenticated,
  })
}

export function useCreateMarketplaceLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: storeApi.createMarketplaceLead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: storeKeys.marketplaceLeads })
      toast.success('Requirement posted')
    },
    onError: apiError('Could not post requirement'),
  })
}

export function useAcceptMarketplaceQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ leadId, quoteId }: { leadId: string; quoteId: string }) =>
      storeApi.acceptMarketplaceQuote(leadId, quoteId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: storeKeys.marketplaceLeads })
      const orderNumber = (data as Record<string, unknown>)?.order_number
      toast.success(orderNumber ? `Quote accepted — order ${orderNumber} created` : 'Quote accepted')
    },
    onError: apiError('Could not accept quote'),
  })
}

export function useBlogPosts(params?: {
  page?: number
  size?: number
  category?: string
  tag?: string
}) {
  return useQuery({
    queryKey: storeKeys.blogs(params as Record<string, unknown>),
    queryFn: () => storeApi.listBlogPosts(params),
    staleTime: 2 * 60 * 1000,
    retry: false,
  })
}

export function useBlogPost(slug: string) {
  return useQuery({
    queryKey: storeKeys.blog(slug),
    queryFn: () => storeApi.getBlogPost(slug),
    enabled: !!slug,
    staleTime: 2 * 60 * 1000,
    retry: false,
  })
}
