import { lazy, Suspense, useState } from 'react'
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
} from '@/hooks/useAdmin'
import { usePlatformStaffList } from '@/hooks/usePlatformStaff'
import { useAuthStore } from '@/stores/authStore'
import { isPlatformStaff, isSuperuserAdmin } from '@/lib/platformAccess'
import { usePlans, useVendorPlan, useAssignPlan } from '@/hooks/usePlans'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
} from 'lucide-react'
import { adminApi, type AdminVendorUpdatePayload } from '@/api/admin.api'
import { vendorAppBaseUrl } from '@/lib/appUrls'

const LocationPicker = lazy(() => import('@/components/common/LocationPicker'))

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  under_review: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  suspended: 'bg-orange-100 text-orange-800',
  deactivated: 'bg-gray-100 text-gray-800',
}

function EditableField({
  label,
  value,
  field,
  editing,
  editData,
  onChange,
  type = 'text',
  className = '',
}: {
  label: string
  value: string | number | undefined | null
  field: keyof AdminVendorUpdatePayload
  editing: boolean
  editData: AdminVendorUpdatePayload
  onChange: (field: keyof AdminVendorUpdatePayload, value: string | number | boolean) => void
  type?: string
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
      <Input
        type={type}
        value={currentValue}
        onChange={(e) => {
          const val = type === 'number' ? Number(e.target.value) : e.target.value
          onChange(field, val)
        }}
        className="mt-1"
      />
    </div>
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
  const relationshipManagers = (platformStaff ?? []).filter(
    (m) => m.is_active && m.job_role === 'relationship_manager',
  )
  const { data: rmQueriesData } = useVendorRmQueriesForVendor(id, staffCanViewQueries && !!id)
  const patchRmQuery = usePatchVendorRmQueryStatus(id)

  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState<AdminVendorUpdatePayload>({})
  const [vendorHandoffPending, setVendorHandoffPending] = useState(false)
  const editMode = canMutate && editing

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

  const storefrontUrl = `http://localhost:3002/store/${vendor.slug}`
  const hasLocation = vendor.latitude != null && vendor.longitude != null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/vendors')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{vendor.display_name}</h1>
            <p className="text-sm text-gray-500">{vendor.business_name}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[vendor.status] || 'bg-gray-100'}`}>
            {vendor.status.replace('_', ' ')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <Button size="sm" variant="ghost" onClick={handleCancel} disabled={updateVendor.isPending}>
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateVendor.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-1">
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
                  <a href={storefrontUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-1">
                      <ExternalLink className="w-4 h-4" /> View Storefront
                    </Button>
                  </a>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Business Info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Store className="w-5 h-5" /> Business Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
                  rows={3}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ) : vendor.description ? (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Description</p>
                <p className="text-sm text-gray-700">{vendor.description}</p>
              </div>
            ) : null}

            {/* Tax / GST section */}
            {(editMode || vendor.gstin || vendor.pan_number || vendor.is_gst_registered) && (
              <>
                <hr className="my-2" />
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Tax Information</p>
                <div className="grid grid-cols-2 gap-4">
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

        {/* Contact & Status sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {editMode ? (
                <>
                  <EditableField label="Primary Email" value={vendor.primary_email} field="primary_email"
                    editing={editMode} editData={editData} onChange={handleFieldChange} type="email" />
                  <EditableField label="Primary Phone" value={vendor.primary_phone} field="primary_phone"
                    editing={editMode} editData={editData} onChange={handleFieldChange} />
                  <EditableField label="Support Email" value={vendor.support_email} field="support_email"
                    editing={editMode} editData={editData} onChange={handleFieldChange} type="email" />
                  <EditableField label="Support Phone" value={vendor.support_phone} field="support_phone"
                    editing={editMode} editData={editData} onChange={handleFieldChange} />
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span>{vendor.primary_email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{vendor.primary_phone}</span>
                  </div>
                  {vendor.support_email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-500">Support: {vendor.support_email}</span>
                    </div>
                  )}
                  {vendor.support_phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-500">Support: {vendor.support_phone}</span>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-blue-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <UserCircle className="w-4 h-4 text-blue-600" /> Vendor dashboard
              </CardTitle>
              <p className="text-xs text-gray-500 font-normal leading-snug pt-1">
                Opens <span className="font-mono text-[11px]">{vendorAppBaseUrl}</span> in a new tab using
                your platform login — no separate password. Access is logged in both the admin audit trail and
                this vendor&apos;s platform audit log.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
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
                <div className="rounded-md bg-gray-50 border border-gray-100 p-3 text-xs space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    Owner account (reference)
                  </p>
                  <div className="text-sm text-gray-900">
                    <p className="font-medium">{ownerData.full_name}</p>
                    <p className="text-gray-600 font-mono mt-0.5 break-all">{ownerData.email}</p>
                    {ownerData.phone && <p className="text-gray-600 mt-0.5">{ownerData.phone}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[11px] ${ownerData.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                    >
                      {ownerData.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {ownerData.is_email_verified && (
                      <span className="px-1.5 py-0.5 rounded-full text-[11px] bg-blue-100 text-blue-700">
                        Verified
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  Owner details load separately — you can still open the vendor dashboard above.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Headphones className="w-4 h-4 text-violet-600" /> Relationship manager
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {editMode ? (
                <>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Assigned manager</Label>
                    <select
                      className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={selectedRmId ?? ''}
                      onChange={(e) => {
                        const v = e.target.value
                        setEditData((prev) => ({
                          ...prev,
                          relationship_manager_user_id: v === '' ? null : v,
                        }))
                      }}
                    >
                      <option value="">Unassigned</option>
                      {relationshipManagers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name}
                          {m.email ? ` (${m.email})` : m.phone ? ` (${m.phone})` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Vendors can message their assigned manager from the vendor dashboard. Only platform users with job role “relationship_manager” appear here (superusers can also be assigned via API).
                    </p>
                  </div>
                </>
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

          {staffCanViewQueries && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Queries to relationship manager</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!rmQueriesData?.items?.length ? (
                  <p className="text-sm text-gray-500">No queries from this vendor yet.</p>
                ) : (
                  rmQueriesData.items.map((q) => (
                    <div key={q.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex justify-between gap-2 items-start">
                        <p className="text-sm font-medium">{q.subject}</p>
                        <select
                          className="text-xs border rounded px-2 py-1 bg-white shrink-0"
                          value={q.status}
                          disabled={patchRmQuery.isPending}
                          onChange={(e) => {
                            const next = e.target.value as 'open' | 'in_progress' | 'closed'
                            if (next === q.status) return
                            patchRmQuery.mutate({ queryId: q.id, status: next })
                          }}
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In progress</option>
                          <option value="closed">Closed</option>
                        </select>
                      </div>
                      <p className="text-xs text-gray-600 whitespace-pre-wrap">{q.body}</p>
                      <div className="text-[10px] text-gray-400 flex justify-between">
                        <span>{q.created_by_name || 'Vendor user'}</span>
                        <span>{q.created_at ? new Date(q.created_at).toLocaleString() : ''}</span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Address</CardTitle>
            </CardHeader>
            <CardContent>
              {editMode ? (
                <div className="space-y-3">
                  <EditableField label="Street Address" value={vendor.street_address} field="street_address"
                    editing={editMode} editData={editData} onChange={handleFieldChange} />
                  <div className="grid grid-cols-2 gap-3">
                    <EditableField label="City" value={vendor.city} field="city"
                      editing={editMode} editData={editData} onChange={handleFieldChange} />
                    <EditableField label="State" value={vendor.state} field="state"
                      editing={editMode} editData={editData} onChange={handleFieldChange} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <EditableField label="Postal Code" value={vendor.postal_code} field="postal_code"
                      editing={editMode} editData={editData} onChange={handleFieldChange} />
                    <EditableField label="Country" value={vendor.country} field="country"
                      editing={editMode} editData={editData} onChange={handleFieldChange} />
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    {vendor.street_address && <p>{vendor.street_address}</p>}
                    <p>{[vendor.city, vendor.state, vendor.postal_code].filter(Boolean).join(', ')}</p>
                    <p>{vendor.country}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">SaaS Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Globe className="w-4 h-4 text-gray-400" />
                <span>Slug: <code className="bg-gray-100 px-1 rounded">{vendor.slug}</code></span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Globe className="w-4 h-4 text-gray-400" />
                <span>Subdomain: <code className="bg-gray-100 px-1 rounded">{vendor.subdomain}</code></span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>Verification: <span className="capitalize">{vendor.verification_status}</span></span>
              </div>
              {vendor.status === 'approved' && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs font-medium text-blue-700 mb-1">Storefront URL</p>
                  <a href={storefrontUrl} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline break-all">{storefrontUrl}</a>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span>{new Date(vendor.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Updated</span>
                <span>{new Date(vendor.updated_at).toLocaleDateString()}</span>
              </div>
              {vendor.verified_at && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Verified</span>
                  <span>{new Date(vendor.verified_at).toLocaleDateString()}</span>
                </div>
              )}
              {vendor.activated_at && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Activated</span>
                  <span>{new Date(vendor.activated_at).toLocaleDateString()}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Plan Assignment */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-blue-600" /> Plan
              </CardTitle>
              {canMutate && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowPlanPicker(!showPlanPicker)}
                >
                  {showPlanPicker ? 'Cancel' : 'Change'}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {vendorPlanData?.plan ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{vendorPlanData.plan.name}</span>
                    <span className="text-sm text-blue-600 font-semibold">
                      {vendorPlanData.plan.currency === 'INR' ? '₹' : '$'}{vendorPlanData.plan.price_monthly}/mo
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(vendorPlanData.plan.features || {}).map(([key, val]) =>
                      val ? (
                        <span key={key} className="inline-block bg-green-50 text-green-700 text-xs px-1.5 py-0.5 rounded">
                          {key.replace(/_/g, ' ')}
                        </span>
                      ) : null
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">No plan assigned</p>
              )}

              {showPlanPicker && (
                <div className="mt-3 pt-3 border-t space-y-2">
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
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Location & Service Radius - full width below */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            Location &amp; Service Radius
          </CardTitle>
        </CardHeader>
        <CardContent>
          {editMode && (
            <div className="grid grid-cols-3 gap-4 mb-4">
              <EditableField label="Latitude" value={vendor.latitude} field="latitude"
                editing={editMode} editData={editData} onChange={handleFieldChange} type="number" />
              <EditableField label="Longitude" value={vendor.longitude} field="longitude"
                editing={editMode} editData={editData} onChange={handleFieldChange} type="number" />
              <EditableField label="Service Radius (km)" value={vendor.service_radius_km} field="service_radius_km"
                editing={editMode} editData={editData} onChange={handleFieldChange} type="number" />
            </div>
          )}
          {hasLocation ? (
            <div className="space-y-4">
              {!editMode && (
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Latitude</p>
                    <p className="font-medium font-mono">{Number(vendor.latitude).toFixed(6)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Longitude</p>
                    <p className="font-medium font-mono">{Number(vendor.longitude).toFixed(6)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Service Radius</p>
                    <p className="font-medium">{vendor.service_radius_km ?? 10} km</p>
                  </div>
                </div>
              )}
              <Suspense
                fallback={
                  <div className="flex items-center justify-center bg-gray-100 rounded-lg border border-gray-200" style={{ height: '350px' }}>
                    <p className="text-gray-500 text-sm">Loading map...</p>
                  </div>
                }
              >
                <LocationPicker
                  latitude={vendor.latitude}
                  longitude={vendor.longitude}
                  radiusKm={vendor.service_radius_km ?? 10}
                  onLocationChange={() => {}}
                  showRadius
                  height="350px"
                />
              </Suspense>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <MapPin className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No location set</p>
              <p className="text-sm mt-1">This vendor has not configured their location yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
