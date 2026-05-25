import { useState, useEffect, useRef, useMemo, useCallback, type ReactNode } from 'react'
import { useUpdateVendor, useStores } from '@/hooks/useVendor'
import { useVendorStore } from '@/stores/vendorStore'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Save, Loader2, ToggleLeft, ToggleRight, ChevronRight, RotateCcw, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { formatStoreCode } from '@/lib/verification'
import type { HrScope } from '@/lib/hrModuleSettings'
import {
  VENDOR_MODULE_TILES,
  moduleEnabledStatus,
  offeringIncludes,
  type VendorModuleId,
} from '@/lib/vendorModuleSettings'
import {
  buildModuleSettingsPayload,
  getAllModulesEnabledState,
  getRoleModuleSettingsDefaults,
  moduleFormStateFromVendor,
  moduleFormStatesEqual,
  type ModuleFormState,
} from '@/lib/vendorModuleRoleDefaults'

const OFFERING_OPTIONS = [
  { value: 'products', label: 'Products only', description: 'Sell physical or digital products.' },
  { value: 'services', label: 'Services only', description: 'Offer services, bookings, or consultations.' },
  { value: 'both', label: 'Products & services', description: 'Full catalog with both product and service tabs.' },
] as const

const FINANCE_MODE_OPTIONS = [
  {
    value: 'basic',
    label: 'Basic Finance',
    description: 'Simple income, expense, salary and transfer tracking.',
  },
  {
    value: 'advanced',
    label: 'Advanced Finance (ERP)',
    description: 'Chart of accounts, journals, AR/AP, budgets, and full reports.',
  },
]

const HR_SCOPE_OPTIONS: { value: HrScope; label: string; description: string }[] = [
  {
    value: 'central',
    label: 'Central HR',
    description: 'One HR workspace for all business units.',
  },
  {
    value: 'per_business_unit',
    label: 'Business unit specific',
    description: 'HR only on selected units (sidebar follows active unit).',
  },
]

function EnableRow({
  label,
  hint,
  enabled,
  onToggle,
}: {
  label: string
  hint: string
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-all',
        enabled ? 'border-primary bg-primary/5' : 'border-border',
      )}
    >
      <div>
        <p className="text-xs font-semibold text-foreground">{label}</p>
        <p className="text-[0.7rem] text-muted-foreground mt-px leading-snug">{hint}</p>
      </div>
      <button type="button" role="switch" aria-checked={enabled} onClick={onToggle} className="shrink-0">
        {enabled ? (
          <ToggleRight className="h-7 w-7 text-primary" />
        ) : (
          <ToggleLeft className="h-7 w-7 text-muted-foreground/50" />
        )}
      </button>
    </div>
  )
}

function RadioOptions<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; description: string }[]
}) {
  return (
    <div className="space-y-1.5">
      {options.map((opt) => (
        <label
          key={opt.value}
          className={cn(
            'flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-all',
            value === opt.value
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-muted-foreground/40',
          )}
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="w-3.5 h-3.5 shrink-0 text-primary"
          />
          <div className="min-w-0">
            <p
              className={cn(
                'text-xs font-semibold leading-tight',
                value === opt.value ? 'text-primary' : 'text-foreground',
              )}
            >
              {opt.label}
            </p>
            <p className="text-[0.7rem] text-muted-foreground mt-px leading-snug">{opt.description}</p>
          </div>
        </label>
      ))}
    </div>
  )
}

function SaveButton({ loading, disabled, form }: { loading: boolean; disabled?: boolean; form?: string }) {
  return (
    <Button type="submit" form={form} disabled={loading || disabled} className="gap-2">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
      Save module settings
    </Button>
  )
}

function applyFormState(
  state: ModuleFormState,
  setters: {
    setOfferingType: (v: ModuleFormState['offeringType']) => void
    setFinanceEnabled: (v: boolean) => void
    setFinanceMode: (v: string) => void
    setHrEnabled: (v: boolean) => void
    setHrScope: (v: HrScope) => void
    setHrBusinessUnitIds: (v: string[]) => void
    setCrmEnabled: (v: boolean) => void
    setCommissionEnabled: (v: boolean) => void
    setControllingEnabled: (v: boolean) => void
    setPosEnabled: (v: boolean) => void
    setRestaurantEnabled: (v: boolean) => void
    setBookingsEnabled: (v: boolean) => void
    setSubscriptionsEnabled: (v: boolean) => void
  },
) {
  setters.setOfferingType(state.offeringType)
  setters.setFinanceEnabled(state.financeEnabled)
  setters.setFinanceMode(state.financeMode)
  setters.setHrEnabled(state.hrEnabled)
  setters.setHrScope(state.hrScope)
  setters.setHrBusinessUnitIds([...state.hrBusinessUnitIds])
  setters.setCrmEnabled(state.crmEnabled)
  setters.setCommissionEnabled(state.commissionEnabled)
  setters.setControllingEnabled(state.controllingEnabled)
  setters.setPosEnabled(state.posEnabled)
  setters.setRestaurantEnabled(state.restaurantEnabled)
  setters.setBookingsEnabled(state.bookingsEnabled)
  setters.setSubscriptionsEnabled(state.subscriptionsEnabled)
}

export default function ModulesPage() {
  const { vendor } = useVendorStore()
  const { user } = useAuthStore()
  const updateVendor = useUpdateVendor()
  const { data: storesData } = useStores({ limit: 200 })
  const stores = storesData?.stores ?? []

  const vendorRole = user?.vendor_role
  const roleKey = vendorRole?.role ?? vendorRole?.role_name ?? 'member'
  const canManageModules =
    vendorRole?.role === 'owner' ||
    vendorRole?.role === 'admin' ||
    vendorRole?.role === 'platform_staff' ||
    vendorRole?.role_name?.toLowerCase() === 'owner' ||
    vendorRole?.role_name?.toLowerCase() === 'admin'

  const [activeId, setActiveId] = useState<VendorModuleId>('hr')
  const savingRef = useRef(false)

  const [offeringType, setOfferingType] = useState<'products' | 'services' | 'both'>('both')
  const [financeEnabled, setFinanceEnabled] = useState(true)
  const [financeMode, setFinanceMode] = useState('advanced')
  const [hrEnabled, setHrEnabled] = useState(true)
  const [hrScope, setHrScope] = useState<HrScope>('central')
  const [hrBusinessUnitIds, setHrBusinessUnitIds] = useState<string[]>([])
  const [crmEnabled, setCrmEnabled] = useState(true)
  const [commissionEnabled, setCommissionEnabled] = useState(true)
  const [controllingEnabled, setControllingEnabled] = useState(true)
  const [posEnabled, setPosEnabled] = useState(true)
  const [restaurantEnabled, setRestaurantEnabled] = useState(true)
  const [bookingsEnabled, setBookingsEnabled] = useState(true)
  const [subscriptionsEnabled, setSubscriptionsEnabled] = useState(true)

  const productsCatalog = offeringIncludes(offeringType, ['products', 'both'])
  const servicesCatalog = offeringIncludes(offeringType, ['services', 'both'])

  const formSetters = useMemo(
    () => ({
      setOfferingType,
      setFinanceEnabled,
      setFinanceMode,
      setHrEnabled,
      setHrScope,
      setHrBusinessUnitIds,
      setCrmEnabled,
      setCommissionEnabled,
      setControllingEnabled,
      setPosEnabled,
      setRestaurantEnabled,
      setBookingsEnabled,
      setSubscriptionsEnabled,
    }),
    [],
  )

  const currentFormState = useMemo(
    (): ModuleFormState => ({
      offeringType,
      financeEnabled,
      financeMode,
      hrEnabled,
      hrScope,
      hrBusinessUnitIds,
      crmEnabled,
      commissionEnabled,
      controllingEnabled,
      posEnabled,
      restaurantEnabled,
      bookingsEnabled,
      subscriptionsEnabled,
    }),
    [
      offeringType,
      financeEnabled,
      financeMode,
      hrEnabled,
      hrScope,
      hrBusinessUnitIds,
      crmEnabled,
      commissionEnabled,
      controllingEnabled,
      posEnabled,
      restaurantEnabled,
      bookingsEnabled,
      subscriptionsEnabled,
    ],
  )

  const savedFormState = useMemo(() => moduleFormStateFromVendor(vendor), [vendor])
  const roleDefaultState = useMemo(() => getRoleModuleSettingsDefaults(roleKey), [roleKey])
  const allEnabledState = useMemo(
    () => getAllModulesEnabledState({ financeMode }),
    [financeMode],
  )

  const isDirty = useMemo(
    () => !moduleFormStatesEqual(currentFormState, savedFormState),
    [currentFormState, savedFormState],
  )

  const canEnableAll = useMemo(
    () => canManageModules && !moduleFormStatesEqual(currentFormState, allEnabledState),
    [canManageModules, currentFormState, allEnabledState],
  )

  const canReset = useMemo(
    () =>
      canManageModules &&
      (isDirty || !moduleFormStatesEqual(currentFormState, roleDefaultState)),
    [canManageModules, isDirty, currentFormState, roleDefaultState],
  )

  const syncFormFromVendor = useCallback(() => {
    if (!vendor) return
    applyFormState(moduleFormStateFromVendor(vendor), formSetters)
  }, [vendor, formSetters])

  useEffect(() => {
    if (!vendor || savingRef.current) return
    syncFormFromVendor()
  }, [vendor, syncFormFromVendor])

  const activeTile = VENDOR_MODULE_TILES.find((t) => t.id === activeId)!

  const toggleBusinessUnit = (storeId: string) => {
    setHrBusinessUnitIds((prev) =>
      prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId],
    )
  }

  const validate = (): string | null => validateForState(currentFormState)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const err = validate()
    if (err) {
      toast.error(err)
      return
    }

    if (!canManageModules) {
      toast.error('Only owners and admins can change module settings.')
      return
    }

    const existingSettings = (vendor?.settings || {}) as Record<string, unknown>
    savingRef.current = true

    const payload = buildModuleSettingsPayload(
      currentFormState,
      existingSettings,
      activeId === 'catalog',
    )

    updateVendor.mutate(payload, {
      onSuccess: () => toast.success(`${activeTile.label} module settings saved`),
      onSettled: () => {
        savingRef.current = false
      },
    })
  }

  function validateForState(state: ModuleFormState): string | null {
    if (
      activeId === 'hr' &&
      state.hrEnabled &&
      state.hrScope === 'per_business_unit' &&
      state.hrBusinessUnitIds.length === 0
    ) {
      return 'Select at least one business unit for HR, or choose Central HR.'
    }
    return null
  }

  const handleEnableAll = () => {
    if (!canManageModules) {
      toast.error('Only owners and admins can change module settings.')
      return
    }
    if (!canEnableAll) return

    const err = validateForState(allEnabledState)
    if (err) {
      toast.error(err)
      return
    }

    applyFormState(allEnabledState, formSetters)

    const existingSettings = (vendor?.settings || {}) as Record<string, unknown>
    savingRef.current = true
    const payload = buildModuleSettingsPayload(allEnabledState, existingSettings, true)

    updateVendor.mutate(payload, {
      onSuccess: () => toast.success('All modules enabled'),
      onSettled: () => {
        savingRef.current = false
      },
    })
  }

  const handleReset = () => {
    if (!canManageModules) {
      toast.error('Only owners and admins can reset module settings.')
      return
    }
    if (!canReset) return

    const roleLabel = vendorRole?.role_name ?? roleKey
    if (
      !window.confirm(
        `Restore recommended module settings for the "${roleLabel}" role? This updates modules for your entire business.`,
      )
    ) {
      return
    }

    const err = validateForState(roleDefaultState)
    if (err) {
      toast.error(err)
      return
    }

    applyFormState(roleDefaultState, formSetters)

    const existingSettings = (vendor?.settings || {}) as Record<string, unknown>
    savingRef.current = true
    const payload = buildModuleSettingsPayload(roleDefaultState, existingSettings, true)

    updateVendor.mutate(payload, {
      onSuccess: () => {
        toast.success(`Module settings restored for your role (${roleLabel})`)
      },
      onSettled: () => {
        savingRef.current = false
      },
    })
  }

  const panelTitle = useMemo(() => activeTile.label, [activeTile.label])

  let panelBody: ReactNode = null

  switch (activeId) {
      case 'catalog':
        panelBody = (
          <div className="space-y-2">
            <p className="text-[0.7rem] text-muted-foreground leading-snug">
              Controls which catalog tabs appear in the sidebar and business front (Products / Services).
            </p>
            <RadioOptions
              name="offering_type"
              value={offeringType}
              onChange={setOfferingType}
              options={[...OFFERING_OPTIONS]}
            />
          </div>
        )
        break
      case 'hr':
        panelBody = (
          <div className="space-y-2.5">
            <EnableRow
              label="Enable HR"
              hint="Turn off to hide HR Management from the sidebar."
              enabled={hrEnabled}
              onToggle={() => setHrEnabled((v) => !v)}
            />
            {hrEnabled && (
              <>
                <p className="text-[0.65rem] font-medium text-muted-foreground uppercase tracking-wide">HR scope</p>
                <RadioOptions name="hr_scope" value={hrScope} onChange={setHrScope} options={HR_SCOPE_OPTIONS} />
                <p className="text-[0.65rem] text-muted-foreground leading-snug px-0.5">
                  ESS login links: Central → one URL per unit. Per-unit → only selected units. See Settings → All business units.
                </p>
                {hrScope === 'per_business_unit' && (
                  <div className="rounded-lg border border-border px-3 py-2 space-y-1.5">
                    <p className="text-xs font-semibold text-foreground">Business units with HR</p>
                    {stores.length === 0 ? (
                      <p className="text-[0.7rem] text-muted-foreground italic">Add business units first.</p>
                    ) : (
                      <ul className="space-y-1">
                        {stores.map((store) => {
                          const checked = hrBusinessUnitIds.includes(store.id)
                          return (
                            <label
                              key={store.id}
                              className={cn(
                                'flex items-center gap-2 px-2 py-1.5 rounded-md border cursor-pointer',
                                checked ? 'border-primary/50 bg-primary/5' : 'border-border',
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleBusinessUnit(store.id)}
                                className="w-3.5 h-3.5 rounded text-primary"
                              />
                              <span className="text-xs font-medium">
                                {formatStoreCode(store)} — {store.name}
                              </span>
                            </label>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )
        break
      case 'finance':
        panelBody = (
          <div className="space-y-2.5">
            <EnableRow
              label="Enable Finance"
              hint="Turn off to hide Finance Management from the sidebar."
              enabled={financeEnabled}
              onToggle={() => setFinanceEnabled((v) => !v)}
            />
            {financeEnabled && (
              <>
                <p className="text-[0.65rem] font-medium text-muted-foreground uppercase tracking-wide">Finance mode</p>
                <RadioOptions
                  name="finance_mode"
                  value={financeMode}
                  onChange={setFinanceMode}
                  options={FINANCE_MODE_OPTIONS}
                />
              </>
            )}
          </div>
        )
        break
      case 'crm':
        panelBody = (
          <EnableRow
            label="Enable CRM"
            hint="Turn off to hide CRM Management from the sidebar."
            enabled={crmEnabled}
            onToggle={() => setCrmEnabled((v) => !v)}
          />
        )
        break
      case 'commission':
        panelBody = (
          <EnableRow
            label="Enable Commission"
            hint="Turn off to hide Commission Management from the sidebar."
            enabled={commissionEnabled}
            onToggle={() => setCommissionEnabled((v) => !v)}
          />
        )
        break
      case 'controlling':
        panelBody = (
          <EnableRow
            label="Enable Controlling"
            hint="Turn off to hide Controlling Management from the sidebar."
            enabled={controllingEnabled}
            onToggle={() => setControllingEnabled((v) => !v)}
          />
        )
        break
      case 'pos':
        panelBody = (
          <div className="space-y-2">
            {!productsCatalog && (
              <p className="text-[0.7rem] text-muted-foreground rounded-md border border-border bg-muted/30 px-2.5 py-1.5 leading-snug">
                Set <strong>Catalog</strong> to Products only or Products &amp; services to use POS.
              </p>
            )}
            <EnableRow
              label="Enable POS"
              hint="Checkout and register flows under Sales Management."
              enabled={posEnabled && productsCatalog}
              onToggle={() => setPosEnabled((v) => !v)}
            />
          </div>
        )
        break
      case 'restaurant':
        panelBody = (
          <div className="space-y-2">
            {!productsCatalog && (
              <p className="text-[0.7rem] text-muted-foreground rounded-md border border-border bg-muted/30 px-2.5 py-1.5 leading-snug">
                Set <strong>Catalog</strong> to Products only or Products &amp; services to use Restaurant.
              </p>
            )}
            <EnableRow
              label="Enable Restaurant"
              hint="Floor, kitchen board, and table setup in the sidebar."
              enabled={restaurantEnabled && productsCatalog}
              onToggle={() => setRestaurantEnabled((v) => !v)}
            />
          </div>
        )
        break
      case 'bookings':
        panelBody = (
          <div className="space-y-2">
            {!servicesCatalog && (
              <p className="text-[0.7rem] text-muted-foreground rounded-md border border-border bg-muted/30 px-2.5 py-1.5 leading-snug">
                Set <strong>Catalog</strong> to Services only or Products &amp; services to use Bookings.
              </p>
            )}
            <EnableRow
              label="Enable Bookings"
              hint="Service appointments and calendar under Sales Management."
              enabled={bookingsEnabled && servicesCatalog}
              onToggle={() => setBookingsEnabled((v) => !v)}
            />
          </div>
        )
        break
      case 'subscriptions':
        panelBody = (
          <EnableRow
            label="Enable Subscriptions"
            hint="Recurring product and service plans in the Subscriptions catalog."
            enabled={subscriptionsEnabled}
            onToggle={() => setSubscriptionsEnabled((v) => !v)}
          />
        )
        break
      default:
        panelBody = null
    }

  return (
    <div className="mx-auto flex max-h-[calc(100dvh-10rem)] min-h-0 w-full max-w-6xl flex-col overflow-hidden">
      <div className="shrink-0 space-y-1 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-foreground">Module Settings</h1>
          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
            {canManageModules && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  disabled={!canEnableAll || updateVendor.isPending}
                  onClick={handleEnableAll}
                  title="Enable every module and set catalog to Products & services"
                >
                  {updateVendor.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCheck className="h-3.5 w-3.5" />
                  )}
                  Enable all
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  disabled={!canReset || updateVendor.isPending}
                  onClick={handleReset}
                  title={`Restore role-specific module defaults for ${vendorRole?.role_name ?? roleKey}`}
                >
                  {updateVendor.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                  Role-specific reset
                </Button>
              </>
            )}
            {activeTile.configurable && (
              <SaveButton loading={updateVendor.isPending} disabled={!canManageModules || !isDirty} form="module-settings-form" />
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Choose a module on the left, then configure enablement and options on the right.
          {canManageModules && (
            <span className="block mt-1 text-xs">
              <span className="font-medium text-foreground">Enable all</span> turns on every module (catalog →
              Products &amp; services).{' '}
              <span className="font-medium text-foreground">Role-specific reset</span> restores recommended
              modules for {vendorRole?.role_name ?? roleKey}.
            </span>
          )}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden lg:flex-row lg:gap-6">
        {/* Module list — left (scrolls here only) */}
        <nav
          aria-label="Modules"
          className={cn(
            'sidebar-scroll flex w-full shrink-0 gap-1.5 overflow-y-auto overscroll-contain',
            'max-h-[min(12rem,38vh)] flex-row flex-wrap',
            'lg:max-h-none lg:w-48 lg:flex-col lg:flex-nowrap lg:pr-0.5 xl:w-52',
          )}
        >
          {VENDOR_MODULE_TILES.map((tile) => {
            const Icon = tile.icon
            const status = moduleEnabledStatus(tile.id, vendor)
            const selected = activeId === tile.id
            return (
              <button
                key={tile.id}
                type="button"
                onClick={() => setActiveId(tile.id)}
                aria-current={selected ? 'true' : undefined}
                className={cn(
                  'relative flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-all',
                  'hover:border-primary/40 hover:bg-muted/30',
                  selected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card',
                  'lg:w-full',
                )}
              >
                <div
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1 ring-inset',
                    selected
                      ? 'bg-primary/15 text-primary ring-primary/25'
                      : 'bg-muted/60 text-muted-foreground ring-border',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate text-xs font-semibold leading-tight', selected && 'text-primary')}>
                    {tile.label}
                  </p>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-1.5 py-px text-[0.6rem] leading-tight',
                      status.enabled
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-muted-foreground',
                    )}
                  >
                    {status.enabled ? '● Enabled' : '○ Disabled'}
                  </span>
                </div>
                {selected && (
                  <ChevronRight
                    className="hidden h-3.5 w-3.5 shrink-0 text-primary lg:block"
                    aria-hidden
                  />
                )}
              </button>
            )
          })}
        </nav>

        {/* Module options — right (scrolls here only) */}
        <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center gap-2.5 border-b border-border bg-muted/20 px-4 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
              <activeTile.icon className="h-4 w-4" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-foreground leading-tight">{panelTitle} module</h2>
              <p className="text-[0.7rem] text-muted-foreground leading-snug">{activeTile.description}</p>
            </div>
          </div>
          <CardContent className="sidebar-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain py-3 px-4">
            {activeTile.configurable ? (
              <form id="module-settings-form" onSubmit={handleSubmit}>
                <fieldset disabled={!canManageModules} className="space-y-2 disabled:opacity-60">
                  {panelBody}
                </fieldset>
              </form>
            ) : (
              panelBody
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
