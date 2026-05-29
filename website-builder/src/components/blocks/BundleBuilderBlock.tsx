import { useMemo, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { BUNDLE_BUILDER_DEFAULTS } from '../../lib/bundleBuilderDefaults'
import { gridColumnClass } from '../../lib/blockUtils'
import { resolveBlockProducts } from '../../lib/productDefaults'
import { SectionHeading } from '../builder/SectionHeading'
import { useBuilderStore } from '../../store/useBuilderStore'
import type { Block } from '../../types/builder'

interface BundleBuilderBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
  interactive?: boolean
}

function formatPrice(price: number) {
  return `$${price.toFixed(2)}`
}

export function BundleBuilderBlock({ block, layoutStyle, interactive = false }: BundleBuilderBlockProps) {
  const catalog = useBuilderStore((s) => s.catalog.products)
  const addToCart = useBuilderStore((s) => s.addToCart)
  const { props, styles } = block
  const products = resolveBlockProducts(props, catalog)
  const minItems = props.bundleBuilderMinItems ?? BUNDLE_BUILDER_DEFAULTS.bundleBuilderMinItems
  const maxItems = props.bundleBuilderMaxItems ?? BUNDLE_BUILDER_DEFAULTS.bundleBuilderMaxItems
  const discountPct = props.bundleBuilderDiscountPercent ?? BUNDLE_BUILDER_DEFAULTS.bundleBuilderDiscountPercent
  const showSavings = props.showBundleBuilderSavings !== false
  const previewIds = props.bundleBuilderPreviewSelectedIds ?? []
  const [selected, setSelected] = useState<string[]>(previewIds)
  const activeSelected = interactive ? selected : previewIds

  const selectedProducts = useMemo(
    () => products.filter((p) => activeSelected.includes(p.id)),
    [products, activeSelected],
  )

  const total = selectedProducts.reduce((sum, p) => sum + p.price, 0)
  const qualified = selectedProducts.length >= minItems
  const discounted = qualified && showSavings ? total * (1 - discountPct / 100) : total

  const toggle = (id: string) => {
    if (!interactive) return
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= maxItems) return prev
      return [...prev, id]
    })
  }

  const handleAddBundle = () => {
    if (!interactive || !qualified) return
    selectedProducts.forEach((p) => {
      addToCart({
        itemId: p.id,
        itemType: 'product',
        name: p.name,
        price: p.price,
        quantity: 1,
        imageUrl: p.imageUrl ?? '',
      })
    })
  }

  if (products.length === 0) {
    return (
      <section style={layoutStyle} className="py-12 text-center text-sm text-gray-400">
        Add bundle options in the properties panel
      </section>
    )
  }

  return (
    <section style={layoutStyle} className="w-full">
      <div className="mx-auto max-w-5xl">
        {(props.text || props.subtitle) && (
          <SectionHeading title={props.text} subtitle={props.subtitle} styles={styles} className="mb-6" />
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className={`grid gap-3 ${gridColumnClass(2, 'responsive')}`}>
            {products.map((p) => {
              const isSelected = activeSelected.includes(p.id)
              const atMax = activeSelected.length >= maxItems && !isSelected
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  disabled={!interactive || atMax}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200 dark:bg-brand-950/30'
                      : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900'
                  } ${atMax ? 'opacity-50' : ''}`}
                >
                  {p.imageUrl && <img src={p.imageUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{p.name}</p>
                    <p className="text-sm font-semibold text-brand-600">{formatPrice(p.price)}</p>
                  </div>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isSelected ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                    {isSelected ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </span>
                </button>
              )
            })}
          </div>

          <aside className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-900/50">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Your bundle</p>
            <p className="mt-1 text-xs text-gray-500">
              Select {minItems}–{maxItems} items
              {showSavings && qualified && ` · Save ${discountPct}%`}
            </p>
            <ul className="mt-4 space-y-2">
              {selectedProducts.length === 0 ? (
                <li className="text-sm text-gray-400">No items selected</li>
              ) : (
                selectedProducts.map((p) => (
                  <li key={p.id} className="flex justify-between text-sm">
                    <span className="truncate pr-2 text-gray-700 dark:text-gray-300">{p.name}</span>
                    <span className="font-medium text-brand-600">{formatPrice(p.price)}</span>
                  </li>
                ))
              )}
            </ul>
            <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-gray-500">Total</span>
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatPrice(discounted)}
                  {qualified && showSavings && total > discounted && (
                    <span className="ml-2 text-sm font-normal text-gray-400 line-through">{formatPrice(total)}</span>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddBundle}
                disabled={!qualified}
                className="mt-4 w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {props.buttonText ?? 'Add bundle to cart'}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
