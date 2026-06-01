import { Link } from 'react-router-dom'
import { Clock, ArrowRight } from 'lucide-react'
import { useVendor } from '@/contexts/VendorContext'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null }

export default function BookingWidgetBlock({ style, props, liveItems }: Props) {
  const { storePath } = useVendor()
  const title = (props.title as string) || 'Book a Session'
  const subtitle = (props.subtitle as string) || 'Choose a time that works for you'
  const ctaLabel = (props.cta_label as string) || 'Book Now'

  const services = liveItems.slice(0, 6)

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-500">{subtitle}</p>
      </div>
      {services.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map(svc => (
            <div key={svc.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow max-h-[90vh] overflow-y-auto">
              <h3 className="font-semibold text-gray-900 mb-1">{svc.title}</h3>
              {!!svc.meta?.duration_minutes && (
                <p className="text-xs text-gray-400 flex items-center gap-1 mb-2"><Clock className="w-3 h-3" />{Number(svc.meta.duration_minutes)} min</p>
              )}
              {svc.price_formatted && <p className="font-bold mb-3" style={{ color: style.primary_color }}>{svc.price_formatted}</p>}
              <Link to={svc.url ? storePath(svc.url) : storePath('/services')} className="text-sm font-semibold flex items-center gap-1 hover:gap-2 transition-all" style={{ color: style.primary_color }}>
                Book <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center">
          <Link to={storePath('/services')} className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold hover:opacity-90 transition-all" style={{ backgroundColor: style.primary_color }}>
            {ctaLabel} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </section>
  )
}
