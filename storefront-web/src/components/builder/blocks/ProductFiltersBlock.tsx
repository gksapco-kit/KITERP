import { useMemo, useState } from 'react'
import { Filter } from 'lucide-react'
import type { LiveItem, PublicSite, StyleConfig } from '@/blocks/registry'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
}

/**
 * Faceted filter bar — drives navigation by query-string so it works
 * without any in-page state coupling. The `categories` live feed already
 * returns counts via `meta.count`, so we use those for badges.
 *
 * Persists the chosen category and price range as `?category=foo&price=lo-hi`
 * on the current path so subsequent product blocks can read them. This
 * intentionally stays simple: real product-grid filtering would need a
 * server-side query, which is a follow-up.
 */
export default function ProductFiltersBlock({ site, style, props, liveItems }: Props) {
  const showPrice = props.show_price !== false
  const showCategory = props.show_category !== false

  const [activeCategory, setActiveCategory] = useState<string>('')
  const [priceRange, setPriceRange] = useState<{ min: string; max: string }>({ min: '', max: '' })

  const categories = useMemo(
    () =>
      liveItems
        .filter(i => i.title)
        .sort((a, b) => Number(b.meta?.count ?? 0) - Number(a.meta?.count ?? 0)),
    [liveItems],
  )

  const apply = () => {
    const params = new URLSearchParams(window.location.search)
    if (activeCategory) params.set('category', activeCategory)
    else params.delete('category')

    if (priceRange.min || priceRange.max) {
      params.set('price', `${priceRange.min || ''}-${priceRange.max || ''}`)
    } else {
      params.delete('price')
    }
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`)
    // Tell other blocks (ProductGrid, etc.) that filters changed.
    window.dispatchEvent(new CustomEvent('kiterp:filters-change', { detail: { category: activeCategory, price: priceRange } }))
  }

  const clear = () => {
    setActiveCategory('')
    setPriceRange({ min: '', max: '' })
    const params = new URLSearchParams(window.location.search)
    params.delete('category')
    params.delete('price')
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`)
    window.dispatchEvent(new CustomEvent('kiterp:filters-change', { detail: { category: '', price: { min: '', max: '' } } }))
  }

  return (
    <aside
      className="border border-gray-200 rounded-2xl p-5 bg-white space-y-5 sticky top-4"
      aria-label="Product filters"
      style={{ borderRadius: style.border_radius === 'rounded-full' ? '24px' : undefined }}
    >
      <header className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-500" aria-hidden="true" />
        <h3 className="text-sm font-bold tracking-tight" style={{ color: style.text_color }}>
          Filters
        </h3>
      </header>

      {showCategory && categories.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Category</p>
          <ul className="space-y-1.5">
            <li>
              <button
                type="button"
                onClick={() => setActiveCategory('')}
                className={`w-full text-left text-sm px-2 py-1 rounded-md transition-colors ${
                  activeCategory === '' ? 'bg-gray-100 font-semibold' : 'hover:bg-gray-50'
                }`}
              >
                All
              </button>
            </li>
            {categories.map(cat => (
              <li key={cat.id || cat.title}>
                <button
                  type="button"
                  onClick={() => setActiveCategory(cat.title)}
                  className={`w-full flex items-center justify-between text-sm px-2 py-1 rounded-md transition-colors ${
                    activeCategory === cat.title ? 'bg-gray-100 font-semibold' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="truncate">{cat.title}</span>
                  {cat.meta?.count != null && (
                    <span className="text-xs text-gray-400 ml-2">{Number(cat.meta.count)}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showPrice && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Price ({site.currency_symbol})</p>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              placeholder="Min"
              value={priceRange.min}
              onChange={e => setPriceRange(r => ({ ...r, min: e.target.value }))}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
            />
            <input
              type="number"
              inputMode="numeric"
              placeholder="Max"
              value={priceRange.max}
              onChange={e => setPriceRange(r => ({ ...r, max: e.target.value }))}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
            />
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={apply}
          className="flex-1 py-2 text-xs font-medium rounded-lg text-white"
          style={{ backgroundColor: style.primary_color }}
        >
          Apply
        </button>
        <button
          type="button"
          onClick={clear}
          className="flex-1 py-2 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          Clear
        </button>
      </div>
    </aside>
  )
}
