import hrApiClient from './hrClient'

const base = '/store/hr/ess'

export const essApi = {
  getProfile: async () => {
    const res = await hrApiClient.get(`${base}/profile`)
    return res.data
  },
  updateProfile: async (data: Record<string, unknown>) => {
    const res = await hrApiClient.patch(`${base}/profile`, data)
    return res.data
  },

  getTodayAttendance: async () => {
    const res = await hrApiClient.get(`${base}/attendance/today`)
    return res.data
  },
  clockIn: async (location?: { lat: number; lng: number; accuracy?: number }) => {
    const res = await hrApiClient.post(`${base}/attendance/clock-in`, { location: location ?? null })
    return res.data
  },
  clockOut: async (location?: { lat: number; lng: number; accuracy?: number }) => {
    const res = await hrApiClient.post(`${base}/attendance/clock-out`, { location: location ?? null })
    return res.data
  },
  sendLocationPing: async (payload: {
    lat: number
    lng: number
    accuracy?: number
    speed?: number
    heading?: number
    battery?: number
    source?: string
  }) => {
    await hrApiClient.post(`${base}/tracking/ping`, { ...payload, source: payload.source ?? 'web' })
  },
  getAttendance: async (params?: { from_date?: string; to_date?: string }) => {
    const res = await hrApiClient.get(`${base}/attendance`, { params })
    return res.data
  },
  markAttendance: async (data: { date: string; status: string; notes?: string }) => {
    const res = await hrApiClient.post(`${base}/attendance/mark`, data)
    return res.data
  },
  markAttendanceRange: async (data: {
    from_date: string
    to_date: string
    status: string
    notes?: string
    skip_weekends?: boolean
    skip_existing?: boolean
  }) => {
    const res = await hrApiClient.post(`${base}/attendance/mark-range`, data)
    return res.data
  },

  getLeaves: async () => {
    const res = await hrApiClient.get(`${base}/leaves`)
    return res.data
  },
  getLeavePolicies: async () => {
    const res = await hrApiClient.get(`${base}/leave-policies`)
    return res.data
  },
  submitLeave: async (data: Record<string, unknown>) => {
    const res = await hrApiClient.post(`${base}/leaves`, data)
    return res.data
  },
  cancelLeave: async (id: string) => {
    const res = await hrApiClient.delete(`${base}/leaves/${id}/cancel`)
    return res.data
  },

  getPayslips: async (params?: Record<string, unknown>) => {
    const res = await hrApiClient.get(`${base}/payslips`, { params })
    return res.data
  },
  getPayslip: async (id: string) => {
    const res = await hrApiClient.get(`${base}/payslips/${id}`)
    return res.data
  },

  getTraining: async () => {
    const res = await hrApiClient.get(`${base}/training`)
    return res.data
  },

  /** Open certificate HTML in a new tab (sends employee Bearer token via XHR). */
  openCertificateInNewTab: async (certId: string) => {
    const res = await hrApiClient.get(`${base}/training/certificates/${certId}`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 120_000)
  },

  getPerformance: async () => {
    const res = await hrApiClient.get(`${base}/performance`)
    return res.data
  },

  uploadExpenseReceipt: async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await hrApiClient.post(`${base}/expenses/receipt`, form, { timeout: 0 })
    return res.data as { url: string; name: string; content_type?: string; is_image?: boolean; size?: number }
  },

  getExpenses: async () => {
    const res = await hrApiClient.get(`${base}/expenses`)
    return res.data
  },
  createExpense: async (data: Record<string, unknown>) => {
    const res = await hrApiClient.post(`${base}/expenses`, data)
    return res.data
  },
  updateExpense: async (id: string, data: Record<string, unknown>) => {
    const res = await hrApiClient.put(`${base}/expenses/${id}`, data)
    return res.data
  },
  deleteExpense: async (id: string) => {
    await hrApiClient.delete(`${base}/expenses/${id}`)
  },

  getTickets: async () => {
    const res = await hrApiClient.get(`${base}/helpdesk`)
    return res.data
  },
  createTicket: async (data: Record<string, unknown>) => {
    const res = await hrApiClient.post(`${base}/helpdesk`, data)
    return res.data
  },

  getAnnouncements: async () => {
    const res = await hrApiClient.get(`${base}/announcements`)
    return res.data
  },
  markAnnouncementRead: async (id: string) => {
    await hrApiClient.put(`${base}/announcements/${id}/read`, {})
  },

  getOnboarding: async () => {
    const res = await hrApiClient.get(`${base}/onboarding`)
    return res.data
  },
  updateOnboardingTask: async (id: string, data: Record<string, unknown>) => {
    const res = await hrApiClient.put(`${base}/onboarding/tasks/${id}`, data)
    return res.data
  },

  acknowledgePolicy: async (policyId: string) => {
    const res = await hrApiClient.post(`${base}/policies/${policyId}/acknowledge`, {})
    return res.data
  },
  getPolicy: async (id: string) => {
    const res = await hrApiClient.get(`${base}/policies/${id}`)
    return res.data
  },

  getHolidays: async (year?: number) => {
    const res = await hrApiClient.get(`${base}/holidays`, { params: year ? { year } : {} })
    return res.data
  },

  getEnrollment: async (id: string) => {
    const res = await hrApiClient.get(`${base}/training/enrollments/${id}`)
    return res.data
  },
  completeCourse: async (enrollmentId: string, data: Record<string, unknown>) => {
    const res = await hrApiClient.post(`${base}/training/enrollments/${enrollmentId}/complete-course`, data)
    return res.data
  },

  getTicket: async (id: string) => {
    const res = await hrApiClient.get(`${base}/helpdesk/${id}`)
    return res.data
  },
  addTicketComment: async (id: string, body: { body: string }) => {
    const res = await hrApiClient.post(`${base}/helpdesk/${id}/comments`, body)
    return res.data
  },

  getReview: async (id: string) => {
    const res = await hrApiClient.get(`${base}/performance/reviews/${id}`)
    return res.data
  },
  submitSelfReview: async (id: string, data: Record<string, unknown>) => {
    const res = await hrApiClient.put(`${base}/performance/reviews/${id}/self`, data)
    return res.data
  },
  acknowledgeReview: async (id: string, note?: string) => {
    const res = await hrApiClient.put(`${base}/performance/reviews/${id}/acknowledge`, { note })
    return res.data
  },
}
