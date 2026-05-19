import type { ElementType } from 'react'
import {
  Briefcase, Lock, MapPin, Landmark, ShieldCheck, Users, Heart, Paperclip, FileText,
  Plane, DollarSign, Receipt, LogOut,
} from 'lucide-react'

export type EmployeeMasterTabId =
  | 'identity'
  | 'credentials'
  | 'addresses'
  | 'bank'
  | 'kyc'
  | 'personal'
  | 'family'
  | 'documents'
  | 'notes'

export type EmployeeOpsTabId = 'leaves' | 'salary' | 'payslips' | 'exit'

export type EmployeeTabId = EmployeeMasterTabId | EmployeeOpsTabId

export const EMPLOYEE_MASTER_TABS: { id: EmployeeMasterTabId; label: string; icon: ElementType }[] = [
  { id: 'identity', label: 'Identity', icon: Briefcase },
  { id: 'credentials', label: 'Credentials', icon: Lock },
  { id: 'addresses', label: 'Addresses', icon: MapPin },
  { id: 'bank', label: 'Bank Details', icon: Landmark },
  { id: 'kyc', label: 'KYC & Legal', icon: ShieldCheck },
  { id: 'personal', label: 'Personal', icon: Users },
  { id: 'family', label: 'Family', icon: Heart },
  { id: 'documents', label: 'Documents', icon: Paperclip },
  { id: 'notes', label: 'Notes', icon: FileText },
]

export const EMPLOYEE_OPS_TABS: { id: EmployeeOpsTabId; label: string; icon: ElementType }[] = [
  { id: 'leaves', label: 'Leaves', icon: Plane },
  { id: 'salary', label: 'Salary', icon: DollarSign },
  { id: 'payslips', label: 'Payslips', icon: Receipt },
  { id: 'exit', label: 'Exit', icon: LogOut },
]

const TAB_ALIASES: Record<string, EmployeeTabId> = {
  employment: 'identity',
}

const ALL_TAB_IDS = new Set<string>([
  ...EMPLOYEE_MASTER_TABS.map(t => t.id),
  ...EMPLOYEE_OPS_TABS.map(t => t.id),
])

export function resolveEmployeeTab(tab: string | null | undefined): EmployeeTabId {
  if (!tab) return 'identity'
  const resolved = TAB_ALIASES[tab] ?? tab
  if (ALL_TAB_IDS.has(resolved)) return resolved as EmployeeTabId
  return 'identity'
}
