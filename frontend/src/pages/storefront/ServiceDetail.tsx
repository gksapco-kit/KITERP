import { useParams, Link, useOutletContext } from 'react-router-dom'
import { Star, Clock, MapPin, ChevronLeft, Wrench, Calendar, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStorefrontService } from '@/hooks/useStorefront'
import type { StorefrontVendor } from '@/api/storefront.api'

const MODE_LABELS: Record<string, string> = {
  in_store: 'In-Store',
  home_visit: 'Home Visit',
  both: 'In-Store / Home Visit',
  online: 'Online',
}

const UOM_LABELS: Record<string, string> = {
  fixed: 'Fixed Price',
  hourly: 'Per Hour',
  daily: 'Per Day',
  event: 'Per Event',
  task: 'Per Task',
  milestone: 'Per Milestone',
  per_km: 'Per KM',
  per_unit: 'Per Unit',
}

export default function ServiceDetail() {
  const { vendorSlug, serviceSlug } = useParams<{ vendorSlug: string; serviceSlug: string }>()
  const { themeColor } = useOutletContext<{ vendor: StorefrontVendor; themeColor: string }>()
  const { data: service, isLoading, error } = useStorefrontService(vendorSlug || '', serviceSlug || '')
  const base = `/store/${vendorSlug}`

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/2 mb-4" />
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-8" />
        <div className="h-40 bg-gray-200 rounded mb-6" />
        <div className="h-12 bg-gray-200 rounded w-1/3" />
      </div>
    )
  }

  if (error || !service) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <Wrench className="w-16 h-16 text-gray-300 mx-auto" />
        <h2 className="text-xl font-bold text-gray-900 mt-4">Service Not Found</h2>
        <Link to={`${base}/services`} className="mt-4 inline-block text-sm hover:underline" style={{ color: themeColor }}>
          Back to Services
        </Link>
      </div>
    )
  }

  const symbol = service.currency === 'INR' ? '\u20B9' : '$'

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link to={base} className="hover:text-gray-600">Home</Link>
        <span>/</span>
        <Link to={`${base}/services`} className="hover:text-gray-600">Services</Link>
        <span>/</span>
        <span className="text-gray-700">{service.name}</span>
      </nav>

      <div className="bg-white rounded-xl border overflow-hidden">
        {/* Header */}
        <div className="p-8 border-b" style={{ background: `linear-gradient(135deg, ${themeColor}08, ${themeColor}15)` }}>
          <div className="flex items-start gap-6">
            <div className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${themeColor}20` }}>
              <Wrench className="w-8 h-8" style={{ color: themeColor }} />
            </div>
            <div className="flex-1">
              {service.category && (
                <span className="text-xs font-medium uppercase tracking-wide text-gray-400">{service.category}</span>
              )}
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mt-1">{service.name}</h1>
              {service.short_description && (
                <p className="text-gray-600 mt-2 text-lg">{service.short_description}</p>
              )}

              {/* Rating */}
              {service.avg_rating != null && service.avg_rating > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < Math.round(service.avg_rating!) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                    ))}
                  </div>
                  <span className="text-sm text-gray-500">{service.avg_rating.toFixed(1)} ({service.review_count} reviews)</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: details */}
            <div className="lg:col-span-2 space-y-6">
              {service.description && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">About this service</h3>
                  <p className="text-gray-600 leading-relaxed whitespace-pre-line">{service.description}</p>
                </div>
              )}

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-4">
                {service.duration_minutes && (
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-400">Duration</p>
                      <p className="font-medium text-gray-900">{service.duration_minutes} minutes</p>
                    </div>
                  </div>
                )}
                {service.service_mode && (
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-400">Service Mode</p>
                      <p className="font-medium text-gray-900">{MODE_LABELS[service.service_mode] || service.service_mode}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: pricing card */}
            <div className="lg:col-span-1">
              <div className="bg-gray-50 rounded-xl p-6 border sticky top-24">
                <p className="text-sm text-gray-400 mb-1">Price</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold" style={{ color: themeColor }}>
                    {symbol}{service.base_price.toLocaleString()}
                  </span>
                  {service.uom && service.uom !== 'fixed' && (
                    <span className="text-sm text-gray-500">/ {UOM_LABELS[service.uom] || service.uom}</span>
                  )}
                </div>

                {service.is_taxable && service.tax_rate && (
                  <p className="text-xs text-gray-400 mt-1">+ {service.tax_rate}% GST</p>
                )}

                <div className="mt-6 space-y-3">
                  <Button className="w-full gap-2 text-white" size="lg" style={{ backgroundColor: themeColor }}>
                    <Calendar className="w-5 h-5" /> Book Now
                  </Button>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Check className="w-4 h-4 text-green-500" /> Instant Confirmation
                  </div>
                  {service.cancellation_policy && (
                    <div className="flex items-start gap-2 text-sm text-gray-500">
                      <Check className="w-4 h-4 text-green-500 mt-0.5" />
                      <span>{service.cancellation_policy}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <Link to={`${base}/services`} className="inline-flex items-center gap-1 text-sm hover:underline" style={{ color: themeColor }}>
          <ChevronLeft className="w-4 h-4" /> Back to all services
        </Link>
      </div>
    </div>
  )
}
