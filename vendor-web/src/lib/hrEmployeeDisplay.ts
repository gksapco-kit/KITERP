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

export function employeeContactPhone(emp: EmployeeProfile | Record<string, unknown>): string {
  const e = emp as EmployeeProfile
  return (
    e.vendor_user?.user?.phone ||
    e.personal_phone ||
    ''
  ).trim()
}
