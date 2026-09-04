/**
 * Service plan editor — same panel UX as product variants (FormTintPanel, compact grids).
 */
import { useCallback, type Dispatch, type SetStateAction, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  FormField,
  formDisplayCompact,
  formEditLayout,
  formSelectClass,
  formTextareaClass,
} from '@/components/common/FormSectionNav'
import { cn } from '@/lib/utils'
import {
  Plus, Copy, Trash2, ChevronDown, Repeat, Calendar, CalendarClock, Clock, Tag, BarChart3,
} from 'lucide-react'
import type { PlanDraft, AvailSlot } from './planDraft'
import {
  UOM_OPTIONS,
  UOM_GROUPS,
  SERVICE_MODE_OPTIONS,
  SUBSCRIPTION_INTERVALS,
  SCHEDULE_MODE_OPTIONS,
  LEAD_TIME_UNITS,
  CURRENCY_SYMBOL,
} from './serviceCatalogConstants'
import {
  FormTintPanel,
  variantFormUi,
  InputWithPrefix,
  InputWithSuffix,
  resolveVariantAccentColor,
  variantUiAccentColor,
  isLightAccentColor,
  colorPickerHexValue,
} from './variantPanelUi'

const selectCls = formSelectClass
const textareaCls = formTextareaClass

const UOM_SELECT_OPTIONS = UOM_GROUPS.flatMap((group) =>
  UOM_OPTIONS.filter((u) => u.group === group).map((u) => ({
    value: u.value,
    label: u.label,
    group,
  })),
)

type ToggleTone = 'default' | 'active' | 'booking' | 'availability' | 'lifecycle' | 'tax'

const TOGGLE_ON_BG: Record<ToggleTone, string> = {
  default: 'bg-primary',
  active: 'bg-emerald-600',
  booking: 'bg-indigo-600',
  availability: 'bg-cyan-600',
  lifecycle: 'bg-rose-600',
  tax: 'bg-amber-600',
}

const SECTION_TONE = {
  booking: {
    icon: CalendarClock,
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    labelOn: 'text-indigo-900 dark:text-indigo-100',
    panel: 'border-indigo-200/90 bg-indigo-50/45 dark:border-indigo-500/30 dark:bg-indigo-950/40',
  },
  availability: {
    icon: Calendar,
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    labelOn: 'text-cyan-900 dark:text-cyan-100',
    panel: 'border-cyan-200/90 bg-cyan-50/45 dark:border-cyan-500/30 dark:bg-cyan-950/40',
  },
  lifecycle: {
    icon: Clock,
    iconColor: 'text-rose-600 dark:text-rose-400',
    labelOn: 'text-rose-900 dark:text-rose-100',
    panel: 'border-rose-200/90 bg-rose-50/45 dark:border-rose-500/30 dark:bg-rose-950/40',
  },
} as const

function Toggle({ label, checked, onChange, tone = 'default', className, title }: {
  label?: string
  checked: boolean
  onChange: (v: boolean) => void
  tone?: ToggleTone
  className?: string
  title?: string
}) {
  return (
    <label className={cn('flex cursor-pointer select-none items-center gap-2', className)} title={title}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label || title}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 transition-colors',
          checked
            ? cn('border-transparent', TOGGLE_ON_BG[tone])
            : 'border-gray-300 bg-gray-200 dark:border-gray-500 dark:bg-gray-600',
        )}
      >
        <span className={cn(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0',
        )} />
      </button>
      {label ? (
        <span className={cn(
          'text-xs text-foreground sm:text-sm',
          checked && tone === 'tax' && 'font-medium text-amber-900 dark:text-amber-200',
          checked && tone === 'active' && 'font-medium text-emerald-900 dark:text-emerald-200',
          !checked && 'text-gray-600 dark:text-gray-300',
        )}>
          {label}
        </span>
      ) : null}
    </label>
  )
}

function SectionEnablePanel({
  tone,
  label,
  checked,
  onChange,
  children,
  className,
}: {
  tone: keyof typeof SECTION_TONE
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  children?: ReactNode
  className?: string
}) {
  const cfg = SECTION_TONE[tone]
  const Icon = cfg.icon
  return (
    <div className={cn(
      'rounded-md border transition-colors',
      checked
        ? cn(cfg.panel, 'px-2.5 py-2')
        : 'border-border/70 bg-card px-2.5 py-1.5',
      className,
    )}>
      <div className="flex items-center gap-2">
        <Toggle tone={tone} checked={checked} onChange={onChange} className="shrink-0" />
        <Icon className={cn('h-3.5 w-3.5 shrink-0', checked ? cfg.iconColor : 'text-muted-foreground')} />
        <span className={cn(
          'text-sm font-semibold',
          checked ? cfg.labelOn : 'text-muted-foreground',
        )}>
          {label}
        </span>
      </div>
      {checked && children ? (
        <div className="mt-2 space-y-1.5 border-t border-border/60 pt-2">
          {children}
        </div>
      ) : null}
    </div>
  )
}

export interface ServicePlansEditorProps {
  plans: PlanDraft[]
  setPlans: Dispatch<SetStateAction<PlanDraft[]>>
  expandedPlans: Record<number, boolean>
  setExpandedPlans: Dispatch<SetStateAction<Record<number, boolean>>>
  confirmDeletePlan: number | null
  setConfirmDeletePlan: Dispatch<SetStateAction<number | null>>
  insertPlanAt: (index: number) => void
  AvailabilityEditor: React.ComponentType<{
    availability: AvailSlot[]
    onChange: (slots: AvailSlot[]) => void
  }>
  /** Service-level: hide PRICE on business front (shown to the right of Currency). */
  priceNotApplicable?: boolean
  onPriceNotApplicableChange?: (on: boolean) => void
}

export function ServicePlansEditor({
  plans,
  setPlans,
  expandedPlans,
  setExpandedPlans,
  confirmDeletePlan,
  setConfirmDeletePlan,
  insertPlanAt,
  AvailabilityEditor,
  priceNotApplicable = false,
  onPriceNotApplicableChange,
}: ServicePlansEditorProps) {
  const updatePlan = useCallback((idx: number, patch: Partial<PlanDraft>) => {
    setPlans(p => p.map((x, i) => (i === idx ? { ...x, ...patch } : x)))
  }, [setPlans])

  const togglePlan = useCallback((idx: number) => {
    setExpandedPlans(p => ({ ...p, [idx]: !p[idx] }))
  }, [setExpandedPlans])

  const copyPlan = useCallback((idx: number) => {
    const plan = plans[idx]
    if (!plan) return
    const clone: PlanDraft = {
      ...plan,
      _key: `plan-${Date.now()}-${plans.length}`,
      name: `${plan.name || `Plan ${idx + 1}`} (copy)`,
    }
    setPlans(p => {
      const next = [...p]
      next.splice(idx + 1, 0, clone)
      return next
    })
    setExpandedPlans(p => ({ ...p, [idx + 1]: true }))
  }, [plans, setPlans, setExpandedPlans])

  const removePlan = useCallback((idx: number) => {
    setPlans(p => p.filter((_, i) => i !== idx))
    setConfirmDeletePlan(null)
  }, [setPlans, setConfirmDeletePlan])

  const syncPlanPrices = (idx: number, newPrice: number, newCompare: number) => {
    if (newCompare > 0 && newPrice >= 0 && newCompare > newPrice) {
      const pct = parseFloat(((newCompare - newPrice) / newCompare * 100).toFixed(2))
      const amt = parseFloat((newCompare - newPrice).toFixed(2))
      const plan = plans[idx]
      const dateStr = (plan?.discount_start_date && plan?.discount_end_date)
        ? ` · Valid ${new Date(plan.discount_start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}–${new Date(plan.discount_end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`
        : ''
      updatePlan(idx, {
        discount_percentage: pct.toFixed(2),
        discount_amount: amt.toFixed(2),
        offer_label: (!plan?.offer_label || /^\d/.test(plan.offer_label)) ? `${pct.toFixed(1)}% OFF${dateStr}` : plan.offer_label,
        enable_pricing: true,
      })
    }
  }

  return (
    <div
      id="form-section-subscription"
      className={cn(formDisplayCompact.scrollMarginEdit, 'flex flex-col gap-1.5 sm:gap-2')}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-gray-600">
          Each plan is like a product variant — own pricing, billing, tax, and booking rules.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 self-end sm:self-auto"
          onClick={() => insertPlanAt(plans.length)}
        >
          <Plus className="mr-1 h-4 w-4" />Add plan
        </Button>
      </div>

      {plans.length === 0 ? (
        <p className="rounded-lg bg-muted/25 py-4 text-center text-xs text-gray-500 sm:text-sm">
          No plans yet — use Add plan to define pricing.
        </p>
      ) : (
        <div className={formDisplayCompact.pageGap}>
          {plans.map((plan, idx) => {
            const isExpanded = expandedPlans[idx] ?? false
            const accentColor = resolveVariantAccentColor(plan.color, idx)
            const uiAccent = variantUiAccentColor(accentColor, idx)
            const lightAccent = isLightAccentColor(accentColor)
            const uomLbl = UOM_OPTIONS.find(u => u.value === plan.uom)?.label || plan.uom
            const priceLabel = plan.service_frequency === 'recurring' && plan.price_type === 'per_cycle'
              ? 'Price / Cycle'
              : `Price / ${uomLbl}`
            const pPrice = parseFloat(plan.price || '0')
            const isFree = plan.plan_price_type === 'free'
            const pricingLocked = priceNotApplicable || isFree
            const pCompare = parseFloat(plan.compare_at_price || '0')
            const pCost = parseFloat(plan.cost_price || '0')
            const discPct = parseFloat(plan.discount_percentage || '0')
            const discAmt = parseFloat(plan.discount_amount || '0')
            const autoDiscPct = (pCompare > 0 && pPrice >= 0 && pCompare > pPrice)
              ? parseFloat(((pCompare - pPrice) / pCompare * 100).toFixed(2)) : 0
            const profit = (pPrice > 0 && pCost > 0) ? pPrice - pCost : null
            const margin = profit != null ? (profit / pPrice * 100) : null
            const currSym = CURRENCY_SYMBOL[plan.currency] || plan.currency
            const hasPromo = discPct > 0 || discAmt > 0

            return (
              <div key={plan._key} className="space-y-2">
                <FormTintPanel
                  accentColor={accentColor}
                  active={plan.is_active}
                  headerAccentOnly
                  header={
                    <div
                      className={cn(
                        'flex cursor-pointer select-none flex-wrap items-center justify-between gap-x-2 gap-y-1.5 px-2 py-1.5 sm:px-2.5',
                        plan.is_active ? 'hover:bg-black/[0.03]' : 'hover:bg-black/[0.04]',
                      )}
                      onClick={() => togglePlan(idx)}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span
                          className={cn(
                            'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white',
                            !plan.is_active && 'bg-gray-400',
                          )}
                          style={plan.is_active ? { backgroundColor: uiAccent } : undefined}
                        >
                          {idx + 1}
                        </span>
                        <Input
                          value={plan.name}
                          onChange={e => updatePlan(idx, { name: e.target.value })}
                          onClick={e => e.stopPropagation()}
                          onFocus={e => e.stopPropagation()}
                          placeholder={`Plan ${idx + 1}`}
                          className={cn(
                            'h-8 min-w-[7rem] max-w-[12rem] flex-1 text-sm font-semibold',
                            lightAccent ? 'border-gray-300 bg-white text-gray-800' : 'border-white/60 bg-white/70',
                            !plan.is_active && 'text-gray-500',
                          )}
                          style={plan.is_active && !lightAccent ? { color: uiAccent } : undefined}
                        />
                        {!plan.is_active && (
                          <span className="inline-flex shrink-0 items-center rounded-full bg-gray-200/80 px-2 py-0.5 text-xs font-medium text-gray-600">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2 sm:gap-3" onClick={e => e.stopPropagation()}>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <div
                            className="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded border-2 border-gray-400 shadow-sm"
                            style={{ backgroundColor: colorPickerHexValue(plan.color) }}
                            title="Pick color"
                          >
                            <input
                              type="color"
                              value={colorPickerHexValue(plan.color)}
                              onChange={e => updatePlan(idx, { color: e.target.value.toUpperCase() })}
                              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            />
                          </div>
                        </div>
                        <Toggle
                          label="Active"
                          tone="active"
                          checked={plan.is_active}
                          onChange={v => updatePlan(idx, { is_active: v })}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-indigo-500 hover:bg-indigo-50 hover:text-indigo-700"
                          title="Copy plan"
                          onClick={() => copyPlan(idx)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        {confirmDeletePlan === idx ? (
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 bg-red-600 px-2 text-xs text-white hover:bg-red-700"
                              onClick={() => removePlan(idx)}
                            >
                              Delete
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => setConfirmDeletePlan(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 text-red-500 hover:bg-red-50 hover:text-red-700"
                            title="Delete plan"
                            onClick={() => setConfirmDeletePlan(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  }
                >
                  {isExpanded && (
                    <div className={cn(formEditLayout.sectionContent, variantFormUi.body, '!border-t-0 !px-0 !pb-0 !pt-0')}>
                      {/* Pricing — price fields on one row; order + tax on the next */}
                      <div className="space-y-1">
                        <div className={cn(
                          'grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-10',
                          variantFormUi.grid,
                          'items-start [&>*]:min-w-0 [&_label]:min-w-0 [&_label]:max-w-full [&_label]:truncate [&_input[type=number]]:tabular-nums',
                        )}>
                          <FormField label={priceLabel} className={cn(pricingLocked && 'opacity-50')}>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              disabled={pricingLocked}
                              className="w-full min-w-0"
                              value={isFree ? '0' : plan.price}
                              onChange={e => {
                                updatePlan(idx, { price: e.target.value, enable_pricing: true })
                                syncPlanPrices(idx, parseFloat(e.target.value || '0'), pCompare)
                              }}
                              placeholder="499"
                            />
                          </FormField>
                          <FormField label="Qty">
                            <Input
                              type="number"
                              step="any"
                              min="0"
                              className="w-full min-w-0"
                              value={plan.uom_quantity}
                              onChange={e => updatePlan(idx, { uom_quantity: e.target.value })}
                              placeholder="1"
                            />
                          </FormField>
                          <FormField label="UOM">
                            <Select
                              value={plan.uom}
                              onChange={(v) => updatePlan(idx, { uom: v })}
                              className={cn(selectCls, 'h-8 min-h-8 w-full min-w-0 sm:h-9')}
                              options={UOM_SELECT_OPTIONS}
                            />
                          </FormField>
                          <FormField label="Compare-at (MRP)" className={cn(pricingLocked && 'opacity-50')}>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              disabled={pricingLocked}
                              className="w-full min-w-0"
                              value={plan.compare_at_price}
                              onChange={e => {
                                updatePlan(idx, { compare_at_price: e.target.value, enable_pricing: true })
                                syncPlanPrices(idx, pPrice, parseFloat(e.target.value || '0'))
                              }}
                            />
                          </FormField>
                          <FormField label="Cost Price" className={cn(pricingLocked && 'opacity-50')}>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              disabled={pricingLocked}
                              className="w-full min-w-0"
                              value={plan.cost_price}
                              onChange={e => updatePlan(idx, { cost_price: e.target.value, enable_pricing: true })}
                            />
                          </FormField>
                          <FormField label="Currency" className={cn(pricingLocked && 'opacity-50')}>
                            <Select
                              value={plan.currency}
                              onChange={(v) => updatePlan(idx, { currency: v })}
                              disabled={pricingLocked}
                              className={cn(selectCls, 'h-8 min-h-8 w-full min-w-0 sm:h-9')}
                              options={[
                                { value: 'INR', label: '₹ INR' },
                                { value: 'USD', label: '$ USD' },
                                { value: 'EUR', label: '€ EUR' },
                                { value: 'GBP', label: '£ GBP' },
                              ]}
                            />
                          </FormField>
                          <FormField label="Discount %" className={cn(pricingLocked && 'opacity-50')}>
                            <InputWithSuffix
                              suffix="%"
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              disabled={pricingLocked}
                              className="w-full min-w-0"
                              value={plan.discount_percentage}
                              onChange={e => updatePlan(idx, { discount_percentage: e.target.value })}
                              placeholder="0"
                            />
                          </FormField>
                          <FormField label="Disc. Amount" className={cn(pricingLocked && 'opacity-50')}>
                            <InputWithPrefix
                              prefix={currSym}
                              type="number"
                              step="0.01"
                              min="0"
                              disabled={pricingLocked}
                              className="w-full min-w-0"
                              value={plan.discount_amount}
                              onChange={e => updatePlan(idx, { discount_amount: e.target.value })}
                              placeholder="0"
                            />
                          </FormField>
                          <FormField label="Free">
                            <div className="flex h-8 items-center sm:h-9">
                              <input
                                type="checkbox"
                                className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                                checked={isFree}
                                disabled={priceNotApplicable}
                                title="Show as Free on the business front (price is zero)."
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    updatePlan(idx, {
                                      plan_price_type: 'free',
                                      price: '0',
                                      compare_at_price: '',
                                      cost_price: '',
                                      discount_percentage: '',
                                      discount_amount: '',
                                      enable_pricing: true,
                                    })
                                  } else {
                                    updatePlan(idx, { plan_price_type: 'fixed' })
                                  }
                                }}
                              />
                            </div>
                          </FormField>
                          {onPriceNotApplicableChange ? (
                            <FormField label="No Price">
                              <div className="flex h-8 items-center sm:h-9">
                                <Toggle
                                  checked={priceNotApplicable}
                                  onChange={(on) => {
                                    if (on && isFree) {
                                      updatePlan(idx, { plan_price_type: 'fixed' })
                                    }
                                    onPriceNotApplicableChange(on)
                                  }}
                                  title="Hide the PRICE section on the business front. Customers reach you via quotation instead of seeing Get a Quote."
                                />
                              </div>
                            </FormField>
                          ) : (
                            <div className="hidden lg:block" aria-hidden />
                          )}
                        </div>

                        <div className={cn(
                          'grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7',
                          variantFormUi.grid,
                          'items-start [&>*]:min-w-0 [&_label]:min-w-0 [&_label]:max-w-full [&_label]:truncate [&_input[type=number]]:tabular-nums',
                        )}>
                          <FormField label={`Time / ${uomLbl.replace(/\s*\(.*\)/, '')}`}>
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              className="w-full min-w-0"
                              value={plan.duration_minutes}
                              onChange={e => updatePlan(idx, { duration_minutes: e.target.value })}
                              placeholder="60"
                            />
                          </FormField>
                          <FormField label="Max / order">
                            <Input
                              type="number"
                              min="1"
                              className="w-full min-w-0"
                              value={plan.max_quantity_per_order}
                              onChange={e => updatePlan(idx, { max_quantity_per_order: e.target.value })}
                              placeholder="No limit"
                            />
                          </FormField>
                          <FormField label="Min / order">
                            <Input
                              type="number"
                              min="1"
                              className="w-full min-w-0"
                              value={plan.min_quantity_per_order}
                              onChange={e => updatePlan(idx, { min_quantity_per_order: e.target.value })}
                              placeholder="1"
                            />
                          </FormField>
                          <FormField label="Tax Rate %">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              className="w-full min-w-0"
                              value={plan.tax_rate}
                              onChange={e => updatePlan(idx, { tax_rate: e.target.value, enable_tax: true })}
                              placeholder="0"
                            />
                          </FormField>
                          <FormField label="GST Rate %">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              className="w-full min-w-0"
                              value={plan.gst_rate}
                              onChange={e => updatePlan(idx, { gst_rate: e.target.value, enable_tax: true })}
                              placeholder="0"
                            />
                          </FormField>
                          <FormField label="SAC Code">
                            <Input
                              className="w-full min-w-0"
                              value={plan.sac_code}
                              onChange={e => updatePlan(idx, { sac_code: e.target.value, enable_tax: true })}
                              placeholder="998311"
                              maxLength={8}
                            />
                          </FormField>
                          <FormField label="Taxable">
                            <div className="flex h-8 items-center sm:h-9">
                              <Toggle
                                tone="tax"
                                checked={plan.is_taxable}
                                onChange={v => updatePlan(idx, { is_taxable: v, enable_tax: true })}
                              />
                            </div>
                          </FormField>
                        </div>
                        {hasPromo && (
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <FormField label="Offer Label">
                              <Input
                                className="w-full min-w-0"
                                value={plan.offer_label}
                                onChange={e => updatePlan(idx, { offer_label: e.target.value })}
                                placeholder={discPct > 0 ? `${discPct.toFixed(1)}% OFF` : 'Flash Sale'}
                              />
                            </FormField>
                            <FormField label="Promo Start">
                              <Input
                                type="date"
                                className="w-full"
                                value={plan.discount_start_date}
                                onChange={e => updatePlan(idx, { discount_start_date: e.target.value })}
                              />
                            </FormField>
                            <FormField label="Promo End">
                              <Input
                                type="date"
                                className="w-full"
                                value={plan.discount_end_date}
                                onChange={e => updatePlan(idx, { discount_end_date: e.target.value })}
                              />
                            </FormField>
                          </div>
                        )}
                        {(profit != null || autoDiscPct > 0) && (
                          <div className="mt-1 flex flex-wrap items-center gap-3">
                            {autoDiscPct > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">
                                <Tag className="h-3 w-3" />{autoDiscPct.toFixed(1)}% OFF
                              </span>
                            )}
                            {profit != null && (
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold ${profit >= 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                                <BarChart3 className="h-3 w-3" />
                                {profit >= 0 ? 'Profit' : 'Loss'}: {currSym}{Math.abs(profit).toLocaleString()}
                                {margin != null && <span className="ml-0.5 font-normal opacity-80">({margin.toFixed(1)}%)</span>}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Service config */}
                        <div className={cn(variantFormUi.sectionRule, 'space-y-1.5')}>
                          <p className={variantFormUi.sectionHeading}>Service</p>
                          <div className={cn(
                            'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(10rem,12rem)_minmax(10rem,14rem)_minmax(0,1fr)]',
                            variantFormUi.grid,
                            'items-start [&>*]:min-w-0',
                          )}>
                            <FormField label="Billing Type">
                              <div className="inline-flex h-8 w-full overflow-hidden rounded-md border border-border text-xs sm:h-9">
                                <button
                                  type="button"
                                  className={cn(
                                    'flex-1 px-2.5 font-medium transition-colors',
                                    plan.service_frequency === 'once'
                                      ? 'bg-primary text-white'
                                      : 'text-muted-foreground hover:bg-accent',
                                  )}
                                  onClick={() => updatePlan(idx, { service_frequency: 'once' })}
                                >
                                  Once
                                </button>
                                <button
                                  type="button"
                                  className={cn(
                                    'flex-1 px-2.5 font-medium transition-colors',
                                    plan.service_frequency === 'recurring'
                                      ? 'bg-primary text-white'
                                      : 'text-muted-foreground hover:bg-accent',
                                  )}
                                  onClick={() => updatePlan(idx, { service_frequency: 'recurring' })}
                                >
                                  Recurring
                                </button>
                              </div>
                            </FormField>
                            <FormField label="Service Mode">
                              <Select
                                value={plan.service_mode}
                                onChange={(v) => updatePlan(idx, { service_mode: v })}
                                className={cn(selectCls, 'h-8 min-h-8 w-full min-w-0 sm:h-9')}
                                options={SERVICE_MODE_OPTIONS.map((m) => ({ value: m.value, label: m.label }))}
                              />
                            </FormField>
                            <FormField label="Description" className="sm:col-span-2 lg:col-span-1">
                              <Input
                                className="w-full min-w-0"
                                value={plan.description}
                                onChange={e => updatePlan(idx, { description: e.target.value })}
                                placeholder="Short plan description"
                              />
                            </FormField>
                          </div>
                        </div>

                        {/* Billing — recurring only */}
                        {plan.service_frequency === 'recurring' && (
                          <div className={cn(variantFormUi.sectionRule, 'space-y-1')}>
                            <div className="flex items-center justify-between gap-2">
                              <p className={cn(variantFormUi.sectionHeading, 'flex items-center gap-1 text-primary')}>
                                <Repeat className="h-3 w-3" />Billing
                              </p>
                              <div className="inline-flex overflow-hidden rounded border border-primary/30 text-xs">
                                <button
                                  type="button"
                                  className={cn(
                                    'px-2.5 py-1 font-medium transition-colors',
                                    plan.price_type === 'per_cycle' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-accent',
                                  )}
                                  onClick={() => updatePlan(idx, { price_type: 'per_cycle' })}
                                >
                                  Per Cycle
                                </button>
                                <button
                                  type="button"
                                  className={cn(
                                    'px-2.5 py-1 font-medium transition-colors',
                                    plan.price_type === 'per_unit' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-accent',
                                  )}
                                  onClick={() => updatePlan(idx, { price_type: 'per_unit' })}
                                >
                                  Per UOM
                                </button>
                              </div>
                            </div>
                            <div className={cn('grid grid-cols-2 md:grid-cols-4', variantFormUi.grid)}>
                              <FormField label="Billing Interval">
                                <Select
                                  value={plan.subscription_interval}
                                  onChange={(v) => updatePlan(idx, { subscription_interval: v })}
                                  className={selectCls}
                                  placeholder="Select…"
                                  options={[
                                    { value: '', label: 'Select…' },
                                    ...SUBSCRIPTION_INTERVALS.map((si) => ({ value: si.value, label: si.label })),
                                  ]}
                                />
                              </FormField>
                              <FormField label="Max Billing Cycles">
                                <Input
                                  type="number"
                                  min="0"
                                  value={plan.subscription_billing_cycles}
                                  onChange={e => updatePlan(idx, { subscription_billing_cycles: e.target.value })}
                                  placeholder="0 = ∞"
                                />
                              </FormField>
                              <FormField label="Free Trial (days)">
                                <Input
                                  type="number"
                                  min="0"
                                  value={plan.subscription_trial_days}
                                  onChange={e => updatePlan(idx, { subscription_trial_days: e.target.value })}
                                  placeholder="14"
                                />
                              </FormField>
                              <FormField label="Setup Fee">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={plan.subscription_setup_fee}
                                  onChange={e => updatePlan(idx, { subscription_setup_fee: e.target.value })}
                                  placeholder="99"
                                />
                              </FormField>
                            </div>
                            <div>
                              <p className={cn(variantFormUi.sectionHeading, 'mb-1')}>Customer scheduling options</p>
                              <div className="flex flex-wrap gap-1.5">
                                {SCHEDULE_MODE_OPTIONS.map(opt => {
                                  const active = plan.subscription_schedule_modes.includes(opt.value)
                                  return (
                                    <button
                                      key={opt.value}
                                      type="button"
                                      onClick={() => {
                                        const next = active
                                          ? plan.subscription_schedule_modes.filter(s => s !== opt.value)
                                          : [...plan.subscription_schedule_modes, opt.value]
                                        if (next.length === 0) return
                                        updatePlan(idx, { subscription_schedule_modes: next })
                                      }}
                                      className={cn(
                                        'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                                        active
                                          ? 'border-primary bg-primary text-white'
                                          : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary',
                                      )}
                                    >
                                      {opt.label}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        )}

                      </div>

                      {/* Optional sections — compact toggles; expand only when on */}
                      <div className={cn(variantFormUi.sectionRule, 'space-y-1.5 pt-2')}>
                        <p className={variantFormUi.sectionHeading}>Options</p>
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                          <SectionEnablePanel
                            tone="booking"
                            label="Booking"
                            checked={plan.enable_booking}
                            onChange={v => updatePlan(idx, { enable_booking: v })}
                            className={plan.enable_booking ? 'sm:col-span-3' : undefined}
                          >
                            <Toggle
                              label="Requires Booking"
                              tone="booking"
                              checked={plan.requires_booking}
                              onChange={v => updatePlan(idx, { requires_booking: v })}
                            />
                            <div className={cn('grid grid-cols-1 sm:grid-cols-2', variantFormUi.grid)}>
                              <FormField label="Max Bookings / Slot">
                                <Input
                                  type="number"
                                  min="1"
                                  value={plan.max_bookings_per_slot}
                                  onChange={e => updatePlan(idx, { max_bookings_per_slot: e.target.value })}
                                />
                              </FormField>
                              <FormField label="Bookable days ahead">
                                <Input
                                  type="number"
                                  min="0"
                                  value={plan.advance_booking_days}
                                  onChange={e => updatePlan(idx, { advance_booking_days: e.target.value })}
                                />
                              </FormField>
                              <FormField label="Min. notice" className="sm:col-span-2">
                                <div className="flex gap-1.5">
                                  <Input
                                    type="number"
                                    min="0"
                                    className="w-20"
                                    value={plan.booking_lead_time_value}
                                    onChange={e => updatePlan(idx, { booking_lead_time_value: e.target.value })}
                                    placeholder="0"
                                  />
                                  <Select
                                    value={plan.booking_lead_time_unit}
                                    onChange={(v) => updatePlan(idx, { booking_lead_time_unit: v })}
                                    className={selectCls}
                                    options={LEAD_TIME_UNITS.map((u) => ({ value: u.value, label: u.label }))}
                                  />
                                </div>
                              </FormField>
                            </div>
                            <FormField label="Cancellation Policy">
                              <textarea
                                value={plan.cancellation_policy}
                                rows={2}
                                className={textareaCls}
                                onChange={e => updatePlan(idx, { cancellation_policy: e.target.value })}
                                placeholder="Free cancellation up to 24 hours before"
                              />
                            </FormField>
                          </SectionEnablePanel>

                          <SectionEnablePanel
                            tone="lifecycle"
                            label="Lifecycle"
                            checked={plan.enable_lifecycle}
                            onChange={v => updatePlan(idx, { enable_lifecycle: v })}
                            className={plan.enable_lifecycle ? 'sm:col-span-3' : undefined}
                          >
                            <div className={cn('grid grid-cols-1 sm:grid-cols-2', variantFormUi.grid)}>
                              <FormField label="Expiry Date">
                                <Input
                                  type="date"
                                  value={plan.service_expiry_date}
                                  onChange={e => updatePlan(idx, { service_expiry_date: e.target.value })}
                                />
                              </FormField>
                              <FormField label="Valid for (days)">
                                <Input
                                  type="number"
                                  min="0"
                                  value={plan.validity_period_days}
                                  onChange={e => updatePlan(idx, { validity_period_days: e.target.value })}
                                  placeholder="30"
                                />
                              </FormField>
                            </div>
                            <Toggle
                              label="Renewal Required"
                              tone="lifecycle"
                              checked={plan.renewal_required}
                              onChange={v => updatePlan(idx, { renewal_required: v })}
                            />
                          </SectionEnablePanel>

                          <SectionEnablePanel
                            tone="availability"
                            label="Availability"
                            checked={plan.enable_availability}
                            onChange={v => updatePlan(idx, { enable_availability: v })}
                            className={plan.enable_availability ? 'sm:col-span-3' : undefined}
                          >
                            <AvailabilityEditor
                              availability={plan.availability}
                              onChange={newAvail => updatePlan(idx, { availability: newAvail })}
                            />
                          </SectionEnablePanel>
                        </div>
                      </div>
                    </div>
                  )}
                </FormTintPanel>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
