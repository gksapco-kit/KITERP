import { useState, useMemo, useEffect } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useProducts, useServices, useStoreCategories } from '@/hooks/useStore'
import { useAddToCart, useCart, useCartProductQtyMap, useSetCatalogCartQty } from '@/hooks/useStore'
import { formatCurrency, imgUrl, cn } from '@/lib/utils'
import type { Product, Service, ProductVariant } from '@/types'
import {
  Search, ShoppingBag, ShoppingCart, Loader2, ChevronLeft, ChevronRight,
  Grid3X3, LayoutList, SlidersHorizontal, X, Package, Wrench, ArrowRight,
  ChevronDown,
} from 'lucide-react'
import type { StoreCategory } from '@/types'
import { useBranch } from '@/contexts/BranchContext'
import { useVendor } from '@/contexts/VendorContext'
import { useEffectiveVendor } from '@/hooks/useEffectiveVendor'
import { catalogSearchPlaceholder, resolveStorefrontOfferingType } from '@/lib/catalogNavCapabilities'
import { useAuthStore } from '@/stores/authStore'
import { useTheme } from '@/contexts/ThemeContext'
import StarRating from '@/components/StarRating'
import { themeUi } from '@/lib/themeColors'
import { ProductCard } from '@/kit/products/ProductCard'
import { ProductGridSkeleton } from '@/kit/states/StateScreens'
import { resolveProductThumbnailUrl } from '@/lib/productImageUtils'
import { canPurchaseProduct } from '@/lib/stockValidation'
import { catalogToKitProduct } from '@/lib/catalogToKitProduct'
import { addCatalogProductToCart } from '@/lib/catalogAddToCart'
import { CatalogAddOrQtyControl } from '@/components/catalog/CatalogAddOrQtyControl'
import { shouldShowServiceBookCta, serviceBookingListCtaLabel } from '@/lib/serviceStorefrontCta'
import { resolveServiceDuration, resolveServicePrice } from '@/lib/servicePricing'
import { ServiceCard } from '@/kit/services/ServiceBlocks'
import { vendorDashboardUrl } from '@/lib/vendorDashboardUrl'

type FilterType = 'products' | 'services' | 'both'

function catalogEffectivePrice(
  item: {
    price?: number
    price_min?: number
    price_type?: string
    plans?: Array<{ price?: number; price_min?: number; is_active?: boolean; sort_order?: number }>
    variants?: Array<{ price?: number; price_type?: string; is_active?: boolean }>
  },
  isProduct: boolean,
  variants: Array<{ price?: number; price_type?: string }>,
): number | null {
  if (isProduct) {
    const activeVariants = variants.length
      ? variants
      : (item.variants || []).filter((v) => v.is_active !== false)
    // Prefer priced variants; ignore not_applicable / zero
    const priced = activeVariants
      .filter((v) => v.price_type !== 'not_applicable' && Number(v.price) > 0)
      .map((v) => Number(v.price))
    if (priced.length > 0) return Math.min(...priced)
    if (item.price_type === 'not_applicable') return null
    if (Number(item.price) > 0) return Number(item.price)
    return null
  }
  if (item.price_type === 'not_applicable') return null
  const servicePrice = resolveServicePrice(item)
  return servicePrice > 0 ? servicePrice : null
}

type CatalogListProps = {
  /** Page default for the Type filter (products page → products, services page → services). */
  defaultFilterType?: Exclude<FilterType, 'both'>
}

function catalogCountLabel(count: number, filterType: FilterType): string {
  if (filterType === 'products') return count === 1 ? 'product' : 'products'
  if (filterType === 'services') return count === 1 ? 'service' : 'services'
  return count === 1 ? 'item' : 'items'
}

function CatalogCountBadge({
  count,
  filterType,
  primaryColor,
}: {
  count: number
  filterType: FilterType
  primaryColor: string
}) {
  const label = catalogCountLabel(count, filterType)
  const Icon = filterType === 'products' ? Package : filterType === 'services' ? Wrench : ShoppingBag

  return (
    <div
      className="inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 shadow-sm transition-shadow hover:shadow-md"
      style={{
        borderColor: `${primaryColor}22`,
        background: `linear-gradient(145deg, ${primaryColor}0c 0%, ${primaryColor}04 100%)`,
      }}
      title="Total matching your filters"
      aria-live="polite"
      aria-label={`${count.toLocaleString()} ${label}`}
    >
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: `${primaryColor}18`, color: primaryColor }}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </div>
      <div className="min-w-[2.5rem] text-left">
        <span className="block text-base font-bold leading-none tabular-nums tracking-tight text-gray-900">
          {count.toLocaleString()}
        </span>
        <span className="mt-0.5 block text-[10px] font-medium capitalize leading-none text-gray-500">
          {label}
        </span>
      </div>
    </div>
  )
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
          className={`flex-1 text-left px-2 py-1 rounded text-sm truncate ${isActive ? `${themeUi.pillPrimary} font-medium` : 'text-gray-600 hover:bg-gray-50'}`}
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

/** Match grid ProductCard / bridgeProduct stock logic (aligned with add-to-cart validation). */
function variantHasStock(v: ProductVariant, product: Product): boolean {
  return canPurchaseProduct(product, v)
}

function productHasStock(product: Product): boolean {
  const variants = (product.variants || []).filter((v) => v.is_active !== false)
  if (variants.length > 0) {
    return variants.some((v) => variantHasStock(v, product))
  }
  return canPurchaseProduct(product)
}


export default function ProductList({ defaultFilterType = 'products' }: CatalogListProps) {
  const { storePath } = useBranch()
  const navigate = useNavigate()
  const { vendorSlug, displayFields, vendor } = useVendor()
  const effectiveVendor = useEffectiveVendor()
  const offering = resolveStorefrontOfferingType({
    offeringType: effectiveVendor?.offering_type ?? vendor?.offering_type,
    settings: effectiveVendor?.settings ?? vendor?.settings,
  })
  const allowProducts = offering !== 'services'
  const allowServices = offering !== 'products'
  const { isAuthenticated } = useAuthStore()
  const theme = useTheme()
  const addToCart = useAddToCart()
  useCart()
  const cartQtyByProduct = useCartProductQtyMap()
  const { setQty: setCatalogQty } = useSetCatalogCartQty()
  const cardStyle = theme.card_style || 'default'
  const [searchParams] = useSearchParams()
  const initialSearch = searchParams.get('search') || ''
  const initialCategory = searchParams.get('category') || ''

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState(initialSearch)
  const [searchInput, setSearchInput] = useState(initialSearch)
  const [category, setCategory] = useState('')
  const [sortBy, setSortBy] = useState('default')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showFilters, setShowFilters] = useState(false)

  // Filter state — page default is Products or Services only
  const [filterType, setFilterType] = useState<FilterType>(defaultFilterType)
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory)
  const [minPrice, setMinPrice] = useState<string>('')
  const [maxPrice, setMaxPrice] = useState<string>('')
  const [inStockOnly, setInStockOnly] = useState(false)

  useEffect(() => {
    if (!allowProducts && filterType !== 'services') setFilterType('services')
    else if (!allowServices && filterType !== 'products') setFilterType('products')
  }, [allowProducts, allowServices, filterType])

  const pageTitle = defaultFilterType === 'services' ? 'Services' : 'Products'
  const pageDescription =
    defaultFilterType === 'services'
      ? 'Browse available services and book in a few taps.'
      : 'Browse products and add what you need in a few taps.'
  const accountLink =
    defaultFilterType === 'services'
      ? { to: storePath('/account/bookings'), label: 'My Bookings' }
      : { to: storePath('/account/orders'), label: 'My Orders' }
  const { data: catData } = useStoreCategories({ tree: true })
  const categories = catData?.categories || []

  // Build query params - when showing "both" - when showing "both", fetch larger pages and paginate client-side
  const pageSize = filterType === 'both' ? 50 : 12
  const productParams = useMemo(() => ({
    page: filterType === 'services' ? 1 : (filterType === 'both' ? 1 : page),
    size: pageSize,
    search: search || undefined,
    category: selectedCategory || undefined,
    min_price: minPrice ? parseFloat(minPrice) : undefined,
    max_price: maxPrice ? parseFloat(maxPrice) : undefined,
    sort: sortBy || 'default',
  }), [page, search, selectedCategory, minPrice, maxPrice, filterType, pageSize, sortBy])

  const serviceParams = useMemo(() => ({
    page: filterType === 'products' ? 1 : (filterType === 'both' ? 1 : page),
    size: pageSize,
    search: search || undefined,
    category: selectedCategory || undefined,
    min_price: minPrice ? parseFloat(minPrice) : undefined,
    max_price: maxPrice ? parseFloat(maxPrice) : undefined,
    sort: sortBy || 'default',
  }), [page, search, selectedCategory, minPrice, maxPrice, filterType, pageSize, sortBy])

  const { data: productsData, isLoading: productsLoading, isError: productsError, refetch: refetchProducts } = useProducts(
    filterType === 'services' ? null : productParams
  )
  const { data: servicesData, isLoading: servicesLoading, isError: servicesError, refetch: refetchServices } = useServices(
    filterType === 'products' ? null : serviceParams
  )

  const isLoading =
    (filterType !== 'services' && productsLoading) ||
    (filterType !== 'products' && servicesLoading)
  const catalogError =
    (filterType !== 'services' && productsError) ||
    (filterType !== 'products' && servicesError)

  // Combine and filter results
  const allCombinedItems = useMemo(() => {
    let items: Array<(Product | Service) & { type: 'product' | 'service' }> = []
    if (filterType === 'products' || filterType === 'both') {
      const products = (productsData?.items || []).map((p: Product) => ({ ...p, type: 'product' as const }))
      items = [...items, ...products]
    }
    if (filterType === 'services' || filterType === 'both') {
      const services = (servicesData?.items || []).map((s: Service) => ({ ...s, type: 'service' as const }))
      items = [...items, ...services]
    }
    if (inStockOnly) {
      items = items.filter((item) => {
        if (item.type === 'product') return productHasStock(item as Product)
        return true
      })
    }
    const itemPrice = (item: (typeof items)[number]) => {
      const isProduct = item.type === 'product'
      const variants = isProduct
        ? ((item as Product).variants || []).filter((v) => v.is_active !== false)
        : []
      return catalogEffectivePrice(item, isProduct, variants)
    }
    if (sortBy === 'price_low') {
      items.sort((a, b) => (itemPrice(a) ?? Number.POSITIVE_INFINITY) - (itemPrice(b) ?? Number.POSITIVE_INFINITY))
    } else if (sortBy === 'price_high') {
      items.sort((a, b) => (itemPrice(b) ?? -1) - (itemPrice(a) ?? -1))
    } else if (sortBy === 'newest') {
      items.sort((a, b) => (new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()))
    } else if (sortBy === 'oldest') {
      items.sort((a, b) => (new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()))
    } else if (sortBy === 'rating') {
      items.sort((a, b) => {
        const ratingDiff = (b.avg_rating || 0) - (a.avg_rating || 0)
        if (ratingDiff !== 0) return ratingDiff
        return (b.review_count || 0) - (a.review_count || 0)
      })
    } else if (sortBy === 'name') {
      items.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }))
    } else if (sortBy === 'name_desc') {
      items.sort((a, b) => (b.name || '').localeCompare(a.name || '', undefined, { numeric: true }))
    }
    return items
  }, [productsData, servicesData, filterType, inStockOnly, sortBy])

  const sortedItems = allCombinedItems

  const combinedItems = useMemo(() => {
    if (filterType === 'both') {
      const start = (page - 1) * 12
      return sortedItems.slice(start, start + 12)
    }
    return sortedItems
  }, [sortedItems, page, filterType])

  const totalCount = useMemo(() => {
    if (filterType === 'products') return productsData?.total || 0
    if (filterType === 'services') return servicesData?.total || 0
    return sortedItems.length
  }, [filterType, productsData, servicesData, sortedItems.length])

  const clearFilters = () => {
    setSearch(''); setSearchInput(''); setSelectedCategory(''); setMinPrice(''); setMaxPrice(''); setInStockOnly(false); setPage(1)
  }

  const clearSearch = () => { setSearch(''); setSearchInput(''); setPage(1) }

  // Radix trigger + content styling: keeps the dropdown inside the viewport on
  // mobile (native <select> popups overflow/overlap on small screens).
  const selectTriggerCls = `h-7 w-full min-w-0 rounded-lg border-gray-200 bg-white px-2.5 text-sm text-gray-700 font-normal`
  const selectContentCls = 'max-w-[calc(100vw-1.5rem)]'

  const hasActiveFilters =
    Boolean(search) ||
    Boolean(selectedCategory) ||
    Boolean(minPrice) ||
    Boolean(maxPrice) ||
    inStockOnly ||
    filterType !== defaultFilterType

  const filterTypeLabel =
    filterType === defaultFilterType
      ? null
      : filterType === 'products'
        ? 'Products only'
        : filterType === 'services'
          ? 'Services only'
          : 'Products & Services'

  if (!allowServices && defaultFilterType === 'services') {
    return <Navigate to={storePath('/products')} replace />
  }
  if (!allowProducts && defaultFilterType === 'products') {
    return <Navigate to={storePath('/services')} replace />
  }

  return (
    <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-3">
      {/* Breadcrumb */}
      <nav className={`${themeUi.breadcrumbNav} mb-1 text-xs sm:text-sm leading-none`}>
        <Link to={storePath('/')} className={themeUi.linkOnPage}>Home</Link>
        <ChevronRight className="w-3 h-3 opacity-50" />
        <span className={themeUi.breadcrumbCurrent}>{pageTitle}</span>
        {isAuthenticated && (
          <>
            <span className="mx-2 text-gray-300">|</span>
            <Link to={accountLink.to} className="text-primary hover:underline">
              {accountLink.label}
            </Link>
          </>
        )}
      </nav>

      <header className="mb-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <h1 className="text-lg sm:text-xl font-bold tracking-tight text-gray-900 leading-none">
          {pageTitle}
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 leading-snug">
          {pageDescription}
        </p>
      </header>

      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
        {/* Sidebar Filters - toggled by Filters button */}
        {showFilters && (
        <aside className="w-full lg:w-64 shrink-0">
          <div className={`rounded-xl border p-5 sticky top-28 ${themeUi.cardSurface} ${themeUi.cardBorder}`}>
            <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" /> Filters
            </h3>
            <div className="space-y-4">
              {/* Type Filter — only when the vendor sells both products and services */}
              {allowProducts && allowServices && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Type</label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="filterType"
                      value="both"
                      checked={filterType === 'both'}
                      onChange={(e) => { setFilterType(e.target.value as FilterType); setPage(1) }}
                      className={`w-4 h-4 ${themeUi.accentRadio}`}
                    />
                    <span className="text-sm text-gray-700">Both</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="filterType"
                      value="products"
                      checked={filterType === 'products'}
                      onChange={(e) => { setFilterType(e.target.value as FilterType); setPage(1) }}
                      className={`w-4 h-4 ${themeUi.accentRadio}`}
                    />
                    <Package className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-700">Products</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="filterType"
                      value="services"
                      checked={filterType === 'services'}
                      onChange={(e) => { setFilterType(e.target.value as FilterType); setPage(1) }}
                      className={`w-4 h-4 ${themeUi.accentRadio}`}
                    />
                    <Wrench className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-700">Services</span>
                  </label>
                </div>
              </div>
              )}

              {categories.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Category</label>
                  <button
                    onClick={() => { setSelectedCategory(''); setPage(1) }}
                    className={`w-full text-left px-2 py-1 rounded text-sm ${!selectedCategory ? `${themeUi.pillPrimary} font-medium` : 'text-gray-600 hover:bg-gray-50'}`}
                  >All Categories</button>
                  {categories.map(cat => (
                    <CategoryTreeItem key={cat.id} cat={cat} level={0}
                      selected={selectedCategory} onSelect={(name) => { setSelectedCategory(name); setPage(1) }} />
                  ))}
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sort By</label>
                <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1) }}>
                  <SelectTrigger className={`mt-1.5 ${selectTriggerCls}`} aria-label="Sort by">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={selectContentCls}>
                    <SelectItem value="default">Relevance</SelectItem>
                    <SelectItem value="price_low">Price: Low to High</SelectItem>
                    <SelectItem value="price_high">Price: High to Low</SelectItem>
                    <SelectItem value="newest">Newest Arrivals</SelectItem>
                    <SelectItem value="rating">Avg. Customer Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(selectedCategory || minPrice || maxPrice || inStockOnly || search) && (
                <Button variant="outline" size="sm" onClick={clearFilters} className="w-full gap-1.5 text-gray-500">
                  <X className="w-3.5 h-3.5" /> Clear All Filters
                </Button>
              )}
            </div>
          </div>
        </aside>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Unified toolbar: search + sort + view + count + active chips */}
          <div className={`mb-3 rounded-xl border shadow-sm overflow-hidden ${themeUi.cardSurface} ${themeUi.cardBorder}`}>
            <div className="flex flex-col gap-2 p-2.5 sm:p-3">
              <div className="flex flex-col lg:flex-row lg:items-center gap-2">
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{showFilters ? 'Hide' : 'Show'}</span> filters
                  </Button>
                </div>

                <form
                  className="flex flex-1 min-w-0 flex-col gap-2 sm:flex-row sm:items-center"
                  onSubmit={(e) => {
                    e.preventDefault()
                    setSearch(searchInput.trim())
                    setPage(1)
                  }}
                >
                  <div className="relative flex-1 min-w-0 max-w-2xl">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                    <Input
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder={catalogSearchPlaceholder(offering)}
                      className="h-8 pl-9 pr-9 text-sm border-gray-200 bg-gray-50/80 focus:bg-white"
                      aria-label="Search catalogue"
                    />
                    {searchInput ? (
                      <button
                        type="button"
                        onClick={clearSearch}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        aria-label="Clear search"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                  <Button type="submit" size="sm" className="shrink-0 h-8 w-full px-4 text-white hover:opacity-95 sm:w-auto" style={{ backgroundColor: theme.colors.primary }}>
                    Search
                  </Button>
                </form>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end lg:shrink-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="mx-1 hidden h-6 w-px bg-gray-200 sm:block" aria-hidden />

                    <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50/80">
                      <button
                        type="button"
                        onClick={() => setViewMode('grid')}
                        className={`rounded-md p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}
                        aria-pressed={viewMode === 'grid'}
                        aria-label="Grid view"
                      >
                        <Grid3X3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('list')}
                        className={`rounded-md p-1.5 transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}
                        aria-pressed={viewMode === 'list'}
                        aria-label="List view"
                      >
                        <LayoutList className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <CatalogCountBadge
                      count={totalCount}
                      filterType={filterType}
                      primaryColor={theme.colors.primary}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 border-t border-gray-100 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Refine</span>
                  <div className="min-w-0 w-full sm:w-[11rem]">
                    <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1) }}>
                      <SelectTrigger className={selectTriggerCls} aria-label="Catalog sort (relevance, price, newest)">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={selectContentCls}>
                        <SelectItem value="default">Featured: Relevance</SelectItem>
                        <SelectItem value="price_low">Price: Low to high</SelectItem>
                        <SelectItem value="price_high">Price: High to low</SelectItem>
                        <SelectItem value="newest">Newest arrivals</SelectItem>
                        <SelectItem value="rating">Highest rated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {hasActiveFilters ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {filterTypeLabel ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                        {filterTypeLabel}
                        <button
                          type="button"
                          className="rounded p-0.5 hover:bg-amber-100"
                          onClick={() => { setFilterType(defaultFilterType); setPage(1) }}
                          aria-label="Clear type filter"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ) : null}
                    {search ? (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${themeUi.pillPrimary}`}>
                        “{search}”
                        <button type="button" className={`rounded p-0.5 ${themeUi.pillPrimaryHoverChip}`} onClick={clearSearch} aria-label="Remove search">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ) : null}
                    {selectedCategory ? (
                      <span className={`inline-flex max-w-[220px] items-center gap-1 truncate rounded-full px-2.5 py-0.5 text-xs font-medium ${themeUi.pillSecondary}`}>
                        {selectedCategory}
                        <button
                          type="button"
                          className={`shrink-0 rounded p-0.5 ${themeUi.pillSecondaryHoverChip}`}
                          onClick={() => { setSelectedCategory(''); setPage(1) }}
                          aria-label="Remove category"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ) : null}
                    {minPrice || maxPrice ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                        {minPrice ? `≥ ${minPrice}` : ''}{minPrice && maxPrice ? ' · ' : ''}{maxPrice ? `≤ ${maxPrice}` : ''}
                        <button
                          type="button"
                          className="rounded p-0.5 hover:bg-slate-200"
                          onClick={() => { setMinPrice(''); setMaxPrice(''); setPage(1) }}
                          aria-label="Clear price range"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ) : null}
                    {inStockOnly ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
                        In stock
                        <button
                          type="button"
                          className="rounded p-0.5 hover:bg-emerald-100"
                          onClick={() => { setInStockOnly(false); setPage(1) }}
                          aria-label="Remove in-stock filter"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ) : null}
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-500 hover:text-gray-800" onClick={clearFilters}>
                      Clear all
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Open filters to narrow by type, category, or price.</p>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Filters */}
          {/* Products/Services grid/list */}
          {isLoading ? (
            <ProductGridSkeleton count={8} />
          ) : !combinedItems.length ? (
            <div className="text-center py-20 bg-white rounded-xl border">
              <ShoppingBag className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {catalogError ? 'Could not load catalog' : 'No items found'}
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                {catalogError
                  ? `Your ${defaultFilterType === 'services' ? 'services' : 'products'} are still in the store — try refreshing the page.`
                  : (search || selectedCategory || minPrice || maxPrice || inStockOnly)
                    ? 'Try adjusting your search or filters'
                    : defaultFilterType === 'services'
                      ? 'Add services in your dashboard and they will appear here automatically.'
                      : 'Add products in your dashboard and they will appear here automatically.'}
              </p>
              {catalogError ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void refetchProducts()
                    void refetchServices()
                  }}
                >
                  Refresh {defaultFilterType === 'services' ? 'services' : 'products'}
                </Button>
              ) : (search || selectedCategory || minPrice || maxPrice || inStockOnly) ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>Clear Filters</Button>
              ) : (
                <a
                  href={vendorDashboardUrl(defaultFilterType === 'services' ? '/services/new' : '/products/new')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90"
                  style={{ backgroundColor: theme.colors.primary }}
                >
                  Add a {defaultFilterType === 'services' ? 'service' : 'product'}
                </a>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-2.5">
              {combinedItems.map((item: any) => {
                const isProduct = item.type === 'product'
                const detailPath = isProduct ? `/products/${item.slug}` : `/services/${item.slug}`
                const cardLinkTo = storePath(detailPath)
                const imageUrl = isProduct
                  ? resolveProductThumbnailUrl({ images: item.images, variants: item.variants })
                  : item.image_url
                const hasStock = isProduct ? productHasStock(item as Product) : true

                const variants = isProduct ? (item.variants || []).filter((v: any) => v.is_active !== false) : []
                const effectivePrice = catalogEffectivePrice(item, isProduct, variants)
                const showFrom = isProduct && !(Number(item.price) > 0) && effectivePrice != null && variants.some((v: any) => Number(v.price) > 0)
                const hasPrice = effectivePrice != null

                if (cardStyle === 'modern') {
                  // Dark overlay card: image fills the card, gradient overlay at bottom, text over image
                  return (
                    <Link key={`${item.type}-${item.id}`} to={cardLinkTo}
                      className="group relative aspect-[3/4] rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 bg-gray-900 block">
                      {imageUrl ? (
                        <img src={imgUrl(imageUrl)} alt={item.name}
                          className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                          {isProduct ? <ShoppingBag className="w-14 h-14 text-gray-600" /> : <Wrench className="w-14 h-14 text-gray-600" />}
                        </div>
                      )}
                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      {/* Badges */}
                      <div className="absolute top-2 left-2 flex gap-1.5">
                        <span className="text-white text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: isProduct ? theme.colors.primary : theme.colors.accent }}>
                          {isProduct ? 'Product' : 'Service'}
                        </span>
                        {isProduct && (item.compare_at_price ?? 0) > item.price && (
                          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            -{Math.round((1 - item.price / item.compare_at_price!) * 100)}%
                          </span>
                        )}
                      </div>
                      {/* Text at bottom */}
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <h3 className="text-white text-sm font-semibold line-clamp-2 leading-snug">{item.name}</h3>
                        <div className="mt-1.5 flex items-center justify-between">
                          {hasPrice ? (
                            <span className="text-white font-bold text-base">
                              {showFrom && <span className="text-xs font-normal mr-1 opacity-80">From</span>}
                              {formatCurrency(effectivePrice!)}
                            </span>
                          ) : (
                            <span className="min-h-[1.25rem]" aria-hidden />
                          )}
                          {(item.avg_rating ?? 0) > 0 && (
                            <StarRating rating={item.avg_rating!} size="sm" />
                          )}
                        </div>
                      </div>
                    </Link>
                  )
                }

                if (cardStyle === 'minimal') {
                  if (!isProduct) {
                    return (
                      <ServiceCard
                        key={`${item.type}-${item.id}`}
                        service={{
                          id: item.id,
                          slug: item.slug,
                          name: item.name,
                          shortDescription: item.short_description || item.description || '',
                          description: item.description || '',
                          image: imageUrl || undefined,
                          durationMinutes: resolveServiceDuration(item),
                          price: effectivePrice ?? 0,
                          currency: item.currency || 'INR',
                          price_type: item.price_type,
                          plans: item.plans,
                          features: item.features || [],
                          allowQuoteRequest: !!item.allow_quote_request,
                          requiresBooking: item.requires_booking,
                          bookingLabel: (item as Service).booking_label,
                        }}
                        linkTo={storePath(`/services/${item.slug}`)}
                        onBook={(svc) => navigate(storePath(`/services/${svc.slug}/book`))}
                      />
                    )
                  }
                  // Minimal card: no heavy border, subtle hover, airy layout
                  return (
                    <Link key={`${item.type}-${item.id}`} to={cardLinkTo}
                      className={`group flex flex-col rounded-xl hover:shadow-md transition-all duration-200 p-1 overflow-hidden ${themeUi.catalogSurface}`}>
                      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative">
                        {imageUrl ? (
                          <img src={imgUrl(imageUrl)} alt={item.name}
                            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {isProduct ? <ShoppingBag className="w-10 h-10 text-gray-300" /> : <Wrench className="w-10 h-10 text-gray-300" />}
                          </div>
                        )}
                        {!hasStock && (
                          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                            <span className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded-full shadow-sm">Out of Stock</span>
                          </div>
                        )}
                      </div>
                      <div className="pt-2.5 px-1">
                        <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: theme.colors.accent }}>
                          {isProduct ? 'Product' : 'Service'}
                        </p>
                        <h3 className={`text-sm font-medium line-clamp-2 ${themeUi.titleOnSurface} ${themeUi.groupHoverTitle}`}>{item.name}</h3>
                        {(item.avg_rating ?? 0) > 0 && (
                          <div className="mt-1"><StarRating rating={item.avg_rating!} size="sm" /></div>
                        )}
                        <div className="mt-1.5 flex items-center gap-2 min-h-[1.25rem]">
                          {hasPrice ? (
                            <>
                              <span className={`text-base ${themeUi.priceOnSurface}`}>
                                {showFrom && <span className="text-xs font-normal mr-0.5 text-gray-500">From</span>}
                                {formatCurrency(effectivePrice!)}
                              </span>
                              {isProduct && (item.compare_at_price ?? 0) > effectivePrice! && (
                                <span className="text-xs text-gray-400 line-through">{formatCurrency(item.compare_at_price!)}</span>
                              )}
                            </>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  )
                }

                // service card — same Book / quote rules as the services catalog
                if (!isProduct) {
                  return (
                    <ServiceCard
                      key={`${item.type}-${item.id}`}
                      service={{
                        id: item.id,
                        slug: item.slug,
                        name: item.name,
                        shortDescription: item.short_description || item.description || '',
                        description: item.description || '',
                        image: imageUrl || undefined,
                        durationMinutes: resolveServiceDuration(item),
                        price: effectivePrice ?? 0,
                        currency: item.currency || 'INR',
                        price_type: item.price_type,
                        plans: item.plans,
                        features: item.features || [],
                        allowQuoteRequest: !!item.allow_quote_request,
                        requiresBooking: item.requires_booking,
                        bookingLabel: (item as Service).booking_label,
                      }}
                      linkTo={storePath(`/services/${item.slug}`)}
                      onBook={(svc) => navigate(storePath(`/services/${svc.slug}/book`))}
                    />
                  )
                }

                // default product card — uses kit ProductCard
                const kitProduct = catalogToKitProduct(item as Product)

                return (
                  <ProductCard
                    key={`${item.type}-${item.id}`}
                    product={kitProduct}
                    linkTo={storePath(`/products/${item.slug}`)}
                    showRating
                    showTags
                    addToCartPending={addToCart.isPending}
                    onAddToCart={async (p, variant) => {
                      await addCatalogProductToCart({
                        vendorSlug,
                        isAuthenticated,
                        product: item as Product,
                        variants,
                        kitVariant: variant,
                        name: p.name,
                        slug: item.slug,
                        price: variant?.price ?? p.price,
                        image: p.image,
                        addToCart,
                      })
                    }}
                  />
                )
              })}
            </div>
          ) : (
            /* List view */
            <div className="space-y-3">
              {combinedItems.map((item: any) => {
                const isProduct = item.type === 'product'
                const detailPath = isProduct ? `/products/${item.slug}` : `/services/${item.slug}`
                const cardLinkTo = storePath(detailPath)
                const imageUrl = isProduct
                  ? resolveProductThumbnailUrl({ images: item.images, variants: item.variants })
                  : item.image_url
                const hasStock = isProduct ? productHasStock(item as Product) : true
                const variants = isProduct ? (item.variants || []).filter((v: any) => v.is_active !== false) : []
                const effectivePrice = catalogEffectivePrice(item, isProduct, variants)
                const showFrom = isProduct && !(Number(item.price) > 0) && effectivePrice != null && variants.some((v: any) => Number(v.price) > 0)
                const hasPrice = effectivePrice != null
                const listCartQty = isProduct ? (cartQtyByProduct.get(String(item.id)) ?? 0) : 0
                const showServiceBook = !isProduct && shouldShowServiceBookCta(
                  { allow_quote_request: item.allow_quote_request, requires_booking: item.requires_booking },
                  displayFields.service,
                )

                const handleListAddToCart = async () => {
                  if (!isProduct || !hasStock) return
                  await addCatalogProductToCart({
                    vendorSlug,
                    isAuthenticated,
                    product: item as Product,
                    variants,
                    kitVariant: variants.length === 1 ? { id: variants[0].id } : undefined,
                    name: item.name,
                    slug: item.slug,
                    price: effectivePrice ?? 0,
                    image: imageUrl ? imgUrl(imageUrl) : undefined,
                    addToCart,
                  })
                }

                const handleListQtyChange = async (qty: number) => {
                  if (!isProduct) return
                  const variantId = variants.length === 1 ? String(variants[0].id) : undefined
                  await setCatalogQty({
                    productId: String(item.id),
                    variantId,
                    qty,
                    addItem: {
                      product_id: String(item.id),
                      variant_id: variantId,
                      name: item.name,
                      qty: 1,
                      price: effectivePrice ?? 0,
                      image_url: imageUrl ? imgUrl(imageUrl) : undefined,
                      slug: item.slug,
                    },
                  })
                }

                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    className={`group flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:gap-4 sm:p-4 hover:shadow-md transition-all ${themeUi.catalogGridCard}`}
                  >
                    <Link
                      to={cardLinkTo}
                      className="w-full h-52 sm:w-64 sm:h-64 bg-gray-50 rounded-lg overflow-hidden shrink-0 relative flex items-center justify-center"
                    >
                      {imageUrl ? (
                        <img src={imgUrl(imageUrl)} alt={item.name} className="max-w-full max-h-full w-full h-full object-contain object-center" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {isProduct ? <ShoppingBag className="w-14 h-14 text-gray-200" /> : <Wrench className="w-14 h-14 text-gray-200" />}
                        </div>
                      )}
                      <span className="absolute top-2 right-2 text-white text-xs font-bold px-2 py-0.5 rounded bg-[color:var(--color-primary)]">
                        {isProduct ? 'Product' : 'Service'}
                      </span>
                    </Link>
                    <div className="flex-1 min-w-0 py-1">
                      <Link
                        to={cardLinkTo}
                        className={`text-base font-medium line-clamp-2 block no-underline ${themeUi.titleOnSurface} ${themeUi.groupHoverTitle}`}
                      >
                        {item.name}
                      </Link>
                      {(item.avg_rating ?? 0) > 0 && (
                        <div className="mt-1"><StarRating rating={item.avg_rating!} size="sm" showValue reviewCount={item.review_count} /></div>
                      )}
                      {(item.description || item.short_description) && (
                        <p className={`text-sm mt-2 line-clamp-2 ${themeUi.mutedOnSurface}`}>{item.description || item.short_description}</p>
                      )}
                      <div className="mt-3 min-h-[1.75rem]">
                        {hasPrice ? (
                          isProduct ? (
                            <>
                              {showFrom && <span className="text-sm text-gray-500 mr-1">From</span>}
                              <span className={`text-xl ${themeUi.priceOnSurface}`}>{formatCurrency(effectivePrice!)}</span>
                              {item.compare_at_price != null && item.compare_at_price > effectivePrice! && (
                                <>
                                  <span className="text-sm text-gray-400 line-through ml-2">{formatCurrency(item.compare_at_price)}</span>
                                  <span className="text-sm text-red-500 ml-2">
                                    ({Math.round((1 - effectivePrice! / item.compare_at_price) * 100)}% off)
                                  </span>
                                </>
                              )}
                              {variants.length > 1 && (
                                <span className="text-xs text-gray-500 ml-2">({variants.length} options)</span>
                              )}
                            </>
                          ) : (
                            <>
                              <span className={`text-xl ${themeUi.priceOnSurface}`}>{formatCurrency(effectivePrice!)}</span>
                              {item.price_min && item.price_max && item.price_min !== item.price_max && (
                                <span className="text-sm text-gray-500 ml-2">- {formatCurrency(item.price_max)}</span>
                              )}
                            </>
                          )
                        ) : null}
                      </div>
                      {isProduct && (
                        <p className="text-xs text-green-600 font-medium mt-1">Free Delivery</p>
                      )}
                      {!isProduct && item.service_mode && (
                        <p className={`text-xs mt-1 capitalize ${themeUi.mutedOnSurface}`}>{item.service_mode.replace('_', ' ')}</p>
                      )}
                    </div>
                    <div className="flex w-full shrink-0 flex-col items-stretch justify-center gap-2 sm:w-auto sm:min-w-[140px]">
                      {isProduct ? (
                        <CatalogAddOrQtyControl
                          cartQty={listCartQty}
                          onAdd={handleListAddToCart}
                          onQtyChange={handleListQtyChange}
                          outOfStock={!hasStock}
                          pending={addToCart.isPending}
                          addButtonStyle="filled"
                        />
                      ) : showServiceBook ? (
                        <Button size="sm" className="gap-1.5" asChild>
                          <Link to={storePath(`/services/${item.slug}/book`)}>
                            {serviceBookingListCtaLabel((item as Service).booking_label)} <ArrowRight className="w-4 h-4" />
                          </Link>
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" asChild>
                          <Link to={storePath(detailPath)}>View service</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {totalCount > 12 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                className={cn('gap-1', themeUi.paginationBtn)}>
                <ChevronLeft className="w-4 h-4" /> Previous
              </Button>
              {Array.from({ length: Math.min(Math.ceil(totalCount / 12), 5) }, (_, i) => {
                const totalPages = Math.ceil(totalCount / 12)
                const pageNum = page <= 3 ? i + 1 : Math.min(page + i - 2, totalPages)
                if (pageNum < 1 || pageNum > totalPages) return null
                const isActive = pageNum === page
                return (
                  <Button key={pageNum} variant={isActive ? 'default' : 'outline'} size="sm"
                    onClick={() => setPage(pageNum)}
                    className={cn('w-9 h-9', isActive ? themeUi.paginationBtnActive : themeUi.paginationBtn)}>
                    {pageNum}
                  </Button>
                )
              })}
              <Button variant="outline" size="sm" disabled={page >= Math.ceil(totalCount / 12)} onClick={() => setPage((p) => p + 1)}
                className={cn('gap-1', themeUi.paginationBtn)}>
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
