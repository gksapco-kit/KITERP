import { useState, useMemo } from 'react'
import { formLabelClass } from '@/components/common/FormSectionNav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Plus, Search, Edit2, Trash2, UserCheck, Building2, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import {
  usePayees, useCreatePayee, useUpdatePayee, useDeletePayee, usePayeeMasterBank,
} from '@/hooks/useCommission'
import type { CommissionPayee } from '@/types/commission'
import { StaffPicker, type StaffPickerValue } from '@/components/commission/StaffPicker'
import { SupplierPicker, type SupplierPickerValue } from '@/components/commission/SupplierPicker'
import { CustomerPicker, type CustomerPickerValue } from '@/components/commission/CustomerPicker'
import { CollapsibleSection } from '@/components/commission/CollapsibleSection'
import { extractApiError } from '@/lib/errorMessages'
import { isValidPhoneNumber, isValidEmail } from '@/lib/loginIdentifier'
import { PhoneInput } from '@/components/ui/PhoneInput'
import {
  commissionPaginationActive,
  commissionPaginationInactive,
} from '@/pages/commission/commissionUi'

// ─── constants ────────────────────────────────────────────────────────────────

const LINK_TYPES = ['vendor_user', 'supplier', 'customer', 'external'] as const
type LinkType = typeof LINK_TYPES[number]

const LINK_LABELS: Record<LinkType, string> = {
  vendor_user: 'Staff Member',
  supplier: 'Supplier / Contractor',
  customer: 'Customer Referral',
  external: 'External / Agent',
}

const LINK_DESCRIPTIONS: Record<LinkType, string> = {
  vendor_user: 'Pick from your team and details auto-fill',
  supplier: 'Pick from your suppliers / contractors list',
  customer: 'Pick from your customer master',
  external: 'Agent or partner not in any master list',
}

const TABLE_ICON_BTN =
  'rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted/70'

const TYPE_TILE_INACTIVE =
  'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'

const FIELD_INPUT =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring'

const PAYOUT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
]

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
  inactive: 'bg-muted text-muted-foreground',
  suspended: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
}

const WALLET_PROVIDERS = ['Paytm', 'PhonePe', 'Google Pay', 'Amazon Pay', 'Other']

// ─── bank section types ───────────────────────────────────────────────────────

interface BankFields {
  bank_source: 'master' | 'custom'
  bank_name: string
  account_number: string
  account_holder_name: string
  ifsc_code: string
  upi_id: string
  wallet_provider: string
  wallet_id: string
}

const emptyBank = (): BankFields => ({
  bank_source: 'master',
  bank_name: '', account_number: '', account_holder_name: '', ifsc_code: '',
  upi_id: '', wallet_provider: 'Paytm', wallet_id: '',
})

// ─── form state ───────────────────────────────────────────────────────────────

interface FormState {
  display_name: string
  phone: string
  email: string
  code: string
  external_user_id: string
  link_type: LinkType
  vendor_user_id: string
  supplier_id: string
  customer_id: string
  default_payout_method: string
  currency: string
  status: string
}

const emptyForm = (): FormState => ({
  display_name: '', phone: '', email: '', code: '', external_user_id: '',
  link_type: 'external', vendor_user_id: '', supplier_id: '', customer_id: '',
  default_payout_method: 'bank_transfer', currency: 'INR', status: 'active',
})

// ─── component ────────────────────────────────────────────────────────────────

export default function PayeesPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<CommissionPayee | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [bank, setBank] = useState<BankFields>(emptyBank())
  const [phoneError, setPhoneError] = useState('')
  const [emailError, setEmailError] = useState('')

  // master picker selections
  const [selectedStaff, setSelectedStaff] = useState<StaffPickerValue | null>(null)
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierPickerValue | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerPickerValue | null>(null)

  // master bank preview for edit mode (fetched from API)
  const hasMasterLink = editing && form.link_type !== 'external'
  const masterBankQuery = usePayeeMasterBank(
    editing?.id || null,
    hasMasterLink !== false && bank.bank_source === 'master',
  )
  const masterBank = masterBankQuery.data

  const apiParams = useMemo(() => {
    const p: Record<string, unknown> = { page, size: 20 }
    const q = search.trim()
    if (q) p.search = q
    return p
  }, [page, search])

  const { data, isLoading } = usePayees(apiParams)
  const create = useCreatePayee()
  const update = useUpdatePayee()
  const remove = useDeletePayee()

  const items = data?.items || []
  const total = data?.total ?? 0
  const pages = data?.pages || 1
  const pageWindowStart = Math.max(1, Math.min(page - 2, pages - 4))
  const pageNumbers = Array.from(
    { length: Math.min(5, pages) },
    (_, i) => pageWindowStart + i,
  ).filter(pg => pg >= 1 && pg <= pages)

  const set = (k: keyof FormState, v: string) => setForm(p => ({ ...p, [k]: v }))
  const setB = (k: keyof BankFields, v: string) => setBank(p => ({ ...p, [k]: v }))

  // ── derived: does the current type have a master record? ──────────────────

  const hasmaster = form.link_type !== 'external'

  // ── auto-fill master bank from picker (create mode) ─────────────────────

  const masterBankFromPicker = (() => {
    if (form.link_type === 'vendor_user') return selectedStaff?.bank || null
    if (form.link_type === 'supplier') return selectedSupplier?.bank || null
    if (form.link_type === 'customer') return selectedCustomer?.bank || null
    return null
  })()

  // ── open forms ───────────────────────────────────────────────────────────

  const closeForm = () => setShowForm(false)

  useEscapeToClose(closeForm, showForm)

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setBank(emptyBank())
    setSelectedStaff(null); setSelectedSupplier(null); setSelectedCustomer(null)
    setPhoneError('')
    setEmailError('')
    setShowForm(true)
  }

  const openEdit = (p: CommissionPayee) => {
    setEditing(p)
    const ext = p as unknown as Record<string, string>
    setForm({
      display_name: p.display_name, phone: p.phone || '', email: p.email || '',
      code: p.code || '', external_user_id: p.external_user_id || '',
      link_type: (p.link_type as LinkType) || 'external',
      vendor_user_id: ext.vendor_user_id || '', supplier_id: ext.supplier_id || '',
      customer_id: ext.customer_id || '',
      default_payout_method: p.default_payout_method || 'bank_transfer',
      currency: p.currency || 'INR', status: p.status || 'active',
    })
    setBank({
      bank_source: (ext.bank_source as 'master' | 'custom') || (p.link_type === 'external' ? 'custom' : 'master'),
      bank_name: ext.bank_name || '', account_number: ext.account_number || '',
      account_holder_name: ext.account_holder_name || '', ifsc_code: ext.ifsc_code || '',
      upi_id: ext.upi_id || '', wallet_provider: ext.wallet_provider || 'Paytm',
      wallet_id: ext.wallet_id || '',
    })
    if (p.link_type === 'vendor_user' && ext.vendor_user_id) {
      setSelectedStaff({ id: ext.vendor_user_id, user_id: ext.vendor_user_id, full_name: p.display_name, phone: p.phone, email: p.email })
    } else setSelectedStaff(null)
    if (p.link_type === 'supplier' && ext.supplier_id) {
      setSelectedSupplier({ id: ext.supplier_id, name: p.display_name, phone: p.phone, email: p.email })
    } else setSelectedSupplier(null)
    if (p.link_type === 'customer' && ext.customer_id) {
      setSelectedCustomer({ id: ext.customer_id, full_name: p.display_name, phone: p.phone, email: p.email })
    } else setSelectedCustomer(null)
    setPhoneError('')
    setEmailError('')
    setShowForm(true)
  }

  // ── master picker auto-fill handlers ─────────────────────────────────────

  const onStaffSelect = (v: StaffPickerValue | null) => {
    setSelectedStaff(v)
    if (v) {
      setForm(p => ({ ...p, display_name: v.full_name, phone: v.phone || p.phone, email: v.email || p.email, vendor_user_id: v.id, external_user_id: v.user_id || v.id }))
    } else {
      setForm(p => ({ ...p, vendor_user_id: '', external_user_id: '' }))
    }
  }

  const onSupplierSelect = (v: SupplierPickerValue | null) => {
    setSelectedSupplier(v)
    if (v) {
      setForm(p => ({ ...p, display_name: v.name, phone: v.phone || p.phone, email: v.email || p.email, supplier_id: v.id, external_user_id: v.id }))
    } else {
      setForm(p => ({ ...p, supplier_id: '', external_user_id: '' }))
    }
  }

  const onCustomerSelect = (v: CustomerPickerValue | null) => {
    setSelectedCustomer(v)
    if (v) {
      setForm(p => ({ ...p, display_name: v.full_name, phone: v.phone || p.phone, email: v.email || p.email, customer_id: v.id, external_user_id: v.id }))
    } else {
      setForm(p => ({ ...p, customer_id: '', external_user_id: '' }))
    }
  }

  const onLinkTypeChange = (lt: LinkType) => {
    setForm(p => ({ ...p, link_type: lt, vendor_user_id: '', supplier_id: '', customer_id: '' }))
    setBank(p => ({ ...p, bank_source: lt === 'external' ? 'custom' : 'master' }))
    setSelectedStaff(null); setSelectedSupplier(null); setSelectedCustomer(null)
  }

  // ── save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.display_name.trim()) return toast.error('Display Name is required')
    const trimmedEmail = form.email.trim()
    if (form.phone.trim() && !isValidPhoneNumber(form.phone)) {
      setPhoneError('Enter a valid phone number with country code')
      return toast.error('Enter a valid phone number with country code')
    }
    if (!isValidEmail(trimmedEmail)) {
      setEmailError('Enter a valid email address')
      return toast.error('Enter a valid email address')
    }
    setPhoneError('')
    setEmailError('')
    const payload: Record<string, unknown> = {
      ...form,
      display_name: form.display_name.trim(),
      phone: form.phone.trim() || null,
      email: trimmedEmail || null,
      code: form.code || null,
      external_user_id: form.external_user_id || null,
      vendor_user_id: form.vendor_user_id || null,
      supplier_id: form.supplier_id || null,
      customer_id: form.customer_id || null,
      // bank fields
      bank_source: bank.bank_source,
      bank_name: bank.bank_source === 'custom' ? (bank.bank_name || null) : null,
      account_number: bank.bank_source === 'custom' ? (bank.account_number || null) : null,
      account_holder_name: bank.bank_source === 'custom' ? (bank.account_holder_name || null) : null,
      ifsc_code: bank.bank_source === 'custom' ? (bank.ifsc_code || null) : null,
      upi_id: form.default_payout_method === 'upi' ? (bank.upi_id || null) : null,
      wallet_provider: form.default_payout_method === 'wallet' ? (bank.wallet_provider || null) : null,
      wallet_id: form.default_payout_method === 'wallet' ? (bank.wallet_id || null) : null,
    }
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, data: payload })
        toast.success('Payee updated')
      } else {
        await create.mutateAsync(payload)
        toast.success('Payee created')
      }
      setShowForm(false)
    } catch (err) {
      toast.error(extractApiError(err, 'Failed to save payee'))
    }
  }

  const handleToggleStatus = async (p: CommissionPayee) => {
    const isActive = p.status === 'active'
    const nextStatus = isActive ? 'inactive' : 'active'
    const label = isActive ? 'deactivate' : 'activate'
    if (!confirm(`${isActive ? 'Deactivate' : 'Activate'} this payee?`)) return
    try {
      await update.mutateAsync({ id: p.id, data: { status: nextStatus } })
      toast.success(`Payee ${label}d`)
    } catch (err) {
      toast.error(extractApiError(err, `Failed to ${label} payee`))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this payee permanently? This cannot be undone.')) return
    try {
      await remove.mutateAsync(id)
      toast.success('Payee deleted')
    } catch (err) {
      toast.error(extractApiError(err, 'Failed to delete payee'))
    }
  }

  // ── bank preview helper ───────────────────────────────────────────────────

  const previewBank = editing ? masterBank : masterBankFromPicker

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Commission Payees</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage earners — staff, agents, contractors, partners, customers</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add Payee
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
        <Input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search by name, phone, or ID…"
          className="pl-10 bg-background border-input"
        />
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm table-fixed">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              <th className="w-[28%] text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Name / Code</th>
              <th className="w-[22%] text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Contact</th>
              <th className="w-[18%] text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</th>
              <th className="w-[14%] text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Payout</th>
              <th className="w-[10%] text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
              <th className="w-[8%] text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No payees found</td></tr>
            ) : items.map(p => (
              <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                      <UserCheck className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate" title={p.display_name}>{p.display_name}</div>
                      {p.code && <div className="text-xs text-gray-500 truncate" title={p.code}>{p.code}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <div className="truncate" title={p.phone || undefined}>{p.phone || '—'}</div>
                  {p.email && <div className="text-xs text-muted-foreground/80 truncate" title={p.email}>{p.email}</div>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="inline-flex shrink-0 whitespace-nowrap px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                    {LINK_LABELS[p.link_type as LinkType] || p.link_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 capitalize text-xs whitespace-nowrap">
                  {p.default_payout_method.replace(/_/g, ' ')}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`inline-flex shrink-0 whitespace-nowrap px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[p.status] || 'bg-muted text-muted-foreground'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button type="button" onClick={() => openEdit(p)} className={TABLE_ICON_BTN} aria-label="Edit payee">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => handleDelete(p.id)} className={`${TABLE_ICON_BTN} hover:text-red-500 dark:hover:text-red-400`} aria-label="Delete payee">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!isLoading && total > 0 && (
        <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
          <span className="text-xs text-muted-foreground">
            Page {page} of {pages} · {total} payee{total === 1 ? '' : 's'}
            {search.trim() ? ` matching "${search.trim()}"` : ''}
          </span>
          {pages > 1 && (
            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className={`${commissionPaginationInactive} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                ← Prev
              </button>
              {pageWindowStart > 1 && (
                <>
                  <button type="button" onClick={() => setPage(1)} className={commissionPaginationInactive}>1</button>
                  {pageWindowStart > 2 && <span className="px-1 text-xs text-muted-foreground">…</span>}
                </>
              )}
              {pageNumbers.map(pg => (
                <button
                  key={pg}
                  type="button"
                  onClick={() => setPage(pg)}
                  className={page === pg ? commissionPaginationActive : commissionPaginationInactive}
                >
                  {pg}
                </button>
              ))}
              {pageWindowStart + 4 < pages && (
                <>
                  {pageWindowStart + 5 < pages && <span className="px-1 text-xs text-muted-foreground">…</span>}
                  <button type="button" onClick={() => setPage(pages)} className={commissionPaginationInactive}>{pages}</button>
                </>
              )}
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage(p => p + 1)}
                className={`${commissionPaginationInactive} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Dialog ── */}
      {showForm && (
        <ModalOverlay onClose={closeForm}>
          <ModalPanel className="max-w-lg max-h-[90vh]">
            <div className="shrink-0 border-b border-border px-5 py-3">
              <ModalHeader
                title={editing ? 'Edit Payee' : 'Add Payee'}
                subtitle={
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Fields marked <span className="text-red-500">*</span> are required
                  </p>
                }
                onClose={closeForm}
              />
            </div>

            <ModalBody className="space-y-4 p-5">

              {/* 1. Type selector */}
              <div>
                <Label className={`block mb-2 ${formLabelClass}`}>Payee Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {LINK_TYPES.map(lt => (
                    <button key={lt} type="button" onClick={() => onLinkTypeChange(lt)}
                      className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                        form.link_type === lt
                          ? 'border-primary bg-primary/10 text-primary'
                          : TYPE_TILE_INACTIVE
                      }`}>
                      <div className="font-medium">{LINK_LABELS[lt]}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 leading-tight">{LINK_DESCRIPTIONS[lt]}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Master picker */}
              {form.link_type === 'vendor_user' && (
                <div>
                  <Label className={`block mb-1 ${formLabelClass}`}>Select Staff Member</Label>
                  <StaffPicker selected={selectedStaff} onSelect={onStaffSelect} />
                </div>
              )}
              {form.link_type === 'supplier' && (
                <div>
                  <Label className={`block mb-1 ${formLabelClass}`}>Select Supplier / Contractor</Label>
                  <SupplierPicker selected={selectedSupplier} onSelect={onSupplierSelect} />
                </div>
              )}
              {form.link_type === 'customer' && (
                <div>
                  <Label className={`block mb-1 ${formLabelClass}`}>Select Customer</Label>
                  <CustomerPicker selected={selectedCustomer} onSelect={onCustomerSelect} />
                </div>
              )}

              {/* 3. Core identity fields */}
              <div>
                <Label className={`block mb-1 ${formLabelClass}`} required>
                  Display Name
                </Label>
                <input value={form.display_name} onChange={e => set('display_name', e.target.value)}
                  placeholder="Name shown on payout reports"
                  className={FIELD_INPUT} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className={`block mb-1 ${formLabelClass}`}>Phone</Label>
                  <PhoneInput
                    value={form.phone}
                    onChange={v => { set('phone', v); setPhoneError('') }}
                    defaultCountryIso="IN"
                    inferCountryFromLocation
                    compactCountry
                    error={phoneError}
                  />
                </div>
                <div>
                  <Label className={`block mb-1 ${formLabelClass}`}>Email</Label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => { set('email', e.target.value); setEmailError('') }}
                    placeholder="name@example.com"
                    className={`${FIELD_INPUT}${emailError ? ' border-destructive bg-destructive/10' : ''}`}
                  />
                  {emailError && <p className="text-xs text-destructive mt-1">{emailError}</p>}
                </div>
              </div>

              <div>
                <Label className={`block mb-1 ${formLabelClass}`}>Status</Label>
                <Select
                  value={form.status}
                  onChange={(v) => set('status', v)}
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' },
                    { value: 'suspended', label: 'Suspended' },
                  ]}
                  aria-label="Status"
                  className="w-full"
                />
              </div>

              {/* 4. Payout section — logic:
                  - Linked payees (staff/supplier/customer): show master/different toggle first.
                    - "Use master bank" → show preview chip only, hide payout method selector entirely.
                    - "Different account" → show payout method selector + corresponding inputs.
                  - External/agent payees (no master): show payout method selector + inputs directly.
              */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted/40 px-4 py-2.5 flex items-center gap-2 border-b border-border">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Payout Details</span>
                </div>
                <div className="p-4 space-y-4">

                  {/* master / different toggle — only for linked payees */}
                  {hasmaster && (
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button"
                        onClick={() => setBank(p => ({ ...p, bank_source: 'master' }))}
                        className={`px-3 py-2.5 rounded-lg border text-sm text-left transition-colors ${
                          bank.bank_source === 'master'
                            ? 'border-primary bg-primary/10 text-primary'
                            : `${TYPE_TILE_INACTIVE} border`
                        }`}>
                        <div className="font-medium">Use master bank</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Same bank as the linked {LINK_LABELS[form.link_type].toLowerCase()}
                        </div>
                      </button>
                      <button type="button"
                        onClick={() => setBank(p => ({ ...p, bank_source: 'custom' }))}
                        className={`px-3 py-2.5 rounded-lg border text-sm text-left transition-colors ${
                          bank.bank_source === 'custom'
                            ? 'border-primary bg-primary/10 text-primary'
                            : `${TYPE_TILE_INACTIVE} border`
                        }`}>
                        <div className="font-medium">Different account</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Use a separate account for commission payouts</div>
                      </button>
                    </div>
                  )}

                  {/* "Use master bank" — show preview, nothing else */}
                  {hasmaster && bank.bank_source === 'master' && (
                    <>
                      {masterBankQuery.isLoading && editing && (
                        <p className="text-sm text-muted-foreground">Loading bank details…</p>
                      )}
                      {previewBank && Object.keys(previewBank).length > 0 && (
                        <div className="rounded-lg bg-primary/10 border border-primary/30 px-4 py-3 space-y-1.5">
                          {previewBank.bank_name && (
                            <div className="flex gap-2 text-sm">
                              <span className="text-muted-foreground w-28 flex-shrink-0">Bank</span>
                              <span className="font-medium text-foreground">{previewBank.bank_name}</span>
                            </div>
                          )}
                          {previewBank.account_number && (
                            <div className="flex gap-2 text-sm">
                              <span className="text-muted-foreground w-28 flex-shrink-0">Account No.</span>
                              <span className="font-medium text-foreground">
                                {'•'.repeat(Math.max(0, previewBank.account_number.length - 4))}
                                {previewBank.account_number.slice(-4)}
                              </span>
                            </div>
                          )}
                          {previewBank.account_holder_name && (
                            <div className="flex gap-2 text-sm">
                              <span className="text-muted-foreground w-28 flex-shrink-0">Holder</span>
                              <span className="font-medium text-foreground">{previewBank.account_holder_name}</span>
                            </div>
                          )}
                          {previewBank.ifsc_code && (
                            <div className="flex gap-2 text-sm">
                              <span className="text-muted-foreground w-28 flex-shrink-0">IFSC</span>
                              <span className="font-medium text-foreground">{previewBank.ifsc_code}</span>
                            </div>
                          )}
                          {previewBank.account_type && (
                            <div className="flex gap-2 text-sm">
                              <span className="text-muted-foreground w-28 flex-shrink-0">Account Type</span>
                              <span className="font-medium text-foreground capitalize">{previewBank.account_type}</span>
                            </div>
                          )}
                          <p className="text-xs text-primary pt-1">From the linked master record. Edit there to update.</p>
                        </div>
                      )}
                    </>
                  )}

                  {/* "Different account" OR external — show payout method selector + inputs */}
                  {(!hasmaster || bank.bank_source === 'custom') && (
                    <>
                      {/* Payout method selector */}
                      <div>
                        <Label className={`block mb-2 ${formLabelClass}`}>Payout Method</Label>
                        <div className="grid grid-cols-5 gap-1">
                          {PAYOUT_METHODS.map(m => (
                            <button key={m.value} type="button" onClick={() => set('default_payout_method', m.value)}
                              className={`py-2 rounded-lg border text-xs font-medium transition-colors ${
                                form.default_payout_method === m.value
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : TYPE_TILE_INACTIVE
                              }`}>
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Bank inputs */}
                      {form.default_payout_method === 'bank_transfer' && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className={`block mb-1 ${formLabelClass}`}>Bank Name</Label>
                              <input value={bank.bank_name} onChange={e => setB('bank_name', e.target.value)}
                                placeholder="e.g. HDFC Bank"
                                className={FIELD_INPUT} />
                            </div>
                            <div>
                              <Label className={`block mb-1 ${formLabelClass}`}>IFSC Code</Label>
                              <input value={bank.ifsc_code} onChange={e => setB('ifsc_code', e.target.value.toUpperCase())}
                                placeholder="HDFC0001234"
                                className={FIELD_INPUT} />
                            </div>
                          </div>
                          <div>
                            <Label className={`block mb-1 ${formLabelClass}`}>Account Number</Label>
                            <input value={bank.account_number} onChange={e => setB('account_number', e.target.value)}
                              placeholder="Enter account number"
                              className={FIELD_INPUT} />
                          </div>
                          <div>
                            <Label className={`block mb-1 ${formLabelClass}`}>Account Holder Name</Label>
                            <input value={bank.account_holder_name} onChange={e => setB('account_holder_name', e.target.value)}
                              placeholder="As per bank records"
                              className={FIELD_INPUT} />
                          </div>
                        </div>
                      )}

                      {/* UPI inputs */}
                      {form.default_payout_method === 'upi' && (
                        <div>
                          <Label className={`block mb-1 ${formLabelClass}`}>UPI ID</Label>
                          <input value={bank.upi_id} onChange={e => setB('upi_id', e.target.value)}
                            placeholder="name@upi or 9xxxxxxx@paytm"
                            className={FIELD_INPUT} />
                        </div>
                      )}

                      {/* Wallet inputs */}
                      {form.default_payout_method === 'wallet' && (
                        <div className="space-y-3">
                          <div>
                            <Label className={`block mb-1 ${formLabelClass}`}>Wallet Provider</Label>
                            <Select
                              value={bank.wallet_provider}
                              onChange={(v) => setB('wallet_provider', v)}
                              options={WALLET_PROVIDERS.map(w => ({ value: w, label: w }))}
                              aria-label="Wallet provider"
                              className="w-full"
                            />
                          </div>
                          <div>
                            <Label className={`block mb-1 ${formLabelClass}`}>Wallet ID / Phone</Label>
                            <input value={bank.wallet_id} onChange={e => setB('wallet_id', e.target.value)}
                              placeholder="Registered phone or wallet ID"
                              className={FIELD_INPUT} />
                          </div>
                        </div>
                      )}

                      {/* Cash / Cheque — no extra inputs */}
                      {(form.default_payout_method === 'cash' || form.default_payout_method === 'cheque') && (
                        <div className="bg-muted/40 rounded-lg px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          {form.default_payout_method === 'cash'
                            ? 'Cash payouts — no additional payment details needed.'
                            : 'Cheque payouts — cheque will be issued at payout run time.'}
                        </div>
                      )}
                    </>
                  )}

                </div>
              </div>

              {/* Advanced */}
              <CollapsibleSection title="Advanced">
                <div>
                  <Label className={`block mb-1 ${formLabelClass}`}>Code (optional)</Label>
                  <input value={form.code} onChange={e => set('code', e.target.value)} placeholder="e.g. AGT-001"
                    className={FIELD_INPUT} />
                  <p className="text-xs text-muted-foreground mt-1">Short reference printed on payout statements.</p>
                </div>
                <div>
                  <Label className={`block mb-1 ${formLabelClass}`}>{form.link_type === 'external' ? 'External / Agent ID' : 'Master Record ID'}</Label>
                  <input
                    value={form.external_user_id}
                    onChange={e => set('external_user_id', e.target.value)}
                    placeholder={form.link_type === 'external' ? 'Phone number or partner ID' : 'Auto-filled from master data'}
                    readOnly={form.link_type !== 'external'}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                      form.link_type !== 'external'
                        ? 'border-border bg-muted/40 text-muted-foreground cursor-default'
                        : 'border-input'
                    }`}
                  />
                  {form.link_type !== 'external' && (
                    <p className="text-xs text-muted-foreground mt-1">Automatically set to the master record's ID when a record is selected.</p>
                  )}
                </div>
                <div>
                  <Label className={`block mb-1 ${formLabelClass}`}>Currency</Label>
                  <input value={form.currency} onChange={e => set('currency', e.target.value)} maxLength={3}
                    className={FIELD_INPUT} />
                </div>
              </CollapsibleSection>
            </ModalBody>

            <ModalFooter className="flex justify-end gap-3 border-t border-gray-100 bg-white px-4 py-4">
              <button type="button" onClick={closeForm} className="btn-cancel rounded-lg border border-gray-200 px-4 py-2 text-sm">Cancel</button>
              <button type="button" onClick={handleSave} disabled={create.isPending || update.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50">
                {create.isPending || update.isPending ? 'Saving…' : 'Save'}
              </button>
            </ModalFooter>
          </ModalPanel>
        </ModalOverlay>
      )}
    </div>
  )
}
