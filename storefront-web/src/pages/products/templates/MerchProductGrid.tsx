import { Link } from 'react-router-dom'
import { formatCurrency, imgUrl } from '@/lib/utils'
import { ShoppingBag, Star } from 'lucide-react'
import type { ProductCard } from '@/types'

interface MerchProductGridProps {
  title: string
  subtitle?: string
  products: ProductCard[]
  storePath: (p: string) => string
}

export default function MerchProductGrid({ title, subtitle, products, storePath }: MerchProductGridProps) {
  if (!products.length) return null

  return (
    <div className="bg-white rounded-xl border p-4 sm:p-6 lg:p-8 mt-6">
      <div className="mb-5">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {products.map((p) => {
          const primaryImg = p.images?.find(i => i.is_primary) || p.images?.[0]
          const discount = p.compare_at_price && p.compare_at_price > p.price
            ? Math.round((1 - p.price / p.compare_at_price) * 100) : 0
          return (
            <Link key={p.id} to={storePath(`/products/${p.slug}`)}
              className="group bg-white rounded-xl border hover:shadow-md transition-all overflow-hidden max-h-[90vh] overflow-y-auto">
              <div className="aspect-square bg-gray-50 relative overflow-hidden">
                {primaryImg ? (
                  <img src={imgUrl(primaryImg.url)} alt={p.name}
                    className="absolute inset-0 w-full h-full object-contain object-center p-2" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag className="w-10 h-10 text-gray-200" />
                  </div>
                )}
                {discount > 0 && (
                  <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                    -{discount}%
                  </span>
                )}
              </div>
              <div className="p-3">
                {p.brand && <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{p.brand}</p>}
                <h4 className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
                  {p.name}
                </h4>
                {(p.avg_rating ?? 0) > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span className="text-xs text-gray-500">{p.avg_rating?.toFixed(1)}</span>
                    {p.review_count ? <span className="text-xs text-gray-400">({p.review_count})</span> : null}
                  </div>
                )}
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-sm font-bold text-gray-900">{formatCurrency(p.price, p.currency)}</span>
                  {p.compare_at_price != null && p.compare_at_price > p.price && (
                    <span className="text-xs text-gray-400 line-through">{formatCurrency(p.compare_at_price, p.currency)}</span>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
