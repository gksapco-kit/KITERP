import { Calendar, Plus } from 'lucide-react'
import { gridColumnClass } from '../../lib/blockUtils'
import { useBuilderStore } from '../../store/useBuilderStore'
import type { CatalogService } from '../../types/builder'

interface ServiceListingWidgetProps {
  title?: string
  subtitle?: string
  columns?: number
  showPrices?: boolean
  interactive?: boolean
}

export function ServiceListingWidget({
  title = 'Our Services',
  subtitle,
  columns = 2,
  showPrices = true,
  interactive = false,
}: ServiceListingWidgetProps) {
  const services = useBuilderStore((s) => s.catalog.services)
  const addToCart = useBuilderStore((s) => s.addToCart)
  const colClass = gridColumnClass(columns)

  return (
    <section>
      <h2 className="mb-2 text-3xl font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="mb-8 text-gray-600">{subtitle}</p>}
      <div className={`grid gap-6 ${colClass}`}>
        {services.map((service) => (
          <ServiceCard
            key={service.id}
            service={service}
            showPrice={showPrices}
            onBook={
              interactive
                ? () =>
                    addToCart({
                      itemId: service.id,
                      itemType: 'service',
                      name: service.name,
                      price: service.price,
                      quantity: 1,
                      imageUrl: service.imageUrl,
                    })
                : undefined
            }
          />
        ))}
      </div>
    </section>
  )
}

function ServiceCard({
  service,
  showPrice,
  onBook,
}: {
  service: CatalogService
  showPrice: boolean
  onBook?: () => void
}) {
  return (
    <article className="flex gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md">
      <img src={service.imageUrl} alt={service.name} className="h-24 w-24 shrink-0 rounded-lg object-cover" />
      <div className="flex-1">
        <h3 className="font-semibold text-gray-900">{service.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-gray-500">{service.description}</p>
        {service.duration && (
          <p className="mt-2 flex items-center gap-1 text-xs text-gray-400">
            <Calendar className="h-3.5 w-3.5" />
            {service.duration}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between">
          {showPrice && (
            <span className="text-lg font-bold text-brand-600">
              {service.price > 0 ? `$${service.price}` : 'Free'}
            </span>
          )}
          {onBook && (
            <button
              type="button"
              onClick={onBook}
              className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Book Now
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
