import { useMemo, useRef, useState } from 'react'
import { Search, X, Package, Wrench } from 'lucide-react'
import { useProducts, useServices } from '@/hooks/useVendor'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'

export interface CatalogPickerItem {
  id: string
  name: string
  item_type: 'product' | 'service'
  sku?: string
  price?: number
}

type Kind = 'product' | 'service'

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
  const wrapRef = useRef<HTMLDivElement>(null)
  useEscapeToClose(() => setOpen(false), open)

  const wantsProducts = kinds.includes('product')
  const wantsServices = kinds.includes('service')

  const { data: productsData } = useProducts(
    wantsProducts && storeId ? { size: 200, status: 'active', search: search || undefined, store_id: storeId } : { size: 1 },
  )
  const { data: servicesData } = useServices(
    wantsServices && storeId ? { size: 200, status: 'active', search: search || undefined, store_id: storeId } : { size: 1 },
  )

  const options = useMemo<CatalogPickerItem[]>(() => {
    const rows: CatalogPickerItem[] = []
    if (wantsProducts && storeId) {
      for (const p of (productsData?.items ?? []) as any[]) {
        rows.push({ id: p.id, name: p.name, item_type: 'product', sku: p.sku, price: p.price ?? p.selling_price ?? 0 })
      }
    }
    if (wantsServices && storeId) {
      for (const s of (servicesData?.items ?? []) as any[]) {
        rows.push({ id: s.id, name: s.name, item_type: 'service', price: s.price ?? s.base_price ?? 0 })
      }
    }
    return rows
  }, [productsData, servicesData, wantsProducts, wantsServices, storeId])

  const selectedIds = useMemo(() => new Set(value.map((v) => v.id)), [value])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return options
      .filter((o) => tab === 'all' || o.item_type === tab)
      .filter((o) => !q || o.name.toLowerCase().includes(q) || (o.sku || '').toLowerCase().includes(q))
      .filter((o) => !selectedIds.has(o.id))
      .slice(0, 20)
  }, [options, search, tab, selectedIds])

  const add = (item: CatalogPickerItem) => {
    onChange([...value, item])
    setSearch('')
  }
  const remove = (id: string) => onChange(value.filter((v) => v.id !== id))

  return (
    <div className="space-y-2" ref={wrapRef}>
      {!storeId && (
        <p className="text-xs text-amber-600">Select a business unit first to load its catalog.</p>
      )}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          disabled={disabled || !storeId}
          onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full h-9 pl-8 pr-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring disabled:bg-gray-50"
        />
        {open && storeId && (
          <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-auto">
            {(wantsProducts && wantsServices) && (
              <div className="flex gap-1 p-1 border-b border-gray-100 bg-gray-50 sticky top-0">
                {(['all', 'product', 'service'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`px-2 py-1 text-xs rounded ${tab === t ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    {t === 'all' ? 'All' : t === 'product' ? 'Products' : 'Services'}
                  </button>
                ))}
              </div>
            )}
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-gray-400 text-center">No matching items</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => add(o)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-blue-50"
                >
                  {o.item_type === 'product' ? <Package className="w-3.5 h-3.5 text-gray-400" /> : <Wrench className="w-3.5 h-3.5 text-gray-400" />}
                  <span className="flex-1 truncate">{o.name}</span>
                  {o.sku && <span className="text-xs text-gray-400">{o.sku}</span>}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span key={v.id} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-xs">
              {v.item_type === 'product' ? <Package className="w-3 h-3 text-gray-500" /> : <Wrench className="w-3 h-3 text-gray-500" />}
              {v.name}
              <button type="button" onClick={() => remove(v.id)} className="text-gray-400 hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
