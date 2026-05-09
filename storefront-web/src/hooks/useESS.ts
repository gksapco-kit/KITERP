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
}

export function useESSProfile() {
  return useQuery({ queryKey: K.profile, queryFn: essApi.getProfile, staleTime: 2 * 60 * 1000 })
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

// ── Performance ───────────────────────────────────────────────────────────────

export function useESSPerformance() {
  return useQuery({ queryKey: K.performance, queryFn: essApi.getPerformance })
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

export function useESSAcknowledgePolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (policyId: string) => essApi.acknowledgePolicy(policyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: K.profile })
      toast.success('Policy acknowledged')
    },
    onError: () => toast.error('Could not acknowledge policy'),
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
