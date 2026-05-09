import { Check } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null }

export default function PricingBlock({ style, props }: Props) {
  const title = (props.title as string) || 'Pricing'
  const plans = (props.plans as Array<{ name: string; price: number | string; period?: string; features: string[]; highlighted?: boolean; cta: string }> | undefined) || []
  if (plans.length === 0) return null
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {title && <h2 className="text-3xl font-bold text-gray-900 mb-10 text-center">{title}</h2>}
      <div className={`grid grid-cols-1 ${plans.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-6 max-w-4xl mx-auto`}>
        {plans.map((plan, i) => (
          <div key={i} className={`rounded-2xl p-8 flex flex-col ${plan.highlighted ? 'text-white shadow-xl scale-105' : 'bg-white border border-gray-100'}`} style={plan.highlighted ? { backgroundColor: style.primary_color } : {}}>
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
