import type { StoreRecord } from '@/api/vendor'
import type { Vendor } from '@/types'
import {
  defaultRateForCountry,
  getTaxCountry,
  isStandardTaxRate,
  mergeCustomTaxRate,
  parseCustomTaxRates,
  resolveVendorTaxCountryCode,
} from '@/lib/taxCountries'
import { resolveStorefrontLinkMode } from '@/lib/liveStorefrontUrl'

export const SETTINGS_SECTION_KEYS = [
  'profile',
  'contact',
  'address',
  'tax',
  'hours-availability',
  'order-acceptance',
  'external-domain',
] as const

export type SettingsSectionKey = (typeof SETTINGS_SECTION_KEYS)[number]

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

type DayHours = { open: string; close: string; closed: boolean }
type SavedDayHours = { open: string; close: string; closed?: boolean }

export const HQ_ADDRESS_LABEL_KEY = 'hq_address_label'

export function hqAddressLabelFromVendor(vendor: Vendor | null | undefined): string {
  const raw = vendor?.settings?.[HQ_ADDRESS_LABEL_KEY]
  return typeof raw === 'string' ? raw : ''
}

export type UnitAddressForm = {
  label: string
  street: string
  city: string
  state: string
  country: string
  pincode: string
}

/** True when the business-unit card has no real location (country-only does not count). */
export function storeAddressIsEmpty(addr: StoreRecord['address'] | undefined): boolean {
  return !Boolean(
    addr?.street?.trim() || addr?.city?.trim() || addr?.state?.trim() || addr?.pincode?.trim(),
  )
}

/** Unit address fields, falling back to vendor HQ when the store address was never set. */
export function unitAddressFromStore(
  store: StoreRecord | undefined,
  vendor: Vendor | null,
): UnitAddressForm {
  const addr = store?.address
  if (!storeAddressIsEmpty(addr) || !vendor) {
    return {
      label: addr?.label?.trim() ?? '',
      street: addr?.street ?? '',
      city: addr?.city ?? '',
      state: addr?.state ?? '',
      country: addr?.country || 'India',
      pincode: addr?.pincode ?? '',
    }
  }
  return {
    label: addr?.label?.trim() ?? '',
    street: vendor.street_address || '',
    city: vendor.city || '',
    state: vendor.state || '',
    country: vendor.country || 'India',
    pincode: vendor.postal_code || '',
  }
}

function normStr(v: string | null | undefined): string {
  return (v ?? '').trim()
}

function arraysEqualNormalized(a: string[], b: string[]): boolean {
  const na = a.map((x) => x.trim()).filter(Boolean)
  const nb = b.map((x) => x.trim()).filter(Boolean)
  if (na.length !== nb.length) return false
  return na.every((v, i) => v === nb[i])
}

/** Compare phone lists ignoring formatting (+91 vs 91987…). */
function phonesEqualNormalized(a: string[], b: string[]): boolean {
  const norm = (phones: string[]) =>
    phones
      .map((p) => p.replace(/\D/g, ''))
      .filter(Boolean)
      .sort()
  const na = norm(a)
  const nb = norm(b)
  if (na.length !== nb.length) return false
  return na.every((v, i) => v === nb[i])
}

function hoursEqual(
  saved: Record<string, SavedDayHours> | null | undefined,
  current: Record<string, DayHours>,
  defaults: (day: string) => DayHours,
): boolean {
  for (const day of DAYS) {
    const aRaw = saved?.[day] ?? defaults(day)
    const a: DayHours = {
      open: aRaw.open,
      close: aRaw.close,
      closed: aRaw.closed ?? defaults(day).closed,
    }
    const b = current[day] ?? defaults(day)
    if (a.open !== b.open || a.close !== b.close || a.closed !== b.closed) return false
  }
  return true
}

export function supportPhonesFromStore(store: StoreRecord): string[] {
  const settings = (store.settings || {}) as Record<string, unknown>
  const extra = Array.isArray(settings.support_phones)
    ? (settings.support_phones as string[]).filter((p) => typeof p === 'string' && p.trim())
    : []
  const primary = store.phone?.trim() || ''
  if (primary) {
    return [primary, ...extra.filter((p) => p.trim() !== primary)]
  }
  return extra.length > 0 ? extra : ['']
}

export function supportEmailsFromStore(store: StoreRecord): string[] {
  const settings = (store.settings || {}) as Record<string, unknown>
  const extra = Array.isArray(settings.support_emails)
    ? (settings.support_emails as string[]).filter((e) => typeof e === 'string' && e.trim())
    : []
  const primary = store.email?.trim() || ''
  if (primary) {
    return [primary, ...extra.filter((e) => e.trim().toLowerCase() !== primary.toLowerCase())]
  }
  return extra.length > 0 ? extra : ['']
}

export function supportPhonesFromVendor(vendor: Vendor): string[] {
  const settings = (vendor.settings || {}) as Record<string, unknown>
  const extra = Array.isArray(settings.support_phones)
    ? (settings.support_phones as string[]).filter((p) => typeof p === 'string' && p.trim())
    : []
  const primary = vendor.support_phone?.trim() || ''
  if (primary) {
    return [primary, ...extra.filter((p) => p.trim() !== primary)]
  }
  return extra.length > 0 ? extra : ['']
}

export function supportEmailsFromVendor(vendor: Vendor): string[] {
  const settings = (vendor.settings || {}) as Record<string, unknown>
  const extra = Array.isArray(settings.support_emails)
    ? (settings.support_emails as string[]).filter((e) => typeof e === 'string' && e.trim())
    : []
  const primary = vendor.support_email?.trim() || ''
  if (primary) {
    return [primary, ...extra.filter((e) => e.trim().toLowerCase() !== primary.toLowerCase())]
  }
  return extra.length > 0 ? extra : ['']
}

export function profileFormFromStore(
  store: StoreRecord,
  vendor: Vendor | null,
): { business_name: string; display_name: string; description: string; offering_type: string; company_type: string } {
  const settings = (store.settings ?? {}) as Record<string, unknown>
  const settingStr = (key: string) => {
    const v = settings[key]
    return typeof v === 'string' && v.trim() ? v.trim() : ''
  }
  const companyType =
    settingStr('company_type')
    || (vendor?.business_type?.trim() && vendor.business_type.toLowerCase() !== 'individual'
      ? vendor.business_type.trim()
      : '')
  return {
    business_name: store.name || settingStr('display_name') || '',
    display_name: store.name || settingStr('display_name') || '',
    description: store.description || '',
    offering_type: settingStr('offering_type') || vendor?.offering_type || 'both',
    company_type: companyType,
  }
}

export function profileCompanyTypeFromVendor(vendor: Vendor | null): string {
  const raw = (vendor?.business_type || '').trim()
  if (!raw || raw.toLowerCase() === 'individual') return ''
  return raw
}

export function isProfileSectionDirty(
  form: { business_name: string; display_name: string; description: string; offering_type: string; company_type: string },
  vendor: Vendor | null,
  activeStore?: StoreRecord,
  unitProfileEditable?: boolean,
): boolean {
  if (!vendor) return false
  const formName = normStr(form.business_name)
  const formCategory = normStr(form.company_type)
  if (unitProfileEditable && activeStore) {
    const saved = profileFormFromStore(activeStore, vendor)
    return (
      formName !== normStr(saved.business_name) ||
      formCategory !== normStr(saved.company_type) ||
      normStr(form.description) !== normStr(saved.description) ||
      (form.offering_type || 'both') !== (saved.offering_type || 'both')
    )
  }
  const savedName = normStr(vendor.business_name) || normStr(vendor.display_name)
  return (
    formName !== savedName ||
    formCategory !== profileCompanyTypeFromVendor(vendor) ||
    normStr(form.description) !== normStr(vendor.description) ||
    (form.offering_type || 'both') !== (vendor.offering_type || 'both')
  )
}

export function isContactSectionDirty(
  supportEmails: string[],
  supportPhones: string[],
  vendor: Vendor | null,
  activeStore?: StoreRecord,
  unitContactEditable?: boolean,
): boolean {
  if (!vendor) return false
  if (unitContactEditable && activeStore) {
    return (
      !arraysEqualNormalized(supportEmails, supportEmailsFromStore(activeStore)) ||
      !phonesEqualNormalized(supportPhones, supportPhonesFromStore(activeStore))
    )
  }
  return (
    !arraysEqualNormalized(supportEmails, supportEmailsFromVendor(vendor)) ||
    !phonesEqualNormalized(supportPhones, supportPhonesFromVendor(vendor))
  )
}

export function isAddressSectionDirty(
  hqForm: { label: string; street_address: string; city: string; state: string; country: string; postal_code: string },
  unitForm: { label: string; street: string; city: string; state: string; country: string; pincode: string },
  vendor: Vendor | null,
  activeStore: StoreRecord | undefined,
  hqEditable: boolean,
  unitEditable: boolean,
): boolean {
  let dirty = false
  if (hqEditable && vendor) {
    dirty =
      dirty ||
      normStr(hqForm.label) !== normStr(hqAddressLabelFromVendor(vendor)) ||
      normStr(hqForm.street_address) !== normStr(vendor.street_address) ||
      normStr(hqForm.city) !== normStr(vendor.city) ||
      normStr(hqForm.state) !== normStr(vendor.state) ||
      normStr(hqForm.country) !== normStr(vendor.country || 'India') ||
      normStr(hqForm.postal_code) !== normStr(vendor.postal_code)
  }
  if (unitEditable && activeStore) {
    const saved = unitAddressFromStore(activeStore, vendor)
    dirty =
      dirty ||
      normStr(unitForm.label) !== normStr(saved.label) ||
      normStr(unitForm.street) !== normStr(saved.street) ||
      normStr(unitForm.city) !== normStr(saved.city) ||
      normStr(unitForm.state) !== normStr(saved.state) ||
      normStr(unitForm.country) !== normStr(saved.country) ||
      normStr(unitForm.pincode) !== normStr(saved.pincode)
  }
  return dirty
}

export type TaxSectionForm = {
  tax_country_code: string
  is_gst_registered: boolean
  gstin: string
  pan_number: string
  default_tax_rate: string
  /** Additional selectable rates with optional description. */
  custom_tax_rates: { rate: string; label: string }[]
}

function storeSettingsStr(settings: Record<string, unknown> | null | undefined, key: string): string {
  const raw = settings?.[key]
  return typeof raw === 'string' ? raw : typeof raw === 'number' ? String(raw) : ''
}

function hydrateCustomTaxRateRows(
  settings: Record<string, unknown> | null | undefined,
  countryCode: string,
  defaultTaxRate: string,
): { rate: string; label: string }[] {
  const cfg = getTaxCountry(countryCode)
  let rates = parseCustomTaxRates(settings?.custom_tax_rates)
  const defaultNum = Number(defaultTaxRate)
  if (
    Number.isFinite(defaultNum) &&
    defaultNum >= 0 &&
    defaultNum <= 100 &&
    !isStandardTaxRate(cfg, defaultNum)
  ) {
    rates = mergeCustomTaxRate(rates, defaultNum)
  }
  return rates.map((r) => ({ rate: String(r.rate), label: r.label }))
}

/** Hydrate Tax & Compliance form from a store (preferred) or vendor fallback. */
export function taxFormFromStoreOrVendor(
  store: StoreRecord | null | undefined,
  vendor: Vendor | null,
): TaxSectionForm {
  if (store) {
    const settings = (store.settings ?? {}) as Record<string, unknown>
    const code =
      storeSettingsStr(settings, 'tax_country_code').toUpperCase() ||
      resolveVendorTaxCountryCode(vendor?.settings, vendor?.country)
    const cfg = getTaxCountry(code)
    const savedRateRaw = storeSettingsStr(settings, 'default_tax_rate')
    const savedRateNum = savedRateRaw ? Number(savedRateRaw) : NaN
    const gstin =
      storeSettingsStr(settings, 'gstin') || storeSettingsStr(settings, 'tax_registration_id')
    const default_tax_rate =
      savedRateRaw && !Number.isNaN(savedRateNum) && savedRateNum !== 0
        ? savedRateRaw
        : String(defaultRateForCountry(cfg))
    return {
      tax_country_code: code,
      is_gst_registered:
        Boolean(settings.is_tax_registered) || Boolean(gstin) || Boolean(settings.is_gst_registered),
      gstin,
      pan_number: storeSettingsStr(settings, 'pan_number'),
      default_tax_rate,
      custom_tax_rates: hydrateCustomTaxRateRows(settings, code, default_tax_rate),
    }
  }

  const code = resolveVendorTaxCountryCode(vendor?.settings, vendor?.country)
  const cfg = getTaxCountry(code)
  const savedRateRaw = vendor?.default_tax_rate != null ? Number(vendor.default_tax_rate) : null
  const default_tax_rate =
    savedRateRaw != null && savedRateRaw !== 0
      ? String(savedRateRaw)
      : String(defaultRateForCountry(cfg))
  return {
    tax_country_code: code,
    is_gst_registered: vendor?.is_gst_registered ?? false,
    gstin: vendor?.gstin || '',
    pan_number: vendor?.pan_number || '',
    default_tax_rate,
    custom_tax_rates: hydrateCustomTaxRateRows(
      (vendor?.settings ?? {}) as Record<string, unknown>,
      code,
      default_tax_rate,
    ),
  }
}

function normalizedCustomRateKey(rows: { rate: string; label: string }[]): string {
  return parseCustomTaxRates(rows).map((r) => `${r.rate}:${r.label}`).join('|')
}

export function isTaxSectionDirty(
  form: TaxSectionForm,
  vendor: Vendor | null,
  opts: { unused?: boolean; store?: StoreRecord | null } = {},
): boolean {
  if (opts.unused) return false
  const saved = taxFormFromStoreOrVendor(opts.store, vendor)
  return (
    normStr(form.tax_country_code) !== normStr(saved.tax_country_code) ||
    form.is_gst_registered !== saved.is_gst_registered ||
    normStr(form.gstin) !== normStr(saved.gstin) ||
    normStr(form.pan_number) !== normStr(saved.pan_number) ||
    normStr(form.default_tax_rate) !== normStr(saved.default_tax_rate) ||
    normalizedCustomRateKey(form.custom_tax_rates) !==
      normalizedCustomRateKey(saved.custom_tax_rates)
  )
}

export function isBusinessHoursSectionDirty(
  hours: Record<string, DayHours>,
  vendor: Vendor | null,
): boolean {
  if (!vendor) return false
  return !hoursEqual(vendor.business_hours, hours, (day) => ({
    open: '09:00',
    close: '18:00',
    closed: day === 'sunday',
  }))
}

export function isOrderAcceptanceSectionDirty(
  enabled: boolean,
  sameAsOfflineHours: boolean,
  hours: Record<string, DayHours>,
  vendor: Vendor | null,
): boolean {
  if (!vendor) return false
  const savedEnabled = vendor.order_acceptance_enabled !== false
  const hasCustom =
    vendor.order_acceptance_hours != null && Object.keys(vendor.order_acceptance_hours).length > 0
  const savedSameAsOffline = !hasCustom
  if (enabled !== savedEnabled || sameAsOfflineHours !== savedSameAsOffline) return true
  if (sameAsOfflineHours) return false
  return !hoursEqual(vendor.order_acceptance_hours, hours, () => ({
    open: '00:00',
    close: '23:59',
    closed: false,
  }))
}

/** Domain scope shown in the form — follows customer storefront link mode, not the raw saved field. */
function effectiveExternalDomainScope(vendor: Vendor | null): 'all' | 'per_unit' {
  return resolveStorefrontLinkMode(vendor?.settings) === 'single' ? 'all' : 'per_unit'
}

export type ExternalDomainFormState = {
  enabled: boolean
  domainScope: 'all' | 'per_unit'
  dnsMode: 'kit_assisted' | 'self_managed'
  domainName: string
  registrar: string
  regEmail: string
  holder: string
  expiry: string
  accessStatus: string
  recoveryContact: string
  notes: string
}

/** Saved Yes/No for the external-domain toggle (respects pending/active lock). */
export function savedExternalDomainEnabled(vendor: Vendor | null): boolean {
  if (!vendor) return false
  const v = vendor as Vendor & { external_domain_enabled?: boolean; external_domain_access_status?: string }
  const status = v.external_domain_access_status ?? 'not_requested'
  return status === 'pending' || status === 'active' ? true : (v.external_domain_enabled ?? false)
}

export function isExternalDomainSectionDirty(
  state: ExternalDomainFormState,
  vendor: Vendor | null,
): boolean {
  if (!vendor) return false
  const v = vendor as Vendor & {
    external_domain_enabled?: boolean
    external_domain_scope?: string
    external_domain_dns_mode?: string
    external_domain_name?: string
    external_domain_registrar?: string
    external_domain_reg_email?: string
    external_domain_holder?: string
    external_domain_expiry?: string
    external_domain_access_status?: string
    external_domain_recovery_contact?: string
    external_domain_notes?: string
  }
  const status = v.external_domain_access_status ?? 'not_requested'
  const forcedEnabled = status === 'pending' || status === 'active' ? true : (v.external_domain_enabled ?? false)
  return (
    state.enabled !== forcedEnabled ||
    state.domainScope !== effectiveExternalDomainScope(vendor) ||
    state.dnsMode !== (v.external_domain_dns_mode === 'self_managed' ? 'self_managed' : 'kit_assisted') ||
    normStr(state.domainName) !== normStr(v.external_domain_name) ||
    normStr(state.registrar) !== normStr(v.external_domain_registrar) ||
    normStr(state.regEmail) !== normStr(v.external_domain_reg_email) ||
    normStr(state.holder) !== normStr(v.external_domain_holder) ||
    normStr(state.expiry) !== normStr(v.external_domain_expiry) ||
    state.accessStatus !== status ||
    normStr(state.recoveryContact) !== normStr(v.external_domain_recovery_contact) ||
    normStr(state.notes) !== normStr(v.external_domain_notes)
  )
}

/** Only the Yes/No preview toggle changed — no other fields edited. */
export function isExternalDomainToggleOnlyDirty(
  state: ExternalDomainFormState,
  vendor: Vendor | null,
): boolean {
  if (!vendor) return false
  const savedEnabled = savedExternalDomainEnabled(vendor)
  if (state.enabled === savedEnabled) return false
  return !isExternalDomainSectionDirty({ ...state, enabled: savedEnabled }, vendor)
}
