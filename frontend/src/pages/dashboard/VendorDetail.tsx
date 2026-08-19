import { useState } from 'react'
import { toast } from 'sonner'
import { useParams, useNavigate } from 'react-router-dom'
import {
  useAdminVendor,
  useApproveVendor,
  useRejectVendor,
  useVendorOwner,
  useUpdateAdminVendor,
  useVendorRmQueriesForVendor,
  usePatchVendorRmQueryStatus,
  useApproveDomainRequest,
  useRejectDomainRequest,
} from '@/hooks/useAdmin'
import { usePlatformStaffList } from '@/hooks/usePlatformStaff'
import { usePlatformJobRoles } from '@/hooks/usePlatformJobRoles'
import { isRelationshipManagerRole } from '@/lib/platformTeam'
import { useAuthStore } from '@/stores/authStore'
import { isPlatformStaff, isSuperuserAdmin } from '@/lib/platformAccess'
import { usePlans, useVendorPlan, useAssignPlan } from '@/hooks/usePlans'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import {
  ArrowLeft,
  Check,
  X,
  ExternalLink,
  Store,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Globe,
  Loader2,
  Smartphone,
  CreditCard,
  UserCircle,
  Pencil,
  Save,
  Headphones,
  BadgeCheck,
  AlertCircle,
  KeyRound,
  ShieldOff,
} from 'lucide-react'
import { adminApi, type AdminVendorUpdatePayload } from '@/api/admin.api'
import { vendorAppBaseUrl, getCustomerStorefrontBaseUrl } from '@/lib/appUrls'

import { askConfirm } from '@/components/common/ConfirmProvider'
import { VendorOwnerPasswordModal } from '@/pages/dashboard/VendorOwnerPasswordModal'

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  under_review: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  suspended: 'bg-orange-100 text-orange-800',
  deactivated: 'bg-gray-100 text-gray-800',
}

const RM_QUERY_STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'closed', label: 'Closed' },
]

function EditableField({
  label,
  value,
  field,
  editing,
  editData,
  onChange,
  type = 'text',
  inputKind = 'text',
  className = '',
}: {
  label: string
  value: string | number | undefined | null
  field: keyof AdminVendorUpdatePayload
  editing: boolean
  editData: AdminVendorUpdatePayload
  onChange: (field: keyof AdminVendorUpdatePayload, value: string | number | boolean) => void
  type?: string
  inputKind?: 'text' | 'phone'
  className?: string
}) {
  if (!editing) {
    return (
      <div className={className}>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="font-medium">{value || '-'}</p>
      </div>
    )
  }

  const raw = editData[field] ?? value ?? ''
  const currentValue = typeof raw === 'boolean' ? (raw ? 'true' : 'false') : String(raw ?? '')

  return (
    <div className={className}>
      <Label className="text-xs text-gray-500 uppercase tracking-wide">{label}</Label>
      {inputKind === 'phone' ? (
        <PhoneInput
          value={currentValue}
          onChange={(phone) => onChange(field, phone)}
          defaultCountryIso="IN"
          autoComplete="tel"
          name={field}
          compact
          className="mt-1"
        />
      ) : (
        <Input
          type={type}
          value={currentValue}
          onChange={(e) => {
            const val = type === 'number' ? Number(e.target.value) : e.target.value
            onChange(field, val)
          }}
          className="mt-1"
        />
      )}
    </div>
  )
}

function ExternalDomainCard({
  vendor,
  canMutate,
  onApprove,
  onReject,
  approving,
  rejecting,
}: {
  vendor: ReturnType<typeof useAdminVendor>['data'] & object
  canMutate: boolean
  onApprove: () => void
  onReject: () => void
  approving: boolean
  rejecting: boolean
}) {
  const status = vendor.external_domain_access_status ?? 'not_requested'
  const domainName = vendor.external_domain_name

  const statusMeta = {
    pending:  { label: 'Awaiting KIT ERP approval', color: 'text-amber-700 bg-amber-50 border-amber-200', dot: 'bg-amber-400', icon: <AlertCircle className="h-4 w-4 text-amber-500" /> },
    active:   { label: 'Active — domain is live',   color: 'text-green-700 bg-green-50 border-green-200',   dot: 'bg-green-500', icon: <BadgeCheck className="h-4 w-4 text-green-600" /> },
    revoked:  { label: 'Revoked by KIT ERP',        color: 'text-red-700 bg-red-50 border-red-200',         dot: 'bg-red-400',   icon: <ShieldOff className="h-4 w-4 text-red-500" /> },
  }[status as 'pending' | 'active' | 'revoked'] ?? { label: status, color: 'text-gray-600 bg-gray-50 border-gray-200', dot: 'bg-gray-400', icon: <Globe className="h-4 w-4 text-gray-400" /> }

  const rows: { label: string; value: string | null | undefined; mono?: boolean; href?: string }[] = [
    { label: 'Domain',        value: domainName,                          mono: true, href: domainName ? `https://${domainName}` : undefined },
    { label: 'Registrar',     value: vendor.external_domain_registrar },
    { label: 'Login email',   value: vendor.external_domain_reg_email,   mono: true },
    { label: 'Account holder',value: vendor.external_domain_holder },
    { label: 'Expiry',        value: vendor.external_domain_expiry },
    { label: 'Recovery contact', value: vendor.external_domain_recovery_contact },
    { label: 'Scope',         value: vendor.external_domain_scope === 'all' ? 'All BU / Stores (1 domain)' : 'Per Business Unit' },
  ].filter(r => r.value)

  return (
    <Card className={`border ${statusMeta.color.split(' ').find(c => c.startsWith('border-')) ?? 'border-border'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Globe className="h-4 w-4" /> External Domain Request
          </CardTitle>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusMeta.color}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
            {statusMeta.label}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Field rows */}
        <div className="rounded-lg border border-border divide-y divide-border text-sm overflow-hidden">
          {rows.map(r => (
            <div key={r.label} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="text-xs text-gray-500 shrink-0">{r.label}</span>
              {r.href
                ? <a href={r.href} target="_blank" rel="noopener noreferrer"
                    className={`font-medium text-blue-600 hover:underline flex items-center gap-1 ${r.mono ? 'font-mono text-xs' : ''}`}>
                    {r.value}<ExternalLink className="h-3 w-3" />
                  </a>
                : <span className={`font-medium text-gray-900 break-all ${r.mono ? 'font-mono text-xs' : ''}`}>{r.value}</span>}
            </div>
          ))}
        </div>

        {/* Notes */}
        {vendor.external_domain_notes && (
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
            <p className="text-xs text-gray-500 mb-0.5 font-medium">Notes from vendor</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{vendor.external_domain_notes}</p>
          </div>
        )}

        {/* Actions */}
        {canMutate && (
          <div className="flex items-center gap-2 pt-1">
            {status === 'pending' && (
              <Button size="sm" onClick={onApprove} disabled={approving || rejecting}
                className="bg-green-600 hover:bg-green-700 text-white gap-1">
                {approving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Approve & Activate
              </Button>
            )}
            {status === 'active' && (
              <Button size="sm" variant="outline" onClick={onReject} disabled={rejecting}
                className="text-red-600 border-red-200 hover:bg-red-50 gap-1">
                {rejecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldOff className="h-3.5 w-3.5" />}
                Revoke Access
              </Button>
            )}
            {status === 'revoked' && (
              <Button size="sm" variant="outline" onClick={onApprove} disabled={approving}
                className="gap-1">
                {approving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Re-activate
              </Button>
            )}
            {(status === 'pending' || status === 'active') && (
              <Button size="sm" variant="ghost" onClick={onReject} disabled={rejecting}
                className="ml-auto text-red-600 hover:bg-red-50 gap-1 text-xs">
                {status === 'pending' ? 'Cancel request' : 'Revoke & disable'}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function VendorDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const canMutate = isSuperuserAdmin(user)
  const staffCanViewQueries = isPlatformStaff(user)
  const { data: vendor, isLoading, isError } = useAdminVendor(id!)
  const approveVendor = useApproveVendor()
  const rejectVendor = useRejectVendor()
  const updateVendor = useUpdateAdminVendor()
  const { data: ownerData } = useVendorOwner(id!)
  const { data: plans } = usePlans()
  const { data: vendorPlanData } = useVendorPlan(id!)
  const assignPlan = useAssignPlan()
  const [showPlanPicker, setShowPlanPicker] = useState(false)
  const { data: platformStaff } = usePlatformStaffList()
  const { data: rolesData } = usePlatformJobRoles()
  const roleOptions = (rolesData?.roles ?? []).map((r) => ({
    value: r.slug,
    label: r.name,
    permissions: r.permissions,
  }))
  const relationshipManagers = (platformStaff ?? []).filter(
    (m) => m.is_active && isRelationshipManagerRole(m.job_role, roleOptions),
  )
  const { data: rmQueriesData } = useVendorRmQueriesForVendor(id, staffCanViewQueries && !!id)
  const patchRmQuery = usePatchVendorRmQueryStatus(id)

  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState<AdminVendorUpdatePayload>({})
  const [vendorHandoffPending, setVendorHandoffPending] = useState(false)
  const [showOwnerPassword, setShowOwnerPassword] = useState(false)
  const editMode = canMutate && editing

  const approveDomain = useApproveDomainRequest(id!)
  const rejectDomain = useRejectDomainRequest(id!)

  const openVendorDashboardHandoff = async () => {
    if (!id) return
    setVendorHandoffPending(true)
    try {
      const res = await adminApi.createVendorDashboardHandoff(id)
      const url = `${vendorAppBaseUrl}/auth/handoff?token=${encodeURIComponent(res.handoff_token)}`
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      const msg =
        typeof detail === 'string'
          ? detail
          : detail != null
            ? JSON.stringify(detail)
            : 'Could not open vendor dashboard'
      toast.error(msg)
    } finally {
      setVendorHandoffPending(false)
    }
  }

  const handleEdit = () => {
    setEditData({})
    setEditing(true)
  }

  const handleCancel = () => {
    setEditData({})
    setEditing(false)
  }

  const handleFieldChange = (field: keyof AdminVendorUpdatePayload, value: string | number | boolean) => {
    setEditData((prev) => ({ ...prev, [field]: value }))
  }

  const selectedRmId =
    editData.relationship_manager_user_id !== undefined
      ? editData.relationship_manager_user_id
      : vendor?.relationship_manager_user_id ?? null

  const handleSave = () => {
    if (!id || Object.keys(editData).length === 0) {
      setEditing(false)
      return
    }
    updateVendor.mutate(
      { vendorId: id, data: editData },
      {
        onSuccess: () => {
          setEditing(false)
          setEditData({})
        },
      }
    )
  }

  const handleApprove = () => {
    if (id) approveVendor.mutate(id)
  }

  const handleReject = () => {
    const reason = prompt('Enter rejection reason:')
    if (reason && id) rejectVendor.mutate({ vendorId: id, reason })
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (isError || !vendor) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">Business account not found</p>
        <Button onClick={() => navigate('/dashboard/vendors')}>Back to Business Accounts</Button>
      </div>
    )
  }

  const businessFrontUrl = getCustomerStorefrontBaseUrl(vendor.slug)

  return (
    <div className="flex flex-col gap-4 lg:min-h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between shrink-0">
        <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate('/dashboard/vendors')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold sm:text-2xl">{vendor.display_name}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[vendor.status] || 'bg-gray-100'}`}>
                {vendor.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-sm text-gray-500 truncate">{vendor.business_name}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {editMode ? (
            <>
              <Button size="sm" variant="ghost" onClick={handleCancel} disabled={updateVendor.isPending}>
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateVendor.isPending}
                className="bg-primary hover:bg-primary/90 text-white gap-1">
                {updateVendor.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Changes
              </Button>
            </>
          ) : (
            <>
              {canMutate && (
                <Button size="sm" variant="outline" onClick={handleEdit} className="gap-1">
                  <Pencil className="w-4 h-4" /> Edit
                </Button>
              )}
              {canMutate && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowOwnerPassword(true)}
                  className="gap-1"
                >
                  <KeyRound className="w-4 h-4" /> Change password
                </Button>
              )}
              {canMutate && (vendor.status === 'pending' || vendor.status === 'under_review') && (
                <>
                  <Button size="sm" onClick={handleApprove} disabled={approveVendor.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white gap-1">
                    <Check className="w-4 h-4" /> Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={handleReject} disabled={rejectVendor.isPending}
                    className="gap-1">
                    <X className="w-4 h-4" /> Reject
                  </Button>
                </>
              )}
              {vendor.status === 'approved' && (
                <>
                  {canMutate && (
                    <Button size="sm" variant="outline" className="gap-1"
                      onClick={() => navigate(`/dashboard/vendors/${id}/app-builds`)}>
                      <Smartphone className="w-4 h-4" /> Branded App
                    </Button>
                  )}
                  <a href={businessFrontUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-1">
                      <ExternalLink className="w-4 h-4" /> View Business Front
                    </Button>
                  </a>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* Left column — business, address, tax, domain */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Store className="w-4 h-4" /> Business Information
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <EditableField label="Business Name" value={vendor.business_name} field="business_name"
                  editing={editMode} editData={editData} onChange={handleFieldChange} />
                <EditableField label="Display Name" value={vendor.display_name} field="display_name"
                  editing={editMode} editData={editData} onChange={handleFieldChange} />
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Slug</p>
                  <p className="font-mono text-sm">{vendor.slug}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Subdomain</p>
                  <p className="font-mono text-sm">{vendor.subdomain}</p>
                </div>
                <EditableField label="Business Type" value={vendor.business_type} field="business_type"
                  editing={editMode} editData={editData} onChange={handleFieldChange} />
                <EditableField label="Industry" value={vendor.industry} field="industry"
                  editing={editMode} editData={editData} onChange={handleFieldChange} />
              </div>
              {editMode ? (
                <div>
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Description</Label>
                  <textarea
                    value={editData.description ?? vendor.description ?? ''}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-0 focus:border-primary"
                  />
                </div>
              ) : vendor.description ? (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Description</p>
                  <p className="text-sm text-gray-700">{vendor.description}</p>
                </div>
              ) : null}

              {(editMode || vendor.gstin || vendor.pan_number || vendor.is_gst_registered) && (
                <>
                  <hr className="my-1" />
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Tax Information</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <EditableField label="GSTIN" value={vendor.gstin} field="gstin"
                      editing={editMode} editData={editData} onChange={handleFieldChange} />
                    <EditableField label="PAN Number" value={vendor.pan_number} field="pan_number"
                      editing={editMode} editData={editData} onChange={handleFieldChange} />
                    {editMode ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="gst-registered"
                          checked={editData.is_gst_registered ?? vendor.is_gst_registered ?? false}
                          onChange={(e) => handleFieldChange('is_gst_registered', e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor="gst-registered" className="text-sm">GST Registered</Label>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">GST Registered</p>
                        <p className="font-medium">{vendor.is_gst_registered ? 'Yes' : 'No'}</p>
                      </div>
                    )}
                    <EditableField label="Default Tax Rate (%)" value={vendor.default_tax_rate} field="default_tax_rate"
                      editing={editMode} editData={editData} onChange={handleFieldChange} type="number" />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-gray-500" /> Address
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {editMode ? (
                  <div className="space-y-2">
                    <EditableField label="Street Address" value={vendor.street_address} field="street_address"
                      editing={editMode} editData={editData} onChange={handleFieldChange} />
                    <div className="grid grid-cols-2 gap-2">
                      <EditableField label="City" value={vendor.city} field="city"
                        editing={editMode} editData={editData} onChange={handleFieldChange} />
                      <EditableField label="State" value={vendor.state} field="state"
                        editing={editMode} editData={editData} onChange={handleFieldChange} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <EditableField label="Postal Code" value={vendor.postal_code} field="postal_code"
                        editing={editMode} editData={editData} onChange={handleFieldChange} />
                      <EditableField label="Country" value={vendor.country} field="country"
                        editing={editMode} editData={editData} onChange={handleFieldChange} />
                    </div>
                  </div>
                ) : (
                  <div className="text-sm space-y-0.5">
                    {vendor.street_address && <p>{vendor.street_address}</p>}
                    <p>{[vendor.city, vendor.state, vendor.postal_code].filter(Boolean).join(', ')}</p>
                    <p>{vendor.country}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-gray-500" /> SaaS Info
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 shrink-0">Slug</span>
                  <code className="bg-gray-100 px-1 rounded text-xs">{vendor.slug}</code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 shrink-0">Subdomain</span>
                  <code className="bg-gray-100 px-1 rounded text-xs">{vendor.subdomain}</code>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  <span>Verification: <span className="capitalize">{vendor.verification_status}</span></span>
                </div>
                {vendor.status === 'approved' && (
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <p className="text-xs font-medium text-blue-700 mb-0.5">Business Front URL</p>
                    <a href={businessFrontUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline break-all">{businessFrontUrl}</a>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {vendor.external_domain_access_status && vendor.external_domain_access_status !== 'not_requested' && (
            <ExternalDomainCard
              vendor={vendor}
              canMutate={canMutate}
              onApprove={() => approveDomain.mutate()}
              onReject={async () => {
                if (await askConfirm('Revoke this domain request? The vendor will need to re-submit.')) {
                  rejectDomain.mutate()
                }
              }}
              approving={approveDomain.isPending}
              rejecting={rejectDomain.isPending}
            />
          )}

          {staffCanViewQueries && (
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Queries to relationship manager</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3 max-h-48 overflow-y-auto">
                {!rmQueriesData?.items?.length ? (
                  <p className="text-sm text-gray-500">No queries from this vendor yet.</p>
                ) : (
                  rmQueriesData.items.map((q) => (
                    <div key={q.id} className="border rounded-lg p-2.5 space-y-1.5">
                      <div className="flex justify-between gap-2 items-start">
                        <p className="text-sm font-medium">{q.subject}</p>
                        <Select
                          className="text-xs border rounded px-2 py-1 bg-white shrink-0"
                          value={q.status}
                          disabled={patchRmQuery.isPending}
                          onChange={(next) => {
                            if (next === q.status) return
                            patchRmQuery.mutate({ queryId: q.id, status: next as 'open' | 'in_progress' | 'closed' })
                          }}
                          options={RM_QUERY_STATUS_OPTIONS}
                        />
                      </div>
                      <p className="text-xs text-gray-600 whitespace-pre-wrap">{q.body}</p>
                      <div className="text-xs text-gray-400 flex justify-between">
                        <span>{q.created_by_name || 'Vendor user'}</span>
                        <span>{q.created_at ? new Date(q.created_at).toLocaleString() : ''}</span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Contact</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {editMode ? (
                <>
                  <EditableField label="Primary Email" value={vendor.primary_email} field="primary_email"
                    editing={editMode} editData={editData} onChange={handleFieldChange} type="email" />
                  <EditableField label="Primary Phone" value={vendor.primary_phone} field="primary_phone"
                    editing={editMode} editData={editData} onChange={handleFieldChange} inputKind="phone" />
                  <EditableField label="Support Email" value={vendor.support_email} field="support_email"
                    editing={editMode} editData={editData} onChange={handleFieldChange} type="email" />
                  <EditableField label="Support Phone" value={vendor.support_phone} field="support_phone"
                    editing={editMode} editData={editData} onChange={handleFieldChange} inputKind="phone" />
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="break-all">{vendor.primary_email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                    <span>{vendor.primary_phone}</span>
                  </div>
                  {vendor.support_email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-gray-500 break-all">Support: {vendor.support_email}</span>
                    </div>
                  )}
                  {vendor.support_phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-gray-500">Support: {vendor.support_phone}</span>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-blue-100">
            <CardHeader className="py-3 px-4 pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <UserCircle className="w-4 h-4 text-blue-600" /> Vendor dashboard
              </CardTitle>
              <p className="text-xs text-gray-500 font-normal leading-snug pt-1">
                Opens <span className="font-mono">{vendorAppBaseUrl}</span> with your platform login.
              </p>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              <Button
                type="button"
                variant="default"
                className="w-full gap-2"
                disabled={vendorHandoffPending || !isPlatformStaff(user)}
                onClick={() => void openVendorDashboardHandoff()}
              >
                <ExternalLink className="w-4 h-4 shrink-0" />
                {vendorHandoffPending ? 'Opening…' : 'Open vendor app'}
              </Button>
              {ownerData ? (
                <div className="rounded-md bg-gray-50 border border-gray-100 p-2.5 text-xs space-y-1.5">
                  <p className="font-medium uppercase tracking-wide text-gray-500">
                    Owner account (reference)
                  </p>
                  <div className="text-sm text-gray-900">
                    <p className="font-medium">{ownerData.full_name}</p>
                    <p className="text-gray-600 font-mono mt-0.5 break-all text-xs">{ownerData.email}</p>
                    {ownerData.phone && <p className="text-gray-600 mt-0.5">{ownerData.phone}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-xs ${ownerData.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                    >
                      {ownerData.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {ownerData.is_email_verified && (
                      <span className="px-1.5 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                        Verified
                      </span>
                    )}
                  </div>
                  {canMutate ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full gap-1.5 mt-1"
                      onClick={() => setShowOwnerPassword(true)}
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      Change password
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">
                    Owner details load separately — you can still open the vendor dashboard above.
                  </p>
                  {canMutate ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full gap-1.5"
                      onClick={() => setShowOwnerPassword(true)}
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      Change password
                    </Button>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Headphones className="w-4 h-4 text-primary" /> Relationship manager
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {editMode ? (
                <div>
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Assigned manager</Label>
                  <Select
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-0 focus:border-primary"
                    value={selectedRmId ?? ''}
                    onChange={(v) => {
                      setEditData((prev) => ({
                        ...prev,
                        relationship_manager_user_id: v === '' ? null : v,
                      }))
                    }}
                    options={selectOptionsWithBlank(
                      'Unassigned',
                      relationshipManagers.map((m) => ({
                        value: m.id,
                        label: `${m.full_name}${m.email ? ` (${m.email})` : m.phone ? ` (${m.phone})` : ''}`,
                      })),
                    )}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Only platform users with job role “relationship_manager” appear here.
                  </p>
                </div>
              ) : vendor.relationship_manager ? (
                <div className="text-sm space-y-1">
                  <p className="font-medium">{vendor.relationship_manager.full_name}</p>
                  {vendor.relationship_manager.email && (
                    <p className="text-gray-500 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" /> {vendor.relationship_manager.email}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No relationship manager assigned.</p>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Timeline</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-1.5 text-xs">
                <div className="flex justify-between gap-1">
                  <span className="text-gray-500">Created</span>
                  <span>{new Date(vendor.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between gap-1">
                  <span className="text-gray-500">Updated</span>
                  <span>{new Date(vendor.updated_at).toLocaleDateString()}</span>
                </div>
                {vendor.verified_at && (
                  <div className="flex justify-between gap-1">
                    <span className="text-gray-500">Verified</span>
                    <span>{new Date(vendor.verified_at).toLocaleDateString()}</span>
                  </div>
                )}
                {vendor.activated_at && (
                  <div className="flex justify-between gap-1">
                    <span className="text-gray-500">Activated</span>
                    <span>{new Date(vendor.activated_at).toLocaleDateString()}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-blue-600" /> Plan
                </CardTitle>
                {canMutate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-xs"
                    onClick={() => setShowPlanPicker(!showPlanPicker)}
                  >
                    {showPlanPicker ? 'Cancel' : 'Change'}
                  </Button>
                )}
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {vendorPlanData?.plan ? (
                  <div className="space-y-1">
                    <p className="font-medium text-sm leading-tight">{vendorPlanData.plan.name}</p>
                    <p className="text-xs text-blue-600 font-semibold">
                      {vendorPlanData.plan.currency === 'INR' ? '₹' : '$'}{vendorPlanData.plan.price_monthly}/mo
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No plan</p>
                )}
              </CardContent>
            </Card>
          </div>

          {showPlanPicker && (
            <Card>
              <CardContent className="px-4 py-3 space-y-2">
                <p className="text-xs text-gray-500 font-medium">Select a plan:</p>
                {plans?.map((plan) => {
                  const isCurrent = vendorPlanData?.plan?.id === plan.id
                  return (
                    <button
                      key={plan.id}
                      disabled={isCurrent || assignPlan.isPending}
                      onClick={() => {
                        assignPlan.mutate(
                          { vendorId: id!, planId: plan.id },
                          { onSuccess: () => setShowPlanPicker(false) }
                        )
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                        isCurrent
                          ? 'bg-blue-50 border-blue-300 text-blue-700 cursor-default'
                          : 'hover:bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{plan.name}</span>
                        <span className="text-xs">
                          {plan.currency === 'INR' ? '₹' : '$'}{plan.price_monthly}/mo
                        </span>
                      </div>
                      {plan.features?.branded_app && (
                        <span className="text-xs text-green-600">Includes Branded App</span>
                      )}
                      {isCurrent && <span className="text-xs text-blue-500 ml-1">(current)</span>}
                    </button>
                  )
                })}
                {(!plans || plans.length === 0) && (
                  <p className="text-xs text-gray-400">
                    No plans created yet.
                    {canMutate && (
                      <>
                        {' '}
                        <button type="button" onClick={() => navigate('/dashboard/plans')} className="text-blue-600 underline">
                          Create one
                        </button>
                      </>
                    )}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      {showOwnerPassword && id ? (
        <VendorOwnerPasswordModal
          vendorId={id}
          ownerName={ownerData?.full_name || vendor.display_name || vendor.business_name || 'vendor owner'}
          ownerEmail={ownerData?.email || vendor.primary_email}
          ownerPhone={ownerData?.phone || vendor.primary_phone}
          onClose={() => setShowOwnerPassword(false)}
        />
      ) : null}
    </div>
  )
}
