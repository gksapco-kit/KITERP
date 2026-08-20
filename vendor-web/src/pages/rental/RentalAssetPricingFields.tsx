import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { FieldLabel } from '@/components/common/FieldLabel'
import { useStores } from '@/hooks/useVendor'
import { useVendorStore } from '@/stores/vendorStore'
import { cn } from '@/lib/utils'
import {
  buildTaxRateSelectOptions,
  getTaxCountry,
  parseCustomTaxRates,
  ratesApproximatelyEqual,
} from '@/lib/taxCountries'
import { taxFormFromStoreOrVendor } from '@/pages/settings/settingsDirtyHelpers'
import { CURRENCY_SELECT_OPTIONS, UOM_SUGGESTIONS, currencySymbol } from './rentalConstants'
import { RentalSuggestionCombobox } from './RentalSuggestionCombobox'
import {
  DURATION_PRESETS,
  combineDuration,
  splitDuration,
  type DurationRateRow,
} from './durationRates'
import {
  PERIOD_PRESETS,
  combinePeriod,
  periodLegacyRates,
  splitPeriod,
  type PeriodRateRow,
  type PeriodUnit,
} from './periodRates'
import {
  additionalChargeAmount,
  emptyAdditionalChargeRow,
  PERCENT_OF_OPTIONS,
  type AdditionalChargeRow,
} from './additionalCharges'

export type PeriodKind = 'periodic' | 'hourly' | 'both'

const CUSTOM_RATE_VALUE = '__custom__'

const PERIOD_KIND_OPTIONS: { value: PeriodKind; short: string; title: string }[] = [
  { value: 'periodic', short: 'Periodic', title: 'Custom day, week, month, and year slots' },
  { value: 'hourly', short: 'Hourly', title: 'Minute and hour duration slots' },
  { value: 'both', short: 'Both', title: 'Periodic and hourly rates' },
]

type PricingFormSlice = {
  currency: string
  daily_rate: string
  weekly_rate: string
  monthly_rate: string
  yearly_rate: string
  hourly_rate: string
  per_minute_rate: string
  period_rates?: PeriodRateRow[]
  duration_rates?: DurationRateRow[]
  deposit_amount: string
  additional_charges: AdditionalChargeRow[]
  price_per_unit: string
  pricing_uom: string
  capacity_max: string
  capacity_unit: string
  tax_rate: string
}

function inferPeriodKind(form: PricingFormSlice): PeriodKind {
  const hasHourly = (form.duration_rates || []).some((r) => Number(r.rate) > 0)
    || [form.hourly_rate, form.per_minute_rate].some((v) => Number(v) > 0)
  const hasPeriodic = (form.period_rates || []).some((r) => Number(r.rate) > 0)
    || [form.daily_rate, form.weekly_rate, form.monthly_rate, form.yearly_rate].some((v) => Number(v) > 0)
  if (hasHourly && hasPeriodic) return 'both'
  if (hasHourly) return 'hourly'
  return 'periodic'
}

const fieldLabelClass = 'mb-1 block h-3.5 text-[11px] font-medium leading-none text-muted-foreground'
/** Shared control height — Input/Select default to h-10; keep everything matched. */
const controlClass = 'h-9 py-0 text-sm'
const controlHeightClass = 'h-9'

/** Plain label — avoids FieldHelpLabel hover tint / inline layout quirks in dense rows. */
function PricingLabel({ children }: { children: string }) {
  return <p className={fieldLabelClass}>{children}</p>
}

function PricingField({
  label,
  className,
  children,
  title,
}: {
  label: string
  className?: string
  children: ReactNode
  title?: string
}) {
  return (
    <div className={cn('flex min-w-0 flex-col', className)} title={title}>
      <PricingLabel>{label}</PricingLabel>
      {children}
    </div>
  )
}

function MoneyInput({
  value,
  onChange,
  symbol,
  placeholder = '0',
  className,
  inputClassName,
}: {
  value: string
  onChange: (value: string) => void
  symbol: string
  placeholder?: string
  className?: string
  inputClassName?: string
}) {
  const wide = symbol.length > 1
  return (
    <div className={cn('relative', className)}>
      <span
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center text-xs font-medium text-muted-foreground',
          wide ? 'w-9' : 'w-7',
        )}
      >
        {symbol}
      </span>
      <Input
        type="number"
        min={0}
        step="0.01"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          controlClass,
          'tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          wide ? 'pl-9 pr-2' : 'pl-7 pr-2',
          inputClassName,
        )}
      />
    </div>
  )
}

function MoneyField({
  label,
  value,
  onChange,
  symbol,
  title,
  className,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  symbol: string
  title?: string
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)} title={title}>
      <FieldLabel className={fieldLabelClass}>{label}</FieldLabel>
      <MoneyInput value={value} onChange={onChange} symbol={symbol} />
    </div>
  )
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; short: string; title?: string }[]
  className?: string
}) {
  return (
    <div
      className={cn(
        'inline-flex h-9 items-stretch rounded-md border border-border bg-muted/40 p-0.5',
        className,
      )}
    >
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            title={opt.title}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded px-2.5 text-center text-[11px] font-medium leading-none transition-colors',
              selected
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {opt.short}
          </button>
        )
      })}
    </div>
  )
}

const UNIT_OPTIONS = [
  { value: 'minutes', label: 'Min' },
  { value: 'hours', label: 'Hours' },
]

const PERIOD_UNIT_SHORT = [
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
  { value: 'months', label: 'Month' },
  { value: 'years', label: 'Years' },
] as const

function PeriodRatesEditor({
  rows,
  onChange,
  symbol,
  wide = false,
}: {
  rows: PeriodRateRow[]
  onChange: (rows: PeriodRateRow[]) => void
  symbol: string
  /** Full-width columns when Periodic is the only rates panel. */
  wide?: boolean
}) {
  const used = new Set(rows.map((r) => r.days))

  const updateRow = (index: number, patch: Partial<PeriodRateRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const setPeriod = (index: number, qty: number, unit: PeriodUnit) => {
    const days = combinePeriod(qty, unit)
    const clash = rows.findIndex((r, i) => i !== index && r.days === days)
    if (clash >= 0) {
      onChange(rows.filter((_, i) => i !== index))
      return
    }
    updateRow(index, { days })
  }

  const addDays = (days: number) => {
    if (used.has(days)) return
    onChange([...rows, { days, rate: '0' }].sort((a, b) => a.days - b.days))
  }

  const addCustom = () => {
    const next = PERIOD_PRESETS.find((p) => !used.has(p.days))
    addDays(next?.days ?? (rows.at(-1)?.days || 0) + 1)
  }

  return (
    <div className="w-full space-y-1.5">
      {rows.length === 0 ? (
        <button
          type="button"
          onClick={addCustom}
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-primary/40 bg-primary/5 text-xs font-medium text-primary hover:border-primary/60 hover:bg-primary/10"
        >
          <Plus className="h-3.5 w-3.5" />
          Add period rate
        </button>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row, index) => {
            const split = splitPeriod(row.days)
            return (
              <div key={`${row.days}-${index}`} className="flex items-end gap-2">
                <div
                  className={cn(
                    'min-w-0',
                    wide ? 'min-w-[14rem] flex-1 sm:min-w-[18rem]' : 'min-w-[9rem] flex-1 basis-[10rem]',
                  )}
                >
                  {index === 0 ? <p className={fieldLabelClass}>Rate</p> : null}
                  <MoneyInput value={row.rate} onChange={(rate) => updateRow(index, { rate })} symbol={symbol} />
                </div>
                <div className={cn('shrink-0', wide ? 'w-[5.5rem]' : 'w-[4.5rem]')}>
                  {index === 0 ? <p className={fieldLabelClass}>Qty</p> : null}
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={split.qty}
                    onChange={(e) => setPeriod(index, Number(e.target.value) || 1, split.unit)}
                    className={cn(controlClass, 'tabular-nums px-1.5 text-center')}
                    aria-label="Period quantity"
                  />
                </div>
                <div className={cn('shrink-0', wide ? 'w-[12rem]' : 'w-[9.5rem]')}>
                  {index === 0 ? <p className={fieldLabelClass}>Unit</p> : null}
                  <Select
                    value={split.unit}
                    onChange={(v) => {
                      const unit = (v as PeriodUnit) || 'days'
                      if (unit === split.unit) return
                      setPeriod(index, split.qty, unit)
                    }}
                    options={[...PERIOD_UNIT_SHORT]}
                    className={controlClass}
                    showSelectedHint={false}
                  />
                </div>
                <button
                  type="button"
                  className="inline-flex h-9 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => onChange(rows.filter((_, i) => i !== index))}
                  aria-label="Remove period"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}
      <RateAddActions
        addLabel="Add period rate"
        onAdd={addCustom}
        presets={PERIOD_PRESETS.filter((p) => !used.has(p.days)).map((p) => ({
          key: String(p.days),
          label: p.label,
          onClick: () => addDays(p.days),
        }))}
        showPrimary={rows.length > 0}
      />
    </div>
  )
}

function DurationRatesEditor({
  rows,
  onChange,
  symbol,
  wide = false,
}: {
  rows: DurationRateRow[]
  onChange: (rows: DurationRateRow[]) => void
  symbol: string
  /** Full-width columns when Hourly is the only rates panel. */
  wide?: boolean
}) {
  const used = new Set(rows.map((r) => r.minutes))

  const updateRow = (index: number, patch: Partial<DurationRateRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const setDuration = (index: number, qty: number, unit: 'minutes' | 'hours') => {
    const minutes = combineDuration(qty, unit)
    const clash = rows.findIndex((r, i) => i !== index && r.minutes === minutes)
    if (clash >= 0) {
      onChange(rows.filter((_, i) => i !== index))
      return
    }
    updateRow(index, { minutes })
  }

  const addMinutes = (minutes: number) => {
    if (used.has(minutes)) return
    onChange([...rows, { minutes, rate: '0' }].sort((a, b) => a.minutes - b.minutes))
  }

  const addCustom = () => {
    const next = DURATION_PRESETS.find((p) => !used.has(p.minutes))
    addMinutes(next?.minutes ?? (rows.at(-1)?.minutes || 0) + 15)
  }

  return (
    <div className="w-full space-y-1.5">
      {rows.length === 0 ? (
        <button
          type="button"
          onClick={addCustom}
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-primary/40 bg-primary/5 text-xs font-medium text-primary hover:border-primary/60 hover:bg-primary/10"
        >
          <Plus className="h-3.5 w-3.5" />
          Add hourly rate
        </button>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row, index) => {
            const split = splitDuration(row.minutes)
            return (
              <div key={`${row.minutes}-${index}`} className="flex items-end gap-2">
                <div
                  className={cn(
                    'min-w-0',
                    wide ? 'min-w-[14rem] flex-1 sm:min-w-[18rem]' : 'min-w-[9rem] flex-1 basis-[10rem]',
                  )}
                >
                  {index === 0 ? <p className={fieldLabelClass}>Rate</p> : null}
                  <MoneyInput value={row.rate} onChange={(rate) => updateRow(index, { rate })} symbol={symbol} />
                </div>
                <div className={cn('shrink-0', wide ? 'w-[5.5rem]' : 'w-[4.5rem]')}>
                  {index === 0 ? <p className={fieldLabelClass}>Qty</p> : null}
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={split.qty}
                    onChange={(e) => setDuration(index, Number(e.target.value) || 1, split.unit)}
                    className={cn(controlClass, 'tabular-nums px-1.5 text-center')}
                    aria-label="Duration quantity"
                  />
                </div>
                <div className={cn('shrink-0', wide ? 'w-[12rem]' : 'w-[9.5rem]')}>
                  {index === 0 ? <p className={fieldLabelClass}>Unit</p> : null}
                  <Select
                    value={split.unit}
                    onChange={(v) => {
                      const unit = (v as 'minutes' | 'hours') || 'minutes'
                      if (unit === split.unit) return
                      if (unit === 'hours') {
                        setDuration(index, Math.max(1, Math.round(row.minutes / 60) || 1), 'hours')
                      } else {
                        setDuration(index, row.minutes, 'minutes')
                      }
                    }}
                    options={UNIT_OPTIONS}
                    className={controlClass}
                    showSelectedHint={false}
                  />
                </div>
                <button
                  type="button"
                  className="inline-flex h-9 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => onChange(rows.filter((_, i) => i !== index))}
                  aria-label="Remove duration"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}
      <RateAddActions
        addLabel="Add hourly rate"
        onAdd={addCustom}
        presets={DURATION_PRESETS.filter((p) => !used.has(p.minutes)).map((p) => ({
          key: String(p.minutes),
          label: p.label,
          onClick: () => addMinutes(p.minutes),
        }))}
        showPrimary={rows.length > 0}
      />
    </div>
  )
}

function RateAddActions({
  addLabel,
  onAdd,
  presets,
  showPrimary,
}: {
  addLabel: string
  onAdd: () => void
  presets: Array<{ key: string; label: string; onClick: () => void }>
  showPrimary: boolean
}) {
  if (!showPrimary && presets.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
      {showPrimary ? (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2.5 text-[11px] font-semibold text-primary hover:border-primary/50 hover:bg-primary/10"
        >
          <Plus className="h-3 w-3" />
          {addLabel}
        </button>
      ) : null}
      {presets.length > 0 ? (
        <Select
          value=""
          onChange={(v) => {
            const preset = presets.find((p) => p.key === v)
            preset?.onClick()
          }}
          options={presets.map((p) => ({ value: p.key, label: p.label }))}
          placeholder="Quick add…"
          className="h-7 w-[8.5rem] text-[11px]"
        />
      ) : null}
    </div>
  )
}

function AdditionalChargesEditor({
  rows,
  onChange,
  symbol,
  sampleSubtotal,
  sampleDeposit,
}: {
  rows: AdditionalChargeRow[]
  onChange: (rows: AdditionalChargeRow[]) => void
  symbol: string
  sampleSubtotal: number
  sampleDeposit: number
}) {
  const updateRow = (index: number, patch: Partial<AdditionalChargeRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  return (
    <div className="space-y-2">
      {rows.length === 0 ? (
        <button
          type="button"
          onClick={() => onChange([...rows, emptyAdditionalChargeRow()])}
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-background/60 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Add field
        </button>
      ) : (
        rows.map((row, index) => {
          const n = Number(row.value)
          const preview = Number.isFinite(n) && n > 0
            ? additionalChargeAmount(
                { charge_type: row.charge_type, value: n, percent_of: row.percent_of || 'rental' },
                { rental: sampleSubtotal || 0, deposit: sampleDeposit || 0 },
              )
            : 0
          const previewLabel =
            row.charge_type === 'percent' && preview > 0
              ? `≈ ${symbol}${Number.isInteger(preview) ? preview : preview.toFixed(2)}`
              : undefined

          return (
            <div
              key={row.id || index}
              className="rounded-md border border-border/60 bg-background/70 p-2.5"
            >
              <div className="flex items-end gap-2">
                <PricingField label="Option" className="min-w-[7rem] flex-1 basis-[7rem]">
                  <Input
                    value={row.name}
                    onChange={(e) => updateRow(index, { name: e.target.value })}
                    placeholder="e.g. Delivery"
                    className={controlClass}
                  />
                </PricingField>

                <PricingField label="Description" className="min-w-[8rem] flex-[1.2] basis-[9rem]">
                  <Input
                    value={row.description}
                    onChange={(e) => updateRow(index, { description: e.target.value })}
                    placeholder="Shown with this charge"
                    className={controlClass}
                  />
                </PricingField>

                <PricingField label="Type" className="shrink-0">
                  <Segmented
                    value={row.charge_type}
                    onChange={(charge_type) => updateRow(index, { charge_type })}
                    options={[
                      { value: 'amount', short: symbol || '₹', title: 'Fixed amount' },
                      { value: 'percent', short: '%', title: 'Percent of a chosen basis' },
                    ]}
                  />
                </PricingField>

                <PricingField
                  label={row.charge_type === 'percent' ? 'Percent' : 'Amount'}
                  className="w-[6.75rem] shrink-0"
                  title={previewLabel}
                >
                  {row.charge_type === 'percent' ? (
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        placeholder="0"
                        value={row.value}
                        onChange={(e) => updateRow(index, { value: e.target.value })}
                        className={cn(
                          controlClass,
                          'tabular-nums pr-7 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                        )}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-0 flex w-7 items-center justify-center text-xs font-medium text-muted-foreground">
                        %
                      </span>
                    </div>
                  ) : (
                    <MoneyInput value={row.value} onChange={(value) => updateRow(index, { value })} symbol={symbol} />
                  )}
                </PricingField>

                {row.charge_type === 'percent' ? (
                  <PricingField
                    label="Of"
                    className="w-[8.5rem] shrink-0"
                    title={PERCENT_OF_OPTIONS.find((o) => o.value === (row.percent_of || 'rental'))?.title}
                  >
                    <Select
                      value={row.percent_of || 'rental'}
                      onChange={(v) =>
                        updateRow(index, { percent_of: (v as AdditionalChargeRow['percent_of']) || 'rental' })
                      }
                      options={PERCENT_OF_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                      className={controlClass}
                      showSelectedHint={false}
                    />
                  </PricingField>
                ) : null}

                <PricingField label="Show" className="shrink-0">
                  <Segmented
                    value={row.show_mode || 'together'}
                    onChange={(show_mode) => updateRow(index, { show_mode })}
                    options={[
                      { value: 'independent', short: 'Optional', title: 'Customer can add at booking' },
                      { value: 'together', short: 'Always', title: 'Always included with rental' },
                    ]}
                  />
                </PricingField>

                <button
                  type="button"
                  className={cn(
                    controlHeightClass,
                    'inline-flex w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
                  )}
                  onClick={() => onChange(rows.filter((_, i) => i !== index))}
                  aria-label="Remove field"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {previewLabel ? (
                <p className="mt-1.5 text-[10px] text-muted-foreground">{previewLabel}</p>
              ) : null}
            </div>
          )
        })
      )}

      {rows.length > 0 ? (
        <button
          type="button"
          onClick={() => onChange([...rows, emptyAdditionalChargeRow()])}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2.5 text-[11px] font-semibold text-primary hover:border-primary/50 hover:bg-primary/10"
        >
          <Plus className="h-3 w-3" />
          Add field
        </button>
      ) : null}
    </div>
  )
}

type Props = {
  form: PricingFormSlice
  set: (key: string, value: string | PeriodRateRow[] | DurationRateRow[] | AdditionalChargeRow[]) => void
  /** Asset name used in the max-quantity field label (e.g. "Max Chair"). */
  assetName?: string
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
  assetName = '',
  featureCapacityTracking = true,
  featureExtendedRates = true,
  featurePerUnitPricing = true,
  compact = false,
  syncKey = '',
}: Props) {
  const [periodKind, setPeriodKind] = useState<PeriodKind>(() => inferPeriodKind(form))

  const { vendor, selectedStore } = useVendorStore()
  const { data: storesData } = useStores()
  const activeStore = useMemo(() => {
    const stores = storesData?.stores ?? []
    if (selectedStore?.id) {
      return stores.find((s) => s.id === selectedStore.id) ?? null
    }
    return stores.find((s) => s.is_default) ?? stores[0] ?? null
  }, [storesData?.stores, selectedStore?.id])

  const taxSetup = useMemo(
    () => taxFormFromStoreOrVendor(activeStore, vendor),
    [activeStore, vendor],
  )
  const taxCountry = useMemo(
    () => getTaxCountry(taxSetup.tax_country_code),
    [taxSetup.tax_country_code],
  )
  const customTaxRates = useMemo(
    () => parseCustomTaxRates(taxSetup.custom_tax_rates),
    [taxSetup.custom_tax_rates],
  )
  const taxRateOptions = useMemo(() => {
    const opts = buildTaxRateSelectOptions(taxCountry, customTaxRates, CUSTOM_RATE_VALUE)
      .filter((o) => o.value !== CUSTOM_RATE_VALUE)
    const current = Number(form.tax_rate)
    if (
      Number.isFinite(current) &&
      !opts.some((o) => ratesApproximatelyEqual(Number(o.value), current))
    ) {
      opts.push({ value: String(current), label: `${current}%` })
    }
    return opts
  }, [taxCountry, customTaxRates, form.tax_rate])

  const selectedTaxDescription = useMemo(() => {
    const rate = Number(form.tax_rate)
    if (!Number.isFinite(rate)) return null
    const custom = customTaxRates.find((r) => ratesApproximatelyEqual(r.rate, rate))
    if (custom?.label) return custom.label
    const std = taxCountry.standard_rates.find((r) => ratesApproximatelyEqual(r.rate, rate))
    return std?.label ?? null
  }, [form.tax_rate, customTaxRates, taxCountry.standard_rates])

  useEffect(() => {
    setPeriodKind(inferPeriodKind(form))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-sync only when asset/form identity changes
  }, [syncKey])

  const showPerUnit = featurePerUnitPricing
  const effectiveKind: PeriodKind = featureExtendedRates ? periodKind : 'periodic'
  const showPeriodic = effectiveKind === 'periodic' || effectiveKind === 'both'
  const showHourly = featureExtendedRates && (effectiveKind === 'hourly' || effectiveKind === 'both')
  const singleRatePanel = !(showPeriodic && showHourly)
  const uomLabel = form.capacity_unit || 'unit'
  const nameForLabel = assetName.trim()
  const maxQtyLabel = nameForLabel ? `Max ${nameForLabel}` : 'Max Quantity'
  const sym = currencySymbol(form.currency)

  return (
    <div className="space-y-3">
      {/* Basics */}
      <div className="flex flex-wrap items-end gap-x-2 gap-y-2">
        {featureCapacityTracking && (
          <>
            <div className="w-[7rem]">
              <FieldLabel className={fieldLabelClass}>{maxQtyLabel}</FieldLabel>
              <Input
                type="number"
                min={0}
                step="any"
                value={form.capacity_max}
                onChange={(e) => set('capacity_max', e.target.value)}
                className={cn(controlClass, 'tabular-nums')}
                title={nameForLabel ? `Max ${nameForLabel} that can be booked.` : 'Max quantity that can be booked.'}
              />
            </div>
            <div className="w-[7rem]" title="Used for capacity, booking qty, and per-unit rates.">
              <FieldLabel className={fieldLabelClass}>UOM</FieldLabel>
              <RentalSuggestionCombobox
                value={form.capacity_unit}
                onChange={(v) => set('capacity_unit', v)}
                suggestions={UOM_SUGGESTIONS}
                placeholder="e.g. Packets"
                className={controlClass}
              />
            </div>
          </>
        )}
        <div className="w-[7rem]">
          <FieldLabel className={fieldLabelClass}>Currency</FieldLabel>
          <Select
            value={form.currency || 'INR'}
            onChange={(v) => set('currency', v || 'INR')}
            options={CURRENCY_SELECT_OPTIONS}
            className={controlClass}
          />
        </div>
        <div
          className="min-w-[9rem] flex-1 basis-[9rem] sm:max-w-[14rem]"
          title={selectedTaxDescription ? `${selectedTaxDescription} · Business Unit tax` : 'From Business Unit tax setup.'}
        >
          <FieldLabel className={fieldLabelClass}>{`${taxCountry.tax_label} %`}</FieldLabel>
          <Select
            value={String(Number(form.tax_rate ?? 0))}
            onChange={(v) => set('tax_rate', v || '0')}
            options={taxRateOptions}
            className={controlClass}
          />
        </div>
        <MoneyField
          className="w-[7rem]"
          label="Deposit"
          value={form.deposit_amount}
          onChange={(v) => set('deposit_amount', v)}
          symbol={sym}
        />
        {showPerUnit && (
          <div className="w-[7rem]">
            <FieldLabel className={fieldLabelClass}>{`Per ${uomLabel}`}</FieldLabel>
            <MoneyInput value={form.price_per_unit} onChange={(v) => set('price_per_unit', v)} symbol={sym} />
          </div>
        )}
      </div>

      {/* Rates */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Rates</p>
          {featureExtendedRates ? (
            <Segmented
              value={effectiveKind}
              onChange={setPeriodKind}
              options={PERIOD_KIND_OPTIONS}
            />
          ) : null}
        </div>

        <div
          className={cn(
            showPeriodic && showHourly
              ? compact
                ? 'space-y-3'
                : 'grid gap-3 sm:grid-cols-2'
              : undefined,
          )}
        >
          {showPeriodic && (
            <div className="rounded-md border border-border/60 bg-background/70 p-2.5">
              {showHourly ? (
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Periodic
                </p>
              ) : null}
              <PeriodRatesEditor
                rows={form.period_rates || []}
                onChange={(rows) => {
                  set('period_rates', rows)
                  const legacy = periodLegacyRates(rows)
                  set('daily_rate', String(legacy.daily_rate))
                  set('weekly_rate', String(legacy.weekly_rate))
                  set('monthly_rate', String(legacy.monthly_rate))
                  set('yearly_rate', String(legacy.yearly_rate))
                }}
                symbol={sym}
                wide={singleRatePanel}
              />
            </div>
          )}

          {showHourly && (
            <div className="rounded-md border border-border/60 bg-background/70 p-2.5">
              {showPeriodic ? (
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Hourly
                </p>
              ) : null}
              <DurationRatesEditor
                rows={form.duration_rates || []}
                onChange={(rows) => {
                  set('duration_rates', rows)
                  const hour = rows.find((r) => r.minutes === 60)
                  const min = rows.find((r) => r.minutes === 1)
                  set('hourly_rate', hour?.rate || '0')
                  set('per_minute_rate', min?.rate || '0')
                }}
                symbol={sym}
                wide={singleRatePanel}
              />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <p
          className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          title="₹ or % of a basis. Optional = customer chooses at booking; Always = included."
        >
          Additional fields
        </p>
        <AdditionalChargesEditor
          rows={form.additional_charges || []}
          onChange={(rows) => set('additional_charges', rows)}
          symbol={sym}
          sampleSubtotal={Number(form.daily_rate) || Number(form.hourly_rate) || Number(form.weekly_rate) || 0}
          sampleDeposit={Number(form.deposit_amount) || 0}
        />
      </div>
    </div>
  )
}
