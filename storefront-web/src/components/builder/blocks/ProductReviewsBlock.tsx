import { Star } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null }

export default function ProductReviewsBlock({ style, props, liveItems }: Props) {
  const title = (props.title as string) || 'Customer Reviews'
  const showSummary = props.show_summary !== false
  if (liveItems.length === 0) return null
  const avgRating = liveItems.reduce((sum, i) => sum + (i.rating || 0), 0) / liveItems.length
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        {showSummary && (
          <div className="text-center">
            <div className="text-4xl font-bold" style={{ color: style.primary_color }}>{avgRating.toFixed(1)}</div>
            <div className="flex gap-0.5 mt-1">
              {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`w-4 h-4 ${i < Math.round(avgRating) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />)}
            </div>
            <div className="text-xs text-gray-400 mt-1">{liveItems.length} reviews</div>
          </div>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {liveItems.map(review => (
          <div key={review.id} className="bg-white border border-gray-100 rounded-2xl p-5">
            <div className="flex gap-0.5 mb-2">
              {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`w-3.5 h-3.5 ${i < (review.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />)}
            </div>
            <p className="text-gray-600 text-sm mb-3">"{review.description}"</p>
            <div className="flex items-center gap-2">
              {review.image_url ? <img src={review.image_url} alt="" className="w-8 h-8 rounded-full object-cover" loading="lazy" /> : <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: style.primary_color }}>{review.title.charAt(0)}</div>}
              <div>
                <p className="text-sm font-semibold text-gray-900">{review.title}</p>
                {review.subtitle && <p className="text-xs text-gray-400">{review.subtitle}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
