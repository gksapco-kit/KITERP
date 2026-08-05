import type { Vendor } from '@/types'
import { readHrModuleSettings, type HrScope } from '@/lib/hrModuleSettings'

export type ModuleFormState = {
  offeringType: 'products' | 'services' | 'both'
  financeEnabled: boolean
  financeMode: string
  hrEnabled: boolean
  hrScope: HrScope
  hrBusinessUnitIds: string[]
  crmEnabled: boolean
  commissionEnabled: boolean
  controllingEnabled: boolean
  productionEnabled: boolean
  pharmaEnabled: boolean
  posEnabled: boolean
  restaurantEnabled: boolean
  bookingsEnabled: boolean
  subscriptionsEnabled: boolean
  projectsEnabled: boolean
  rentalsEnabled: boolean
}

function normalizeRoleKey(role: string | undefined | null): string {
  return (role ?? '').trim().toLowerCase().replace(/\s+/g, '_')
}

/** Turn on every module toggle; catalog becomes products & services (central HR). */
export function getAllModulesEnabledState(
  base?: Pick<ModuleFormState, 'financeMode' | 'hrBusinessUnitIds'>,
): ModuleFormState {
  return {
    offeringType: 'both',
    financeEnabled: true,
    financeMode: base?.financeMode ?? 'advanced',
    hrEnabled: true,
    hrScope: 'central',
    hrBusinessUnitIds: base?.hrBusinessUnitIds ? [...base.hrBusinessUnitIds] : [],
    crmEnabled: true,
    commissionEnabled: true,
    controllingEnabled: true,
    productionEnabled: true,
    pharmaEnabled: true,
    posEnabled: true,
    restaurantEnabled: true,
    bookingsEnabled: true,
    subscriptionsEnabled: true,
    projectsEnabled: true,
    rentalsEnabled: true,
  }
}

/** Recommended module toggles for a built-in or custom role name. */
export function getRoleModuleSettingsDefaults(role: string | undefined | null): ModuleFormState {
  const key = normalizeRoleKey(role)

  if (key === 'owner' || key === 'admin' || key === 'platform_staff' || key === 'manager') {
    return {
      offeringType: 'both',
      financeEnabled: true,
      financeMode: 'advanced',
      hrEnabled: true,
      hrScope: 'central',
      hrBusinessUnitIds: [],
      crmEnabled: true,
      commissionEnabled: true,
      controllingEnabled: true,
      productionEnabled: true,
      pharmaEnabled: true,
      posEnabled: true,
      restaurantEnabled: true,
      bookingsEnabled: true,
      subscriptionsEnabled: true,
      projectsEnabled: true,
      rentalsEnabled: true,
    }
  }

  if (key === 'sales') {
    return {
      offeringType: 'both',
      financeEnabled: false,
      financeMode: 'basic',
      hrEnabled: false,
      hrScope: 'central',
      hrBusinessUnitIds: [],
      crmEnabled: true,
      commissionEnabled: true,
      controllingEnabled: false,
      productionEnabled: true,
      pharmaEnabled: false,
      posEnabled: true,
      restaurantEnabled: true,
      bookingsEnabled: true,
      subscriptionsEnabled: true,
      projectsEnabled: true,
      rentalsEnabled: true,
    }
  }

  if (key === 'staff') {
    return {
      offeringType: 'both',
      financeEnabled: false,
      financeMode: 'basic',
      hrEnabled: false,
      hrScope: 'central',
      hrBusinessUnitIds: [],
      crmEnabled: false,
      commissionEnabled: false,
      controllingEnabled: false,
      productionEnabled: false,
      pharmaEnabled: false,
      posEnabled: false,
      restaurantEnabled: false,
      bookingsEnabled: false,
      subscriptionsEnabled: false,
      projectsEnabled: false,
      rentalsEnabled: false,
    }
  }

  return {
    offeringType: 'both',
    financeEnabled: true,
    financeMode: 'basic',
    hrEnabled: true,
    hrScope: 'central',
    hrBusinessUnitIds: [],
    crmEnabled: true,
    commissionEnabled: true,
    controllingEnabled: true,
    productionEnabled: true,
    pharmaEnabled: true,
    posEnabled: true,
    restaurantEnabled: true,
    bookingsEnabled: true,
    subscriptionsEnabled: true,
    projectsEnabled: true,
    rentalsEnabled: true,
  }
}

export function moduleFormStateFromVendor(
  vendor: Vendor | null | undefined,
): ModuleFormState {
  const s = vendor?.settings as Record<string, unknown> | undefined
  const hr = readHrModuleSettings(s)
  return {
    offeringType: (vendor?.offering_type as 'products' | 'services' | 'both') || 'both',
    financeEnabled: s?.finance_enabled !== false,
    financeMode: (s?.finance_mode as string) ?? 'advanced',
    hrEnabled: hr.hr_enabled,
    hrScope: hr.hr_scope,
    hrBusinessUnitIds: [...hr.hr_business_unit_ids],
    crmEnabled: s?.crm_enabled !== false,
    commissionEnabled: s?.commission_enabled !== false,
    controllingEnabled: s?.controlling_enabled !== false,
    productionEnabled: s?.production_enabled !== false,
    pharmaEnabled: s?.pharma_enabled !== false,
    posEnabled: s?.pos_enabled !== false,
    restaurantEnabled: s?.restaurant_enabled !== false,
    bookingsEnabled: s?.bookings_enabled !== false,
    subscriptionsEnabled: s?.subscriptions_enabled !== false,
    projectsEnabled: s?.projects_enabled !== false,
    rentalsEnabled: s?.rentals_enabled !== false,
  }
}

export function moduleFormStatesEqual(a: ModuleFormState, b: ModuleFormState): boolean {
  return (
    a.offeringType === b.offeringType &&
    a.financeEnabled === b.financeEnabled &&
    a.financeMode === b.financeMode &&
    a.hrEnabled === b.hrEnabled &&
    a.hrScope === b.hrScope &&
    a.crmEnabled === b.crmEnabled &&
    a.commissionEnabled === b.commissionEnabled &&
    a.controllingEnabled === b.controllingEnabled &&
    a.productionEnabled === b.productionEnabled &&
    a.pharmaEnabled === b.pharmaEnabled &&
    a.posEnabled === b.posEnabled &&
    a.restaurantEnabled === b.restaurantEnabled &&
    a.bookingsEnabled === b.bookingsEnabled &&
    a.subscriptionsEnabled === b.subscriptionsEnabled &&
    a.projectsEnabled === b.projectsEnabled &&
    a.rentalsEnabled === b.rentalsEnabled &&
    a.hrBusinessUnitIds.length === b.hrBusinessUnitIds.length &&
    a.hrBusinessUnitIds.every((id, i) => id === b.hrBusinessUnitIds[i])
  )
}

export function buildModuleSettingsPayload(
  state: ModuleFormState,
  existingSettings: Record<string, unknown>,
  includeOfferingType: boolean,
): Partial<Vendor> {
  const payload: Partial<Vendor> = {
    settings: {
      ...existingSettings,
      finance_enabled: state.financeEnabled,
      finance_mode: state.financeMode,
      hr_enabled: state.hrEnabled,
      hr_scope: state.hrScope,
      hr_business_unit_ids: state.hrScope === 'per_business_unit' ? state.hrBusinessUnitIds : [],
      crm_enabled: state.crmEnabled,
      commission_enabled: state.commissionEnabled,
      controlling_enabled: state.controllingEnabled,
      production_enabled: state.productionEnabled,
      pharma_enabled: state.pharmaEnabled,
      pos_enabled: state.posEnabled,
      restaurant_enabled: state.restaurantEnabled,
      bookings_enabled: state.bookingsEnabled,
      subscriptions_enabled: state.subscriptionsEnabled,
      projects_enabled: state.projectsEnabled,
      rentals_enabled: state.rentalsEnabled,
    },
  }
  if (includeOfferingType) {
    payload.offering_type = state.offeringType
  }
  return payload
}
