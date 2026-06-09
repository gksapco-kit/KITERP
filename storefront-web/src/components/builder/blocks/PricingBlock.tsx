import { Check } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { columnsFromProps, sectionGridColumnClass, sectionItemGap } from '@/lib/sectionItemLayout'
import { cn } from '@/lib/utils'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null; blockId?: string }

export default function PricingBlock({ style, props, blockId }: Props) {
  const title = (props.title as string) || 'Pricing'
  const plans = (props.plans as Array<{ name: string; price: number | string; period?: string; features: string[]; highlighted?: boolean; cta: string }> | undefined) || []
  const columns = Math.min(plans.length || columnsFromProps(props), 6)
  const itemGap = sectionItemGap(props, 24)
  if (plans.length === 0) {
    return (
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
        <BlockEmptyPlaceholder
          style={style}
          title={title}
          message="Add pricing plans or packages so visitors can compare options and choose what fits them."
        />
      </section>
    )
  }
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {(title || blockId) && (
        <BuilderTextField fieldKey="title" blockId={blockId} blockProps={props} value={title} as="h2" className="text-3xl font-bold text-gray-900 mb-10 text-center" />
      )}
      <div className={cn('grid grid-cols-1 max-w-4xl mx-auto', sectionGridColumnClass(columns))} style={{ gap: itemGap }}>
        {plans.map((plan, i) => (
          <div key={i} className={`builder-tile-card rounded-2xl p-8 flex flex-col ${plan.highlighted ? 'text-white shadow-xl scale-105' : 'bg-white border border-gray-100'}`} style={plan.highlighted ? { backgroundColor: style.primary_color } : {}}>
            <h3 className={`font-bold text-lg mb-2 ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>{plan.name}</h3>
            <div className={`text-4xl font-bold mb-1 ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
              {typeof plan.price === 'number' ? `$${plan.price}` : plan.price}
              {plan.period && <span className={`text-sm font-normal ${plan.highlighted ? 'text-white/70' : 'text-gray-400'}`}>/{plan.period}</span>}
            </div>
            <ul className="mt-6 space-y-3 flex-1">
              {plan.features.map((f, j) => (
                <li key={j} className={`flex items-center gap-2 text-sm ${plan.highlighted ? 'text-white/90' : 'text-gray-600'}`}>
                  <Check className="w-4 h-4 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button className={`mt-8 w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 ${plan.highlighted ? 'bg-white' : 'text-white'}`} style={plan.highlighted ? { color: style.primary_color } : { backgroundColor: style.primary_color }}>
              {plan.cta}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
