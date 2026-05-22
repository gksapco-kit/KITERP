import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react'
import { useUpdateVendor, useStores } from '@/hooks/useVendor'
import { useVendorStore } from '@/stores/vendorStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Save, Loader2, ToggleLeft, ToggleRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Vendor } from '@/types'
import { formatStoreCode } from '@/lib/verification'
import { readHrModuleSettings, type HrScope } from '@/lib/hrModuleSettings'
import {
  VENDOR_MODULE_TILES,
  moduleEnabledStatus,
  type VendorModuleId,
} from '@/lib/vendorModuleSettings'

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
        'flex items-center justify-between gap-4 p-4 rounded-xl border-2 transition-all',
        enabled ? 'border-primary bg-primary/5' : 'border-border',
      )}
    >
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
      </div>
      <button type="button" role="switch" aria-checked={enabled} onClick={onToggle} className="shrink-0">
        {enabled ? (
          <ToggleRight className="w-10 h-10 text-primary" />
        ) : (
          <ToggleLeft className="w-10 h-10 text-muted-foreground/50" />
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
    <div className="space-y-2">
      {options.map((opt) => (
        <label
          key={opt.value}
          className={cn(
            'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
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
            className="mt-0.5 w-4 h-4 text-primary"
          />
          <div>
            <p
              className={cn(
                'text-sm font-semibold',
                value === opt.value ? 'text-primary' : 'text-foreground',
              )}
            >
              {opt.label}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
          </div>
        </label>
      ))}
    </div>
  )
}

function SaveButton({ loading }: { loading: boolean }) {
  return (
    <Button type="submit" disabled={loading} className="gap-2">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
      Save module settings
    </Button>
  )
}

export default function ModulesPage() {
  const { vendor } = useVendorStore()
  const updateVendor = useUpdateVendor()
  const { data: storesData } = useStores({ limit: 200 })
  const stores = storesData?.stores ?? []

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

  useEffect(() => {
    if (!vendor || savingRef.current) return
    const s = vendor.settings as Record<string, unknown> | undefined
    setOfferingType((vendor.offering_type as 'products' | 'services' | 'both') || 'both')
    setFinanceEnabled(s?.finance_enabled !== false)
    setFinanceMode((s?.finance_mode as string) ?? 'advanced')
    const hr = readHrModuleSettings(s)
    setHrEnabled(hr.hr_enabled)
    setHrScope(hr.hr_scope)
    setHrBusinessUnitIds(hr.hr_business_unit_ids)
    setCrmEnabled(s?.crm_enabled !== false)
    setCommissionEnabled(s?.commission_enabled !== false)
    setControllingEnabled(s?.controlling_enabled !== false)
  }, [vendor])

  const activeTile = VENDOR_MODULE_TILES.find((t) => t.id === activeId)!

  const toggleBusinessUnit = (storeId: string) => {
    setHrBusinessUnitIds((prev) =>
      prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId],
    )
  }

  const validate = (): string | null => {
    if (activeId === 'hr' && hrEnabled && hrScope === 'per_business_unit' && hrBusinessUnitIds.length === 0) {
      return 'Select at least one business unit for HR, or choose Central HR.'
    }
    return null
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const err = validate()
    if (err) {
      toast.error(err)
      return
    }

    const existingSettings = (vendor?.settings || {}) as Record<string, unknown>
    savingRef.current = true

    const payload: Partial<Vendor> = {
      settings: {
        ...existingSettings,
        finance_enabled: financeEnabled,
        finance_mode: financeMode,
        hr_enabled: hrEnabled,
        hr_scope: hrScope,
        hr_business_unit_ids: hrScope === 'per_business_unit' ? hrBusinessUnitIds : [],
        crm_enabled: crmEnabled,
        commission_enabled: commissionEnabled,
        controlling_enabled: controllingEnabled,
      },
    }

    if (activeId === 'catalog') {
      payload.offering_type = offeringType
    }

    updateVendor.mutate(payload, {
      onSuccess: () => toast.success(`${activeTile.label} module settings saved`),
      onSettled: () => {
        savingRef.current = false
      },
    })
  }

  const panelTitle = useMemo(() => activeTile.label, [activeTile.label])

  let panelBody: ReactNode = null

  if (activeTile.comingSoon) {
    panelBody = (
      <p className="text-sm text-muted-foreground py-4">
        Configuration for <strong>{activeTile.label}</strong> is coming soon. The tile shows planned
        capability; enable/disable will apply to sidebar and workflows when released.
      </p>
    )
  } else {
    switch (activeId) {
      case 'catalog':
        panelBody = (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
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
          <div className="space-y-4">
            <EnableRow
              label="Enable HR"
              hint="Turn off to hide HR Management from the sidebar."
              enabled={hrEnabled}
              onToggle={() => setHrEnabled((v) => !v)}
            />
            {hrEnabled && (
              <p className="text-xs text-muted-foreground rounded-lg border border-border bg-muted/30 px-3 py-2">
                <strong>Employee login links:</strong> Central HR uses one ESS URL per business unit (
                <span className="font-mono">?branch=unit code</span>). Per-unit HR only lists links for
                units you select below — see Settings → All business units or each unit&apos;s detail card.
              </p>
            )}
            {hrEnabled && (
              <>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">HR scope</p>
                <RadioOptions name="hr_scope" value={hrScope} onChange={setHrScope} options={HR_SCOPE_OPTIONS} />
                {hrScope === 'per_business_unit' && (
                  <div className="rounded-xl border border-border p-4 space-y-2">
                    <p className="text-sm font-semibold text-foreground">Business units with HR</p>
                    {stores.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Add business units first.</p>
                    ) : (
                      <ul className="space-y-2">
                        {stores.map((store) => {
                          const checked = hrBusinessUnitIds.includes(store.id)
                          return (
                            <label
                              key={store.id}
                              className={cn(
                                'flex items-center gap-3 p-3 rounded-lg border cursor-pointer',
                                checked ? 'border-primary/50 bg-primary/5' : 'border-border',
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleBusinessUnit(store.id)}
                                className="w-4 h-4 rounded text-primary"
                              />
                              <span className="text-sm font-medium">
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
          <div className="space-y-4">
            <EnableRow
              label="Enable Finance"
              hint="Turn off to hide Finance Management from the sidebar."
              enabled={financeEnabled}
              onToggle={() => setFinanceEnabled((v) => !v)}
            />
            {financeEnabled && (
              <>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Finance mode</p>
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
      default:
        panelBody = null
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Module Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose A Module Below, Then Configure Enablement And Options In The Panel.
        </p>
      </div>

      {/* Module tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {VENDOR_MODULE_TILES.map((tile) => {
          const Icon = tile.icon
          const status = moduleEnabledStatus(tile.id, vendor)
          const selected = activeId === tile.id
          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => setActiveId(tile.id)}
              className={cn(
                'relative flex flex-col items-start gap-2 rounded-xl border-2 p-3 text-left transition-all',
                'hover:border-primary/40 hover:bg-muted/30',
                selected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card',
                tile.comingSoon && 'opacity-90',
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg ring-1 ring-inset',
                  selected
                    ? 'bg-primary/15 text-primary ring-primary/25'
                    : 'bg-muted/60 text-muted-foreground ring-border',
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <div className="min-w-0 w-full">
                <p className={cn('text-sm font-semibold truncate', selected && 'text-primary')}>
                  {tile.label}
                </p>
                <span
                  className={cn(
                    'mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                    tile.comingSoon
                      ? 'bg-muted text-muted-foreground'
                      : status.enabled
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {tile.comingSoon ? 'Coming soon' : status.enabled ? 'Enabled' : 'Disabled'}
                  {!tile.comingSoon && status.enabled && status.detail ? ` · ${status.detail}` : ''}
                </span>
              </div>
              {selected && (
                <ChevronDown className="absolute bottom-2 right-2 h-4 w-4 text-primary" aria-hidden />
              )}
            </button>
          )
        })}
      </div>

      {/* Expanded panel */}
      <Card className="overflow-hidden">
        <div className="flex items-start gap-3 border-b border-border bg-muted/20 px-5 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
            <activeTile.icon className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-foreground">{panelTitle} module</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{activeTile.description}</p>
          </div>
        </div>
        <CardContent className="pt-5">
          {activeTile.configurable ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {panelBody}
              <div className="flex justify-end pt-2 border-t border-border">
                <SaveButton loading={updateVendor.isPending} />
              </div>
            </form>
          ) : (
            panelBody
          )}
        </CardContent>
      </Card>
    </div>
  )
}
