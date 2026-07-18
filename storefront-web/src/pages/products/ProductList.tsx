import { useState, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useProducts, useServices, useStoreCategories } from '@/hooks/useStore'
import { useAddToCart, useCart, useCartProductQtyMap, useSetCatalogCartQty } from '@/hooks/useStore'
import { formatCurrency, imgUrl, cn } from '@/lib/utils'
import type { Product, Service, ProductVariant, Cart } from '@/types'
import type { GuestCartItem } from '@/stores/guestCartStore'
import {
  Search, ShoppingBag, ShoppingCart, Loader2, ChevronLeft, ChevronRight,
  Grid3X3, LayoutList, SlidersHorizontal, X, Package, Wrench, ArrowRight,
  ChevronDown,
} from 'lucide-react'
import type { StoreCategory } from '@/types'
import { useBranch } from '@/contexts/BranchContext'
import { useVendor } from '@/contexts/VendorContext'
import { useAuthStore } from '@/stores/authStore'
import { useTheme } from '@/contexts/ThemeContext'
import StarRating from '@/components/StarRating'
import { processRows, type SortDir } from '@/lib/tableList'
import { themeUi } from '@/lib/themeColors'
import { ProductCard } from '@/kit/products/ProductCard'
import { ProductGridSkeleton } from '@/kit/states/StateScreens'
import { bridgeProduct } from '@/kit/bridge'
import { resolveProductThumbnailUrl } from '@/lib/productImageUtils'
import { variantColorCss, variantDisplayLabel } from '@/lib/variantOptions'
import { assertCanAddToCart, canPurchaseProduct } from '@/lib/stockValidation'
import { CatalogAddOrQtyControl } from '@/components/catalog/CatalogAddOrQtyControl'
import { shouldShowServiceBookCta, serviceBookingListCtaLabel } from '@/lib/serviceStorefrontCta'
import { resolveServiceDuration } from '@/lib/servicePricing'
import { ServiceCard } from '@/kit/services/ServiceBlocks'
import { toast } from 'sonner'
import { vendorDashboardUrl } from '@/lib/vendorDashboardUrl'

type FilterType = 'products' | 'services' | 'both'

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
      className="inline-flex items-center gap-2.5 rounded-xl border px-3 py-2 shadow-sm transition-shadow hover:shadow-md"
      style={{
        borderColor: `${primaryColor}22`,
        background: `linear-gradient(145deg, ${primaryColor}0c 0%, ${primaryColor}04 100%)`,
      }}
      title="Total matching your filters"
      aria-live="polite"
      aria-label={`${count.toLocaleString()} ${label}`}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${primaryColor}18`, color: primaryColor }}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-[3rem] text-left">
        <span className="block text-xl font-bold leading-none tabular-nums tracking-tight text-gray-900">
          {count.toLocaleString()}
        </span>
        <span className="mt-1 block text-[11px] font-medium capitalize leading-none text-gray-500">
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

function resolveListCartVariant(
  variants: ProductVariant[],
  kitVariant?: { id: string },
): ProductVariant | undefined {
  if (!kitVariant || kitVariant.id.endsWith('-default')) {
    return variants.length === 1 ? variants[0] : undefined
  }
  return variants.find((v) => v.id === kitVariant.id)
}

async function addProductToCart(input: {
  vendorSlug: string
  isAuthenticated: boolean
  product: Product
  variants: ProductVariant[]
  kitVariant?: { id: string }
  name: string
  slug: string
  price: number
  image?: string
  addToCart: { mutateAsync: (item: GuestCartItem) => Promise<Cart> }
}) {
  const srcVariant = resolveListCartVariant(input.variants, input.kitVariant)
  const stockCheck = assertCanAddToCart({
    vendorSlug: input.vendorSlug,
    isAuthenticated: input.isAuthenticated,
    productId: input.product.id,
    productName: input.name,
    product: input.product,
    variant: srcVariant,
    variantLabel: srcVariant ? variantDisplayLabel(srcVariant) || srcVariant.name : undefined,
    requestQty: 1,
  })
  if (!stockCheck.ok) {
    toast.error(stockCheck.message)
    return false
  }
  try {
    await input.addToCart.mutateAsync({
      product_id: input.product.id,
      variant_id: srcVariant?.id,
      variant_label: srcVariant ? variantDisplayLabel(srcVariant) || srcVariant.name : undefined,
      slug: input.slug,
      name: input.name,
      qty: 1,
      price: input.price,
      image_url: input.image,
    })
    toast.success('Added to cart')
    return true
  } catch {
    toast.error('Could not add to cart')
    return false
  }
}

export default function ProductList() {
  const { storePath } = useBranch()
  const navigate = useNavigate()
  const { vendorSlug, displayFields } = useVendor()
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

  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Filter state
  const [filterType, setFilterType] = useState<FilterType>('both')
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory)
  const [minPrice, setMinPrice] = useState<string>('')
  const [maxPrice, setMaxPrice] = useState<string>('')
  const [inStockOnly, setInStockOnly] = useState(false)

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
  }), [page, search, selectedCategory, minPrice, maxPrice, filterType, pageSize])

  const serviceParams = useMemo(() => ({
    page: filterType === 'products' ? 1 : (filterType === 'both' ? 1 : page),
    size: pageSize,
    search: search || undefined,
    category: selectedCategory || undefined,
    min_price: minPrice ? parseFloat(minPrice) : undefined,
    max_price: maxPrice ? parseFloat(maxPrice) : undefined,
  }), [page, search, selectedCategory, minPrice, maxPrice, filterType, pageSize])

  const { data: productsData, isLoading: productsLoading, isError: productsError, refetch: refetchProducts } = useProducts(
    filterType === 'services' ? undefined : productParams
  )
  const { data: servicesData, isLoading: servicesLoading, isError: servicesError, refetch: refetchServices } = useServices(
    filterType === 'products' ? undefined : serviceParams
  )

  const isLoading = productsLoading || servicesLoading
  const catalogError = productsError || servicesError

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
    if (sortBy === 'price_low') {
      items.sort((a, b) => {
        const aPrice = a.type === 'product' ? (a as Product).price : ((a as Service).price || (a as Service).price_min || 0)
        const bPrice = b.type === 'product' ? (b as Product).price : ((b as Service).price || (b as Service).price_min || 0)
        return aPrice - bPrice
      })
    } else if (sortBy === 'price_high') {
      items.sort((a, b) => {
        const aPrice = a.type === 'product' ? (a as Product).price : ((a as Service).price || (a as Service).price_max || 0)
        const bPrice = b.type === 'product' ? (b as Product).price : ((b as Service).price || (b as Service).price_max || 0)
        return bPrice - aPrice
      })
    } else if (sortBy === 'newest') {
      items.sort((a, b) => (new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()))
    } else if (sortBy === 'rating') {
      items.sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0))
    }
    return items
  }, [productsData, servicesData, filterType, inStockOnly, sortBy])

  const sortAccessors: Record<string, (row: (typeof allCombinedItems)[number]) => unknown> = useMemo(() => ({
    name: (r) => r.name ?? '',
    price: (r) => r.type === 'product' ? (r as Product).price : ((r as Service).price || (r as Service).price_min || 0),
    created_at: (r) => r.created_at ?? '',
  }), [])

  const sortedItems = useMemo(
    () => processRows(allCombinedItems, '', () => [], sortKey, sortDir, sortAccessors),
    [allCombinedItems, sortKey, sortDir, sortAccessors],
  )

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
  const selectTriggerCls = `h-9 w-full min-w-0 rounded-lg border-gray-200 bg-white px-2.5 text-sm text-gray-700 font-normal`
  const selectContentCls = 'max-w-[calc(100vw-1.5rem)]'

  const hasActiveFilters =
    Boolean(search) ||
    Boolean(selectedCategory) ||
    Boolean(minPrice) ||
    Boolean(maxPrice) ||
    inStockOnly ||
    filterType !== 'both'

  const filterTypeLabel = filterType === 'products' ? 'Products only' : filterType === 'services' ? 'Services only' : null

  return (
    <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
      {/* Breadcrumb */}
      <nav className={`${themeUi.breadcrumbNav} mb-4`}>
        <Link to={storePath('/')} className={themeUi.linkOnPage}>Home</Link>
        <span className={themeUi.pageTextMuted}>/</span>
        <span className={themeUi.breadcrumbCurrent}>Products</span>
      </nav>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Filters - toggled by Filters button */}
        {showFilters && (
        <aside className="w-full lg:w-64 shrink-0">
          <div className={`rounded-xl border p-5 sticky top-28 ${themeUi.cardSurface} ${themeUi.cardBorder}`}>
            <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" /> Filters
            </h3>
            <div className="space-y-4">
              {/* Type Filter */}
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
                <Select value={sortBy} onValueChange={setSortBy}>
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
          <div className={`mb-4 rounded-xl border shadow-sm overflow-hidden ${themeUi.cardSurface} ${themeUi.cardBorder}`}>
            <div className="flex flex-col gap-3 p-3 sm:p-4">
              <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span className="hidden sm:inline">{showFilters ? 'Hide' : 'Show'}</span> filters
                  </Button>
                </div>

                <form
                  className="flex flex-1 min-w-0 flex-col gap-2 sm:flex-row"
                  onSubmit={(e) => {
                    e.preventDefault()
                    setSearch(searchInput.trim())
                    setPage(1)
                  }}
                >
                  <div className="relative flex-1 min-w-0 max-w-2xl">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Search products and services…"
                      className="h-10 pl-10 pr-10 text-sm border-gray-200 bg-gray-50/80 focus:bg-white"
                      aria-label="Search catalogue"
                    />
                    {searchInput ? (
                      <button
                        type="button"
                        onClick={clearSearch}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        aria-label="Clear search"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                  <Button type="submit" size="sm" className="shrink-0 h-10 w-full px-4 text-white hover:opacity-95 sm:w-auto" style={{ backgroundColor: theme.colors.primary }}>
                    Search
                  </Button>
                </form>

                <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:flex-wrap sm:items-center sm:gap-2 lg:justify-end lg:shrink-0 lg:w-auto">
                  <span className="col-span-2 hidden text-xs font-medium uppercase tracking-wide text-gray-400 sm:col-span-1 sm:inline">Sort</span>
                  <div className="min-w-0">
                    <Select value={sortKey} onValueChange={setSortKey}>
                      <SelectTrigger className={selectTriggerCls} aria-label="Sort by">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={selectContentCls}>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="price">Price</SelectItem>
                        <SelectItem value="created_at">Date added</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0">
                    <Select value={sortDir} onValueChange={(v) => setSortDir(v as SortDir)}>
                      <SelectTrigger className={selectTriggerCls} aria-label="Sort direction">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={selectContentCls}>
                        <SelectItem value="asc">Ascending</SelectItem>
                        <SelectItem value="desc">Descending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1 sm:contents">
                    <div className="mx-1 hidden h-8 w-px bg-gray-200 sm:block" aria-hidden />

                    <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50/80">
                      <button
                        type="button"
                        onClick={() => setViewMode('grid')}
                        className={`rounded-md p-2 transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}
                        aria-pressed={viewMode === 'grid'}
                        aria-label="Grid view"
                      >
                        <Grid3X3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('list')}
                        className={`rounded-md p-2 transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}
                        aria-pressed={viewMode === 'list'}
                        aria-label="List view"
                      >
                        <LayoutList className="h-4 w-4" />
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

              <div className="flex flex-col gap-2 border-t border-gray-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Refine</span>
                  <div className="min-w-0 w-full sm:w-[11rem]">
                    <Select value={sortBy} onValueChange={setSortBy}>
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
                          onClick={() => { setFilterType('both'); setPage(1) }}
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
                    <Button variant="ghost" size="sm" className="h-8 text-xs text-gray-500 hover:text-gray-800" onClick={clearFilters}>
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
                  ? 'Your products are still in the store — try refreshing the page.'
                  : (search || selectedCategory || minPrice || maxPrice || inStockOnly)
                    ? 'Try adjusting your search or filters'
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
                  Refresh products
                </Button>
              ) : (search || selectedCategory || minPrice || maxPrice || inStockOnly) ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>Clear Filters</Button>
              ) : (
                <a
                  href={vendorDashboardUrl('/products/new')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90"
                  style={{ backgroundColor: theme.colors.primary }}
                >
                  Add a product
                </a>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {combinedItems.map((item: any) => {
                const isProduct = item.type === 'product'
                const detailPath = isProduct ? `/products/${item.slug}` : `/services/${item.slug}`
                const cardLinkTo = storePath(detailPath)
                const imageUrl = isProduct
                  ? resolveProductThumbnailUrl({ images: item.images, variants: item.variants })
                  : item.image_url
                const hasStock = isProduct ? productHasStock(item as Product) : true

                const variants = isProduct ? (item.variants || []).filter((v: any) => v.is_active !== false) : []
                const effectivePrice = isProduct
                  ? (item.price > 0 ? item.price : variants.length > 0 ? Math.min(...variants.map((v: any) => v.price)) : 0)
                  : (item.price || item.price_min || 0)
                const showFrom = isProduct && item.price === 0 && variants.length > 0

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
                        {isProduct && item.compare_at_price && item.compare_at_price > item.price && (
                          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            -{Math.round((1 - item.price / item.compare_at_price) * 100)}%
                          </span>
                        )}
                      </div>
                      {/* Text at bottom */}
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <h3 className="text-white text-sm font-semibold line-clamp-2 leading-snug">{item.name}</h3>
                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="text-white font-bold text-base">
                            {showFrom && <span className="text-xs font-normal mr-1 opacity-80">From</span>}
                            {formatCurrency(effectivePrice)}
                          </span>
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
                          price: effectivePrice,
                          currency: item.currency || 'INR',
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
                            className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300" />
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
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className={`text-base ${themeUi.priceOnSurface}`}>
                            {showFrom && <span className="text-xs font-normal mr-0.5 text-gray-500">From</span>}
                            {formatCurrency(effectivePrice)}
                          </span>
                          {isProduct && item.compare_at_price && item.compare_at_price > effectivePrice && (
                            <span className="text-xs text-gray-400 line-through">{formatCurrency(item.compare_at_price)}</span>
                          )}
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
                        price: effectivePrice,
                        currency: item.currency || 'INR',
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
                const kitProduct = bridgeProduct({
                  id: item.id,
                  slug: item.slug,
                  title: item.name,
                  description: item.description || item.short_description || '',
                  categoryIds: [],
                  images: (item.images || []).map((img: any) => ({
                    url: img.url || imgUrl(img.url),
                    alt: img.alt_text || '',
                  })),
                  variants: variants.length > 0
                    ? variants.map((v: ProductVariant) => ({
                        id: v.id,
                        name: v.name,
                        options: v.attributes || {},
                        color: variantColorCss(v),
                        media: v.media,
                        price: { amount: Math.round((v.price ?? 0) * 100), currency: v.currency || 'INR' },
                        compareAtPrice: v.compare_at_price ? { amount: Math.round(v.compare_at_price * 100), currency: v.currency || 'INR' } : undefined,
                        inStock: variantHasStock(v, item as Product),
                        quantity: v.quantity,
                        track_inventory: v.track_inventory,
                        allow_backorders: v.allow_backorders,
                        stock_status: v.stock_status,
                      }))
                    : [{ id: `${item.id}-default`, name: 'Default', options: {}, price: { amount: Math.round((item.price ?? 0) * 100), currency: item.currency || 'INR' }, inStock: hasStock }],
                  rating: (item.avg_rating ?? 0) > 0 ? { value: item.avg_rating, count: item.review_count ?? 0 } : undefined,
                  tags: item.tags || [],
                } as any)
                kitProduct.viewCount = item.view_count ?? 0

                return (
                  <ProductCard
                    key={`${item.type}-${item.id}`}
                    product={kitProduct}
                    linkTo={storePath(`/products/${item.slug}`)}
                    showRating
                    showTags
                    addToCartPending={addToCart.isPending}
                    onAddToCart={async (p, variant) => {
                      await addProductToCart({
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
                const effectivePrice = isProduct
                  ? (item.price > 0 ? item.price : variants.length > 0 ? Math.min(...variants.map((v: any) => v.price)) : 0)
                  : (item.price || item.price_min || 0)
                const showFrom = isProduct && item.price === 0 && variants.length > 0
                const listCartQty = isProduct ? (cartQtyByProduct.get(String(item.id)) ?? 0) : 0
                const showServiceBook = !isProduct && shouldShowServiceBookCta(
                  { allow_quote_request: item.allow_quote_request, requires_booking: item.requires_booking },
                  displayFields.service,
                )

                const handleListAddToCart = async () => {
                  if (!isProduct || !hasStock) return
                  await addProductToCart({
                    vendorSlug,
                    isAuthenticated,
                    product: item as Product,
                    variants,
                    kitVariant: variants.length === 1 ? { id: variants[0].id } : undefined,
                    name: item.name,
                    slug: item.slug,
                    price: effectivePrice,
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
                      price: effectivePrice,
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
                      className="w-full h-40 sm:w-44 sm:h-44 bg-gray-50 rounded-lg overflow-hidden shrink-0 relative block"
                    >
                      {imageUrl ? (
                        <img src={imgUrl(imageUrl)} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {isProduct ? <ShoppingBag className="w-10 h-10 text-gray-200" /> : <Wrench className="w-10 h-10 text-gray-200" />}
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
                      <div className="mt-3">
                        {isProduct ? (
                          <>
                            {showFrom && <span className="text-sm text-gray-500 mr-1">From</span>}
                            <span className={`text-xl ${themeUi.priceOnSurface}`}>{formatCurrency(effectivePrice)}</span>
                            {item.compare_at_price && item.compare_at_price > effectivePrice && (
                              <>
                                <span className="text-sm text-gray-400 line-through ml-2">{formatCurrency(item.compare_at_price)}</span>
                                <span className="text-sm text-red-500 ml-2">
                                  ({Math.round((1 - effectivePrice / item.compare_at_price) * 100)}% off)
                                </span>
                              </>
                            )}
                            {variants.length > 1 && (
                              <span className="text-xs text-gray-500 ml-2">({variants.length} options)</span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className={`text-xl ${themeUi.priceOnSurface}`}>{formatCurrency(effectivePrice)}</span>
                            {item.price_min && item.price_max && item.price_min !== item.price_max && (
                              <span className="text-sm text-gray-500 ml-2">- {formatCurrency(item.price_max)}</span>
                            )}
                          </>
                        )}
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
