import apiClient from './client'

export interface VendorPlan {
  id: string
  name: string
  slug: string
  description?: string
  price_monthly: number
  price_yearly?: number
  currency: string
  max_products: number
  max_services: number
  max_team_members: number
  max_storage_mb: number
  max_apps?: number
  features: Record<string, boolean>
  is_active: boolean
  is_featured: boolean
  sort_order: number
}

export interface PlanCreate {
  name: string
  slug: string
  description?: string
  price_monthly: number
  price_yearly?: number
  currency?: string
  max_products?: number
  max_services?: number
  max_team_members?: number
  max_storage_mb?: number
  features?: Record<string, boolean>
  is_active?: boolean
  is_featured?: boolean
}

/** Partial update for PUT /admin/plans/:id */
export interface PlanUpdate {
  name?: string
  slug?: string
  description?: string | null
  price_monthly?: number
  price_yearly?: number | null
  currency?: string
  max_products?: number
  max_services?: number
  max_team_members?: number
  max_storage_mb?: number
  max_apps?: number
  features?: Record<string, boolean>
  is_active?: boolean
  is_featured?: boolean
  sort_order?: number
}

export interface BillingSubscription {
  vendor_id: string
  business_name: string
  display_name: string
  email?: string
  plan_name?: string | null
  plan_slug?: string | null
  price_monthly?: number | null
  currency: string
  max_apps?: number | null
  billing_status?: string
  access_mode?: string
  plan_expires_at?: string | null
  in_grace?: boolean
  grace_until?: string | null
  days_left?: number | null
  last_payment_at?: string | null
  last_payment_amount?: number | null
  period_start?: string | null
  period_end?: string | null
  razorpay_payment_id?: string | null
}

export interface BillingPayment {
  id: string
  vendor_id: string
  vendor_name: string
  vendor_email?: string | null
  business_name?: string | null
  plan_name?: string | null
  amount: number
  currency: string
  status: string
  razorpay_order_id?: string | null
  razorpay_payment_id?: string | null
  period_start?: string | null
  period_end?: string | null
  created_at?: string | null
}

export interface BillingOverview {
  totals: {
    collected: number
    currency: string
    payment_count: number
    active_subscriptions: number
    in_grace: number
    expired: number
    unassigned: number
    by_plan: Array<{ slug: string; name: string; vendors: number; collected: number }>
  }
  subscriptions: BillingSubscription[]
  payments: BillingPayment[]
}

export interface VendorPlanInfo {
  vendor_id: string
  plan: VendorPlan | null
  message?: string
}

export const plansApi = {
  list: async (): Promise<VendorPlan[]> => {
    const res = await apiClient.get('/admin/plans')
    return res.data
  },

  create: async (data: PlanCreate): Promise<VendorPlan> => {
    const res = await apiClient.post('/admin/plans', data)
    return res.data
  },

  update: async (planId: string, data: PlanUpdate): Promise<VendorPlan> => {
    const res = await apiClient.put(`/admin/plans/${planId}`, data)
    return res.data
  },

  delete: async (planId: string): Promise<void> => {
    await apiClient.delete(`/admin/plans/${planId}`)
  },

  updateFeatures: async (planId: string, features: Record<string, boolean>): Promise<VendorPlan> => {
    const res = await apiClient.put(`/admin/plans/${planId}/features`, { features })
    return res.data
  },

  getVendorPlan: async (vendorId: string): Promise<VendorPlanInfo> => {
    const res = await apiClient.get(`/admin/vendors/${vendorId}/plan`)
    return res.data
  },

  billingOverview: async (): Promise<BillingOverview> => {
    const res = await apiClient.get('/admin/billing/overview')
    return res.data
  },

  assignPlanToVendor: async (vendorId: string, planId: string): Promise<unknown> => {
    const res = await apiClient.put(`/admin/vendors/${vendorId}/plan`, { plan_id: planId })
    return res.data
  },
}
