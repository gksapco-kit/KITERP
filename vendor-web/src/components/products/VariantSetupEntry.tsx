import type { ComponentType } from 'react'
import { Check, Cpu, Factory, Plus, Settings2, Shirt, Zap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface VariantSetupTemplate {
  id: string
  title: string
  description: string
  example: string
  icon: ComponentType<{ className?: string }>
  options: { name: string; values: string[] }[]
  popular?: boolean
}

export const VARIANT_SETUP_TEMPLATES: VariantSetupTemplate[] = [
  {
    id: 'clothing',
    title: 'Clothing & Apparel',
    description: 'Size + Color',
    example: 'Red / Large, Blue / Medium',
    icon: Shirt,
    popular: true,
    options: [
      { name: 'Size', values: ['S', 'M', 'L', 'XL'] },
      { name: 'Color', values: ['Red', 'Blue', 'Black'] },
    ],
  },
  {
    id: 'electronics',
    title: 'Electronics',
    description: 'Storage + Color',
    example: '128GB / Black, 256GB / Silver',
    icon: Cpu,
    options: [
      { name: 'Storage', values: ['128GB', '256GB', '512GB'] },
      { name: 'Color', values: ['Black', 'Silver'] },
    ],
  },
  {
    id: 'industrial_motor',
    title: 'Industrial Motor',
    description: 'Voltage + Phase + Cooling',
    example: '415V / Three Phase / Oil Cooling',
    icon: Zap,
    popular: true,
    options: [
      { name: 'Voltage', values: ['220V', '240V', '415V'] },
      { name: 'Phase', values: ['Single Phase', 'Three Phase'] },
      { name: 'Cooling', values: ['Air Cooled', 'Oil Cooled', 'Water Cooled'] },
    ],
  },
  {
    id: 'machinery',
    title: 'Machinery & Equipment',
    description: 'Power + Material + Grade',
    example: '5 kW / Steel / Export Grade',
    icon: Factory,
    options: [
      { name: 'Power Rating', values: ['1 kW', '2 kW', '5 kW', '10 kW'] },
      { name: 'Material', values: ['Steel', 'Aluminium', 'Cast Iron'] },
      { name: 'Grade', values: ['Standard', 'Premium', 'Export'] },
    ],
  },
  {
    id: 'b2b_bulk',
    title: 'B2B Bulk / Wholesale',
    description: 'Pack size + Quantity',
    example: 'Pack of 6 / 24 units',
    icon: Settings2,
    options: [
      { name: 'Pack Size', values: ['Single', 'Pack of 6', 'Pack of 12', 'Carton'] },
      { name: 'Quantity per Pack', values: ['1', '6', '12', '24'] },
    ],
  },
  {
    id: 'scratch',
    title: 'Start from scratch',
    description: 'Add your own options',
    example: 'Custom option names and values',
    icon: Plus,
    options: [],
  },
]

interface Props {
  onSelectTemplate: (template: VariantSetupTemplate) => void
  onManageExisting: () => void
  hasExistingVariants: boolean
}

export function VariantSetupEntry({
  onSelectTemplate, onManageExisting, hasExistingVariants,
}: Props) {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-foreground">How do you want to set up variants?</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Pick a starting point — you can always customize later.
        </p>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {VARIANT_SETUP_TEMPLATES.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTemplate(t)}
              className="text-left"
            >
              <Card className={cn(
                'h-full transition-all hover:border-primary/50 hover:shadow-sm',
                t.popular && 'ring-1 ring-primary/20',
              )}>
                <CardContent className="space-y-1.5 p-3">
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    {t.popular && (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                        Most popular
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-snug text-foreground">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  </div>
                  <p className="text-[11px] leading-snug text-muted-foreground">{t.example}</p>
                </CardContent>
              </Card>
            </button>
          )
        })}
      </div>

      {hasExistingVariants && (
        <div className="flex flex-col items-center gap-3 border-t pt-4">
          <span className="text-xs text-muted-foreground">or</span>
          <Button variant="outline" onClick={onManageExisting}>
            I already have variants — manage prices &amp; stock
          </Button>
        </div>
      )}
    </div>
  )
}

export function WizardStepIndicator({
  steps,
  current,
  onStepClick,
  canClickStep,
  showLabels,
  compact,
}: {
  steps: { id: string; label: string; hint: string }[]
  current: number
  onStepClick?: (index: number) => void
  /** Override which steps are clickable (default: index <= current). */
  canClickStep?: (index: number) => boolean
  /** Always show step titles (not only from sm breakpoint up). */
  showLabels?: boolean
  /** Compact layout for page header — hides hints, smaller circles. */
  compact?: boolean
}) {
  return (
    <ol className={cn(
      'flex w-full min-w-0 flex-nowrap items-center',
      compact ? 'gap-0' : 'gap-0.5 sm:gap-0',
    )}>
      {steps.map((step, idx) => {
        const done = idx < current
        const active = idx === current
        const clickable = !!onStepClick && (canClickStep ? canClickStep(idx) : idx <= current)
        return (
          <li key={step.id} className="flex min-w-0 shrink items-center">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick?.(idx)}
              className={cn(
                'flex min-w-0 items-center gap-1 text-left',
                compact ? 'rounded-md px-1 py-0.5 sm:px-1.5 sm:py-1' : 'rounded-lg px-1.5 py-1 sm:px-2.5 sm:py-1.5',
                active && 'bg-primary/10',
                clickable && 'cursor-pointer hover:bg-muted/50',
                !clickable && 'cursor-default',
              )}
            >
              <span className={cn(
                'flex shrink-0 items-center justify-center rounded-full font-semibold',
                compact ? 'h-5 w-5 text-[10px] sm:h-6 sm:w-6 sm:text-[11px]' : 'h-6 w-6 text-[11px] sm:h-7 sm:w-7 sm:text-xs',
                done && 'bg-emerald-500 text-white',
                active && !done && 'bg-primary text-primary-foreground',
                !active && !done && 'bg-muted text-muted-foreground',
              )}>
                {done ? <Check className={compact ? 'h-2.5 w-2.5 sm:h-3 sm:w-3' : 'h-3 w-3 sm:h-3.5 sm:w-3.5'} /> : idx + 1}
              </span>
              <div className={cn(
                'min-w-0',
                showLabels ? 'block' : 'hidden sm:block',
                compact && 'hidden md:block',
              )}>
                <p className={cn(
                  'truncate font-medium leading-tight',
                  compact ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm',
                  active ? 'text-primary' : 'text-foreground',
                )}>
                  {step.label}
                </p>
                {!compact && (
                  <p className="hidden truncate text-[11px] text-muted-foreground sm:block">{step.hint}</p>
                )}
              </div>
            </button>
            {idx < steps.length - 1 && (
              <div className={cn(
                'mx-0.5 h-px shrink-0 sm:mx-1',
                compact ? 'w-2 sm:w-3 md:w-4' : 'w-3 sm:w-5 md:w-8',
                done ? 'bg-emerald-300' : 'bg-border',
              )} />
            )}
          </li>
        )
      })}
    </ol>
  )
}
