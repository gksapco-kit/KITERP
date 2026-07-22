import { useState, useCallback, useMemo } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier,
  usePurchaseOrders,
} from '@/hooks/useVendor'
import { useInlineFieldPatch, INLINE_EDIT_HINT } from '@/hooks/useInlineFieldPatch'
import { formatDate, formatCurrency } from '@/lib/utils'
import { ResizableTable } from '@/components/table/ResizableTable'
import { InlineEditCell } from '@/components/table/InlineEditCell'
import type { Supplier, PurchaseOrder } from '@/types'
import {
  Loader2, Plus, Search, Pencil, Trash2, X, Truck, Mail, Phone, MapPin,
  Eye, ClipboardList, Package, Calendar, FileText, ArrowRight,
  Building2, CheckCircle2, AlertCircle, IndianRupee,
  PauseCircle, Ban, RotateCcw, ShieldAlert, AlertTriangle, Trash, Copy,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { TableToolbar } from '@/components/table/TableToolbar'
import { processRows, type SortDir } from '@/lib/tableList'
import { vendorApi } from '@/api/vendor'
import { AddPartyModal } from '@/components/parties/AddPartyModal'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { askConfirm } from '@/components/common/ConfirmProvider'

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
const GST_STATES: Record<string, string> = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi',
  '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
  '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
  '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
  '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra',
  '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
  '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh',
  '97': 'Other Territory',
}

type ModalMode = 'create' | 'edit' | null

const poStatusStyle: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-50 text-blue-700',
  partial_received: 'bg-amber-50 text-amber-700',
  received: 'bg-green-50 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-50 text-red-600',
}

// ── Master status helpers ─────────────────────────────────────────────────────

type MasterStatus = 'active' | 'on_hold' | 'blocked' | 'payment_blocked' | 'inactive'

const STATUS_CFG: Record<MasterStatus, { label: string; bg: string; text: string; dot: string }> = {
  active:          { label: 'Active',           bg: 'bg-green-50',   text: 'text-green-700',  dot: 'bg-green-500'  },
  on_hold:         { label: 'On Hold',          bg: 'bg-amber-50',   text: 'text-amber-700',  dot: 'bg-amber-500'  },
  blocked:         { label: 'Blocked',          bg: 'bg-red-50',     text: 'text-red-700',    dot: 'bg-red-500'    },
  payment_blocked: { label: 'Pymt. Blocked',    bg: 'bg-orange-50',  text: 'text-orange-700', dot: 'bg-orange-500' },
  inactive:        { label: 'Inactive',         bg: 'bg-gray-100',   text: 'text-gray-500',   dot: 'bg-gray-400'   },
}

function getMasterStatus(s: Supplier): MasterStatus {
  const sx = s as unknown as Record<string, unknown>
  if (!s.is_active) return 'inactive'
  if (sx.party_status === 'blocked') return 'blocked'
  if (sx.payment_blocked) return 'payment_blocked'
  if (sx.party_status === 'on_hold') return 'on_hold'
  return 'active'
}

function addDaysStr(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

export default function SuppliersPage() {
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ mode: ModalMode; supplier?: Supplier }>({ mode: null })
  const [viewing, setViewing] = useState<Supplier | null>(null)

  const { data, isLoading } = useSuppliers(search ? { search } : undefined)
  const deleteMut = useDeleteSupplier()
  const updateSupplier = useUpdateSupplier()
  const { isSaving, patchField } = useInlineFieldPatch(updateSupplier)

  const suppliers = data?.items || []

  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const displaySuppliers = useMemo(
    () => processRows(suppliers, '', () => [], sortKey, sortDir, {
      name: (s) => s.name,
      contact_name: (s) => s.contact_name || '',
      gstin: (s) => s.gstin || '',
      email: (s) => s.email || '',
      phone: (s) => s.phone || '',
      opening_balance: (s) => s.opening_balance ?? 0,
      is_active: (s) => s.is_active ? 'Active' : 'Inactive',
      created_at: (s) => (s.created_at ? new Date(s.created_at).getTime() : 0),
    }),
    [suppliers, sortKey, sortDir],
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">Master Data</p>
          <h1 className="text-2xl font-bold text-gray-900">Vendors / Suppliers</h1>
        </div>
        <Button className="gap-2" onClick={() => setModal({ mode: 'create' })}>
          <Plus className="w-4 h-4" /> Add Master Data
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search suppliers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : displaySuppliers.length === 0 ? (
        <div className="text-center py-16">
          <Truck className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500">No suppliers found. Add your first supplier to get started.</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <TableToolbar
              search=""
              onSearchChange={() => {}}
              hideSearch
              hint={INLINE_EDIT_HINT}
              sortOptions={[
                { value: 'name', label: 'Name' },
                { value: 'contact_name', label: 'Contact' },
                { value: 'gstin', label: 'GSTIN' },
                { value: 'phone', label: 'Phone' },
                { value: 'opening_balance', label: 'Balance' },
                { value: 'is_active', label: 'Active' },
                { value: 'created_at', label: 'Added' },
              ]}
              sortKey={sortKey}
              sortDir={sortDir}
              onSortKeyChange={setSortKey}
              onSortDirChange={setSortDir}
            />
            <ResizableTable tableId="suppliers" defaultWidths={[180, 120, 140, 120, 90, 90, 80]}>
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Name</TableColumnLabel></th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Contact</TableColumnLabel></th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell"><TableColumnLabel>GSTIN</TableColumnLabel></th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Phone</TableColumnLabel></th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell"><TableColumnLabel>Balance</TableColumnLabel></th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Status</TableColumnLabel></th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Actions</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {displaySuppliers.map((s) => {
                  const bal = s.opening_balance ?? 0
                  return (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <InlineEditCell
                        value={s.name}
                        saving={isSaving(s.id, 'name')}
                        validate={(v) => String(v).trim().length < 2 ? 'Min 2 characters' : null}
                        onSave={(v) => patchField(s.id, 'name', String(v).trim())}
                        title="Edit supplier name"
                      >
                        <span className="text-sm font-medium text-gray-900">{s.name}</span>
                      </InlineEditCell>
                    </td>
                    <td className="px-6 py-4">
                      <InlineEditCell
                        value={s.contact_name || ''}
                        saving={isSaving(s.id, 'contact_name')}
                        onSave={(v) => patchField(s.id, 'contact_name', String(v).trim())}
                        title="Edit contact name"
                      >
                        <span className="text-sm text-gray-600">{s.contact_name || '—'}</span>
                      </InlineEditCell>
                      <InlineEditCell
                        value={s.email || ''}
                        saving={isSaving(s.id, 'email')}
                        onSave={(v) => patchField(s.id, 'email', String(v).trim())}
                        title="Edit email"
                      >
                        <span className="text-xs text-gray-500">{s.email || '—'}</span>
                      </InlineEditCell>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <InlineEditCell
                        value={s.gstin || ''}
                        saving={isSaving(s.id, 'gstin')}
                        onSave={(v) => patchField(s.id, 'gstin', String(v).trim().toUpperCase())}
                        title="Edit GSTIN"
                        inputClassName="font-mono text-xs uppercase"
                      >
                        <span className="text-xs font-mono text-gray-600">{s.gstin || '—'}</span>
                      </InlineEditCell>
                    </td>
                    <td className="px-6 py-4">
                      <InlineEditCell
                        value={s.phone || ''}
                        saving={isSaving(s.id, 'phone')}
                        onSave={(v) => patchField(s.id, 'phone', String(v).trim())}
                        title="Edit phone"
                      >
                        <span className="text-sm text-gray-600">{s.phone || '—'}</span>
                      </InlineEditCell>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <InlineEditCell
                        type="number"
                        value={bal}
                        step="0.01"
                        saving={isSaving(s.id, 'opening_balance')}
                        onSave={(v) => patchField(s.id, 'opening_balance', Number(v))}
                        title="Edit opening balance"
                      >
                        {bal !== 0 ? (
                          <span className={bal > 0 ? 'text-orange-600' : 'text-green-600'}>{formatCurrency(Math.abs(bal))} {bal > 0 ? 'Cr' : 'Dr'}</span>
                        ) : <span className="text-gray-400">—</span>}
                      </InlineEditCell>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <InlineEditCell
                        type="select"
                        value={s.is_active ? 'true' : 'false'}
                        options={[
                          { value: 'true', label: 'Active' },
                          { value: 'false', label: 'Inactive' },
                        ]}
                        saving={isSaving(s.id, 'is_active')}
                        onSave={(v) => patchField(s.id, 'is_active', v === 'true')}
                        title="Edit status"
                      >
                        {(() => {
                          const st = getMasterStatus(s)
                          const cfg = STATUS_CFG[st]
                          return (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                              {cfg.label}
                            </span>
                          )
                        })()}
                      </InlineEditCell>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" title="View details" onClick={() => setViewing(s)}>
                          <Eye className="w-4 h-4 text-blue-500" />
                        </Button>
                        <Button variant="ghost" size="sm" title="Edit" onClick={() => setModal({ mode: 'edit', supplier: s })}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {s.is_active && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Deactivate"
                            className="text-red-600 hover:text-red-700"
                            onClick={async () => { if (await askConfirm('Deactivate this supplier?')) deleteMut.mutate(s.id) }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </ResizableTable>
          </CardContent>
        </Card>
      )}

      {modal.mode === 'create' && (
        <AddPartyModal
          defaultType="supplier"
          onClose={() => setModal({ mode: null })}
        />
      )}

      {modal.mode === 'edit' && modal.supplier && (
        <SupplierModal
          mode="edit"
          supplier={modal.supplier}
          onClose={() => setModal({ mode: null })}
        />
      )}

      {viewing && (
        <SupplierViewDrawer
          supplier={viewing}
          onClose={() => setViewing(null)}
          onEdit={(s) => { setViewing(null); setModal({ mode: 'edit', supplier: s }) }}
        />
      )}
    </div>
  )
}

function SupplierModal({
 mode, supplier, onClose }: {
  mode: 'create' | 'edit'
  supplier?: Supplier
  onClose: () => void
}) {
  const createMut = useCreateSupplier()
  const updateMut = useUpdateSupplier()

  const [name, setName] = useState(supplier?.name || '')
  const [contactName, setContactName] = useState(supplier?.contact_name || '')
  const [email, setEmail] = useState(supplier?.email || '')
  const [phone, setPhone] = useState(supplier?.phone || '')
  const [street, setStreet] = useState(supplier?.address?.street || '')
  const [city, setCity] = useState(supplier?.address?.city || '')
  const [state, setState] = useState(supplier?.address?.state || '')
  const [postalCode, setPostalCode] = useState(supplier?.address?.postal_code || '')
  const [notes, setNotes] = useState(supplier?.notes || '')
  const [gstin, setGstin] = useState(supplier?.gstin || '')
  const [panNumber, setPanNumber] = useState(supplier?.pan_number || '')
  const [openingBalance, setOpeningBalance] = useState(supplier?.opening_balance?.toString() || '')
  const [gstLooking, setGstLooking] = useState(false)
  const [gstStatus, setGstStatus] = useState<'idle' | 'valid' | 'invalid' | 'fetched'>(supplier?.gstin ? 'valid' : 'idle')

  const isLoading = createMut.isPending || updateMut.isPending

  const handleGstinChange = (val: string) => {
    const g = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15)
    setGstin(g)
    setGstStatus('idle')
    if (g.length === 15) {
      if (GSTIN_RE.test(g)) {
        setGstStatus('valid')
        setPanNumber(g.slice(2, 12))
        const stateName = GST_STATES[g.slice(0, 2)] || ''
        if (stateName && !state) setState(stateName)
      } else {
        setGstStatus('invalid')
      }
    }
  }

  const fetchGstDetails = async () => {
    if (!gstin || gstin.length !== 15) return
    setGstLooking(true)
    try {
      const data = await vendorApi.gstLookup(gstin)
      if (data.api_fetched) {
        const addr = data.address as Record<string, string> | undefined
        if (!name) setName((data.trade_name as string) || (data.legal_name as string) || '')
        setPanNumber((data.pan as string) || panNumber)
        if (addr) {
          if (addr.street && !street) setStreet(addr.street)
          if (addr.city && !city) setCity(addr.city)
          if (addr.state) setState(addr.state)
          if (addr.pincode && !postalCode) setPostalCode(addr.pincode)
        }
        setGstStatus('fetched')
      }
    } catch { /* noop */ } finally {
      setGstLooking(false)
    }
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const payload: Record<string, unknown> = {
      name,
      contact_name: contactName || undefined,
      email: email || undefined,
      phone: phone || undefined,
      notes: notes || undefined,
      address: (street || city || state || postalCode) ? { street, city, state, postal_code: postalCode, country: 'India' } : undefined,
      gstin: gstin || undefined,
      pan_number: panNumber || undefined,
      opening_balance: openingBalance ? parseFloat(openingBalance) : 0,
    }

    try {
      if (mode === 'create') {
        await createMut.mutateAsync(payload)
      } else if (supplier) {
        await updateMut.mutateAsync({ id: supplier.id, data: payload })
      }
      onClose()
    } catch {
      // handled by hook toast
    }
  }, [name, contactName, email, phone, street, city, state, postalCode, notes, gstin, panNumber, openingBalance, mode, supplier, createMut, updateMut, onClose])

  return (
    <div data-kiterp-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-semibold">{mode === 'create' ? 'Add Supplier' : 'Edit Supplier'}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* GSTIN */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> GSTIN <span className="text-gray-400 font-normal text-xs">(optional)</span></Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={gstin} onChange={(e) => handleGstinChange(e.target.value)}
                  placeholder="e.g. 36AAGCI8158Q1ZP" maxLength={15}
                  className={`font-mono uppercase ${gstStatus === 'fetched' ? 'border-green-400' : gstStatus === 'invalid' ? 'border-red-400' : ''}`}
                />
                {gstStatus === 'fetched' && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />}
                {gstStatus === 'invalid' && <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />}
              </div>
              {(gstStatus === 'valid' || gstStatus === 'fetched') && (
                <Button type="button" variant="outline" size="sm" onClick={fetchGstDetails} disabled={gstLooking} className="whitespace-nowrap">
                  {gstLooking ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                  Fetch Details
                </Button>
              )}
            </div>
            {gstStatus === 'fetched' && <p className="text-xs text-green-600">Details fetched from GST portal</p>}
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label>Supplier Name *</Label>
            <div className="relative">
              <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company name" className="pl-10" required />
            </div>
          </div>

          {/* Contact + Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Contact Person</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <PhoneInput value={phone} onChange={setPhone} defaultCountryIso="IN" />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label>Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="supplier@example.com" className="pl-10" />
            </div>
          </div>

          {/* PAN + Opening Balance */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>PAN</Label>
              <Input
                value={panNumber} onChange={(e) => setPanNumber(e.target.value.toUpperCase().slice(0, 10))}
                placeholder="ABCDE1234F" className="font-mono uppercase" maxLength={10}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><IndianRupee className="w-3 h-3" /> Opening Balance</Label>
              <Input
                type="number" step="0.01" value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)} placeholder="0.00"
              />
              <p className="text-xs text-gray-400">+ve = payable to supplier</p>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Address</Label>
            <Input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Street address" />
            <div className="grid grid-cols-3 gap-2 mt-2">
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
              <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="State" />
              <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="PIN code" />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <textarea
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none"
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment terms, lead times, etc."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="cancel" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={isLoading || !name.trim()}>
              {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {mode === 'create' ? 'Add Supplier' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SupplierViewDrawer({
 supplier, onClose, onEdit }: {
  supplier: Supplier
  onClose: () => void
  onEdit: (s: Supplier) => void
}) {
  const navigate = useNavigate()
  const { data: poData, isLoading: poLoading } = usePurchaseOrders({ supplier_id: supplier.id, size: 50 })
  const purchaseOrders = poData?.items || []

  // Status management
  const updateMut  = useUpdateSupplier()
  const deleteMut2 = useDeleteSupplier()
  const sx = supplier as unknown as Record<string, unknown>
  const currentStatus = getMasterStatus(supplier)
  const stCfg = STATUS_CFG[currentStatus] as { label: string; bg: string; text: string; dot: string }

  const [showHoldForm, setShowHoldForm]       = useState(false)
  const [holdUntilDate, setHoldUntilDate]     = useState((sx.hold_until as string) || '')
  const [confirmSoftDel, setConfirmSoftDel]   = useState(false)
  const [confirmHardDel, setConfirmHardDel]   = useState(false)
  const [hardDelInput, setHardDelInput]       = useState('')
  const [statusBusy, setStatusBusy]           = useState(false)

  const applyStatus = async (patch: Record<string, unknown>) => {
    setStatusBusy(true)
    try {
      await updateMut.mutateAsync({ id: supplier.id, data: patch })
      onClose()
    } catch { /* toast handled in hook */ } finally { setStatusBusy(false) }
  }

  const addr = supplier.address
  const hasAddress = addr && (addr.street || addr.city || addr.state || addr.postal_code)

  return (
    <div data-kiterp-modal className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl bg-card border-l border-border text-foreground shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">{supplier.name}</h2>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${stCfg.bg} ${stCfg.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${stCfg.dot}`} />
                {stCfg.label}
              </span>
              <div className="flex items-center gap-1.5 mt-1.5 min-w-0 max-w-[280px]">
                <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400 shrink-0">Master ID</span>
                <code className="text-[11px] font-mono text-gray-600 truncate" title={supplier.id}>{supplier.id}</code>
                <button
                  type="button"
                  aria-label="Copy master ID"
                  onClick={() => {
                    navigator.clipboard.writeText(supplier.id)
                    toast.success('Master ID copied')
                  }}
                  className="p-1 rounded hover:bg-gray-100 shrink-0"
                >
                  <Copy className="w-3 h-3 text-gray-400" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onEdit(supplier)}>
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Button>
            <button type="button" aria-label="Close" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Contact Info */}
          <div>
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Contact Information</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              {supplier.contact_name && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white border flex items-center justify-center shrink-0">
                    <Truck className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Contact Person</p>
                    <p className="text-sm font-medium text-gray-900">{supplier.contact_name}</p>
                  </div>
                </div>
              )}
              {supplier.email && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white border flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <a href={`mailto:${supplier.email}`} className="text-sm font-medium text-blue-600 hover:underline">{supplier.email}</a>
                  </div>
                </div>
              )}
              {supplier.phone && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white border flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <a href={`tel:${supplier.phone}`} className="text-sm font-medium text-blue-600 hover:underline">{supplier.phone}</a>
                  </div>
                </div>
              )}
              {hasAddress && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white border flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Address</p>
                    <p className="text-sm text-gray-900">
                      {[addr!.street, addr!.city, addr!.state, addr!.postal_code].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
              )}
              {!supplier.contact_name && !supplier.email && !supplier.phone && !hasAddress && (
                <p className="text-sm text-gray-400 italic">No contact details added yet.</p>
              )}
            </div>
          </div>

          {/* GST / Business Details */}
          {(supplier.gstin || supplier.pan_number || (supplier.opening_balance && supplier.opening_balance !== 0)) && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">GST / Business Details</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                {supplier.gstin && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">GSTIN</span>
                    <span className="text-sm font-mono font-semibold text-blue-700 tracking-wider">{supplier.gstin}</span>
                  </div>
                )}
                {supplier.pan_number && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">PAN</span>
                    <span className="text-sm font-mono font-semibold tracking-wider">{supplier.pan_number}</span>
                  </div>
                )}
                {supplier.opening_balance !== undefined && supplier.opening_balance !== 0 && (
                  <div className="flex justify-between items-center border-t pt-3 mt-1">
                    <span className="text-xs text-gray-500">Opening Balance</span>
                    <span className={`text-sm font-bold ${supplier.opening_balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {formatCurrency(Math.abs(supplier.opening_balance))} {supplier.opening_balance > 0 ? 'Payable' : 'Receivable'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {supplier.notes && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Notes</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{supplier.notes}</p>
              </div>
            </div>
          )}

          {/* Dates */}
          <div>
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Timeline</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Added</p>
                    <p className="text-sm font-medium">{formatDate(supplier.created_at)}</p>
                  </div>
                </div>
                {supplier.updated_at && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Last Updated</p>
                      <p className="text-sm font-medium">{formatDate(supplier.updated_at)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status & Access Controls */}
          <div>
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" /> Status &amp; Access Controls
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">

              {/* Current status row */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Current Status</span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${stCfg.bg} ${stCfg.text}`}>
                  <span className={`w-2 h-2 rounded-full ${stCfg.dot}`} />
                  {stCfg.label}
                </span>
              </div>

              {/* Hold-until info */}
              {currentStatus === 'on_hold' && sx.hold_until != null && String(sx.hold_until) !== '' && (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <PauseCircle className="w-3.5 h-3.5 shrink-0" />
                  On hold until {new Date(sx.hold_until as string).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              )}

              {/* Action buttons grid */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {/* Restore Active */}
                {currentStatus !== 'active' && (
                  <button
                    disabled={statusBusy}
                    onClick={() => applyStatus({ party_status: 'active', payment_blocked: false, hold_until: null, is_active: true })}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-green-300 bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Restore Active
                  </button>
                )}

                {/* Set On Hold */}
                <button
                  disabled={statusBusy}
                  onClick={() => setShowHoldForm(v => !v)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 ${
                    showHoldForm
                      ? 'border-amber-400 bg-amber-100 text-amber-800'
                      : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  <PauseCircle className="w-3.5 h-3.5" />
                  {currentStatus === 'on_hold' ? 'Adjust Hold' : 'Set On Hold'}
                </button>

                {/* Block / Unblock Payment */}
                <button
                  disabled={statusBusy}
                  onClick={() => applyStatus({ payment_blocked: !sx.payment_blocked })}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 ${
                    sx.payment_blocked
                      ? 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Ban className="w-3.5 h-3.5" />
                  {sx.payment_blocked ? 'Unblock Payment' : 'Block Payment'}
                </button>

                {/* Block Record */}
                <button
                  disabled={statusBusy || currentStatus === 'blocked'}
                  onClick={() => applyStatus({ party_status: 'blocked' })}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-300 bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {currentStatus === 'blocked' ? 'Blocked' : 'Block Record'}
                </button>
              </div>

              {/* On Hold inline form */}
              {showHoldForm && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-amber-800">Hold Until</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[7, 14, 30, 60, 90].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setHoldUntilDate(addDaysStr(n))}
                        className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors"
                      >
                        +{n}d
                      </button>
                    ))}
                    <input
                      type="date"
                      value={holdUntilDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => setHoldUntilDate(e.target.value)}
                      className="flex-1 text-xs border border-amber-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 min-w-[130px]"
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={statusBusy}
                    onClick={() => { applyStatus({ party_status: 'on_hold', hold_until: holdUntilDate || null }); setShowHoldForm(false) }}
                    className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    {statusBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm Hold'}
                  </Button>
                </div>
              )}

              {/* Danger zone */}
              <div className="flex gap-2 pt-2 border-t">
                <button
                  onClick={() => setConfirmSoftDel(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 bg-white text-red-600 text-xs font-medium hover:bg-red-50 transition-colors flex-1 justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Deactivate
                </button>
                <button
                  onClick={() => setConfirmHardDel(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-600 bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors flex-1 justify-center"
                >
                  <Trash className="w-3.5 h-3.5" /> Delete Permanently
                </button>
              </div>
            </div>
          </div>

          {/* Purchase Orders */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5" /> Purchase Orders
                {purchaseOrders.length > 0 && (
                  <span className="bg-blue-100 text-blue-700 text-xs font-bold px-1.5 py-0.5 rounded-full ml-1">
                    {purchaseOrders.length}
                  </span>
                )}
              </h3>
              <Button variant="outline" size="sm" className="gap-1 text-xs h-7"
                onClick={() => navigate('/purchase-orders')}>
                View All <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
            {poLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
              </div>
            ) : purchaseOrders.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-6 text-center">
                <FileText className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No purchase orders with this supplier yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {purchaseOrders.map((po: PurchaseOrder) => (
                  <div
                    key={po.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/purchase-orders/${po.id}`)}
                  >
                    <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">#{po.po_number}</p>
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium capitalize ${poStatusStyle[po.status] || 'bg-gray-100 text-gray-700'}`}>
                          {po.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        {po.order_date && <span>{formatDate(po.order_date)}</span>}
                        <span>{po.items?.length || 0} item{(po.items?.length || 0) !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(po.total)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Soft Delete / Deactivate confirmation */}
      {confirmSoftDel && (
        <div data-kiterp-modal className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 overflow-y-auto" onClick={() => setConfirmSoftDel(false)}>
          <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Deactivate Record</h3>
                <p className="text-xs text-gray-500">This marks the record as inactive. It can be restored later.</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-5">
              <strong>{supplier.name}</strong> will be deactivated and hidden from active operations.
            </p>
            <div className="flex gap-3">
              <Button variant="cancel" className="flex-1" onClick={() => setConfirmSoftDel(false)}>Cancel</Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={statusBusy}
                onClick={() => { applyStatus({ is_active: false }); setConfirmSoftDel(false) }}
              >
                {statusBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Deactivate'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Hard Delete confirmation */}
      {confirmHardDel && (
        <div data-kiterp-modal className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 overflow-y-auto" onClick={() => { setConfirmHardDel(false); setHardDelInput('') }}>
          <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash className="w-5 h-5 text-red-700" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-red-700">Permanently Delete</h3>
                <p className="text-xs text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-3">
              Type <strong className="font-semibold">{supplier.name}</strong> to confirm permanent deletion of this record and all associated data.
            </p>
            <input
              className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-400"
              placeholder={supplier.name}
              value={hardDelInput}
              onChange={e => setHardDelInput(e.target.value)}
            />
            <div className="flex gap-3">
              <Button variant="cancel" className="flex-1" onClick={() => { setConfirmHardDel(false); setHardDelInput('') }}>Cancel</Button>
              <Button
                className="flex-1 bg-red-700 hover:bg-red-800 text-white"
                disabled={hardDelInput !== supplier.name || deleteMut2.isPending}
                onClick={() => { deleteMut2.mutate(supplier.id); onClose() }}
              >
                {deleteMut2.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete Forever'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
