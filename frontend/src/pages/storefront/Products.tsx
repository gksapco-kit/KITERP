import { useState } from 'react'
import { useParams, Link, useOutletContext } from 'react-router-dom'
import { Search, ShoppingBag, Star, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useStorefrontProducts } from '@/hooks/useStorefront'
import type { StorefrontVendor } from '@/api/storefront.api'

export default function StorefrontProducts() {
  const { vendorSlug } = useParams<{ vendorSlug: string }>()
  const { themeColor } = useOutletContext<{ vendor: StorefrontVendor; themeColor: string }>()
  const base = `/store/${vendorSlug}`

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [category, setCategory] = useState('')

  const { data, isLoading } = useStorefrontProducts(vendorSlug || '', {
    page,
    size: 16,
    search: search || undefined,
    category: category || undefined,
  })

  const categories = data
    ? [...new Set(data.items.map((p) => p.category).filter(Boolean))]
    : []

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-500 mt-1">
            {data ? `${data.total} product${data.total !== 1 ? 's' : ''} available` : 'Loading…'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search products…"
            className="pl-10 pr-20"
          />
          <Button type="submit" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2" style={{ backgroundColor: themeColor }}>
            Search
          </Button>
        </form>
        {categories.length > 0 && (
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-gray-400" />
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1) }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c!}>{c}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Product Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border overflow-hidden animate-pulse">
              <div className="aspect-square bg-gray-200" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-5 bg-gray-200 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : data && data.items.length > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {data.items.map((p) => {
              const img = p.images.find((i) => i.is_primary) || p.images[0]
              const symbol = p.currency === 'INR' ? '\u20B9' : '$'
              return (
                <Link
                  key={p.id}
                  to={`${base}/products/${p.slug}`}
                  className="group bg-white rounded-xl border overflow-hidden hover:shadow-lg transition-all"
                >
                  <div className="aspect-square bg-gray-100 overflow-hidden">
                    {img ? (
                      <img src={img.url} alt={img.alt_text || p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <ShoppingBag className="w-12 h-12" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium text-gray-900 text-sm line-clamp-2">{p.name}</h3>
                    {p.category && <p className="text-xs text-gray-400 mt-1">{p.category}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="font-bold" style={{ color: themeColor }}>
                        {symbol}{p.price.toLocaleString()}
                      </span>
                      {p.compare_at_price && p.compare_at_price > p.price && (
                        <span className="text-xs text-gray-400 line-through">
                          {symbol}{p.compare_at_price.toLocaleString()}
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
                    {p.track_inventory && p.quantity <= 0 && (
                      <span className="inline-block mt-2 text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded">
                        Out of Stock
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-gray-500">
                Page {page} of {data.pages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20">
          <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto" />
          <h3 className="text-lg font-medium text-gray-900 mt-4">No products found</h3>
          <p className="text-gray-500 mt-1">
            {search ? 'Try adjusting your search terms' : 'This store hasn\'t added any products yet'}
          </p>
        </div>
      )}
    </div>
  )
}
