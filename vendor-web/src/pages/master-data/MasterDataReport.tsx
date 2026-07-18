/**
 * Master Data — Customers / Suppliers
 * Unified view of all party records with full CRUD, detail drawer,
 * status management, PO history, and CSV export.
 */
import { useState, useMemo, useCallback, useEffect, useRef, type MouseEvent } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { useNavigate } from 'react-router-dom'
import {
  useCustomers, useSuppliers,
  useUpdateSupplier, useDeleteSupplier, useUpdateCustomer, useDeleteCustomer,
  usePurchaseOrders, useAddBusinessPartnerRole, useBusinessPartners,
} from '@/hooks/useVendor'
import type { BusinessPartner } from '@/types'
import { AddPartyModal } from '@/components/parties/AddPartyModal'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/PhoneInput'
import type { Customer, Supplier, PurchaseOrder } from '@/types'
import { formatDate, formatCurrency, cn } from '@/lib/utils'
import { onClickableTableRow } from '@/lib/clickableTableRow'
import { vendorApi } from '@/api/vendor'
import {
  Search, Plus, Download, Users, Truck, Briefcase, Link2, HardHat,
  CheckCircle2, PauseCircle, Ban, XCircle, ChevronDown, ChevronUp,
  Filter, RefreshCw, ArrowUpDown, X, Pencil, Trash2, Trash,
  Mail, Phone, MapPin, Calendar, ClipboardList, Package, FileText,
  ArrowRight, Building2, AlertCircle, RotateCcw, ShieldAlert, AlertTriangle,
  Loader2, IndianRupee, ShoppingBag, TrendingUp, Copy,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────────────────

type MasterStatus = 'active' | 'on_hold' | 'blocked' | 'payment_blocked' | 'inactive'
type StatusFilter = 'all' | MasterStatus
type SourceType   = string   // 'all' | 'customer' | 'supplier' | 'employee' | 'partner' | 'contractor' | <custom>
type SortField    = 'name' | 'type' | 'created_at' | 'status'
type SortDir      = 'asc' | 'desc'

interface MasterRecord {
  id: string
  kind: 'customer' | 'supplier'
  name: string
  type: SourceType
  typeLabel: string
  email?: string
  phone?: string
  taxId?: string
  isActive: boolean
  masterStatus: MasterStatus
  balance?: number
  totalOrders?: number
  totalSpent?: number
  companyName?: string
  createdAt: string
  raw: Customer | Supplier
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

const GST_STATES: Record<string, string> = {
  '01': 'Jammu & Kashmir',    '02': 'Himachal Pradesh',   '03': 'Punjab',
  '04': 'Chandigarh',         '05': 'Uttarakhand',        '06': 'Haryana',
  '07': 'Delhi',              '08': 'Rajasthan',          '09': 'Uttar Pradesh',
  '10': 'Bihar',              '11': 'Sikkim',             '12': 'Arunachal Pradesh',
  '13': 'Nagaland',           '14': 'Manipur',            '15': 'Mizoram',
  '16': 'Tripura',            '17': 'Meghalaya',          '18': 'Assam',
  '19': 'West Bengal',        '20': 'Jharkhand',          '21': 'Odisha',
  '22': 'Chhattisgarh',       '23': 'Madhya Pradesh',     '24': 'Gujarat',
  '26': 'Dadra & NH and Daman & Diu', '27': 'Maharashtra', '29': 'Karnataka',
  '30': 'Goa',                '31': 'Lakshadweep',        '32': 'Kerala',
  '33': 'Tamil Nadu',         '34': 'Puducherry',         '35': 'Andaman & Nicobar',
  '36': 'Telangana',          '37': 'Andhra Pradesh',     '38': 'Ladakh',
  '97': 'Other Territory',
}

const STATUS_CFG: Record<MasterStatus, { label: string; bg: string; text: string; dot: string }> = {
  active:          { label: 'Active',        bg: 'bg-green-50',   text: 'text-green-700',  dot: 'bg-green-500'  },
  on_hold:         { label: 'On Hold',       bg: 'bg-amber-50',   text: 'text-amber-700',  dot: 'bg-amber-500'  },
  blocked:         { label: 'Blocked',       bg: 'bg-red-50',     text: 'text-red-700',    dot: 'bg-red-500'    },
  payment_blocked: { label: 'Pymt. Blocked', bg: 'bg-orange-50',  text: 'text-orange-700', dot: 'bg-orange-500' },
  inactive:        { label: 'Inactive',      bg: 'bg-gray-100',   text: 'text-gray-500',   dot: 'bg-gray-400'   },
}

const poStatusStyle: Record<string, string> = {
  draft:            'bg-gray-100 text-gray-700',
  sent:             'bg-blue-50 text-blue-700',
  partial_received: 'bg-amber-50 text-amber-700',
  received:         'bg-green-50 text-green-700',
  closed:           'bg-gray-100 text-gray-600',
  cancelled:        'bg-red-50 text-red-600',
}

const SOURCE_TABS: { value: SourceType; label: string; icon: React.ReactNode }[] = [
  { value: 'all',        label: 'All Types',   icon: <Filter    className="w-3.5 h-3.5" /> },
  { value: 'customer',   label: 'Customers',   icon: <Users     className="w-3.5 h-3.5" /> },
  { value: 'supplier',   label: 'Vendors',     icon: <Truck     className="w-3.5 h-3.5" /> },
  { value: 'employee',   label: 'Employees',   icon: <Briefcase className="w-3.5 h-3.5" /> },
  { value: 'partner',    label: 'Partners',    icon: <Link2     className="w-3.5 h-3.5" /> },
  { value: 'contractor', label: 'Contractors', icon: <HardHat   className="w-3.5 h-3.5" /> },
]

const STATUS_FILTER_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all',             label: 'All'            },
  { value: 'active',          label: 'Active'         },
  { value: 'on_hold',         label: 'On Hold'        },
  { value: 'blocked',         label: 'Blocked'        },
  { value: 'payment_blocked', label: 'Pymt. Blocked'  },
  { value: 'inactive',        label: 'Inactive'       },
]

// ── Column definitions ────────────────────────────────────────────────────────

interface ColDef {
  key: string
  label: string
  locked?: boolean      // always visible, cannot be hidden
  defaultVisible: boolean
  sortable?: SortField
}

const ALL_COL_DEFS: ColDef[] = [
  { key: 'name',        label: 'Name',          locked: true,  defaultVisible: true,  sortable: 'name'       },
  { key: 'type',        label: 'Type',           locked: false, defaultVisible: true,  sortable: 'type'       },
  { key: 'contact',     label: 'Contact',        locked: false, defaultVisible: true                          },
  { key: 'email',       label: 'Email',          locked: false, defaultVisible: false                         },
  { key: 'phone',       label: 'Phone',          locked: false, defaultVisible: false                         },
  { key: 'company',     label: 'Company',        locked: false, defaultVisible: false                         },
  { key: 'city',        label: 'City / State',   locked: false, defaultVisible: false                         },
  { key: 'taxId',       label: 'Tax ID / GST',   locked: false, defaultVisible: true                          },
  { key: 'balance',     label: 'Balance',        locked: false, defaultVisible: true                          },
  { key: 'totalOrders', label: 'Total Orders',   locked: false, defaultVisible: false                         },
  { key: 'totalSpent',  label: 'Total Spent',    locked: false, defaultVisible: false                         },
  { key: 'status',      label: 'Status',         locked: true,  defaultVisible: true,  sortable: 'status'     },
  { key: 'added',       label: 'Date Added',     locked: false, defaultVisible: true,  sortable: 'created_at' },
  { key: 'actions',     label: 'Actions',        locked: true,  defaultVisible: true                          },
]

const DEFAULT_VISIBLE_COLS = new Set(ALL_COL_DEFS.filter(c => c.defaultVisible).map(c => c.key))

// ── Advanced-filter shape ─────────────────────────────────────────────────────

interface AdvFilters {
  hasEmail:    '' | 'yes' | 'no'
  hasPhone:    '' | 'yes' | 'no'
  hasGst:      '' | 'yes' | 'no'
  cityContains: string
  balanceMin:  string
  balanceMax:  string
  ordersMin:   string
  ordersMax:   string
  spentMin:    string
  spentMax:    string
  creditLimit: '' | 'any' | 'set' | 'none'
}

const EMPTY_ADV: AdvFilters = {
  hasEmail: '', hasPhone: '', hasGst: '',
  cityContains: '', balanceMin: '', balanceMax: '',
  ordersMin: '', ordersMax: '', spentMin: '', spentMax: '',
  creditLimit: '',
}

const TYPE_LABEL: Record<string, string> = {
  customer: 'Customer', supplier: 'Vendor', employee: 'Employee',
  partner: 'Partner',   contractor: 'Contractor',
}

const TYPE_COLORS: Record<string, string> = {
  customer:   'bg-blue-50 text-blue-700 border-blue-200',
  supplier:   'bg-primary/10 text-primary border-primary/30',
  employee:   'bg-amber-50 text-amber-700 border-amber-200',
  partner:    'bg-green-50 text-green-700 border-green-200',
  contractor: 'bg-orange-50 text-orange-700 border-orange-200',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMasterStatus(raw: Customer | Supplier): MasterStatus {
  const rx = raw as unknown as Record<string, unknown>
  if (!raw.is_active) return 'inactive'
  if (rx.party_status === 'blocked') return 'blocked'
  if (rx.payment_blocked) return 'payment_blocked'
  if (rx.party_status === 'on_hold') return 'on_hold'
  return 'active'
}

function addDaysStr(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

/** Parse the __meta__ line embedded in a record's notes field by AddPartyModal. */
function parseNotesMeta(notes?: string): Record<string, string> {
  if (!notes) return {}
  const line = notes.split('\n').find(l => l.startsWith('__meta__:'))
  if (!line) return {}
  try { return JSON.parse(line.slice(9)) } catch { return {} }
}

/** Strip internal metadata lines from party notes for display. */
function cleanPartyNotes(notes?: string): string {
  if (!notes) return ''
  return notes.split('\n').filter(l => !l.startsWith('__meta__:')).join('\n').trim()
}

/** Colour palette for custom / unknown party types (cycles by index). */
const CUSTOM_TYPE_COLORS = [
  'bg-accent text-primary border-primary/30',
  'bg-teal-50 text-teal-700 border-teal-200',
  'bg-pink-50 text-pink-700 border-pink-200',
  'bg-cyan-50 text-cyan-700 border-cyan-200',
  'bg-lime-50 text-lime-700 border-lime-200',
  'bg-rose-50 text-rose-700 border-rose-200',
]
const _customTypeColorCache: Record<string, string> = {}
let _customTypeColorIdx = 0
function getCustomTypeColor(typeKey: string): string {
  if (!_customTypeColorCache[typeKey]) {
    _customTypeColorCache[typeKey] = CUSTOM_TYPE_COLORS[_customTypeColorIdx % CUSTOM_TYPE_COLORS.length]
    _customTypeColorIdx++
  }
  return _customTypeColorCache[typeKey]
}

// ── PurchaseOrdersSection (child component so usePurchaseOrders only runs for suppliers) ──

function PurchaseOrdersSection({ supplierId }: { supplierId: string }) {
  const navigate = useNavigate()
  const { data: poData, isLoading } = usePurchaseOrders({ supplier_id: supplierId, size: 50 })
  const purchaseOrders: PurchaseOrder[] = poData?.items || []

  return (
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
      {isLoading ? (
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
          {purchaseOrders.map((po) => (
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
  )
}

// ── SupplierEditModal ─────────────────────────────────────────────────────────

function SupplierEditModal({
 supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const updateMut = useUpdateSupplier()

  const [name,           setName]           = useState(supplier.name)
  const [contactName,    setContactName]    = useState(supplier.contact_name || '')
  const [email,          setEmail]          = useState(supplier.email || '')
  const [phone,          setPhone]          = useState(supplier.phone || '')
  const [street,         setStreet]         = useState(supplier.address?.street || '')
  const [city,           setCity]           = useState(supplier.address?.city || '')
  const [addrState,      setAddrState]      = useState(supplier.address?.state || '')
  const [postalCode,     setPostalCode]     = useState(supplier.address?.postal_code || '')
  const [notes,          setNotes]          = useState(supplier.notes || '')
  const [gstin,          setGstin]          = useState(supplier.gstin || '')
  const [panNumber,      setPanNumber]      = useState(supplier.pan_number || '')
  const [openingBalance, setOpeningBalance] = useState(supplier.opening_balance?.toString() || '')
  const [gstLooking,     setGstLooking]     = useState(false)
  const [gstStatus,      setGstStatus]      = useState<'idle' | 'valid' | 'invalid' | 'fetched'>(supplier.gstin ? 'valid' : 'idle')

  const handleGstinChange = (val: string) => {
    const g = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15)
    setGstin(g); setGstStatus('idle')
    if (g.length === 15) {
      if (GSTIN_RE.test(g)) {
        setGstStatus('valid')
        setPanNumber(g.slice(2, 12))
        const stateName = GST_STATES[g.slice(0, 2)] || ''
        if (stateName && !addrState) setAddrState(stateName)
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
          if (addr.state) setAddrState(addr.state)
          if (addr.pincode && !postalCode) setPostalCode(addr.pincode)
        }
        setGstStatus('fetched')
      }
    } catch { /* noop */ } finally { setGstLooking(false) }
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const payload: Record<string, unknown> = {
      name,
      contact_name: contactName || undefined,
      email: email || undefined,
      phone: phone || undefined,
      notes: notes || undefined,
      address: (street || city || addrState || postalCode)
        ? { street, city, state: addrState, postal_code: postalCode, country: 'India' }
        : undefined,
      gstin: gstin || undefined,
      pan_number: panNumber || undefined,
      opening_balance: openingBalance ? parseFloat(openingBalance) : 0,
    }
    try {
      await updateMut.mutateAsync({ id: supplier.id, data: payload })
      onClose()
    } catch { /* toast handled by hook */ }
  }, [name, contactName, email, phone, street, city, addrState, postalCode, notes, gstin, panNumber, openingBalance, supplier.id, updateMut, onClose])

  return (
    <div data-kiterp-modal className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-semibold">Edit Supplier / Vendor</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* GSTIN */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> GSTIN <span className="text-gray-400 font-normal text-xs">(optional)</span></Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input value={gstin} onChange={e => handleGstinChange(e.target.value)}
                  placeholder="e.g. 36AAGCI8158Q1ZP" maxLength={15}
                  className={`font-mono uppercase ${gstStatus === 'fetched' ? 'border-green-400' : gstStatus === 'invalid' ? 'border-red-400' : ''}`} />
                {gstStatus === 'fetched' && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />}
                {gstStatus === 'invalid' && <AlertCircle  className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />}
              </div>
              {(gstStatus === 'valid' || gstStatus === 'fetched') && (
                <Button type="button" variant="outline" size="sm" onClick={fetchGstDetails} disabled={gstLooking} className="whitespace-nowrap">
                  {gstLooking ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null} Fetch Details
                </Button>
              )}
            </div>
            {gstStatus === 'fetched' && <p className="text-xs text-green-600">Details fetched from GST portal</p>}
          </div>
          {/* Name */}
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Company / trade name" required />
          </div>
          {/* Contact + Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Contact Person</Label>
              <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Full name" />
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
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="supplier@example.com" className="pl-10" />
            </div>
          </div>
          {/* PAN + Opening Balance */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>PAN</Label>
              <Input value={panNumber} onChange={e => setPanNumber(e.target.value.toUpperCase().slice(0, 10))}
                placeholder="ABCDE1234F" className="font-mono uppercase" maxLength={10} />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><IndianRupee className="w-3 h-3" /> Opening Balance</Label>
              <Input type="number" step="0.01" value={openingBalance}
                onChange={e => setOpeningBalance(e.target.value)} placeholder="0.00" />
              <p className="text-xs text-gray-400">+ve = payable to supplier</p>
            </div>
          </div>
          {/* Address */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Address</Label>
            <Input value={street} onChange={e => setStreet(e.target.value)} placeholder="Street address" />
            <div className="grid grid-cols-3 gap-2 mt-2">
              <Input value={city}       onChange={e => setCity(e.target.value)}      placeholder="City"     />
              <Input value={addrState}  onChange={e => setAddrState(e.target.value)} placeholder="State"    />
              <Input value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="PIN code" />
            </div>
          </div>
          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <textarea className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none"
              value={notes} onChange={e => setNotes(e.target.value)} placeholder="Payment terms, lead times, etc." />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="cancel" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={updateMut.isPending || !name.trim()}>
              {updateMut.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── CustomerEditModal ─────────────────────────────────────────────────────────

function CustomerEditModal({
 customer, onClose }: { customer: Customer; onClose: () => void }) {
  const updateMut = useUpdateCustomer()
  const ba = customer.billing_address as Record<string, string> | undefined

  const [fullName,       setFullName]       = useState(customer.full_name)
  const [companyName,    setCompanyName]    = useState((customer as unknown as Record<string, string>).company_name || '')
  const [email,          setEmail]          = useState(customer.email || '')
  const [phone,          setPhone]          = useState(customer.phone || '')
  const [gstin,          setGstin]          = useState(customer.gstin || '')
  const [panNumber,      setPanNumber]      = useState(customer.pan_number || '')
  const [openingBalance, setOpeningBalance] = useState(customer.opening_balance?.toString() || '')
  const [street,         setStreet]         = useState(ba?.street || '')
  const [city,           setCity]           = useState(ba?.city || '')
  const [addrState,      setAddrState]      = useState(ba?.state || '')
  const [pincode,        setPincode]        = useState(ba?.pincode || ba?.postal_code || '')

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const payload: Record<string, unknown> = {
      full_name: fullName.trim(),
      company_name: companyName || undefined,
      email: email || undefined,
      phone: phone || undefined,
      gstin: gstin || undefined,
      pan_number: panNumber || undefined,
      opening_balance: openingBalance ? parseFloat(openingBalance) : 0,
      billing_address: (street || city || addrState || pincode)
        ? { street, city, state: addrState, pincode }
        : undefined,
    }
    try {
      await updateMut.mutateAsync({ id: customer.id, data: payload })
      onClose()
    } catch { /* toast handled by hook */ }
  }, [fullName, companyName, email, phone, gstin, panNumber, openingBalance, street, city, addrState, pincode, customer.id, updateMut, onClose])

  return (
    <div data-kiterp-modal className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-semibold">Edit Customer</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Name + Company */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Customer name" required />
            </div>
            <div className="space-y-1.5">
              <Label>Company / Trade Name</Label>
              <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Business name" />
            </div>
          </div>
          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="customer@email.com" className="pl-10" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <PhoneInput value={phone} onChange={setPhone} defaultCountryIso="IN" />
            </div>
          </div>
          {/* GSTIN + PAN */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>GSTIN</Label>
              <Input value={gstin} onChange={e => setGstin(e.target.value.toUpperCase().slice(0, 15))}
                placeholder="22AAAAA0000A1Z5" className="font-mono uppercase" maxLength={15} />
            </div>
            <div className="space-y-1.5">
              <Label>PAN</Label>
              <Input value={panNumber} onChange={e => setPanNumber(e.target.value.toUpperCase().slice(0, 10))}
                placeholder="ABCDE1234F" className="font-mono uppercase" maxLength={10} />
            </div>
          </div>
          {/* Opening Balance */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1"><IndianRupee className="w-3 h-3" /> Opening Balance</Label>
            <Input type="number" step="0.01" value={openingBalance}
              onChange={e => setOpeningBalance(e.target.value)} placeholder="0.00" />
            <p className="text-xs text-gray-400">+ve = receivable (Dr) · -ve = advance received (Cr)</p>
          </div>
          {/* Billing Address */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Billing Address</Label>
            <Input value={street} onChange={e => setStreet(e.target.value)} placeholder="Street address" />
            <div className="grid grid-cols-3 gap-2 mt-2">
              <Input value={city}      onChange={e => setCity(e.target.value)}      placeholder="City"    />
              <Input value={addrState} onChange={e => setAddrState(e.target.value)} placeholder="State"   />
              <Input value={pincode}   onChange={e => setPincode(e.target.value)}   placeholder="Pincode" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="cancel" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={updateMut.isPending || !fullName.trim()}>
              {updateMut.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── MasterDataDrawer ──────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  customer: 'Customer',
  vendor: 'Vendor',
  supplier: 'Vendor',
  employee: 'Employee',
  partner: 'Partner',
  contractor: 'Contractor',
}
const ROLE_COLORS: Record<string, string> = {
  customer: 'bg-blue-100 text-blue-700 border-blue-200',
  vendor: 'bg-purple-100 text-purple-700 border-purple-200',
  supplier: 'bg-purple-100 text-purple-700 border-purple-200',
  employee: 'bg-green-100 text-green-700 border-green-200',
  partner: 'bg-amber-100 text-amber-700 border-amber-200',
  contractor: 'bg-orange-100 text-orange-700 border-orange-200',
}
const ALL_BP_ROLES = ['customer', 'vendor', 'employee', 'partner', 'contractor']

function MasterDataDrawer({
 record, onClose, onEdit }: {
  record: MasterRecord
  onClose: () => void
  onEdit: () => void
}) {
  const updateSupplier = useUpdateSupplier()
  const deleteSupplier = useDeleteSupplier()
  const updateCustomer = useUpdateCustomer()
  const addRoleMut = useAddBusinessPartnerRole()

  const supplier = record.kind === 'supplier' ? record.raw as Supplier : null
  const customer = record.kind === 'customer' ? record.raw as Customer : null
  const sx       = record.raw as unknown as Record<string, unknown>
  const stCfg    = STATUS_CFG[record.masterStatus] as { label: string; bg: string; text: string; dot: string }

  // Business Partner link — look up by this record's id as customer_id or supplier_id
  const bpRecordId = record.id
  const { data: bpData } = useBusinessPartners({ size: 200 })
  const linkedBP: BusinessPartner | undefined = (bpData?.items ?? []).find((bp: BusinessPartner) =>
    bp.roles.some(r =>
      r.customer_id === bpRecordId || r.supplier_id === bpRecordId
    )
  )
  const existingRoles = linkedBP?.roles.map(r => r.role) ?? [record.kind === 'customer' ? 'customer' : (supplier?.party_type ?? 'vendor')]
  const [extendingTo, setExtendingTo] = useState<string | null>(null)

  const handleExtendRole = async (role: string) => {
    if (!linkedBP) return
    setExtendingTo(role)
    try {
      await addRoleMut.mutateAsync({ id: linkedBP.id, role })
    } finally {
      setExtendingTo(null)
    }
  }

  const [showHoldForm,    setShowHoldForm]    = useState(false)
  const [holdUntilDate,   setHoldUntilDate]   = useState((sx.hold_until as string) || '')
  const [confirmSoftDel,  setConfirmSoftDel]  = useState(false)
  const [confirmHardDel,  setConfirmHardDel]  = useState(false)
  const [hardDelInput,    setHardDelInput]    = useState('')
  const [statusBusy,      setStatusBusy]      = useState(false)

  const applyStatus = async (patch: Record<string, unknown>) => {
    setStatusBusy(true)
    try {
      if (record.kind === 'supplier') {
        await updateSupplier.mutateAsync({ id: record.id, data: patch })
      } else {
        await updateCustomer.mutateAsync({ id: record.id, data: patch })
      }
      onClose()
    } catch { /* toast handled by hook */ } finally { setStatusBusy(false) }
  }

  // Address helpers
  const sAddr  = supplier?.address
  const cAddr  = customer?.billing_address as Record<string, string> | undefined
  const hasAddr = (sAddr && (sAddr.street || sAddr.city || sAddr.state || sAddr.postal_code)) ||
                  (cAddr && (cAddr.street || cAddr.city || cAddr.state || cAddr.pincode))
  const addrLine = sAddr
    ? [sAddr.street, sAddr.city, sAddr.state, sAddr.postal_code].filter(Boolean).join(', ')
    : cAddr
    ? [cAddr.street, cAddr.city, cAddr.state, cAddr.pincode].filter(Boolean).join(', ')
    : ''

  const bal = (supplier?.opening_balance ?? customer?.opening_balance) as number | undefined
  const hasBusinessDetails = !!(record.taxId || (supplier?.pan_number) || (customer?.pan_number) ||
    (customer?.cin) || record.companyName || (bal !== undefined && bal !== 0))
  const customerNotes = customer ? cleanPartyNotes(customer.notes) : ''
  const supplierNotes = supplier ? cleanPartyNotes(supplier.notes) : ''
  const hasBankDetails = !!(
    customer?.bank_name || customer?.account_number || customer?.account_holder_name || customer?.ifsc_code ||
    supplier?.bank_name || supplier?.account_number || supplier?.account_holder_name || supplier?.ifsc_code
  )

  return (
    <div data-kiterp-modal className="fixed inset-0 z-[100] flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl bg-card border-l border-border text-foreground shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-3">
            {(() => {
              const storedAvatar = localStorage.getItem(`md_avatar_${record.id}`)
              return storedAvatar
                ? <img src={storedAvatar} alt={record.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                : <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                    record.kind === 'customer' ? 'bg-blue-100 text-blue-700' : 'bg-primary/15 text-primary'
                  }`}>{record.name.trim()[0]?.toUpperCase() ?? '?'}</div>
            })()}
            <div>
              <h2 className="text-base font-semibold text-gray-900 leading-tight">{record.name}</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                  TYPE_COLORS[record.type] ?? 'bg-gray-50 text-gray-600 border-gray-200'
                }`}>{record.typeLabel}</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${stCfg.bg} ${stCfg.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${stCfg.dot}`} />
                  {stCfg.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 min-w-0 max-w-[280px]">
                <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400 shrink-0">Master ID</span>
                <code className="text-[11px] font-mono text-gray-600 truncate" title={record.id}>{record.id}</code>
                <button
                  type="button"
                  aria-label="Copy master ID"
                  onClick={() => {
                    navigator.clipboard.writeText(record.id)
                    toast.success('Master ID copied')
                  }}
                  className="p-1 rounded hover:bg-gray-100 shrink-0"
                >
                  <Copy className="w-3 h-3 text-gray-400" />
                </button>
              </div>
              {/* Roles row */}
              <div className="flex flex-wrap items-center gap-1 mt-1.5">
                {existingRoles.map(r => (
                  <span key={r} className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${ROLE_COLORS[r] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {ROLE_LABELS[r] ?? r}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onEdit}>
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Button>
            <button type="button" aria-label="Close" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">

          {/* ── Customer stats strip ── */}
          {customer && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <ShoppingBag className="w-4 h-4 text-primary/60 mx-auto mb-1" />
                <p className="text-2xl font-bold text-gray-900">{customer.total_orders}</p>
                <p className="text-xs text-gray-500 mt-0.5">Orders</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <TrendingUp className="w-4 h-4 text-green-400 mx-auto mb-1" />
                <p className="text-sm font-bold text-gray-900">{formatCurrency(customer.total_spent)}</p>
                <p className="text-xs text-gray-500 mt-0.5">Total Spent</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <IndianRupee className="w-4 h-4 text-orange-400 mx-auto mb-1" />
                {(customer.opening_balance ?? 0) !== 0 ? (
                  <>
                    <p className={`text-sm font-bold ${(customer.opening_balance ?? 0) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {formatCurrency(Math.abs(customer.opening_balance ?? 0))}
                    </p>
                    <p className="text-xs text-gray-500">{(customer.opening_balance ?? 0) > 0 ? 'Dr (Receivable)' : 'Cr (Advance)'}</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 pt-1">—</p>
                )}
              </div>
            </div>
          )}

          {/* ── Contact Information ── */}
          <div>
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Contact Information</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              {supplier?.contact_name && (
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
              {record.email && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white border flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <a href={`mailto:${record.email}`} className="text-sm font-medium text-blue-600 hover:underline">{record.email}</a>
                  </div>
                </div>
              )}
              {record.phone && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white border flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <a href={`tel:${record.phone}`} className="text-sm font-medium text-blue-600 hover:underline">{record.phone}</a>
                  </div>
                </div>
              )}
              {hasAddr && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white border flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{customer ? 'Billing Address' : 'Address'}</p>
                    <p className="text-sm text-gray-900">{addrLine}</p>
                  </div>
                </div>
              )}
              {!record.email && !record.phone && !hasAddr && !supplier?.contact_name && (
                <p className="text-sm text-gray-400 italic">No contact details added yet.</p>
              )}
            </div>
          </div>

          {/* ── Business / GST Details ── */}
          {hasBusinessDetails && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Business Details</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                {record.companyName && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Company / Trade Name</span>
                    <span className="text-sm font-medium text-gray-900">{record.companyName}</span>
                  </div>
                )}
                {record.taxId && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">GSTIN</span>
                    <span className="text-sm font-mono font-semibold text-blue-700 tracking-wider">{record.taxId}</span>
                  </div>
                )}
                {(supplier?.pan_number || customer?.pan_number) && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">PAN</span>
                    <span className="text-sm font-mono font-semibold tracking-wider">{supplier?.pan_number || customer?.pan_number}</span>
                  </div>
                )}
                {customer?.cin && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">CIN / LLPIN</span>
                    <span className="text-sm font-mono font-semibold tracking-wider">{customer.cin}</span>
                  </div>
                )}
                {bal !== undefined && bal !== 0 && (
                  <div className="flex justify-between items-center border-t pt-3 mt-1">
                    <span className="text-xs text-gray-500">Opening Balance</span>
                    <span className={`text-sm font-bold ${bal > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {formatCurrency(Math.abs(bal))} {supplier ? (bal > 0 ? 'Payable' : 'Receivable') : (bal > 0 ? 'Dr' : 'Cr')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Bank Details ── */}
          {hasBankDetails && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Bank Details</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                {(customer?.bank_name || supplier?.bank_name) && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Bank Name</span>
                    <span className="text-sm font-medium text-gray-900">{customer?.bank_name || supplier?.bank_name}</span>
                  </div>
                )}
                {(customer?.account_holder_name || supplier?.account_holder_name) && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Account Holder</span>
                    <span className="text-sm font-medium text-gray-900">{customer?.account_holder_name || supplier?.account_holder_name}</span>
                  </div>
                )}
                {(customer?.account_number || supplier?.account_number) && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Account Number</span>
                    <span className="text-sm font-mono font-medium text-gray-900">{customer?.account_number || supplier?.account_number}</span>
                  </div>
                )}
                {(customer?.ifsc_code || supplier?.ifsc_code) && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">IFSC</span>
                    <span className="text-sm font-mono font-semibold tracking-wider">{customer?.ifsc_code || supplier?.ifsc_code}</span>
                  </div>
                )}
                {(customer?.account_type || supplier?.account_type) && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Account Type</span>
                    <span className="text-sm font-medium text-gray-900 capitalize">{customer?.account_type || supplier?.account_type}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Notes ── */}
          {(customerNotes || supplierNotes) && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Notes</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{customerNotes || supplierNotes}</p>
              </div>
            </div>
          )}

          {/* ── Timeline ── */}
          <div>
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Timeline</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Added</p>
                    <p className="text-sm font-medium">{formatDate(record.createdAt)}</p>
                  </div>
                </div>
                {supplier?.updated_at && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Last Updated</p>
                      <p className="text-sm font-medium">{formatDate(supplier.updated_at)}</p>
                    </div>
                  </div>
                )}
                {customer?.updated_at && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Last Updated</p>
                      <p className="text-sm font-medium">{formatDate(customer.updated_at)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Extend To (Business Partner role assignment) ── */}
          {linkedBP && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" /> Extend To (Add Role)
              </h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-3">
                  This party is linked to Business Partner <code className="font-mono text-gray-600">{linkedBP.id.slice(0, 8)}…</code>.
                  Add another role to reuse the same master record.
                </p>
                <div className="flex flex-wrap gap-2">
                  {ALL_BP_ROLES.filter(r => !existingRoles.includes(r)).map(role => (
                    <button
                      key={role}
                      type="button"
                      disabled={extendingTo !== null}
                      onClick={() => handleExtendRole(role)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-primary/40 text-primary text-xs font-medium hover:bg-primary/10 hover:border-primary transition-all disabled:opacity-50"
                    >
                      {extendingTo === role
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Plus className="w-3 h-3" />}
                      {ROLE_LABELS[role] ?? role}
                    </button>
                  ))}
                  {ALL_BP_ROLES.filter(r => !existingRoles.includes(r)).length === 0 && (
                    <p className="text-xs text-gray-400">All roles already assigned.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Status & Access Controls ── */}
          <div>
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" /> Status &amp; Access Controls
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              {/* Current status */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Current Status</span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${stCfg.bg} ${stCfg.text}`}>
                  <span className={`w-2 h-2 rounded-full ${stCfg.dot}`} />
                  {stCfg.label}
                </span>
              </div>

              {/* On hold notice */}
              {record.masterStatus === 'on_hold' && sx.hold_until != null && String(sx.hold_until) !== '' && (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <PauseCircle className="w-3.5 h-3.5 shrink-0" />
                  On hold until {new Date(sx.hold_until as string).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              )}

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {record.masterStatus !== 'active' && (
                  <button disabled={statusBusy}
                    onClick={() => applyStatus({ party_status: 'active', payment_blocked: false, hold_until: null, is_active: true })}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-green-300 bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors disabled:opacity-50">
                    <RotateCcw className="w-3.5 h-3.5" /> Restore Active
                  </button>
                )}

                {/* Supplier-only controls */}
                {record.kind === 'supplier' && (
                  <>
                    <button disabled={statusBusy} onClick={() => setShowHoldForm(v => !v)}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 ${
                        showHoldForm
                          ? 'border-amber-400 bg-amber-100 text-amber-800'
                          : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                      }`}>
                      <PauseCircle className="w-3.5 h-3.5" />
                      {record.masterStatus === 'on_hold' ? 'Adjust Hold' : 'Set On Hold'}
                    </button>

                    <button disabled={statusBusy}
                      onClick={() => applyStatus({ payment_blocked: !sx.payment_blocked })}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 ${
                        sx.payment_blocked
                          ? 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}>
                      <Ban className="w-3.5 h-3.5" />
                      {sx.payment_blocked ? 'Unblock Payment' : 'Block Payment'}
                    </button>

                    <button disabled={statusBusy || record.masterStatus === 'blocked'}
                      onClick={() => applyStatus({ party_status: 'blocked' })}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-300 bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 transition-colors disabled:opacity-50">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      {record.masterStatus === 'blocked' ? 'Blocked' : 'Block Record'}
                    </button>
                  </>
                )}
              </div>

              {/* On-hold form (supplier only) */}
              {record.kind === 'supplier' && showHoldForm && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-amber-800">Hold Until</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[7, 14, 30, 60, 90].map(n => (
                      <button key={n} type="button" onClick={() => setHoldUntilDate(addDaysStr(n))}
                        className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors">
                        +{n}d
                      </button>
                    ))}
                    <input type="date" value={holdUntilDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => setHoldUntilDate(e.target.value)}
                      className="flex-1 text-xs border border-amber-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 min-w-[130px]" />
                  </div>
                  <Button size="sm" disabled={statusBusy}
                    onClick={() => { applyStatus({ party_status: 'on_hold', hold_until: holdUntilDate || null }); setShowHoldForm(false) }}
                    className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white">
                    {statusBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm Hold'}
                  </Button>
                </div>
              )}

              {/* Danger zone */}
              <div className={`flex gap-2 pt-2 border-t ${record.kind === 'customer' ? 'justify-end' : ''}`}>
                <button onClick={() => setConfirmSoftDel(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 bg-white text-red-600 text-xs font-medium hover:bg-red-50 transition-colors flex-1 justify-center">
                  <Trash2 className="w-3.5 h-3.5" /> Deactivate
                </button>
                {record.kind === 'supplier' && (
                  <button onClick={() => setConfirmHardDel(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-600 bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors flex-1 justify-center">
                    <Trash className="w-3.5 h-3.5" /> Delete Permanently
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Purchase Orders (supplier only) ── */}
          {record.kind === 'supplier' && (
            <PurchaseOrdersSection supplierId={record.id} />
          )}

        </div>
      </div>

      {/* Soft Delete confirmation */}
      {confirmSoftDel && (
        <div data-kiterp-modal className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 overflow-y-auto" onClick={() => setConfirmSoftDel(false)}>
          <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Deactivate Record</h3>
                <p className="text-xs text-gray-500">Marks inactive — can be restored later.</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-5">
              <strong>{record.name}</strong> will be deactivated and hidden from active operations.
            </p>
            <div className="flex gap-3">
              <Button variant="cancel" className="flex-1" onClick={() => setConfirmSoftDel(false)}>Cancel</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" disabled={statusBusy}
                onClick={() => { applyStatus({ is_active: false }); setConfirmSoftDel(false) }}>
                {statusBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Deactivate'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Hard Delete confirmation (suppliers only) */}
      {confirmHardDel && (
        <div data-kiterp-modal className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 overflow-y-auto"
          onClick={() => { setConfirmHardDel(false); setHardDelInput('') }}>
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
              Type <strong>{record.name}</strong> to confirm permanent deletion.
            </p>
            <input
              className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-400"
              placeholder={record.name} value={hardDelInput} onChange={e => setHardDelInput(e.target.value)} />
            <div className="flex gap-3">
              <Button variant="cancel" className="flex-1" onClick={() => { setConfirmHardDel(false); setHardDelInput('') }}>Cancel</Button>
              <Button className="flex-1 bg-red-700 hover:bg-red-800 text-white"
                disabled={hardDelInput !== record.name || deleteSupplier.isPending}
                onClick={() => { deleteSupplier.mutate(record.id); onClose() }}>
                {deleteSupplier.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete Forever'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── MasterDataReport (main page) ──────────────────────────────────────────────

function FilterChip({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  icon?: React.ReactNode
  label: string
  count?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
        active
          ? 'bg-primary border-primary text-primary-foreground shadow-sm kit-solid-green-btn'
          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50',
      )}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={cn(
            'inline-flex items-center justify-center min-w-[1.125rem] h-[1.125rem] px-1 rounded-full text-[10px] font-bold leading-none',
            active ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-600',
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

function StatusToggleSwitch({
  active,
  busy,
  onClick,
}: {
  active: boolean
  busy?: boolean
  onClick: (e: MouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      disabled={busy}
      onClick={onClick}
      title={active ? 'Active — click to deactivate' : 'Inactive — click to activate'}
      aria-label={active ? 'Deactivate record' : 'Activate record'}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        active ? 'bg-primary hover:bg-primary/90' : 'bg-muted hover:bg-muted/80',
        busy && 'opacity-60 cursor-wait',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out',
          active ? 'translate-x-5' : 'translate-x-0.5',
          busy && 'animate-pulse',
        )}
      />
    </button>
  )
}

export default function MasterDataReport() {
  // Filters / sort
  const [search,         setSearch]        = useState('')
  const [selectedTypes,  setSelectedTypes] = useState<Set<SourceType>>(new Set())
  const [statusTab,      setStatusTab]     = useState<StatusFilter>('all')
  const [sortField,      setSortField]     = useState<SortField>('created_at')
  const [sortDir,        setSortDir]       = useState<SortDir>('desc')
  const [selected,       setSelected]      = useState<Set<string>>(new Set())
  const [page,           setPage]          = useState(1)
  const PAGE_SIZE = 20

  // Column chooser
  const [visibleCols,    setVisibleCols]   = useState<Set<string>>(DEFAULT_VISIBLE_COLS)
  const [showColPicker,  setShowColPicker] = useState(false)

  // Column-level inline filters
  const [colFilters,     setColFilters]    = useState<Record<string, string>>({})
  const [showColFilters, setShowColFilters]= useState(false)
  const colFilterActive = Object.values(colFilters).some(v => v.trim() !== '')
  const setColFilter = (key: string, val: string) => {
    setColFilters(prev => ({ ...prev, [key]: val }))
    setPage(1)
  }

  // Advanced filters
  const [advFilters,     setAdvFilters]    = useState<AdvFilters>(EMPTY_ADV)
  const [showAdvFilters, setShowAdvFilters]= useState(false)

  const setAdv = (patch: Partial<AdvFilters>) => { setAdvFilters(prev => ({ ...prev, ...patch })); setPage(1) }
  const advActive = Object.entries(advFilters).some(([, v]) => v !== '' && v !== 'any')

  // Close column picker on outside click
  const colPickerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showColPicker) return
    const handler = (e: MouseEvent) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) setShowColPicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showColPicker])

  // Modal / drawer state
  const [showCreate,    setShowCreate]    = useState(false)
  const [viewingRecord, setViewingRecord] = useState<MasterRecord | null>(null)
  const [editingRecord, setEditingRecord] = useState<MasterRecord | null>(null)
  const [statusToggleTarget, setStatusToggleTarget] = useState<{ record: MasterRecord; nextActive: boolean } | null>(null)
  const [statusToggleBusy, setStatusToggleBusy] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MasterRecord | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  useEscapeToClose(() => setStatusToggleTarget(null), !!statusToggleTarget && !statusToggleBusy)
  useEscapeToClose(() => setDeleteTarget(null), !!deleteTarget && !deleteBusy)

  // Data — fetch all records (no pagination limit) so client-side filtering/sorting works on the full set
  const { data: custData, isLoading: custLoading } = useCustomers({ size: 10000 })
  const { data: suppData, isLoading: suppLoading } = useSuppliers({ size: 10000 })
  const updateCustomer = useUpdateCustomer()
  const updateSupplier = useUpdateSupplier()
  const deleteCustomer = useDeleteCustomer()
  const deleteSupplier = useDeleteSupplier()
  const isLoading = custLoading || suppLoading

  // Normalise both datasets into MasterRecord[]
  const allRecords = useMemo<MasterRecord[]>(() => {
    const out: MasterRecord[] = []

    const customers: Customer[] = Array.isArray(custData)
      ? custData
      : (custData as { items?: Customer[] } | undefined)?.items ?? []

    const suppliers: Supplier[] = Array.isArray(suppData)
      ? suppData
      : (suppData as { items?: Supplier[] } | undefined)?.items ?? []

    customers.forEach(c => out.push({
      id: c.id, kind: 'customer', name: c.full_name,
      type: 'customer', typeLabel: 'Customer',
      email: c.email, phone: c.phone,
      taxId: c.gstin || undefined,
      isActive: c.is_active,
      masterStatus: getMasterStatus(c),
      balance: c.opening_balance,
      totalOrders: c.total_orders,
      totalSpent: c.total_spent,
      companyName: (c as unknown as Record<string, string>).company_name || undefined,
      createdAt: c.created_at, raw: c,
    }))

    suppliers.forEach(s => {
      const meta = parseNotesMeta(s.notes)
      // custom_type_label is set by AddPartyModal when a non-built-in party type is chosen
      const customLabel = meta.custom_type_label
      const typeKey     = customLabel ? customLabel.toLowerCase().replace(/\s+/g, '_') : s.party_type
      const typeLabel   = customLabel ?? (TYPE_LABEL[s.party_type] ?? s.party_type)
      out.push({
        id: s.id, kind: 'supplier', name: s.name,
        type: typeKey,
        typeLabel,
        email: s.email, phone: s.phone,
        taxId: s.gstin || undefined,
        isActive: s.is_active,
        masterStatus: getMasterStatus(s),
        balance: s.opening_balance,
        companyName: (s as unknown as Record<string, string>).company_name || undefined,
        createdAt: s.created_at, raw: s,
      })
    })

    return out
  }, [custData, suppData])

  // Build dynamic type tabs — static built-ins + any custom types found in records
  const sourceTabs = useMemo(() => {
    const base: { value: SourceType; label: string; icon: React.ReactNode }[] = [
      { value: 'all',        label: 'All Types',   icon: <Filter    className="w-3.5 h-3.5" /> },
      { value: 'customer',   label: 'Customers',   icon: <Users     className="w-3.5 h-3.5" /> },
      { value: 'supplier',   label: 'Vendors',     icon: <Truck     className="w-3.5 h-3.5" /> },
      { value: 'employee',   label: 'Employees',   icon: <Briefcase className="w-3.5 h-3.5" /> },
      { value: 'partner',    label: 'Partners',    icon: <Link2     className="w-3.5 h-3.5" /> },
      { value: 'contractor', label: 'Contractors', icon: <HardHat   className="w-3.5 h-3.5" /> },
    ]
    const knownTypes = new Set(base.map(t => t.value))
    // Collect unique custom types from actual records
    allRecords.forEach(r => {
      if (!knownTypes.has(r.type)) {
        knownTypes.add(r.type)
        base.push({
          value: r.type,
          label: r.typeLabel,
          icon: <Users className="w-3.5 h-3.5" />,
        })
      }
    })
    return base
  }, [allRecords])

  // Toggle a type in/out of selectedTypes
  const toggleType = useCallback((type: SourceType) => {
    setSelectedTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
    setPage(1)
  }, [])

  // Filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const af = advFilters
    return allRecords.filter(r => {
      if (selectedTypes.size > 0 && !selectedTypes.has(r.type)) return false
      if (statusTab !== 'all' && r.masterStatus !== statusTab) return false
      if (q && !r.name.toLowerCase().includes(q) &&
               !(r.email?.toLowerCase().includes(q)) &&
               !(r.phone?.includes(q)) &&
               !(r.taxId?.toLowerCase().includes(q)) &&
               !(r.companyName?.toLowerCase().includes(q)) &&
               !r.typeLabel.toLowerCase().includes(q)) return false
      // Advanced filters
      if (af.hasEmail === 'yes' && !r.email) return false
      if (af.hasEmail === 'no'  &&  r.email) return false
      if (af.hasPhone === 'yes' && !r.phone) return false
      if (af.hasPhone === 'no'  &&  r.phone) return false
      if (af.hasGst === 'yes'   && !r.taxId) return false
      if (af.hasGst === 'no'    &&  r.taxId) return false
      if (af.cityContains) {
        const rawCity = (((r.raw as unknown) as Record<string, unknown>).city as string ?? '').toLowerCase()
        const rawState = (((r.raw as unknown) as Record<string, unknown>).state as string ?? '').toLowerCase()
        if (!rawCity.includes(af.cityContains.toLowerCase()) && !rawState.includes(af.cityContains.toLowerCase())) return false
      }
      const bal = r.balance ?? 0
      if (af.balanceMin !== '' && bal < parseFloat(af.balanceMin)) return false
      if (af.balanceMax !== '' && bal > parseFloat(af.balanceMax)) return false
      if (af.ordersMin !== '' && (r.totalOrders ?? 0) < parseInt(af.ordersMin)) return false
      if (af.ordersMax !== '' && (r.totalOrders ?? 0) > parseInt(af.ordersMax)) return false
      if (af.spentMin !== '' && (r.totalSpent ?? 0) < parseFloat(af.spentMin)) return false
      if (af.spentMax !== '' && (r.totalSpent ?? 0) > parseFloat(af.spentMax)) return false
      if (af.creditLimit === 'set') {
        const cl = ((r.raw as unknown) as Record<string, unknown>).credit_limit as number | null
        if (!cl || cl === 0) return false
      }
      if (af.creditLimit === 'none') {
        const cl = ((r.raw as unknown) as Record<string, unknown>).credit_limit as number | null
        if (cl && cl > 0) return false
      }
      // Column-level inline filters
      const cf = colFilters
      const match = (val: string | undefined, key: string) => {
        const f = cf[key]?.trim().toLowerCase()
        if (!f) return true
        return (val ?? '').toLowerCase().includes(f)
      }
      if (!match(r.name, 'name'))                          return false
      if (!match(r.typeLabel, 'type'))                     return false
      if (cf.contact?.trim() && !((r.email ?? '') + ' ' + (r.phone ?? '')).toLowerCase().includes(cf.contact.trim().toLowerCase())) return false
      if (!match(r.email, 'email'))                        return false
      if (!match(r.phone, 'phone'))                        return false
      if (!match(r.companyName, 'company'))                return false
      if (!match(r.taxId, 'taxId'))                        return false
      const rawRec = r.raw as unknown as Record<string, unknown>
      if (cf.city?.trim()) {
        const cityState = `${rawRec.city ?? ''} ${rawRec.state ?? ''}`.toLowerCase()
        if (!cityState.includes(cf.city.trim().toLowerCase())) return false
      }
      return true
    })
  }, [allRecords, selectedTypes, statusTab, search, advFilters, colFilters])

  // Sort
  const sorted = useMemo(() => {
    const STATUS_ORDER: Record<MasterStatus, number> = { active: 0, on_hold: 1, payment_blocked: 2, blocked: 3, inactive: 4 }
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortField === 'name')         cmp = a.name.localeCompare(b.name)
      else if (sortField === 'type')    cmp = a.type.localeCompare(b.type)
      else if (sortField === 'status')  cmp = STATUS_ORDER[a.masterStatus] - STATUS_ORDER[b.masterStatus]
      else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortField, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const pageRows   = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Selection
  const allSelected  = pageRows.length > 0 && pageRows.every(r => selected.has(r.id))
  const someSelected = pageRows.some(r => selected.has(r.id))

  const toggleAll = () => {
    if (allSelected) setSelected(prev => { const n = new Set(prev); pageRows.forEach(r => n.delete(r.id)); return n })
    else             setSelected(prev => { const n = new Set(prev); pageRows.forEach(r => n.add(r.id));    return n })
  }
  const toggleRow = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  // Sort header click
  const clickSort = (f: SortField) => {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(f); setSortDir('asc') }
  }

  const SortIcon = useCallback(({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />
    return sortDir === 'asc'
      ? <ChevronUp   className="w-3 h-3 text-primary" />
      : <ChevronDown className="w-3 h-3 text-primary" />
  }, [sortField, sortDir])

  // CSV export
  const exportCsv = () => {
    const rows = selected.size > 0 ? sorted.filter(r => selected.has(r.id)) : sorted
    const headers = ['Name', 'Type', 'Email', 'Phone', 'Tax ID', 'Status', 'Balance', 'Created']
    const lines = rows.map(r => [
      r.name, r.typeLabel, r.email ?? '', r.phone ?? '', r.taxId ?? '',
      r.masterStatus, r.balance?.toString() ?? '', formatDate(r.createdAt),
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    const csv = [headers.join(','), ...lines].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `master-data-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const countFor = (src: SourceType) =>
    src === 'all' ? allRecords.length : allRecords.filter(r => r.type === src).length

  const openDrawer = (r: MasterRecord) => setViewingRecord(r)
  const openEdit   = (r: MasterRecord) => { setViewingRecord(null); setEditingRecord(r) }

  const handleToggleStatus = (r: MasterRecord, e: MouseEvent) => {
    e.stopPropagation()
    setStatusToggleTarget({ record: r, nextActive: !r.isActive })
  }

  const confirmStatusToggle = async () => {
    if (!statusToggleTarget) return
    const { record: r, nextActive } = statusToggleTarget
    setStatusToggleBusy(true)
    setTogglingId(r.id)
    try {
      if (r.kind === 'supplier') {
        await updateSupplier.mutateAsync({ id: r.id, data: { is_active: nextActive } })
      } else {
        await updateCustomer.mutateAsync({ id: r.id, data: { is_active: nextActive } })
      }
      toast.success(nextActive ? `${r.name} is now active` : `${r.name} has been deactivated`)
      setStatusToggleTarget(null)
    } catch {
      toast.error('Failed to update status')
    } finally {
      setStatusToggleBusy(false)
      setTogglingId(null)
    }
  }

  const handleDelete = (r: MasterRecord, e: MouseEvent) => {
    e.stopPropagation()
    setDeleteTarget(r)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteBusy(true)
    try {
      if (deleteTarget.kind === 'supplier') {
        await deleteSupplier.mutateAsync(deleteTarget.id)
      } else {
        await deleteCustomer.mutateAsync(deleteTarget.id)
      }
      setDeleteTarget(null)
    } catch {
      /* toast handled by deleteCustomer / deleteSupplier hooks */
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div className="space-y-3 p-3 md:p-4">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-xs text-muted-foreground">
          {allRecords.length} records · customers, vendors, and other parties
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-8 gap-1.5 px-3 text-sm" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button className="h-8 gap-1.5 px-3 text-sm bg-primary hover:bg-primary/90" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Record
          </Button>
        </div>
      </div>

      {/* ── Filters card ─────────────────────────────────────────────────── */}
      {(() => {
        const hasActiveFilters = !!(search || selectedTypes.size > 0 || statusTab !== 'all' || advActive || colFilterActive)
        const activeFilterCount = (search ? 1 : 0) + (selectedTypes.size > 0 ? 1 : 0) + (statusTab !== 'all' ? 1 : 0) + (advActive ? 1 : 0) + (colFilterActive ? 1 : 0)
        const clearAll = () => { setSearch(''); setSelectedTypes(new Set()); setStatusTab('all'); setAdvFilters(EMPTY_ADV); setColFilters({}); setPage(1) }

        return (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3 max-h-[90vh] overflow-y-auto">

            {/* ── Search + Clear ── */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Search by name, email, phone, tax ID, company…"
                  className="pl-9 pr-4 text-sm"
                />
              </div>
              <button
                onClick={clearAll}
                title="Clear all filters"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all whitespace-nowrap ${
                  hasActiveFilters
                    ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100 shadow-sm'
                    : 'bg-gray-50 border-gray-200 text-gray-400 cursor-default'
                }`}
              >
                <RotateCcw className={`w-3.5 h-3.5 ${hasActiveFilters ? 'text-red-500' : 'text-gray-300'}`} />
                Clear Filters
                {hasActiveFilters && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-xs font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {/* ── Type multi-select (single scrollable row) ── */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 shrink-0">Type</span>
              <div className="relative flex-1 min-w-0">
                <div
                  className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                >
                  {selectedTypes.size > 0 ? (
                    <button
                      type="button"
                      onClick={() => { setSelectedTypes(new Set()); setPage(1) }}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Filter className="w-3.5 h-3.5" />
                      <span>{selectedTypes.size} selected</span>
                      <span
                        aria-hidden
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-primary/15"
                      >
                        <X className="w-3 h-3" />
                      </span>
                    </button>
                  ) : (
                    <FilterChip
                      active
                      label="All Types"
                      icon={<Filter className="w-3.5 h-3.5" />}
                      count={allRecords.length}
                      onClick={() => { setSelectedTypes(new Set()); setPage(1) }}
                    />
                  )}

                  {[...sourceTabs.filter(t => t.value !== 'all')]
                    .sort((a, b) => {
                      const aSelected = selectedTypes.has(a.value)
                      const bSelected = selectedTypes.has(b.value)
                      if (aSelected && !bSelected) return -1
                      if (!aSelected && bSelected) return 1
                      return a.label.localeCompare(b.label)
                    })
                    .map(tab => (
                      <FilterChip
                        key={tab.value}
                        active={selectedTypes.has(tab.value)}
                        icon={tab.icon}
                        label={tab.label}
                        count={countFor(tab.value)}
                        onClick={() => toggleType(tab.value)}
                      />
                    ))}
                </div>
                <div className="pointer-events-none absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-white to-transparent" />
              </div>
            </div>

            {/* ── Status tabs ── */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium text-gray-500 mr-0.5">Status</span>
              {STATUS_FILTER_TABS.map(tab => {
                const active = statusTab === tab.value
                const cfg    = tab.value !== 'all' ? STATUS_CFG[tab.value as MasterStatus] : null
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => { setStatusTab(tab.value); setPage(1) }}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                      active
                        ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50',
                    )}
                  >
                    {cfg && !active && <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />}
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* ── Advanced filter panel ────────────────────────────────────────── */}
      {showAdvFilters && (
        <div className="bg-white rounded-xl border border-primary/30 shadow-sm p-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-primary/70" />
              Advanced Filters
              {advActive && <span className="text-xs bg-primary/15 text-primary font-bold px-1.5 py-0.5 rounded-full">active</span>}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => { setAdvFilters(EMPTY_ADV); setPage(1) }}
                className="text-xs text-red-500 hover:text-red-700 font-medium">Reset</button>
              <div className="w-px h-4 bg-gray-200" />
              <button
                onClick={() => setShowAdvFilters(false)}
                className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                Minimise
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* Has Email */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Has Email</label>
              <select value={advFilters.hasEmail} onChange={e => setAdv({ hasEmail: e.target.value as AdvFilters['hasEmail'] })}
                className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Any</option><option value="yes">Yes</option><option value="no">No</option>
              </select>
            </div>
            {/* Has Phone */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Has Phone</label>
              <select value={advFilters.hasPhone} onChange={e => setAdv({ hasPhone: e.target.value as AdvFilters['hasPhone'] })}
                className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Any</option><option value="yes">Yes</option><option value="no">No</option>
              </select>
            </div>
            {/* Has GST */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Has GST / Tax ID</label>
              <select value={advFilters.hasGst} onChange={e => setAdv({ hasGst: e.target.value as AdvFilters['hasGst'] })}
                className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Any</option><option value="yes">Yes</option><option value="no">No</option>
              </select>
            </div>
            {/* Credit Limit */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Credit Limit</label>
              <select value={advFilters.creditLimit} onChange={e => setAdv({ creditLimit: e.target.value as AdvFilters['creditLimit'] })}
                className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Any</option><option value="set">Set</option><option value="none">Not Set</option>
              </select>
            </div>
            {/* City / State */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">City / State contains</label>
              <input type="text" value={advFilters.cityContains} onChange={e => setAdv({ cityContains: e.target.value })}
                placeholder="e.g. Mumbai, Delhi…"
                className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            {/* Balance range */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Balance Range (₹)</label>
              <div className="flex items-center gap-1.5">
                <input type="number" value={advFilters.balanceMin} onChange={e => setAdv({ balanceMin: e.target.value })}
                  placeholder="Min" className="flex-1 text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary" />
                <span className="text-gray-300 text-xs">—</span>
                <input type="number" value={advFilters.balanceMax} onChange={e => setAdv({ balanceMax: e.target.value })}
                  placeholder="Max" className="flex-1 text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
            {/* Total Orders range */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Total Orders</label>
              <div className="flex items-center gap-1.5">
                <input type="number" value={advFilters.ordersMin} onChange={e => setAdv({ ordersMin: e.target.value })}
                  placeholder="Min" className="flex-1 text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary" />
                <span className="text-gray-300 text-xs">—</span>
                <input type="number" value={advFilters.ordersMax} onChange={e => setAdv({ ordersMax: e.target.value })}
                  placeholder="Max" className="flex-1 text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
            {/* Total Spent range */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Total Spent (₹)</label>
              <div className="flex items-center gap-1.5">
                <input type="number" value={advFilters.spentMin} onChange={e => setAdv({ spentMin: e.target.value })}
                  placeholder="Min" className="flex-1 text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary" />
                <span className="text-gray-300 text-xs">—</span>
                <input type="number" value={advFilters.spentMax} onChange={e => setAdv({ spentMax: e.target.value })}
                  placeholder="Max" className="flex-1 text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Sort + summary bar ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-3">
          {selected.size > 0 && <span className="text-primary font-semibold">{selected.size} selected</span>}
          <span>Showing <span className="font-semibold text-gray-700">{filtered.length}</span> of {allRecords.length} records</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Column filter toggle */}
          <button onClick={() => setShowColFilters(v => !v)}
            className={`flex items-center gap-1.5 text-xs border rounded-lg px-2.5 py-1.5 font-semibold transition-colors ${
              showColFilters || colFilterActive
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            Col Filters
            {colFilterActive && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
          </button>

          {/* Advanced filter toggle */}
          <button onClick={() => setShowAdvFilters(v => !v)}
            className={`flex items-center gap-1.5 text-xs border rounded-lg px-2.5 py-1.5 font-semibold transition-colors ${
              showAdvFilters || advActive
                ? 'bg-primary/10 border-primary/40 text-primary'
                : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}>
            <Filter className="w-3.5 h-3.5" />
            Filters
            {advActive && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
          </button>

          {/* Column chooser */}
          <div className="relative" ref={colPickerRef}>
            <button onClick={() => setShowColPicker(v => !v)}
              className={`flex items-center gap-1.5 text-xs border rounded-lg px-2.5 py-1.5 font-semibold transition-colors ${
                showColPicker ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              Columns
              <span className="text-xs bg-primary/15 text-primary font-bold px-1 rounded">
                {visibleCols.size}
              </span>
            </button>
            {showColPicker && (
              <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-52 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-700">Show / Hide Columns</span>
                  <button onClick={() => setVisibleCols(DEFAULT_VISIBLE_COLS)}
                    className="text-xs text-primary hover:underline">Reset</button>
                </div>
                <div className="space-y-1">
                  {ALL_COL_DEFS.map(col => (
                    <label key={col.key} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
                      col.locked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
                    }`}>
                      <input type="checkbox"
                        checked={visibleCols.has(col.key)}
                        disabled={col.locked}
                        onChange={() => {
                          if (col.locked) return
                          setVisibleCols(prev => {
                            const n = new Set(prev)
                            n.has(col.key) ? n.delete(col.key) : n.add(col.key)
                            return n
                          })
                        }}
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="flex-1 text-gray-700">{col.label}</span>
                      {col.locked && <span className="text-xs text-gray-400 uppercase tracking-wide">locked</span>}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <span className="text-gray-300">|</span>
          <span className="text-gray-400">Sort by</span>
          <select value={sortField} onChange={e => { setSortField(e.target.value as SortField); setPage(1) }}
            className="text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="created_at">Date Added</option>
            <option value="name">Name</option>
            <option value="type">Type</option>
            <option value="status">Status</option>
          </select>
          <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            className="flex items-center gap-1 text-xs border rounded-lg px-2 py-1.5 bg-white hover:bg-gray-50 transition-colors">
            {sortDir === 'asc' ? 'A → Z / Old → New' : 'Z → A / New → Old'}
            {sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading master data…
          </div>
        ) : pageRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
            <Users className="w-10 h-10 opacity-30" />
            <p className="font-medium">No records match the current filters</p>
            <button onClick={() => { setSearch(''); setSelectedTypes(new Set()); setStatusTab('all'); setAdvFilters(EMPTY_ADV) }}
              className="text-sm text-primary hover:underline">Clear filters</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                {/* ── Column header row ── */}
                <tr>
                  <th className="pl-4 pr-2 py-3 w-9">
                    <input type="checkbox" checked={allSelected}
                      ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                      onChange={toggleAll}
                      className="rounded border-gray-300 text-primary focus:ring-primary" />
                  </th>
                  {ALL_COL_DEFS.filter(c => visibleCols.has(c.key)).map(col => (
                    <th key={col.key} className={`px-4 py-3 ${col.key === 'actions' ? 'text-right' : 'text-left'} text-xs font-medium uppercase tracking-wide text-gray-500`}>
                      {col.sortable ? (
                        <button onClick={() => clickSort(col.sortable!)} className="flex items-center gap-1 hover:text-gray-800">
                          {col.label} <SortIcon field={col.sortable} />
                        </button>
                      ) : col.label}
                    </th>
                  ))}
                </tr>

                {/* ── Column filter input row ── */}
                {showColFilters && (
                  <tr className="bg-amber-50/60 border-b border-amber-100">
                    <td className="pl-4 pr-2 py-2">
                      {colFilterActive && (
                        <button type="button" aria-label="Close" onClick={() => { setColFilters({}); setPage(1) }} title="Clear column filters"
                          className="text-amber-500 hover:text-amber-700">
                <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                    {ALL_COL_DEFS.filter(c => visibleCols.has(c.key)).map(col => {
                      const filterable = ['name','type','contact','email','phone','company','city','taxId'].includes(col.key)
                      return (
                        <td key={col.key} className="px-2 py-1.5">
                          {filterable ? (
                            <div className="relative">
                              <input
                                type="text"
                                value={colFilters[col.key] ?? ''}
                                onChange={e => setColFilter(col.key, e.target.value)}
                                placeholder={`Filter…`}
                                className={`w-full text-xs rounded-md border px-2 py-1 pr-5 outline-none focus:ring-2 focus:ring-amber-300 transition-colors ${
                                  colFilters[col.key]?.trim()
                                    ? 'border-amber-400 bg-white text-gray-800'
                                    : 'border-gray-200 bg-white/70 text-gray-500 placeholder-gray-300'
                                }`}
                              />
                              {colFilters[col.key]?.trim() && (
                                <button type="button" aria-label="Close" onClick={() => setColFilter(col.key, '')}
                                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ) : null}
                        </td>
                      )
                    })}
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pageRows.map(r => {
                  const bal = r.balance ?? 0
                  return (
                    <tr key={`${r.kind}-${r.id}`}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={onClickableTableRow(() => openDrawer(r))}>

                      <td className="pl-4 pr-2 py-3" data-stop-row-click onClick={() => toggleRow(r.id)}>
                        <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleRow(r.id)}
                          className="rounded border-gray-300 text-primary focus:ring-primary" />
                      </td>

                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {(() => {
                            const storedAvatar = localStorage.getItem(`md_avatar_${r.id}`)
                            return storedAvatar
                              ? <img src={storedAvatar} alt={r.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                              : <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${
                                  r.kind === 'customer' ? 'bg-blue-100 text-blue-700' : 'bg-primary/15 text-primary'
                                }`}>{r.name.trim()[0]?.toUpperCase() ?? '?'}</div>
                          })()}
                          <div>
                            <p className="font-semibold text-gray-900 text-sm leading-tight">{r.name}</p>
                            {r.companyName && <p className="text-xs text-gray-400">{r.companyName}</p>}
                            {!r.companyName && r.phone && <p className="text-xs text-gray-400">{r.phone}</p>}
                          </div>
                        </div>
                      </td>

                      {ALL_COL_DEFS.filter(c => visibleCols.has(c.key) && c.key !== 'name').map(col => {
                        const raw = r.raw as unknown as Record<string, unknown>
                        switch (col.key) {
                          case 'type': return (
                            <td key="type" className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${TYPE_COLORS[r.type] ?? getCustomTypeColor(r.type)}`}>{r.typeLabel}</span>
                            </td>
                          )
                          case 'contact': return (
                            <td key="contact" className="px-4 py-3 text-sm text-gray-600">
                              <div className="space-y-0.5">
                                {r.email && <p className="text-xs truncate max-w-[160px]">{r.email}</p>}
                                {r.phone && <p className="text-xs text-gray-400">{r.phone}</p>}
                                {!r.email && !r.phone && <span className="text-xs text-gray-300">—</span>}
                              </div>
                            </td>
                          )
                          case 'email': return (
                            <td key="email" className="px-4 py-3 text-xs text-gray-600">
                              {r.email ? <a href={`mailto:${r.email}`} className="hover:text-primary hover:underline truncate max-w-[180px] block">{r.email}</a> : <span className="text-gray-300">—</span>}
                            </td>
                          )
                          case 'phone': return (
                            <td key="phone" className="px-4 py-3 text-xs text-gray-600">
                              {r.phone ?? <span className="text-gray-300">—</span>}
                            </td>
                          )
                          case 'company': return (
                            <td key="company" className="px-4 py-3 text-xs text-gray-600">
                              {r.companyName ?? <span className="text-gray-300">—</span>}
                            </td>
                          )
                          case 'city': return (
                            <td key="city" className="px-4 py-3 text-xs text-gray-600">
                              {[raw.city as string, raw.state as string].filter(Boolean).join(', ') || <span className="text-gray-300">—</span>}
                            </td>
                          )
                          case 'taxId': return (
                            <td key="taxId" className="px-4 py-3">
                              {r.taxId ? <span className="font-mono text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{r.taxId}</span> : <span className="text-xs text-gray-300">—</span>}
                            </td>
                          )
                          case 'balance': return (
                            <td key="balance" className="px-4 py-3">
                              {bal !== 0 ? <span className={`text-xs font-medium ${bal > 0 ? 'text-orange-600' : 'text-green-600'}`}>{formatCurrency(Math.abs(bal))} {bal > 0 ? 'Dr' : 'Cr'}</span> : <span className="text-xs text-gray-300">—</span>}
                            </td>
                          )
                          case 'totalOrders': return (
                            <td key="totalOrders" className="px-4 py-3 text-xs text-gray-600 text-center">
                              {r.totalOrders ?? <span className="text-gray-300">—</span>}
                            </td>
                          )
                          case 'totalSpent': return (
                            <td key="totalSpent" className="px-4 py-3 text-xs text-gray-600">
                              {r.totalSpent ? <span className="font-semibold text-primary">{formatCurrency(r.totalSpent)}</span> : <span className="text-gray-300">—</span>}
                            </td>
                          )
                          case 'status': return (
                            <td key="status" className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <StatusToggleSwitch
                                  active={r.isActive}
                                  busy={togglingId === r.id}
                                  onClick={(e) => handleToggleStatus(r, e)}
                                />
                                <span className={cn(
                                  'text-xs font-medium min-w-[3.25rem]',
                                  r.isActive ? 'text-primary' : 'text-muted-foreground',
                                )}>
                                  {r.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                            </td>
                          )
                          case 'added': return (
                            <td key="added" className="px-4 py-3 text-xs text-gray-500">{formatDate(r.createdAt)}</td>
                          )
                          case 'actions': return (
                            <td key="actions" className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => openDrawer(r)} title="View details"
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                                <button onClick={() => openEdit(r)} title="Edit"
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={(e) => handleDelete(r, e)} title="Delete permanently"
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )
                          default: return null
                        }
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
            <span className="text-xs text-gray-500">
              Page {page} of {totalPages} · {sorted.length} records
            </span>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-2.5 py-1 text-xs border rounded-lg disabled:opacity-40 hover:bg-white transition-colors">
                ← Prev
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pg = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
                return (
                  <button key={pg} onClick={() => setPage(pg)}
                    className={`px-2.5 py-1 text-xs border rounded-lg transition-colors ${
                      pg === page ? 'bg-primary border-primary text-white' : 'hover:bg-white'
                    }`}>{pg}</button>
                )
              })}
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="px-2.5 py-1 text-xs border rounded-lg disabled:opacity-40 hover:bg-white transition-colors">
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Summary stats strip ──────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-3">
        {sourceTabs.filter(t => t.value !== 'all').map(tab => {
          const cnt   = allRecords.filter(r => r.type === tab.value).length
          const activ = allRecords.filter(r => r.type === tab.value && r.isActive).length
          const selected = selectedTypes.has(tab.value)
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => { toggleType(tab.value); setPage(1) }}
              className={cn(
                'flex flex-col items-start p-3 rounded-xl border text-left transition-colors',
                selected
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
              )}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className={selected ? 'text-primary' : 'text-gray-500'}>{tab.icon}</span>
                <span className={cn('text-xs font-medium', selected ? 'text-primary' : 'text-gray-600')}>{tab.label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 leading-none">{cnt}</p>
              <p className="text-xs text-gray-400 mt-1">{activ} active</p>
            </button>
          )
        })}
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────── */}

      {showCreate && (
        <AddPartyModal
          onClose={() => setShowCreate(false)}
          onCreated={() => setShowCreate(false)}
          defaultType={
            (selectedTypes.size === 1
              ? [...selectedTypes][0]   // mirror the active type-filter tab
              : 'customer'              // sensible default when no specific filter is active
            ) as import('@/types').PartyType
          }
        />
      )}

      {viewingRecord && (
        <MasterDataDrawer
          record={viewingRecord}
          onClose={() => setViewingRecord(null)}
          onEdit={() => openEdit(viewingRecord)}
        />
      )}

      {editingRecord && (
        <AddPartyModal
          editRecord={{ raw: editingRecord.raw, kind: editingRecord.kind }}
          onClose={() => setEditingRecord(null)}
          onCreated={() => setEditingRecord(null)}
        />
      )}

      {statusToggleTarget && (
        <ConfirmDialog
          open
          title={statusToggleTarget.nextActive
            ? `Activate "${statusToggleTarget.record.name}"?`
            : `Deactivate "${statusToggleTarget.record.name}"?`}
          subtitle={`${statusToggleTarget.record.typeLabel}`}
          description={statusToggleTarget.nextActive
            ? 'This record will be marked active and available for orders, invoices, and other operations.'
            : 'This record will be marked inactive and hidden from active operations. You can reactivate it anytime.'}
          confirmLabel={statusToggleTarget.nextActive ? 'Activate' : 'Deactivate'}
          variant={statusToggleTarget.nextActive ? 'success' : 'warning'}
          busy={statusToggleBusy}
          onCancel={() => setStatusToggleTarget(null)}
          onConfirm={() => void confirmStatusToggle()}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          open
          title={`Delete "${deleteTarget.name}"?`}
          subtitle={deleteTarget.typeLabel}
          description="This permanently removes the record. This action cannot be undone."
          confirmLabel="Delete"
          variant="danger"
          busy={deleteBusy}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  )
}
