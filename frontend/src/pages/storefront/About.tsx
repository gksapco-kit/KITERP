import { useParams, useOutletContext } from 'react-router-dom'
import { MapPin, Phone, Mail, Clock, Star, ShieldCheck } from 'lucide-react'
import type { StorefrontVendor } from '@/api/storefront.api'

export default function StorefrontAbout() {
  const { vendorSlug: _vendorSlug } = useParams<{ vendorSlug: string }>()
  const { vendor, themeColor } = useOutletContext<{ vendor: StorefrontVendor; themeColor: string }>()

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Hero */}
      <div className="text-center mb-12">
        {vendor.logo_url ? (
          <img src={vendor.logo_url} alt={vendor.display_name} className="w-24 h-24 rounded-2xl mx-auto object-cover shadow-lg" />
        ) : (
          <div className="w-24 h-24 rounded-2xl mx-auto flex items-center justify-center text-white text-3xl font-bold shadow-lg" style={{ backgroundColor: themeColor }}>
            {vendor.display_name.charAt(0)}
          </div>
        )}
        <h1 className="text-3xl font-bold text-gray-900 mt-6">About {vendor.display_name}</h1>
        {vendor.description && (
          <p className="text-gray-600 mt-3 max-w-2xl mx-auto text-lg leading-relaxed">{vendor.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact Info */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold text-gray-900 text-lg mb-4">Contact Information</h2>
          <div className="space-y-4">
            {vendor.primary_phone && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${themeColor}15` }}>
                  <Phone className="w-5 h-5" style={{ color: themeColor }} />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Phone</p>
                  <a href={`tel:${vendor.primary_phone}`} className="font-medium text-gray-900 hover:underline">{vendor.primary_phone}</a>
                </div>
              </div>
            )}
            {vendor.primary_email && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${themeColor}15` }}>
                  <Mail className="w-5 h-5" style={{ color: themeColor }} />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Email</p>
                  <a href={`mailto:${vendor.primary_email}`} className="font-medium text-gray-900 hover:underline">{vendor.primary_email}</a>
                </div>
              </div>
            )}
            {vendor.city && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${themeColor}15` }}>
                  <MapPin className="w-5 h-5" style={{ color: themeColor }} />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Location</p>
                  <p className="font-medium text-gray-900">{vendor.city}, {vendor.state}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Trust */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold text-gray-900 text-lg mb-4">Why Choose Us</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Verified Seller</p>
                <p className="text-sm text-gray-500">This store has been verified by KITERP platform.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                <Star className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Quality Assurance</p>
                <p className="text-sm text-gray-500">We ensure the highest quality products and services.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Timely Delivery</p>
                <p className="text-sm text-gray-500">Orders are processed and delivered on time.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Service Area */}
      {vendor.service_radius_km && (
        <div className="bg-white rounded-xl border p-6 mt-6">
          <h2 className="font-semibold text-gray-900 text-lg mb-2">Service Area</h2>
          <p className="text-gray-600">
            We serve customers within a <strong>{vendor.service_radius_km} km</strong> radius
            {vendor.city && <> from our location in <strong>{vendor.city}, {vendor.state}</strong></>}.
          </p>
        </div>
      )}
    </div>
  )
}
