import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useServices, useStoreCategories } from '@/hooks/useStore'
import {
  Wrench, Loader2, ChevronRight, ChevronLeft,
  Search, SlidersHorizontal, X, ChevronDown,
} from 'lucide-react'
import type { StoreCategory } from '@/types'
import { useVendor } from '@/contexts/VendorContext'
import { ServiceCardGrid } from '@/kit/services/ServiceBlocks'
import { EmptyBookings } from '@/kit/states/StateScreens'
import { TableSkeleton } from '@/kit/states/StateScreens'
import type { Service as KitService } from '@/kit/types'
import { themeUi } from '@/lib/themeColors'

const SERVICE_MODE_ICON: Record<string, string> = {
  home_visit: 'Home Visit', on_site: 'On-Site', remote: 'Remote', online: 'Online',
  in_store: 'In-Store', clinic: 'Clinic', hybrid: 'Hybrid',
}

function CategoryTreeItem({ cat, level, selected, onSelect }: {
  cat: StoreCategory; level: number; selected: string; onSelect: (name: string) => void
}) {
  const [open, setOpen] = useState(selected === cat.name || (cat.children || []).some(c => c.name === selected))
  const hasChildren = (cat.children || []).length > 0
  const isActive = selected === cat.name

  return (
    <div>
      <div className="flex items-center" style={{ paddingLeft: `${level * 12}px` }}>
        {hasChildren ? (
          <button onClick={() => setOpen(!open)} className="p-0.5 mr-0.5 rounded hover:bg-gray-200 shrink-0">
            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? '' : '-rotate-90'}`} />
          </button>
        ) : (
          <span className="w-[18px] shrink-0" />
        )}
        <button
          onClick={() => onSelect(cat.name)}
          className={`flex-1 text-left px-2 py-1.5 rounded-lg text-sm truncate transition-colors ${isActive ? `${themeUi.pillPrimary} font-semibold` : 'text-gray-600 hover:bg-gray-50'}`}
        >{cat.name}</button>
      </div>
      {open && hasChildren && cat.children!.map(child => (
        <CategoryTreeItem key={child.id} cat={child} level={level + 1} selected={selected} onSelect={onSelect} />
      ))}
    </div>
  )
}

function flattenCats(cats: StoreCategory[], prefix = ''): { name: string; label: string }[] {
  const result: { name: string; label: string }[] = []
  for (const c of cats) {
    result.push({ name: c.name, label: prefix + c.name })
    if (c.children?.length) result.push(...flattenCats(c.children, prefix + '  '))
  }
  return result
}

export default function ServiceList() {
  const { storePath } = useVendor()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [category, setCategory] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const { data: catData } = useStoreCategories({ tree: true, applies_to: 'service' })
  const categories = catData?.categories || []

  const { data, isLoading } = useServices({
    page, size: 12,
    search: search || undefined,
    category: category || undefined,
  })

  const clearSearch = () => { setSearch(''); setSearchInput(''); setPage(1) }
  const clearAllFilters = () => { clearSearch(); setCategory('') }

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-5 flex items-center gap-1">
        <Link to={storePath('/')} className={themeUi.linkHover}>Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-900 font-medium">Services</span>
      </nav>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sticky top-4 shadow-sm max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-sm mb-4 flex items-center gap-2 text-gray-900">
              <SlidersHorizontal className="w-4 h-4 text-gray-400" /> Filters
            </h3>
            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Search</label>
                <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1) }}>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Search..." className="pl-9 h-9 text-sm rounded-lg" />
                    {searchInput && (
                      <button type="button" onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2">
                        <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {categories.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Category</label>
                  <button onClick={() => { setCategory(''); setPage(1) }}
                    className={`w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors ${!category ? `${themeUi.pillPrimary} font-semibold` : 'text-gray-600 hover:bg-gray-50'}`}>
                    All Categories
                  </button>
                  {categories.map(cat => (
                    <CategoryTreeItem key={cat.id} cat={cat} level={0}
                      selected={category} onSelect={(name) => { setCategory(name); setPage(1) }} />
                  ))}
                </div>
              )}

              {(search || category) && (
                <Button variant="outline" size="sm" className="w-full gap-1.5 text-gray-500 rounded-lg" onClick={clearAllFilters}>
                  <X className="w-3.5 h-3.5" /> Clear All
                </Button>
              )}
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          {/* Toolbar */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-3 sm:p-4 mb-5 flex items-center justify-between gap-3 flex-wrap shadow-sm max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 flex-wrap">
              <Button variant="outline" size="sm" className="lg:hidden gap-1.5 rounded-lg" onClick={() => setShowFilters(!showFilters)}>
                <SlidersHorizontal className="w-4 h-4" /> Filters
              </Button>
              {(search || category) && (
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  {search && (
                    <span className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 text-xs ${themeUi.pillPrimary}`}>
                      "{search}" <button onClick={clearSearch}><X className="w-3 h-3" /></button>
                    </span>
                  )}
                  {category && (
                    <span className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 text-xs ${themeUi.pillSecondary}`}>
                      {category} <button onClick={() => { setCategory(''); setPage(1) }}><X className="w-3 h-3" /></button>
                    </span>
                  )}
                </div>
              )}
              {data && (
                <span className="text-sm text-gray-500">{data.total} service{data.total !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>

          {/* Mobile Filters */}
          {showFilters && (
            <div className="lg:hidden bg-white rounded-2xl border border-gray-200/80 p-4 mb-5 space-y-3 shadow-sm max-h-[90vh] overflow-y-auto">
              <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); setShowFilters(false) }}
                className="flex gap-2">
                <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search services..." className="h-9 text-sm rounded-lg" />
                <Button type="submit" size="sm" className="rounded-lg">Search</Button>
              </form>
              {categories.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1.5 block">Category</label>
                  <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }}
                    className={`w-full h-9 rounded-lg border text-sm px-2 bg-white ${themeUi.focusRing}`}>
                    <option value="">All Categories</option>
                    {flattenCats(categories).map(c => (
                      <option key={c.name} value={c.name}>{c.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Grid */}
          {isLoading ? (
            <TableSkeleton rows={6} />
          ) : !data?.items?.length ? (
            <EmptyBookings />
          ) : (
            <ServiceCardGrid
              columns={3}
              services={data.items.map((s: any): KitService => ({
                id: s.id,
                slug: s.slug,
                name: s.name,
                shortDescription: s.short_description || s.description || '',
                description: s.description || '',
                image: s.image_url || s.media?.find((m: any) => m.is_primary)?.url,
                durationMinutes: s.duration_minutes ?? 60,
                price: s.price ?? s.price_min ?? 0,
                currency: s.currency || 'INR',
                features: s.features || [],
              }))}
              onBook={(svc) => navigate(storePath(`/services/${svc.slug}/book`))}
            />
          )}

          {/* Pagination */}
          {data && data.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                className="gap-1 rounded-lg">
                <ChevronLeft className="w-4 h-4" /> Previous
              </Button>
              {Array.from({ length: Math.min(data.pages, 5) }, (_, i) => {
                const pageNum = page <= 3 ? i + 1 : page + i - 2
                if (pageNum < 1 || pageNum > data.pages) return null
                return (
                  <Button key={pageNum} variant={pageNum === page ? 'default' : 'outline'} size="sm"
                    onClick={() => setPage(pageNum)} className="w-9 h-9 rounded-lg">
                    {pageNum}
                  </Button>
                )
              })}
              <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}
                className="gap-1 rounded-lg">
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
