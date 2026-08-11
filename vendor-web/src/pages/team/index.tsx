import { useState, useMemo, useCallback } from 'react'
import { FormColumnLabel } from '@/components/common/FieldLabel'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { Label } from '@/components/ui/label'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { Link, useNavigate } from 'react-router-dom'
import { ResizableTable } from '@/components/table/ResizableTable'
import {
  Users, Plus, Shield, Mail, UserCheck,
  UserX, Pencil, Trash2, X, Phone,
  CheckCircle2, AlertCircle, RefreshCw, KeyRound, Store, UserCog,
  ExternalLink, Calendar, ChevronRight, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { PhoneInput } from '@/components/ui/PhoneInput'
import {
  useTeamMembers, useInviteTeamMember, useUpdateTeamMember,
  useRemoveTeamMember, useAssignableTeamRoles, useSendTeamVerification, useVerifyTeamMember,
  useHREmployees,
  useHREmployeesEligibleForAccess,
  useStores,
  vendorKeys,
} from '@/hooks/useVendor'
import {
  AccessWindowFields,
  TeamRoleSelect,
  parseRoleSelectValue,
  roleSelectValue,
  toDateInputValue,
  type AssignableTeamRoles,
} from '@/pages/team/teamRoleHelpers'
import type { EmployeeProfile } from '@/types'
import { useAuthStore } from '@/stores/authStore'
import { useVendorStore } from '@/stores/vendorStore'
import type { TeamMember } from '@/types'
import { TableToolbar } from '@/components/table/TableToolbar'
import { InlineEditCell } from '@/components/table/InlineEditCell'
import { useInlineFieldPatch, INLINE_EDIT_HINT } from '@/hooks/useInlineFieldPatch'
import { processRows, type SortDir } from '@/lib/tableList'
import { extractApiError } from '@/lib/errorMessages'
import { onClickableTableRow } from '@/lib/clickableTableRow'
import { employeeContactEmail, employeeContactPhone, employeeDisplayName } from '@/lib/hrEmployeeDisplay'
import {
  humanizeRoleSlug,
  pluralizeRoleLabel,
  roleBadgeColor,
  rolePermissionsPath,
  summarizePermissionsByModule,
} from '@/lib/vendorRoles'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'

import { askConfirm } from '@/components/common/ConfirmProvider'

type MemberUpdatePayload = {
  role?: string
  role_id?: string
  is_active?: boolean
  access_starts_at?: string | null
  access_ends_at?: string | null
  clear_access_ends_at?: boolean
}

export default function TeamPage() {
  const { user } = useAuthStore()
  const vendorId = useVendorStore((s) => s.vendor?.id)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: teamData, isLoading, isError, error, refetch } = useTeamMembers({ size: 100 })
  const { data: assignableData } = useAssignableTeamRoles()
  const assignableRoles: AssignableTeamRoles | undefined = assignableData
    ? { builtin_roles: assignableData.builtin_roles, custom_roles: assignableData.custom_roles }
    : undefined
  const { data: empData } = useHREmployees({ limit: 200 })
  const employeesByUserId = useMemo(() => {
    const map: Record<string, any> = {}
    for (const e of (empData?.items ?? [])) {
      if (e.vendor_user_id) map[e.vendor_user_id] = e
    }
    return map
  }, [empData])
  const inviteMutation = useInviteTeamMember()
  const updateMutation = useUpdateTeamMember()
  const removeMutation = useRemoveTeamMember()
  const sendOtpMutation = useSendTeamVerification()
  const verifyOtpMutation = useVerifyTeamMember()

  const { data: storesData } = useStores()
  const stores = storesData?.stores ?? []

  const assignStoreMutation = useMutation({
    mutationFn: ({ staffId, storeId }: { staffId: string; storeId: string | null }) =>
      vendorApi.assignStaffStore({ staff_id: staffId, store_id: storeId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team'] })
      qc.invalidateQueries({ queryKey: [...vendorKeys.all, 'stores'] })
    },
    onError: () => toast.error('Failed to update store assignment'),
  })

  const [showInvite, setShowInvite] = useState(false)
  const { data: eligibleEmpData } = useHREmployeesEligibleForAccess(
    { limit: 200 },
    { enabled: showInvite },
  )
  const [editMember, setEditMember] = useState<TeamMember | null>(null)
  const [viewMember, setViewMember] = useState<TeamMember | null>(null)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Post-invite OTP state
  const [otpModal, setOtpModal] = useState<{
    memberId: string
    otp: string
    contact: string
    channel: 'email' | 'phone'
    name: string
  } | null>(null)

  // Verify OTP state
  const [verifyModal, setVerifyModal] = useState<{
    memberId: string
    channel: 'email' | 'phone'
    contact: string
    name: string
  } | null>(null)
  const [verifyOtpInput, setVerifyOtpInput] = useState('')

  // Invite form state
  const [inviteForm, setInviteForm] = useState({
    email: '', full_name: '', phone: '', role: 'staff', role_id: '', password: '',
    access_starts_at: '', access_ends_at: '',
  })
  // Pre-fill from HR employee
  const [selectedEmpId, setSelectedEmpId] = useState('')

  const hrEmployeesForAccess = eligibleEmpData?.items ?? []

  const members = teamData?.items || []
  const customRoles = assignableRoles?.custom_roles ?? []

  const { savingCellKey, setSavingCellKey, cellKey, patchField: patchMemberField } = useInlineFieldPatch({
    mutateAsync: ({ id, data }) => updateMutation.mutateAsync({ id, data: data as MemberUpdatePayload }),
  })
  const isSaving = (id: string, field: string) => savingCellKey === cellKey(id, field)

  const roleOptions = useMemo(() => {
    const builtin = assignableRoles?.builtin_roles ?? []
    const custom = assignableRoles?.custom_roles ?? []
    return [
      ...builtin.map((r) => ({ value: r.slug, label: r.name })),
      ...custom.map((r) => ({ value: r.id, label: r.name })),
    ]
  }, [assignableRoles])

  const storeOptions = useMemo(
    () => [
      { value: '', label: 'All stores' },
      ...stores.map((s) => ({ value: s.id, label: s.name })),
    ],
    [stores],
  )

  const patchMemberRole = useCallback(async (memberId: string, selectValue: string) => {
    const parsed = parseRoleSelectValue(selectValue, customRoles)
    setSavingCellKey(`${memberId}:role`)
    try {
      await updateMutation.mutateAsync({ id: memberId, data: parsed })
    } finally {
      setSavingCellKey(null)
    }
  }, [customRoles, updateMutation, setSavingCellKey])

  const patchMemberStore = useCallback(async (memberId: string, storeId: string) => {
    setSavingCellKey(`${memberId}:store`)
    try {
      await assignStoreMutation.mutateAsync({ staffId: memberId, storeId: storeId || null })
    } finally {
      setSavingCellKey(null)
    }
  }, [assignStoreMutation, setSavingCellKey])

  const displayMembers = useMemo(
    () =>
      processRows(
        members,
        search,
        (m) => [
          m.user?.full_name || '',
          m.user?.email || '',
          m.user?.phone || '',
          m.role,
          m.role_name,
        ],
        sortKey,
        sortDir,
        {
          name: (m) => m.user?.full_name || '',
          email: (m) => m.user?.email || '',
          role: (m) => m.role,
          status: (m) => (m.is_active ? 1 : 0),
          created_at: (m) => (m.created_at ? new Date(m.created_at).getTime() : 0),
        },
      ),
    [members, search, sortKey, sortDir],
  )

  const canManageTeam = user?.vendor_role?.permissions?.includes('team.manage')
  const canInvite = user?.vendor_role?.permissions?.includes('team.invite')

  // Derived from the roles actually in use — any of the 21 built-in roles or a custom role can
  // appear, so a fixed list of four would leave members uncounted.
  const roleCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const m of members) counts.set(m.role, (counts.get(m.role) ?? 0) + 1)
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    const top = ranked.slice(0, 4).map(([role, count]) => ({
      key: role,
      label: role === 'custom' ? 'Custom roles' : pluralizeRoleLabel(humanizeRoleSlug(role)),
      count,
    }))
    const remainder = ranked.slice(4).reduce((sum, [, count]) => sum + count, 0)
    if (remainder > 0) {
      top[3] = { key: '__other__', label: `Other roles (${ranked.length - 3})`, count: remainder + top[3].count }
    }
    return top
  }, [members])

  const handleInvite = () => {
    inviteMutation.mutate({
      email: inviteForm.email,
      full_name: inviteForm.full_name,
      phone: inviteForm.phone || undefined,
      role: inviteForm.role,
      role_id: inviteForm.role === 'custom' ? inviteForm.role_id : undefined,
      password: inviteForm.password,
      access_starts_at: inviteForm.access_starts_at || undefined,
      access_ends_at: inviteForm.access_ends_at || undefined,
      employee_profile_id: selectedEmpId || undefined,
    }, {
      onSuccess: (data) => {
        setShowInvite(false)
        setSelectedEmpId('')
        setInviteForm({
          email: '', full_name: '', phone: '', role: 'staff', role_id: '', password: '',
          access_starts_at: '', access_ends_at: '',
        })
        // Show OTP to admin so they can share with the new member
        if (data._otp) {
          const channel: 'email' | 'phone' = (data.user?.phone && inviteForm.phone) ? 'phone' : 'email'
          setOtpModal({
            memberId: data.id,
            otp: data._otp,
            contact: channel === 'phone' ? data.user?.phone! : data.user?.email!,
            channel,
            name: data.user?.full_name || inviteForm.full_name,
          })
        } else if (data.user?.phone && inviteForm.phone) {
          toast.success(`Verification code sent to ${data.user.phone}`)
          setVerifyModal({
            memberId: data.id,
            channel: 'phone',
            contact: data.user.phone,
            name: data.user.full_name || inviteForm.full_name,
          })
        } else {
          toast.success('Team member added!')
        }
      },
    })
  }

  const handleSendOtp = async (member: TeamMember) => {
    const res = await sendOtpMutation.mutateAsync(member.id)
    const channel = res.channel as 'email' | 'phone'
    if ((res.sms_sent || res.email_sent) && !res.otp) {
      toast.success(`Verification code sent to ${res.contact}`)
      setVerifyModal({
        memberId: member.id,
        channel,
        contact: res.contact,
        name: member.user?.full_name || '',
      })
      return
    }
    setOtpModal({
      memberId: member.id,
      otp: res.otp ?? '',
      contact: res.contact,
      channel,
      name: member.user?.full_name || '',
    })
  }

  const handleVerify = () => {
    if (!verifyModal || verifyOtpInput.length !== 6) return
    verifyOtpMutation.mutate({
      memberId: verifyModal.memberId,
      otp: verifyOtpInput,
      channel: verifyModal.channel,
    }, {
      onSuccess: () => {
        setVerifyModal(null)
        setVerifyOtpInput('')
      },
    })
  }

  const handleUpdate = (memberId: string, data: MemberUpdatePayload) => {
    updateMutation.mutate({ id: memberId, data })
    setEditMember(null)
  }

  const handleToggleStatus = async (member: TeamMember) => {
    const nextActive = !member.is_active
    if (!await askConfirm(`${nextActive ? 'Activate' : 'Deactivate'} ${member.full_name || 'this team member'}?`)) return
    updateMutation.mutate({ id: member.id, data: { is_active: nextActive } })
  }

  const handleRemove = async (memberId: string) => {
    if (await askConfirm('Delete this team member permanently? This cannot be undone.')) {
      removeMutation.mutate(memberId)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-3 p-3 md:p-4">
      {/* Page header — title already shown in the top bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-xs text-muted-foreground">
          Manage users, roles, and permissions for your workspace
        </p>
        {canInvite && (
          <Button type="button" size="sm" className="h-8 gap-1.5" onClick={() => setShowInvite(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add Team Member
          </Button>
        )}
      </div>

      {/* Stats */}
      {roleCounts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {roleCounts.map((stat) => (
            <div key={stat.key} className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stat.count}</p>
            </div>
          ))}
        </div>
      )}

      {/* Members Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <TableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name, email, role…"
          sortOptions={[
            { value: 'name', label: 'Member' },
            { value: 'email', label: 'Email' },
            { value: 'role', label: 'Role' },
            { value: 'status', label: 'Status' },
            { value: 'created_at', label: 'Joined' },
          ]}
          sortKey={sortKey}
          sortDir={sortDir}
          onSortKeyChange={setSortKey}
          onSortDirChange={setSortDir}
          hint={INLINE_EDIT_HINT}
          className="border-0 border-b rounded-none bg-gray-50/80"
        />
        {(!vendorId || isLoading) ? (
          <div className="p-8 text-center text-gray-500">Loading team...</div>
        ) : isError ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-red-600">{extractApiError(error, 'Could not load team members')}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Retry
            </Button>
          </div>
        ) : displayMembers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {search.trim()
              ? 'No team members match your search'
              : members.length === 0
                ? 'No team members yet. Add your first team member to get started.'
                : 'No team members found'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <ResizableTable tableId="team" defaultWidths={[260, 200, 120, 140, 100, 120, 80]}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-3 font-medium text-gray-600"><TableColumnLabel>Member</TableColumnLabel></th>
                  <th className="text-left px-6 py-3 font-medium text-gray-600"><TableColumnLabel>Contact</TableColumnLabel></th>
                  <th className="text-left px-6 py-3 font-medium text-gray-600"><TableColumnLabel>Role</TableColumnLabel></th>
                  <th className="text-left px-6 py-3 font-medium text-gray-600"><TableColumnLabel>Store</TableColumnLabel></th>
                  <th className="text-left px-6 py-3 font-medium text-gray-600"><TableColumnLabel>Status</TableColumnLabel></th>
                  <th className="text-left px-6 py-3 font-medium text-gray-600"><TableColumnLabel>Joined</TableColumnLabel></th>
                  {canManageTeam && (
                    <th className="text-right px-6 py-3 font-medium text-gray-600"><TableColumnLabel>Actions</TableColumnLabel></th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayMembers.map((member) => {
                  const emailVerified = member.user?.is_email_verified
                  const phoneVerified = member.user?.is_phone_verified
                  const needsVerification = !emailVerified || (member.user?.phone && !phoneVerified)
                  return (
                  <tr
                    key={member.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={onClickableTableRow(() => setViewMember(member))}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                          {member.user?.full_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{member.user?.full_name || 'Unknown'}</p>
                          {needsVerification && (
                            <span className="inline-flex items-center gap-0.5 text-xs text-amber-600 font-medium">
                              <AlertCircle className="w-3 h-3" /> Unverified
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="truncate max-w-[160px]">{member.user?.email}</span>
                          {emailVerified
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                            : <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          }
                        </div>
                        {member.user?.phone && (
                          <div className="flex items-center gap-1 text-xs text-gray-600">
                            <Phone className="w-3 h-3 shrink-0" />
                            <span>{member.user.phone}</span>
                            {phoneVerified
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                              : <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            }
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {canManageTeam && member.role !== 'owner' && member.user_id !== user?.id ? (
                        <InlineEditCell
                          type="select"
                          value={roleSelectValue(member)}
                          options={roleOptions}
                          saving={isSaving(member.id, 'role')}
                          onSave={(v) => patchMemberRole(member.id, String(v))}
                        >
                          <button
                            type="button"
                            title="View role permissions"
                            onClick={() => navigate(rolePermissionsPath(member))}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-opacity hover:opacity-75 ${roleBadgeColor(member.role)}`}
                          >
                            <Shield className="w-3 h-3" />
                            {member.role_name}
                          </button>
                        </InlineEditCell>
                      ) : (
                        <button
                          type="button"
                          title="View role permissions"
                          onClick={() => navigate(rolePermissionsPath(member))}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-opacity hover:opacity-75 ${roleBadgeColor(member.role)}`}
                        >
                          <Shield className="w-3 h-3" />
                          {member.role_name}
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {stores.length > 0 ? (
                        canManageTeam && member.role !== 'owner' ? (
                          <InlineEditCell
                            type="select"
                            value={(member as TeamMember & { store_id?: string }).store_id ?? ''}
                            options={storeOptions}
                            saving={savingCellKey === `${member.id}:store`}
                            onSave={(v) => patchMemberStore(member.id, String(v))}
                            className="text-xs max-w-[140px]"
                          >
                            {(member as TeamMember & { store_name?: string }).store_name || 'All stores'}
                          </InlineEditCell>
                        ) : (
                          <span className="text-xs text-gray-600">
                            {(member as TeamMember & { store_name?: string }).store_name || 'All stores'}
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Store className="w-3 h-3" />No stores
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {canManageTeam && member.role !== 'owner' && member.user_id !== user?.id ? (
                        <InlineEditCell
                          type="select"
                          value={member.is_active ? 'true' : 'false'}
                          options={[
                            { value: 'true', label: 'Active' },
                            { value: 'false', label: 'Inactive' },
                          ]}
                          saving={isSaving(member.id, 'is_active')}
                          onSave={(v) => patchMemberField(member.id, 'is_active', v === 'true')}
                        >
                          {member.is_active ? (
                            <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                              <UserCheck className="w-3.5 h-3.5" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-500 text-xs font-medium">
                              <UserX className="w-3.5 h-3.5" /> Inactive
                            </span>
                          )}
                        </InlineEditCell>
                      ) : member.is_active ? (
                        <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                          <UserCheck className="w-3.5 h-3.5" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-500 text-xs font-medium">
                          <UserX className="w-3.5 h-3.5" /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs">
                      {member.created_at ? new Date(member.created_at).toLocaleDateString() : '-'}
                    </td>
                    {canManageTeam && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {needsVerification && (
                            <button
                              type="button"
                              onClick={() => handleSendOtp(member)}
                              disabled={sendOtpMutation.isPending}
                              className="p-1.5 rounded hover:bg-amber-50 text-amber-500"
                              title="Send verification OTP"
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>
                          )}
                          {employeesByUserId[member.id] ? (
                            <Link
                              to={`/hr/employees/${employeesByUserId[member.id].id}`}
                              className="p-1.5 rounded hover:bg-blue-50 text-blue-500"
                              title="HR Profile"
                            >
                              <UserCog className="w-4 h-4" />
                            </Link>
                          ) : null}
                          {member.role !== 'owner' && member.user_id !== user?.id && (
                            <>
                              <button
                                type="button"
                                onClick={() => setEditMember(member)}
                                className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                                title="Edit role"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemove(member.id)}
                                className="p-1.5 rounded hover:bg-red-50 text-red-500"
                                title="Delete permanently"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )})}
              </tbody>
            </ResizableTable>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <ModalOverlay onClose={() => setShowInvite(false)} className="z-[100] bg-black/60 p-3">
          <ModalPanel className="max-h-[calc(100dvh-1.5rem)] max-w-lg !rounded-lg overflow-hidden">
            <ModalHeader
              title="Add Team Member"
              onClose={() => setShowInvite(false)}
              className="border-0 px-4 py-2.5 [&>div>h2]:text-base [&>div>h2]:leading-none"
            />
            <ModalBody className="space-y-3 overflow-y-auto px-4 pb-1 pt-0">

              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <UserCog className="w-3.5 h-3.5 text-primary" /> Load from HR employee master
                  </label>
                  <Select
                    value={selectedEmpId}
                    onChange={(v) => {
                      const emp = hrEmployeesForAccess.find((x) => x.id === v)
                      setSelectedEmpId(v)
                      if (emp) {
                        setInviteForm(f => ({
                          ...f,
                          full_name: employeeDisplayName(emp),
                          email: employeeContactEmail(emp) || f.email,
                          phone: employeeContactPhone(emp) || f.phone,
                        }))
                      } else {
                        setInviteForm(f => ({ ...f, full_name: '', email: '', phone: '' }))
                      }
                    }}
                    options={selectOptionsWithBlank('— Manual entry (no HR profile) —', hrEmployeesForAccess.map((emp: any) => ({
                      value: emp.id,
                      label: `${employeeDisplayName(emp)}${emp.employee_code ? ` · ${emp.employee_code}` : ''}${employeeContactEmail(emp) ? ` · ${employeeContactEmail(emp)}` : ''}`,
                    })))}
                    placeholder="— Manual entry (no HR profile) —"
                    aria-label="Load from HR employee master"
                    className="w-full bg-primary/5"
                  />
                {hrEmployeesForAccess.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    No HR employees without portal access. Add them under HR → Employees first, or enter details manually.
                  </p>
                )}
              </div>

              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-1">Full Name</Label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={inviteForm.full_name}
                  onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</Label>
                  <PhoneInput
                    value={inviteForm.phone}
                    onChange={v => setInviteForm(f => ({ ...f, phone: v }))}
                  />
                </div>
              </div>
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-1">Password</Label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={inviteForm.password}
                  onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                  placeholder="Min 6 characters"
                />
              </div>
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-1">Role</Label>
                <TeamRoleSelect
                  assignable={assignableRoles}
                  value={inviteForm.role === 'custom' ? inviteForm.role_id : inviteForm.role}
                  onChange={(val) => {
                    const parsed = parseRoleSelectValue(val, customRoles)
                    setInviteForm(f => ({
                      ...f,
                      role: parsed.role,
                      role_id: parsed.role_id,
                    }))
                  }}
                />
              </div>
              <div>
                <FormColumnLabel className="tracking-wide mb-2">Access window</FormColumnLabel>
                <AccessWindowFields
                  accessStartsAt={inviteForm.access_starts_at}
                  accessEndsAt={inviteForm.access_ends_at}
                  onAccessStartsAtChange={(v) => setInviteForm(f => ({ ...f, access_starts_at: v }))}
                  onAccessEndsAtChange={(v) => setInviteForm(f => ({ ...f, access_ends_at: v }))}
                />
              </div>
              <p className="rounded-md bg-blue-50 px-2.5 py-1.5 text-xs text-gray-500">
                A 6-digit verification OTP will be generated after creation. Share it with the member to verify their contact.
              </p>
            </ModalBody>
            <ModalFooter className="border-0 px-4 py-2.5">
              <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => setShowInvite(false)}>Cancel</Button>
              <Button
                type="button"
                size="sm"
                className="h-8"
                onClick={handleInvite}
                disabled={!inviteForm.email || !inviteForm.full_name || !inviteForm.password || inviteMutation.isPending}
              >
                {inviteMutation.isPending ? 'Adding...' : 'Add Member'}
              </Button>
            </ModalFooter>
          </ModalPanel>
        </ModalOverlay>
      )}

      {/* OTP Display Modal — shown after member creation or send-verification */}
      {otpModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-sm text-center p-8 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <KeyRound className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Verification OTP</h2>
              <p className="text-sm text-gray-500 mt-1">
                Share this OTP with <span className="font-medium text-gray-700">{otpModal.name}</span> to verify their{' '}
                {otpModal.channel === 'phone' ? 'phone' : 'email'}:
                <span className="block text-xs text-gray-400 mt-0.5">{otpModal.contact}</span>
              </p>
            </div>
            <div className="font-mono text-4xl font-bold tracking-[0.4em] text-primary bg-primary/5 rounded-xl py-4 px-6">
              {otpModal.otp}
            </div>
            <p className="text-xs text-gray-400">Valid for 30 minutes</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setVerifyModal({
                    memberId: otpModal.memberId,
                    channel: otpModal.channel,
                    contact: otpModal.contact,
                    name: otpModal.name,
                  })
                  setOtpModal(null)
                }}
              >
                Enter OTP Now
              </Button>
              <Button className="flex-1" onClick={() => setOtpModal(null)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* OTP Verify Modal */}
      {verifyModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Enter OTP</h2>
              <button type="button" aria-label="Close" onClick={() => { setVerifyModal(null); setVerifyOtpInput('') }} className="p-1 rounded hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500">
              Enter the 6-digit OTP sent to {verifyModal.name}'s{' '}
              {verifyModal.channel === 'phone' ? 'phone' : 'email'}
              <span className="block text-xs font-medium text-gray-700 mt-0.5">{verifyModal.contact}</span>
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              className="w-full text-center font-mono text-3xl tracking-[0.5em] px-4 py-4 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-primary"
              value={verifyOtpInput}
              onChange={(e) => setVerifyOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="——————"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => {
                  sendOtpMutation.mutate(verifyModal.memberId, {
                    onSuccess: (res) => {
                      setOtpModal({
                        memberId: verifyModal.memberId,
                        otp: res.otp,
                        contact: res.contact,
                        channel: res.channel as 'email' | 'phone',
                        name: verifyModal.name,
                      })
                      setVerifyModal(null)
                      setVerifyOtpInput('')
                    },
                  })
                }}
                disabled={sendOtpMutation.isPending}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${sendOtpMutation.isPending ? 'animate-spin' : ''}`} />
                Resend OTP
              </Button>
              <Button
                className="flex-1"
                onClick={handleVerify}
                disabled={verifyOtpInput.length !== 6 || verifyOtpMutation.isPending}
              >
                {verifyOtpMutation.isPending ? 'Verifying...' : 'Verify'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editMember && (
        <EditRoleModal
          member={editMember}
          assignableRoles={assignableRoles}
          onSave={(data) => handleUpdate(editMember.id, data)}
          onClose={() => setEditMember(null)}
          isPending={updateMutation.isPending}
        />
      )}

      {/* Member Detail Drawer */}
      {viewMember && (
        <MemberDetailDrawer
          member={viewMember}
          assignableRoles={assignableRoles}
          hrEmployee={employeesByUserId[viewMember.id] as EmployeeProfile | undefined}
          stores={stores}
          canManage={!!canManageTeam}
          isSelf={viewMember.user_id === user?.id}
          employeeId={employeesByUserId[viewMember.id]?.id ?? null}
          onClose={() => setViewMember(null)}
          onSave={(data) => { handleUpdate(viewMember.id, data); setViewMember(null) }}
          onRemove={() => { handleRemove(viewMember.id); setViewMember(null) }}
          onSendOtp={() => handleSendOtp(viewMember)}
          onStoreChange={(storeId) => assignStoreMutation.mutate({ staffId: viewMember.id, storeId })}
          isSaving={updateMutation.isPending}
        />
      )}
    </div>
  )
}

function MemberDetailDrawer({
  member,
  assignableRoles,
  hrEmployee,
  stores,
  canManage,
  isSelf,
  employeeId,
  onClose,
  onSave,
  onRemove,
  onSendOtp,
  onStoreChange,
  isSaving,
}: {
  member: TeamMember
  assignableRoles: AssignableTeamRoles | undefined
  hrEmployee?: EmployeeProfile
  stores: { id: string; name: string; code?: string }[]
  canManage: boolean
  isSelf: boolean
  employeeId: string | null
  onClose: () => void
  onSave: (data: {
    role?: string
    role_id?: string
    is_active?: boolean
    access_starts_at?: string | null
    access_ends_at?: string | null
    clear_access_ends_at?: boolean
  }) => void
  onRemove: () => void
  onSendOtp: () => void
  onStoreChange: (storeId: string | null) => void
  isSaving: boolean
}) {
  const customRoles = assignableRoles?.custom_roles ?? []
  const initValue = roleSelectValue(member)
  const [selectValue, setSelectValue] = useState(initValue)
  const [isActive, setIsActive] = useState(member.is_active)
  const [accessStartsAt, setAccessStartsAt] = useState(toDateInputValue(member.access_starts_at))
  const [accessEndsAt, setAccessEndsAt] = useState(toDateInputValue(member.access_ends_at))
  const [endSource, setEndSource] = useState(member.access_end_source ?? null)

  const permissionSummary = useMemo(
    () => summarizePermissionsByModule(member.permissions ?? []),
    [member.permissions],
  )

  const hrLwd = hrEmployee?.lwd ? toDateInputValue(hrEmployee.lwd) : null
  const parsed = parseRoleSelectValue(selectValue, customRoles)
  const role = parsed.role
  const roleId = parsed.role_id

  const emailVerified = member.user?.is_email_verified
  const phoneVerified = member.user?.is_phone_verified
  const needsVerification = !emailVerified || (member.user?.phone && !phoneVerified)
  const isOwner = member.role === 'owner'
  const canEdit = canManage && !isOwner && !isSelf
  const isDirty =
    selectValue !== initValue
    || isActive !== member.is_active
    || accessStartsAt !== toDateInputValue(member.access_starts_at)
    || accessEndsAt !== toDateInputValue(member.access_ends_at)

  const buildSavePayload = () => {
    const payload: Parameters<typeof onSave>[0] = {
      role,
      role_id: roleId || undefined,
      is_active: isActive,
    }
    if (accessStartsAt !== toDateInputValue(member.access_starts_at)) {
      payload.access_starts_at = accessStartsAt || null
    }
    const prevEnd = toDateInputValue(member.access_ends_at)
    if (accessEndsAt !== prevEnd) {
      if (!accessEndsAt) {
        payload.clear_access_ends_at = true
      } else {
        payload.access_ends_at = accessEndsAt
      }
    }
    return payload
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-card border-l border-border text-foreground shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Member Details
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-gray-100" aria-label="Close">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Avatar + Name */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl shrink-0">
              {member.user?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-base truncate">{member.user?.full_name || 'Unknown'}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${roleBadgeColor(member.role)}`}>
                  <Shield className="w-3 h-3" />
                  {member.role_name}
                </span>
                {isActive ? (
                  <span className="inline-flex items-center gap-0.5 text-xs text-green-600 font-medium">
                    <UserCheck className="w-3 h-3" /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-xs text-red-500 font-medium">
                    <UserX className="w-3 h-3" /> Inactive
                  </span>
                )}
              </div>
              {needsVerification && (
                <span className="inline-flex items-center gap-0.5 text-xs text-amber-600 font-medium mt-0.5">
                  <AlertCircle className="w-3 h-3" /> Unverified
                </span>
              )}
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-2">
            <FormColumnLabel className="tracking-wide">Contact</FormColumnLabel>
            <div className="space-y-2 bg-white border border-gray-100 rounded-xl divide-y divide-gray-50">
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="truncate max-w-[220px]">{member.user?.email || '—'}</span>
                </div>
                {emailVerified
                  ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  : <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                }
              </div>
              {member.user?.phone && (
                <div className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                    <span>{member.user.phone}</span>
                  </div>
                  {phoneVerified
                    ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    : <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  }
                </div>
              )}
              {member.created_at && (
                <div className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600">
                  <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                  Joined {new Date(member.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                </div>
              )}
            </div>
          </div>

          {/* Store Assignment */}
          {stores.length > 0 && (
            <div className="space-y-2">
              <FormColumnLabel className="tracking-wide">Store Assignment</FormColumnLabel>
              <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-100 rounded-xl">
                <Store className="w-4 h-4 text-gray-400 shrink-0" />
                <Select
                  value={(member as TeamMember & { store_id?: string }).store_id ?? ''}
                  onChange={(v) => onStoreChange(v || null)}
                  options={selectOptionsWithBlank('All stores', stores.map(s => ({
                    value: s.id,
                    label: `${s.name}${s.code ? ` · ${s.code}` : ''}`,
                  })))}
                  placeholder="All stores"
                  aria-label="Store assignment"
                  className="flex-1 border-0 bg-transparent shadow-none"
                />
              </div>
            </div>
          )}

          {/* Role & Access */}
          {canEdit ? (
            <div className="space-y-3">
              <FormColumnLabel className="tracking-wide">Role & Access</FormColumnLabel>
              <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-1">Role</Label>
                  <TeamRoleSelect
                    assignable={assignableRoles}
                    value={selectValue}
                    onChange={setSelectValue}
                  />
                  <AccessWindowFields
                    accessStartsAt={accessStartsAt}
                    accessEndsAt={accessEndsAt}
                    onAccessStartsAtChange={setAccessStartsAt}
                    onAccessEndsAtChange={(v) => {
                      setAccessEndsAt(v)
                      setEndSource('manual')
                    }}
                    hrLwd={hrLwd}
                    accessEndSource={endSource ?? member.access_end_source}
                    accessSyncNote={member.access_sync_note}
                    onApplyHrLwd={hrLwd ? () => {
                      setAccessEndsAt(hrLwd)
                      setEndSource('hr_lwd')
                    } : undefined}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 border-2 border-gray-300 bg-gray-200 dark:border-gray-500 dark:bg-gray-600 peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:shadow after:ring-1 after:ring-black/5 after:transition-all peer-checked:border-transparent peer-checked:bg-primary" />
                  </label>
                  <span className="text-sm text-gray-700">Active</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <FormColumnLabel className="tracking-wide">Role & Access</FormColumnLabel>
              <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Role:</span> {member.role_name}
                </p>
                <AccessWindowFields
                  accessStartsAt={toDateInputValue(member.access_starts_at)}
                  accessEndsAt={toDateInputValue(member.access_ends_at)}
                  onAccessStartsAtChange={() => {}}
                  onAccessEndsAtChange={() => {}}
                  hrLwd={hrLwd}
                  accessEndSource={member.access_end_source}
                  accessSyncNote={member.access_sync_note}
                  disabled
                />
              </div>
            </div>
          )}

          {/* App Permissions */}
          <div className="space-y-2">
            <FormColumnLabel className="tracking-wide">App Permissions</FormColumnLabel>
            <div className="rounded-xl border border-gray-100 bg-white p-4 space-y-3">
              {permissionSummary.length === 0 ? (
                <p className="text-sm text-gray-500">
                  This role grants no app permissions yet.
                </p>
              ) : (
                <>
                  <p className="text-xs text-gray-500">
                    <span className="font-medium text-gray-700">{member.permissions.length}</span>
                    {' '}permission{member.permissions.length === 1 ? '' : 's'} across{' '}
                    <span className="font-medium text-gray-700">{permissionSummary.length}</span>
                    {' '}app{permissionSummary.length === 1 ? '' : 's'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {permissionSummary.map((mod) => (
                      <span
                        key={mod.module}
                        className="inline-flex items-center gap-1 rounded-full bg-gray-50 border border-gray-100 px-2 py-0.5 text-xs text-gray-700"
                      >
                        {mod.label}
                        <span className="text-gray-400">{mod.count}</span>
                      </span>
                    ))}
                  </div>
                </>
              )}
              <Link
                to={rolePermissionsPath(member)}
                onClick={onClose}
                className="flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
              >
                <span className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  View full permission matrix
                </span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* HR Profile Link */}
          {employeeId && (
            <div className="space-y-2">
              <FormColumnLabel className="tracking-wide">HR Profile</FormColumnLabel>
              <Link
                to={`/hr/employees/${employeeId}`}
                onClick={onClose}
                className="flex items-center justify-between px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm text-blue-700 font-medium">
                  <UserCog className="w-4 h-4" />
                  View Full HR Employee Profile
                </div>
                <ExternalLink className="w-4 h-4 text-blue-500" />
              </Link>
            </div>
          )}

          {/* Verification */}
          {needsVerification && canManage && (
            <div className="space-y-2">
              <FormColumnLabel className="tracking-wide">Verification</FormColumnLabel>
              <button
                type="button"
                onClick={() => { onSendOtp(); onClose() }}
                className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl hover:bg-amber-100 transition-colors text-sm text-amber-700 font-medium"
              >
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  Send Verification OTP
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center gap-3">
          {canEdit && (
            <button
              type="button"
              onClick={onRemove}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors border border-red-100"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>Close</Button>
          {canEdit && (
            <Button
              onClick={() => onSave(buildSavePayload())}
              disabled={isSaving || !isDirty}
            >
              {isSaving ? 'Saving…' : 'Save Changes'}
            </Button>
          )}
        </div>
      </div>
    </>
  )
}

function EditRoleModal({
  member,
  assignableRoles,
  onSave,
  onClose,
  isPending,
}: {
  member: TeamMember
  assignableRoles: AssignableTeamRoles | undefined
  onSave: (data: {
    role?: string
    role_id?: string
    is_active?: boolean
    access_starts_at?: string | null
    access_ends_at?: string | null
    clear_access_ends_at?: boolean
  }) => void
  onClose: () => void
  isPending: boolean
}) {
  const customRoles = assignableRoles?.custom_roles ?? []
  const initValue = roleSelectValue(member)
  const [selectValue, setSelectValue] = useState(initValue)
  const [isActive, setIsActive] = useState(member.is_active)
  const [accessStartsAt, setAccessStartsAt] = useState(toDateInputValue(member.access_starts_at))
  const [accessEndsAt, setAccessEndsAt] = useState(toDateInputValue(member.access_ends_at))

  const parsed = parseRoleSelectValue(selectValue, customRoles)
  const role = parsed.role
  const roleId = parsed.role_id

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Edit Member Role</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
              {member.user?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">{member.user?.full_name}</p>
              <p className="text-xs text-gray-500">{member.user?.email}</p>
            </div>
          </div>
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-1">Role</Label>
            <TeamRoleSelect
              assignable={assignableRoles}
              value={selectValue}
              onChange={setSelectValue}
            />
          </div>
          <AccessWindowFields
            accessStartsAt={accessStartsAt}
            accessEndsAt={accessEndsAt}
            onAccessStartsAtChange={setAccessStartsAt}
            onAccessEndsAtChange={setAccessEndsAt}
            accessSyncNote={member.access_sync_note}
            accessEndSource={member.access_end_source}
          />
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 border-2 border-gray-300 bg-gray-200 dark:border-gray-500 dark:bg-gray-600 peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:shadow after:ring-1 after:ring-black/5 after:transition-all peer-checked:border-transparent peer-checked:bg-primary" />
            </label>
            <span className="text-sm text-gray-700">Active</span>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl shrink-0">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onSave({
              role,
              role_id: roleId || undefined,
              is_active: isActive,
              access_starts_at: accessStartsAt || null,
              access_ends_at: accessEndsAt || null,
              clear_access_ends_at: !accessEndsAt && !!member.access_ends_at,
            })}
            disabled={isPending}
          >
            {isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}
