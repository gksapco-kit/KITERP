import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { storeApi } from '@/api/store'
import { useAuthStore } from '@/stores/authStore'
import { useCartStore } from '@/stores/cartStore'
import { apiError, extractApiError } from '@/lib/errorMessages'

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
}

export function useStoreInfo() {
  return useQuery({ queryKey: storeKeys.info, queryFn: storeApi.getStoreInfo, staleTime: 10 * 60 * 1000, retry: false })
}

export function useStoreCategories(params?: Record<string, unknown>) {
  return useQuery({ queryKey: storeKeys.categories(params), queryFn: () => storeApi.listCategories(params), staleTime: 5 * 60 * 1000 })
}

export function useProducts(params?: Record<string, unknown>) {
  return useQuery({ queryKey: storeKeys.products(params), queryFn: () => storeApi.listProducts(params) })
}

export function useProduct(slug: string) {
  return useQuery({ queryKey: storeKeys.product(slug), queryFn: () => storeApi.getProduct(slug), enabled: !!slug })
}

export function useServices(params?: Record<string, unknown>) {
  return useQuery({ queryKey: storeKeys.services(params), queryFn: () => storeApi.listServices(params) })
}

export function useService(slug: string) {
  return useQuery({ queryKey: storeKeys.service(slug), queryFn: () => storeApi.getService(slug), enabled: !!slug })
}

// Cart
export function useCart() {
  const { setCart } = useCartStore()
  const { isAuthenticated } = useAuthStore()
  return useQuery({
    queryKey: storeKeys.cart, queryFn: async () => { const cart = await storeApi.getCart(); setCart(cart); return cart },
    enabled: isAuthenticated,
  })
}

export function useAddToCart() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: storeApi.addToCart,
    onSuccess: () => { qc.invalidateQueries({ queryKey: storeKeys.cart }); toast.success('Added to cart!') },
    onError: apiError('Could not add item to cart — it may be out of stock'),
  })
}

export function useUpdateCartItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ index, qty }: { index: number; qty: number }) => storeApi.updateCartItem(index, qty),
    onSuccess: () => qc.invalidateQueries({ queryKey: storeKeys.cart }),
  })
}

export function useRemoveCartItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (index: number) => storeApi.removeCartItem(index),
    onSuccess: () => { qc.invalidateQueries({ queryKey: storeKeys.cart }); toast.success('Item removed') },
  })
}

// Orders
export function useCheckout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: storeApi.checkout,
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: storeKeys.cart })
      toast.success(`Order ${order.order_number} placed!`)
      // Navigation handled by calling component using vendor context
    },
    onError: (error: any) => {
      if (error?.response?.status === 401) {
        toast.error('Checkout failed: Please log in to complete your purchase')
      } else {
        toast.error(extractApiError(error, 'Checkout failed — verify your shipping address and payment details'))
      }
    },
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
    enabled: !!accessToken, retry: false,
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

export function useCreateBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      service_id: string; booking_date: string; start_time?: string
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
    // NOTE: Do NOT remove vendor_id / vendor_slug — the user stays on the same vendor storefront
    qc.clear()
    toast.success('Logged out')
    // Navigation is handled by the calling component
  }
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
