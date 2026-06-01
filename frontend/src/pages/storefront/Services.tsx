import { useState } from 'react'
import { useParams, Link, useOutletContext } from 'react-router-dom'
import { Search, Wrench, Star, Clock, MapPin, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useStorefrontServices } from '@/hooks/useStorefront'
import type { StorefrontVendor } from '@/api/storefront.api'

const MODE_LABELS: Record<string, string> = {
  in_store: 'In-Store',
  home_visit: 'Home Visit',
  both: 'In-Store / Home Visit',
  online: 'Online',
}

export default function StorefrontServices() {
  const { vendorSlug } = useParams<{ vendorSlug: string }>()
  const { themeColor } = useOutletContext<{ vendor: StorefrontVendor; themeColor: string }>()
  const base = `/store/${vendorSlug}`

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [category, setCategory] = useState('')

  const { data, isLoading } = useStorefrontServices(vendorSlug || '', {
    page, size: 12, search: search || undefined, category: category || undefined,
  })

  const categories = data ? [...new Set(data.items.map((s) => s.category).filter(Boolean))] : []

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Services</h1>
        <p className="text-gray-500 mt-1">
          {data ? `${data.total} service${data.total !== 1 ? 's' : ''} available` : 'Loading…'}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search services…" className="pl-10 pr-20" />
          <Button type="submit" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2" style={{ backgroundColor: themeColor }}>Search</Button>
        </form>
        {categories.length > 0 && (
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-gray-400" />
            <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c} value={c!}>{c}</option>)}
            </select>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border p-6 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-4 bg-gray-200 rounded w-full mb-2" />
              <div className="h-4 bg-gray-200 rounded w-2/3" />
              <div className="h-8 bg-gray-200 rounded w-1/3 mt-4" />
            </div>
          ))}
        </div>
      ) : data && data.items.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {data.items.map((s) => (
              <Link key={s.id} to={`${base}/services/${s.slug}`} className="group bg-white rounded-xl border p-6 hover:shadow-lg transition-all max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-lg group-hover:underline">{s.name}</h3>
                    {s.category && <span className="text-xs text-gray-400 uppercase tracking-wide">{s.category}</span>}
                  </div>
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ml-3" style={{ backgroundColor: `${themeColor}15` }}>
                    <Wrench className="w-6 h-6" style={{ color: themeColor }} />
                  </div>
                </div>
                {s.short_description && (
                  <p className="text-gray-500 text-sm mt-3 line-clamp-2">{s.short_description}</p>
                )}
                <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
                  {s.duration_minutes && (
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{s.duration_minutes} min</span>
                  )}
                  {s.service_mode && (
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{MODE_LABELS[s.service_mode] || s.service_mode}</span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-xl font-bold" style={{ color: themeColor }}>
                    {s.currency === 'INR' ? '\u20B9' : '$'}{s.base_price.toLocaleString()}
                  </span>
                  {s.avg_rating != null && s.avg_rating > 0 && (
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span className="text-sm text-gray-600">{s.avg_rating.toFixed(1)}</span>
                      <span className="text-xs text-gray-400">({s.review_count})</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="w-4 h-4" /></Button>
              <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
              <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20">
          <Wrench className="w-16 h-16 text-gray-300 mx-auto" />
          <h3 className="text-lg font-medium text-gray-900 mt-4">No services found</h3>
          <p className="text-gray-500 mt-1">{search ? 'Try adjusting your search terms' : 'This store hasn\'t added any services yet'}</p>
        </div>
      )}
    </div>
  )
}
