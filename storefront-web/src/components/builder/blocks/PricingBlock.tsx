import { Check } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { BuilderCtaButton } from '@/components/builder/BuilderCtaButton'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { columnsFromProps, sectionGridColumnClass, sectionItemGap } from '@/lib/sectionItemLayout'
import { cn } from '@/lib/utils'
import {
  isBlockFieldHidden,
  isNestedBlockFieldHidden,
  resolveBlockTextField,
  visibleArrayEntries,
} from '@/lib/blockHiddenFields'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null; blockId?: string }

type PlanItem = {
  name: string
  price: number | string
  period?: string
  features: string[]
  highlighted?: boolean
  cta: string
  cta_url?: string
}

export default function PricingBlock({ style, props, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId

  const title = resolveBlockTextField(props, 'title', {
    fallback: () => (isEditorCanvas ? null : 'Pricing'),
  })
  const subtitle = resolveBlockTextField(props, 'subtitle')
  const rawPlans = (props.plans as PlanItem[] | undefined) || []
  const visiblePlans = visibleArrayEntries(rawPlans, props, 'plans')
  const columns = Math.min(visiblePlans.length || rawPlans.length || columnsFromProps(props), 6)
  const itemGap = sectionItemGap(props, 24)

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
          message="Add pricing plans or packages so visitors can compare options and choose what fits them."
        />
      </section>
    )
  }

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {showTitle && (
        <BuilderTextField fieldKey="title" blockId={blockId} blockProps={props} value={title ?? ''} as="h2" className="text-3xl font-bold text-gray-900 mb-10 text-center" placeholder="Section title" />
      )}
      {showSubtitle && (
        <BuilderTextField fieldKey="subtitle" blockId={blockId} blockProps={props} value={subtitle ?? ''} as="p" className="text-gray-500 text-center mb-10 -mt-6" placeholder="Section subtitle" />
      )}
      <div className={cn('grid grid-cols-1 max-w-4xl mx-auto', sectionGridColumnClass(columns))} style={{ gap: itemGap }}>
        {visiblePlans.map(({ item: plan, index: i }) => {
          const showName = !isNestedBlockFieldHidden(props, `plans.${i}.name`)
          const showPrice = !isNestedBlockFieldHidden(props, `plans.${i}.price`)
          const showPeriod = !isNestedBlockFieldHidden(props, `plans.${i}.period`)
          const showCta = !isNestedBlockFieldHidden(props, `plans.${i}.cta`)
          const ctaUrl = String(plan.cta_url ?? '').trim()
          const ctaClass = `mt-8 w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 ${plan.highlighted ? 'bg-white' : 'text-white'}`
          const ctaStyle = plan.highlighted ? { color: style.primary_color } : { backgroundColor: style.primary_color }

          return (
          <div key={i} className={`builder-tile-card rounded-2xl p-8 flex flex-col ${plan.highlighted ? 'text-white shadow-xl scale-105' : 'bg-white border border-gray-100'}`} style={plan.highlighted ? { backgroundColor: style.primary_color } : {}}>
            {showName && (
              <BuilderTextField
                fieldKey={`plans.${i}.name`}
                blockId={blockId}
                blockProps={props}
                value={plan.name}
                as="h3"
                className={`font-bold text-lg mb-2 ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}
                skipPositionWrapper
                placeholder="Plan name"
              />
            )}
            {(showPrice || showPeriod) && (
              <div className={`text-4xl font-bold mb-1 ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                {showPrice && (
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
                )}
                {showPeriod && (
                  <span className={`text-sm font-normal ${plan.highlighted ? 'text-white/70' : 'text-gray-400'}`}>
                    /
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
                  </span>
                )}
              </div>
            )}
            <ul className="mt-6 space-y-3 flex-1">
              {plan.features.map((f, j) => (
                <li key={j} className={`flex items-center gap-2 text-sm ${plan.highlighted ? 'text-white/90' : 'text-gray-600'}`}>
                  <Check className="w-4 h-4 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            {showCta && (
              ctaUrl || isEditorCanvas ? (
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
