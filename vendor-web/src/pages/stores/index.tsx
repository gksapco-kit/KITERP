import { useState, useRef, useEffect } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useStores, vendorKeys } from '@/hooks/useVendor'
import { vendorApi } from '@/api/vendor'
import type { StoreRecord } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { Card, CardContent } from '@/components/ui/card'
import {
  Plus, Store,
  Edit2, Trash2, Star, StarOff, X, Loader2,
  ChevronRight, ArrowLeftRight, Copy, ExternalLink, Check, ShieldCheck,
  Building2, Heart, Briefcase, Dumbbell, ShoppingBag, Hotel, UtensilsCrossed,
  BedDouble, Tag, ChevronDown, Pencil,
  ShoppingCart, Gem, Sparkles, Monitor, Shirt, Wrench,
  Coffee, Cookie, Zap, ChefHat, Code2, Warehouse, Factory, Truck,
  Stethoscope, Smile, PawPrint, Pill, FlaskConical, Scissors, Leaf,
  Camera, CalendarDays, GraduationCap, BookOpen, Landmark, Calculator,
  Scale, Car, Home, Plane, Users,
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
import BusinessUnitDetailPanel from '@/components/business-units/BusinessUnitDetailPanel'
import { StoresListToolbar } from '@/components/business-units/StoresListToolbar'
import { BusinessUnitVisualHero } from '@/components/business-units/BusinessUnitVisualHero'
import { getBusinessUnitVisual } from '@/lib/businessUnitVisuals'

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
  phone: string   // full E.164 string e.g. '+919876543210"
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

function nextAutoCode(existing: StoreRecord[]): string {
  const numeric = existing
    .map(s => parseInt(s.code ?? '', 10))
    .filter(n => !isNaN(n))
  const max = numeric.length ? Math.max(...numeric) : 999
  return String(max + 1)
}

function StoreModal({
  store,
  existingStores = [],
  onClose,
  onSave,
  saving,
  defaultCountry = 'India',
}: {
  store?: StoreRecord | null
  existingStores?: StoreRecord[]
  onClose: () => void
  onSave: (data: Record<string, unknown>) => void
  saving: boolean
  defaultCountry?: string
}) {
  useEscapeToClose(onClose)

  const existingType = (store?.settings as Record<string, string> | undefined)?.company_type ?? ''
  const isPreset = COMPANY_TYPES.some(t => t.value === existingType)

  const autoCode = store ? (store.code ?? '') : nextAutoCode(existingStores)
  const [codeEditable, setCodeEditable] = useState(false)

  const [form, setForm] = useState<StoreFormData>(() => store
    ? {
        name: store.name, code: store.code ?? '', description: store.description ?? '',
        phone: store.phone ?? '', email: store.email ?? '',
        street: store.address?.street ?? '', city: store.address?.city ?? '',
        state: store.address?.state ?? '', pincode: store.address?.pincode ?? '',
        is_default: store.is_default,
        company_type: existingType,
      }
    : { ...EMPTY_FORM, code: autoCode }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold">{store ? 'Edit business unit' : 'New business unit'}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
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
                    <p className="px-4 pt-2.5 pb-1 text-xs font-bold uppercase tracking-wider text-gray-400 bg-gray-50 sticky top-0">
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
                      <button
                        type="button"
                        aria-label="Close"
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
              <div className="flex items-center justify-between mb-1">
                <Label>Code / Branch ID</Label>
                {!store && (
                  <button
                    type="button"
                    onClick={() => {
                      setCodeEditable(v => {
                        if (v) setForm(f => ({ ...f, code: autoCode })) // reset to auto
                        return !v
                      })
                    }}
                    className="text-[11px] text-primary hover:underline"
                  >
                    {codeEditable ? 'Use auto' : 'Edit'}
                  </button>
                )}
              </div>
              {codeEditable || store ? (
                <Input value={form.code} onChange={set('code')} placeholder="e.g. MUM-01" />
              ) : (
                <div className="flex h-10 items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground select-none">
                  {form.code}
                  <span className="ml-2 text-xs text-muted-foreground/60">(auto-generated)</span>
                </div>
              )}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
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
  const { vendor } = useVendorStore()
  const unitCode = formatStoreCode(store)
  const visual = getBusinessUnitVisual(store, vendor)

  return (
    <Card
      className={cn(
        'flex flex-col overflow-hidden border shadow-sm transition-all hover:shadow-md cursor-pointer',
        isSelected ? 'border-primary ring-1 ring-primary/25' : 'border-border',
        !store.is_active && 'opacity-90',
      )}
      onClick={onView}
    >
      <BusinessUnitVisualHero store={store} variant="card" />
      <CardContent className="flex flex-col gap-1 px-1.5 pb-1.5 pt-1.5">
        {/* Row 1: icon | code+name | badges */}
        <div className="flex items-start gap-1.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md overflow-hidden border border-border bg-muted">
            {visual.logoUrl ? (
              <img src={visual.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <visual.Icon className="h-6 w-6 text-primary" strokeWidth={1.75} />
            )}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="truncate font-mono text-[0.6rem] text-muted-foreground" title={unitCode}>{unitCode}</p>
            <p className="truncate text-[0.68rem] font-semibold leading-tight text-foreground" title={store.name}>{store.name}</p>
          </div>
          <div className="flex shrink-0 flex-row items-center gap-0.5 pt-0.5">
            {isSelected && (
              <span title="In use" className="flex h-3 w-3 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-1.5 w-1.5" />
              </span>
            )}
            {store.is_default && !isSelected && (
              <span title="Default" className="flex h-3 w-3 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
                <Star className="h-1.5 w-1.5" />
              </span>
            )}
            <span title={vendorLevel} className={cn(
              'flex h-3 w-3 items-center justify-center rounded-full',
              vendorLevel === 'verified' ? 'bg-emerald-100 text-emerald-600' :
              vendorLevel === 'partial' ? 'bg-blue-100 text-blue-600' :
              'bg-muted text-muted-foreground',
            )}>
              <ShieldCheck className="h-1.5 w-1.5" />
            </span>
          </div>
        </div>

        {/* Row 2: action icons — stop propagation so card click doesn't fire */}
        <div
          className="flex items-center gap-px border-t border-border pt-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Button size="sm" variant={isSelected ? 'default' : 'outline'}
            className={cn('h-5 flex-1 text-[0.58rem] px-1', isSelected && 'bg-primary hover:bg-primary/90')}
            onClick={onSelect}
          >
            {isSelected ? <><Check className="mr-0.5 h-2 w-2" />Clear</> : 'Use'}
          </Button>
          <Button size="sm" variant="ghost" className="h-5 w-5 shrink-0 p-0" onClick={onEdit} title="Edit"><Edit2 className="h-2.5 w-2.5" /></Button>
          {!store.is_default && (
            <Button size="sm" variant="ghost" className="h-5 w-5 shrink-0 p-0" onClick={onSetDefault} title="Set default"><StarOff className="h-2.5 w-2.5" /></Button>
          )}
          <Button size="sm" variant="ghost"
            className="h-5 w-5 shrink-0 p-0 text-red-500 hover:bg-red-50 hover:text-red-600"
            onClick={onDelete} title="Delete" disabled={store.is_default}
          ><Trash2 className="h-2.5 w-2.5" /></Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── StoreDetail ────────────────────────────────────────────────────────────

function StoreDetail({ store, onBack }: { store: StoreRecord; onBack: () => void }) {
  return (
    <div className="space-y-3">
      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onBack}>
        ← Back to Business Units
      </Button>
      <BusinessUnitDetailPanel store={store} />
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

type StoresPageProps = {
  /** Render inside Settings when "All business units" is selected (no back link). */
  embeddedInSettings?: boolean
  /** Toolbar rendered in Settings header — hide the local title/actions row. */
  hideToolbar?: boolean
  listSearch?: string
  onListSearchChange?: (value: string) => void
  showTransfer?: boolean
  onShowTransferChange?: (open: boolean) => void
}

export default function StoresPage({
  embeddedInSettings = false,
  hideToolbar = false,
  listSearch: listSearchProp,
  onListSearchChange,
  showTransfer: showTransferProp,
  onShowTransferChange,
}: StoresPageProps = {}) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { vendor, selectedStore, setSelectedStore } = useVendorStore()
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editingStore, setEditingStore] = useState<StoreRecord | null>(null)
  const [viewingStore, setViewingStore] = useState<StoreRecord | null>(null)
  const [internalShowTransfer, setInternalShowTransfer] = useState(false)
  const [internalListSearch, setInternalListSearch] = useState('')
  const showTransfer = showTransferProp ?? internalShowTransfer
  const setShowTransfer = onShowTransferChange ?? setInternalShowTransfer
  const listSearch = listSearchProp ?? internalListSearch
  const setListSearch = onListSearchChange ?? setInternalListSearch

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

  const sortedStores = [...stores].sort((a, b) => {
    const aCode = parseInt(a.code ?? '', 10)
    const bCode = parseInt(b.code ?? '', 10)
    if (!isNaN(aCode) && !isNaN(bCode)) return aCode - bCode
    if (!isNaN(aCode)) return -1
    if (!isNaN(bCode)) return 1
    return (a.code ?? '').localeCompare(b.code ?? '')
  })

  const searchNorm = listSearch.trim().toLowerCase()
  const filteredStores = searchNorm
    ? sortedStores.filter((s) => {
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
    : sortedStores

  function handleSelectStore(store: StoreRecord) {
    if (selectedStore?.id === store.id) {
      setSelectedStore(null)
      toast.success('Viewing all stores')
    } else {
      setSelectedStore({ id: store.id, name: store.name, code: store.code, description: store.description })
      toast.success(`Switched to ${store.name}`)
    }
  }

  function handleViewStore(store: StoreRecord) {
    if (embeddedInSettings) {
      setViewingStore(null)
      if (selectedStore?.id !== store.id) {
        setSelectedStore({ id: store.id, name: store.name, code: store.code, description: store.description })
      }
      return
    }
    setViewingStore(store)
  }

  if (viewingStore && !embeddedInSettings) {
    const fresh = stores.find(s => s.id === viewingStore.id) ?? viewingStore
    return <StoreDetail store={fresh} onBack={() => setViewingStore(null)} />
  }

  return (
    <div className="space-y-3">
      {!hideToolbar && (
        <div className="space-y-2">
          {!embeddedInSettings && (
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="group flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
            >
              <ChevronRight className="h-3.5 w-3.5 rotate-180 transition-transform group-hover:-translate-x-0.5" />
              Back to Settings
            </button>
          )}

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h2 className="text-lg font-semibold text-foreground">Business Units</h2>
                {selectedStore && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    <Check className="h-3 w-3" />
                    {selectedStore.name}
                  </span>
                )}
              </div>
              <p className="mt-1 hidden text-xs text-muted-foreground md:block">
                Each card shows your branch banner and logo — use in app to filter the dashboard.
              </p>
            </div>

            <StoresListToolbar
              stores={stores}
              listSearch={listSearch}
              onListSearchChange={setListSearch}
              vendorSlug={vendor?.slug ?? ''}
              vendorSettings={vendor?.settings as Record<string, unknown> | undefined}
              onTransfer={() => setShowTransfer(true)}
            />
          </div>
        </div>
      )}

      {/* Business unit grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
        </div>
      ) : stores.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-xl text-center">
          <Store className="w-12 h-12 text-gray-300 mb-3" />
          <p className="font-medium text-gray-600">No business units yet</p>
          <p className="text-sm text-gray-400 mt-1">
            {embeddedInSettings
              ? 'Add business units from the Business Units page in the menu.'
              : 'Add your first branch or location to get started'}
          </p>
          {!embeddedInSettings && (
            <Button className="mt-4" onClick={() => { setEditingStore(null); setModal('create') }}>
              <Plus className="w-4 h-4 mr-2" />Add first business unit
            </Button>
          )}
        </div>
      ) : filteredStores.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 border border-dashed rounded-xl text-center text-muted-foreground">
          <p className="font-medium">No matches for &ldquo;{listSearch.trim()}&rdquo;</p>
          <Button variant="link" className="mt-2" onClick={() => setListSearch('')}>Clear search</Button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 items-start sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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
                const msg = `Delete business unit "${store.name}"? This cannot be undone. Inventory and staff links for this branch will be removed.`
                if (window.confirm(msg)) deleteMutation.mutate(store.id)
              }}
              onSetDefault={() => {
                if (window.confirm(`Use "${store.name}" as the default branch?`)) setDefaultMutation.mutate(store.id)
              }}
              onView={() => handleViewStore(store)}
            />
          ))}
          {!searchNorm && (
          <button
            type="button"
            onClick={() => { setEditingStore(null); setModal('create') }}
            className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-primary/35 bg-primary/5 py-4 text-primary transition-colors hover:border-primary/50 hover:bg-primary/10 dark:border-primary/40 dark:bg-primary/10 dark:hover:bg-primary/15"
          >
            <Plus className="h-5 w-5" />
            <span className="text-[0.65rem] font-medium">Add unit</span>
          </button>
          )}
        </div>
      )}

      {/* Create / Edit modal */}
      {modal && (
        <StoreModal
          store={modal === 'edit' ? editingStore : null}
          existingStores={stores}
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
