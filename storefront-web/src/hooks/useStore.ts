import { useCallback, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { storeApi } from '@/api/store'
import { useAuthStore } from '@/stores/authStore'
import { useCartStore } from '@/stores/cartStore'
import { useGuestCartStore, type GuestCartItem } from '@/stores/guestCartStore'
import { useVendor } from '@/contexts/VendorContext'
import { apiError, extractApiError, formatCustomerAuthError } from '@/lib/errorMessages'
import { clearPendingBuyNow, peekPendingBuyNow } from '@/lib/pendingBuyNow'
import { readScopedCustomerTokens } from '@/lib/customerAuthStorage'
import { getCartQtyForVariant } from '@/lib/stockValidation'
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

export type RemoveCartItemInput =
  | number
  | { productId?: string; serviceId?: string; variantId?: string }

type CartLineRef = {
  product_id?: string
  service_id?: string
  variant_id?: string | null
  productId?: string
  serviceId?: string
  variantId?: string | null
  item_type?: string
}

function lineProductId(line: CartLineRef): string {
  return String(line.product_id ?? line.productId ?? '')
}

function lineServiceId(line: CartLineRef): string {
  return String(line.service_id ?? line.serviceId ?? '')
}

function lineVariantId(line: CartLineRef): string {
  return String(line.variant_id ?? line.variantId ?? '')
}

export function resolveCartLineIndex(
  items: CartLineRef[] | undefined,
  input: RemoveCartItemInput,
): number {
  if (!items?.length) return -1
  if (typeof input === 'number') {
    return input >= 0 && input < items.length ? input : -1
  }
  const productId = String(input.productId ?? '')
  const serviceId = String(input.serviceId ?? '')
  const variantId = String(input.variantId ?? '')

  // Service / booking / subscription lines (no product_id)
  if (serviceId && !productId) {
    return items.findIndex((line) => lineServiceId(line) === serviceId && !lineProductId(line))
  }

  if (productId) {
    const exact = items.findIndex(
      (line) => lineProductId(line) === productId && lineVariantId(line) === variantId,
    )
    if (exact >= 0) return exact
  }

  // Fallback: UI sometimes uses service_id as productId for display
  if (productId) {
    const asService = items.findIndex(
      (line) => !lineProductId(line) && lineServiceId(line) === productId,
    )
    if (asService >= 0) return asService
  }

  return -1
}

export function useStoreInfo() {
  const { vendorSlug } = useVendor()
  return useQuery({
    queryKey: [...storeKeys.info, vendorSlug],
    queryFn: storeApi.getStoreInfo,
    staleTime: 10 * 60 * 1000,
    retry: false,
    enabled: !!vendorSlug,
  })
}

export function useStoreCategories(params?: Record<string, unknown>) {
  const { vendorSlug } = useVendor()
  return useQuery({
    queryKey: [...storeKeys.categories(params), vendorSlug],
    queryFn: () => storeApi.listCategories(params),
    staleTime: 5 * 60 * 1000,
    enabled: !!vendorSlug,
  })
}

export function useProducts(params?: Record<string, unknown>) {
  const { vendorSlug } = useVendor()
  return useQuery({
    queryKey: [...storeKeys.products(params), vendorSlug],
    queryFn: () => storeApi.listProducts(params),
    enabled: !!vendorSlug,
    // Do not keep previous vendor's products while switching /store/:slug in the same tab.
  })
}

export function useProduct(slug: string) {
  const { vendorSlug } = useVendor()
  return useQuery({
    queryKey: [...storeKeys.product(slug), vendorSlug],
    queryFn: () => storeApi.getProduct(slug),
    enabled: !!slug && !!vendorSlug,
  })
}

export function useServices(params?: Record<string, unknown>) {
  const { vendorSlug } = useVendor()
  return useQuery({
    queryKey: [...storeKeys.services(params), vendorSlug],
    queryFn: () => storeApi.listServices(params),
    enabled: !!vendorSlug,
  })
}

export function useService(slug: string) {
  const { vendorSlug } = useVendor()
  return useQuery({
    queryKey: [...storeKeys.service(slug), vendorSlug],
    queryFn: () => storeApi.getService(slug),
    enabled: !!slug && !!vendorSlug,
  })
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
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
    placeholderData: (previous) => previous ?? useCartStore.getState().cart ?? undefined,
  })

  const cartFromStore = useCartStore((s) => s.cart)

  const resolvedCart = useMemo(() => {
    if (!isAuthenticated) return guestCart
    // Prefer a locally seeded cart (e.g. subscription line) over an empty server refetch
    const cached = cartFromStore ?? server.data
    const cachedCount = cached?.items?.length ?? 0
    const serverCount = server.data?.items?.length ?? 0
    if (cachedCount > 0 && serverCount === 0 && server.isFetched) {
      return cached
    }
    if (server.isFetched && server.data !== undefined && serverCount > 0) return server.data
    return cached ?? server.data
  }, [isAuthenticated, guestCart, server.isFetched, server.data, cartFromStore])

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
  const hasCachedItems = (resolvedCart?.items?.length ?? 0) > 0
  return {
    ...server,
    data: resolvedCart,
    // Keep checkout usable when add-to-cart already hydrated the local cart.
    isLoading: server.isLoading && !hasCachedItems,
  }
}

function cartItemsToStockLines(cart: Cart | null | undefined) {
  return (cart?.items ?? []).map((item) => ({
    product_id: String(item.product_id),
    variant_id: item.variant_id ? String(item.variant_id) : undefined,
    qty: Number(item.qty),
  }))
}

/** Total quantity in cart for a product (all variants combined). */
export function useCartProductQty(productId?: string | null): number {
  const { data: cart } = useCart()
  return useMemo(() => {
    if (!productId) return 0
    return cartItemsToStockLines(cart).reduce((sum, line) => {
      return line.product_id === String(productId) ? sum + line.qty : sum
    }, 0)
  }, [cart, productId])
}

/** Quantity in cart for a specific product + variant selection. */
export function useCartVariantQty(productId?: string | null, variantId?: string | null): number {
  const { data: cart } = useCart()
  return useMemo(() => {
    if (!productId) return 0
    return getCartQtyForVariant(
      cartItemsToStockLines(cart),
      String(productId),
      variantId ? String(variantId) : undefined,
    )
  }, [cart, productId, variantId])
}

/** Map of product_id → total qty for efficient grid rendering. */
export function useCartProductQtyMap(): Map<string, number> {
  const { data: cart } = useCart()
  return useMemo(() => {
    const map = new Map<string, number>()
    for (const item of cart?.items ?? []) {
      const pid = String(item.product_id)
      map.set(pid, (map.get(pid) ?? 0) + Number(item.qty))
    }
    return map
  }, [cart])
}

function hasActiveCustomerSession(): boolean {
  const { isAuthenticated, accessToken } = useAuthStore.getState()
  if (isAuthenticated && accessToken) return true
  const { access } = readScopedCustomerTokens()
  if (access) {
    useAuthStore.setState({
      accessToken: access,
      isAuthenticated: true,
      customer: useAuthStore.getState().customer,
    })
    return true
  }
  return !!isAuthenticated
}

export function useAddToCart() {
  const qc = useQueryClient()
  const { vendorSlug } = useVendor()
  return useMutation({
    mutationFn: async (item: GuestCartItem) => {
      if (!hasActiveCustomerSession()) {
        useGuestCartStore.getState().addItem(vendorSlug, item)
        return buildGuestCart(useGuestCartStore.getState().getItems(vendorSlug))
      }
      return storeApi.addToCart({
        product_id: item.product_id,
        service_id: item.service_id,
        item_type: item.item_type,
        variant_id: item.variant_id,
        name: item.name,
        qty: item.qty,
        price: item.price,
        image_url: item.image_url,
      })
    },
    onSuccess: (cart) => {
      applyCartMutation(qc, cart)
      if (vendorSlug) {
        const pending = peekPendingBuyNow(vendorSlug)
        if (pending) clearPendingBuyNow()
      }
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
        if (
          current.product_id === item.product_id
          && String(current.variant_id ?? '') === String(item.variant_id ?? '')
        ) {
          return buildGuestCart(items)
        }
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
      if (
        String(current.product_id) === String(item.product_id)
        && String(current.variant_id ?? '') === String(item.variant_id ?? '')
      ) {
        return cart as Cart
      }
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

/** Resolve cart line for catalog cards (prefer exact variant, else first product line). */
export function findCatalogCartLineIndex(
  items: CartLineRef[] | undefined,
  productId: string,
  variantId?: string | null,
): number {
  if (!items?.length || !productId) return -1
  if (variantId) {
    return resolveCartLineIndex(items, { productId, variantId })
  }
  const exact = resolveCartLineIndex(items, { productId })
  if (exact >= 0) return exact
  return items.findIndex((line) => lineProductId(line) === String(productId))
}

/**
 * Set absolute qty for a catalog product/variant line.
 * qty <= 0 removes the line; missing line adds via `addItem`.
 */
export function useSetCatalogCartQty() {
  const qc = useQueryClient()
  const { vendorSlug } = useVendor()
  const addToCart = useAddToCart()
  const updateItem = useUpdateCartItem()
  const removeItem = useRemoveCartItem()

  const setQty = useCallback(
    async (input: {
      productId: string
      variantId?: string
      qty: number
      addItem?: GuestCartItem
    }) => {
      const productId = String(input.productId)
      const variantId = input.variantId ? String(input.variantId) : undefined
      const isAuth = useAuthStore.getState().isAuthenticated
      const items = isAuth
        ? ((qc.getQueryData<Cart>(storeKeys.cart) ?? useCartStore.getState().cart)?.items as CartLineRef[] | undefined)
        : useGuestCartStore.getState().getItems(vendorSlug)
      const index = findCatalogCartLineIndex(items, productId, variantId)

      if (input.qty <= 0) {
        if (index < 0) return
        // Use index so fallback product-line matches still remove correctly.
        await removeItem.mutateAsync(index)
        return
      }

      if (index < 0) {
        if (!input.addItem) throw new Error('Cart item not found')
        await addToCart.mutateAsync({ ...input.addItem, qty: input.qty })
        return
      }

      await updateItem.mutateAsync({ index, qty: input.qty })
    },
    [qc, vendorSlug, addToCart, updateItem, removeItem],
  )

  return {
    setQty,
    isPending: addToCart.isPending || updateItem.isPending || removeItem.isPending,
  }
}

export function useRemoveCartItem() {
  const qc = useQueryClient()
  const { vendorSlug } = useVendor()
  return useMutation({
    mutationFn: async (input: RemoveCartItemInput) => {
      const isAuth = useAuthStore.getState().isAuthenticated
      if (!isAuth) {
        // Guest line is removed in onMutate; confirm current cart for onSuccess.
        return buildGuestCart(useGuestCartStore.getState().getItems(vendorSlug))
      }

      // Do not trust the React Query cache here: onMutate already dropped the line
      // for optimistic UI. Resolve against the server cart.
      const fresh = await storeApi.getCart()
      const index = resolveCartLineIndex(fresh.items as CartLineRef[] | undefined, input)
      if (index < 0) throw new Error('Cart item not found')
      return storeApi.removeCartItem(index)
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: storeKeys.cart })

      if (!useAuthStore.getState().isAuthenticated) {
        const store = useGuestCartStore.getState()
        const before = store.getItems(vendorSlug)
        const index = resolveCartLineIndex(before, input)
        if (index < 0) throw new Error('Cart item not found')
        const snap = before.map((i) => ({ ...i }))
        store.removeItem(vendorSlug, index)
        applyCartMutation(qc, buildGuestCart(store.getItems(vendorSlug)))
        return { guestSnap: snap, vendorSlug }
      }

      const previous = qc.getQueryData<Cart>(storeKeys.cart) ?? useCartStore.getState().cart ?? null
      const index = resolveCartLineIndex(previous?.items as CartLineRef[] | undefined, input)
      if (previous?.items && index >= 0) {
        const items = previous.items.filter((_, i) => i !== index)
        applyCartMutation(qc, { ...previous, items } as Cart)
      }
      return { previous }
    },
    onSuccess: (cart) => {
      applyCartMutation(qc, cart)
      toast.success('Item removed')
    },
    onError: (err, _input, context) => {
      if (context?.guestSnap && context.vendorSlug) {
        useGuestCartStore.setState((state) => ({
          byVendor: { ...state.byVendor, [context.vendorSlug]: context.guestSnap },
        }))
        applyCartMutation(qc, buildGuestCart(context.guestSnap))
      } else if (context?.previous) {
        applyCartMutation(qc, context.previous)
      }
      qc.invalidateQueries({ queryKey: storeKeys.cart })
      apiError('Could not remove item from cart')(err)
    },
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

export function useCustomerLogin(options?: { silentError?: boolean }) {
  const qc = useQueryClient()
  const { vendorSlug } = useVendor()
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

      if (vendorSlug) {
        syncCartStore(null)
        qc.setQueryData(storeKeys.cart, undefined)

        const guestItems = useGuestCartStore.getState().getItems(vendorSlug)
        if (guestItems.length > 0) {
          try {
            let cart = qc.getQueryData<Cart>(storeKeys.cart) ?? useCartStore.getState().cart
            for (const item of guestItems) {
              const { variant_label: _vl, slug: _slug, ...apiItem } = item
              cart = await storeApi.addToCart(apiItem)
            }
            if (cart) applyCartMutation(qc, cart)
            useGuestCartStore.getState().clear(vendorSlug)
            clearPendingBuyNow()
          } catch {
            // Checkout can still complete pending Buy Now item separately.
          }
        }
      }

      qc.invalidateQueries({ queryKey: storeKeys.me })
      qc.invalidateQueries({ queryKey: storeKeys.cart })
      toast.success('Welcome!')
      // Navigation handled by the calling component using vendor context
    },
    onError: options?.silentError
      ? undefined
      : apiError('Login failed'),
  })
}

export function useCustomerRegister() {
  return useMutation({
    mutationFn: (data: {
      full_name: string; email?: string; password: string; phone?: string; otp_code: string
    }) => storeApi.register(data),
    onSuccess: () => { toast.success('Account created!') },
    onError: (error: unknown) => {
      toast.error(formatCustomerAuthError(
        error,
        'Registration failed — this email or phone may already be registered.',
      ))
    },
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
      notes?: string; payment_method?: string; order_id?: string
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
    variantId: i.variant_id ? String(i.variant_id) : undefined,
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
      toast.success('Subscription started', {
        description: 'You can manage it anytime from Account → Subscriptions.',
      })
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
