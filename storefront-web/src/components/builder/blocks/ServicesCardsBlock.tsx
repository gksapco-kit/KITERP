import { Link } from 'react-router-dom'
import { Wrench, Clock, ArrowRight } from 'lucide-react'
import { useVendor } from '@/contexts/VendorContext'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
}

export default function ServicesCardsBlock({ site, style, props, liveItems }: Props) {
  const { storePath } = useVendor()
  const title = (props.title as string) || 'Our Services'
  const columns = Math.min(Math.max(Number(props.columns ?? 3), 2), 4)

  const colClass: Record<number, string> = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  }

  const items = liveItems.length > 0
    ? liveItems
    : ((props.features as Array<{ title: string; desc: string; icon?: string }> | undefined) || []).map(f => ({
        id: f.title,
        title: f.title,
        description: f.desc,
        subtitle: null,
        image_url: null,
        price: null,
        price_formatted: null,
        rating: null,
        url: null,
        meta: {},
      } as LiveItem))

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {title && <h2 className="text-3xl font-bold text-gray-900 mb-10 text-center">{title}</h2>}
      {items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No services available yet</p>
        </div>
      ) : (
        <div className={`grid ${colClass[columns] || colClass[3]} gap-6`}>
          {items.map(item => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: `${style.primary_color}15` }}>
                <Wrench className="w-6 h-6" style={{ color: style.primary_color }} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
              {item.description && <p className="text-gray-500 text-sm flex-1 mb-4 line-clamp-3">{item.description}</p>}
              <div className="flex items-center justify-between mt-auto">
                {item.price_formatted ? (
                  <span className="font-bold" style={{ color: style.primary_color }}>{item.price_formatted}</span>
                ) : item.meta?.duration_minutes ? (
                  <span className="flex items-center gap-1 text-xs text-gray-400"><Clock className="w-3 h-3" />{Number(item.meta.duration_minutes)} min</span>
                ) : <span />}
                {item.url ? (
                  <Link to={storePath(item.url)} className="flex items-center gap-1 text-sm font-semibold hover:gap-2 transition-all" style={{ color: style.primary_color }}>
                    Book <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                ) : (
                  <Link to={storePath('/services')} className="flex items-center gap-1 text-sm font-semibold hover:gap-2 transition-all" style={{ color: style.primary_color }}>
                    View <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
