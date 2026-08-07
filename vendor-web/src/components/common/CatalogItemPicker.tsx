import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, Loader2, Package, Search, Wrench, X } from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import { useProducts, useServices } from '@/hooks/useVendor'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { isDefaultManualVariantName, variantSelectOption } from '@/lib/productVariants'

export interface CatalogPickerItem {
  id: string
  name: string
  item_type: 'product' | 'service'
  sku?: string
  price?: number
  /** Present when a specific product variant was chosen. */
  variant_id?: string
}

type Kind = 'product' | 'service'

type ProductRow = {
  id: string
  name: string
  sku?: string
  price?: number
  is_subscription?: boolean
  variants: Array<{
    id: string
    name?: string | null
    sku?: string | null
    barcode?: string | null
    uom?: string | null
    uom_quantity?: number | null
    price?: number | null
    cost_price?: number | null
    currency?: string | null
    attributes?: Record<string, unknown> | null
    color?: string | null
    is_active?: boolean
  }>
}

interface CatalogItemPickerProps {
  /** Business unit to scope the catalog to. When empty, no items are shown. */
  storeId: string
  value: CatalogPickerItem[]
  onChange: (items: CatalogPickerItem[]) => void
  /** Which catalog kinds to offer. Defaults to both. */
  kinds?: Kind[]
  placeholder?: string
  disabled?: boolean
}

function itemKey(item: Pick<CatalogPickerItem, 'item_type' | 'id' | 'variant_id'>) {
  return `${item.item_type}:${item.id}:${item.variant_id ?? ''}`
}

function activeVariantsOf(product: ProductRow | null | undefined) {
  return (product?.variants ?? []).filter((v) => v.is_active !== false)
}

function isSingleDefaultVariant(product: ProductRow) {
  const variants = activeVariantsOf(product)
  return (
    variants.length === 1 &&
    isDefaultManualVariantName(variants[0]?.name, Boolean(product.is_subscription))
  )
}

/** Searchable multi-select of products and/or services, scoped to a business unit. */
export function CatalogItemPicker({
  storeId,
  value,
  onChange,
  kinds = ['product', 'service'],
  placeholder = 'Search products & services…',
  disabled,
}: CatalogItemPickerProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'all' | Kind>('all')
  const [variantPickFor, setVariantPickFor] = useState<ProductRow | null>(null)
  const [variantLoading, setVariantLoading] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputWrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  useEscapeToClose(() => {
    if (variantPickFor) setVariantPickFor(null)
    else setOpen(false)
  }, open)

  const wantsProducts = kinds.includes('product')
  const wantsServices = kinds.includes('service')

  const { data: productsData } = useProducts(
    wantsProducts && storeId ? { size: 200, status: 'active', search: search || undefined, store_id: storeId } : { size: 1 },
  )
  const { data: servicesData } = useServices(
    wantsServices && storeId ? { size: 200, status: 'active', search: search || undefined, store_id: storeId } : { size: 1 },
  )

  const products = useMemo<ProductRow[]>(() => {
    if (!wantsProducts || !storeId) return []
    return ((productsData?.items ?? []) as any[]).map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      price: p.price ?? p.selling_price ?? 0,
      is_subscription: Boolean(p.is_subscription),
      variants: Array.isArray(p.variants) ? p.variants : [],
    }))
  }, [productsData, wantsProducts, storeId])

  const services = useMemo<CatalogPickerItem[]>(() => {
    if (!wantsServices || !storeId) return []
    return ((servicesData?.items ?? []) as any[]).map((s) => ({
      id: s.id,
      name: s.name,
      item_type: 'service' as const,
      price: s.price ?? s.base_price ?? 0,
    }))
  }, [servicesData, wantsServices, storeId])

  const selectedKeys = useMemo(() => new Set(value.map(itemKey)), [value])

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products
      .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)
        || activeVariantsOf(p).some((v) => (v.name || '').toLowerCase().includes(q) || (v.sku || '').toLowerCase().includes(q)))
      .slice(0, 20)
  }, [products, search])

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase()
    return services
      .filter((s) => !selectedKeys.has(itemKey(s)))
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .slice(0, 20)
  }, [services, search, selectedKeys])

  const showProducts = tab === 'all' || tab === 'product'
  const showServices = tab === 'all' || tab === 'service'

  const updateMenuPos = () => {
    const el = inputWrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const gap = 4
    const spaceBelow = window.innerHeight - rect.bottom - gap - 8
    const spaceAbove = rect.top - gap - 8
    const preferBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove
    const maxHeight = Math.max(160, Math.min(320, preferBelow ? spaceBelow : spaceAbove))
    setMenuPos({
      top: preferBelow ? rect.bottom + gap : Math.max(8, rect.top - gap - maxHeight),
      left: rect.left,
      width: rect.width,
      maxHeight,
    })
  }

  useLayoutEffect(() => {
    if (!open || !storeId) {
      setMenuPos(null)
      return
    }
    updateMenuPos()
  }, [open, storeId, filteredProducts.length, filteredServices.length, tab, variantPickFor])

  useEffect(() => {
    if (!open) return
    const onScrollOrResize = () => updateMenuPos()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (wrapRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
      setVariantPickFor(null)
    }
    document.addEventListener('mousedown', handlePointerDown, true)
    return () => document.removeEventListener('mousedown', handlePointerDown, true)
  }, [open])

  useEffect(() => {
    if (!open) {
      setVariantPickFor(null)
      setVariantLoading(false)
    }
  }, [open])

  const add = (item: CatalogPickerItem, { keepOpen = true }: { keepOpen?: boolean } = {}) => {
    if (selectedKeys.has(itemKey(item))) return
    onChange([...value, item])
    setSearch('')
    if (!keepOpen) {
      setOpen(false)
      setVariantPickFor(null)
    }
  }

  const remove = (item: CatalogPickerItem) =>
    onChange(value.filter((v) => itemKey(v) !== itemKey(item)))

  const addVariant = (product: ProductRow, variant: ProductRow['variants'][number]) => {
    const opt = variantSelectOption(variant)
    const collapseDefault = isSingleDefaultVariant(product) && activeVariantsOf(product)[0]?.id === variant.id
    add({
      id: product.id,
      name: collapseDefault ? product.name : `${product.name} — ${opt.label}`,
      item_type: 'product',
      sku: variant.sku || product.sku,
      price: variant.price ?? product.price ?? 0,
      variant_id: variant.id,
    })
  }

  const pickProduct = async (product: ProductRow) => {
    let full = product
    let variants = activeVariantsOf(product)

    // List payload sometimes omits variants — fetch detail when needed.
    if (variants.length === 0) {
      setVariantLoading(true)
      try {
        const detail = await vendorApi.getProduct(product.id) as any
        full = {
          id: detail.id,
          name: detail.name,
          sku: detail.sku,
          price: detail.price ?? detail.selling_price ?? 0,
          is_subscription: Boolean(detail.is_subscription),
          variants: Array.isArray(detail.variants) ? detail.variants : [],
        }
        variants = activeVariantsOf(full)
      } catch {
        variants = []
      } finally {
        setVariantLoading(false)
      }
    }

    if (variants.length === 0) {
      add({
        id: full.id,
        name: full.name,
        item_type: 'product',
        sku: full.sku,
        price: full.price ?? 0,
      })
      return
    }

    if (variants.length === 1 || isSingleDefaultVariant(full)) {
      addVariant(full, variants[0])
      setVariantPickFor(null)
      return
    }

    // Multi-variant product → show variant chooser.
    setVariantPickFor(full)
  }

  const availableVariants = variantPickFor
    ? activeVariantsOf(variantPickFor).filter(
        (v) => !selectedKeys.has(itemKey({ item_type: 'product', id: variantPickFor.id, variant_id: v.id })),
      )
    : []

  const menu =
    open && storeId && menuPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[220] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              maxHeight: menuPos.maxHeight,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {variantPickFor ? (
              <div className="flex max-h-full flex-col" style={{ maxHeight: menuPos.maxHeight }}>
                <div className="flex shrink-0 items-center gap-1 border-b border-gray-100 bg-gray-50 px-2 py-1.5">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setVariantPickFor(null)}
                    className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                    aria-label="Back to products"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <p className="min-w-0 flex-1 truncate text-xs font-medium text-gray-700">
                    Select variant — {variantPickFor.name}
                  </p>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setOpen(false); setVariantPickFor(null) }}
                    className="rounded p-1 text-gray-400 hover:text-gray-600"
                    aria-label="Close"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="overflow-y-auto">
                  {variantLoading ? (
                    <div className="flex items-center justify-center gap-2 px-3 py-6 text-xs text-gray-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading variants…
                    </div>
                  ) : availableVariants.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-gray-400">
                      All variants already selected
                    </div>
                  ) : (
                    availableVariants.map((v) => {
                      const opt = variantSelectOption(v)
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => addVariant(variantPickFor, v)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-blue-50"
                        >
                          <Package className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          <span className="min-w-0 flex-1 truncate font-medium text-gray-900">{opt.label}</span>
                          {opt.hint && <span className="shrink-0 text-xs text-gray-400">{opt.hint}</span>}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="flex max-h-full flex-col" style={{ maxHeight: menuPos.maxHeight }}>
                {(wantsProducts && wantsServices) && (
                  <div className="flex shrink-0 gap-1 border-b border-gray-100 bg-gray-50 p-1">
                    {(['all', 'product', 'service'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setTab(t)}
                        className={`rounded px-2 py-1 text-xs ${tab === t ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                      >
                        {t === 'all' ? 'All' : t === 'product' ? 'Products' : 'Services'}
                      </button>
                    ))}
                  </div>
                )}
                <div className="overflow-y-auto">
                  {variantLoading && (
                    <div className="flex items-center justify-center gap-2 border-b border-gray-50 px-3 py-2 text-xs text-gray-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading variants…
                    </div>
                  )}
                  {showProducts && filteredProducts.map((p) => {
                    const variants = activeVariantsOf(p)
                    const multi = variants.length > 1 && !isSingleDefaultVariant(p)
                    return (
                      <button
                        key={`product:${p.id}`}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { void pickProduct(p) }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-blue-50"
                      >
                        <Package className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        {multi ? (
                          <span className="shrink-0 text-[10px] text-blue-600">{variants.length} variants</span>
                        ) : p.sku ? (
                          <span className="shrink-0 text-xs text-gray-400">{p.sku}</span>
                        ) : null}
                      </button>
                    )
                  })}
                  {showServices && filteredServices.map((s) => (
                    <button
                      key={itemKey(s)}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => add(s)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-blue-50"
                    >
                      <Wrench className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    </button>
                  ))}
                  {((showProducts && filteredProducts.length === 0) && (showServices && filteredServices.length === 0)
                    || (!showProducts && filteredServices.length === 0)
                    || (!showServices && filteredProducts.length === 0)) && (
                    <div className="px-3 py-4 text-center text-xs text-gray-400">No matching items</div>
                  )}
                </div>
              </div>
            )}
          </div>,
          document.body,
        )
      : null

  return (
    <div className="space-y-2" ref={wrapRef}>
      {!storeId && (
        <p className="text-xs text-amber-600">Select a business unit first to load its catalog.</p>
      )}
      <div className="relative" ref={inputWrapRef}>
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          disabled={disabled || !storeId}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); setVariantPickFor(null) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:bg-gray-50"
        />
      </div>
      {menu}

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span key={itemKey(v)} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs">
              {v.item_type === 'product' ? <Package className="h-3 w-3 text-gray-500" /> : <Wrench className="h-3 w-3 text-gray-500" />}
              {v.name}
              <button type="button" onClick={() => remove(v)} className="text-gray-400 hover:text-red-500">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
