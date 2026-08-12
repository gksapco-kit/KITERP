import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { FieldLabel } from '@/components/common/FieldLabel'
import { CURRENCY_SELECT_OPTIONS, UOM_SUGGESTIONS, currencySymbol } from './rentalConstants'
import { RentalSuggestionCombobox } from './RentalSuggestionCombobox'

export type PricingModel = 'period' | 'per_unit' | 'both'

const PRICING_MODEL_OPTIONS = [
  { value: 'period', label: 'Period rates' },
  { value: 'per_unit', label: 'Per-unit' },
  { value: 'both', label: 'Both' },
]

type PricingFormSlice = {
  currency: string
  daily_rate: string
  weekly_rate: string
  monthly_rate: string
  yearly_rate: string
  hourly_rate: string
  per_minute_rate: string
  deposit_amount: string
  extra_qty_charge: string
  price_per_unit: string
  pricing_uom: string
  capacity_max: string
  capacity_unit: string
}

function inferPricingModel(form: PricingFormSlice): PricingModel {
  const hasPeriod = [form.daily_rate, form.weekly_rate, form.monthly_rate, form.yearly_rate, form.hourly_rate, form.per_minute_rate]
    .some((v) => Number(v) > 0)
  const hasUnit = Number(form.price_per_unit) > 0
  if (hasUnit && hasPeriod) return 'both'
  if (hasUnit) return 'per_unit'
  return 'period'
}

type Props = {
  form: PricingFormSlice
  set: (key: string, value: string) => void
  featureCapacityTracking?: boolean
  featureExtendedRates?: boolean
  featurePerUnitPricing?: boolean
  /** denser layout for the side sheet */
  compact?: boolean
  /** Change when loading a different asset so UI state re-syncs */
  syncKey?: string
}

export default function RentalAssetPricingFields({
  form,
  set,
  featureCapacityTracking = true,
  featureExtendedRates = true,
  featurePerUnitPricing = true,
  compact = false,
  syncKey = '',
}: Props) {
  const [pricingModel, setPricingModel] = useState<PricingModel>(() => inferPricingModel(form))
  const [showMoreRates, setShowMoreRates] = useState(() =>
    [form.hourly_rate, form.per_minute_rate, form.yearly_rate].some((v) => Number(v) > 0),
  )
  const [showUomOverride, setShowUomOverride] = useState(() => Boolean((form.pricing_uom || '').trim()))

  useEffect(() => {
    setPricingModel(inferPricingModel(form))
    setShowMoreRates([form.hourly_rate, form.per_minute_rate, form.yearly_rate].some((v) => Number(v) > 0))
    setShowUomOverride(Boolean((form.pricing_uom || '').trim()))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-sync only when asset/form identity changes
  }, [syncKey])

  const modelOptions = useMemo(() => {
    if (featurePerUnitPricing) return PRICING_MODEL_OPTIONS
    return PRICING_MODEL_OPTIONS.filter((o) => o.value === 'period')
  }, [featurePerUnitPricing])

  const effectiveModel: PricingModel = featurePerUnitPricing ? pricingModel : 'period'
  const showPeriod = effectiveModel === 'period' || effectiveModel === 'both'
  const showPerUnit = featurePerUnitPricing && (effectiveModel === 'per_unit' || effectiveModel === 'both')
  const uomLabel = (form.pricing_uom || '').trim() || form.capacity_unit || 'unit'
  const sym = currencySymbol(form.currency)
  // Keep fields side-by-side at a fixed comfortable width instead of stretching full-bleed
  const grid = compact
    ? 'grid gap-3 grid-cols-2'
    : 'grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 max-w-3xl'
  const pairGrid = compact
    ? 'grid gap-3 grid-cols-2'
    : 'grid gap-3 grid-cols-2 max-w-md'

  return (
    <div className="space-y-5">
      {featureCapacityTracking && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">Capacity &amp; unit</p>
          <div className={pairGrid}>
            <div>
              <FieldLabel>Max Capacity</FieldLabel>
              <Input
                type="number"
                min={0}
                step="any"
                value={form.capacity_max}
                onChange={(e) => set('capacity_max', e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Maximum quantity that can be booked for this asset.
              </p>
            </div>
            <div>
              <FieldLabel>UOM</FieldLabel>
              <RentalSuggestionCombobox
                value={form.capacity_unit}
                onChange={(v) => set('capacity_unit', v)}
                suggestions={UOM_SUGGESTIONS}
                placeholder="Type or select… e.g. Packets, Units"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Unit for capacity, booking quantity, and per-unit rates. Type a custom UOM if needed.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className={pairGrid}>
        <div>
          <FieldLabel>Currency</FieldLabel>
          <Select
            value={form.currency || 'INR'}
            onChange={(v) => set('currency', v || 'INR')}
            options={CURRENCY_SELECT_OPTIONS}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Applies to all rates and deposits below.
          </p>
        </div>
        {featurePerUnitPricing && (
          <div>
            <FieldLabel>Pricing model</FieldLabel>
            <Select
              value={effectiveModel}
              onChange={(v) => setPricingModel((v as PricingModel) || 'period')}
              options={modelOptions}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Period = flat rate for the asset. Per-unit = charge per {form.capacity_unit || 'UOM'}.
            </p>
          </div>
        )}
      </div>

      {showPeriod && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">Period rates</p>
          <div className={grid}>
            <div>
              <FieldLabel>Daily Rate ({sym})</FieldLabel>
              <Input type="number" min={0} step="0.01" placeholder="0" value={form.daily_rate} onChange={(e) => set('daily_rate', e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">Flat charge per day for the whole asset.</p>
            </div>
            <div>
              <FieldLabel>Weekly Rate ({sym})</FieldLabel>
              <Input type="number" min={0} step="0.01" placeholder="0" value={form.weekly_rate} onChange={(e) => set('weekly_rate', e.target.value)} />
            </div>
            <div>
              <FieldLabel>Monthly Rate ({sym})</FieldLabel>
              <Input type="number" min={0} step="0.01" placeholder="0" value={form.monthly_rate} onChange={(e) => set('monthly_rate', e.target.value)} />
            </div>
            <div>
              <FieldLabel>Security Deposit ({sym})</FieldLabel>
              <Input type="number" min={0} step="0.01" placeholder="0" value={form.deposit_amount} onChange={(e) => set('deposit_amount', e.target.value)} />
            </div>
            {featureCapacityTracking && (
              <div>
                <FieldLabel>Extra Qty Charge ({sym})</FieldLabel>
                <Input type="number" min={0} step="0.01" placeholder="0" value={form.extra_qty_charge} onChange={(e) => set('extra_qty_charge', e.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">
                  Extra amount per {form.capacity_unit || 'unit'} beyond the included quantity.
                </p>
              </div>
            )}
          </div>

          {featureExtendedRates && (
            <div className="mt-3">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setShowMoreRates((v) => !v)}
              >
                {showMoreRates ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                More rates
              </button>
              {showMoreRates && (
                <div className={`mt-2 ${grid}`}>
                  <div>
                    <FieldLabel>Hourly Rate ({sym})</FieldLabel>
                    <Input type="number" min={0} step="0.01" placeholder="0" value={form.hourly_rate} onChange={(e) => set('hourly_rate', e.target.value)} />
                  </div>
                  <div>
                    <FieldLabel>Per-Minute Rate ({sym})</FieldLabel>
                    <Input type="number" min={0} step="0.01" placeholder="0" value={form.per_minute_rate} onChange={(e) => set('per_minute_rate', e.target.value)} />
                  </div>
                  <div>
                    <FieldLabel>Yearly Rate ({sym})</FieldLabel>
                    <Input type="number" min={0} step="0.01" placeholder="0" value={form.yearly_rate} onChange={(e) => set('yearly_rate', e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showPerUnit && (
        <div className={showPeriod || featureCapacityTracking ? 'border-t border-border/60 pt-4' : ''}>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">Per-unit pricing</p>
          <div className={pairGrid}>
            <div>
              <FieldLabel>Price per {uomLabel} ({sym})</FieldLabel>
              <Input type="number" min={0} step="0.01" placeholder="0" value={form.price_per_unit} onChange={(e) => set('price_per_unit', e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">
                Charged per {uomLabel} per day. Uses the UOM above
                {form.capacity_unit ? ` (${form.capacity_unit})` : ''} unless you override it.
              </p>
              {!showUomOverride ? (
                <button
                  type="button"
                  className="mt-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setShowUomOverride(true)}
                >
                  Override pricing UOM…
                </button>
              ) : (
                <div className="mt-2">
                  <FieldLabel>Pricing UOM</FieldLabel>
                  <Input
                    placeholder={form.capacity_unit || 'e.g. packet, kg, unit'}
                    value={form.pricing_uom}
                    onChange={(e) => set('pricing_uom', e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Optional label for invoices if different from capacity UOM.
                  </p>
                  <button
                    type="button"
                    className="mt-1 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => { set('pricing_uom', ''); setShowUomOverride(false) }}
                  >
                    ✕ Use capacity UOM
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
