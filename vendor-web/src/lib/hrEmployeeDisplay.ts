import type { EmployeeProfile } from '@/types'

/** Display name for HR master records (with or without portal login). */
export function employeeDisplayName(emp: {
  full_name?: string | null
  employee_code?: string | null
  vendor_user?: { user?: { full_name?: string | null } | null } | null
}): string {
  const fromHr = (emp.full_name || '').trim()
  if (fromHr) return fromHr
  const fromUser = (emp.vendor_user?.user?.full_name || '').trim()
  if (fromUser) return fromUser
  return emp.employee_code || 'Employee'
}

export function employeeContactEmail(emp: EmployeeProfile | Record<string, unknown>): string {
  const e = emp as EmployeeProfile
  return (
    e.vendor_user?.user?.email ||
    e.personal_email ||
    ''
  ).trim()
}

const OPTIONAL_EMPLOYEE_DATE_KEYS = [
  'date_of_birth',
  'date_of_joining',
  'date_of_exit',
  'probation_end_date',
  'lwd',
] as const

/** Empty date inputs → null so optional HR dates are not sent as "". */
export function sanitizeEmployeeUpdatePayload(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...data }
  for (const key of OPTIONAL_EMPLOYEE_DATE_KEYS) {
    if (key in out && (out[key] === '' || out[key] === undefined)) {
      out[key] = null
    }
  }
  return out
}

export function employeeContactPhone(emp: EmployeeProfile | Record<string, unknown>): string {
  const e = emp as EmployeeProfile
  return (
    e.vendor_user?.user?.phone ||
    e.personal_phone ||
    ''
  ).trim()
}
