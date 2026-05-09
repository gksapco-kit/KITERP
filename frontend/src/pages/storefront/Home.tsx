import { useParams, Link, useOutletContext } from 'react-router-dom'
import { ArrowRight, Star, ShoppingBag, Wrench } from 'lucide-react'
import { useStorefrontProducts, useStorefrontServices } from '@/hooks/useStorefront'
import type { StorefrontVendor } from '@/api/storefront.api'

interface ContextType {
  vendor: StorefrontVendor
  themeColor: string
}

export default function StorefrontHome() {
  const { vendorSlug } = useParams<{ vendorSlug: string }>()
  const { vendor, themeColor } = useOutletContext<ContextType>()
  const { data: products } = useStorefrontProducts(vendorSlug || '', { size: 8 })
  const { data: services } = useStorefrontServices(vendorSlug || '', { size: 6 })
  const base = `/store/${vendorSlug}`

  return (
    <div>
      {/* Hero */}
      <section
        className="relative overflow-hidden py-20 lg:py-32"
        style={{ background: `linear-gradient(135deg, ${themeColor}dd, ${themeColor}88)` }}
      >
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="max-w-2xl">
            <h1 className="text-4xl lg:text-5xl font-bold text-white leading-tight">
              Welcome to {vendor.display_name}
            </h1>
            {vendor.description && (
              <p className="mt-4 text-lg text-white/80 leading-relaxed">{vendor.description}</p>
            )}
            <div className="mt-8 flex gap-3">
              <Link
                to={`${base}/products`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-900 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
              >
                <ShoppingBag className="w-5 h-5" /> Browse Products
              </Link>
              <Link
                to={`${base}/services`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 text-white border border-white/30 rounded-lg font-semibold hover:bg-white/30 transition-colors"
              >
                <Wrench className="w-5 h-5" /> Our Services
              </Link>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djJoLTJ2LTJoMnptMC00aDJ2MmgtMnYtMnptLTQgMHYyaC0ydi0yaDJ6bTIgMGgydjJoLTJ2LTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
      </section>

      {/* Featured Products */}
      {products && products.items.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Featured Products</h2>
              <p className="text-gray-500 mt-1">Check out our latest offerings</p>
            </div>
            <Link
              to={`${base}/products`}
              className="flex items-center gap-1 text-sm font-medium hover:underline"
              style={{ color: themeColor }}
            >
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {products.items.map((p) => (
              <ProductCard key={p.id} product={p} base={base} themeColor={themeColor} />
            ))}
          </div>
        </section>
      )}

      {/* Services */}
      {services && services.items.length > 0 && (
        <section className="bg-gray-100 py-16">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Our Services</h2>
                <p className="text-gray-500 mt-1">Professional services tailored for you</p>
              </div>
              <Link
                to={`${base}/services`}
                className="flex items-center gap-1 text-sm font-medium hover:underline"
                style={{ color: themeColor }}
              >
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {services.items.map((s) => (
                <Link
                  key={s.id}
                  to={`${base}/services/${s.slug}`}
                  className="bg-white rounded-xl p-6 hover:shadow-lg transition-shadow border"
                >
                  <h3 className="font-semibold text-gray-900 text-lg">{s.name}</h3>
                  {s.short_description && (
                    <p className="text-gray-500 text-sm mt-2 line-clamp-2">{s.short_description}</p>
                  )}
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-lg font-bold" style={{ color: themeColor }}>
                      {s.currency === 'INR' ? '\u20B9' : '$'}{s.base_price.toLocaleString()}
                    </span>
                    {s.duration_minutes && (
                      <span className="text-xs text-gray-400">{s.duration_minutes} min</span>
                    )}
                  </div>
                  {s.avg_rating != null && s.avg_rating > 0 && (
                    <div className="flex items-center gap-1 mt-2">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span className="text-sm text-gray-600">{s.avg_rating.toFixed(1)}</span>
                      <span className="text-xs text-gray-400">({s.review_count})</span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

function ProductCard({
  product: p,
  base,
  themeColor,
}: {
  product: {
    id: string; name: string; slug: string; price: number; compare_at_price?: number;
    currency: string; images: { url: string; alt_text?: string; is_primary: boolean }[];
    avg_rating?: number; review_count?: number
  }
  base: string
  themeColor: string
}) {
  const primaryImage = p.images.find((i) => i.is_primary) || p.images[0]
  const currencySymbol = p.currency === 'INR' ? '\u20B9' : '$'

  return (
    <Link to={`${base}/products/${p.slug}`} className="group bg-white rounded-xl border overflow-hidden hover:shadow-lg transition-shadow">
      <div className="aspect-square bg-gray-100 overflow-hidden">
        {primaryImage ? (
          <img src={primaryImage.url} alt={primaryImage.alt_text || p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <ShoppingBag className="w-12 h-12" />
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-medium text-gray-900 text-sm line-clamp-2">{p.name}</h3>
        <div className="flex items-center gap-2 mt-2">
          <span className="font-bold" style={{ color: themeColor }}>
            {currencySymbol}{p.price.toLocaleString()}
          </span>
          {p.compare_at_price && p.compare_at_price > p.price && (
            <span className="text-xs text-gray-400 line-through">
              {currencySymbol}{p.compare_at_price.toLocaleString()}
            </span>
          )}
        </div>
        {p.avg_rating != null && p.avg_rating > 0 && (
          <div className="flex items-center gap-1 mt-1.5">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span className="text-xs text-gray-600">{p.avg_rating.toFixed(1)}</span>
            <span className="text-xs text-gray-400">({p.review_count})</span>
          </div>
        )}
      </div>
    </Link>
  )
}
