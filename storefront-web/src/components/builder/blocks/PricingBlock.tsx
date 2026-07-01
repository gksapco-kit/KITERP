import { Check } from 'lucide-react'
import { useState } from 'react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { BuilderCtaButton } from '@/components/builder/BuilderCtaButton'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { columnsFromProps, sectionGridColumnClass, sectionItemGap } from '@/lib/sectionItemLayout'
import { resolvePricingPlans, isLivePlansDataSource, type PricingPlanItem } from '@/lib/pricingPlansLive'
import { cn } from '@/lib/utils'
import {
  isBlockFieldHidden,
  isNestedBlockFieldHidden,
  resolveBlockTextField,
  visibleArrayEntries,
} from '@/lib/blockHiddenFields'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null; blockId?: string }

function resolvePlanHighlighted(
  index: number,
  total: number,
  plan: PricingPlanItem,
  props: Record<string, unknown>,
): boolean {
  if (props.highlight_last === true) return index === total - 1
  if (props.highlight_middle === true) return index === Math.floor(total / 2)
  if (props.highlight_first === true) return index === 0
  return Boolean(plan.highlighted)
}

export default function PricingBlock({ style, props, liveItems, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId

  const title = resolveBlockTextField(props, 'title', {
    fallback: () => (isEditorCanvas ? null : 'Pricing'),
  })
  const subtitle = resolveBlockTextField(props, 'subtitle')
  const rawPlans = resolvePricingPlans(props, liveItems ?? [])
  const usingLivePlans = isLivePlansDataSource(props) || (liveItems?.length ?? 0) > 0
  const visiblePlans = usingLivePlans
    ? rawPlans.map((item, index) => ({ item, index }))
    : visibleArrayEntries(rawPlans, props, 'plans')
  const columns = columnsFromProps(props)
  const itemGap = sectionItemGap(props, 24)
  const isDark = props.bg_style === 'dark'
  const isCompact = props.card_style === 'compact'
  const isHorizontal = props.layout === 'horizontal'
  const showAnnualToggle = props.show_annual_toggle === true
  const [billingAnnual, setBillingAnnual] = useState(false)

  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditorCanvas)
  const showSubtitle = !isBlockFieldHidden(props, 'subtitle') && (subtitle || isEditorCanvas)

  if (rawPlans.length === 0 || (visiblePlans.length === 0 && !isEditorCanvas && !showTitle)) {
    return (
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
        {showTitle && (
          <BuilderTextField fieldKey="title" blockId={blockId} blockProps={props} value={title ?? ''} as="h2" className="text-3xl font-bold text-gray-900 mb-10 text-center" placeholder="Section title" />
        )}
        {showSubtitle && (
          <BuilderTextField fieldKey="subtitle" blockId={blockId} blockProps={props} value={subtitle ?? ''} as="p" className="text-gray-500 text-center mb-10 -mt-6" placeholder="Section subtitle" />
        )}
        <BlockEmptyPlaceholder
          style={style}
          title={title ?? 'Pricing'}
          message={usingLivePlans
            ? 'Add active pricing plans in Sales → Pricing Plans to show packages here.'
            : 'Add pricing plans or packages so visitors can compare options and choose what fits them.'}
        />
      </section>
    )
  }

  return (
    <section className={cn(
      'py-16 px-4 sm:px-6 lg:px-8 mx-auto',
      isDark ? 'bg-gray-900' : '',
      isHorizontal ? 'max-w-full' : 'max-w-7xl',
    )}>
      {showTitle && (
        <BuilderTextField fieldKey="title" blockId={blockId} blockProps={props} value={title ?? ''} as="h2" className={cn('text-3xl font-bold mb-10 text-center', isDark ? 'text-white' : 'text-gray-900')} placeholder="Section title" />
      )}
      {showSubtitle && (
        <BuilderTextField fieldKey="subtitle" blockId={blockId} blockProps={props} value={subtitle ?? ''} as="p" className={cn('text-gray-500 text-center mb-10 -mt-6', isDark && 'text-gray-400')} placeholder="Section subtitle" />
      )}
      {showAnnualToggle && (
        <div className="mb-10 flex justify-center">
          <div className={cn('inline-flex rounded-full border p-1 text-sm', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-100')}>
            <button
              type="button"
              className={cn(
                'rounded-full px-4 py-1.5 font-medium transition-colors',
                !billingAnnual ? (isDark ? 'bg-white text-gray-900' : 'bg-white text-gray-900 shadow-sm') : (isDark ? 'text-gray-300' : 'text-gray-500'),
              )}
              onClick={() => setBillingAnnual(false)}
            >
              Monthly
            </button>
            <button
              type="button"
              className={cn(
                'rounded-full px-4 py-1.5 font-medium transition-colors',
                billingAnnual ? (isDark ? 'bg-white text-gray-900' : 'bg-white text-gray-900 shadow-sm') : (isDark ? 'text-gray-300' : 'text-gray-500'),
              )}
              onClick={() => setBillingAnnual(true)}
            >
              Annual
            </button>
          </div>
        </div>
      )}
      <div
        className={cn(
          isHorizontal
            ? 'mx-auto flex max-w-5xl snap-x snap-mandatory gap-6 overflow-x-auto pb-2'
            : cn('mx-auto grid max-w-4xl grid-cols-1', sectionGridColumnClass(columns)),
        )}
        style={{ gap: itemGap }}
      >
        {visiblePlans.map(({ item: plan, index: i }) => {
          const planKey = usingLivePlans ? `live-${i}-${plan.name}` : i
          const highlighted = resolvePlanHighlighted(i, visiblePlans.length, plan, props)
          const periodLabel = billingAnnual ? 'yr' : (plan.period ?? 'mo')
          const showName = !usingLivePlans && !isNestedBlockFieldHidden(props, `plans.${i}.name`)
          const showPrice = !usingLivePlans && !isNestedBlockFieldHidden(props, `plans.${i}.price`)
          const showPeriod = !usingLivePlans && !isNestedBlockFieldHidden(props, `plans.${i}.period`)
          const showCta = !usingLivePlans && !isNestedBlockFieldHidden(props, `plans.${i}.cta`)
          const ctaUrl = String(plan.cta_url ?? '').trim()
          const ctaClass = cn(
            'mt-8 w-full rounded-xl py-3 text-sm font-semibold transition-all hover:opacity-90',
            highlighted ? 'bg-white' : 'text-white',
            isCompact && 'py-2.5',
          )
          const ctaStyle = highlighted ? { color: style.primary_color } : { backgroundColor: style.primary_color }

          return (
          <div
            key={planKey}
            className={cn(
              'builder-tile-card flex flex-col rounded-2xl',
              isCompact ? 'p-5' : 'p-8',
              isHorizontal && 'min-w-[280px] shrink-0 snap-center',
              highlighted ? 'scale-105 text-white shadow-xl' : 'border border-gray-100 bg-white',
            )}
            style={highlighted ? { backgroundColor: style.primary_color } : {}}
          >
            {(showName || usingLivePlans) && (
              usingLivePlans ? (
                <h3 className={cn('mb-2 text-lg font-bold', highlighted ? 'text-white' : (isDark ? 'text-gray-900' : 'text-gray-900'))}>{plan.name}</h3>
              ) : (
              <BuilderTextField
                fieldKey={`plans.${i}.name`}
                blockId={blockId}
                blockProps={props}
                value={plan.name}
                as="h3"
                className={`font-bold text-lg mb-2 ${highlighted ? 'text-white' : 'text-gray-900'}`}
                skipPositionWrapper
                placeholder="Plan name"
              />
              )
            )}
            {(showPrice || showPeriod || usingLivePlans) && (
              <div className={cn('mb-1 text-4xl font-bold', highlighted ? 'text-white' : 'text-gray-900', isCompact && 'text-3xl')}>
                {(showPrice || usingLivePlans) && (
                  usingLivePlans ? (
                    <span>{typeof plan.price === 'number' ? `$${plan.price}` : String(plan.price ?? '')}</span>
                  ) : (
                  <BuilderTextField
                    fieldKey={`plans.${i}.price`}
                    blockId={blockId}
                    blockProps={props}
                    value={typeof plan.price === 'number' ? `$${plan.price}` : String(plan.price ?? '')}
                    as="span"
                    className="inline"
                    skipPositionWrapper
                    placeholder="$0"
                  />
                  )
                )}
                {(showPeriod || usingLivePlans) && (
                  <span className={cn('text-sm font-normal', highlighted ? 'text-white/70' : 'text-gray-400')}>
                    /
                    {usingLivePlans ? (
                      <span>{periodLabel}</span>
                    ) : (
                    <BuilderTextField
                      fieldKey={`plans.${i}.period`}
                      blockId={blockId}
                      blockProps={props}
                      value={plan.period ?? ''}
                      as="span"
                      className="inline"
                      skipPositionWrapper
                      placeholder="mo"
                    />
                    )}
                  </span>
                )}
              </div>
            )}
            <ul className={cn('mt-6 flex-1 space-y-3', isCompact && 'space-y-2')}>
              {plan.features.map((f, j) => (
                <li key={j} className={cn('flex items-center gap-2 text-sm', highlighted ? 'text-white/90' : 'text-gray-600', isCompact && 'text-xs')}>
                  <Check className="w-4 h-4 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            {(showCta || usingLivePlans) && (
              usingLivePlans ? (
                ctaUrl ? (
                  <a href={ctaUrl} className={cn(ctaClass, 'inline-flex items-center justify-center text-center no-underline') } style={ctaStyle}>
                    {plan.cta}
                  </a>
                ) : (
                  <button type="button" className={ctaClass} style={ctaStyle}>
                    {plan.cta}
                  </button>
                )
              ) : ctaUrl || isEditorCanvas ? (
                <BuilderCtaButton
                  fieldKey={`plans.${i}.cta`}
                  blockId={blockId}
                  blockProps={props}
                  label={plan.cta}
                  href={ctaUrl || '#'}
                  allowElementDelete={isEditorCanvas}
                  className={ctaClass}
                  style={ctaStyle}
                />
              ) : (
                <button type="button" className={ctaClass} style={ctaStyle}>
                  {plan.cta}
                </button>
              )
            )}
          </div>
          )
        })}
      </div>
    </section>
  )
}
