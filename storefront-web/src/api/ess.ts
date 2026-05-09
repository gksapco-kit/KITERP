import hrApiClient from './hrClient'

const base = '/store/hr/ess'

export const essApi = {
  getProfile: async () => {
    const res = await hrApiClient.get(`${base}/profile`)
    return res.data
  },

  getTodayAttendance: async () => {
    const res = await hrApiClient.get(`${base}/attendance/today`)
    return res.data
  },
  clockIn: async () => {
    const res = await hrApiClient.post(`${base}/attendance/clock-in`, {})
    return res.data
  },
  clockOut: async () => {
    const res = await hrApiClient.post(`${base}/attendance/clock-out`, {})
    return res.data
  },
  getAttendance: async (params?: { from_date?: string; to_date?: string }) => {
    const res = await hrApiClient.get(`${base}/attendance`, { params })
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
}
