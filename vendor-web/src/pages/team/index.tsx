import { useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ResizableTable } from '@/components/table/ResizableTable'
import {
  Users, Plus, Shield, Mail, UserCheck,
  UserX, Pencil, Trash2, X, Phone,
  CheckCircle2, AlertCircle, RefreshCw, KeyRound, Store, UserCog,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PhoneInput } from '@/components/ui/PhoneInput'
import {
  useTeamMembers, useInviteTeamMember, useUpdateTeamMember,
  useRemoveTeamMember, useRoles, useSendTeamVerification, useVerifyTeamMember,
  useHREmployees,
  useStores,
  vendorKeys,
} from '@/hooks/useVendor'
import { useAuthStore } from '@/stores/authStore'
import type { TeamMember } from '@/types'
import { TableToolbar } from '@/components/table/TableToolbar'
import { processRows, type SortDir } from '@/lib/tableList'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'

const SYSTEM_ROLES = ['owner', 'admin', 'manager', 'sales', 'staff']

const roleColors: Record<string, string> = {
  owner: 'bg-primary/12 text-primary',
  admin: 'bg-blue-100 text-blue-700',
  manager: 'bg-green-100 text-green-700',
  sales: 'bg-amber-100 text-amber-700',
  staff: 'bg-gray-100 text-gray-700',
  custom: 'bg-indigo-100 text-indigo-700',
}

export default function TeamPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const { data: teamData, isLoading } = useTeamMembers()
  const { data: rolesData } = useRoles()
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
  const [editMember, setEditMember] = useState<TeamMember | null>(null)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

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
  })

  const members = teamData?.items || []
  const customRoles = rolesData?.roles || []

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
          created_at: (m) => m.created_at || '',
        },
      ),
    [members, search, sortKey, sortDir],
  )

  const canManageTeam = user?.vendor_role?.permissions?.includes('team.manage')
  const canInvite = user?.vendor_role?.permissions?.includes('team.invite')

  const handleInvite = () => {
    inviteMutation.mutate({
      email: inviteForm.email,
      full_name: inviteForm.full_name,
      phone: inviteForm.phone || undefined,
      role: inviteForm.role,
      role_id: inviteForm.role === 'custom' ? inviteForm.role_id : undefined,
      password: inviteForm.password,
    }, {
      onSuccess: (data) => {
        setShowInvite(false)
        setInviteForm({ email: '', full_name: '', phone: '', role: 'staff', role_id: '', password: '' })
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
        } else {
          toast.success('Team member added!')
        }
      },
    })
  }

  const handleSendOtp = async (member: TeamMember) => {
    const res = await sendOtpMutation.mutateAsync(member.id)
    setOtpModal({
      memberId: member.id,
      otp: res.otp,
      contact: res.contact,
      channel: res.channel as 'email' | 'phone',
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

  const handleUpdate = (memberId: string, data: { role?: string; role_id?: string; is_active?: boolean }) => {
    updateMutation.mutate({ id: memberId, data })
    setEditMember(null)
  }

  const handleRemove = (memberId: string) => {
    if (confirm('Are you sure you want to remove this team member?')) {
      removeMutation.mutate(memberId)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-primary" />
            Team Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your team members and their access levels
          </p>
        </div>
        {canInvite && (
          <Button onClick={() => setShowInvite(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Team Member
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {['owner', 'admin', 'manager', 'staff'].map((role) => {
          const count = members.filter((m) => m.role === role).length
          return (
            <div key={role} className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{role}s</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{count}</p>
            </div>
          )
        })}
      </div>

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
          className="border-0 border-b rounded-none bg-gray-50/80"
        />
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading team...</div>
        ) : displayMembers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No team members found</div>
        ) : (
          <div className="overflow-x-auto">
            <ResizableTable tableId="team" defaultWidths={[260, 200, 120, 140, 100, 120, 80]}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Member</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Contact</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Role</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Store</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Joined</th>
                  {canManageTeam && (
                    <th className="text-right px-6 py-3 font-medium text-gray-600">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayMembers.map((member) => {
                  const emailVerified = member.user?.is_email_verified
                  const phoneVerified = member.user?.is_phone_verified
                  const needsVerification = !emailVerified || (member.user?.phone && !phoneVerified)
                  return (
                  <tr key={member.id} className="hover:bg-gray-50">
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
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${roleColors[member.role] || roleColors.custom}`}>
                        <Shield className="w-3 h-3" />
                        {member.role_name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {stores.length > 0 ? (
                        <select
                          value={(member as TeamMember & { store_id?: string }).store_id ?? ''}
                          onChange={e => assignStoreMutation.mutate({
                            staffId: member.id,
                            storeId: e.target.value || null,
                          })}
                          className="text-xs border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white max-w-[140px]"
                        >
                          <option value="">All stores</option>
                          {stores.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Store className="w-3 h-3" />No stores
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {member.is_active ? (
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
                                onClick={() => setEditMember(member)}
                                className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                                title="Edit role"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRemove(member.id)}
                                className="p-1.5 rounded hover:bg-red-50 text-red-500"
                                title="Remove"
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowInvite(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Add Team Member</h2>
              <button type="button" aria-label="Close" onClick={() => setShowInvite(false)} className="p-1 rounded hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <PhoneInput
                    value={inviteForm.phone}
                    onChange={v => setInviteForm(f => ({ ...f, phone: v }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={inviteForm.password}
                  onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                  placeholder="Min 6 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value, role_id: '' })}
                >
                  {SYSTEM_ROLES.filter((r) => r !== 'owner').map((r) => (
                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                  {customRoles.length > 0 && <option value="custom">Custom Role...</option>}
                </select>
              </div>
              {inviteForm.role === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Custom Role</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={inviteForm.role_id}
                    onChange={(e) => setInviteForm({ ...inviteForm, role_id: e.target.value })}
                  >
                    <option value="">Select a custom role...</option>
                    {customRoles.filter((r) => r.is_active).map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <p className="text-xs text-gray-500 bg-blue-50 rounded-lg p-3">
                A 6-digit verification OTP will be generated after creation. Share it with the member to verify their contact.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <Button variant="ghost" onClick={() => setShowInvite(false)}>Cancel</Button>
              <Button
                onClick={handleInvite}
                disabled={!inviteForm.email || !inviteForm.full_name || !inviteForm.password || inviteMutation.isPending}
              >
                {inviteMutation.isPending ? 'Adding...' : 'Add Member'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* OTP Display Modal — shown after member creation or send-verification */}
      {otpModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm text-center p-8 space-y-5">
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
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
          customRoles={customRoles}
          onSave={(data) => handleUpdate(editMember.id, data)}
          onClose={() => setEditMember(null)}
          isPending={updateMutation.isPending}
        />
      )}
    </div>
  )
}

function EditRoleModal({
  member,
  customRoles,
  onSave,
  onClose,
  isPending,
}: {
  member: TeamMember
  customRoles: { id: string; name: string; is_active: boolean }[]
  onSave: (data: { role?: string; role_id?: string; is_active?: boolean }) => void
  onClose: () => void
  isPending: boolean
}) {
  const [role, setRole] = useState(member.role)
  const [roleId, setRoleId] = useState(member.role_id || '')
  const [isActive, setIsActive] = useState(member.is_active)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Edit Member Role</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 rounded hover:bg-gray-100">
                <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              value={role}
              onChange={(e) => { setRole(e.target.value); setRoleId('') }}
            >
              {SYSTEM_ROLES.filter((r) => r !== 'owner').map((r) => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
              {customRoles.length > 0 && <option value="custom">Custom Role...</option>}
            </select>
          </div>
          {role === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Custom Role</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
              >
                <option value="">Select...</option>
                {customRoles.filter((r) => r.is_active).map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
            </label>
            <span className="text-sm text-gray-700">Active</span>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onSave({ role, role_id: role === 'custom' ? roleId : undefined, is_active: isActive })}
            disabled={isPending}
          >
            {isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}
