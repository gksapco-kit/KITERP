import { Quote, Star } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
}

export default function TestimonialsBlock({ style, props, liveItems }: Props) {
  const title = (props.title as string) || 'What Our Customers Say'

  const items = liveItems.length > 0
    ? liveItems
    : ((props.testimonials as Array<{ name: string; role?: string; company?: string; quote: string; rating?: number }> | undefined) || []).map(t => ({
        id: t.name,
        title: t.name,
        subtitle: [t.role, t.company].filter(Boolean).join(', ') || null,
        description: t.quote,
        image_url: null,
        price: null,
        price_formatted: null,
        rating: t.rating ?? 5,
        url: null,
        meta: {},
      } as LiveItem))

  if (items.length === 0) return null

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {title && <h2 className="text-3xl font-bold text-gray-900 mb-10 text-center">{title}</h2>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map(item => (
          <div key={item.id} className="bg-white rounded-2xl border border-gray-100 p-6 relative">
            <Quote className="w-8 h-8 opacity-10 absolute top-4 right-4" style={{ color: style.primary_color }} />
            {item.rating != null && (
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < (item.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
                ))}
              </div>
            )}
            <p className="text-gray-600 text-sm leading-relaxed mb-4">"{item.description}"</p>
            <div className="flex items-center gap-3">
              {item.image_url ? (
                <img src={item.image_url} alt={item.title} className="w-10 h-10 rounded-full object-cover" loading="lazy" />
              ) : (
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: style.primary_color }}>
                  {item.title.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-semibold text-gray-900 text-sm">{item.title}</p>
                {item.subtitle && <p className="text-xs text-gray-400">{item.subtitle}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
