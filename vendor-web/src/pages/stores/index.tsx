import { useState, useRef, useEffect } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useStores, useBranches, vendorKeys } from '@/hooks/useVendor'
import { vendorApi } from '@/api/vendor'
import type { StoreRecord } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, selectOptionsWithBlank, type SelectOption } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  TAX_COUNTRIES,
  buildTaxRateSelectOptions,
  defaultRateForCountry,
  getTaxCountry,
  isStandardTaxRate,
  mergeCustomTaxRate,
  parseCustomTaxRates,
  resolveVendorTaxCountryCode,
} from '@/lib/taxCountries'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { Card, CardContent } from '@/components/ui/card'
import { AddressCard, AddressFields } from '@/components/common/AddressFields'
import { AiDescriptionTextarea } from '@/components/common/AiDescriptionTextarea'
import {
  Plus, Store,
  Edit2, Trash2, Star, StarOff, X, Loader2,
  ChevronRight, ArrowLeftRight, Copy, ExternalLink, Check, ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useVendorStore } from '@/stores/vendorStore'
import { toast } from 'sonner'
import { askConfirm } from '@/components/common/ConfirmProvider'
import {
  IdChip, VerifiedBadge, formatStoreCode,
  vendorVerificationLevel as deriveVendorLevel,
  type VerificationLevel,
} from '@/lib/verification'
import { getCustomerStorefrontBaseUrl } from '@/lib/storefrontPreviewUrl'
import { buildCustomerStoreLink } from '@/lib/liveStorefrontUrl'
import BusinessUnitDetailPanel from '@/components/business-units/BusinessUnitDetailPanel'
import { StoresListToolbar } from '@/components/business-units/StoresListToolbar'
import { BusinessUnitVisualHero } from '@/components/business-units/BusinessUnitVisualHero'
import { getBusinessUnitVisual } from '@/lib/businessUnitVisuals'
import { resolveBrandingMode } from '@/lib/brandingMode'
import { CompanyTypeDropdown } from '@/components/common/CompanyTypeDropdown'
import { COMPANY_TYPES } from '@/data/companyTypes'
import { BRANCH_CODE_LABEL, BUSINESS_UNIT_CODE_LABEL } from '@/lib/businessUnitLabels'
import { branchCodePrefix, nextBranchAutoCode } from '@/lib/branchStoreCodes'
import {
  profileCompanyTypeFromVendor,
  profileFormFromStore,
} from '@/pages/settings/settingsDirtyHelpers'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1').replace('/api/v1', '')

function storeLink(vendorSlug: string | undefined, store: StoreRecord) {
  const key = store.code || store.id
  return buildCustomerStoreLink(vendorSlug, key) ?? (vendorSlug ? getCustomerStorefrontBaseUrl(vendorSlug) : API_BASE)
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
  gstin: string
  tax_enabled: boolean
  tax_country_code: string
  default_tax_rate: string
  custom_tax_rates: { rate: string; label: string }[]
  pan_number: string
  street: string
  city: string
  state: string
  pincode: string
  country: string
  is_default: boolean
  company_type: string
}

const EMPTY_FORM: StoreFormData = {
  name: '', code: '', description: '', phone: '', email: '', gstin: '',
  tax_enabled: true, tax_country_code: 'IN', default_tax_rate: '18', custom_tax_rates: [], pan_number: '',
  street: '', city: '', state: '', pincode: '', country: 'India', is_default: false,
  company_type: '',
}

function storeSettingsStr(store: StoreRecord | null | undefined, key: string): string {
  const raw = (store?.settings as Record<string, unknown> | undefined)?.[key]
  return typeof raw === 'string' ? raw : typeof raw === 'number' ? String(raw) : ''
}

function branchGstinFromStore(store: StoreRecord): string {
  return storeSettingsStr(store, 'gstin') || storeSettingsStr(store, 'tax_registration_id')
}

function taxFieldsFromStore(
  store: StoreRecord | undefined,
  vendorTaxCountry: string,
): Pick<
  StoreFormData,
  'gstin' | 'tax_enabled' | 'tax_country_code' | 'default_tax_rate' | 'custom_tax_rates' | 'pan_number'
> {
  const code =
    storeSettingsStr(store, 'tax_country_code').toUpperCase() || vendorTaxCountry || 'IN'
  const cfg = getTaxCountry(code)
  const settings = (store?.settings ?? {}) as Record<string, unknown>
  const savedRate = storeSettingsStr(store, 'default_tax_rate')
  const rateNum = savedRate ? Number(savedRate) : NaN
  const default_tax_rate =
    savedRate && !Number.isNaN(rateNum) && rateNum !== 0
      ? savedRate
      : String(defaultRateForCountry(cfg))
  let customs = parseCustomTaxRates(settings.custom_tax_rates)
  if (Number.isFinite(rateNum) && rateNum !== 0 && !isStandardTaxRate(cfg, rateNum)) {
    customs = mergeCustomTaxRate(customs, rateNum)
  }
  const taxEnabled =
    store && 'tax_enabled' in settings
      ? settings.tax_enabled !== false
      : true
  return {
    gstin: store ? branchGstinFromStore(store) : '',
    tax_enabled: taxEnabled,
    tax_country_code: code,
    default_tax_rate,
    custom_tax_rates: customs.map((r) => ({ rate: String(r.rate), label: r.label })),
    pan_number: storeSettingsStr(store, 'pan_number'),
  }
}

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
  parentBu = null,
}: {
  store?: StoreRecord | null
  existingStores?: StoreRecord[]
  onClose: () => void
  onSave: (data: Record<string, unknown>) => void
  saving: boolean
  defaultCountry?: string
  /** When set, this modal creates/edits a Branch under this Business Unit instead of a root BU. */
  parentBu?: StoreRecord | null
}) {
  useEscapeToClose(onClose)

  const vendor = useVendorStore((s) => s.vendor)
  const vendorTaxCountry = resolveVendorTaxCountryCode(vendor?.settings, vendor?.country)

  const autoCode = store
    ? (store.code ?? '')
    : parentBu
      ? nextBranchAutoCode(parentBu, existingStores)
      : nextAutoCode(existingStores)
  const [gstinError, setGstinError] = useState<string | null>(null)
  const [addRateOpen, setAddRateOpen] = useState(false)
  const [draftRate, setDraftRate] = useState('')
  const [draftLabel, setDraftLabel] = useState('')

  const resolveCompanyType = () =>
    store
      ? profileFormFromStore(store, vendor).company_type
      : profileCompanyTypeFromVendor(vendor)

  const [form, setForm] = useState<StoreFormData>(() => {
    const company_type = resolveCompanyType()
    const tax = taxFieldsFromStore(store ?? undefined, vendorTaxCountry)
    if (store) {
      return {
        name: store.name, code: store.code ?? '', description: store.description ?? '',
        phone: store.phone ?? '', email: store.email ?? '',
        ...tax,
        street: store.address?.street ?? '', city: store.address?.city ?? '',
        state: store.address?.state ?? '', pincode: store.address?.pincode ?? '',
        country: store.address?.country || defaultCountry,
        is_default: store.is_default,
        company_type,
      }
    }
    return { ...EMPTY_FORM, ...tax, code: autoCode, company_type, country: defaultCountry }
  })

  useEffect(() => {
    const company_type = store
      ? profileFormFromStore(store, vendor).company_type
      : profileCompanyTypeFromVendor(vendor)
    const tax = taxFieldsFromStore(store ?? undefined, vendorTaxCountry)
    if (store) {
      setForm({
        name: store.name, code: store.code ?? '', description: store.description ?? '',
        phone: store.phone ?? '', email: store.email ?? '',
        ...tax,
        street: store.address?.street ?? '', city: store.address?.city ?? '',
        state: store.address?.state ?? '', pincode: store.address?.pincode ?? '',
        country: store.address?.country || defaultCountry,
        is_default: store.is_default,
        company_type,
      })
    } else {
      setForm({ ...EMPTY_FORM, ...tax, code: autoCode, company_type, country: defaultCountry })
    }
    if (company_type) {
      setForm((f) => (f.company_type.trim() ? f : { ...f, company_type }))
    }
  }, [
    store?.id,
    store?.name,
    store?.code,
    store?.description,
    store?.phone,
    store?.email,
    store?.is_default,
    store?.address?.street,
    store?.address?.city,
    store?.address?.state,
    store?.address?.pincode,
    store?.address?.country,
    (store?.settings as Record<string, unknown> | undefined)?.gstin,
    (store?.settings as Record<string, unknown> | undefined)?.tax_country_code,
    (store?.settings as Record<string, unknown> | undefined)?.tax_enabled,
    (store?.settings as Record<string, unknown> | undefined)?.is_tax_registered,
    (store?.settings as Record<string, unknown> | undefined)?.default_tax_rate,
    (store?.settings as Record<string, unknown> | undefined)?.pan_number,
    (store?.settings as Record<string, unknown> | undefined)?.company_type,
    vendorTaxCountry,
    defaultCountry,
    autoCode,
    parentBu?.id,
  ])

  useEffect(() => {
    if (!store && parentBu) {
      setForm((f) => ({ ...f, code: nextBranchAutoCode(parentBu, existingStores) }))
    }
  }, [store, parentBu?.id, parentBu?.code, existingStores.length])

  const lastSuggestedLocationNameRef = useRef<string | null>(null)

  useEffect(() => {
    if (!store) lastSuggestedLocationNameRef.current = null
  }, [store])

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
  }

  const taxCountry = getTaxCountry(form.tax_country_code)
  const regField = taxCountry.identifier_schema.registration[0]
  const entityFields = taxCountry.identifier_schema.entity
  const countryOptions: SelectOption[] = TAX_COUNTRIES.map((c) => ({
    value: c.code,
    label: `${c.name} (${c.tax_label})`,
  }))
  const parsedCustomRates = parseCustomTaxRates(form.custom_tax_rates)
  const rateOptions: SelectOption[] = buildTaxRateSelectOptions(
    taxCountry,
    parsedCustomRates,
    '__custom__',
  )
  const rateIsKnown =
    taxCountry.standard_rates.some((r) => String(r.rate) === form.default_tax_rate) ||
    parsedCustomRates.some((r) => String(r.rate) === form.default_tax_rate)

  const addCustomTaxRateRow = () => {
    setDraftRate('')
    setDraftLabel('')
    setAddRateOpen(true)
  }

  const handleDefaultRateSelect = (v: string) => {
    if (v === '__custom__') {
      addCustomTaxRateRow()
      return
    }
    setForm((f) => ({ ...f, default_tax_rate: v }))
  }

  const submitNewRate = () => {
    const trimmed = draftRate.trim()
    const n = Number(trimmed)
    if (!trimmed || !Number.isFinite(n) || n < 0 || n > 100) {
      toast.error('Enter a rate between 0 and 100')
      return
    }
    if (isStandardTaxRate(taxCountry, n)) {
      toast.error('That rate is already in the standard list — pick it from the dropdown')
      return
    }
    const label = draftLabel.trim()
    setForm((f) => {
      const withoutDup = f.custom_tax_rates.filter(
        (r) => Math.abs(Number(r.rate) - n) >= 0.0001,
      )
      return {
        ...f,
        custom_tax_rates: [...withoutDup, { rate: String(n), label }],
        default_tax_rate: String(n),
      }
    })
    setDraftRate('')
    setDraftLabel('')
    setAddRateOpen(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const gstinRaw = form.tax_enabled ? form.gstin.trim() : ''
    const gstin = regField?.uppercase ? gstinRaw.toUpperCase() : gstinRaw
    if (form.tax_enabled && regField?.regex && gstin) {
      try {
        if (!new RegExp(regField.regex).test(gstin)) {
          setGstinError(`Enter a valid ${regField.label}`)
          return
        }
      } catch {
        /* ignore */
      }
    }
    if (form.tax_enabled && regField?.required_when_registered && !gstin) {
      setGstinError(`${regField.label} is required when tax is enabled`)
      return
    }
    for (const row of form.custom_tax_rates) {
      const trimmed = row.rate.trim()
      if (!trimmed && !row.label.trim()) continue
      if (!trimmed) {
        toast.error('Enter a rate % for each additional tax row (or clear the description)')
        return
      }
      const n = Number(trimmed)
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        toast.error('Additional tax rates must be between 0 and 100')
        return
      }
    }
    setGstinError(null)
    const rateNum = form.default_tax_rate ? parseFloat(form.default_tax_rate) : null
    let customRates = parseCustomTaxRates(form.custom_tax_rates).filter(
      (r) => !isStandardTaxRate(taxCountry, r.rate),
    )
    if (rateNum != null && !Number.isNaN(rateNum) && !isStandardTaxRate(taxCountry, rateNum)) {
      customRates = mergeCustomTaxRate(customRates, rateNum)
    }
    const baseSettings = { ...((store?.settings ?? {}) as Record<string, unknown>) }
    const taxSettings = {
      tax_enabled: form.tax_enabled,
      tax_country_code: form.tax_country_code,
      is_tax_registered: form.tax_enabled,
      tax_registration_id: gstin || null,
      gstin: gstin || null,
      default_tax_rate: rateNum,
      pan_number: form.pan_number.trim() || null,
      custom_tax_rates: customRates,
    }
    onSave({
      name: form.name, code: form.code || undefined, description: form.description || undefined,
      phone: form.phone || undefined, email: form.email || undefined,
      is_default: form.is_default,
      address: {
        street: form.street || undefined, city: form.city || undefined,
        state: form.state || undefined, pincode: form.pincode || undefined,
        country: form.country || defaultCountry,
      },
      settings: parentBu
        ? { ...baseSettings, ...taxSettings }
        : { ...baseSettings, company_type: form.company_type || undefined, ...taxSettings },
      ...(parentBu && !store ? { parent_id: parentBu.id } : {}),
    })
  }

  return (
    <div data-kiterp-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4" onClick={onClose}>
      <div
        className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between px-4 py-2.5 border-b border-border">
          <h2 className="text-base font-semibold">
            {parentBu
              ? (store ? `Edit branch — ${parentBu.name}` : `New branch — ${parentBu.name}`)
              : (store ? 'Edit business unit' : 'New business unit')}
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">

            {!parentBu && (
              <CompanyTypeDropdown
                label="Business Type / Category"
                value={form.company_type}
                onChange={selectType}
                placeholder="Select business type…"
              />
            )}

            <div>
              <Label className="text-xs">
                {parentBu ? 'Branch Name' : (form.company_type ? `${form.company_type} Name` : 'Location Name')} *
              </Label>
              <Input value={form.name} onChange={set('name')} placeholder="e.g. Mumbai Main Branch" required className="mt-0.5 h-8" />
            </div>

            <div>
              <Label className="text-xs mb-0.5 block">
                {parentBu ? BRANCH_CODE_LABEL : BUSINESS_UNIT_CODE_LABEL}
              </Label>
              <div
                className="flex h-8 items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground select-none cursor-not-allowed"
                aria-readonly
                title={
                  parentBu
                    ? `Unique under ${branchCodePrefix(parentBu)} — assigned automatically`
                    : 'Assigned automatically'
                }
              >
                {form.code || '—'}
                {!store && form.code ? (
                  <span className="ml-2 text-xs text-muted-foreground/60">(auto)</span>
                ) : null}
              </div>
            </div>

            <div>
              <Label className="text-xs mb-0.5 block">Phone</Label>
              <PhoneInput
                value={form.phone}
                onChange={v => setForm(f => ({ ...f, phone: v }))}
                compact
                compactCountry
              />
            </div>

            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.email} onChange={set('email')} placeholder="store@example.com" className="mt-0.5 h-8" />
            </div>

            <div className={parentBu ? 'sm:col-span-2' : undefined}>
              <Label className="text-xs">Description</Label>
              <AiDescriptionTextarea
                value={form.description}
                onChange={(description) => setForm((f) => ({ ...f, description }))}
                placeholder="Brief description…"
                rows={2}
                maxLength={500}
                className="mt-0.5 min-h-[2.75rem] text-sm"
                context={{
                  field_kind: 'store_description',
                  name: form.name,
                  company_type: form.company_type,
                  category: form.company_type,
                  extra_context: parentBu ? { parent_bu: parentBu.name } : undefined,
                }}
              />
            </div>

            <div className="sm:col-span-2 space-y-2.5 rounded-lg border border-border/70 bg-muted/20 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.tax_enabled}
                    onChange={(e) => setForm((f) => ({ ...f, tax_enabled: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                  <span className="text-sm font-medium">Enable TAX</span>
                </label>
                <p className="text-[11px] text-muted-foreground">
                  {form.tax_enabled
                    ? 'Collect tax using the settings below.'
                    : 'Tax is off — prices are saved as entered.'}
                </p>
              </div>

              {form.tax_enabled ? (
                <>
                  <div>
                    <Label className="text-xs">Tax Country</Label>
                    <Select
                      value={form.tax_country_code}
                      onChange={(code) => {
                        const cfg = getTaxCountry(code)
                        setGstinError(null)
                        setForm((f) => ({
                          ...f,
                          tax_country_code: code,
                          gstin: '',
                          default_tax_rate: String(defaultRateForCountry(cfg)),
                          custom_tax_rates: [],
                        }))
                      }}
                      options={countryOptions}
                      searchable
                      searchPlaceholder="Search countries…"
                      placeholder="Select tax country"
                      className="mt-0.5 h-8"
                    />
                  </div>
                  {regField ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
                      <div>
                        <Label className="text-xs">{regField.label}</Label>
                        <Input
                          value={form.gstin}
                          onChange={(e) => {
                            setGstinError(null)
                            const next = regField.uppercase ? e.target.value.toUpperCase() : e.target.value
                            setForm((f) => ({ ...f, gstin: next.slice(0, regField.max_length) }))
                          }}
                          placeholder={regField.placeholder}
                          maxLength={regField.max_length}
                          className={cn(
                            'mt-0.5 h-8 font-mono tracking-wide',
                            regField.uppercase && 'uppercase',
                            gstinError && 'border-destructive',
                          )}
                        />
                        {gstinError ? <p className="mt-0.5 text-[11px] text-destructive">{gstinError}</p> : null}
                      </div>
                      <div>
                        <Label className="text-xs">Default {taxCountry.tax_label} Rate (%)</Label>
                        <Select
                          value={rateIsKnown ? form.default_tax_rate : ''}
                          onChange={handleDefaultRateSelect}
                          options={rateOptions}
                          placeholder="Select rate"
                          className="mt-0.5 h-8"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Label className="text-xs">Default {taxCountry.tax_label} Rate (%)</Label>
                      <Select
                        value={rateIsKnown ? form.default_tax_rate : ''}
                        onChange={handleDefaultRateSelect}
                        options={rateOptions}
                        placeholder="Select rate"
                        className="mt-0.5 h-8"
                      />
                    </div>
                  )}
                  {entityFields.map((field) => (
                    <div key={field.key}>
                      <Label className="text-xs">{field.label}</Label>
                      <Input
                        value={field.key === 'pan_number' ? form.pan_number : ''}
                        onChange={(e) => {
                          const next = field.uppercase ? e.target.value.toUpperCase() : e.target.value
                          if (field.key === 'pan_number') {
                            setForm((f) => ({ ...f, pan_number: next.slice(0, field.max_length) }))
                          }
                        }}
                        placeholder={field.placeholder}
                        maxLength={field.max_length}
                        className={cn('mt-0.5 h-8 font-mono', field.uppercase && 'uppercase')}
                      />
                    </div>
                  ))}
                </>
              ) : null}
            </div>

            <Dialog open={addRateOpen} onOpenChange={setAddRateOpen}>
              <DialogContent className="max-w-md sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New {taxCountry.tax_label} Rate</DialogTitle>
                  <DialogDescription>
                    Create a non-standard rate. It will appear in the default-rate dropdown after you add it.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-1">
                  <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Rate (%)</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          max={100}
                          value={draftRate}
                          onChange={(e) => setDraftRate(e.target.value)}
                          placeholder="e.g. 40"
                          className="h-9 pr-8 font-mono"
                          autoFocus
                        />
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          %
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Description</Label>
                      <Input
                        value={draftLabel}
                        onChange={(e) => setDraftLabel(e.target.value)}
                        placeholder="e.g. Luxury jewellery"
                        className="h-9"
                        maxLength={80}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            submitNewRate()
                          }
                        }}
                      />
                    </div>
                  </div>
                  {form.custom_tax_rates.length > 0 ? (
                    <div className="space-y-1.5 rounded-md border border-border/60 bg-muted/20 p-2.5">
                      <p className="text-[11px] font-medium text-muted-foreground">
                        Saved additional rates
                      </p>
                      {form.custom_tax_rates.map((row, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <span className="w-[4.5rem] shrink-0 font-mono tabular-nums">
                            {row.rate}%
                          </span>
                          <span className="min-w-0 flex-1 truncate text-muted-foreground">
                            {row.label || '—'}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 shrink-0 p-0 text-destructive"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                custom_tax_rates: f.custom_tax_rates.filter((_, i) => i !== index),
                              }))
                            }
                            aria-label={`Remove rate ${row.rate}%`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <DialogFooter className="gap-2 sm:gap-2">
                  <Button type="button" variant="outline" onClick={() => setAddRateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={submitNewRate}>
                    Add rate
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="sm:col-span-2">
              <AddressCard compact>
                <AddressFields
                  compact
                  idPrefix="store-addr"
                  values={{
                    street: form.street,
                    city: form.city,
                    state: form.state,
                    postal: form.pincode,
                    country: form.country,
                  }}
                  onChange={(patch) =>
                    setForm((f) => ({
                      ...f,
                      street: patch.street ?? f.street,
                      city: patch.city ?? f.city,
                      state: patch.state ?? f.state,
                      pincode: patch.postal ?? f.pincode,
                      country: patch.country ?? f.country,
                    }))
                  }
                />
              </AddressCard>
            </div>
          </div>

          <div className="shrink-0 flex items-center justify-between gap-3 border-t border-border px-4 py-2.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))}
                className="w-4 h-4 accent-indigo-600"
              />
              <span className="text-sm">Set as default</span>
            </label>
            <div className="flex gap-2">
              <Button type="button" variant="cancel" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : store ? 'Update' : 'Create'}
              </Button>
            </div>
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
    <div data-kiterp-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto">
      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
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
            <Select
              value={fromStore}
              onChange={setFromStore}
              options={selectOptionsWithBlank('Select source store…', stores.map(s => ({ value: s.id, label: s.name })))}
              placeholder="Select source store…"
              aria-label="From store"
              className="mt-1"
            />
          </div>
          <div>
            <Label>To Store</Label>
            <Select
              value={toStore}
              onChange={setToStore}
              options={selectOptionsWithBlank('Select destination store…', stores.filter(s => s.id !== fromStore).map(s => ({ value: s.id, label: s.name })))}
              placeholder="Select destination store…"
              aria-label="To store"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Product</Label>
            <Select
              value={product}
              onChange={setProduct}
              options={selectOptionsWithBlank('Select product…', products.map(p => ({
                value: p.id,
                label: `${p.name}${p.sku ? ` (${p.sku})` : ''}`,
              })))}
              placeholder="Select product…"
              aria-label="Product"
              className="mt-1"
            />
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
  showScopeToggle,
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
  /** Use / Clear scope control — only when the account has more than one business unit. */
  showScopeToggle: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  onSetDefault: () => void
  onView: () => void
}) {
  const { vendor } = useVendorStore()
  const unitCode = formatStoreCode(store)
  const visual = getBusinessUnitVisual(store, vendor, resolveBrandingMode(vendor?.settings))

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
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md ring-1 ring-inset ring-border/45 bg-muted">
            {visual.logoUrl ? (
              <img src={visual.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span
                className={cn(
                  'flex h-full w-full items-center justify-center bg-gradient-to-br text-white',
                  visual.gradientClass,
                )}
              >
                <visual.Icon className="h-5 w-5" strokeWidth={1.75} />
              </span>
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
          {showScopeToggle ? (
            <Button size="sm" variant={isSelected ? 'default' : 'outline'}
              className={cn('h-5 flex-1 text-[0.58rem] px-1', isSelected && 'bg-primary hover:bg-primary/90')}
              onClick={onSelect}
            >
              {isSelected ? <><Check className="mr-0.5 h-2 w-2" />Clear</> : 'Use'}
            </Button>
          ) : null}
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

// ── BranchesPanel ────────────────────────────────────────────────────────────

export function BranchesPanel({ businessUnit }: { businessUnit: StoreRecord }) {
  const qc = useQueryClient()
  const { data, isLoading } = useBranches(businessUnit.id)
  const branches = data?.branches ?? []
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editingBranch, setEditingBranch] = useState<StoreRecord | null>(null)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: vendorKeys.branches(businessUnit.id) })
    qc.invalidateQueries({ queryKey: [...vendorKeys.all, 'stores'] })
  }

  const createMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => vendorApi.createStore(d),
    onSuccess: () => { invalidate(); setModal(null) },
  })
  const updateMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => vendorApi.updateStore(editingBranch!.id, d),
    onSuccess: () => { invalidate(); setModal(null); setEditingBranch(null) },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => vendorApi.deleteStore(id),
    onSuccess: invalidate,
  })
  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => vendorApi.updateStore(id, { is_default: true }),
    onSuccess: invalidate,
  })

  return (
    <Card className="overflow-hidden shadow-none">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Store className="h-4 w-4 text-muted-foreground" /> Branches under {businessUnit.name}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Optional locations reporting to this business unit — pick one wherever this business unit is selected.
            </p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => { setEditingBranch(null); setModal('create') }}>
            <Plus className="h-3.5 w-3.5" /> Add branch
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : branches.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-4 text-center text-sm text-muted-foreground">
            No branches yet — this business unit is used directly for transactions.
          </p>
        ) : (
          <div className="overflow-hidden divide-y divide-border rounded-lg border border-border">
            {branches.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 bg-card px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  {b.is_default && <Star className="h-3.5 w-3.5 shrink-0 text-indigo-500" aria-label="Default branch" />}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{b.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {b.code || '—'}
                      {branchGstinFromStore(b) ? ` · GST ${branchGstinFromStore(b)}` : ''}
                      {!b.is_active ? ' · Inactive' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!b.is_default && (
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Set default"
                      onClick={() => setDefaultMutation.mutate(b.id)}>
                      <StarOff className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Edit"
                    onClick={() => { setEditingBranch(b); setModal('edit') }}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                    title="Delete" disabled={b.is_default}
                    onClick={async () => {
                      const msg = `Delete branch "${b.name}"? This cannot be undone.`
                      if (await askConfirm(msg)) deleteMutation.mutate(b.id)
                    }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {modal && (
          <StoreModal
            store={modal === 'edit' ? editingBranch : null}
            existingStores={branches}
            parentBu={businessUnit}
            onClose={() => { setModal(null); setEditingBranch(null) }}
            onSave={(d) => modal === 'edit' ? updateMutation.mutate(d) : createMutation.mutate(d)}
            saving={createMutation.isPending || updateMutation.isPending}
          />
        )}
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
      <BranchesPanel businessUnit={store} />
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
    // Default store first, then newest created
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
    if (aTime !== bTime) return bTime - aTime
    return (a.name ?? '').localeCompare(b.name ?? '')
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
              showScopeToggle={stores.length > 1}
              onSelect={() => handleSelectStore(store)}
              onEdit={() => { setEditingStore(store); setModal('edit') }}
              onDelete={async () => {
                if (store.is_default) {
                  toast.error('Set another branch as default before deleting this one.')
                  return
                }
                const msg = `Delete business unit "${store.name}"? This cannot be undone. Inventory and staff links for this branch will be removed.`
                if (await askConfirm(msg)) deleteMutation.mutate(store.id)
              }}
              onSetDefault={async () => {
                if (await askConfirm(`Use "${store.name}" as the default branch?`)) setDefaultMutation.mutate(store.id)
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
