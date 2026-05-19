import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { essApi } from '@/api/ess'

const K = {
  profile:       ['ess-profile'] as const,
  todayAtt:      ['ess-attendance-today'] as const,
  attendance:    (p?: Record<string, unknown>) => ['ess-attendance', p] as const,
  leaves:        ['ess-leaves'] as const,
  leavePolicies: ['ess-leave-policies'] as const,
  payslips:      (p?: Record<string, unknown>) => ['ess-payslips', p] as const,
  payslip:       (id: string) => ['ess-payslip', id] as const,
  training:      ['ess-training'] as const,
  performance:   ['ess-performance'] as const,
  expenses:      ['ess-expenses'] as const,
  tickets:       ['ess-tickets'] as const,
  announcements: ['ess-announcements'] as const,
  onboarding:    ['ess-onboarding'] as const,
  holidays:      (y?: number) => ['ess-holidays', y] as const,
  policy:        (id: string) => ['ess-policy', id] as const,
  enrollment:    (id: string) => ['ess-enrollment', id] as const,
  ticket:        (id: string) => ['ess-ticket', id] as const,
  review:        (id: string) => ['ess-review', id] as const,
}

export function useESSProfile() {
  return useQuery({ queryKey: K.profile, queryFn: essApi.getProfile, staleTime: 2 * 60 * 1000 })
}

export function useESSUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => essApi.updateProfile(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: K.profile })
      toast.success('Profile updated')
    },
    onError: () => toast.error('Could not update profile'),
  })
}

// ── Attendance ────────────────────────────────────────────────────────────────

export function useESSTodayAttendance() {
  return useQuery({ queryKey: K.todayAtt, queryFn: essApi.getTodayAttendance, refetchInterval: 60_000 })
}

export function useESSAttendance(params?: { from_date?: string; to_date?: string }) {
  return useQuery({ queryKey: K.attendance(params), queryFn: () => essApi.getAttendance(params) })
}

export function useESSClockIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: essApi.clockIn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: K.todayAtt })
      toast.success('Clocked in successfully')
    },
    onError: () => toast.error('Could not clock in — please try again'),
  })
}

export function useESSClockOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: essApi.clockOut,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: K.todayAtt })
      toast.success('Clocked out successfully')
    },
    onError: () => toast.error('Could not clock out — please try again'),
  })
}

// ── Leaves ────────────────────────────────────────────────────────────────────

export function useESSLeaves() {
  return useQuery({ queryKey: K.leaves, queryFn: essApi.getLeaves })
}

export function useESSLeavePolicies() {
  return useQuery({ queryKey: K.leavePolicies, queryFn: essApi.getLeavePolicies, staleTime: 10 * 60 * 1000 })
}

export function useESSSubmitLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => essApi.submitLeave(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: K.leaves })
      toast.success('Leave request submitted')
    },
    onError: () => toast.error('Could not submit leave request'),
  })
}

export function useESSCancelLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => essApi.cancelLeave(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: K.leaves })
      toast.success('Leave request cancelled')
    },
    onError: () => toast.error('Could not cancel leave request'),
  })
}

// ── Payslips ──────────────────────────────────────────────────────────────────

export function useESSPayslips(params?: Record<string, unknown>) {
  return useQuery({ queryKey: K.payslips(params), queryFn: () => essApi.getPayslips(params) })
}

export function useESSPayslip(id: string) {
  return useQuery({ queryKey: K.payslip(id), queryFn: () => essApi.getPayslip(id), enabled: !!id })
}

// ── Training ──────────────────────────────────────────────────────────────────

export function useESSTraining() {
  return useQuery({ queryKey: K.training, queryFn: essApi.getTraining })
}

export function useESSEnrollment(id: string | null) {
  return useQuery({
    queryKey: K.enrollment(id ?? ''),
    queryFn: () => essApi.getEnrollment(id!),
    enabled: !!id,
  })
}

export function useESSCompleteCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ eid, ...rest }: { eid: string; course_id: string; score_pct?: number; passed?: boolean; answers?: Record<string, unknown> }) =>
      essApi.completeCourse(eid, rest),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: K.enrollment(v.eid) })
      qc.invalidateQueries({ queryKey: K.training })
    },
    onError: () => toast.error('Could not save course progress'),
  })
}

// ── Performance ───────────────────────────────────────────────────────────────

export function useESSPerformance() {
  return useQuery({ queryKey: K.performance, queryFn: essApi.getPerformance })
}

export function useESSReview(id: string | null) {
  return useQuery({
    queryKey: K.review(id ?? ''),
    queryFn: () => essApi.getReview(id!),
    enabled: !!id,
  })
}

export function useESSSubmitSelfReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      essApi.submitSelfReview(id, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: K.review(v.id) })
      qc.invalidateQueries({ queryKey: K.performance })
      toast.success('Self-review submitted')
    },
    onError: () => toast.error('Could not submit self-review'),
  })
}

export function useESSAcknowledgeReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => essApi.acknowledgeReview(id, note),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: K.review(v.id) })
      qc.invalidateQueries({ queryKey: K.performance })
      toast.success('Review acknowledged')
    },
    onError: () => toast.error('Could not acknowledge review'),
  })
}

// ── Expenses ──────────────────────────────────────────────────────────────────

export function useESSExpenses() {
  return useQuery({ queryKey: K.expenses, queryFn: essApi.getExpenses })
}

export function useESSCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => essApi.createExpense(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: K.expenses })
      toast.success('Expense claim created')
    },
    onError: () => toast.error('Could not create expense claim'),
  })
}

export function useESSUpdateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => essApi.updateExpense(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: K.expenses })
      toast.success('Expense claim updated')
    },
    onError: () => toast.error('Could not update expense claim'),
  })
}

export function useESSDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => essApi.deleteExpense(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: K.expenses })
      toast.success('Expense claim deleted')
    },
    onError: () => toast.error('Could not delete expense claim'),
  })
}

// ── Compliance policies (ESS hub parity) ─────────────────────────────────────

export function useESSPolicy(id: string | null) {
  return useQuery({
    queryKey: K.policy(id ?? ''),
    queryFn: () => essApi.getPolicy(id!),
    enabled: !!id,
  })
}

export function useESSAcknowledgePolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (policyId: string) => essApi.acknowledgePolicy(policyId),
    onSuccess: (_d, policyId) => {
      qc.invalidateQueries({ queryKey: K.profile })
      qc.invalidateQueries({ queryKey: K.policy(policyId) })
      toast.success('Policy acknowledged')
    },
    onError: () => toast.error('Could not acknowledge policy'),
  })
}

export function useESSHolidays(year?: number) {
  return useQuery({
    queryKey: K.holidays(year),
    queryFn: () => essApi.getHolidays(year),
    staleTime: 10 * 60 * 1000,
  })
}

// ── Helpdesk ──────────────────────────────────────────────────────────────────

export function useESSTickets() {
  return useQuery({ queryKey: K.tickets, queryFn: essApi.getTickets })
}

export function useESSCreateTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => essApi.createTicket(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: K.tickets })
      toast.success('Ticket raised successfully')
    },
    onError: () => toast.error('Could not raise ticket'),
  })
}

export function useESSTicket(id: string | null) {
  return useQuery({
    queryKey: K.ticket(id ?? ''),
    queryFn: () => essApi.getTicket(id!),
    enabled: !!id,
  })
}

export function useESSAddTicketComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      essApi.addTicketComment(id, { body }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: K.ticket(v.id) })
      qc.invalidateQueries({ queryKey: K.tickets })
    },
    onError: () => toast.error('Could not post comment'),
  })
}

// ── Announcements ─────────────────────────────────────────────────────────────

export function useESSAnnouncements() {
  return useQuery({ queryKey: K.announcements, queryFn: essApi.getAnnouncements })
}

export function useESSMarkAnnouncementRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => essApi.markAnnouncementRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.announcements }),
  })
}

// ── Onboarding ────────────────────────────────────────────────────────────────

export function useESSOnboarding() {
  return useQuery({ queryKey: K.onboarding, queryFn: essApi.getOnboarding })
}

export function useESSUpdateOnboardingTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      essApi.updateOnboardingTask(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.onboarding }),
  })
}
