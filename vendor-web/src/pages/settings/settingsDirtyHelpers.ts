import type { StoreRecord } from '@/api/vendor'
import type { Vendor } from '@/types'
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
): { business_name: string; display_name: string; description: string; offering_type: string } {
  const settings = (store.settings ?? {}) as Record<string, unknown>
  const settingStr = (key: string) => {
    const v = settings[key]
    return typeof v === 'string' && v.trim() ? v.trim() : ''
  }
  return {
    business_name: store.name || '',
    display_name: settingStr('display_name') || store.name || '',
    description: store.description || '',
    offering_type: settingStr('offering_type') || vendor?.offering_type || 'both',
  }
}

export function isProfileSectionDirty(
  form: { business_name: string; display_name: string; description: string; offering_type: string },
  vendor: Vendor | null,
  activeStore?: StoreRecord,
  unitProfileEditable?: boolean,
): boolean {
  if (!vendor) return false
  if (unitProfileEditable && activeStore) {
    const saved = profileFormFromStore(activeStore, vendor)
    return (
      normStr(form.business_name) !== normStr(saved.business_name) ||
      normStr(form.display_name) !== normStr(saved.display_name) ||
      normStr(form.description) !== normStr(saved.description) ||
      (form.offering_type || 'both') !== (saved.offering_type || 'both')
    )
  }
  return (
    normStr(form.business_name) !== normStr(vendor.business_name) ||
    normStr(form.display_name) !== normStr(vendor.display_name) ||
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
  hqForm: { street_address: string; city: string; state: string; postal_code: string },
  unitForm: { street: string; city: string; state: string; pincode: string },
  vendor: Vendor | null,
  activeStore: StoreRecord | undefined,
  hqEditable: boolean,
  unitEditable: boolean,
): boolean {
  let dirty = false
  if (hqEditable && vendor) {
    dirty =
      dirty ||
      normStr(hqForm.street_address) !== normStr(vendor.street_address) ||
      normStr(hqForm.city) !== normStr(vendor.city) ||
      normStr(hqForm.state) !== normStr(vendor.state) ||
      normStr(hqForm.postal_code) !== normStr(vendor.postal_code)
  }
  if (unitEditable && activeStore) {
    const addr = activeStore.address
    dirty =
      dirty ||
      normStr(unitForm.street) !== normStr(addr?.street) ||
      normStr(unitForm.city) !== normStr(addr?.city) ||
      normStr(unitForm.state) !== normStr(addr?.state) ||
      normStr(unitForm.pincode) !== normStr(addr?.pincode)
  }
  return dirty
}

export function isTaxSectionDirty(
  form: { is_gst_registered: boolean; gstin: string; pan_number: string; default_tax_rate: string },
  vendor: Vendor | null,
): boolean {
  if (!vendor) return false
  const savedRate = vendor.default_tax_rate != null ? String(vendor.default_tax_rate) : ''
  return (
    form.is_gst_registered !== (vendor.is_gst_registered ?? false) ||
    normStr(form.gstin) !== normStr(vendor.gstin) ||
    normStr(form.pan_number) !== normStr(vendor.pan_number) ||
    normStr(form.default_tax_rate) !== normStr(savedRate)
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
