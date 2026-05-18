import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCustomers, useCreateCustomer } from '@/hooks/useVendor'
import { formatCurrency, formatDate } from '@/lib/utils'
import { TableToolbar } from '@/components/table/TableToolbar'
import { ResizableTable } from '@/components/table/ResizableTable'
import { processRows, type SortDir } from '@/lib/tableList'
import { vendorApi } from '@/api/vendor'
import type { Customer } from '@/types'
import { PhoneInput } from '@/components/ui/PhoneInput'
import {
  Search, Eye, Loader2, Plus, X, UserPlus, Phone, Mail, Lock,
  ChevronLeft, ChevronRight, Building2, MapPin, CheckCircle2, AlertCircle,
  IndianRupee,
} from 'lucide-react'
import { AddPartyModal } from '@/components/parties/AddPartyModal'

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

function CreateCustomerModal({ onClose }: { onClose: () => void }) {
  const createCustomer = useCreateCustomer()
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    gstin: '',
    pan_number: '',
    company_name: '',
    billing_street: '',
    billing_city: '',
    billing_state: '',
    billing_pincode: '',
    opening_balance: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [gstLooking, setGstLooking] = useState(false)
  const [gstStatus, setGstStatus] = useState<'idle' | 'valid' | 'invalid' | 'fetched'>('idle')

  const handleGstinChange = (val: string) => {
    const g = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15)
    setForm(p => ({ ...p, gstin: g }))
    setGstStatus('idle')

    if (g.length === 15) {
      if (GSTIN_RE.test(g)) {
        setGstStatus('valid')
        const pan = g.slice(2, 12)
        const state = GST_STATES[g.slice(0, 2)] || ''
        setForm(p => ({
          ...p,
          gstin: g,
          pan_number: pan,
          billing_state: state || p.billing_state,
        }))
      } else {
        setGstStatus('invalid')
      }
    }
  }

  const fetchGstDetails = async () => {
    if (!form.gstin || form.gstin.length !== 15) return
    setGstLooking(true)
    try {
      const data = await vendorApi.gstLookup(form.gstin)
      if (data.api_fetched) {
        const addr = data.address as Record<string, string> | undefined
        setForm(p => ({
          ...p,
          full_name: p.full_name || (data.trade_name as string) || (data.legal_name as string) || '',
          company_name: (data.trade_name as string) || (data.legal_name as string) || p.company_name,
          pan_number: (data.pan as string) || p.pan_number,
          billing_street: addr?.street || p.billing_street,
          billing_city: addr?.city || p.billing_city,
          billing_state: addr?.state || (data.state_name as string) || p.billing_state,
          billing_pincode: addr?.pincode || p.billing_pincode,
        }))
        setGstStatus('fetched')
      } else {
        setGstStatus('valid')
      }
    } catch {
      setGstStatus('valid')
    } finally {
      setGstLooking(false)
    }
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.full_name.trim() || form.full_name.trim().length < 2) errs.full_name = 'Name is required (min 2 chars)'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email'
    if (form.phone && form.phone.replace(/\D/g, '').length < 7) errs.phone = 'Enter a valid phone number'
    if (!form.email.trim() && !form.phone.trim()) errs.phone = 'Either email or phone is required'
    if (form.password && form.password.length < 6) errs.password = 'Password must be at least 6 chars'
    if (form.gstin && !GSTIN_RE.test(form.gstin)) errs.gstin = 'Invalid GSTIN format'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    const billingAddr = (form.billing_street || form.billing_city || form.billing_state || form.billing_pincode)
      ? { street: form.billing_street, city: form.billing_city, state: form.billing_state, pincode: form.billing_pincode }
      : undefined
    createCustomer.mutate(
      {
        full_name: form.full_name.trim(),
        email: form.email.trim() ? form.email.trim().toLowerCase() : undefined,
        phone: form.phone.trim() || undefined,
        password: form.password || undefined,
        gstin: form.gstin || undefined,
        pan_number: form.pan_number || undefined,
        company_name: form.company_name || undefined,
        billing_address: billingAddr,
        opening_balance: form.opening_balance ? parseFloat(form.opening_balance) : 0,
      } as Parameters<typeof createCustomer.mutate>[0],
      { onSuccess: () => onClose() },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold">Add Customer</h2>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* GSTIN */}
          <div>
            <Label htmlFor="gstin" className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> GSTIN
              <span className="text-gray-400 font-normal text-xs">(optional)</span>
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="gstin"
                  placeholder="e.g. 36AAGCI8158Q1ZP"
                  value={form.gstin}
                  onChange={(e) => handleGstinChange(e.target.value)}
                  maxLength={15}
                  className={`font-mono uppercase ${errors.gstin ? 'border-red-400' : gstStatus === 'fetched' ? 'border-green-400' : gstStatus === 'invalid' ? 'border-red-400' : ''}`}
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
            {errors.gstin && <p className="text-xs text-red-500 mt-1">{errors.gstin}</p>}
            {form.gstin.length > 0 && form.gstin.length < 15 && <p className="text-xs text-gray-400 mt-1">{form.gstin.length}/15 characters</p>}
            {gstStatus === 'fetched' && <p className="text-xs text-green-600 mt-1">Details fetched from GST portal</p>}
          </div>

          {/* Name + Company */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="full_name">Full Name *</Label>
              <Input
                id="full_name"
                placeholder="Customer name"
                value={form.full_name}
                onChange={(e) => setForm(p => ({ ...p, full_name: e.target.value }))}
                className={errors.full_name ? 'border-red-400' : ''}
              />
              {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name}</p>}
            </div>
            <div>
              <Label htmlFor="company_name">Company / Trade Name</Label>
              <Input
                id="company_name"
                placeholder="Business name"
                value={form.company_name}
                onChange={(e) => setForm(p => ({ ...p, company_name: e.target.value }))}
              />
            </div>
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="email" type="email" placeholder="customer@example.com"
                  value={form.email}
                  onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                  className={`pl-10 ${errors.email ? 'border-red-400' : ''}`}
                />
              </div>
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <PhoneInput
                value={form.phone}
                onChange={(v) => setForm(p => ({ ...p, phone: v }))}
                error={errors.phone}
                defaultCountryIso="IN"
              />
            </div>
          </div>

          {/* PAN + Opening Balance */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pan_number">PAN</Label>
              <Input
                id="pan_number"
                placeholder="ABCDE1234F"
                value={form.pan_number}
                onChange={(e) => setForm(p => ({ ...p, pan_number: e.target.value.toUpperCase().slice(0, 10) }))}
                className="font-mono uppercase"
                maxLength={10}
              />
            </div>
            <div>
              <Label htmlFor="opening_balance" className="flex items-center gap-1">
                <IndianRupee className="w-3 h-3" /> Opening Balance
              </Label>
              <Input
                id="opening_balance" type="number" step="0.01"
                placeholder="0.00"
                value={form.opening_balance}
                onChange={(e) => setForm(p => ({ ...p, opening_balance: e.target.value }))}
              />
              <p className="text-[10px] text-gray-400 mt-0.5">+ve = receivable, -ve = advance/credit</p>
            </div>
          </div>

          {/* Billing Address */}
          <div>
            <Label className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Billing Address</Label>
            <Input
              placeholder="Street address"
              value={form.billing_street}
              onChange={(e) => setForm(p => ({ ...p, billing_street: e.target.value }))}
              className="mt-1"
            />
            <div className="grid grid-cols-3 gap-2 mt-2">
              <Input placeholder="City" value={form.billing_city} onChange={(e) => setForm(p => ({ ...p, billing_city: e.target.value }))} />
              <Input placeholder="State" value={form.billing_state} onChange={(e) => setForm(p => ({ ...p, billing_state: e.target.value }))} />
              <Input placeholder="PIN code" value={form.billing_pincode} onChange={(e) => setForm(p => ({ ...p, billing_pincode: e.target.value }))} />
            </div>
          </div>

          {/* Password */}
          <div>
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="password" type="password" placeholder="Leave blank for default"
                value={form.password}
                onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
                className={`pl-10 ${errors.password ? 'border-red-400' : ''}`}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">If blank, defaults to phone number or Welcome@123</p>
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="cancel" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700" disabled={createCustomer.isPending}>
              {createCustomer.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Add Customer
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Customers() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [sortKey, setSortKey] = useState('full_name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const { data, isLoading } = useCustomers({ page, size: 10, search: search || undefined })
  const pages = data?.pages || 0

  const displayCustomers = useMemo(() => {
    if (!data?.items?.length) return []
    return processRows(
      data.items as Customer[],
      '',
      () => [],
      sortKey,
      sortDir,
      {
        full_name: (c) => c.full_name,
        phone: (c) => c.phone || '',
        gstin: (c) => c.gstin || '',
        total_orders: (c) => c.total_orders,
        total_spent: (c) => c.total_spent,
        opening_balance: (c) => c.opening_balance ?? 0,
        created_at: (c) => c.created_at,
      },
    )
  }, [data?.items, sortKey, sortDir])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-0.5">Master Data</p>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Master Data
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1) }} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search by name, email, phone..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="pl-10" />
            </div>
            <Button type="submit" variant="outline">Search</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <TableToolbar
            search=""
            onSearchChange={() => {}}
            hideSearch
            hint="Sorting applies to the current page."
            sortOptions={[
              { value: 'full_name', label: 'Name' },
              { value: 'phone', label: 'Phone' },
              { value: 'gstin', label: 'GSTIN' },
              { value: 'total_orders', label: 'Orders' },
              { value: 'total_spent', label: 'Spent' },
              { value: 'opening_balance', label: 'Balance' },
              { value: 'created_at', label: 'Joined' },
            ]}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKeyChange={setSortKey}
            onSortDirChange={setSortDir}
          />
          <ResizableTable tableId="customers" defaultWidths={[220, 120, 140, 80, 100, 90, 80]}>
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Customer</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Phone</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">GSTIN</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Orders</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Spent</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Balance</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
              ) : !data?.items?.length ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <UserPlus className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 mb-3">No customers yet</p>
                    <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
                      <Plus className="w-4 h-4 mr-1" /> Add your first customer
                    </Button>
                  </td>
                </tr>
              ) : displayCustomers.map((c) => {
                const bal = c.opening_balance ?? 0
                return (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{c.full_name}</p>
                      <p className="text-xs text-gray-500">{c.company_name || c.email || c.phone || '—'}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden sm:table-cell">{c.phone || '—'}</td>
                    <td className="px-6 py-4 text-xs font-mono text-gray-600 hidden lg:table-cell">{c.gstin || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{c.total_orders}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{formatCurrency(c.total_spent)}</td>
                    <td className="px-6 py-4 text-sm hidden md:table-cell">
                      {bal !== 0 ? (
                        <span className={bal > 0 ? 'text-orange-600' : 'text-green-600'}>
                          {formatCurrency(Math.abs(bal))} {bal > 0 ? 'Dr' : 'Cr'}
                        </span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/customers/${c.id}`)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </ResizableTable>

          {pages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t bg-gray-50">
              <span className="text-xs text-gray-500">
                Page {page} of {pages} ({data?.total} customers)
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {showCreate && (
        <AddPartyModal
          defaultType="customer"
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}
