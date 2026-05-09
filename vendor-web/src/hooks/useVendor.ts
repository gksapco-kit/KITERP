import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { vendorApi } from '@/api/vendor'
import { apiError } from '@/lib/errorMessages'
import { useVendorStore } from '@/stores/vendorStore'
import type { PaginatedResponse, Product, Service, Order, Customer, OrderStats, Review, VendorRole, TeamMember, VendorCategory } from '@/types'

export const vendorKeys = {
  all: ['vendor'] as const,
  myPlan: () => [...['vendor'], 'my-plan'] as const,
  availablePlans: () => [...['vendor'], 'available-plans'] as const,
  me: () => [...vendorKeys.all, 'me'] as const,
  categories: (params?: Record<string, unknown>) => [...vendorKeys.all, 'categories', params] as const,
  products: (params?: Record<string, unknown>) => [...vendorKeys.all, 'products', params] as const,
  product: (id: string) => [...vendorKeys.all, 'product', id] as const,
  services: (params?: Record<string, unknown>) => [...vendorKeys.all, 'services', params] as const,
  service: (id: string) => [...vendorKeys.all, 'service', id] as const,
  orders: (params?: Record<string, unknown>) => [...vendorKeys.all, 'orders', params] as const,
  order: (id: string) => [...vendorKeys.all, 'order', id] as const,
  orderStats: () => [...vendorKeys.all, 'order-stats'] as const,
  customers: (params?: Record<string, unknown>) => [...vendorKeys.all, 'customers', params] as const,
  customer: (id: string) => [...vendorKeys.all, 'customer', id] as const,
  reviews: (params?: Record<string, unknown>) => [...vendorKeys.all, 'reviews', params] as const,
  review: (id: string) => [...vendorKeys.all, 'review', id] as const,
  team: (params?: Record<string, unknown>) => [...vendorKeys.all, 'team', params] as const,
  teamMember: (id: string) => [...vendorKeys.all, 'team-member', id] as const,
  myMembership: () => [...vendorKeys.all, 'my-membership'] as const,
  roles: () => [...vendorKeys.all, 'roles'] as const,
  role: (id: string) => [...vendorKeys.all, 'role', id] as const,
  permissions: () => [...vendorKeys.all, 'permissions'] as const,
  defaultRoles: () => [...vendorKeys.all, 'default-roles'] as const,
  inventorySummary: (params?: Record<string, unknown>) => [...vendorKeys.all, 'inventory-summary', params] as const,
  inventoryHistory: (params?: Record<string, unknown>) => [...vendorKeys.all, 'inventory-history', params] as const,
  inventoryLowStock: () => [...vendorKeys.all, 'inventory-low-stock'] as const,
  suppliers: (params?: Record<string, unknown>) => [...vendorKeys.all, 'suppliers', params] as const,
  supplier: (id: string) => [...vendorKeys.all, 'supplier', id] as const,
  purchaseOrders: (params?: Record<string, unknown>) => [...vendorKeys.all, 'purchase-orders', params] as const,
  purchaseOrder: (id: string) => [...vendorKeys.all, 'purchase-order', id] as const,
  invoices: (params?: Record<string, unknown>) => [...vendorKeys.all, 'invoices', params] as const,
  invoice: (id: string) => [...vendorKeys.all, 'invoice', id] as const,
  invoiceTemplates: () => [...vendorKeys.all, 'invoice-templates'] as const,
  bookings: (params?: Record<string, unknown>) => [...vendorKeys.all, 'bookings', params] as const,
  booking: (id: string) => [...vendorKeys.all, 'booking', id] as const,
  posTransactions: (params?: Record<string, unknown>) =>
    [...vendorKeys.all, 'pos-transactions', params] as const,
  bundles: () => [...vendorKeys.all, 'bundles'] as const,
  productMerchandising: (id: string) => [...vendorKeys.all, 'product-merchandising', id] as const,
  priceRules: (productId: string) => [...vendorKeys.all, 'price-rules', productId] as const,
  productBOM: (productId: string) => [...vendorKeys.all, 'product-bom', productId] as const,
  reservations: (orderType: string, orderId: string) => [...vendorKeys.all, 'reservations', orderType, orderId] as const,
  /** Company codes / outlets — use with useStores; invalidate `[...vendorKeys.all, 'stores']` after mutations. */
  stores: (params?: Record<string, unknown>) => [...vendorKeys.all, 'stores', params] as const,
  // HR keys
  hrDepartments: () => [...vendorKeys.all, 'hr-departments'] as const,
  hrDesignations: () => [...vendorKeys.all, 'hr-designations'] as const,
  hrEmployees: (params?: Record<string, unknown>) => [...vendorKeys.all, 'hr-employees', params] as const,
  hrEmployee: (id: string) => [...vendorKeys.all, 'hr-employee', id] as const,
  hrAttendance: (params?: Record<string, unknown>) => [...vendorKeys.all, 'hr-attendance', params] as const,
  hrAttendanceReport: (month: number, year: number) => [...vendorKeys.all, 'hr-att-report', month, year] as const,
  hrMyToday: () => [...vendorKeys.all, 'hr-my-today'] as const,
  hrLeavePolicies: () => [...vendorKeys.all, 'hr-leave-policies'] as const,
  hrLeaveRequests: (params?: Record<string, unknown>) => [...vendorKeys.all, 'hr-leave-requests', params] as const,
  hrLeaveBalances: (empId: string, year?: number) => [...vendorKeys.all, 'hr-leave-balances', empId, year] as const,
  hrMyLeaves: (year?: number) => [...vendorKeys.all, 'hr-my-leaves', year] as const,
  hrHolidays: (year?: number) => [...vendorKeys.all, 'hr-holidays', year] as const,
  hrSalaryStructures: (params?: Record<string, unknown>) => [...vendorKeys.all, 'hr-salary', params] as const,
  hrPayrollRuns: (year?: number) => [...vendorKeys.all, 'hr-payroll-runs', year] as const,
  hrPayrollRun: (id: string) => [...vendorKeys.all, 'hr-payroll-run', id] as const,
  hrMyPayslips: () => [...vendorKeys.all, 'hr-my-payslips'] as const,
  hrOffers: () => [...vendorKeys.all, 'hr-offers'] as const,
}

export function useMyVendor() {
  const { setVendor } = useVendorStore()
  return useQuery({
    queryKey: vendorKeys.me(),
    queryFn: async () => {
      const vendor = await vendorApi.getMyVendor()
      setVendor(vendor)
      return vendor
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

export function useUpdateVendor() {
  const qc = useQueryClient()
  const { setVendor } = useVendorStore()
  return useMutation({
    mutationFn: (data: Partial<import('@/types').Vendor>) => vendorApi.updateMyVendor(data),
    onSuccess: (vendor) => {
      setVendor(vendor)
      qc.invalidateQueries({ queryKey: ['vendor', 'me'] })
      toast.success('Settings saved!')
    },
    onError: apiError('Could not save vendor settings'),
  })
}

// ── Vendor Verification (KYC documents + submit for review) ─────
export function useVendorDocuments() {
  return useQuery({
    queryKey: [...vendorKeys.all, 'documents'] as const,
    queryFn: () => vendorApi.listVendorDocuments(),
    staleTime: 60 * 1000,
  })
}

export function useUploadVendorDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ documentType, file }: { documentType: import('@/types').VendorDocumentType; file: File }) =>
      vendorApi.uploadVendorDocument(documentType, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...vendorKeys.all, 'documents'] })
      toast.success('Document uploaded')
    },
    onError: apiError('Could not upload document'),
  })
}

export function useSubmitVendorForReview() {
  const qc = useQueryClient()
  const { setVendor } = useVendorStore()
  return useMutation({
    mutationFn: () => vendorApi.submitVendorForReview(),
    onSuccess: (vendor) => {
      setVendor(vendor)
      qc.invalidateQueries({ queryKey: vendorKeys.me() })
      toast.success('Submitted for review — we will email you when verified')
    },
    onError: apiError('Could not submit for review'),
  })
}

// ── Categories ──────────────────────────────────────────────────
export function useCategories(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: vendorKeys.categories(params),
    queryFn: () => vendorApi.listCategories(params),
    staleTime: 60 * 1000,
  })
}

export function useCategoryTree() {
  return useQuery({
    queryKey: [...vendorKeys.all, 'categories', 'tree'],
    queryFn: () => vendorApi.listCategories({ tree: true }),
    staleTime: 60 * 1000,
  })
}

export function useCategoryCatalogues(id: string) {
  return useQuery({
    queryKey: [...vendorKeys.all, 'categories', id, 'catalogues'],
    queryFn: () => vendorApi.getCategoryCatalogues(id),
    enabled: !!id,
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      vendorApi.createCategory(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendor', 'categories'] }); toast.success('Category created!') },
    onError: apiError('Could not create category — check if the name already exists'),
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      vendorApi.updateCategory(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendor', 'categories'] }); toast.success('Category updated!') },
    onError: apiError('Could not update category'),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vendorApi.deleteCategory(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendor', 'categories'] }); toast.success('Category deleted') },
    onError: apiError('Could not delete category — it may have products linked to it'),
  })
}

// ── Products ────────────────────────────────────────────────────
export function useProducts(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: vendorKeys.products(params),
    queryFn: () => vendorApi.listProducts(params),
  })
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: vendorKeys.product(id),
    queryFn: () => vendorApi.getProduct(id),
    enabled: !!id,
  })
}

export function useCreateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ data, images }: { data: Record<string, unknown>; images?: File[] }) =>
      vendorApi.createProduct(data, images),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendor', 'products'] }); toast.success('Product created!') },
    onError: apiError('Could not create product — verify all required fields (name, price, SKU) are filled'),
  })
}

export function useUpdateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vendorApi.updateProduct(id, data),
    onSuccess: (updatedProduct, { id }) => {
      // Immediately populate the detail cache with the server response (preserves images)
      qc.setQueryData(vendorKeys.product(id), updatedProduct)
      qc.invalidateQueries({ queryKey: vendorKeys.products() })
      qc.invalidateQueries({ queryKey: vendorKeys.product(id) })
      toast.success('Product updated!')
    },
    onError: apiError('Could not update product — check your changes and try again'),
  })
}

export function useDeleteProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vendorApi.deleteProduct(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendor', 'products'] }); toast.success('Product deleted') },
    onError: apiError('Could not delete product — it may be referenced in active orders'),
  })
}

// ── Services ────────────────────────────────────────────────────
export function useServices(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: vendorKeys.services(params),
    queryFn: () => vendorApi.listServices(params),
  })
}

export function useService(id: string) {
  return useQuery({
    queryKey: vendorKeys.service(id),
    queryFn: () => vendorApi.getService(id),
    enabled: !!id,
  })
}

export function useCreateService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => vendorApi.createService(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendor', 'services'] }); toast.success('Service created!') },
    onError: apiError('Could not create service — verify name, price, and duration are filled correctly'),
  })
}

export function useUpdateService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vendorApi.updateService(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendor', 'services'] }); toast.success('Service updated!') },
    onError: apiError('Could not update service — check your changes and try again'),
  })
}

export function useDeleteService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vendorApi.deleteService(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendor', 'services'] }); toast.success('Service deleted') },
    onError: apiError('Could not delete service — it may have active bookings'),
  })
}

// ── Orders ──────────────────────────────────────────────────────
export function useOrders(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: vendorKeys.orders(params),
    queryFn: () => vendorApi.listOrders(params),
  })
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: vendorKeys.order(id),
    queryFn: () => vendorApi.getOrder(id),
    enabled: !!id,
  })
}

export function useOrderStats() {
  return useQuery({
    queryKey: vendorKeys.orderStats(),
    queryFn: vendorApi.getOrderStats,
    staleTime: 30 * 1000,
  })
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vendorApi.updateOrderStatus(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['vendor', 'orders'] })
      qc.invalidateQueries({ queryKey: vendorKeys.order(id) })
      toast.success('Order status updated!')
    },
    onError: apiError('Could not update order status — the order may already be in this state'),
  })
}

export function useResolveReturn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { action: 'approve' | 'reject'; notes?: string; refund_amount?: number } }) =>
      vendorApi.resolveReturn(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['vendor', 'orders'] })
      qc.invalidateQueries({ queryKey: vendorKeys.order(id) })
      toast.success('Return/exchange request updated')
    },
    onError: apiError('Could not process return/exchange — the order may not be eligible'),
  })
}

export function useRequestReturnExchange() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: {
        return_type: 'return' | 'exchange'
        reason: string
        attachments?: { url: string; kind: 'image' | 'video' }[]
      }
    }) => vendorApi.requestReturnExchange(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['vendor', 'orders'] })
      qc.invalidateQueries({ queryKey: vendorKeys.order(id) })
      toast.success('Return/exchange request initiated')
    },
    onError: apiError('Could not initiate return/exchange — verify the order is eligible for returns'),
  })
}

export function useOrderInvoice(orderId: string) {
  return useQuery({
    queryKey: ['vendor', 'invoice-by-order', orderId],
    queryFn: () => vendorApi.getInvoiceByOrder(orderId),
    enabled: !!orderId,
    retry: false,
  })
}

export function useInvoiceById(invoiceId: string) {
  return useQuery({
    queryKey: ['vendor', 'invoice-by-id', invoiceId],
    queryFn: () => vendorApi.getInvoice(invoiceId),
    enabled: !!invoiceId,
    retry: false,
  })
}

// ── Customers ───────────────────────────────────────────────────
export function useCustomers(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: vendorKeys.customers(params),
    queryFn: () => vendorApi.listCustomers(params),
  })
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: vendorKeys.customer(id),
    queryFn: () => vendorApi.getCustomer(id),
    enabled: !!id,
  })
}

export function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { full_name: string; email?: string; phone?: string; password?: string; linked_customer_id?: string }) =>
      vendorApi.createCustomer(data),
    onSuccess: () => {
      // Invalidate using the prefix (without params) so ALL useCustomers() queries refetch
      qc.invalidateQueries({ queryKey: [...vendorKeys.all, 'customers'] })
      toast.success('Customer created successfully')
    },
    onError: apiError('Could not create customer — email or phone may already be registered'),
  })
}

export function useUpdateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      vendorApi.updateCustomer(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...vendorKeys.all, 'customers'] })
      toast.success('Customer updated!')
    },
    onError: apiError('Could not update customer details'),
  })
}

// ── Reviews ────────────────────────────────────────────────────
export function useReviews(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: vendorKeys.reviews(params),
    queryFn: () => vendorApi.listReviews(params),
  })
}

export function useReview(id: string) {
  return useQuery({
    queryKey: vendorKeys.review(id),
    queryFn: () => vendorApi.getReview(id),
    enabled: !!id,
  })
}

export function useReplyToReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reply }: { id: string; reply: string }) => vendorApi.replyToReview(id, reply),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor', 'reviews'] })
      toast.success('Reply posted!')
    },
    onError: apiError('Could not post reply to review'),
  })
}

export function useToggleReviewVisibility() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_visible }: { id: string; is_visible: boolean }) => vendorApi.toggleReviewVisibility(id, is_visible),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor', 'reviews'] })
      toast.success('Review visibility updated')
    },
    onError: apiError('Could not update review visibility'),
  })
}

// ── Team ────────────────────────────────────────────────────────
export function useTeamMembers(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: vendorKeys.team(params),
    queryFn: () => vendorApi.listTeamMembers(params),
  })
}

export function useMyMembership() {
  return useQuery({
    queryKey: vendorKeys.myMembership(),
    queryFn: () => vendorApi.getMyMembership(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

export function useInviteTeamMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { email: string; full_name: string; phone?: string; role: string; role_id?: string; password: string }) =>
      vendorApi.inviteTeamMember(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor', 'team'] })
    },
    onError: apiError('Could not invite team member — email may already be in use'),
  })
}

export function useSendTeamVerification() {
  return useMutation({
    mutationFn: (memberId: string) => vendorApi.sendTeamVerificationOtp(memberId),
    onError: apiError('Could not send verification OTP'),
  })
}

export function useVerifyTeamMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ memberId, otp, channel }: { memberId: string; otp: string; channel: 'email' | 'phone' }) =>
      vendorApi.verifyTeamMemberOtp(memberId, otp, channel),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor', 'team'] })
      toast.success('Contact verified successfully!')
    },
    onError: apiError('Invalid or expired OTP — please try again'),
  })
}

export function useUpdateTeamMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { role?: string; role_id?: string; is_active?: boolean } }) =>
      vendorApi.updateTeamMember(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor', 'team'] })
      toast.success('Team member updated!')
    },
    onError: apiError('Could not update team member role or status'),
  })
}

export function useRemoveTeamMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vendorApi.removeTeamMember(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor', 'team'] })
      toast.success('Team member removed')
    },
    onError: apiError('Could not remove team member — they may be the only admin'),
  })
}

// ── Roles ───────────────────────────────────────────────────────
export function useRoles() {
  return useQuery({
    queryKey: vendorKeys.roles(),
    queryFn: () => vendorApi.listRoles(),
  })
}

export function useAllPermissions() {
  return useQuery({
    queryKey: vendorKeys.permissions(),
    queryFn: () => vendorApi.listAllPermissions(),
    staleTime: 60 * 60 * 1000,
  })
}

export function useDefaultRoles() {
  return useQuery({
    queryKey: vendorKeys.defaultRoles(),
    queryFn: () => vendorApi.listDefaultRoles(),
    staleTime: 60 * 60 * 1000,
  })
}

export function useCreateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; description?: string; permissions: string[] }) =>
      vendorApi.createRole(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor', 'roles'] })
      toast.success('Role created!')
    },
    onError: apiError('Could not create role — a role with this name may already exist'),
  })
}

export function useUpdateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string; permissions?: string[]; is_active?: boolean } }) =>
      vendorApi.updateRole(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor', 'roles'] })
      toast.success('Role updated!')
    },
    onError: apiError('Could not update role permissions'),
  })
}

export function useDeleteRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vendorApi.deleteRole(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor', 'roles'] })
      toast.success('Role deleted')
    },
    onError: apiError('Could not delete role — team members may still be assigned to it'),
  })
}

// ── Plans ────────────────────────────────────────────────────────
export function useMyPlan() {
  return useQuery({
    queryKey: vendorKeys.myPlan(),
    queryFn: () => vendorApi.getMyPlan(),
    staleTime: 5 * 60 * 1000,
  })
}

export function useAvailablePlans() {
  return useQuery({
    queryKey: vendorKeys.availablePlans(),
    queryFn: () => vendorApi.getAvailablePlans(),
    staleTime: 10 * 60 * 1000,
  })
}

export function useChangePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (planId: string) => vendorApi.changePlan(planId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: vendorKeys.myPlan() })
      toast.success(data?.message || 'Plan changed successfully!')
    },
    onError: apiError('Could not change subscription plan — check billing or contact support'),
  })
}

// ── Suppliers ────────────────────────────────────────────────────
export function useSuppliers(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: vendorKeys.suppliers(params),
    queryFn: () => vendorApi.listSuppliers(params),
  })
}

export function useCreateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => vendorApi.createSupplier(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendor', 'suppliers'] }); toast.success('Supplier created!') },
    onError: apiError('Could not create supplier — check name and contact details'),
  })
}

export function useUpdateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vendorApi.updateSupplier(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendor', 'suppliers'] }); toast.success('Supplier updated!') },
    onError: apiError('Could not update supplier details'),
  })
}

export function useDeleteSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vendorApi.deleteSupplier(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendor', 'suppliers'] }); toast.success('Supplier deactivated') },
    onError: apiError('Could not deactivate supplier — they may have open purchase orders'),
  })
}

// ── Purchase Orders ─────────────────────────────────────────────
export function usePurchaseOrders(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: vendorKeys.purchaseOrders(params),
    queryFn: () => vendorApi.listPurchaseOrders(params),
  })
}

export function usePurchaseOrder(id: string) {
  return useQuery({
    queryKey: vendorKeys.purchaseOrder(id),
    queryFn: () => vendorApi.getPurchaseOrder(id),
    enabled: !!id,
  })
}

export function useCreatePurchaseOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => vendorApi.createPurchaseOrder(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendor', 'purchase-orders'] }); toast.success('Purchase order created!') },
    onError: apiError('Could not create purchase order — verify supplier and line items'),
  })
}

export function useUpdatePurchaseOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vendorApi.updatePurchaseOrder(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor', 'purchase-orders'] })
      qc.invalidateQueries({ queryKey: ['vendor', 'purchase-order'] })
      toast.success('Purchase order updated!')
    },
    onError: apiError('Could not update purchase order — it may already be sent or closed'),
  })
}

export function useSendPO() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vendorApi.sendPurchaseOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor', 'purchase-orders'] })
      qc.invalidateQueries({ queryKey: ['vendor', 'purchase-order'] })
      toast.success('Purchase order sent!')
    },
    onError: apiError('Could not send purchase order — check supplier email and PO details'),
  })
}

export function useReceivePOItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vendorApi.receivePurchaseOrderItems(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor', 'purchase-orders'] })
      qc.invalidateQueries({ queryKey: ['vendor', 'purchase-order'] })
      qc.invalidateQueries({ queryKey: ['vendor', 'inventory-summary'] })
      qc.invalidateQueries({ queryKey: ['vendor', 'inventory-history'] })
      qc.invalidateQueries({ queryKey: ['vendor', 'products'] })
      toast.success('Items received and inventory updated!')
    },
    onError: apiError('Could not receive PO items — quantities may exceed the ordered amount'),
  })
}

export function useClosePO() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vendorApi.closePurchaseOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor', 'purchase-orders'] })
      qc.invalidateQueries({ queryKey: ['vendor', 'purchase-order'] })
      toast.success('Purchase order closed')
    },
    onError: apiError('Could not close purchase order — some items may still be pending receipt'),
  })
}

export function useCancelPO() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vendorApi.cancelPurchaseOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor', 'purchase-orders'] })
      qc.invalidateQueries({ queryKey: ['vendor', 'purchase-order'] })
      toast.success('Purchase order cancelled')
    },
    onError: apiError('Could not cancel purchase order — items may have already been received'),
  })
}

// ── Inventory ────────────────────────────────────────────────────
export function useInventorySummary(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: vendorKeys.inventorySummary(params),
    queryFn: () => vendorApi.inventorySummary(params),
    staleTime: 30 * 1000,
  })
}

export function useInventoryHistory(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: vendorKeys.inventoryHistory(params),
    queryFn: () => vendorApi.inventoryHistory(params),
  })
}

export function useInventoryLowStock() {
  return useQuery({
    queryKey: vendorKeys.inventoryLowStock(),
    queryFn: () => vendorApi.inventoryLowStock(),
    staleTime: 60 * 1000,
  })
}

export function useInventoryStockIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => vendorApi.inventoryStockIn(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor', 'inventory-summary'] })
      qc.invalidateQueries({ queryKey: ['vendor', 'inventory-history'] })
      qc.invalidateQueries({ queryKey: ['vendor', 'inventory-low-stock'] })
      qc.invalidateQueries({ queryKey: ['vendor', 'products'] })
      toast.success('Stock in recorded!')
    },
    onError: apiError('Could not record stock in — check product and quantity'),
  })
}

export function useInventoryStockOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => vendorApi.inventoryStockOut(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor', 'inventory-summary'] })
      qc.invalidateQueries({ queryKey: ['vendor', 'inventory-history'] })
      qc.invalidateQueries({ queryKey: ['vendor', 'inventory-low-stock'] })
      qc.invalidateQueries({ queryKey: ['vendor', 'products'] })
      toast.success('Stock out recorded!')
    },
    onError: apiError('Could not record stock out — insufficient stock or invalid product'),
  })
}

export function useInventoryAdjust() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => vendorApi.inventoryAdjust(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor', 'inventory-summary'] })
      qc.invalidateQueries({ queryKey: ['vendor', 'inventory-history'] })
      qc.invalidateQueries({ queryKey: ['vendor', 'inventory-low-stock'] })
      qc.invalidateQueries({ queryKey: ['vendor', 'products'] })
      toast.success('Stock adjusted!')
    },
    onError: apiError('Could not adjust stock — verify the product and new quantity'),
  })
}

// ── Invoices ─────────────────────────────────────────────────────
export function useUpdateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      vendorApi.updateInvoice(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['vendor', 'invoices'] })
      qc.invalidateQueries({ queryKey: vendorKeys.invoice(id) })
      qc.invalidateQueries({ queryKey: ['invoice', id] })
      toast.success('Invoice updated!')
    },
    onError: apiError('Could not update invoice — check line items and amounts'),
  })
}

// ── Invoice Templates ────────────────────────────────────────────
export function useInvoiceTemplates() {
  return useQuery({
    queryKey: vendorKeys.invoiceTemplates(),
    queryFn: () => vendorApi.listInvoiceTemplates(),
    staleTime: 60 * 1000,
  })
}

export function useCreateInvoiceTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => vendorApi.createInvoiceTemplate(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vendorKeys.invoiceTemplates() })
      toast.success('Template created!')
    },
    onError: apiError('Could not create invoice template'),
  })
}

export function useUpdateInvoiceTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      vendorApi.updateInvoiceTemplate(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vendorKeys.invoiceTemplates() })
      toast.success('Template saved!')
    },
    onError: apiError('Could not save invoice template changes'),
  })
}

export function useDeleteInvoiceTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vendorApi.deleteInvoiceTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vendorKeys.invoiceTemplates() })
      toast.success('Template deleted')
    },
    onError: apiError('Could not delete invoice template — it may be set as default'),
  })
}

export function useSetDefaultTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vendorApi.setDefaultTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vendorKeys.invoiceTemplates() })
      toast.success('Default template updated')
    },
    onError: apiError('Could not set default template'),
  })
}

// ── Bookings ─────────────────────────────────────────────────────
export function useUpdateBookingStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status: string; cancel_reason?: string } }) =>
      vendorApi.updateBookingStatus(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] })
      qc.invalidateQueries({ queryKey: ['vendor', 'bookings'] })
      toast.success('Booking status updated!')
    },
    onError: apiError('Could not update booking status — the booking may already be completed or cancelled'),
  })
}

// ── Merchandising ────────────────────────────────────────────────

export function useBundles() {
  return useQuery({
    queryKey: vendorKeys.bundles(),
    queryFn: () => vendorApi.listBundles(),
  })
}

export function useProductMerchandising(productId: string) {
  return useQuery({
    queryKey: vendorKeys.productMerchandising(productId),
    queryFn: () => vendorApi.getProductMerchandising(productId),
    enabled: !!productId,
  })
}

export function useSyncProductMerchandising() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, data }: { productId: string; data: { mappings: Array<Record<string, unknown>> } }) =>
      vendorApi.syncProductMerchandising(productId, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: vendorKeys.productMerchandising(variables.productId) })
      toast.success('Merchandising updated!')
    },
    onError: apiError('Could not save merchandising settings for this product'),
  })
}

export function useCreateBundle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => vendorApi.createBundle(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vendorKeys.bundles() })
      toast.success('Bundle created!')
    },
    onError: apiError('Could not create bundle — check bundle name and products'),
  })
}

export function useDeleteBundle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vendorApi.deleteBundle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vendorKeys.bundles() })
      toast.success('Bundle deleted')
    },
    onError: apiError('Could not delete bundle'),
  })
}


// ── Price Rules ──────────────────────────────────────────────

export function usePriceRules(productId: string) {
  return useQuery({
    queryKey: vendorKeys.priceRules(productId),
    queryFn: () => vendorApi.listPriceRules(productId),
    enabled: !!productId,
  })
}

export function useCreatePriceRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, data }: { productId: string; data: Parameters<typeof vendorApi.createPriceRule>[1] }) =>
      vendorApi.createPriceRule(productId, data),
    onSuccess: (_d, { productId }) => {
      qc.invalidateQueries({ queryKey: vendorKeys.priceRules(productId) })
      toast.success('Price rule created')
    },
    onError: apiError('Could not create price rule — check rule conditions and discount values'),
  })
}

export function useUpdatePriceRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, ruleId, data }: { productId: string; ruleId: string; data: Partial<Parameters<typeof vendorApi.createPriceRule>[1]> }) =>
      vendorApi.updatePriceRule(productId, ruleId, data),
    onSuccess: (_d, { productId }) => {
      qc.invalidateQueries({ queryKey: vendorKeys.priceRules(productId) })
      toast.success('Price rule updated')
    },
    onError: apiError('Could not update price rule'),
  })
}

export function useDeletePriceRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, ruleId }: { productId: string; ruleId: string }) =>
      vendorApi.deletePriceRule(productId, ruleId),
    onSuccess: (_d, { productId }) => {
      qc.invalidateQueries({ queryKey: vendorKeys.priceRules(productId) })
      toast.success('Price rule deleted')
    },
    onError: apiError('Could not delete price rule'),
  })
}

// ── Invoice Settings ──────────────────────────────────────────────────────────
export function useInvoiceSettings() {
  return useQuery({
    queryKey: ['invoiceSettings'],
    queryFn: () => vendorApi.getInvoiceSettings(),
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateInvoiceSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => vendorApi.updateInvoiceSettings(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoiceSettings'] })
      toast.success('Invoice settings saved!')
    },
    onError: apiError('Could not save invoice settings'),
  })
}

export function useUploadInvoiceSignature() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => vendorApi.uploadInvoiceSignature(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoiceSettings'] })
      toast.success('Signature uploaded!')
    },
    onError: apiError('Could not upload signature — file may be too large or wrong format (use PNG/JPG)'),
  })
}

// ── PO Template Settings ──────────────────────────────────────────────────────

const PO_SETTINGS_KEY = 'po_template_settings'

export function usePOTemplateSettings() {
  return useQuery({
    queryKey: ['poTemplateSettings'],
    queryFn: (): Record<string, unknown> => {
      try {
        const stored = localStorage.getItem(PO_SETTINGS_KEY)
        return stored ? JSON.parse(stored) : {}
      } catch {
        return {}
      }
    },
    staleTime: Infinity,
  })
}

export function useUpdatePOTemplateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Record<string, unknown>): Promise<Record<string, unknown>> => {
      localStorage.setItem(PO_SETTINGS_KEY, JSON.stringify(data))
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['poTemplateSettings'] })
      toast.success('PO template settings saved!')
    },
    onError: apiError('Could not save PO template settings'),
  })
}

// ── MRP / BOM / Stock Reservations ──────────────────────────────────────────

export function useProductBOM(productId: string | null) {
  return useQuery({
    queryKey: vendorKeys.productBOM(productId ?? ''),
    queryFn: () => vendorApi.getProductBOM(productId!),
    enabled: !!productId,
    staleTime: 30_000,
  })
}

export function useUpdateProductBOM() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, items }: { productId: string; items: Record<string, unknown>[] }) =>
      vendorApi.putProductBOM(productId, items),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: vendorKeys.productBOM(vars.productId) })
      toast.success('Bill of Materials saved!')
    },
    onError: apiError('Could not save BOM'),
  })
}

export function useCalculateMRP() {
  return useMutation({
    mutationFn: (body: { items: Record<string, unknown>[]; order_type: string; order_id: string }) =>
      vendorApi.calculateMRP(body),
    onError: apiError('MRP calculation failed'),
  })
}

export function useOrderReservations(orderType: string, orderId: string) {
  return useQuery({
    queryKey: vendorKeys.reservations(orderType, orderId),
    queryFn: () => vendorApi.listReservations({ order_type: orderType, order_id: orderId }),
    enabled: !!orderId,
    staleTime: 10_000,
  })
}

export function useCreateReservations() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { order_type: string; order_id: string; items: Record<string, unknown>[] }) =>
      vendorApi.createReservations(data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: vendorKeys.reservations(vars.order_type, vars.order_id) })
      toast.success('Stock reserved successfully!')
    },
    onError: apiError('Could not reserve stock'),
  })
}

export function useReleaseReservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; order_type: string; order_id: string }) =>
      vendorApi.releaseReservation(id),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: vendorKeys.reservations(vars.order_type, vars.order_id) })
      toast.success('Reservation released')
    },
    onError: apiError('Could not release reservation'),
  })
}

export function useReleaseAllReservations() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { order_type: string; order_id: string }) =>
      vendorApi.releaseAllReservations(params),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: vendorKeys.reservations(vars.order_type, vars.order_id) })
      toast.success('All reservations released')
    },
    onError: apiError('Could not release reservations'),
  })
}

// ─────────────────────────────────────────────────────────────────
// Stores Hook
// ─────────────────────────────────────────────────────────────────

export function useStores(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: vendorKeys.stores(params),
    queryFn: () => vendorApi.listStores(params),
    staleTime: 60_000,
  })
}

// ─────────────────────────────────────────────────────────────────
// HR Hooks
// ─────────────────────────────────────────────────────────────────

// Departments
export function useHRDepartments() {
  return useQuery({ queryKey: vendorKeys.hrDepartments(), queryFn: vendorApi.hrListDepartments, staleTime: 60_000 })
}
export function useCreateHRDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => vendorApi.hrCreateDepartment(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: vendorKeys.hrDepartments() }); toast.success('Department created') },
    onError: apiError('Could not create department'),
  })
}
export function useUpdateHRDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vendorApi.hrUpdateDepartment(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: vendorKeys.hrDepartments() }); toast.success('Department updated') },
    onError: apiError('Could not update department'),
  })
}
export function useDeleteHRDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vendorApi.hrDeleteDepartment(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: vendorKeys.hrDepartments() }); toast.success('Department deleted') },
    onError: apiError('Could not delete department'),
  })
}

// Designations
export function useHRDesignations() {
  return useQuery({ queryKey: vendorKeys.hrDesignations(), queryFn: vendorApi.hrListDesignations, staleTime: 60_000 })
}
export function useCreateHRDesignation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => vendorApi.hrCreateDesignation(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: vendorKeys.hrDesignations() }); toast.success('Designation created') },
    onError: apiError('Could not create designation'),
  })
}
export function useUpdateHRDesignation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vendorApi.hrUpdateDesignation(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: vendorKeys.hrDesignations() }); toast.success('Designation updated') },
    onError: apiError('Could not update designation'),
  })
}
export function useDeleteHRDesignation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vendorApi.hrDeleteDesignation(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: vendorKeys.hrDesignations() }); toast.success('Designation deleted') },
    onError: apiError('Could not delete designation'),
  })
}

// Employees
export function useHRNextEmployeeCode(storeId?: string) {
  return useQuery({
    queryKey: ['hr', 'next-code', storeId ?? ''],
    queryFn: () => vendorApi.hrNextEmployeeCode(storeId),
    staleTime: 0,
  })
}
export function useHREmployees(params?: Record<string, unknown>) {
  return useQuery({ queryKey: vendorKeys.hrEmployees(params), queryFn: () => vendorApi.hrListEmployees(params), staleTime: 30_000 })
}
export function useHREmployee(id: string | null) {
  return useQuery({ queryKey: vendorKeys.hrEmployee(id ?? ''), queryFn: () => vendorApi.hrGetEmployee(id!), enabled: !!id, staleTime: 30_000 })
}
export function useCreateHREmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => vendorApi.hrCreateEmployee(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: vendorKeys.hrEmployees() }); toast.success('Employee profile created') },
    onError: apiError('Could not create employee'),
  })
}
export function useUpdateHREmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vendorApi.hrUpdateEmployee(id, data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: vendorKeys.hrEmployee(vars.id) })
      qc.invalidateQueries({ queryKey: vendorKeys.hrEmployees() })
      toast.success('Employee updated')
    },
    onError: apiError('Could not update employee'),
  })
}

export function useSetHREmployeePortalPassword() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      vendorApi.hrSetEmployeePortalPassword(id, password),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: vendorKeys.hrEmployee(vars.id) })
      toast.success('Portal password updated — share it securely with the employee')
    },
    onError: apiError('Could not update portal password'),
  })
}

// Attendance
export function useHRMyToday() {
  return useQuery({ queryKey: vendorKeys.hrMyToday(), queryFn: vendorApi.hrMyToday, staleTime: 30_000 })
}
export function useHRClockIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (loc?: { lat: number; lng: number }) => vendorApi.hrClockIn(loc),
    onSuccess: () => { qc.invalidateQueries({ queryKey: vendorKeys.hrMyToday() }); toast.success('Clocked in successfully!') },
    onError: apiError('Clock-in failed'),
  })
}
export function useHRClockOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (loc?: { lat: number; lng: number }) => vendorApi.hrClockOut(loc),
    onSuccess: () => { qc.invalidateQueries({ queryKey: vendorKeys.hrMyToday() }); toast.success('Clocked out successfully!') },
    onError: apiError('Clock-out failed'),
  })
}
export function useHRAttendance(params?: Record<string, unknown>) {
  return useQuery({ queryKey: vendorKeys.hrAttendance(params), queryFn: () => vendorApi.hrListAttendance(params), staleTime: 30_000 })
}
export function useHRMarkAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => vendorApi.hrMarkAttendance(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: vendorKeys.hrAttendance() }); toast.success('Attendance marked') },
    onError: apiError('Could not mark attendance'),
  })
}
export function useHRUpdateAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vendorApi.hrUpdateAttendance(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: vendorKeys.hrAttendance() }); toast.success('Attendance updated') },
    onError: apiError('Could not update attendance'),
  })
}
export function useHRMarkAttendanceRange() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => vendorApi.hrMarkAttendanceRange(data),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: vendorKeys.hrAttendance() })
      toast.success(res?.message ?? 'Attendance range marked')
    },
    onError: apiError('Could not mark attendance range'),
  })
}
export function useHRAttendanceReport(month: number, year: number) {
  return useQuery({ queryKey: vendorKeys.hrAttendanceReport(month, year), queryFn: () => vendorApi.hrAttendanceReport(month, year), staleTime: 60_000 })
}

// Leaves
export function useHRLeavePolicies() {
  return useQuery({ queryKey: vendorKeys.hrLeavePolicies(), queryFn: vendorApi.hrListLeavePolicies, staleTime: 60_000 })
}
export function useCreateHRLeavePolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => vendorApi.hrCreateLeavePolicy(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: vendorKeys.hrLeavePolicies() }); toast.success('Leave policy created') },
    onError: apiError('Could not create policy'),
  })
}
export function useUpdateHRLeavePolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vendorApi.hrUpdateLeavePolicy(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: vendorKeys.hrLeavePolicies() }); toast.success('Policy updated') },
    onError: apiError('Could not update policy'),
  })
}
export function useHRLeaveRequests(params?: Record<string, unknown>) {
  return useQuery({ queryKey: vendorKeys.hrLeaveRequests(params), queryFn: () => vendorApi.hrListLeaveRequests(params), staleTime: 30_000 })
}
export function useHRLeaveBalances(empId: string, year?: number) {
  return useQuery({ queryKey: vendorKeys.hrLeaveBalances(empId, year), queryFn: () => vendorApi.hrGetLeaveBalances(empId, year), enabled: !!empId, staleTime: 60_000 })
}
export function useHRMyLeaves(year?: number) {
  return useQuery({ queryKey: vendorKeys.hrMyLeaves(year), queryFn: () => vendorApi.hrMyLeaves(year), staleTime: 30_000 })
}
export function useSubmitLeaveRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => vendorApi.hrSubmitLeaveRequest(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vendorKeys.hrLeaveRequests() })
      qc.invalidateQueries({ queryKey: vendorKeys.hrMyLeaves() })
      toast.success('Leave request submitted')
    },
    onError: apiError('Could not submit leave request'),
  })
}
export function useApproveLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vendorApi.hrApproveLeave(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: vendorKeys.hrLeaveRequests() }); toast.success('Leave approved') },
    onError: apiError('Could not approve leave'),
  })
}
export function useRejectLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => vendorApi.hrRejectLeave(id, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: vendorKeys.hrLeaveRequests() }); toast.success('Leave rejected') },
    onError: apiError('Could not reject leave'),
  })
}
export function useCancelLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vendorApi.hrCancelLeave(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vendorKeys.hrLeaveRequests() })
      qc.invalidateQueries({ queryKey: vendorKeys.hrMyLeaves() })
      toast.success('Leave cancelled')
    },
    onError: apiError('Could not cancel leave'),
  })
}
export function useHRHolidays(year?: number) {
  return useQuery({ queryKey: vendorKeys.hrHolidays(year), queryFn: () => vendorApi.hrListHolidays(year), staleTime: 60_000 })
}
export function useCreateHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => vendorApi.hrCreateHoliday(data),
    onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: vendorKeys.hrHolidays(vars.year as number) }); toast.success('Holiday added') },
    onError: apiError('Could not add holiday'),
  })
}
export function useDeleteHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vendorApi.hrDeleteHoliday(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: vendorKeys.hrHolidays() }); toast.success('Holiday removed') },
    onError: apiError('Could not remove holiday'),
  })
}

// Salary
export function useHRSalaryStructures(params?: Record<string, unknown>) {
  return useQuery({ queryKey: vendorKeys.hrSalaryStructures(params), queryFn: () => vendorApi.hrListSalaryStructures(params), staleTime: 60_000 })
}
export function useCreateHRSalaryStructure() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => vendorApi.hrCreateSalaryStructure(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: vendorKeys.hrSalaryStructures() }); toast.success('Salary structure saved') },
    onError: apiError('Could not save salary structure'),
  })
}

// Payroll
export function useHRPayrollRuns(year?: number) {
  return useQuery({ queryKey: vendorKeys.hrPayrollRuns(year), queryFn: () => vendorApi.hrListPayrollRuns(year), staleTime: 60_000 })
}
export function useHRPayrollRun(id: string | null) {
  return useQuery({ queryKey: vendorKeys.hrPayrollRun(id ?? ''), queryFn: () => vendorApi.hrGetPayrollRun(id!), enabled: !!id, staleTime: 30_000 })
}
export function useProcessPayroll() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { month: number; year: number }) => vendorApi.hrProcessPayroll(data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: vendorKeys.hrPayrollRuns(vars.year) })
      toast.success('Payroll processed successfully!')
    },
    onError: apiError('Payroll processing failed'),
  })
}
export function useFinalizePayroll() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vendorApi.hrFinalizePayroll(id),
    onSuccess: (_d, id) => { qc.invalidateQueries({ queryKey: vendorKeys.hrPayrollRun(id) }); toast.success('Payroll finalized') },
    onError: apiError('Could not finalize payroll'),
  })
}
export function useMarkPayrollPaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vendorApi.hrMarkPayrollPaid(id),
    onSuccess: (_d, id) => { qc.invalidateQueries({ queryKey: vendorKeys.hrPayrollRun(id) }); toast.success('Payroll marked as paid') },
    onError: apiError('Could not mark payroll paid'),
  })
}
export function useDeletePayrollRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vendorApi.hrDeletePayrollRun(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'payroll'] }); toast.success('Payroll run deleted') },
    onError: apiError('Could not delete payroll run'),
  })
}
export function useHRMyPayslips() {
  return useQuery({ queryKey: vendorKeys.hrMyPayslips(), queryFn: vendorApi.hrMyPayslips, staleTime: 60_000 })
}

// Offer Letters
export function useHROffers() {
  return useQuery({ queryKey: vendorKeys.hrOffers(), queryFn: vendorApi.hrListOffers, staleTime: 30_000 })
}
export function useCreateHROffer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => vendorApi.hrCreateOffer(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: vendorKeys.hrOffers() }); toast.success('Offer letter created') },
    onError: apiError('Could not create offer letter'),
  })
}
export function useUpdateHROffer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vendorApi.hrUpdateOffer(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: vendorKeys.hrOffers() }); toast.success('Offer letter updated') },
    onError: apiError('Could not update offer letter'),
  })
}
export function useSendHROffer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vendorApi.hrSendOffer(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: vendorKeys.hrOffers() }); toast.success('Offer letter sent!') },
    onError: apiError('Could not send offer letter'),
  })
}
export function useDeleteHROffer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vendorApi.hrDeleteOffer(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: vendorKeys.hrOffers() }); toast.success('Offer letter deleted') },
    onError: apiError('Could not delete offer letter'),
  })
}

export function useHRSeedTestData() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (days?: number) => vendorApi.hrSeedTestData(days ?? 30),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: vendorKeys.all })
      toast.success(data?.message ?? 'Test data seeded successfully')
    },
    onError: apiError('Could not seed test data'),
  })
}

// ── Offer Letter Templates ────────────────────────────────────────────────────
export function useHROfferTemplates(params?: { designation_id?: string; department_id?: string; store_id?: string }) {
  return useQuery({
    queryKey: ['hr', 'offer-templates', params],
    queryFn: () => vendorApi.hrListOfferTemplates(params),
    staleTime: 60_000,
  })
}
export function useCreateHROfferTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => vendorApi.hrCreateOfferTemplate(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'offer-templates'] }); toast.success('Template created') },
    onError: apiError('Could not create template'),
  })
}
export function useUpdateHROfferTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vendorApi.hrUpdateOfferTemplate(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'offer-templates'] }); toast.success('Template saved') },
    onError: apiError('Could not update template'),
  })
}
export function useDeleteHROfferTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vendorApi.hrDeleteOfferTemplate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'offer-templates'] }); toast.success('Template deleted') },
    onError: apiError('Could not delete template'),
  })
}
export function useSetDefaultHROfferTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vendorApi.hrSetDefaultOfferTemplate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'offer-templates'] }); toast.success('Default template set') },
    onError: apiError('Could not set default template'),
  })
}

// ════════════════════════════════════════════════════════════════
// HR Extended: Recruitment & Onboarding
// ════════════════════════════════════════════════════════════════
export function useHRJobs(status?: string) {
  return useQuery({ queryKey: ['hr', 'jobs', status], queryFn: () => vendorApi.hrListJobs(status), staleTime: 30_000 })
}
export function useHRJob(id: string | null) {
  return useQuery({ queryKey: ['hr', 'job', id], queryFn: () => vendorApi.hrGetJob(id!), enabled: !!id })
}
export function useCreateHRJob() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (d: Record<string, unknown>) => vendorApi.hrCreateJob(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'jobs'] }); toast.success('Job created') },
    onError: apiError('Could not create job') })
}
export function useUpdateHRJob() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vendorApi.hrUpdateJob(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'jobs'] }); toast.success('Job updated') },
    onError: apiError('Could not update job') })
}
export function useDeleteHRJob() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => vendorApi.hrDeleteJob(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'jobs'] }); toast.success('Job deleted') },
    onError: apiError('Could not delete job') })
}

export function useHRCandidates(search?: string) {
  return useQuery({ queryKey: ['hr', 'candidates', search], queryFn: () => vendorApi.hrListCandidates(search), staleTime: 30_000 })
}
export function useHRCandidate(id: string | null) {
  return useQuery({ queryKey: ['hr', 'candidate', id], queryFn: () => vendorApi.hrGetCandidate(id!), enabled: !!id })
}
export function useCreateHRCandidate() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (d: Record<string, unknown>) => vendorApi.hrCreateCandidate(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'candidates'] }); toast.success('Candidate added') },
    onError: apiError('Could not add candidate') })
}
export function useUpdateHRCandidate() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vendorApi.hrUpdateCandidate(id, data),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['hr', 'candidates'] }); qc.invalidateQueries({ queryKey: ['hr', 'candidate', v.id] }); toast.success('Candidate updated') },
    onError: apiError('Could not update candidate') })
}
export function useDeleteHRCandidate() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => vendorApi.hrDeleteCandidate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'candidates'] }); toast.success('Candidate deleted') },
    onError: apiError('Could not delete candidate') })
}

export function useHRApplications(params?: { job_id?: string; stage?: string }) {
  return useQuery({ queryKey: ['hr', 'apps', params], queryFn: () => vendorApi.hrListApplications(params), staleTime: 15_000 })
}
export function useHRApplication(id: string | null) {
  return useQuery({ queryKey: ['hr', 'app', id], queryFn: () => vendorApi.hrGetApplication(id!), enabled: !!id })
}
export function useCreateHRApplication() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (d: Record<string, unknown>) => vendorApi.hrCreateApplication(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'apps'] }); toast.success('Application created') },
    onError: apiError('Could not create application') })
}
export function useMoveHRStage() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, ...rest }: { id: string; stage: string; rejection_reason?: string; rating?: number }) =>
      vendorApi.hrMoveApplicationStage(id, rest),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'apps'] }); qc.invalidateQueries({ queryKey: ['hr', 'app'] }); toast.success('Stage updated') },
    onError: apiError('Could not move stage') })
}
export function useDeleteHRApplication() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => vendorApi.hrDeleteApplication(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'apps'] }); toast.success('Application removed') },
    onError: apiError('Could not delete') })
}

export function useHRInterviews(upcoming = true) {
  return useQuery({ queryKey: ['hr', 'interviews', upcoming], queryFn: () => vendorApi.hrListInterviews(upcoming), staleTime: 15_000 })
}
export function useCreateHRInterview() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (d: Record<string, unknown>) => vendorApi.hrCreateInterview(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'interviews'] }); qc.invalidateQueries({ queryKey: ['hr', 'app'] }); toast.success('Interview scheduled') },
    onError: apiError('Could not schedule interview') })
}
export function useUpdateHRInterview() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vendorApi.hrUpdateInterview(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'interviews'] }); qc.invalidateQueries({ queryKey: ['hr', 'app'] }); toast.success('Interview updated') },
    onError: apiError('Could not update interview') })
}
export function useDeleteHRInterview() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => vendorApi.hrDeleteInterview(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'interviews'] }); toast.success('Interview removed') },
    onError: apiError('Could not delete interview') })
}

export function useHROnbTemplates() {
  return useQuery({ queryKey: ['hr', 'onb-templates'], queryFn: vendorApi.hrListOnbTemplates, staleTime: 60_000 })
}
export function useHROnbTemplate(id: string | null) {
  return useQuery({ queryKey: ['hr', 'onb-template', id], queryFn: () => vendorApi.hrGetOnbTemplate(id!), enabled: !!id })
}
export function useCreateHROnbTemplate() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (d: Record<string, unknown>) => vendorApi.hrCreateOnbTemplate(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'onb-templates'] }); toast.success('Template saved') },
    onError: apiError('Could not save template') })
}
export function useUpdateHROnbTemplate() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vendorApi.hrUpdateOnbTemplate(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'onb-templates'] }); toast.success('Template updated') },
    onError: apiError('Could not update template') })
}
export function useDeleteHROnbTemplate() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => vendorApi.hrDeleteOnbTemplate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'onb-templates'] }); toast.success('Template deleted') },
    onError: apiError('Could not delete') })
}

export function useHRChecklists(status?: string) {
  return useQuery({ queryKey: ['hr', 'checklists', status], queryFn: () => vendorApi.hrListChecklists(status), staleTime: 30_000 })
}
export function useHRChecklist(id: string | null) {
  return useQuery({ queryKey: ['hr', 'checklist', id], queryFn: () => vendorApi.hrGetChecklist(id!), enabled: !!id })
}
export function useCreateHRChecklist() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (d: Record<string, unknown>) => vendorApi.hrCreateChecklist(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'checklists'] }); toast.success('Onboarding started') },
    onError: apiError('Could not start onboarding') })
}
export function useUpdateOnbTask() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vendorApi.hrUpdateOnbTask(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'checklists'] }); qc.invalidateQueries({ queryKey: ['hr', 'checklist'] }); qc.invalidateQueries({ queryKey: ['hr', 'my-checklist'] }) },
    onError: apiError('Could not update task') })
}
export function useMyChecklist() {
  return useQuery({ queryKey: ['hr', 'my-checklist'], queryFn: vendorApi.hrMyChecklist, staleTime: 30_000 })
}

// ════════════════════════════════════════════════════════════════
// HR Extended: Performance
// ════════════════════════════════════════════════════════════════
export function useHRCycles() {
  return useQuery({ queryKey: ['hr', 'cycles'], queryFn: vendorApi.hrListCycles, staleTime: 60_000 })
}
export function useHRCycle(id: string | null) {
  return useQuery({ queryKey: ['hr', 'cycle', id], queryFn: () => vendorApi.hrGetCycle(id!), enabled: !!id })
}
export function useCreateHRCycle() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (d: Record<string, unknown>) => vendorApi.hrCreateCycle(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'cycles'] }); toast.success('Cycle created') },
    onError: apiError('Could not create cycle') })
}
export function useUpdateHRCycle() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vendorApi.hrUpdateCycle(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'cycles'] }); toast.success('Cycle updated') },
    onError: apiError('Could not update cycle') })
}
export function useLaunchHRCycle() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => vendorApi.hrLaunchCycle(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'cycles'] }); qc.invalidateQueries({ queryKey: ['hr', 'reviews'] }); toast.success('Cycle launched! Reviews assigned to all employees.') },
    onError: apiError('Could not launch cycle') })
}
export function useCloseHRCycle() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => vendorApi.hrCloseCycle(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'cycles'] }); toast.success('Cycle closed') },
    onError: apiError('Could not close cycle') })
}
export function useDeleteHRCycle() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => vendorApi.hrDeleteCycle(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'cycles'] }); toast.success('Cycle deleted') },
    onError: apiError('Could not delete cycle') })
}

export function useHRGoals(params?: { employee_id?: string; cycle_id?: string }) {
  return useQuery({ queryKey: ['hr', 'goals', params], queryFn: () => vendorApi.hrListGoals(params), staleTime: 30_000 })
}
export function useCreateHRGoal() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (d: Record<string, unknown>) => vendorApi.hrCreateGoal(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'goals'] }); toast.success('Goal created') },
    onError: apiError('Could not create goal') })
}
export function useUpdateHRGoal() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vendorApi.hrUpdateGoal(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'goals'] }); toast.success('Goal updated') },
    onError: apiError('Could not update goal') })
}
export function useDeleteHRGoal() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => vendorApi.hrDeleteGoal(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'goals'] }); toast.success('Goal deleted') },
    onError: apiError('Could not delete goal') })
}

export function useHRReviews(params?: { cycle_id?: string; employee_id?: string; status?: string }) {
  return useQuery({ queryKey: ['hr', 'reviews', params], queryFn: () => vendorApi.hrListReviews(params), staleTime: 15_000 })
}
export function useHRReview(id: string | null) {
  return useQuery({ queryKey: ['hr', 'review', id], queryFn: () => vendorApi.hrGetReview(id!), enabled: !!id })
}
export function useSubmitSelfReview() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vendorApi.hrSubmitSelfReview(id, data),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['hr', 'review', v.id] }); qc.invalidateQueries({ queryKey: ['hr', 'reviews'] }); qc.invalidateQueries({ queryKey: ['hr', 'me-perf'] }); toast.success('Self-review submitted') },
    onError: apiError('Could not submit self-review') })
}
export function useSubmitManagerReview() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vendorApi.hrSubmitManagerReview(id, data),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['hr', 'review', v.id] }); qc.invalidateQueries({ queryKey: ['hr', 'reviews'] }); toast.success('Manager review submitted') },
    onError: apiError('Could not submit review') })
}
export function useAcknowledgeReview() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, note }: { id: string; note?: string }) => vendorApi.hrAcknowledgeReview(id, note),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['hr', 'review', v.id] }); qc.invalidateQueries({ queryKey: ['hr', 'me-perf'] }); toast.success('Acknowledged') },
    onError: apiError('Could not acknowledge') })
}
export function useMyPerformance() {
  return useQuery({ queryKey: ['hr', 'me-perf'], queryFn: vendorApi.hrMyPerformance, staleTime: 30_000 })
}

export function useHRFeedback(employee_id?: string) {
  return useQuery({ queryKey: ['hr', 'feedback', employee_id], queryFn: () => vendorApi.hrListFeedback(employee_id), staleTime: 15_000 })
}
export function useCreateHRFeedback() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (d: Record<string, unknown>) => vendorApi.hrCreateFeedback(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'feedback'] }); qc.invalidateQueries({ queryKey: ['hr', 'me-perf'] }); toast.success('Feedback shared') },
    onError: apiError('Could not share feedback') })
}
export function useDeleteHRFeedback() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => vendorApi.hrDeleteFeedback(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'feedback'] }); toast.success('Feedback removed') },
    onError: apiError('Could not delete feedback') })
}

// ════════════════════════════════════════════════════════════════
// HR Extended: Compliance
// ════════════════════════════════════════════════════════════════
export function useHRPolicies(status?: string) {
  return useQuery({ queryKey: ['hr', 'policies', status], queryFn: () => vendorApi.hrListPolicies(status), staleTime: 60_000 })
}
export function useHRPolicy(id: string | null) {
  return useQuery({ queryKey: ['hr', 'policy', id], queryFn: () => vendorApi.hrGetPolicy(id!), enabled: !!id })
}
export function useCreateHRPolicy() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (d: Record<string, unknown>) => vendorApi.hrCreatePolicy(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'policies'] }); toast.success('Policy created') },
    onError: apiError('Could not create policy') })
}
export function useUpdateHRPolicy() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, data, bumpVersion }: { id: string; data: Record<string, unknown>; bumpVersion?: boolean }) =>
    vendorApi.hrUpdatePolicy(id, data, bumpVersion),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'policies'] }); toast.success('Policy updated') },
    onError: apiError('Could not update policy') })
}
export function usePublishHRPolicy() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => vendorApi.hrPublishPolicy(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'policies'] }); toast.success('Policy published') },
    onError: apiError('Could not publish policy') })
}
export function useDeleteHRPolicy() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => vendorApi.hrDeletePolicy(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'policies'] }); toast.success('Policy deleted') },
    onError: apiError('Could not delete policy') })
}
export function useAcknowledgePolicy() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => vendorApi.hrAcknowledgePolicy(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'policies'] }); qc.invalidateQueries({ queryKey: ['hr', 'my-pending-policies'] }); toast.success('Acknowledged') },
    onError: apiError('Could not acknowledge') })
}
export function useMyPendingPolicies() {
  return useQuery({ queryKey: ['hr', 'my-pending-policies'], queryFn: vendorApi.hrMyPendingPolicies, staleTime: 30_000 })
}

export function useHRCertifications(params?: { employee_id?: string; expiring_within_days?: number }) {
  return useQuery({ queryKey: ['hr', 'certs', params], queryFn: () => vendorApi.hrListCertifications(params), staleTime: 60_000 })
}
export function useCreateHRCertification() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (d: Record<string, unknown>) => vendorApi.hrCreateCertification(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'certs'] }); toast.success('Certification added') },
    onError: apiError('Could not save') })
}
export function useUpdateHRCertification() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vendorApi.hrUpdateCertification(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'certs'] }); toast.success('Certification updated') },
    onError: apiError('Could not update') })
}
export function useDeleteHRCertification() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => vendorApi.hrDeleteCertification(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'certs'] }); toast.success('Removed') },
    onError: apiError('Could not delete') })
}

export function useHRAuditLogs(params?: { entity_type?: string; entity_id?: string; limit?: number }) {
  return useQuery({ queryKey: ['hr', 'audit', params], queryFn: () => vendorApi.hrListAuditLogs(params), staleTime: 15_000 })
}

// ════════════════════════════════════════════════════════════════
// HR Extended: Training
// ════════════════════════════════════════════════════════════════
export function useHRPrograms(status?: string) {
  return useQuery({ queryKey: ['hr', 'programs', status], queryFn: () => vendorApi.hrListPrograms(status), staleTime: 30_000 })
}
export function useHRProgram(id: string | null) {
  return useQuery({ queryKey: ['hr', 'program', id], queryFn: () => vendorApi.hrGetProgram(id!), enabled: !!id })
}
export function useCreateHRProgram() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (d: Record<string, unknown>) => vendorApi.hrCreateProgram(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'programs'] }); toast.success('Program created') },
    onError: apiError('Could not create') })
}
export function useUpdateHRProgram() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vendorApi.hrUpdateProgram(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'programs'] }); toast.success('Updated') },
    onError: apiError('Could not update') })
}
export function useDeleteHRProgram() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => vendorApi.hrDeleteProgram(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'programs'] }); toast.success('Deleted') },
    onError: apiError('Could not delete') })
}
export function useCreateHRCourse() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ programId, data }: { programId: string; data: Record<string, unknown> }) => vendorApi.hrCreateCourse(programId, data),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['hr', 'program', v.programId] }); qc.invalidateQueries({ queryKey: ['hr', 'programs'] }); toast.success('Course added') },
    onError: apiError('Could not add course') })
}
export function useUpdateHRCourse() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vendorApi.hrUpdateCourse(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'program'] }); qc.invalidateQueries({ queryKey: ['hr', 'programs'] }); toast.success('Course updated') },
    onError: apiError('Could not update course') })
}
export function useDeleteHRCourse() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => vendorApi.hrDeleteCourse(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'program'] }); qc.invalidateQueries({ queryKey: ['hr', 'programs'] }); toast.success('Course removed') },
    onError: apiError('Could not delete') })
}
export function useEnrollEmployees() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (d: { program_id: string; employee_ids: string[]; due_date?: string }) => vendorApi.hrEnrollEmployees(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'enrollments'] }); toast.success('Enrolled') },
    onError: apiError('Could not enroll') })
}
export function useHREnrollments(params?: { program_id?: string; employee_id?: string }) {
  return useQuery({ queryKey: ['hr', 'enrollments', params], queryFn: () => vendorApi.hrListEnrollments(params), staleTime: 15_000 })
}
export function useHREnrollment(id: string | null) {
  return useQuery({ queryKey: ['hr', 'enrollment', id], queryFn: () => vendorApi.hrGetEnrollment(id!), enabled: !!id })
}
export function useCompleteCourse() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ eid, ...rest }: { eid: string; course_id: string; score_pct?: number; passed?: boolean; answers?: Record<string, unknown> }) =>
    vendorApi.hrCompleteCourse(eid, rest),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['hr', 'enrollment', v.eid] }); qc.invalidateQueries({ queryKey: ['hr', 'my-training'] }) },
    onError: apiError('Could not save course progress') })
}
export function useMyTraining() {
  return useQuery({ queryKey: ['hr', 'my-training'], queryFn: vendorApi.hrMyTraining, staleTime: 15_000 })
}

// ════════════════════════════════════════════════════════════════
// HR Extended: ESS
// ════════════════════════════════════════════════════════════════
export function useESSProfile() {
  return useQuery({ queryKey: ['hr', 'ess-profile'], queryFn: vendorApi.hrEssProfile, staleTime: 30_000 })
}
export function useHRAnnouncements(status?: string) {
  return useQuery({ queryKey: ['hr', 'announcements', status], queryFn: () => vendorApi.hrListAnnouncements(status), staleTime: 60_000 })
}
export function useMyAnnouncements() {
  return useQuery({ queryKey: ['hr', 'my-announcements'], queryFn: vendorApi.hrMyAnnouncements, staleTime: 30_000 })
}
export function useCreateAnnouncement() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (d: Record<string, unknown>) => vendorApi.hrCreateAnnouncement(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'announcements'] }); toast.success('Announcement saved') },
    onError: apiError('Could not save') })
}
export function useUpdateAnnouncement() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vendorApi.hrUpdateAnnouncement(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'announcements'] }); toast.success('Updated') },
    onError: apiError('Could not update') })
}
export function useDeleteAnnouncement() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => vendorApi.hrDeleteAnnouncement(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'announcements'] }); toast.success('Removed') },
    onError: apiError('Could not delete') })
}
export function useMarkAnnouncementRead() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => vendorApi.hrMarkAnnouncementRead(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'my-announcements'] }) } })
}

export function useHRExpenses(params?: { status?: string; employee_id?: string }) {
  return useQuery({ queryKey: ['hr', 'expenses', params], queryFn: () => vendorApi.hrListExpenses(params), staleTime: 15_000 })
}
export function useMyExpenses() {
  return useQuery({ queryKey: ['hr', 'my-expenses'], queryFn: vendorApi.hrMyExpenses, staleTime: 15_000 })
}
export function useHRExpense(id: string | null) {
  return useQuery({ queryKey: ['hr', 'expense', id], queryFn: () => vendorApi.hrGetExpense(id!), enabled: !!id })
}
export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (d: Record<string, unknown>) => vendorApi.hrCreateExpense(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'expenses'] }); qc.invalidateQueries({ queryKey: ['hr', 'my-expenses'] }); toast.success('Claim saved') },
    onError: apiError('Could not save claim') })
}
export function useUpdateExpense() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vendorApi.hrUpdateExpense(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'expenses'] }); qc.invalidateQueries({ queryKey: ['hr', 'my-expenses'] }); toast.success('Claim updated') },
    onError: apiError('Could not update') })
}
export function useDecideExpense() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, ...rest }: { id: string; decision: string; note?: string }) => vendorApi.hrDecideExpense(id, rest),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'expenses'] }); toast.success('Decision recorded') },
    onError: apiError('Could not record decision') })
}
export function useMarkExpensePaid() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, ...rest }: { id: string; payment_reference?: string }) => vendorApi.hrMarkExpensePaid(id, rest),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'expenses'] }); toast.success('Marked paid') },
    onError: apiError('Could not mark paid') })
}
export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => vendorApi.hrDeleteExpense(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'expenses'] }); qc.invalidateQueries({ queryKey: ['hr', 'my-expenses'] }); toast.success('Removed') },
    onError: apiError('Could not delete') })
}

export function useHRTickets(params?: { status?: string; assignee_user_id?: string }) {
  return useQuery({ queryKey: ['hr', 'tickets', params], queryFn: () => vendorApi.hrListTickets(params), staleTime: 15_000 })
}
export function useMyTickets() {
  return useQuery({ queryKey: ['hr', 'my-tickets'], queryFn: vendorApi.hrMyTickets, staleTime: 15_000 })
}
export function useHRTicket(id: string | null) {
  return useQuery({ queryKey: ['hr', 'ticket', id], queryFn: () => vendorApi.hrGetTicket(id!), enabled: !!id })
}
export function useCreateTicket() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (d: Record<string, unknown>) => vendorApi.hrCreateTicket(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'tickets'] }); qc.invalidateQueries({ queryKey: ['hr', 'my-tickets'] }); toast.success('Ticket created') },
    onError: apiError('Could not create ticket') })
}
export function useUpdateTicket() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vendorApi.hrUpdateTicket(id, data),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['hr', 'tickets'] }); qc.invalidateQueries({ queryKey: ['hr', 'ticket', v.id] }); toast.success('Ticket updated') },
    onError: apiError('Could not update') })
}
export function useAddTicketComment() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, ...rest }: { id: string; body: string; is_internal?: boolean; attachment_url?: string }) =>
    vendorApi.hrAddTicketComment(id, rest),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['hr', 'ticket', v.id] }); qc.invalidateQueries({ queryKey: ['hr', 'tickets'] }); qc.invalidateQueries({ queryKey: ['hr', 'my-tickets'] }) },
    onError: apiError('Could not post reply') })
}
export function useDeleteTicket() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => vendorApi.hrDeleteTicket(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr', 'tickets'] }); toast.success('Ticket removed') },
    onError: apiError('Could not delete') })
}
