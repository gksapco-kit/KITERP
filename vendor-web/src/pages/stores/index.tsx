import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useStores, vendorKeys } from '@/hooks/useVendor'
import { vendorApi } from '@/api/vendor'
import type { StoreRecord } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Plus, Store, MapPin, Phone, Mail, Users, Package, Search,
  Edit2, Trash2, Star, StarOff, X, Loader2,
  ChevronRight, ArrowLeftRight, Link2, Copy, ExternalLink, Check,
  Building2, Heart, Briefcase, Dumbbell, ShoppingBag, Hotel, UtensilsCrossed,
  BedDouble, Tag, ChevronDown, Pencil,
  ShoppingCart, Gem, Sparkles, Monitor, Shirt, Wrench,
  Coffee, Cookie, Zap, ChefHat, Code2, Warehouse, Factory, Truck,
  Stethoscope, Smile, PawPrint, Pill, FlaskConical, Scissors, Leaf,
  Camera, CalendarDays, GraduationCap, BookOpen, Landmark, Calculator,
  Scale, Car, Home, Plane,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useVendorStore } from '@/stores/vendorStore'
import { toast } from 'sonner'
import {
  IdChip, VerifiedBadge, formatStoreCode,
  vendorVerificationLevel as deriveVendorLevel,
  type VerificationLevel,
} from '@/lib/verification'
import { getCustomerStorefrontBaseUrl } from '@/lib/storefrontPreviewUrl'
import VendorStorefrontLinksCard from '@/components/VendorStorefrontLinksCard'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1').replace('/api/v1', '')

function storeLink(vendorSlug: string | undefined, store: StoreRecord) {
  const base = vendorSlug ? getCustomerStorefrontBaseUrl(vendorSlug) : API_BASE
  const key = store.code || store.id
  return `${base}?branch=${encodeURIComponent(key)}`
}

function copyText(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => toast.success(label))
}

// ── Types ──────────────────────────────────────────────────────────────────

interface StoreFormData {
  name: string
  code: string
  description: string
  phone: string   // full E.164 string e.g. "+919876543210"
  email: string
  street: string
  city: string
  state: string
  pincode: string
  is_default: boolean
  company_type: string
}

const EMPTY_FORM: StoreFormData = {
  name: '', code: '', description: '', phone: '', email: '',
  street: '', city: '', state: '', pincode: '', is_default: false,
  company_type: '',
}

// ── Company Type Options ────────────────────────────────────────────────────

interface CompanyTypeOption {
  value: string
  label: string
  icon: React.ElementType
  group: string
}

const COMPANY_TYPES: CompanyTypeOption[] = [
  // Retail
  { group: 'Retail',        value: 'Shop',                    label: 'Shop',                       icon: ShoppingBag },
  { group: 'Retail',        value: 'Store',                   label: 'Store',                      icon: Store },
  { group: 'Retail',        value: 'Supermarket',             label: 'Supermarket',                icon: ShoppingCart },
  { group: 'Retail',        value: 'Jewelry Store',           label: 'Jewelry Store 💍',            icon: Gem },
  { group: 'Retail',        value: 'Beauty & Cosmetics Store',label: 'Beauty & Cosmetics 💄',       icon: Sparkles },
  { group: 'Retail',        value: 'Electronics Store',       label: 'Electronics Store',          icon: Monitor },
  { group: 'Retail',        value: 'Clothing Store',          label: 'Clothing / Apparel Store',   icon: Shirt },
  { group: 'Retail',        value: 'Hardware Store',          label: 'Hardware Store',             icon: Wrench },
  // Food & Hospitality
  { group: 'Food & Hospitality', value: 'Restaurant',         label: 'Restaurant',                 icon: UtensilsCrossed },
  { group: 'Food & Hospitality', value: 'Café',               label: 'Café / Coffee Shop',         icon: Coffee },
  { group: 'Food & Hospitality', value: 'Bakery',             label: 'Bakery',                     icon: Cookie },
  { group: 'Food & Hospitality', value: 'Fast Food Outlet',   label: 'Fast Food Outlet',           icon: Zap },
  { group: 'Food & Hospitality', value: 'Cloud Kitchen',      label: 'Cloud Kitchen',              icon: ChefHat },
  { group: 'Food & Hospitality', value: 'Hotel',              label: 'Hotel',                      icon: Hotel },
  { group: 'Food & Hospitality', value: 'Guest House',        label: 'Guest House / Inn',          icon: BedDouble },
  // Business & Office
  { group: 'Business & Office',  value: 'Office',             label: 'Office',                     icon: Building2 },
  { group: 'Business & Office',  value: 'Company',            label: 'Company',                    icon: Briefcase },
  { group: 'Business & Office',  value: 'Business Area',      label: 'Business Area',              icon: Tag },
  { group: 'Business & Office',  value: 'IT / Software Company', label: 'IT / Software Company',  icon: Code2 },
  { group: 'Business & Office',  value: 'Consulting Firm',    label: 'Consulting Firm',            icon: Users },
  // Industrial & Logistics
  { group: 'Industrial & Logistics', value: 'Warehouse',      label: 'Warehouse',                  icon: Warehouse },
  { group: 'Industrial & Logistics', value: 'Factory',        label: 'Factory / Manufacturing',    icon: Factory },
  { group: 'Industrial & Logistics', value: 'Logistics',      label: 'Logistics / Delivery Service',icon: Truck },
  // Healthcare
  { group: 'Healthcare',    value: 'Hospital',                label: 'Hospital',                   icon: Heart },
  { group: 'Healthcare',    value: 'Clinic',                  label: 'Clinic',                     icon: Stethoscope },
  { group: 'Healthcare',    value: 'Dental Clinic',           label: 'Dental Clinic',              icon: Smile },
  { group: 'Healthcare',    value: 'Veterinary Clinic',       label: 'Veterinary Clinic 🐾',       icon: PawPrint },
  { group: 'Healthcare',    value: 'Pharmacy',                label: 'Pharmacy',                   icon: Pill },
  { group: 'Healthcare',    value: 'Diagnostic Lab',          label: 'Diagnostic Lab',             icon: FlaskConical },
  // Wellness & Lifestyle
  { group: 'Wellness & Lifestyle', value: 'Gym',              label: 'Gym / Fitness Center',       icon: Dumbbell },
  { group: 'Wellness & Lifestyle', value: 'Salon',            label: 'Salon / Beauty Parlor',      icon: Scissors },
  { group: 'Wellness & Lifestyle', value: 'Spa',              label: 'Spa / Wellness Center',      icon: Leaf },
  { group: 'Wellness & Lifestyle', value: 'Photography Studio', label: 'Photography Studio',       icon: Camera },
  { group: 'Wellness & Lifestyle', value: 'Event Management', label: 'Event Management',           icon: CalendarDays },
  // Education
  { group: 'Education',     value: 'School',                  label: 'School',                     icon: GraduationCap },
  { group: 'Education',     value: 'College / Institute',     label: 'College / Institute',        icon: BookOpen },
  { group: 'Education',     value: 'Coaching Center',         label: 'Coaching / Training Center', icon: BookOpen },
  // Finance & Legal
  { group: 'Finance & Legal', value: 'Bank',                  label: 'Bank / Financial Service',   icon: Landmark },
  { group: 'Finance & Legal', value: 'Accounting Firm',       label: 'Accounting / CA Firm',       icon: Calculator },
  { group: 'Finance & Legal', value: 'Law Firm',              label: 'Law Firm',                   icon: Scale },
  // Automotive & Property
  { group: 'Automotive & Property', value: 'Automotive Service', label: 'Automotive Service / Garage', icon: Wrench },
  { group: 'Automotive & Property', value: 'Car Showroom',    label: 'Car Showroom',               icon: Car },
  { group: 'Automotive & Property', value: 'Real Estate',     label: 'Real Estate / Property Office', icon: Home },
  { group: 'Automotive & Property', value: 'Travel Agency',   label: 'Travel Agency',              icon: Plane },
]

const COMPANY_TYPE_GROUPS = Array.from(new Set(COMPANY_TYPES.map(t => t.group)))

// ── StoreModal ─────────────────────────────────────────────────────────────

function StoreModal({
  store,
  onClose,
  onSave,
  saving,
  defaultCountry = 'India',
}: {
  store?: StoreRecord | null
  onClose: () => void
  onSave: (data: Record<string, unknown>) => void
  saving: boolean
  defaultCountry?: string
}) {
  const existingType = (store?.settings as Record<string, string> | undefined)?.company_type ?? ''
  const isPreset = COMPANY_TYPES.some(t => t.value === existingType)

  const [form, setForm] = useState<StoreFormData>(() => store
    ? {
        name: store.name, code: store.code ?? '', description: store.description ?? '',
        phone: store.phone ?? '', email: store.email ?? '',
        street: store.address?.street ?? '', city: store.address?.city ?? '',
        state: store.address?.state ?? '', pincode: store.address?.pincode ?? '',
        is_default: store.is_default,
        company_type: existingType,
      }
    : EMPTY_FORM
  )

  const [customTypeInput, setCustomTypeInput] = useState(isPreset || !existingType ? '' : existingType)
  const [showCustomInput, setShowCustomInput] = useState(!!existingType && !isPreset)
  const [typeDropOpen, setTypeDropOpen] = useState(false)
  const typeDropRef = useRef<HTMLDivElement>(null)
  const lastSuggestedLocationNameRef = useRef<string | null>(null)

  useEffect(() => {
    if (!store) lastSuggestedLocationNameRef.current = null
  }, [store])

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (typeDropRef.current && !typeDropRef.current.contains(e.target as Node)) {
        setTypeDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const set = (k: keyof StoreFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const selectType = (value: string) => {
    const preset = COMPANY_TYPES.find(t => t.value === value)
    const suggested = preset?.label ?? value
    setForm(f => {
      if (store) return { ...f, company_type: value }
      const trimmed = f.name.trim()
      const prev = lastSuggestedLocationNameRef.current
      const syncName =
        trimmed === '' || (prev !== null && trimmed === prev.trim())
      const nextName = syncName ? suggested : f.name
      if (syncName) lastSuggestedLocationNameRef.current = suggested
      return { ...f, company_type: value, name: nextName }
    })
    setShowCustomInput(false)
    setTypeDropOpen(false)
  }

  const addCustomType = () => {
    const val = customTypeInput.trim()
    if (!val) return
    setForm(f => {
      if (store) return { ...f, company_type: val }
      const trimmed = f.name.trim()
      const prev = lastSuggestedLocationNameRef.current
      const syncName =
        trimmed === '' || (prev !== null && trimmed === prev.trim())
      const nextName = syncName ? val : f.name
      if (syncName) lastSuggestedLocationNameRef.current = val
      return { ...f, company_type: val, name: nextName }
    })
    setShowCustomInput(false)
    setTypeDropOpen(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      name: form.name, code: form.code || undefined, description: form.description || undefined,
      phone: form.phone || undefined, email: form.email || undefined,
      is_default: form.is_default,
      address: {
        street: form.street || undefined, city: form.city || undefined,
        state: form.state || undefined, pincode: form.pincode || undefined,
        country: store?.address?.country || defaultCountry,
      },
      settings: { company_type: form.company_type || undefined },
    })
  }

  return (
<<<<<<< Updated upstream
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold">{store ? 'Edit Store' : 'Create New Store'}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
=======
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold">{store ? 'Edit company code' : 'New company code'}</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="w-5 h-5" /></button>
>>>>>>> Stashed changes
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* Business Type / Category */}
          <div ref={typeDropRef} className="relative">
            <Label className="mb-1 block">Business Type / Category</Label>

            {/* Trigger button */}
            <button
              type="button"
              onClick={() => { setTypeDropOpen(v => !v); setShowCustomInput(false) }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-md border text-sm text-left transition-all',
                typeDropOpen ? 'border-primary ring-2 ring-primary/25' : 'border-input hover:border-gray-400'
              )}
            >
              {(() => {
                const preset = COMPANY_TYPES.find(t => t.value === form.company_type)
                const Icon = preset?.icon
                return Icon ? (
                  <>
                    <span className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-primary" />
                    </span>
                    <span className="flex-1 font-medium text-gray-800">{preset.label}</span>
                  </>
                ) : form.company_type ? (
                  <>
                    <span className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                      <Pencil className="w-3.5 h-3.5 text-gray-500" />
                    </span>
                    <span className="flex-1 font-medium text-gray-800">{form.company_type} <span className="text-xs text-gray-400 font-normal">(custom)</span></span>
                  </>
                ) : (
                  <span className="flex-1 text-gray-400">Select business type…</span>
                )
              })()}
              <ChevronDown className={cn('w-4 h-4 text-gray-400 shrink-0 transition-transform', typeDropOpen && 'rotate-180')} />
            </button>

            {/* Dropdown panel */}
            {typeDropOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-80 overflow-y-auto">
                {COMPANY_TYPE_GROUPS.map(group => (
                  <div key={group}>
                    <p className="px-4 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 sticky top-0">
                      {group}
                    </p>
                    {COMPANY_TYPES.filter(t => t.group === group).map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => selectType(value)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-accent transition-colors',
                          form.company_type === value && 'bg-accent'
                        )}
                      >
                        <span className={cn(
                          'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                          form.company_type === value ? 'bg-primary' : 'bg-gray-100'
                        )}>
                          <Icon className={cn('w-3.5 h-3.5', form.company_type === value ? 'text-white' : 'text-gray-500')} />
                        </span>
                        <span className={cn('flex-1 text-sm', form.company_type === value ? 'font-semibold text-primary' : 'text-gray-700')}>
                          {label}
                        </span>
                        {form.company_type === value && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                      </button>
                    ))}
                  </div>
                ))}

                {/* Divider + custom entry */}
                <div className="border-t border-gray-100">
                  {!showCustomInput ? (
                    <button
                      type="button"
                      onClick={() => { setShowCustomInput(true); setCustomTypeInput('') }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                    >
                      <span className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <Plus className="w-4 h-4 text-gray-500" />
                      </span>
                      <span className="text-sm text-gray-500 font-medium">+ Add custom type…</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <Input
                        autoFocus
                        value={customTypeInput}
                        onChange={e => setCustomTypeInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomType() } }}
                        placeholder="e.g. Co-working, Lab, Studio…"
                        className="flex-1 h-8 text-sm"
                      />
                      <Button type="button" size="sm" className="h-8 px-3 shrink-0" onClick={addCustomType}>
                        Add
                      </Button>
                      <button type="button" aria-label="Close"
                        type="button"
                        onClick={() => { setShowCustomInput(false); setCustomTypeInput('') }}
                        className="p-1 rounded hover:bg-gray-100 shrink-0"
                      >
                <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>
                {form.company_type ? `${form.company_type} Name` : 'Location Name'} *
              </Label>
              <Input value={form.name} onChange={set('name')} placeholder="e.g. Mumbai Main Branch" required className="mt-1" />
            </div>
            <div>
              <Label>Code / Branch ID</Label>
              <Input value={form.code} onChange={set('code')} placeholder="e.g. MUM-01" className="mt-1" />
            </div>
            <div>
              <Label className="mb-1 block">Phone</Label>
              <PhoneInput
                value={form.phone}
                onChange={v => setForm(f => ({ ...f, phone: v }))}
              />
            </div>
            <div className="col-span-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={set('email')} placeholder="store@example.com" className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <textarea
                value={form.description}
                onChange={set('description')}
                placeholder="Brief description of this location..."
                rows={2}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Address</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Input value={form.street} onChange={set('street')} placeholder="Street / Area" />
              </div>
              <Input value={form.city} onChange={set('city')} placeholder="City" />
              <Input value={form.state} onChange={set('state')} placeholder="State" />
              <Input value={form.pincode} onChange={set('pincode')} placeholder="Pincode" />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))}
              className="w-4 h-4 accent-indigo-600"
            />
            <span className="text-sm">Set as default</span>
          </label>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="cancel" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : store ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── TransferModal ──────────────────────────────────────────────────────────

function TransferModal({
  stores,
  products,
  onClose,
}: {
  stores: StoreRecord[]
  products: { id: string; name: string; sku?: string }[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [fromStore, setFromStore] = useState('')
  const [toStore, setToStore] = useState('')
  const [product, setProduct] = useState('')
  const [qty, setQty] = useState(1)
  const [reason, setReason] = useState('')

  const transfer = useMutation({
    mutationFn: () => vendorApi.transferStock({
      from_store_id: fromStore, to_store_id: toStore,
      product_id: product, quantity: qty,
      reason: reason || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [...vendorKeys.all, 'stores'] }); onClose() },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2"><ArrowLeftRight className="w-5 h-5" />Stock Transfer</h2>
          <button type="button" aria-label="Close" onClick={onClose}>
                <X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {transfer.error && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">
              {(transfer.error as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? 'Transfer failed'}
            </div>
          )}
          <div>
            <Label>From Store</Label>
            <select value={fromStore} onChange={e => setFromStore(e.target.value)}
              className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">Select source store…</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <Label>To Store</Label>
            <select value={toStore} onChange={e => setToStore(e.target.value)}
              className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">Select destination store…</option>
              {stores.filter(s => s.id !== fromStore).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Product</Label>
            <select value={product} onChange={e => setProduct(e.target.value)}
              className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">Select product…</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>)}
            </select>
          </div>
          <div>
            <Label>Quantity</Label>
            <Input type="number" min={1} value={qty} onChange={e => setQty(Number(e.target.value))} className="mt-1" />
          </div>
          <div>
            <Label>Reason (optional)</Label>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Restock from main warehouse" className="mt-1" />
          </div>
          <div className="flex gap-2">
            <Button variant="cancel" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button
              className="flex-1"
              disabled={!fromStore || !toStore || !product || qty < 1 || transfer.isPending}
              onClick={() => transfer.mutate()}
            >
              {transfer.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Transfer Stock
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── StoreCard ──────────────────────────────────────────────────────────────

function StoreCard({
  store,
  vendorSlug,
  vendorVerificationLevel: vendorLevel,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onSetDefault,
  onView,
}: {
  store: StoreRecord
  vendorSlug?: string
  vendorVerificationLevel: VerificationLevel
  isSelected: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  onSetDefault: () => void
  onView: () => void
}) {
  const link = storeLink(vendorSlug, store)

  return (
    <Card className={cn(
      'relative border-2 transition-all hover:shadow-md',
      isSelected ? 'border-primary shadow-md shadow-primary/25' : store.is_default ? 'border-primary/30' : 'border-transparent',
    )}>
      {/* Selected badge */}
      {isSelected && (
        <span className="absolute top-3 right-3 bg-primary text-primary-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 z-10">
          <Check className="w-2.5 h-2.5" /> In use
        </span>
      )}
      {!isSelected && store.is_default && (
        <span className="absolute top-3 right-3 bg-indigo-100 text-indigo-700 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
          <Star className="w-3 h-3" /> Default
        </span>
      )}

      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          {(() => {
            const companyType = (store.settings as Record<string, string> | undefined)?.company_type
            const preset = COMPANY_TYPES.find(t => t.value === companyType)
            const Icon = preset?.icon ?? Store
            return (
              <div className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                isSelected ? 'bg-primary/10' : store.is_active ? 'bg-indigo-100' : 'bg-gray-100',
              )}>
                <Icon className={cn('w-5 h-5', isSelected ? 'text-primary' : store.is_active ? 'text-indigo-600' : 'text-gray-400')} />
              </div>
            )
          })()}
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base truncate">{store.name}</CardTitle>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {(() => {
                const companyType = (store.settings as Record<string, string> | undefined)?.company_type
                return companyType ? (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    {companyType}
                  </span>
                ) : null
              })()}
              <IdChip label="" code={formatStoreCode(store)} fullValue={store.id} className="!py-0 !px-1.5" />
              <VerifiedBadge level={vendorLevel} size="xs" />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {store.description && <p className="text-sm text-gray-600 line-clamp-2">{store.description}</p>}

        <div className="space-y-1">
          {store.address?.city && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">
                {[store.address.street, store.address.city, store.address.state].filter(Boolean).join(', ')}
              </span>
            </div>
          )}
          {store.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="w-3.5 h-3.5 flex-shrink-0" />{store.phone}
            </div>
          )}
          {store.email && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{store.email}</span>
            </div>
          )}
        </div>

        {/* Store link row */}
        <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5">
          <Link2 className="w-3 h-3 text-gray-400 shrink-0" />
          <span className="text-[11px] text-blue-600 truncate flex-1 font-mono">{link}</span>
          <button
            type="button"
            onClick={() => copyText(link, 'Store link copied!')}
            className="p-0.5 rounded hover:bg-gray-200 transition-colors shrink-0"
            title="Copy link"
          >
            <Copy className="w-3 h-3 text-gray-500" />
          </button>
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="p-0.5 rounded hover:bg-gray-200 transition-colors shrink-0"
            title="Open store link"
          >
            <ExternalLink className="w-3 h-3 text-gray-500" />
          </a>
        </div>

        <div className="flex items-center gap-3 pt-0.5">
          <span className="flex items-center gap-1 text-sm text-gray-500">
            <Package className="w-3.5 h-3.5" />{store.inventory_count ?? 0} SKUs
          </span>
          <span className="flex items-center gap-1 text-sm text-gray-500">
            <Users className="w-3.5 h-3.5" />{store.staff_count ?? 0} staff
          </span>
          <span className={cn('ml-auto text-xs px-2 py-0.5 rounded-full font-medium', store.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
            {store.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 pt-2 border-t">
          {/* Select / Deselect */}
          <Button
            size="sm"
            variant={isSelected ? 'default' : 'outline'}
            className={cn('h-8 text-xs flex-1', isSelected && 'bg-primary hover:bg-primary/90 text-white')}
            onClick={onSelect}
          >
            {isSelected ? <><Check className="w-3 h-3 mr-1" />Clear filter</> : 'Use in app'}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs px-2" onClick={onView}>
            View <ChevronRight className="w-3 h-3 ml-0.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={onEdit} title="Edit">
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          {!store.is_default && (
            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={onSetDefault} title="Use as default branch for new sessions">
              <StarOff className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-8 px-2 text-red-500 hover:bg-red-50 hover:text-red-600" onClick={onDelete} title={store.is_default ? 'Default branch cannot be deleted' : 'Delete company code'} disabled={store.is_default}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── StoreDetail ────────────────────────────────────────────────────────────

function StoreDetail({ store, onBack }: { store: StoreRecord; onBack: () => void }) {
  const { vendor } = useVendorStore()
  const qc = useQueryClient()
  const [invSearch, setInvSearch] = useState('')
  const [assignStaffId, setAssignStaffId] = useState('')

  const { data: invData, isLoading: invLoading } = useQuery({
    queryKey: ['store-inventory', store.id, invSearch],
    queryFn: () => vendorApi.getStoreInventory(store.id, { search: invSearch || undefined }),
  })

  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ['store-staff', store.id],
    queryFn: () => vendorApi.getStoreStaff(store.id),
  })

  const { data: allTeam } = useQuery({
    queryKey: ['team'],
    queryFn: () => vendorApi.listTeamMembers(),
  })

  const assignMutation = useMutation({
    mutationFn: () => vendorApi.assignStaffStore({ staff_id: assignStaffId, store_id: store.id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['store-staff'] }); setAssignStaffId('') },
  })

  const unassignMutation = useMutation({
    mutationFn: (staffId: string) => vendorApi.assignStaffStore({ staff_id: staffId, store_id: null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store-staff'] }),
  })

  const unassignedMembers = allTeam?.items?.filter(
    (m: { id: string }) => !staffData?.staff?.some((s: { id: string }) => s.id === m.id)
  ) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>← Back to Company Codes</Button>
        <h2 className="text-xl font-semibold">{store.name}</h2>
        {store.is_default && (
          <span className="bg-indigo-100 text-indigo-700 text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
            <Star className="w-3 h-3" /> Default
          </span>
        )}
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', store.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
          {store.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'SKUs in Stock', value: store.inventory_count ?? 0, icon: Package, color: 'text-indigo-600 bg-indigo-50' },
          { label: 'Staff Members', value: store.staff_count ?? 0, icon: Users, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'City', value: store.address?.city || '—', icon: MapPin, color: 'text-amber-600 bg-amber-50' },
          { label: 'Phone', value: store.phone || '—', icon: Phone, color: 'text-primary bg-accent' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', color)}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="font-semibold text-sm">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Company code + storefront / HR links (not in sidebar — lives on store detail) */}
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Company code</p>
          <IdChip label="" code={formatStoreCode(store)} fullValue={store.id} className="w-fit" />
        </div>
        {vendor?.slug ? (
          <div className="px-4 py-3">
            <VendorStorefrontLinksCard
              vendorSlug={vendor.slug}
              outletCode={store.code}
              hideOutletRow
              embedded
            />
          </div>
        ) : (
          <div className="px-4 py-3 text-xs text-muted-foreground">Vendor slug unavailable — refresh or re-open this page.</div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Inventory */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Package className="w-4 h-4" />Inventory</CardTitle>
              <Input
                value={invSearch}
                onChange={e => setInvSearch(e.target.value)}
                placeholder="Search products…"
                className="w-44 h-7 text-xs"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {invLoading ? (
              <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : !invData?.items?.length ? (
              <div className="text-center py-10 text-gray-400 text-sm">No inventory records yet</div>
            ) : (
              <div className="divide-y max-h-72 overflow-y-auto">
                {invData.items.map(item => (
                  <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.product_name}</p>
                      {item.product_sku && <p className="text-xs text-gray-400 font-mono">{item.product_sku}</p>}
                    </div>
                    <div className="text-right ml-3">
                      <p className={cn('text-sm font-semibold', item.quantity <= item.low_stock_threshold ? 'text-red-600' : 'text-gray-900')}>
                        {item.quantity}
                      </p>
                      {item.quantity <= item.low_stock_threshold && (
                        <p className="text-[10px] text-red-500">Low stock</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Staff */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" />Staff at this Store</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Assign */}
            <div className="flex gap-2 mb-3">
              <select
                value={assignStaffId}
                onChange={e => setAssignStaffId(e.target.value)}
                className="flex-1 text-sm border rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Assign team member…</option>
                {unassignedMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.user?.full_name ?? m.id}</option>
                ))}
              </select>
              <Button
                size="sm"
                disabled={!assignStaffId || assignMutation.isPending}
                onClick={() => assignMutation.mutate()}
              >
                {assignMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Assign'}
              </Button>
            </div>

            {staffLoading ? (
              <div className="flex items-center justify-center h-24"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : !staffData?.staff?.length ? (
              <p className="text-sm text-gray-400 text-center py-6">No staff assigned yet</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {staffData.staff.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{m.name ?? '—'}</p>
                      <p className="text-xs text-gray-500">{m.email} · <span className="capitalize">{m.role}</span></p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-red-500 hover:bg-red-50"
                      onClick={() => unassignMutation.mutate(m.id)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function StoresPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { vendor, selectedStore, setSelectedStore } = useVendorStore()
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editingStore, setEditingStore] = useState<StoreRecord | null>(null)
  const [viewingStore, setViewingStore] = useState<StoreRecord | null>(null)
  const [showTransfer, setShowTransfer] = useState(false)
  const [listSearch, setListSearch] = useState('')

  const { data, isLoading } = useStores()

  const { data: productsData } = useQuery({
    queryKey: ['products', { size: 200 }],
    queryFn: () => vendorApi.listProducts({ size: 200 }),
  })

  const createMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => vendorApi.createStore(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [...vendorKeys.all, 'stores'] }); setModal(null) },
  })

  const updateMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => vendorApi.updateStore(editingStore!.id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [...vendorKeys.all, 'stores'] }); setModal(null); setEditingStore(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => vendorApi.deleteStore(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...vendorKeys.all, 'stores'] }),
  })

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => vendorApi.updateStore(id, { is_default: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...vendorKeys.all, 'stores'] }),
  })

  const stores = data?.stores ?? []
  const products = productsData?.items ?? []
  const defaultCountry = vendor?.country || 'India'

  const searchNorm = listSearch.trim().toLowerCase()
  const filteredStores = searchNorm
    ? stores.filter((s) => {
        const hay = [
          s.name,
          s.code,
          s.description,
          s.phone,
          s.email,
          s.address?.city,
          s.address?.state,
          (s.settings as Record<string, string> | undefined)?.company_type,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return hay.includes(searchNorm)
      })
    : stores

  function handleSelectStore(store: StoreRecord) {
    if (selectedStore?.id === store.id) {
      setSelectedStore(null)
      toast.success('Viewing all stores')
    } else {
      setSelectedStore({ id: store.id, name: store.name, code: store.code, description: store.description })
      toast.success(`Switched to ${store.name}`)
    }
  }

  function copyAllLinks() {
    const lines = stores.map(s => `${s.name}: ${storeLink(vendor?.slug, s)}`).join('\n')
    copyText(lines, `${stores.length} store links copied!`)
  }

  if (viewingStore) {
    const fresh = stores.find(s => s.id === viewingStore.id) ?? viewingStore
    return <StoreDetail store={fresh} onBack={() => setViewingStore(null)} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary mb-2 transition-colors group"
          >
            <ChevronRight className="w-4 h-4 rotate-180 group-hover:-translate-x-0.5 transition-transform" />
            Back to Settings
          </button>
          <h1 className="text-2xl font-bold text-foreground">Company Codes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Branches and locations for inventory, staff, and storefront links. &ldquo;Use in app&rdquo; filters the dashboard; the default star marks your primary branch.
            {selectedStore && (
              <span className="ml-2 inline-flex items-center gap-1 text-primary font-medium">
                <Check className="w-3 h-3" /> Filter: {selectedStore.name}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {stores.length >= 2 && (
            <Button variant="outline" onClick={copyAllLinks} title="Copy all store links to clipboard">
              <Link2 className="w-4 h-4 mr-2" />Copy All Links
            </Button>
          )}
          {stores.length >= 2 && (
            <Button variant="outline" onClick={() => setShowTransfer(true)}>
              <ArrowLeftRight className="w-4 h-4 mr-2" />Transfer Stock
            </Button>
          )}
          <Button onClick={() => { setEditingStore(null); setModal('create') }}>
            <Plus className="w-4 h-4 mr-2" />New company code
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      {stores.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-indigo-600">{stores.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Company codes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">{stores.filter(s => s.is_active).length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Active</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{stores.reduce((a, s) => a + (s.staff_count ?? 0), 0)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total Staff Assigned</p>
            </CardContent>
          </Card>
        </div>
      )}

      {stores.length > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            placeholder="Search by name, code, city, type…"
            className="pl-9"
          />
        </div>
      )}

      {/* Company code grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
        </div>
      ) : stores.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-xl text-center">
          <Store className="w-12 h-12 text-gray-300 mb-3" />
          <p className="font-medium text-gray-600">No company codes yet</p>
          <p className="text-sm text-gray-400 mt-1">Add your first branch or location to get started</p>
          <Button className="mt-4" onClick={() => { setEditingStore(null); setModal('create') }}>
            <Plus className="w-4 h-4 mr-2" />Add first company code
          </Button>
        </div>
      ) : filteredStores.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 border border-dashed rounded-xl text-center text-muted-foreground">
          <p className="font-medium">No matches for &ldquo;{listSearch.trim()}&rdquo;</p>
          <Button variant="link" className="mt-2" onClick={() => setListSearch('')}>Clear search</Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStores.map(store => (
            <StoreCard
              key={store.id}
              store={store}
              vendorSlug={vendor?.slug}
              vendorVerificationLevel={deriveVendorLevel(vendor)}
              isSelected={selectedStore?.id === store.id}
              onSelect={() => handleSelectStore(store)}
              onEdit={() => { setEditingStore(store); setModal('edit') }}
              onDelete={() => {
                if (store.is_default) {
                  toast.error('Set another branch as default before deleting this one.')
                  return
                }
                const msg = `Delete company code "${store.name}"? This cannot be undone. Inventory and staff links for this branch will be removed.`
                if (window.confirm(msg)) deleteMutation.mutate(store.id)
              }}
              onSetDefault={() => {
                if (window.confirm(`Use "${store.name}" as the default branch?`)) setDefaultMutation.mutate(store.id)
              }}
              onView={() => setViewingStore(store)}
            />
          ))}
          {!searchNorm && (
          <button
            type="button"
            onClick={() => { setEditingStore(null); setModal('create') }}
            className="border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center h-52 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors text-gray-400 hover:text-indigo-500"
          >
            <Plus className="w-8 h-8 mb-2" />
            <span className="text-sm font-medium">Add company code</span>
          </button>
          )}
        </div>
      )}

      {/* Create / Edit modal */}
      {modal && (
        <StoreModal
          store={modal === 'edit' ? editingStore : null}
          onClose={() => { setModal(null); setEditingStore(null) }}
          onSave={d => modal === 'edit' ? updateMutation.mutate(d) : createMutation.mutate(d)}
          saving={createMutation.isPending || updateMutation.isPending}
          defaultCountry={defaultCountry}
        />
      )}

      {/* Transfer modal */}
      {showTransfer && (
        <TransferModal
          stores={stores}
          products={products.map((p: { id: string; name: string; sku?: string }) => ({ id: p.id, name: p.name, sku: p.sku }))}
          onClose={() => setShowTransfer(false)}
        />
      )}

      {/* Error toast area */}
      {(createMutation.error || updateMutation.error || deleteMutation.error) && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-sm z-50">
          <X className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">
            {((createMutation.error || updateMutation.error || deleteMutation.error) as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'An error occurred'}
          </span>
        </div>
      )}
    </div>
  )
}
